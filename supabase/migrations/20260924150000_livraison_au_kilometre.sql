-- 20260924150000_livraison_au_kilometre.sql
--
-- LIVRAISON AU KILOMETRE (decision du porteur du projet, 2026-09-24, formule C).
--
--   10 000 Ar inclus jusqu'a 3 km, puis 1 000 Ar par kilometre ENTAME au-dela.
--   Aucun plafond, aucun rayon maximum (decisions explicites).
--
-- POURQUOI EN BASE D'ABORD. La cle anon est publique et `create_order` reste
-- appelable directement : un prix calcule par l'ecran se contourne en une
-- requete. La base est aussi la seule surface qui protege tout le parc
-- immediatement, y compris les binaires anciens qui ne recevront jamais l'OTA.
--
-- DISTANCE. Vol d'oiseau (haversine) multiplie par un coefficient de detour
-- (1,3) pour approcher la route. Pas d'API d'itineraire : payante, lente sur la
-- liaison de Nosy Be, et en panne quand le service tombe.
--
-- OU VIVENT LES REGLAGES. Sur `restaurants`, a cote de `delivery_fee` qui reste
-- le socle des 10 000 Ar. Trois colonnes avec valeurs par defaut :
-- `livraison_km_inclus` (3), `livraison_prix_par_km` (1 000),
-- `livraison_coef_route` (1,3). Une table de reglages globale aurait empeche de
-- traiter un restaurant a part (un restaurant loin de tout, une promotion) et
-- aurait laisse `delivery_fee` seul par restaurant : deux endroits pour un meme
-- tarif. Ici tout le tarif d'un restaurant se lit sur sa ligne, se change en
-- SQL ou par `admin_set_tarif_livraison()`, sans redeployer quoi que ce soit.

-- ---------------------------------------------------------------------------
-- 1. Les reglages, par restaurant
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add column if not exists livraison_km_inclus   numeric not null default 3,
  add column if not exists livraison_prix_par_km integer not null default 1000,
  add column if not exists livraison_coef_route  numeric not null default 1.3;

comment on column public.restaurants.livraison_km_inclus   is 'Kilometres (route estimee) couverts par delivery_fee. Au-dela : livraison_prix_par_km par km entame.';
comment on column public.restaurants.livraison_prix_par_km is 'Ariary par kilometre ENTAME au-dela de livraison_km_inclus.';
comment on column public.restaurants.livraison_coef_route  is 'Coefficient applique au vol d''oiseau pour approcher la distance par la route (1,3).';

do $$
begin
  alter table public.restaurants
    add constraint restaurants_livraison_reglages_coherents
    check (livraison_km_inclus >= 0
           and livraison_prix_par_km >= 0
           and livraison_coef_route between 1 and 3);
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Le carre de Nosy Be : une position hors de la est une donnee fausse
-- ---------------------------------------------------------------------------
-- Meme carre que la garde de `admin_commande_telephone` : latitude -13,55 a
-- -13,05 et longitude 48,05 a 48,45. Il couvre l'ile entiere (Nosy Be tient
-- dans ~25 x 20 km autour de -13,32 / 48,26) avec de la marge, et exclut tout
-- ce qui vient d'une virgule perdue ou de coordonnees inversees. Une adresse
-- hors de ce carre retombe sur le tarif de base : facturer des dizaines de
-- kilometres sur une donnee manifestement fausse serait pire que de sous-facturer.

create or replace function public.dans_nosy_be(p_lat double precision, p_lng double precision)
returns boolean
language sql
immutable
parallel safe
as $$
  select p_lat is not null and p_lng is not null
     and p_lat between -13.55 and -13.05
     and p_lng between  48.05 and  48.45
$$;

-- ---------------------------------------------------------------------------
-- 3. Distance a vol d'oiseau (haversine), en kilometres
-- ---------------------------------------------------------------------------
-- `least(1, ...)` : sans lui, le bruit du flottant peut rendre l'argument de
-- asin() legerement superieur a 1 sur deux points confondus, et asin() echoue.

create or replace function public.distance_vol_oiseau_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) returns numeric
language sql
immutable
parallel safe
as $$
  select round((
    6371.0088 * 2 * asin(least(1.0, sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    )))
  )::numeric, 4)
$$;

-- ---------------------------------------------------------------------------
-- 4. Les frais, avec leur detail (c'est cette fonction qui fait foi)
-- ---------------------------------------------------------------------------
-- `distance_connue = false` veut dire : repli sur le tarif de base. Trois cas,
-- tous normaux, aucun n'est une erreur bloquante :
--   - le restaurant n'a pas de position (La Plage au 2026-09-24) ;
--   - l'adresse n'a pas de GPS (commande par telephone) ;
--   - une des deux positions tombe hors du carre de Nosy Be.
-- SECURITY DEFINER : elle lit `restaurants`, ne rend qu'un montant et une
-- distance, et ne laisse rien filtrer d'autre.

create or replace function public.frais_livraison_detail(
  p_restaurant_id uuid,
  p_latitude      double precision,
  p_longitude     double precision
) returns table (
  frais            integer,
  distance_km      numeric,
  distance_connue  boolean,
  km_inclus        numeric,
  prix_par_km      integer,
  base             integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r         public.restaurants;
  v_base    integer;
  v_inclus  numeric;
  v_prix_km integer;
  v_coef    numeric;
  v_d       numeric;
begin
  select * into r from public.restaurants where id = p_restaurant_id;
  if r.id is null then
    raise exception 'Restaurant introuvable';
  end if;

  v_base    := coalesce(r.delivery_fee, 0);
  v_inclus  := coalesce(r.livraison_km_inclus, 3);
  v_prix_km := coalesce(r.livraison_prix_par_km, 1000);
  v_coef    := coalesce(r.livraison_coef_route, 1.3);

  if not public.dans_nosy_be(r.latitude, r.longitude)
     or not public.dans_nosy_be(p_latitude, p_longitude) then
    return query select v_base, null::numeric, false, v_inclus, v_prix_km, v_base;
    return;
  end if;

  v_d := round(
    public.distance_vol_oiseau_km(r.latitude, r.longitude, p_latitude, p_longitude) * v_coef,
    3);

  if v_d <= v_inclus then
    return query select v_base, v_d, true, v_inclus, v_prix_km, v_base;
    return;
  end if;

  -- Kilometre ENTAME : 4,3 km => 2 km au-dela de 3 => +2 000 Ar.
  return query select
    (v_base + ceil(v_d - v_inclus)::integer * v_prix_km),
    v_d, true, v_inclus, v_prix_km, v_base;
end $$;

create or replace function public.frais_livraison(
  p_restaurant_id uuid,
  p_latitude      double precision,
  p_longitude     double precision
) returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select d.frais from public.frais_livraison_detail(p_restaurant_id, p_latitude, p_longitude) d
$$;

revoke all on function public.frais_livraison_detail(uuid, double precision, double precision) from public;
revoke all on function public.frais_livraison(uuid, double precision, double precision) from public;
grant execute on function public.frais_livraison_detail(uuid, double precision, double precision) to anon, authenticated;
grant execute on function public.frais_livraison(uuid, double precision, double precision) to anon, authenticated;
grant execute on function public.dans_nosy_be(double precision, double precision) to anon, authenticated;
grant execute on function public.distance_vol_oiseau_km(double precision, double precision, double precision, double precision) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Changer le tarif sans redeployer
-- ---------------------------------------------------------------------------
-- Fonction A PART, jamais un parametre de plus sur `admin_update_restaurant` :
-- ajouter un parametre cree une surcharge et PostgREST repond alors PGRST203.

create or replace function public.admin_set_tarif_livraison(
  p_restaurant_id uuid,
  p_base          integer,
  p_km_inclus     numeric,
  p_prix_par_km   integer,
  p_coef_route    numeric
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_avant text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_base is null or p_base < 0 then
    raise exception 'tarif:base_invalide' using errcode = '22023';
  end if;
  if p_km_inclus is null or p_km_inclus < 0 then
    raise exception 'tarif:km_inclus_invalide' using errcode = '22023';
  end if;
  if p_prix_par_km is null or p_prix_par_km < 0 then
    raise exception 'tarif:prix_par_km_invalide' using errcode = '22023';
  end if;
  if p_coef_route is null or p_coef_route < 1 or p_coef_route > 3 then
    raise exception 'tarif:coef_route_invalide' using errcode = '22023';
  end if;

  select delivery_fee || '/' || livraison_km_inclus || '/' || livraison_prix_par_km || '/' || livraison_coef_route
    into v_avant from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  update public.restaurants
     set delivery_fee          = p_base,
         livraison_km_inclus   = p_km_inclus,
         livraison_prix_par_km = p_prix_par_km,
         livraison_coef_route  = p_coef_route
   where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (auth.uid(), 'tarif_livraison', p_restaurant_id, v_avant,
          p_base || '/' || p_km_inclus || '/' || p_prix_par_km || '/' || p_coef_route);
end $$;

revoke all on function public.admin_set_tarif_livraison(uuid, integer, numeric, integer, numeric) from public;
grant execute on function public.admin_set_tarif_livraison(uuid, integer, numeric, integer, numeric) to authenticated;
