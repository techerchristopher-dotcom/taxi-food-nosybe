-- Chantier « restaurants en négociation » (26/09/2026, nuit).
--
-- Un restaurant `coming_soon` se consulte mais ne se commande pas. Jusqu'ici on
-- ne savait ni qui regardait, ni combien, et personne n'était prévenu à
-- l'ouverture — qui se faisait à la main en base. Désormais :
--   1. chaque visite d'un client connecté est notée (silencieuse) ;
--   2. le client peut demander à être prévenu (« Me prévenir à l'ouverture ») ;
--   3. l'admin voit les compteurs par restaurant ;
--   4. l'admin passe un restaurant en « Visible » par une RPC qui, s'il y a des
--      demandes, ÉCRIT UNE ANNONCE (`annonces`) ciblée sur ces seuls clients —
--      l'écran l'envoie ensuite par `envoyer-annonce`, exactement comme une
--      annonce ordinaire : mêmes compteurs, même e-mail n8n, même historique.
--
-- ⚠️ Seuls ceux qui ont APPUYÉ sont prévenus (décision du porteur du projet) ;
-- les simples visites comptent dans le chiffre d'intérêt, rien de plus. Et la
-- désinscription « uniquement des annonces » ne s'applique pas : le client a
-- explicitement demandé ce message.

create table if not exists public.restaurant_interest (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('visite', 'alerte')),
  created_at    timestamptz not null default now()
);
create unique index if not exists restaurant_interest_alerte_unique
  on public.restaurant_interest (restaurant_id, user_id) where kind = 'alerte';
create index if not exists restaurant_interest_resto_idx
  on public.restaurant_interest (restaurant_id, kind);
-- RLS sans aucune politique : lectures et écritures passent par les RPC ci-dessous.
alter table public.restaurant_interest enable row level security;

-- Le client note son intérêt. `visite` : au plus une par client, par restaurant et
-- par tranche de six heures (un écran rechargé n'est pas une nouvelle visite).
-- `alerte` : une seule, jamais retirée ici. Renvoie « le client est inscrit à l'alerte ».
create or replace function public.noter_interet_restaurant(p_restaurant_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_kind not in ('visite', 'alerte') then raise exception 'interet:kind_inconnu'; end if;
  if not exists (select 1 from public.restaurants r
                  where r.id = p_restaurant_id and r.listing_status = 'coming_soon') then
    -- Pas une erreur : le restaurant a ouvert entre-temps, l'écran se rafraîchira.
    return exists (select 1 from public.restaurant_interest i
                    where i.restaurant_id = p_restaurant_id and i.user_id = v_uid and i.kind = 'alerte');
  end if;

  if p_kind = 'visite' then
    insert into public.restaurant_interest (restaurant_id, user_id, kind)
    select p_restaurant_id, v_uid, 'visite'
     where not exists (select 1 from public.restaurant_interest i
                        where i.restaurant_id = p_restaurant_id and i.user_id = v_uid
                          and i.kind = 'visite' and i.created_at > now() - interval '6 hours');
  else
    insert into public.restaurant_interest (restaurant_id, user_id, kind)
    values (p_restaurant_id, v_uid, 'alerte')
    on conflict (restaurant_id, user_id) where kind = 'alerte' do nothing;
  end if;

  return exists (select 1 from public.restaurant_interest i
                  where i.restaurant_id = p_restaurant_id and i.user_id = v_uid and i.kind = 'alerte');
end $$;

create or replace function public.mon_interet_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (select 1 from public.restaurant_interest i
                  where i.restaurant_id = p_restaurant_id and i.user_id = auth.uid() and i.kind = 'alerte');
$$;

-- Les compteurs, pour l'admin : combien ont regardé, combien de personnes
-- distinctes, combien veulent être prévenues.
create or replace function public.admin_interet_restaurants()
returns table (restaurant_id uuid, visites integer, visiteurs integer, alertes integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id,
         (select count(*)::int from public.restaurant_interest i where i.restaurant_id = r.id and i.kind = 'visite'),
         (select count(distinct i.user_id)::int from public.restaurant_interest i where i.restaurant_id = r.id and i.kind = 'visite'),
         (select count(*)::int from public.restaurant_interest i where i.restaurant_id = r.id and i.kind = 'alerte')
    from public.restaurants r
   where public.is_admin();
$$;

-- Une annonce peut désormais viser « ceux qui attendent CE restaurant ».
alter table public.annonces drop constraint if exists annonces_cible_check;
alter table public.annonces add constraint annonces_cible_check
  check (cible in ('clients', 'moi') or cible ~ '^restaurant:[0-9a-f-]{36}$');

-- L'ouverture, par l'admin. Si des clients attendent, la RPC écrit l'annonce et
-- renvoie son id ; l'écran l'envoie ensuite (envoyer-annonce). Sinon null.
create or replace function public.admin_set_listing_status(p_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_old text; v_name text; v_annonce uuid;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_status not in ('visible', 'coming_soon', 'hidden') then
    raise exception 'statut_inconnu' using errcode = '22023';
  end if;
  select listing_status, name into v_old, v_name from public.restaurants where id = p_id;
  if v_name is null then raise exception 'Restaurant introuvable'; end if;
  if v_old = p_status then return null; end if;

  update public.restaurants set listing_status = p_status where id = p_id;

  if v_old = 'coming_soon' and p_status = 'visible'
     and exists (select 1 from public.restaurant_interest i where i.restaurant_id = p_id and i.kind = 'alerte') then
    insert into public.annonces (titre, corps, cible, route, canal, envoyee_par)
    values (left(v_name || ' ouvre sur Taxi Food 🎉', 50),
            'La carte t''attend — commande dès maintenant.',
            'restaurant:' || p_id::text,
            '/restaurant/' || p_id::text,
            'push_email',
            auth.uid())
    returning id into v_annonce;
  end if;
  return v_annonce;
end $$;

revoke all on function public.noter_interet_restaurant(uuid, text) from public;
revoke all on function public.mon_interet_restaurant(uuid) from public;
revoke all on function public.admin_interet_restaurants() from public;
revoke all on function public.admin_set_listing_status(uuid, text) from public;
grant execute on function public.noter_interet_restaurant(uuid, text) to authenticated;
grant execute on function public.mon_interet_restaurant(uuid) to authenticated;
grant execute on function public.admin_interet_restaurants() to authenticated;
grant execute on function public.admin_set_listing_status(uuid, text) to authenticated;

-- Les cibles e-mail d'une annonce « restaurant:<id> » : les clients qui ont
-- demandé l'alerte et ont une adresse. Pas de filtre « préférences annonces » :
-- ce message a été demandé explicitement.
create or replace function public.annonces_cibles_email(p_cible text, p_auteur uuid)
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
           when p_cible = 'moi' then p.id = p_auteur
           when p_cible like 'restaurant:%' then exists (
                  select 1 from public.restaurant_interest i
                   where i.user_id = p.id and i.kind = 'alerte'
                     and i.restaurant_id = substring(p_cible from 12)::uuid)
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

-- Les compteurs de l'écran Annonces acceptent aussi cette cible.
create or replace function public.admin_cibles_annonce(p_cible text)
returns table (jetons integer, comptes integer, emails integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare v_resto uuid;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_cible like 'restaurant:%' then
    v_resto := substring(p_cible from 12)::uuid;
    return query
    select (select count(*)::integer from public.push_tokens t
             where t.user_id in (select i.user_id from public.restaurant_interest i where i.restaurant_id = v_resto and i.kind = 'alerte')),
           (select count(distinct t.user_id)::integer from public.push_tokens t
             where t.user_id in (select i.user_id from public.restaurant_interest i where i.restaurant_id = v_resto and i.kind = 'alerte')),
           (select count(*)::integer from public.annonces_cibles_email(p_cible, auth.uid()));
    return;
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
