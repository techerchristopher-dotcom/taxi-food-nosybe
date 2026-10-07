-- Le Nandipo : retours du patron (WhatsApp du 2026-10-06/07) appliqués à la carte.
--
-- 1. Accompagnements : pas de haricots verts (ils sont dans les légumes sautés),
--    « Légumes » devient « Légumes sautés », ajout du « Riz aux oignons ».
--    Sauces et accompagnements sont inclus dans le prix. Une assiette
--    d'accompagnement EN PLUS est possible — prix non communiqué, pas encore à la carte.
-- 2. Horaires : 7 j/7, 08:00 – 22:00, toute l'année. `auto_open` : l'ouverture suit
--    les horaires (le restaurant reste `coming_soon` : aucune commande possible tant
--    que le porteur du projet ne l'a pas passé en ligne).
-- 3. Photo de la Carbonara retirée : c'était un osso bucco (signalé par le patron).
--    Règle du projet : jamais de photo approximative, le plat affiche ses initiales.
-- 4. Desserts retirés : glaces et mousses (en verrine) ne supportent pas le transport.
-- 5. « Demi pizza et salade » : toutes les pizzas sont éligibles → groupe obligatoire
--    « Pizza au choix » ; la salade mixte est « laitue, tomate et oignons ».
-- Téléphone confirmé : +261 37 46 690 10 (déjà en base).

do $$
declare
  v_resto constant uuid := 'cb7fda65-3ed0-41aa-940c-b8974f7363c8';
  v_demi uuid;
  v_groupe uuid;
begin
  -- 1. Accompagnements
  delete from public.product_options o
   using public.product_option_groups g, public.products p
   where o.group_id = g.id and g.product_id = p.id and p.restaurant_id = v_resto
     and g.name = 'Accompagnement (1 au choix, inclus)' and o.name = 'Haricots verts';

  update public.product_options o set name = 'Légumes sautés'
    from public.product_option_groups g, public.products p
   where o.group_id = g.id and g.product_id = p.id and p.restaurant_id = v_resto
     and g.name = 'Accompagnement (1 au choix, inclus)' and o.name = 'Légumes';

  insert into public.product_options (group_id, name, price_delta, sort_order)
  select g.id, 'Riz aux oignons', 0,
         coalesce((select o.sort_order from public.product_options o
                    where o.group_id = g.id and o.name = 'Riz safrané'), 20) + 5
    from public.product_option_groups g join public.products p on p.id = g.product_id
   where p.restaurant_id = v_resto and g.name = 'Accompagnement (1 au choix, inclus)'
     and not exists (select 1 from public.product_options o where o.group_id = g.id and o.name = 'Riz aux oignons');

  -- 2. Horaires
  delete from public.restaurant_hours where restaurant_id = v_resto;
  insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
  select v_resto, d, 1, '08:00', '22:00', false from generate_series(0, 6) d;
  update public.restaurants set auto_open = true where id = v_resto;

  -- 3. Carbonara sans photo
  update public.products set photo_url = null
   where restaurant_id = v_resto and name = 'Carbonara';

  -- 4. Desserts
  update public.products p set is_archived = true
    from public.categories c
   where p.category_id = c.id and c.restaurant_id = v_resto and c.name = 'Dessert';
  delete from public.categories where restaurant_id = v_resto and name = 'Dessert';

  -- 5. Demi pizza et salade
  select id into v_demi from public.products
   where restaurant_id = v_resto and name = 'Demi pizza et salade' and not is_archived;

  update public.product_options o set name = 'Salade mixte (laitue, tomate, oignons)'
    from public.product_option_groups g
   where o.group_id = g.id and g.product_id = v_demi and o.name = 'Salade mixte';

  if not exists (select 1 from public.product_option_groups where product_id = v_demi and name = 'Pizza au choix') then
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (v_demi, 'Pizza au choix', 1, 1, true, 0)
    returning id into v_groupe;

    insert into public.product_options (group_id, name, price_delta, sort_order)
    select v_groupe, p.name, 0, p.sort_order
      from public.products p join public.categories c on c.id = p.category_id
     where p.restaurant_id = v_resto and c.name = 'Pizzas' and not p.is_archived
       and p.id <> v_demi;

    -- La salade vient après la pizza.
    update public.product_option_groups set sort_order = 10
     where product_id = v_demi and name = 'Salade au choix';
  end if;
end $$;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Riz aux oignons', 'en', 'Onion rice', 'manuel'),
  ('Riz aux oignons', 'it', 'Riso alle cipolle', 'manuel'),
  ('Légumes sautés', 'en', 'Sautéed vegetables', 'manuel'),
  ('Légumes sautés', 'it', 'Verdure saltate', 'manuel'),
  ('Pizza au choix', 'en', 'Choice of pizza', 'manuel'),
  ('Pizza au choix', 'it', 'Pizza a scelta', 'manuel'),
  ('Salade mixte (laitue, tomate, oignons)', 'en', 'Mixed salad (lettuce, tomato, onion)', 'manuel'),
  ('Salade mixte (laitue, tomate, oignons)', 'it', 'Insalata mista (lattuga, pomodoro, cipolla)', 'manuel')
on conflict (fr, langue) do nothing;
