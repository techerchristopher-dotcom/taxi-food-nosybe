-- La position GPS des restaurants (2026-09-24).
--
-- POURQUOI. La fiche restaurant ne portait qu'un nom de quartier (« Ambatoloaka », « Dar es
-- Salam »). Impossible de calculer une distance de livraison : le chantier « livraison au
-- kilomètre » (10 000 Ar + tant par km) bute dessus dès la première ligne. Les positions ci-dessous
-- viennent des liens Google Maps envoyés par le porteur du projet le 2026-09-24.
--
-- CONTRÔLE QUI TOMBE JUSTE : la commande TF-253, livrée « chez M&K » depuis Chez Bidul & Truc, a
-- été déposée à 13.3863783 S / 48.2386117 E — soit 30 m du point donné pour M&K. Les deux sources
-- sont indépendantes : la position est bonne.
--
-- ⚠️ La Plage n'a pas encore de position : sa colonne reste nulle, et tout calcul de distance doit
-- traiter le cas « position inconnue » plutôt que de supposer un point.
alter table public.restaurants
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.restaurants
  drop constraint if exists restaurants_position_forme;
alter table public.restaurants
  add constraint restaurants_position_forme check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );

comment on column public.restaurants.latitude is
  'Position du restaurant (départ des livraisons). Écriture : admin_set_position_restaurant().';

update public.restaurants set latitude = -13.3930201, longitude = 48.2078429
 where id = '700e8f32-e966-476a-b371-02884d08dea1';   -- Chez Bidul & Truc
update public.restaurants set latitude = -13.397834,  longitude = 48.206980
 where id = '958faac6-61ab-4ff5-9226-b8adab46ed24';   -- La Cabane
update public.restaurants set latitude = -13.3861762, longitude = 48.2386413
 where id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53';   -- Chez M&K

create or replace function public.admin_set_position_restaurant(
  p_restaurant_id uuid, p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_avant text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'position:incomplete' using errcode = '22023';
  end if;
  -- Garde-fou géographique : Nosy Be tient largement dans ce carré. Une virgule oubliée ou une
  -- latitude et une longitude inversées tombent dehors, et feraient facturer des kilomètres
  -- imaginaires au client.
  if p_latitude is not null and not (p_latitude between -14.0 and -13.0 and p_longitude between 47.8 and 48.8) then
    raise exception 'position:hors_nosy_be' using errcode = '22023';
  end if;

  select latitude::text || ',' || longitude::text into v_avant from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  update public.restaurants set latitude = p_latitude, longitude = p_longitude where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (auth.uid(), 'position_restaurant', p_restaurant_id, v_avant,
          coalesce(p_latitude::text || ',' || p_longitude::text, 'effacee'));
end $$;

revoke all on function public.admin_set_position_restaurant(uuid, double precision, double precision) from public, anon;
grant execute on function public.admin_set_position_restaurant(uuid, double precision, double precision) to authenticated;
