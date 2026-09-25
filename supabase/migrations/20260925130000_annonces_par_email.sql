-- Annonces par e-mail — le second canal de la MEME annonce (2026-09-25).
--
-- POURQUOI. L'onglet 📣 Annonce n'atteint que les telephones ou l'app est
-- installee : 19 appareils pour 7 comptes le 2026-09-25. Beaucoup de clients
-- commandent DEPUIS LE SITE et ne recoivent donc rien. L'e-mail est le seul
-- canal qui les touche tous.
--
-- ⚠️ LA DESINSCRIPTION NE PORTE QUE SUR LES ANNONCES. Les e-mails lies a une
-- commande (recue, acceptee, livree, remboursee) continuent toujours : ils ne
-- sont pas commerciaux, ils sont la trace de ce que la personne a achete.
-- C'est ecrit noir sur blanc dans le pied de l'e-mail et sur la page de
-- desinscription, et rien ici ne peut les couper.
--
-- ⚠️ LE JETON EST L'AUTORISATION, ET IL N'EST PAS L'IDENTIFIANT DU COMPTE.
-- Meme patron que `repondre-commande` : un uuid imprevisible, propre a UNE
-- personne, qui ne permet QUE de se desinscrire ou de se reabonner. Mettre
-- `user_id` dans l'URL laisserait n'importe qui desinscrire n'importe qui — il
-- suffit de lire un identifiant dans un partage.
--
-- ⚠️ RIEN N'EST LISIBLE NI MODIFIABLE PAR `anon` EN DIRECT. La table ne porte
-- aucune policy et aucun grant ; la seule porte est la fonction
-- `annonce_desinscription_par_jeton`, qui n'accepte QUE le jeton.

-- ---------------------------------------------------------------------------
-- 1. La preference, une ligne par personne
-- ---------------------------------------------------------------------------
-- Absence de ligne = abonne (c'est le defaut annonce au client a l'inscription).
-- La ligne nait au premier envoi, ecrite par `annonces_jetons` : il faut bien un
-- jeton a mettre dans le lien.
create table if not exists public.preferences_annonces (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  annonces_email boolean not null default true,
  -- Jeton de desinscription : imprevisible, stable, jamais l'id du compte.
  jeton          uuid not null default gen_random_uuid() unique,
  creee_le       timestamptz not null default now(),
  maj_le         timestamptz not null default now()
);

alter table public.preferences_annonces enable row level security;
-- Aucune policy, aucun grant : seules les fonctions SECURITY DEFINER ci-dessous
-- et la cle service_role de la fonction Edge y touchent.
revoke all on public.preferences_annonces from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. L'annonce gagne son canal et ses compteurs d'e-mail
-- ---------------------------------------------------------------------------
-- Dans la MEME table que le push, volontairement : un seul historique, une seule
-- ligne par annonce, quel que soit le nombre de canaux. Deux tables auraient
-- rendu impossible la phrase « cette annonce est partie sur 19 appareils et
-- 7 e-mails ».
alter table public.annonces
  add column if not exists canal text not null default 'push',
  add column if not exists emails_vises   integer not null default 0,
  add column if not exists emails_envoyes integer not null default 0,
  add column if not exists emails_echoues integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'annonces_canal_check') then
    alter table public.annonces
      add constraint annonces_canal_check check (canal in ('push', 'email', 'push_email'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Combien de personnes vise-t-on, par canal
-- ---------------------------------------------------------------------------
-- ⚠️ `drop` puis `create` et non `create or replace` : le type de retour change.
-- Une surcharge ferait repondre PostgREST « PGRST203 » et plus aucune annonce ne
-- partirait (piege deja paye sur `create_order`).
drop function if exists public.admin_cibles_annonce(text);

create function public.admin_cibles_annonce(p_cible text)
returns table (jetons integer, comptes integer, emails integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_cible not in ('clients', 'moi') then
    raise exception 'annonce:cible_inconnue' using errcode = '22023';
  end if;

  return query
  select
    (select count(*)::integer from public.push_tokens t
      where case when p_cible = 'moi' then t.user_id = auth.uid()
                 else public.est_client_annoncable(t.user_id) end),
    (select count(distinct t.user_id)::integer from public.push_tokens t
      where case when p_cible = 'moi' then t.user_id = auth.uid()
                 else public.est_client_annoncable(t.user_id) end),
    (select count(*)::integer from public.annonces_cibles_email(p_cible, auth.uid()));
end $$;

revoke all on function public.admin_cibles_annonce(text) from public, anon;
grant execute on function public.admin_cibles_annonce(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Qui est un « client » pour une annonce
-- ---------------------------------------------------------------------------
-- Role client ACTIF. Meme definition que depuis le 2026-09-18 pour le push.
create or replace function public.est_client_annoncable(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.user_roles ur
                  where ur.user_id = p_user and ur.role = 'client' and ur.status = 'active');
$$;

revoke all on function public.est_client_annoncable(uuid) from public, anon, authenticated;
grant execute on function public.est_client_annoncable(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Les destinataires e-mail — et leur jeton
-- ---------------------------------------------------------------------------
-- ⚠️ PLUS RESTRICTIF QUE LE PUSH, ET C'EST VOULU. Le push part a tout compte
-- portant le role client actif, restaurateurs compris (ils sont aussi clients).
-- L'e-mail, non : un restaurateur ou un livreur recoit deja de nous des e-mails
-- de travail, lui envoyer en plus la publicite du service qu'il fournit est le
-- meilleur moyen de se faire classer en indesirable. On exclut donc tout compte
-- portant un role `restaurant` ou `livreur` ACTIF.
--
-- ⚠️ ELLE NE FAIT QUE LIRE, et c'est structurel : `admin_cibles_annonce`
-- l'appelle pour afficher un nombre, et PostgREST execute une fonction `stable`
-- dans une transaction EN LECTURE SEULE. Une ecriture cachee ici ferait echouer
-- l'ecran de confirmation, pas l'envoi — la panne la plus difficile a lire.
-- La creation des jetons est un geste separe : `annonces_jetons`, plus bas.
--
-- Aucun grant a `anon` ni `authenticated` : la liste des adresses e-mail des
-- clients ne sort que par la cle service_role de la fonction Edge.
create or replace function public.annonces_cibles_email(
  p_cible text,
  p_auteur uuid
)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, btrim(p.email)
    from public.profiles p
   where coalesce(btrim(p.email), '') <> ''
     and p.email like '%@%.%'
     and case
           -- Le test : l'auteur seul, sans filtre de role ni de desinscription.
           -- Il doit pouvoir se relire meme s'il s'est desinscrit pour essayer.
           when p_cible = 'moi' then p.id = p_auteur
           else public.est_client_annoncable(p.id)
                and not exists (
                  select 1 from public.user_roles ur
                   where ur.user_id = p.id
                     and ur.role in ('restaurant', 'livreur')
                     and ur.status = 'active')
                and not exists (
                  select 1 from public.preferences_annonces pa
                   where pa.user_id = p.id and pa.annonces_email = false)
         end
   order by 2;
$$;

revoke all on function public.annonces_cibles_email(text, uuid) from public, anon, authenticated;
grant execute on function public.annonces_cibles_email(text, uuid) to service_role;

-- 5 bis. Le jeton de chacun — cree s'il manque.
-- C'est le seul endroit ou un jeton nait, et il doit exister AVANT que le lien
-- parte dans un e-mail : un e-mail d'annonce sans lien de desinscription n'a pas
-- le droit de partir.
create or replace function public.annonces_jetons(p_users uuid[])
returns table (user_id uuid, jeton uuid)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  insert into public.preferences_annonces (user_id)
  select u from unnest(coalesce(p_users, '{}'::uuid[])) as u
  on conflict (user_id) do nothing;

  return query
  select pa.user_id, pa.jeton
    from public.preferences_annonces pa
   where pa.user_id = any (coalesce(p_users, '{}'::uuid[]));
end $$;

revoke all on function public.annonces_jetons(uuid[]) from public, anon, authenticated;
grant execute on function public.annonces_jetons(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Se desinscrire (ou se reabonner) avec le seul jeton
-- ---------------------------------------------------------------------------
-- Appelee par la fonction Netlify de la vitrine, avec la cle publiable. C'est la
-- SEULE porte ouverte a `anon` sur tout ce chantier.
--
-- ⚠️ ELLE NE REND JAMAIS L'ADRESSE EN CLAIR, ni l'identifiant du compte. Juste
-- de quoi ecrire « c'est bien toi » : une adresse masquee. Un jeton qui traine
-- ne doit pas devenir un moyen de lire l'annuaire.
--
-- ⚠️ Un jeton inconnu et un jeton mal forme repondent la MEME chose.
create or replace function public.annonce_desinscription_par_jeton(
  p_jeton  uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_pref   public.preferences_annonces%rowtype;
  v_avant  boolean;
  v_email  text;
  v_masque text;
begin
  if p_action not in ('etat', 'desinscrire', 'reabonner') then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_pref from public.preferences_annonces where jeton = p_jeton;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  -- ⚠️ La page doit distinguer « c'est fait » de « c'etait deja fait ». Sans
  -- ce temoin, un second clic — ou un robot d'antivirus qui suit le lien avant
  -- son destinataire — afficherait « c'est fait » alors que rien n'a bouge.
  v_avant := v_pref.annonces_email;

  if p_action = 'desinscrire' and v_pref.annonces_email then
    update public.preferences_annonces
       set annonces_email = false, maj_le = now()
     where user_id = v_pref.user_id
    returning * into v_pref;
  elsif p_action = 'reabonner' and not v_pref.annonces_email then
    update public.preferences_annonces
       set annonces_email = true, maj_le = now()
     where user_id = v_pref.user_id
    returning * into v_pref;
  end if;

  select btrim(p.email) into v_email from public.profiles p where p.id = v_pref.user_id;
  -- « christopher@gmail.com » -> « ch•••@gmail.com ». Assez pour se reconnaitre,
  -- pas assez pour recolter une adresse.
  v_masque := case
    when v_email is null or position('@' in v_email) < 2 then null
    else left(split_part(v_email, '@', 1), 2) || '•••@' || split_part(v_email, '@', 2)
  end;

  return jsonb_build_object(
    'ok', true,
    'actif', v_pref.annonces_email,
    'change', v_avant is distinct from v_pref.annonces_email,
    'email', v_masque);
end $$;

revoke all on function public.annonce_desinscription_par_jeton(uuid, text) from public;
grant execute on function public.annonce_desinscription_par_jeton(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Ecrire l'annonce — avec son canal
-- ---------------------------------------------------------------------------
-- ⚠️ `drop` puis `create` et non un simple ajout de parametre : `create or
-- replace` avec une signature differente AJOUTE une surcharge, et PostgREST
-- repond alors « PGRST203 : could not choose the best candidate function ».
-- Plus aucune annonce ne partirait. Le defaut `'push'` protege un onglet
-- d'administration reste ouvert sur l'ancienne version de l'ecran : il continue
-- d'envoyer du push seul, il ne se met pas a ecrire a toute l'ile par surprise.
drop function if exists public.admin_creer_annonce(text, text, text, text);

create function public.admin_creer_annonce(
  p_titre  text,
  p_corps  text,
  p_cible  text,
  p_route  text,
  p_canal  text default 'push'
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_titre text := btrim(coalesce(p_titre, ''));
  v_corps text := btrim(coalesce(p_corps, ''));
  v_route text := nullif(btrim(coalesce(p_route, '')), '');
  v_canal text := coalesce(nullif(btrim(coalesce(p_canal, '')), ''), 'push');
  v_id    uuid;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if length(v_titre) < 1 or length(v_titre) > 50 then
    raise exception 'annonce:titre_invalide' using errcode = '22023';
  end if;
  if length(v_corps) < 1 or length(v_corps) > 150 then
    raise exception 'annonce:corps_invalide' using errcode = '22023';
  end if;
  if p_cible not in ('clients', 'moi') then
    raise exception 'annonce:cible_inconnue' using errcode = '22023';
  end if;
  if v_canal not in ('push', 'email', 'push_email') then
    raise exception 'annonce:canal_inconnu' using errcode = '22023';
  end if;
  if v_route is not null and v_route <> '/' and v_route !~ '^/restaurant/[0-9a-f-]{36}$' then
    raise exception 'annonce:route_invalide' using errcode = '22023';
  end if;

  -- ⚠️ Doublon : deux appuis, deux notifications ET deux e-mails. On refuse le
  -- meme texte vers la meme cible dans les 24 h, quel que soit le canal — un
  -- client qui recoit deux fois le meme message se desabonne.
  if p_cible <> 'moi' and exists (
    select 1 from public.annonces a
     where a.titre = v_titre and a.corps = v_corps and a.cible = p_cible
       and a.statut = 'envoyee' and a.envoyee_le > now() - interval '24 hours')
  then
    raise exception 'annonce:doublon_24h' using errcode = '22023';
  end if;

  insert into public.annonces (titre, corps, cible, route, canal, envoyee_par)
  values (v_titre, v_corps, p_cible, v_route, v_canal, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.admin_creer_annonce(text, text, text, text, text) from public, anon;
grant execute on function public.admin_creer_annonce(text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. L'historique — canal et e-mails compris
-- ---------------------------------------------------------------------------
drop function if exists public.admin_lister_annonces(integer);

create function public.admin_lister_annonces(p_limite integer default 30)
returns table (
  id uuid, titre text, corps text, cible text, route text, statut text, canal text,
  creee_le timestamptz, envoyee_le timestamptz, jetons_vises integer,
  envois_reussis integer, envois_echoues integer, jetons_supprimes integer,
  emails_vises integer, emails_envoyes integer, emails_echoues integer,
  auteur text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return query
  select a.id, a.titre, a.corps, a.cible, a.route, a.statut, a.canal, a.creee_le, a.envoyee_le,
         a.jetons_vises, a.envois_reussis, a.envois_echoues, a.jetons_supprimes,
         a.emails_vises, a.emails_envoyes, a.emails_echoues,
         coalesce(p.full_name, p.email, '—')
    from public.annonces a
    left join public.profiles p on p.id = a.envoyee_par
   order by a.creee_le desc
   limit greatest(coalesce(p_limite, 30), 1);
end $$;

revoke all on function public.admin_lister_annonces(integer) from public, anon;
grant execute on function public.admin_lister_annonces(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Le webhook n8n de l'annonce par e-mail
-- ---------------------------------------------------------------------------
-- Meme patron que `lire_jeton_telegram` : le secret reste au Vault, la fonction
-- Edge le lit avec la cle service_role et personne d'autre ne peut l'appeler.
--
-- ⚠️ Workflow n8n DEDIE, jamais T7uX. Les e-mails de commande passent par
-- T7uX : le modifier, ou seulement le desactiver puis le reactiver, perd les
-- notifications emises pendant la coupure. Une annonce ne vaut pas ce risque.
create or replace function public.lire_webhook_annonce_email()
returns table (url text, secret text)
language sql
stable
security definer
set search_path to 'public', 'vault'
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'n8n_annonce_email_url'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'n8n_annonce_email_secret');
$$;

revoke all on function public.lire_webhook_annonce_email() from public, anon, authenticated;
grant execute on function public.lire_webhook_annonce_email() to service_role;
