-- Le Nandipo : décisions du porteur du projet du 2026-10-07.
-- - Commission 10 % (et non 15 %).
-- - Position : épingle Google Maps « Nandipo » (maps.app.goo.gl/YtfDVBpxjxNkMy6NA),
--   -13.4046363, 48.2735719 — Rue Albert I, Hell-Ville. Sert au calcul de la livraison.
-- - Fin des commandes à 21:45 (fermeture réelle 22:00), comme Chez Bidule & Truc.
-- - Assiette d'accompagnement EN PLUS à 5 000 Ar : même structure que La Plage, un
--   second groupe facultatif « Accompagnement supplémentaire » sur les 15 plats qui ont
--   un accompagnement inclus.

do $$
declare
  v_resto constant uuid := 'cb7fda65-3ed0-41aa-940c-b8974f7363c8';
  v_g record;
  v_sup uuid;
begin
  update public.restaurants
     set commission_rate = 0.10, latitude = -13.4046363, longitude = 48.2735719
   where id = v_resto;

  update public.restaurant_hours set closes_at = '21:45'
   where restaurant_id = v_resto and closes_at = '22:00';

  for v_g in
    select g.id, g.product_id from public.product_option_groups g
      join public.products p on p.id = g.product_id
     where p.restaurant_id = v_resto and g.name = 'Accompagnement (1 au choix, inclus)'
       and not exists (select 1 from public.product_option_groups s
                        where s.product_id = g.product_id and s.name = 'Accompagnement supplémentaire')
  loop
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (v_g.product_id, 'Accompagnement supplémentaire', 0, 7, false, 20)
    returning id into v_sup;

    insert into public.product_options (group_id, name, price_delta, sort_order)
    select v_sup, '+ ' || o.name, 5000, o.sort_order
      from public.product_options o where o.group_id = v_g.id;
  end loop;
end $$;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('+ Riz safrané', 'en', '+ Saffron rice', 'manuel'),
  ('+ Riz safrané', 'it', '+ Riso allo zafferano', 'manuel'),
  ('+ Riz aux oignons', 'en', '+ Onion rice', 'manuel'),
  ('+ Riz aux oignons', 'it', '+ Riso alle cipolle', 'manuel')
on conflict (fr, langue) do nothing;
