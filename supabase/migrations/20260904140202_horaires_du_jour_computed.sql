-- Colonne calculee exposant l'horaire du jour courant (utile pour l'affichage
-- client : "Aujourd'hui : 8h30-22h" / "Ferme aujourd'hui"), meme principe que
-- ouvert_maintenant(restaurants). restaurants.opens_at/closes_at (colonnes
-- historiques, encore utilisees par admin_create_restaurant/admin_update_restaurant)
-- restent en base sans modification — seul le nouveau planning par jour pilote
-- desormais l'affichage et le calcul d'ouverture cote client.
create or replace function public.horaires_du_jour(r restaurants)
returns public.restaurant_hours
language sql
stable
as $$
  select h.* from public.restaurant_hours h
  where h.restaurant_id = r.id
    and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
  limit 1;
$$;
