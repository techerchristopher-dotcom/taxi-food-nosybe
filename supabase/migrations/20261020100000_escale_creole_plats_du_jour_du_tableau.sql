-- L'escale Créole : les plats du jour de son tableau (photo du 2026-10-20, lecture validée par
-- le porteur du projet). Restaurant 128e68ab-8e64-4f48-bf79-acc67f3deca9.
--
-- Le tableau :
--   Accompagnements : pâtes ou riz, grains, piment. Frites en supplément (10 000).
--   Rougail saucisses 38 000 · Massalé cabri 38 000 · Rougail morue 40 000 ·
--   Bol renversé poulet ou zébu 32 000 · Filet vivaneau sauce combava 40 000 ·
--   Rôti porc à la créole 38 000 · Cari poulet pays 38 000 ·
--   Émincé de poulet au poivre vert 38 000
--
-- Ce que fait la migration (chaque étape compte ses lignes et lève sinon) :
--  1. crée au vivier les 3 plats qui n'y étaient pas (rougail morue, filet de vivaneau sauce
--     combava, cari poulet pays), avec les groupes d'options du massalé cabri (piment, grains,
--     supplément frites / riz / grains). Photos déposées par deposer-visuel le 2026-10-20 ;
--  2. Émincé de poulet au poivre vert : 35 000 -> 38 000 (prix du tableau) ;
--  3. ajoute « Riz ou pâtes » (obligatoire, riz par défaut) aux 7 plats en sauce du tableau.
--     Pas au bol renversé : son riz fait partie du plat. Les frites en supplément existent déjà ;
--  4. met à l'affiche les 8 plats du tableau, éteint le reste du vivier (poisson frit entier,
--     sauté de porc : DORMANTS, jamais archivés).

do $$
declare
  c_resto constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  c_modele constant uuid := '4901d821-2a43-4c83-afdf-8216ec52430e';   -- Massalé cabri
  c_emince constant uuid := 'e09b18d1-2e96-4b49-bc08-ba0e01b0554a';
  c_photo  constant text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/';
  v_new uuid; v_g uuid; v_n int; gr record; r record;
begin
  -- 1. les trois nouveaux plats
  for r in select * from (values
    ('Rougail morue', 40000, 25, 'pj-rougail-morue.jpg',
     'Morue dessalée, tomates, oignons, ail, gingembre, curcuma, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. La morue est dessalée, effeuillée et dorée avec l''oignon et l''ail, puis mijotée avec les tomates et les épices jusqu''à une sauce bien réduite. Servi avec du riz ou des pâtes, et des grains (haricots blancs).'),
    ('Filet de vivaneau sauce combava', 40000, 35, 'pj-filet-vivaneau-combava.jpg',
     'Filet de vivaneau, sauce au combava… et le secret du chef. Le poisson est saisi côté peau jusqu''à être bien doré, puis nappé d''une sauce parfumée au zeste de combava, le petit agrume de l''océan Indien. Servi avec du riz ou des pâtes, et des grains (haricots blancs).'),
    ('Cari poulet pays', 38000, 45, 'pj-cari-poulet-pays.jpg',
     'Poulet pays (poulet fermier), tomates, oignons, ail, gingembre, curcuma, thym, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Le poulet est doré en morceaux, puis mijoté longuement dans une sauce au curcuma jusqu''à ce que la viande se détache. Servi avec du riz ou des pâtes, et des grains (haricots blancs).')
  ) t(nom, prix, ordre, photo, descr) loop
    if exists (select 1 from products where restaurant_id = c_resto and name = r.nom) then
      raise exception 'deja present : %', r.nom;
    end if;
    insert into products (restaurant_id, category_id, name, description, price, photo_url, is_available,
                          is_archived, is_featured, featured_label, in_menu, diet_tags, sort_order, listing_status)
    values (c_resto, null, r.nom, r.descr, r.prix, c_photo || r.photo, true,
            false, false, 'Plat du jour', false, '{}', r.ordre, 'visible')
    returning id into v_new;
    for gr in select * from product_option_groups where product_id = c_modele order by sort_order loop
      insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order, par_quantite)
      values (v_new, gr.name, gr.min_select, gr.max_select, gr.required, gr.sort_order, gr.par_quantite)
      returning id into v_g;
      insert into product_options (group_id, name, price_delta, is_available, sort_order, photo_url, par_defaut, packaging_fee)
      select v_g, name, price_delta, is_available, sort_order, photo_url, par_defaut, packaging_fee
      from product_options where group_id = gr.id;
    end loop;
  end loop;
  select count(*) into v_n from products where restaurant_id = c_resto
    and name in ('Rougail morue', 'Filet de vivaneau sauce combava', 'Cari poulet pays');
  if v_n <> 3 then raise exception 'plats crees : % au lieu de 3', v_n; end if;
  select count(*) into v_n from product_option_groups g join products p on p.id = g.product_id
    where p.restaurant_id = c_resto and p.name in ('Rougail morue', 'Filet de vivaneau sauce combava', 'Cari poulet pays');
  if v_n <> 9 then raise exception 'groupes copies : % au lieu de 9', v_n; end if;

  -- 2. prix du tableau
  update products set price = 38000 where id = c_emince and price = 35000;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'emince poivre vert : % ligne(s)', v_n; end if;

  -- 3. riz ou pates, sur les 7 plats en sauce du tableau
  for r in select id from products where restaurant_id = c_resto and name in (
      'Rougail saucisses', 'Massalé cabri', 'Rougail morue', 'Filet de vivaneau sauce combava',
      'Rôti porc à la créole', 'Cari poulet pays', 'Émincé de poulet au poivre vert') loop
    if exists (select 1 from product_option_groups where product_id = r.id and name = 'Riz ou pâtes') then
      raise exception 'riz ou pates deja present';
    end if;
    insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (r.id, 'Riz ou pâtes', 1, 1, true, 5) returning id into v_g;
    insert into product_options (group_id, name, price_delta, sort_order, par_defaut) values
      (v_g, 'Riz (inclus)', 0, 1, true), (v_g, 'Pâtes (inclus)', 0, 2, false);
  end loop;
  select count(*) into v_n from product_option_groups g join products p on p.id = g.product_id
    where p.restaurant_id = c_resto and g.name = 'Riz ou pâtes';
  if v_n <> 7 then raise exception 'riz ou pates : % au lieu de 7', v_n; end if;

  -- 4. l'affiche du jour
  update products set is_featured = false
    where restaurant_id = c_resto and is_featured;
  update products set is_featured = true, is_available = true, featured_label = 'Plat du jour'
    where restaurant_id = c_resto and coalesce(is_archived, false) = false and name in (
      'Rougail saucisses', 'Massalé cabri', 'Rougail morue', 'Bol renversé poulet ou zébu',
      'Filet de vivaneau sauce combava', 'Rôti porc à la créole', 'Cari poulet pays',
      'Émincé de poulet au poivre vert');
  get diagnostics v_n = row_count;
  if v_n <> 8 then raise exception 'a l affiche : % au lieu de 8', v_n; end if;
  select count(*) into v_n from products where restaurant_id = c_resto and is_featured;
  if v_n <> 8 then raise exception 'total a l affiche : %', v_n; end if;
end $$;
