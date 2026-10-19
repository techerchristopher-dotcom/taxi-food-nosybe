-- Le bilan « ça tourne déjà » de la page /pro, sur le MODÈLE du carrousel « Bilan des 28
-- premiers jours » publié le 2026-10-09 (calendrier éditorial, 10 cartes 1080×1350) :
-- jours, livraisons par semaine, km à moto, délai, restaurants, articles et plats les plus
-- commandés, montant payé, montant revenu aux restaurants, note. Demande du porteur du
-- projet (2026-10-19) : « trop de texte, pas assez de visuel sur les stats, le modèle
-- existe déjà, il suffit de le mettre à jour ».
--
-- Lu en direct à chaque affichage. Agrégés seulement. Depuis le lancement public du
-- 10 septembre (heure de Nosy Be), Taxi Be (restaurant de test) exclu, semaines complètes
-- seulement pour l'histogramme (une semaine en cours ferait croire à une baisse).
-- « Revient aux restaurants » = plats + emballage − part d'emballage de Taxi Food −
-- commission − part offerte par le restaurant (même formule que les reversements).
create or replace function public.pro_bilan()
returns jsonb language sql stable security definer set search_path = public as $$
  with lancement as (select ('2026-09-10'::date::timestamp at time zone 'Indian/Antananarivo') as t0),
  o as (
    select o.*, r.latitude rlat, r.longitude rlng, r.livraison_coef_route coef, a.latitude alat, a.longitude alng
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      left join public.addresses a on a.id = o.address_id, lancement l
     where o.status = 'livree' and o.restaurant_id <> 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886'
       and o.created_at >= l.t0),
  sem as (
    select floor(extract(epoch from o.created_at - l.t0) / 604800)::int + 1 as n, count(*) as c
      from o, lancement l group by 1),
  art as (
    select i.product_name_snapshot as nom, sum(i.quantity) as q
      from public.order_items i join o on o.id = i.order_id
     where i.retire_le is null group by 1)
  select jsonb_build_object(
    'depuis', (select t0 from lancement),
    'jours', (select (now() at time zone 'Indian/Antananarivo')::date - '2026-09-10'::date from lancement),
    'livraisons', (select count(*) from o),
    'semaines', coalesce((select jsonb_agg(jsonb_build_object('n', s.n, 'c', s.c,
                    'du', (select t0 from lancement) + make_interval(days => (s.n - 1) * 7)) order by s.n)
                  from sem s, lancement l
                 where l.t0 + make_interval(days => s.n * 7) <= now()), '[]'::jsonb),
    'km_total', (select round(sum(public.distance_vol_oiseau_km(rlat, rlng, alat, alng) * coef)) from o
                  where rlat is not null and alat is not null),
    'km_moyen', (select round(avg(public.distance_vol_oiseau_km(rlat, rlng, alat, alng) * coef)::numeric, 1) from o
                  where rlat is not null and alat is not null),
    'delai_median', (select round(percentile_cont(.5) within group (order by extract(epoch from delivered_at - created_at) / 60))
                  from o where delivered_at is not null),
    'pct_moins_1h', (select round(100.0 * count(*) filter (where delivered_at - created_at < interval '1 hour') / nullif(count(*), 0))
                  from o where delivered_at is not null),
    'trajet_median', (select round(percentile_cont(.5) within group (order by extract(epoch from delivered_at - picked_up_at) / 60))
                  from o where delivered_at is not null and picked_up_at is not null),
    'articles', (select sum(q) from art),
    'plats_differents', (select count(*) from art),
    'top', coalesce((select jsonb_agg(jsonb_build_object('nom', nom, 'q', q) order by q desc)
                  from (select * from art order by q desc, nom limit 5) t), '[]'::jsonb),
    'paye_clients', (select sum(total) from o),
    'panier_moyen', (select round(avg(total)) from o),
    'revient_restaurants', (select sum(subtotal + coalesce(packaging_fee, 0) - coalesce(emballage_taxifood, 0)
                  - coalesce(commission_amount, 0) - coalesce(remise_charge_restaurant, 0)) from o),
    'clients', (select count(distinct user_id) from o),
    'clients_revenus', (select count(*) from (select user_id from o group by 1 having count(*) > 1) x),
    'restaurants', (select count(*) from public.restaurants where listing_status = 'visible'),
    'logos', coalesce((select jsonb_agg(logo_url order by sort_order) from public.restaurants
                  where listing_status = 'visible' and logo_url is not null), '[]'::jsonb),
    'note', (select round(avg(note_restaurant), 1) from public.avis where statut = 'publie'),
    'note_cuisine', (select round(avg(note_cuisine), 1) from public.avis where statut = 'publie'),
    'note_preparation', (select round(avg(note_preparation), 1) from public.avis where statut = 'publie'),
    'note_livraison', (select round(avg(note_livraison), 1) from public.avis where statut = 'publie'),
    'nb_avis', (select count(*) from public.avis where statut = 'publie'))
$$;
revoke all on function public.pro_bilan() from public, anon, authenticated;

-- La page lit le bilan complet (clé « bilan »), en plus des chiffres courts « stats ».
do $$
declare d text;
begin
  d := pg_get_functiondef('public.pro_page(text)'::regprocedure);
  if position('''stats'', public.pro_stats(),' in d) = 0 then raise exception 'ancre stats absente'; end if;
  execute replace(d, '''stats'', public.pro_stats(),', '''stats'', public.pro_stats(), ''bilan'', public.pro_bilan(),');
end $$;
revoke all on function public.pro_page(text) from public;
grant execute on function public.pro_page(text) to anon, authenticated;
