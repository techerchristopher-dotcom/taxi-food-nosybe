-- VISIBILITE DES RESTAURANTS — trois etats, la ou il n'y en avait que deux.
-- (Applique en base le 2026-09-05 sous le nom `visibilite_restaurants_listing_status`.)
--
-- Le probleme : `is_open` ne dit QUE si on peut commander maintenant. La policy
-- restaurants_select_public etant `using (true)`, un restaurant ferme reste
-- affiche sur l'accueil avec la mention « Fermé ». Fermer n'a jamais masque.
--
--   visible      : comportement actuel, inchange (valeur par defaut)
--   coming_soon  : affiche grise, badge « Bientot disponible », non commandable
--   hidden       : n'apparait pas dans la liste d'accueil
--
-- ⚠️ `hidden` est un filtre d'AFFICHAGE, pas une regle de securite : la lecture
-- des restaurants reste publique, et une commande deja passee doit continuer a
-- afficher le nom de son restaurant dans l'historique du client. C'est le front
-- qui filtre la liste (`listRestaurants`), pas la RLS.
--
-- ⚠️ On ne SUPPRIME jamais un restaurant : de vraies commandes le referencent,
-- l'effacer casserait l'historique et les reversements.

alter table public.restaurants
  add column if not exists listing_status text not null default 'visible';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurants_listing_status_check') then
    alter table public.restaurants
      add constraint restaurants_listing_status_check
      check (listing_status in ('visible', 'coming_soon', 'hidden'));
  end if;
end $$;

create or replace function public.set_restaurant_listing_status(p_restaurant_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  if p_status not in ('visible','coming_soon','hidden') then raise exception 'Statut inconnu : %', p_status; end if;
  update public.restaurants set listing_status = p_status where id = p_restaurant_id;
end $$;

revoke execute on function public.set_restaurant_listing_status(uuid, text) from public;
revoke execute on function public.set_restaurant_listing_status(uuid, text) from anon;
grant  execute on function public.set_restaurant_listing_status(uuid, text) to authenticated;

update public.restaurants set listing_status = 'hidden'      where name = 'Angelo';
update public.restaurants set listing_status = 'coming_soon' where name = 'Taxi Be';
