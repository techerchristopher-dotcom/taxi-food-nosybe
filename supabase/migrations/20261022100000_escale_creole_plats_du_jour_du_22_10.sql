-- L'escale Créole : plats du jour du tableau du 2026-10-22.
-- À l'affiche : rougail saucisses, rôti porc à la créole, bol renversé, pavé de vivaneau
-- (renommé, même plat et même photo que « Filet de vivaneau sauce combava »), émincé de zébu
-- sauce poivre vert (38 000 comme sur le tableau, la carte suit), riz frit poulet ou zébu
-- (35 000 gardé : décision du porteur du projet). Tous les autres plats du jour dorment
-- (is_featured = false, jamais archivés). Jarret de porc braisé et émincé de poulet sauce
-- huître : créés à part, une fois leurs photos validées.
do $$
declare
  r constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  a_laffiche constant uuid[] := array[
    'b8faaf01-b48c-4e55-87b2-02f788c10694', -- Rougail saucisses
    '1523cece-4950-4709-a94d-9e2d1e096467', -- Rôti porc à la créole
    '3586a8a9-f8e8-4468-91d9-a5286f13285e', -- Bol renversé poulet ou zébu
    'acf822ed-351f-4669-b211-997cb7963e02', -- Pavé de vivaneau
    '49aa1466-731d-4a61-a2ab-8a4aa4b6fdf7', -- Émincé de zébu au poivre vert
    'f995abf6-25df-4d40-9e46-b9e96de776df'  -- Riz frit poulet ou zébu
  ]::uuid[];
  n int;
  g uuid;
begin
  update products set is_featured = false
   where restaurant_id = r and is_featured and not (id = any(a_laffiche));

  update products set is_featured = true, is_available = true
   where restaurant_id = r and id = any(a_laffiche) and not is_archived;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'attendu 6 plats a l''affiche, %', n; end if;

  update products
     set name = 'Pavé de vivaneau sauce crème combava',
         description = replace(description, 'Filet de vivaneau, sauce au combava',
                                            'Pavé de vivaneau, sauce crème au combava')
   where id = 'acf822ed-351f-4669-b211-997cb7963e02' and restaurant_id = r;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'vivaneau introuvable'; end if;

  update products set price = 38000
   where id = '49aa1466-731d-4a61-a2ab-8a4aa4b6fdf7' and restaurant_id = r and price = 35000;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'prix emince zebu poivre vert : % ligne', n; end if;

  -- « Pâtes ou riz » : le groupe manquait sur l'émincé de zébu au poivre vert
  -- (présent sur son jumeau poulet).
  if not exists (select 1 from product_option_groups
                  where product_id = '49aa1466-731d-4a61-a2ab-8a4aa4b6fdf7' and name = 'Riz ou pâtes') then
    insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values ('49aa1466-731d-4a61-a2ab-8a4aa4b6fdf7', 'Riz ou pâtes', 1, 1, true, 5)
    returning id into g;
    insert into product_options (group_id, name, price_delta, is_available, sort_order)
    values (g, 'Riz (inclus)', 0, true, 10), (g, 'Pâtes (inclus)', 0, true, 20);
  end if;

  select count(*) into n from products where restaurant_id = r and is_featured;
  if n <> 6 then raise exception 'controle final : % plats a l''affiche', n; end if;
end $$;
