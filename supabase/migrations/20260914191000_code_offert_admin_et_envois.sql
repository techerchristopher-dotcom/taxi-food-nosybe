-- Code offert nominatif : les outils d'administration et les envois.
--
-- Le socle (20260914190000) sait appliquer un code reserve a un client, dans un
-- restaurant, paye par ce restaurant. Il manquait de quoi le fabriquer et le
-- remettre au client sans passer par l'editeur SQL :
--   - retrouver le client (nom, e-mail ou telephone, tel qu'on l'a au bout du fil) ;
--   - creer un code par client, nomme MERCI + prenom (decision du 2026-09-14) :
--     un client lit « MERCISULLI » et comprend tout de suite que c'est pour lui ;
--   - lister ce qui a ete offert, a qui, et si c'est parti ou utilise ;
--   - envoyer le code par e-mail (n8n) ou noter qu'un WhatsApp a ete OUVERT.
--
-- ⚠️ Toutes les fonctions sont SECURITY DEFINER et verifient is_admin() elles-memes :
-- l'ecran admin n'est pas l'autorite, un appel direct a l'API avec un jeton
-- client doit echouer pareil. Execute est retire a anon : Supabase l'accorde
-- par defaut a chaque nouvelle fonction du schema public.
--
-- ⚠️ Aucun code n'est cree par ce fichier. Les premiers codes partiront de
-- l'ecran admin.

-- =====================================================================
-- 1. Petits outils internes
-- =====================================================================

-- Sans extension unaccent sur ce projet : une table de correspondance suffit
-- pour les prenoms et les e-mails de notre clientele (francais, malgache).
-- Majuscules traduites AVANT lower(), qui ne sait pas toujours baisser une
-- lettre accentuee selon la collation.
create or replace function public.texte_sans_accents(p_texte text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(translate(
    replace(replace(replace(replace(replace(coalesce(p_texte, ''),
      'œ', 'oe'), 'Œ', 'oe'), 'æ', 'ae'), 'Æ', 'ae'), 'ß', 'ss'),
    'àáâãäåāçćčèéêëēėęìíîïīñńòóôõöøōùúûüūýÿžźżÀÁÂÃÄÅĀÇĆČÈÉÊËĒĖĘÌÍÎÏĪÑŃÒÓÔÕÖØŌÙÚÛÜŪÝŸŽŹŻ',
    'aaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzzaaaaaaaccceeeeeeeiiiiinnooooooouuuuuyyzzz'));
$$;

comment on function public.texte_sans_accents(text) is
  'Minuscules sans accents : sert a la recherche de clients et au nom des codes offerts.';

-- Le nom de base d'un code offert, avant tout suffixe de collision.
-- On garde le PRENOM : le premier mot du nom complet. Un premier mot de deux
-- lettres ou moins (« Ny Aina », « Jo ») est un prenom compose : on colle le
-- mot suivant, sinon on offrirait « MERCINY ». Lettres seules, pour qu'un
-- chiffre du nom ne se confonde jamais avec le suffixe 2, 3...
create or replace function public.code_offert_nom_de_base(p_full_name text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v_mots   text[] := regexp_split_to_array(btrim(coalesce(p_full_name, '')), '\s+');
  v_prenom text;
begin
  v_prenom := upper(regexp_replace(public.texte_sans_accents(v_mots[1]), '[^a-z]', '', 'g'));
  if length(v_prenom) <= 2 and coalesce(array_length(v_mots, 1), 0) >= 2 then
    v_prenom := v_prenom || upper(regexp_replace(public.texte_sans_accents(v_mots[2]), '[^a-z]', '', 'g'));
  end if;
  -- Un code a taper sur un telephone : au-dela de 20 lettres, on coupe.
  v_prenom := left(v_prenom, 20);
  if v_prenom = '' or v_prenom = 'CLIENT' then
    return 'MERCICLIENT';
  end if;
  return 'MERCI' || v_prenom;
end;
$$;

-- Le telephone a afficher pour un client : celui du profil, sinon celui de son
-- adresse par defaut (la plus recente), sinon d'une autre adresse. Normalise en
-- chiffres internationaux : c'est ce qu'attend un lien wa.me.
create or replace function public.telephone_du_client(p_user_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(public.normaliser_telephone(t.brut), t.brut)
    from (
      select coalesce(
        (select nullif(btrim(p.phone), '') from public.profiles p where p.id = p_user_id),
        (select nullif(btrim(a.phone), '') from public.addresses a
          where a.user_id = p_user_id and nullif(btrim(a.phone), '') is not null
          order by a.is_default desc, a.created_at desc
          limit 1)) as brut
    ) t;
$$;

revoke all on function public.texte_sans_accents(text) from public, anon, authenticated;
revoke all on function public.code_offert_nom_de_base(text) from public, anon, authenticated;
revoke all on function public.telephone_du_client(uuid) from public, anon, authenticated;

-- =====================================================================
-- 2. Le journal des envois
-- =====================================================================
-- Une ligne par tentative. On ne sait pas si un WhatsApp est reellement parti
-- (l'admin ouvre un lien, il peut ne jamais appuyer sur Envoyer) : d'ou le
-- statut « ouvert » et non « envoye ». Pas d'ecriture directe : seules les
-- fonctions ci-dessous inserent, pour que le trigger d'e-mail ne se declenche
-- jamais sur une ligne fabriquee a la main depuis l'API.
create table if not exists public.promo_envois (
  id         uuid primary key default gen_random_uuid(),
  code_id    uuid not null references public.promo_codes(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  canal      text not null check (canal in ('email', 'whatsapp')),
  statut     text not null default 'demande' check (statut in ('demande', 'ouvert')),
  cree_par   uuid,
  created_at timestamptz not null default now()
);

create index if not exists promo_envois_code_idx on public.promo_envois (code_id);

alter table public.promo_envois enable row level security;

revoke all on table public.promo_envois from public, anon, authenticated;
grant select on table public.promo_envois to authenticated;

drop policy if exists promo_envois_select_admin on public.promo_envois;
create policy promo_envois_select_admin on public.promo_envois
  for select to authenticated
  using (public.is_admin());

comment on table public.promo_envois is
  'Remises d''un code offert a son beneficiaire (e-mail demande a n8n, WhatsApp ouvert par l''admin). Ecriture par RPC admin uniquement.';

-- =====================================================================
-- 3. Retrouver un client
-- =====================================================================
-- strpos plutot que LIKE : un « % » ou un « _ » tape dans la recherche reste un
-- caractere, jamais un joker, et il n'y a aucun echappement a oublier.
create or replace function public.admin_chercher_clients(p_q text)
returns table(user_id uuid, full_name text, email text, telephone text,
              nb_commandes integer, derniere_commande timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_q        text := public.texte_sans_accents(btrim(coalesce(p_q, '')));
  v_chiffres text := regexp_replace(coalesce(p_q, ''), '[^0-9]', '', 'g');
  v_tel      text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  -- Une seule lettre ramenerait tout le fichier client.
  if length(v_q) < 2 then
    return;
  end if;

  -- « 037 74 129 38 » et « +261 37 74 129 38 » doivent trouver le meme client.
  if length(v_chiffres) >= 3 then
    v_tel := public.normaliser_telephone(v_chiffres);
  end if;

  return query
  select u.id,
         p.full_name,
         u.email::text,
         c.tel,
         coalesce(o.n, 0)::integer,
         o.derniere
    from auth.users u
    left join public.profiles p on p.id = u.id
    cross join lateral (select public.telephone_du_client(u.id) as tel) c
    left join lateral (
      select count(*) as n, max(oo.created_at) as derniere
        from public.orders oo
       where oo.user_id = u.id
    ) o on true
   where strpos(public.texte_sans_accents(p.full_name), v_q) > 0
      or strpos(public.texte_sans_accents(u.email::text), v_q) > 0
      or (v_tel is not null and (
            strpos(coalesce(c.tel, ''), v_tel) > 0
         or strpos(regexp_replace(coalesce(c.tel, ''), '[^0-9]', '', 'g'), v_chiffres) > 0))
   order by o.derniere desc nulls last, p.full_name nulls last
   limit 25;
end;
$$;

comment on function public.admin_chercher_clients(text) is
  'Admin : recherche de clients par nom, e-mail ou telephone (sans casse ni accents), 25 resultats au plus.';

-- =====================================================================
-- 4. Creer les codes offerts
-- =====================================================================
create or replace function public.admin_creer_codes_offerts(
  p_user_ids            uuid[],
  p_restaurant_id       uuid,
  p_offre               text,
  p_plafond             integer default 37000,
  p_inclut_boissons     boolean default false,
  p_validite_jours      integer default 30,
  p_motif               text default null,
  p_commande_origine_id uuid default null,
  p_pris_en_charge_par  text default 'restaurant',
  p_code_force          text default null)
returns table(code_id uuid, code text, user_id uuid, full_name text, email text,
              telephone text, expire_le timestamptz)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ids      uuid[];
  v_uid      uuid;
  v_nom      text;
  v_base     text;
  v_candidat text;
  v_suffixe  integer;
  v_code     public.promo_codes;
  v_expire   timestamptz;
  v_motif    text := nullif(btrim(coalesce(p_motif, '')), '');
  v_force    text;
  v_repas    boolean;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_offre is null or p_offre not in ('repas', 'livraison') then
    raise exception 'Offre inconnue : repas ou livraison';
  end if;
  v_repas := (p_offre = 'repas');

  if p_pris_en_charge_par is null or p_pris_en_charge_par not in ('restaurant', 'taxi_food') then
    raise exception 'Prise en charge inconnue : restaurant ou taxi_food';
  end if;

  if p_validite_jours is null or p_validite_jours < 1 or p_validite_jours > 365 then
    raise exception 'Validite entre 1 et 365 jours';
  end if;

  if v_repas and (p_plafond is null or p_plafond <= 0) then
    raise exception 'Plafond du repas offert manquant ou nul';
  end if;

  -- Decision 2 : un code offert ne vaut que dans le restaurant qui fait le geste.
  -- Meme un geste de Taxi Food se rattache a un restaurant : sinon le code
  -- servirait partout, ce qu'aucun geste commercial n'a promis.
  if p_restaurant_id is null
     or not exists (select 1 from public.restaurants r where r.id = p_restaurant_id) then
    raise exception 'Restaurant introuvable';
  end if;

  if p_commande_origine_id is not null
     and not exists (select 1 from public.orders oo where oo.id = p_commande_origine_id) then
    raise exception 'Commande d''origine introuvable';
  end if;

  -- Doublons et trous retires, ordre de selection conserve.
  select array_agg(t.u order by t.pos) into v_ids
    from (select x.u, min(x.ord) as pos
            from unnest(p_user_ids) with ordinality as x(u, ord)
           where x.u is not null
           group by x.u) t;

  if v_ids is null then
    raise exception 'Aucun client selectionne';
  end if;

  if exists (select 1 from unnest(v_ids) as x(u)
              where not exists (select 1 from auth.users au where au.id = x.u)) then
    raise exception 'Client introuvable dans la selection';
  end if;

  -- Un nom force (« MERCIFAMILLE ») ne peut designer qu'UN code : a plusieurs
  -- clients il faudrait de toute facon suffixer, et ce ne serait plus le nom voulu.
  if nullif(btrim(coalesce(p_code_force, '')), '') is not null then
    if cardinality(v_ids) > 1 then
      raise exception 'Un nom de code force ne vaut que pour un seul client';
    end if;
    v_force := upper(regexp_replace(public.texte_sans_accents(p_code_force), '[^a-z0-9]', '', 'g'));
    if length(v_force) < 4 or length(v_force) > 30 then
      raise exception 'Nom de code force : 4 a 30 lettres ou chiffres';
    end if;
  end if;

  v_expire := now() + make_interval(days => p_validite_jours);

  foreach v_uid in array v_ids loop
    select p.full_name into v_nom from public.profiles p where p.id = v_uid;
    v_base    := coalesce(v_force, public.code_offert_nom_de_base(v_nom));
    v_suffixe := 1;
    v_code    := null;

    loop
      v_candidat := case when v_suffixe = 1 then v_base else v_base || v_suffixe::text end;

      if not exists (select 1 from public.promo_codes pc where pc.code_normalise = v_candidat) then
        begin
          insert into public.promo_codes (
            code, type_remise, valeur, porte_sur, actif, commence_le, expire_le,
            max_utilisations, description, beneficiaire_id, restaurant_id,
            inclut_emballage, exclut_boissons, pris_en_charge_par, commande_origine_id)
          values (
            v_candidat,
            case when v_repas then 'montant' else 'pourcentage' end,
            case when v_repas then p_plafond else 100 end,
            case when v_repas then 'sous_total' else 'livraison' end,
            true, now(), v_expire,
            1, v_motif, v_uid, p_restaurant_id,
            v_repas,
            v_repas and not coalesce(p_inclut_boissons, false),
            p_pris_en_charge_par, p_commande_origine_id)
          returning * into v_code;
        exception when unique_violation then
          -- Un autre admin a pris ce nom entre la verification et l'insertion.
          v_code := null;
        end;
      end if;

      exit when v_code.id is not null;

      if v_force is not null then
        raise exception 'Le code % existe deja', v_force;
      end if;
      v_suffixe := v_suffixe + 1;
      if v_suffixe > 999 then
        raise exception 'Aucun nom libre pour %', v_base;
      end if;
    end loop;

    insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
    values (auth.uid(), 'code_offert', p_commande_origine_id, p_restaurant_id, null,
            v_code.code || ' (' || p_offre || ', ' || p_pris_en_charge_par || ') pour ' || v_uid::text,
            v_motif);

    code_id   := v_code.id;
    code      := v_code.code;
    user_id   := v_uid;
    full_name := v_nom;
    email     := (select au.email::text from auth.users au where au.id = v_uid);
    telephone := public.telephone_du_client(v_uid);
    expire_le := v_code.expire_le;
    return next;
  end loop;
end;
$$;

comment on function public.admin_creer_codes_offerts(uuid[], uuid, text, integer, boolean, integer, text, uuid, text, text) is
  'Admin : un code nominatif (MERCI + prenom, suffixe en cas de collision) par client, valable une fois dans un seul restaurant.';

-- =====================================================================
-- 5. Lister, desactiver
-- =====================================================================
create or replace function public.admin_lister_codes_offerts()
returns table(code_id uuid, code text, user_id uuid, full_name text, email text,
              telephone text, restaurant_nom text, offre text, plafond integer,
              inclut_boissons boolean, pris_en_charge_par text, expire_le timestamptz,
              actif boolean, utilise boolean, order_number text,
              email_demande_le timestamptz, whatsapp_ouvert_le timestamptz,
              motif text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  return query
  select pc.id,
         pc.code,
         pc.beneficiaire_id,
         p.full_name,
         u.email::text,
         public.telephone_du_client(pc.beneficiaire_id),
         r.name,
         case when pc.porte_sur = 'livraison' then 'livraison' else 'repas' end,
         -- Un plafond n'a de sens que pour un repas en montant.
         case when pc.porte_sur = 'sous_total' and pc.type_remise = 'montant' then pc.valeur end,
         -- Une livraison offerte n'offre aucune boisson.
         (pc.porte_sur = 'sous_total' and not pc.exclut_boissons),
         pc.pris_en_charge_par,
         pc.expire_le,
         pc.actif,
         (red.order_id is not null),
         oo.order_number::text,
         e.email_le,
         e.whatsapp_le,
         pc.description,
         pc.created_at
    from public.promo_codes pc
    left join public.profiles p    on p.id = pc.beneficiaire_id
    left join auth.users u         on u.id = pc.beneficiaire_id
    left join public.restaurants r on r.id = pc.restaurant_id
    left join lateral (
      select pr.order_id from public.promo_redemptions pr
       where pr.code_id = pc.id
       order by pr.created_at desc
       limit 1
    ) red on true
    left join public.orders oo on oo.id = red.order_id
    left join lateral (
      select max(pe.created_at) filter (where pe.canal = 'email')    as email_le,
             max(pe.created_at) filter (where pe.canal = 'whatsapp') as whatsapp_le
        from public.promo_envois pe
       where pe.code_id = pc.id
    ) e on true
   where pc.beneficiaire_id is not null
   order by pc.created_at desc;
end;
$$;

-- Desactiver plutot que supprimer : un code deja utilise est reference par sa
-- redemption, et l'historique de ce qui a ete offert doit rester lisible.
create or replace function public.admin_desactiver_code_offert(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.promo_codes;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  select * into v_code from public.promo_codes
   where id = p_code_id and beneficiaire_id is not null
   for update;
  if v_code.id is null then
    raise exception 'Code offert introuvable';
  end if;

  update public.promo_codes set actif = false where id = v_code.id;

  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'code_offert_desactive', v_code.commande_origine_id, v_code.restaurant_id,
          case when v_code.actif then 'actif' else 'inactif' end, 'inactif', v_code.code);
end;
$$;

-- =====================================================================
-- 6. Remettre le code au client
-- =====================================================================
-- On ne demande pas d'e-mail pour un code qui ne servirait plus a rien
-- (desactive, expire, deja utilise) : le client recevrait un cadeau refuse a la
-- caisse. Le nombre renvoye permet a l'ecran de dire combien sont partis.
create or replace function public.admin_envoyer_codes_email(p_code_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  insert into public.promo_envois (code_id, user_id, canal, statut, cree_par)
  select pc.id, pc.beneficiaire_id, 'email', 'demande', auth.uid()
    from public.promo_codes pc
    join auth.users u on u.id = pc.beneficiaire_id
   where pc.id = any (coalesce(p_code_ids, '{}'::uuid[]))
     and pc.beneficiaire_id is not null
     and pc.actif
     and (pc.expire_le is null or pc.expire_le > now())
     and not exists (select 1 from public.promo_redemptions pr where pr.code_id = pc.id)
     and nullif(btrim(u.email), '') is not null;

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- « Ouvert » et pas « envoye » : la base ne voit que le clic sur le lien wa.me.
create or replace function public.admin_noter_whatsapp(p_code_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_beneficiaire uuid;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  select beneficiaire_id into v_beneficiaire
    from public.promo_codes
   where id = p_code_id and beneficiaire_id is not null;
  if v_beneficiaire is null then
    raise exception 'Code offert introuvable';
  end if;

  insert into public.promo_envois (code_id, user_id, canal, statut, cree_par)
  values (p_code_id, v_beneficiaire, 'whatsapp', 'ouvert', auth.uid());
end;
$$;

-- =====================================================================
-- 7. L'e-mail part par n8n
-- =====================================================================
-- Meme patron que notifier_remboursement : secret lu dans le Vault, en-tete
-- x-taxifood-secret, et JAMAIS d'echec remonte a l'admin — la ligne d'envoi
-- reste, on peut renvoyer. Tant que le secret n8n_code_offert_url n'existe pas
-- (workflow n8n pas encore branche), le trigger ne fait rien et ne dit rien :
-- ce n'est pas une panne, c'est l'etat attendu.
create or replace function public.notifier_code_offert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_sec    text;
  v_charge jsonb;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'n8n_code_offert_url';
  if v_url is null or btrim(v_url) = '' then
    return null;
  end if;
  select decrypted_secret into v_sec
    from vault.decrypted_secrets where name = 'n8n_webhook_secret';

  select jsonb_build_object(
    'evenement', 'code_offert',
    'envoi_id',  new.id,
    'client', jsonb_build_object(
      -- Meme regle de prenom que le nom du code : « Ny Aina », pas « Ny ».
      'prenom', case
                  when length(m.mots[1]) <= 2 and coalesce(array_length(m.mots, 1), 0) >= 2
                    then m.mots[1] || ' ' || m.mots[2]
                  else nullif(m.mots[1], '')
                end,
      'nom',    p.full_name,
      'email',  u.email),
    'code', jsonb_build_object(
      'code',              pc.code,
      'offre',             case when pc.porte_sur = 'livraison' then 'livraison' else 'repas' end,
      'plafond',           case when pc.porte_sur = 'sous_total' and pc.type_remise = 'montant' then pc.valeur end,
      'inclut_emballage',  pc.inclut_emballage,
      'inclut_boissons',   (pc.porte_sur = 'sous_total' and not pc.exclut_boissons),
      'livraison_offerte', (pc.porte_sur = 'livraison'),
      'expire_le',         pc.expire_le,
      'restaurant',        r.name,
      'offert_par',        pc.pris_en_charge_par),
    'lien', 'https://taxifoodnosybe.distripro207.com'
  ) into v_charge
    from public.promo_codes pc
    left join public.profiles p    on p.id = new.user_id
    left join auth.users u         on u.id = new.user_id
    left join public.restaurants r on r.id = pc.restaurant_id
    cross join lateral (
      select regexp_split_to_array(btrim(coalesce(p.full_name, '')), '\s+') as mots
    ) m
   where pc.id = new.code_id;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-taxifood-secret', coalesce(v_sec, '')),
    body    := v_charge,
    timeout_milliseconds := 5000);

  return null;
exception when others then
  raise warning 'Code offert non envoye par e-mail (envoi %) : %', new.id, sqlerrm;
  return null;
end;
$$;

drop trigger if exists promo_envois_notifier on public.promo_envois;
create trigger promo_envois_notifier
  after insert on public.promo_envois
  for each row
  when (new.canal = 'email')
  execute function public.notifier_code_offert();

-- =====================================================================
-- 8. Droits
-- =====================================================================
revoke all on function public.admin_chercher_clients(text) from public, anon;
revoke all on function public.admin_creer_codes_offerts(uuid[], uuid, text, integer, boolean, integer, text, uuid, text, text) from public, anon;
revoke all on function public.admin_lister_codes_offerts() from public, anon;
revoke all on function public.admin_desactiver_code_offert(uuid) from public, anon;
revoke all on function public.admin_envoyer_codes_email(uuid[]) from public, anon;
revoke all on function public.admin_noter_whatsapp(uuid) from public, anon;

grant execute on function public.admin_chercher_clients(text) to authenticated;
grant execute on function public.admin_creer_codes_offerts(uuid[], uuid, text, integer, boolean, integer, text, uuid, text, text) to authenticated;
grant execute on function public.admin_lister_codes_offerts() to authenticated;
grant execute on function public.admin_desactiver_code_offert(uuid) to authenticated;
grant execute on function public.admin_envoyer_codes_email(uuid[]) to authenticated;
grant execute on function public.admin_noter_whatsapp(uuid) to authenticated;

-- Fonction de trigger : personne ne l'appelle directement.
revoke all on function public.notifier_code_offert() from public, anon, authenticated;
