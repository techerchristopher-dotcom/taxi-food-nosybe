-- 20260924152000_frais_livraison_par_adresse.sql
--
-- L'app affiche le VRAI prix : elle demande les frais pour (restaurant, adresse
-- choisie), pas pour un couple de coordonnees qu'elle aurait dans la main.
--
-- POURQUOI PAR IDENTIFIANT D'ADRESSE plutot qu'en passant lat/lng : l'adresse
-- doit appartenir a l'appelant. Laisser l'ecran envoyer des coordonnees libres
-- ferait de la fonction un mesureur de distance a la demande. Le montant affiche
-- ne fait de toute facon pas foi : `create_order` recalcule (migration
-- 20260924151000). Cette fonction ne sert qu'a ne pas mentir a l'ecran.
--
-- Adresse inconnue ou qui n'est pas la sienne : on rend le tarif de base plutot
-- qu'une erreur. Un ecran de panier n'a pas a casser parce qu'une adresse vient
-- d'etre supprimee sur un autre telephone.

create or replace function public.frais_livraison_adresse(
  p_restaurant_id uuid,
  p_address_id    uuid
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
  v_lat double precision;
  v_lng double precision;
begin
  select a.latitude, a.longitude into v_lat, v_lng
    from public.addresses a
   where a.id = p_address_id and a.user_id = auth.uid();

  return query select * from public.frais_livraison_detail(p_restaurant_id, v_lat, v_lng);
end $$;

revoke all on function public.frais_livraison_adresse(uuid, uuid) from public;
grant execute on function public.frais_livraison_adresse(uuid, uuid) to anon, authenticated;
