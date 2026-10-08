-- L'escale Créole : refonte de la carte (2026-10-08, demande du porteur du projet, note du restaurant).
--
-- - La catégorie « Plats du jour » devient « Plats tous les jours » : Rougail saucisses, Bol renversé,
--   Riz frit poulet ou zébu, et les émincés — UNE fiche par viande (poulet / zébu), 35 000 Ar chacun,
--   pour 4 recettes : brède chinois, poivre vert, oignons, gingembre.
-- - Riz frit : prix pas encore donné → 0 Ar et EN RUPTURE (`is_available = false`) : il s'affiche
--   grisé « Bientôt de retour », il ne se commande pas. ⚠️ Lui donner son prix AVANT de le remettre dispo.
-- - Massalé cabri, Rôti porc, Poisson frit, Sauté porc aux gros piments = plats du jour SELON LA DISPO :
--   format « À l'affiche » en sommeil (sans catégorie, `in_menu = false`, étiquette « Plat du jour »,
--   `is_featured = false`). Le restaurant les met à l'affiche depuis ses Réglages le jour où il les sert.
-- - Sur chaque plat : plus de pâtes (le riz est l'accompagnement, plus de choix à faire), piment
--   OBLIGATOIRE (avec, offert / sans), suppléments Frites 10 000 · Riz 7 000 · Haricots blancs 7 000
--   (6 000 + 1 000 d'emballage). « Servi avec grains et piments » devient faux → « Servi avec du riz. »
-- - Emballage à emporter 1 000 Ar sur les plats ET les amuse-bouches (pas les boissons).

do $$
declare
  v_resto constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_cat uuid;
  v_id uuid;
  v_g uuid;
  v_p record;
  v_e record;
begin
  select id into v_cat from public.categories where restaurant_id = v_resto and name = 'Plats du jour';
  if v_cat is null then
    select id into v_cat from public.categories where restaurant_id = v_resto and name = 'Plats tous les jours';
  end if;
  update public.categories set name = 'Plats tous les jours', sort_order = 5 where id = v_cat;

  -- 1. Plats du jour selon la dispo : hors carte, en sommeil.
  update public.products
     set category_id = null, in_menu = false, is_featured = false, featured_label = 'Plat du jour'
   where restaurant_id = v_resto and not is_archived
     and name in ('Massalé cabri', 'Rôti porc à la créole', 'Poisson frit entier', 'Sauté porc aux gros piments');

  -- 2. Émincés existants : renommés à leur nom complet.
  update public.products set name = 'Émincé de zébu au brède chinois', price = 35000,
         description = 'Émincé de zébu au brède chinois. Servi avec du riz.', sort_order = 40
   where restaurant_id = v_resto and name = 'Émincé de zébu aux brèdes' and not is_archived;
  update public.products set name = 'Émincé de poulet au poivre vert', price = 35000,
         description = 'Émincé de poulet, sauce au poivre vert. Servi avec du riz.', sort_order = 50
   where restaurant_id = v_resto and name = 'Émincé de poulet poivre vert' and not is_archived;

  -- 3. Nouveaux plats.
  for v_e in
    select * from (values
      ('Émincé de poulet au brède chinois', 'Émincé de poulet au brède chinois. Servi avec du riz.', 35000, true, 41),
      ('Émincé de zébu au poivre vert', 'Émincé de zébu, sauce au poivre vert. Servi avec du riz.', 35000, true, 51),
      ('Émincé de poulet aux oignons', 'Émincé de poulet aux oignons. Servi avec du riz.', 35000, true, 60),
      ('Émincé de zébu aux oignons', 'Émincé de zébu aux oignons. Servi avec du riz.', 35000, true, 61),
      ('Émincé de poulet au gingembre', 'Émincé de poulet au gingembre. Servi avec du riz.', 35000, true, 70),
      ('Émincé de zébu au gingembre', 'Émincé de zébu au gingembre. Servi avec du riz.', 35000, true, 71),
      ('Riz frit poulet ou zébu', 'Riz frit au wok, poulet ou zébu au choix.', 0, false, 30)
    ) as t(nom, descr, prix, dispo, rang)
  loop
    if not exists (select 1 from public.products where restaurant_id = v_resto and name = v_e.nom and not is_archived) then
      insert into public.products (restaurant_id, category_id, name, description, price, is_available, in_menu, sort_order)
      values (v_resto, v_cat, v_e.nom, v_e.descr, v_e.prix, v_e.dispo, true, v_e.rang)
      returning id into v_id;
      if v_e.nom = 'Riz frit poulet ou zébu' then
        insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
        values (v_id, 'Choix de la viande', 1, 1, true, 5) returning id into v_g;
        insert into public.product_options (group_id, name, price_delta, sort_order, is_available)
        values (v_g, 'Poulet', 0, 1, true), (v_g, 'Zébu', 0, 2, true);
      end if;
    end if;
  end loop;

  update public.products set sort_order = 10 where restaurant_id = v_resto and name = 'Rougail saucisses' and not is_archived;
  update public.products set sort_order = 20 where restaurant_id = v_resto and name = 'Bol renversé poulet ou zébu' and not is_archived;

  -- 4. Descriptions des plats du jour : plus de grains inclus.
  update public.products set description = replace(replace(description,
           'Servi avec grains et piments.', 'Servi avec du riz.'),
           'Servie avec grains et piments.', 'Servie avec du riz.')
   where restaurant_id = v_resto and description like '%avec grains et piments.%';

  -- 5. Options de tous les plats (carte « Plats tous les jours » + plats du jour en sommeil).
  for v_p in
    select id from public.products
     where restaurant_id = v_resto and not is_archived
       and (category_id = v_cat
            or name in ('Massalé cabri', 'Rôti porc à la créole', 'Poisson frit entier', 'Sauté porc aux gros piments'))
  loop
    -- Plus de pâtes : le choix d'accompagnement disparaît (le riz est servi d'office).
    delete from public.product_options where group_id in
      (select id from public.product_option_groups where product_id = v_p.id and name = 'Accompagnement (1 au choix, inclus)');
    delete from public.product_option_groups where product_id = v_p.id and name = 'Accompagnement (1 au choix, inclus)';

    -- Piment obligatoire.
    if not exists (select 1 from public.product_option_groups where product_id = v_p.id and name = 'Piment') then
      insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
      values (v_p.id, 'Piment', 1, 1, true, 10) returning id into v_g;
      insert into public.product_options (group_id, name, price_delta, sort_order, is_available)
      values (v_g, 'Avec piment (offert)', 0, 1, true), (v_g, 'Sans piment', 0, 2, true);
    end if;

    -- Suppléments : on peut en prendre plusieurs.
    select id into v_g from public.product_option_groups where product_id = v_p.id and name = 'Supplément';
    if v_g is null then
      insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
      values (v_p.id, 'Supplément', 0, 3, false, 20) returning id into v_g;
    else
      update public.product_option_groups set min_select = 0, max_select = 3, required = false, sort_order = 20 where id = v_g;
    end if;
    if not exists (select 1 from public.product_options where group_id = v_g and name = 'Frites') then
      insert into public.product_options (group_id, name, price_delta, sort_order, is_available) values (v_g, 'Frites', 10000, 1, true);
    end if;
    if not exists (select 1 from public.product_options where group_id = v_g and name = 'Riz supplémentaire') then
      insert into public.product_options (group_id, name, price_delta, sort_order, is_available) values (v_g, 'Riz supplémentaire', 7000, 2, true);
    end if;
    if not exists (select 1 from public.product_options where group_id = v_g and name = 'Haricots blancs') then
      insert into public.product_options (group_id, name, price_delta, sort_order, is_available) values (v_g, 'Haricots blancs', 7000, 3, true);
    end if;
    v_g := null;
  end loop;

  -- 6. Emballage : plats + amuse-bouches, jamais les boissons.
  update public.products p
     set packaging_fee = 1000, packaging_label = 'Emballage à emporter'
   where p.restaurant_id = v_resto and not p.is_archived
     and (p.category_id = v_cat
          or p.category_id in (select id from public.categories where restaurant_id = v_resto and name = 'Amuses-bouches')
          or p.name in ('Massalé cabri', 'Rôti porc à la créole', 'Poisson frit entier', 'Sauté porc aux gros piments'));
end $$;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Plats tous les jours', 'en', 'Everyday dishes', 'manuel'),
  ('Plats tous les jours', 'it', 'Piatti di tutti i giorni', 'manuel'),
  ('Piment', 'en', 'Chili', 'manuel'),
  ('Piment', 'it', 'Peperoncino', 'manuel'),
  ('Avec piment (offert)', 'en', 'With chili (free)', 'manuel'),
  ('Avec piment (offert)', 'it', 'Con peperoncino (offerto)', 'manuel'),
  ('Sans piment', 'en', 'No chili', 'manuel'),
  ('Sans piment', 'it', 'Senza peperoncino', 'manuel'),
  ('Riz supplémentaire', 'en', 'Extra rice', 'manuel'),
  ('Riz supplémentaire', 'it', 'Riso in più', 'manuel'),
  ('Haricots blancs', 'en', 'White beans', 'manuel'),
  ('Haricots blancs', 'it', 'Fagioli bianchi', 'manuel'),
  ('Émincé de poulet au brède chinois', 'en', 'Sliced chicken with Chinese greens', 'manuel'),
  ('Émincé de poulet au brède chinois', 'it', 'Straccetti di pollo con verdure cinesi', 'manuel'),
  ('Émincé de zébu au brède chinois', 'en', 'Sliced zebu with Chinese greens', 'manuel'),
  ('Émincé de zébu au brède chinois', 'it', 'Straccetti di zebù con verdure cinesi', 'manuel'),
  ('Émincé de poulet au poivre vert', 'en', 'Sliced chicken with green pepper sauce', 'manuel'),
  ('Émincé de poulet au poivre vert', 'it', 'Straccetti di pollo al pepe verde', 'manuel'),
  ('Émincé de zébu au poivre vert', 'en', 'Sliced zebu with green pepper sauce', 'manuel'),
  ('Émincé de zébu au poivre vert', 'it', 'Straccetti di zebù al pepe verde', 'manuel'),
  ('Émincé de poulet aux oignons', 'en', 'Sliced chicken with onions', 'manuel'),
  ('Émincé de poulet aux oignons', 'it', 'Straccetti di pollo alle cipolle', 'manuel'),
  ('Émincé de zébu aux oignons', 'en', 'Sliced zebu with onions', 'manuel'),
  ('Émincé de zébu aux oignons', 'it', 'Straccetti di zebù alle cipolle', 'manuel'),
  ('Émincé de poulet au gingembre', 'en', 'Sliced chicken with ginger', 'manuel'),
  ('Émincé de poulet au gingembre', 'it', 'Straccetti di pollo allo zenzero', 'manuel'),
  ('Émincé de zébu au gingembre', 'en', 'Sliced zebu with ginger', 'manuel'),
  ('Émincé de zébu au gingembre', 'it', 'Straccetti di zebù allo zenzero', 'manuel'),
  ('Riz frit poulet ou zébu', 'en', 'Fried rice, chicken or zebu', 'manuel'),
  ('Riz frit poulet ou zébu', 'it', 'Riso fritto, pollo o zebù', 'manuel'),
  ('Riz frit au wok, poulet ou zébu au choix.', 'en', 'Wok-fried rice, with chicken or zebu.', 'manuel'),
  ('Riz frit au wok, poulet ou zébu au choix.', 'it', 'Riso saltato al wok, con pollo o zebù.', 'manuel'),
  ('Émincé de poulet au brède chinois. Servi avec du riz.', 'en', 'Sliced chicken with Chinese greens. Served with rice.', 'manuel'),
  ('Émincé de poulet au brède chinois. Servi avec du riz.', 'it', 'Straccetti di pollo con verdure cinesi. Servito con riso.', 'manuel'),
  ('Émincé de zébu au brède chinois. Servi avec du riz.', 'en', 'Sliced zebu with Chinese greens. Served with rice.', 'manuel'),
  ('Émincé de zébu au brède chinois. Servi avec du riz.', 'it', 'Straccetti di zebù con verdure cinesi. Servito con riso.', 'manuel'),
  ('Émincé de poulet, sauce au poivre vert. Servi avec du riz.', 'en', 'Sliced chicken, green pepper sauce. Served with rice.', 'manuel'),
  ('Émincé de poulet, sauce au poivre vert. Servi avec du riz.', 'it', 'Straccetti di pollo, salsa al pepe verde. Servito con riso.', 'manuel'),
  ('Émincé de zébu, sauce au poivre vert. Servi avec du riz.', 'en', 'Sliced zebu, green pepper sauce. Served with rice.', 'manuel'),
  ('Émincé de zébu, sauce au poivre vert. Servi avec du riz.', 'it', 'Straccetti di zebù, salsa al pepe verde. Servito con riso.', 'manuel'),
  ('Émincé de poulet aux oignons. Servi avec du riz.', 'en', 'Sliced chicken with onions. Served with rice.', 'manuel'),
  ('Émincé de poulet aux oignons. Servi avec du riz.', 'it', 'Straccetti di pollo alle cipolle. Servito con riso.', 'manuel'),
  ('Émincé de zébu aux oignons. Servi avec du riz.', 'en', 'Sliced zebu with onions. Served with rice.', 'manuel'),
  ('Émincé de zébu aux oignons. Servi avec du riz.', 'it', 'Straccetti di zebù alle cipolle. Servito con riso.', 'manuel'),
  ('Émincé de poulet au gingembre. Servi avec du riz.', 'en', 'Sliced chicken with ginger. Served with rice.', 'manuel'),
  ('Émincé de poulet au gingembre. Servi avec du riz.', 'it', 'Straccetti di pollo allo zenzero. Servito con riso.', 'manuel'),
  ('Émincé de zébu au gingembre. Servi avec du riz.', 'en', 'Sliced zebu with ginger. Served with rice.', 'manuel'),
  ('Émincé de zébu au gingembre. Servi avec du riz.', 'it', 'Straccetti di zebù allo zenzero. Servito con riso.', 'manuel'),
  ('Saucisses de porc mijotées à la tomate, oignon et gingembre. Servi avec du riz.', 'en', 'Pork sausages simmered with tomato, onion and ginger. Served with rice.', 'manuel'),
  ('Saucisses de porc mijotées à la tomate, oignon et gingembre. Servi avec du riz.', 'it', 'Salsicce di maiale stufate con pomodoro, cipolla e zenzero. Servito con riso.', 'manuel'),
  ('Cabri mijoté au massalé. Servi avec du riz.', 'en', 'Goat simmered in massalé spices. Served with rice.', 'manuel'),
  ('Cabri mijoté au massalé. Servi avec du riz.', 'it', 'Capretto stufato al massalé. Servito con riso.', 'manuel'),
  ('Rôti de porc, sauce créole. Servi avec du riz.', 'en', 'Roast pork, Creole sauce. Served with rice.', 'manuel'),
  ('Rôti de porc, sauce créole. Servi avec du riz.', 'it', 'Arrosto di maiale, salsa creola. Servito con riso.', 'manuel'),
  ('Carangue entière frite. Servie avec du riz.', 'en', 'Whole fried trevally. Served with rice.', 'manuel'),
  ('Carangue entière frite. Servie avec du riz.', 'it', 'Carangide intero fritto. Servito con riso.', 'manuel'),
  ('Porc sauté aux gros piments. Servi avec du riz.', 'en', 'Pork stir-fried with large chilies. Served with rice.', 'manuel'),
  ('Porc sauté aux gros piments. Servi avec du riz.', 'it', 'Maiale saltato con peperoncini grossi. Servito con riso.', 'manuel')
on conflict (fr, langue) do nothing;

-- Ordre d'affichage des suppléments, identique sur tous les plats : Frites, Riz, Haricots blancs.
-- (Appliqué juste après, hors migration : les « Frites » existantes gardaient leur ancien rang.)
update public.product_options o
   set sort_order = case o.name when 'Frites' then 1 when 'Riz supplémentaire' then 2 when 'Haricots blancs' then 3 end
  from public.product_option_groups g
  join public.products p on p.id = g.product_id
 where o.group_id = g.id and g.name = 'Supplément'
   and p.restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9'
   and o.name in ('Frites', 'Riz supplémentaire', 'Haricots blancs');
