-- Annonces push envoyees depuis l'admin (2026-09-18).
--
-- « Nouveau restaurant : La Plage », « L'appli s'est mise a jour ». Rien de tel
-- n'existait : `notify-order` ne parle que d'une commande.
--
-- ⚠️ UNE NOTIFICATION NE SE RATTRAPE PAS. Tout ce qui suit existe pour ca :
--   * historique obligatoire (`annonces`) : qui a envoye quoi, quand, a combien
--     d'appareils, avec combien d'echecs ;
--   * l'ecriture de l'annonce (cette RPC) et l'ENVOI (fonction Edge
--     `envoyer-annonce`) sont deux gestes distincts : une annonce existe donc en
--     base AVANT le premier push, et un envoi interrompu laisse une trace ;
--   * refus d'un doublon exact dans les 24 h ;
--   * longueurs bornees (titre 50, corps 150) ;
--   * cible « moi » pour s'envoyer un test avant de reveiller tout le monde ;
--   * jamais d'envoi automatique : aucun trigger n'appelle ceci.

create table if not exists public.annonces (
  id               uuid primary key default gen_random_uuid(),
  titre            text not null check (length(btrim(titre)) between 1 and 50),
  corps            text not null check (length(btrim(corps)) between 1 and 150),
  -- 'clients' = les comptes portant le role client actif ; 'moi' = l'auteur seul.
  cible            text not null check (cible in ('clients', 'moi')),
  -- Ecran ouvert au tap, repris tel quel par l'app (`data.route`). '/' = accueil.
  route            text check (route is null or route = '/' or route ~ '^/restaurant/[0-9a-f-]{36}$'),
  statut           text not null default 'preparee' check (statut in ('preparee', 'envoyee', 'echouee')),
  envoyee_par      uuid not null references public.profiles(id),
  creee_le         timestamptz not null default now(),
  envoyee_le       timestamptz,
  jetons_vises     integer not null default 0,
  envois_reussis   integer not null default 0,
  envois_echoues   integer not null default 0,
  jetons_supprimes integer not null default 0,
  -- Resume des tickets Expo (erreurs seulement) : de quoi comprendre un echec.
  details          jsonb
);
create index if not exists annonces_creee_le_idx on public.annonces (creee_le desc);

-- Aucune policy, aucun grant : lecture et ecriture par les seules fonctions
-- SECURITY DEFINER ci-dessous et par la cle service_role de la fonction Edge.
alter table public.annonces enable row level security;
revoke all on public.annonces from public, anon, authenticated;

-- ------------------------------------------------ combien d'appareils vises
-- Sert l'ecran de confirmation : on n'envoie jamais « a l'aveugle ».
create or replace function public.admin_cibles_annonce(p_cible text)
returns table (jetons integer, comptes integer)
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
  select count(*)::integer, count(distinct t.user_id)::integer
    from public.push_tokens t
   where case
           when p_cible = 'moi' then t.user_id = auth.uid()
           else exists (select 1 from public.user_roles ur
                         where ur.user_id = t.user_id
                           and ur.role = 'client'
                           and ur.status = 'active')
         end;
end $$;

revoke all on function public.admin_cibles_annonce(text) from public, anon;
grant execute on function public.admin_cibles_annonce(text) to authenticated;

-- ------------------------------------------------------- ecrire l'annonce
-- N'ENVOIE RIEN : elle enregistre. L'envoi est un second appel, a la fonction
-- Edge `envoyer-annonce`, qui relit cette ligne.
create or replace function public.admin_creer_annonce(
  p_titre  text,
  p_corps  text,
  p_cible  text,
  p_route  text
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_titre text := btrim(coalesce(p_titre, ''));
  v_corps text := btrim(coalesce(p_corps, ''));
  v_route text := nullif(btrim(coalesce(p_route, '')), '');
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
  if v_route is not null and v_route <> '/' and v_route !~ '^/restaurant/[0-9a-f-]{36}$' then
    raise exception 'annonce:route_invalide' using errcode = '22023';
  end if;

  -- ⚠️ Doublon : deux appuis, deux notifications. On refuse le meme texte vers la
  -- meme cible dans les 24 h, sauf pour un test « moi ».
  if p_cible <> 'moi' and exists (
    select 1 from public.annonces a
     where a.titre = v_titre and a.corps = v_corps and a.cible = p_cible
       and a.statut = 'envoyee' and a.envoyee_le > now() - interval '24 hours')
  then
    raise exception 'annonce:doublon_24h' using errcode = '22023';
  end if;

  insert into public.annonces (titre, corps, cible, route, envoyee_par)
  values (v_titre, v_corps, p_cible, v_route, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.admin_creer_annonce(text, text, text, text) from public, anon;
grant execute on function public.admin_creer_annonce(text, text, text, text) to authenticated;

-- ------------------------------------------------------------- l'historique
create or replace function public.admin_lister_annonces(p_limite integer default 30)
returns table (
  id uuid, titre text, corps text, cible text, route text, statut text,
  creee_le timestamptz, envoyee_le timestamptz, jetons_vises integer,
  envois_reussis integer, envois_echoues integer, jetons_supprimes integer,
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
  select a.id, a.titre, a.corps, a.cible, a.route, a.statut, a.creee_le, a.envoyee_le,
         a.jetons_vises, a.envois_reussis, a.envois_echoues, a.jetons_supprimes,
         coalesce(p.full_name, p.email, '—')
    from public.annonces a
    left join public.profiles p on p.id = a.envoyee_par
   order by a.creee_le desc
   limit greatest(coalesce(p_limite, 30), 1);
end $$;

revoke all on function public.admin_lister_annonces(integer) from public, anon;
grant execute on function public.admin_lister_annonces(integer) to authenticated;
