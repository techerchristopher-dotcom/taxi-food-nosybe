-- L'escale Créole : les GRAINS (haricots blancs cuits) font partie de chaque plat — cochés d'office,
-- refusables — ; saucisse frite ; poisson frit à 35 000 Ar avec sa vraie photo ; ingrédients en
-- pastilles sur tous les plats (2026-10-08, demande du porteur du projet).
--
-- - `product_options.par_defaut` (NOUVEAU, tous restaurants) : option cochée d'office à l'ouverture
--   de la fiche, décochable. L'app (fiche plat) pré-remplit ; une version de l'app sans ce code
--   affiche simplement le choix à faire.
-- - Grains = groupe OBLIGATOIRE « Avec grains (inclus) » (par défaut) / « Sans grains » : le ticket
--   de la cuisine dit TOUJOURS l'un ou l'autre. Une simple case à décocher n'aurait rien imprimé
--   quand le client les refuse — et la cuisine les aurait servis quand même.
-- - Le supplément « Haricots blancs » (+7 000) devient « Grains en plus » : c'est une portion EN PLUS.
-- - Descriptifs : « Servi avec du riz » → « … et des grains (haricots blancs) », traductions EN/IT
--   dérivées des existantes.
-- - Saucisse frite : saucisses de porc (badge porc), 38 000 Ar, « Plats tous les jours », photo réelle.

alter table public.product_options add column if not exists par_defaut boolean not null default false;

insert into public.ingredients (cle, emoji, nom) values ('grains', '🫘', 'Grains (haricots blancs)')
on conflict (cle) do update set emoji = excluded.emoji, nom = excluded.nom;

do $$
declare
  v_resto constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_cat uuid;
  v_id uuid;
  v_g uuid;
  v_p record;
  v_r record;
  v_new text; v_en text; v_it text; v_en_new text; v_it_new text;
begin
  select id into v_cat from public.categories where restaurant_id = v_resto and name = 'Plats tous les jours';

  -- 1. Poisson frit : prix et vraie photo.
  update public.products set price = 35000,
         photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/pj-poisson-frit-photo.jpg'
   where restaurant_id = v_resto and name = 'Poisson frit entier' and not is_archived;

  -- 2. Saucisse frite (nouveau plat).
  if not exists (select 1 from public.products where restaurant_id = v_resto and name = 'Saucisse frite' and not is_archived) then
    insert into public.products (restaurant_id, category_id, name, description, price, photo_url, is_available, in_menu,
                                 sort_order, diet_tags, packaging_fee, packaging_label)
    values (v_resto, v_cat, 'Saucisse frite', 'Saucisses de porc, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont dorées à la poêle jusqu''à être croustillantes dehors et fondantes dedans. Servi avec du riz et des grains (haricots blancs).', 38000,
            'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/pj-saucisse-frite.jpg',
            true, true, 15, array['porc'], 1000, 'Emballage à emporter')
    returning id into v_id;
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (v_id, 'Piment', 1, 1, true, 10) returning id into v_g;
    insert into public.product_options (group_id, name, price_delta, sort_order, is_available)
    values (v_g, 'Avec piment (offert)', 0, 1, true), (v_g, 'Sans piment', 0, 2, true);
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (v_id, 'Supplément', 0, 3, false, 20) returning id into v_g;
    insert into public.product_options (group_id, name, price_delta, sort_order, is_available)
    values (v_g, 'Frites', 10000, 1, true), (v_g, 'Riz supplémentaire', 7000, 2, true), (v_g, 'Grains en plus', 7000, 3, true);
  end if;

  -- 3. Descriptifs : les grains, et leurs traductions dérivées des existantes.
  create temp table _regles (fr_old text, fr_new text, en_old text, en_new text, it_old text, it_new text, rang int) on commit drop;
  insert into _regles values
    ('Servi avec du riz et une pointe de piment (ou pas, selon ton choix).', 'Servi avec du riz, des grains (haricots blancs) et une pointe de piment (ou pas, selon ton choix).', 'Served with rice and a touch of chili (or not, your choice).', 'Served with rice, grains (stewed white beans) and a touch of chili (or not, your choice).', 'Servito con riso e un pizzico di peperoncino (o no, a tua scelta).', 'Servito con riso, legumi (fagioli bianchi) e un pizzico di peperoncino (o no, a tua scelta).', 0),
    ('Servi en tranches avec sa sauce et du riz.', 'Servi en tranches avec sa sauce, du riz et des grains (haricots blancs).', 'Served sliced with its sauce and rice.', 'Served sliced with its sauce, rice and grains (stewed white beans).', 'Servito a fette con il suo sugo e riso.', 'Servito a fette con il suo sugo, riso e legumi (fagioli bianchi).', 1),
    ('Servi avec du riz.', 'Servi avec du riz et des grains (haricots blancs).', 'Served with rice.', 'Served with rice and grains (stewed white beans).', 'Servito con riso.', 'Servito con riso e legumi (fagioli bianchi).', 2);

  for v_p in
    select id, description from public.products
     where restaurant_id = v_resto and not is_archived and description not like '%grains (haricots blancs)%'
       and (category_id = v_cat or name in ('Massalé cabri', 'Rôti porc à la créole', 'Poisson frit entier', 'Sauté porc aux gros piments'))
  loop
    select en.texte, it.texte into v_en, v_it
      from (select 1) x
      left join public.traductions_catalogue en on en.fr = v_p.description and en.langue = 'en'
      left join public.traductions_catalogue it on it.fr = v_p.description and it.langue = 'it';
    select * into v_r from _regles where position(fr_old in v_p.description) > 0 order by rang limit 1;
    if found then
      v_new := replace(v_p.description, v_r.fr_old, v_r.fr_new);
      v_en_new := replace(v_en, v_r.en_old, v_r.en_new);
      v_it_new := replace(v_it, v_r.it_old, v_r.it_new);
    else
      v_new := v_p.description || ' Servi avec des grains (haricots blancs).';
      v_en_new := v_en || ' Served with grains (stewed white beans).';
      v_it_new := v_it || ' Servito con legumi (fagioli bianchi).';
    end if;
    update public.products set description = v_new where id = v_p.id;
    if v_en_new is not null then
      insert into public.traductions_catalogue (fr, langue, texte, source) values (v_new, 'en', v_en_new, 'manuel') on conflict (fr, langue) do nothing;
    end if;
    if v_it_new is not null then
      insert into public.traductions_catalogue (fr, langue, texte, source) values (v_new, 'it', v_it_new, 'manuel') on conflict (fr, langue) do nothing;
    end if;
  end loop;

  -- 4. Grains sur chaque plat : « Avec grains (inclus) » coché d'office, ou « Sans grains ».
  for v_p in
    select id from public.products
     where restaurant_id = v_resto and not is_archived
       and (category_id = v_cat or name in ('Massalé cabri', 'Rôti porc à la créole', 'Poisson frit entier', 'Sauté porc aux gros piments'))
  loop
    if not exists (select 1 from public.product_option_groups where product_id = v_p.id and name = 'Grains (haricots blancs)') then
      insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
      values (v_p.id, 'Grains (haricots blancs)', 1, 1, true, 12) returning id into v_g;
      insert into public.product_options (group_id, name, price_delta, sort_order, is_available, par_defaut)
      values (v_g, 'Avec grains (inclus)', 0, 1, true, true), (v_g, 'Sans grains', 0, 2, true, false);
    end if;
  end loop;

  -- 5. Le supplément « Haricots blancs » est une portion EN PLUS.
  update public.product_options o set name = 'Grains en plus'
    from public.product_option_groups g join public.products p on p.id = g.product_id
   where o.group_id = g.id and g.name = 'Supplément' and o.name = 'Haricots blancs' and p.restaurant_id = v_resto;

  -- 6. Ingrédients en pastilles (remplace ceux déjà posés, rougail compris).
  create temp table _ing (plat text, cle text, au_choix boolean, rang int) on commit drop;
  insert into _ing values
    ('Massalé cabri', 'cabri', false, 1),
    ('Massalé cabri', 'massale', false, 2),
    ('Massalé cabri', 'oignon', false, 3),
    ('Massalé cabri', 'gingembre', false, 4),
    ('Massalé cabri', 'grains', true, 5),
    ('Massalé cabri', 'piment', true, 6),
    ('Rôti porc à la créole', 'porc', false, 1),
    ('Rôti porc à la créole', 'ail', false, 2),
    ('Rôti porc à la créole', 'gingembre', false, 3),
    ('Rôti porc à la créole', 'thym', false, 4),
    ('Rôti porc à la créole', 'grains', true, 5),
    ('Rôti porc à la créole', 'piment', true, 6),
    ('Sauté porc aux gros piments', 'porc', false, 1),
    ('Sauté porc aux gros piments', 'gros_piment', false, 2),
    ('Sauté porc aux gros piments', 'oignon', false, 3),
    ('Sauté porc aux gros piments', 'gingembre', false, 4),
    ('Sauté porc aux gros piments', 'grains', true, 5),
    ('Poisson frit entier', 'poisson', false, 1),
    ('Poisson frit entier', 'citron', false, 2),
    ('Poisson frit entier', 'ail', false, 3),
    ('Poisson frit entier', 'grains', true, 4),
    ('Poisson frit entier', 'piment', true, 5),
    ('Rougail saucisses', 'saucisse_porc', false, 1),
    ('Rougail saucisses', 'tomate', false, 2),
    ('Rougail saucisses', 'oignon', false, 3),
    ('Rougail saucisses', 'gingembre', false, 4),
    ('Rougail saucisses', 'grains', true, 5),
    ('Rougail saucisses', 'piment', true, 6),
    ('Saucisse frite', 'saucisse_porc', false, 1),
    ('Saucisse frite', 'riz', false, 2),
    ('Saucisse frite', 'grains', true, 3),
    ('Saucisse frite', 'piment', true, 4),
    ('Bol renversé poulet ou zébu', 'poulet', true, 1),
    ('Bol renversé poulet ou zébu', 'zebu', true, 2),
    ('Bol renversé poulet ou zébu', 'oeuf', false, 3),
    ('Bol renversé poulet ou zébu', 'legumes', false, 4),
    ('Bol renversé poulet ou zébu', 'riz', false, 5),
    ('Bol renversé poulet ou zébu', 'grains', true, 6),
    ('Riz frit poulet ou zébu', 'riz', false, 1),
    ('Riz frit poulet ou zébu', 'poulet', true, 2),
    ('Riz frit poulet ou zébu', 'zebu', true, 3),
    ('Riz frit poulet ou zébu', 'oeuf', false, 4),
    ('Riz frit poulet ou zébu', 'sauce_soja', false, 5),
    ('Riz frit poulet ou zébu', 'grains', true, 6),
    ('Bouchon porc', 'porc', false, 1),
    ('Bouchon porc', 'pate', false, 2),
    ('Bouchon porc', 'sauce_soja', false, 3),
    ('Sambos zébu ou poulet', 'zebu', true, 1),
    ('Sambos zébu ou poulet', 'poulet', true, 2),
    ('Sambos zébu ou poulet', 'oignon', false, 3),
    ('Sambos zébu ou poulet', 'ail', false, 4),
    ('Sambos fromage', 'fromage', false, 1),
    ('Sambos fromage', 'pate', false, 2),
    ('Demi-lune poulet', 'poulet', false, 1),
    ('Demi-lune poulet', 'oignon', false, 2),
    ('Demi-lune poulet', 'ail', false, 3),
    ('Soupe chinoise', 'bouillon', false, 1),
    ('Soupe chinoise', 'nouilles', false, 2),
    ('Soupe chinoise', 'gingembre', false, 3),
    ('Soupe chinoise', 'oeuf', false, 4),
    ('Soupe chinoise', 'legumes', false, 5),
    ('Assiette de crudité', 'carotte', false, 1),
    ('Assiette de crudité', 'chou', false, 2),
    ('Assiette de crudité', 'tomate', false, 3),
    ('Assiette de crudité', 'concombre', false, 4),
    ('Assiette de crudité', 'salade', false, 5),
    ('Beignets crevettes ou calamars', 'crevette', true, 1),
    ('Beignets crevettes ou calamars', 'calamar', true, 2),
    ('Émincé de poulet au brède chinois', 'poulet', false, 1),
    ('Émincé de poulet au brède chinois', 'brede', false, 2),
    ('Émincé de poulet au brède chinois', 'ail', false, 3),
    ('Émincé de poulet au brède chinois', 'grains', true, 4),
    ('Émincé de zébu au brède chinois', 'zebu', false, 1),
    ('Émincé de zébu au brède chinois', 'brede', false, 2),
    ('Émincé de zébu au brède chinois', 'ail', false, 3),
    ('Émincé de zébu au brède chinois', 'grains', true, 4),
    ('Émincé de poulet au poivre vert', 'poulet', false, 1),
    ('Émincé de poulet au poivre vert', 'poivre_vert', false, 2),
    ('Émincé de poulet au poivre vert', 'creme', false, 3),
    ('Émincé de poulet au poivre vert', 'grains', true, 4),
    ('Émincé de zébu au poivre vert', 'zebu', false, 1),
    ('Émincé de zébu au poivre vert', 'poivre_vert', false, 2),
    ('Émincé de zébu au poivre vert', 'creme', false, 3),
    ('Émincé de zébu au poivre vert', 'grains', true, 4),
    ('Émincé de poulet aux oignons', 'poulet', false, 1),
    ('Émincé de poulet aux oignons', 'oignon', false, 2),
    ('Émincé de poulet aux oignons', 'ail', false, 3),
    ('Émincé de poulet aux oignons', 'grains', true, 4),
    ('Émincé de zébu aux oignons', 'zebu', false, 1),
    ('Émincé de zébu aux oignons', 'oignon', false, 2),
    ('Émincé de zébu aux oignons', 'ail', false, 3),
    ('Émincé de zébu aux oignons', 'grains', true, 4),
    ('Émincé de poulet au gingembre', 'poulet', false, 1),
    ('Émincé de poulet au gingembre', 'gingembre', false, 2),
    ('Émincé de poulet au gingembre', 'ail', false, 3),
    ('Émincé de poulet au gingembre', 'grains', true, 4),
    ('Émincé de zébu au gingembre', 'zebu', false, 1),
    ('Émincé de zébu au gingembre', 'gingembre', false, 2),
    ('Émincé de zébu au gingembre', 'ail', false, 3),
    ('Émincé de zébu au gingembre', 'grains', true, 4);
  delete from public.product_ingredients pi using public.products p
   where pi.product_id = p.id and p.restaurant_id = v_resto;
  insert into public.product_ingredients (product_id, ingredient_cle, au_choix, sort_order)
  select p.id, i.cle, i.au_choix, i.rang from _ing i
    join public.products p on p.restaurant_id = v_resto and p.name = i.plat and not p.is_archived;
end $$;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Saucisse frite', 'en', 'Fried sausages', 'manuel'),
  ('Saucisse frite', 'it', 'Salsicce fritte', 'manuel'),
  ('Saucisses de porc, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont dorées à la poêle jusqu''à être croustillantes dehors et fondantes dedans. Servi avec du riz et des grains (haricots blancs).', 'en', 'Pork sausages, a touch of chili (or not, your choice)… and the chef''s secret. The sausages are pan-fried until crisp outside and juicy inside. Served with rice and grains (stewed white beans).', 'manuel'),
  ('Saucisses de porc, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont dorées à la poêle jusqu''à être croustillantes dehors et fondantes dedans. Servi avec du riz et des grains (haricots blancs).', 'it', 'Salsicce di maiale, un pizzico di peperoncino (o no, a tua scelta)… e il segreto dello chef. Le salsicce vengono dorate in padella finché sono croccanti fuori e succose dentro. Servito con riso e legumi (fagioli bianchi).', 'manuel'),
  ('Grains (haricots blancs)', 'en', 'Grains (stewed white beans)', 'manuel'),
  ('Grains (haricots blancs)', 'it', 'Legumi (fagioli bianchi)', 'manuel'),
  ('Avec grains (inclus)', 'en', 'With grains (included)', 'manuel'),
  ('Avec grains (inclus)', 'it', 'Con legumi (inclusi)', 'manuel'),
  ('Sans grains', 'en', 'No grains', 'manuel'),
  ('Sans grains', 'it', 'Senza legumi', 'manuel'),
  ('Grains en plus', 'en', 'Extra grains (white beans)', 'manuel'),
  ('Grains en plus', 'it', 'Legumi in più (fagioli bianchi)', 'manuel')
on conflict (fr, langue) do nothing;
