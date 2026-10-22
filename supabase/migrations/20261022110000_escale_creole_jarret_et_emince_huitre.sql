-- L'escale Créole, tableau du 2026-10-22 : deux nouveaux plats du jour, créés « À l'affiche »
-- (in_menu = false, sans catégorie, comme les autres plats du jour), 38 000 Ar chacun.
-- Choix recopiés du « Rôti porc à la créole » : riz ou pâtes, piment, grains, suppléments
-- (frites 10 000, riz 6 000, grains 6 000). Photos validées par le porteur du projet,
-- déposées par deposer-visuel dans produits/escale-creole/.
do $$
declare
  r   constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  ref constant uuid := '1523cece-4950-4709-a94d-9e2d1e096467'; -- Rôti porc à la créole
  base constant text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/';
  p uuid; g record; ng uuid; n int; plat record;
begin
  for plat in
    select * from (values
      ('Jarret de porc braisé',
       'Jarret de porc, ail, gingembre, oignons, thym… et le secret du chef. Le jarret est saisi puis braisé longuement à couvert, jusqu''à ce que la viande se détache de l''os, et servi nappé de sa sauce réduite. Servi avec du riz ou des pâtes, et des grains (haricots blancs).',
       'pj-jarret-porc-braise.jpg', array['porc']::text[], 60),
      ('Émincé de poulet sauce huître',
       'Fines lamelles de poulet, sauce huître, oignons, cébette… et le secret du chef. La viande est saisie à feu vif puis laquée dans une sauce à l''huître brillante. Servi avec du riz ou des pâtes, et des grains (haricots blancs).',
       'pj-emince-poulet-huitre.jpg', array[]::text[], 65)
    ) as t(nom, descr, photo, tags, ordre)
  loop
    if exists (select 1 from products where restaurant_id = r and name = plat.nom) then
      raise exception 'deja en base : %', plat.nom;
    end if;
    insert into products (restaurant_id, category_id, name, description, price, photo_url,
                          is_available, in_menu, is_featured, is_archived, sort_order, diet_tags)
    values (r, null, plat.nom, plat.descr, 38000, base || plat.photo,
            true, false, true, false, plat.ordre, plat.tags)
    returning id into p;

    for g in select * from product_option_groups where product_id = ref order by sort_order loop
      insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
      values (p, g.name, g.min_select, g.max_select, g.required, g.sort_order) returning id into ng;
      insert into product_options (group_id, name, price_delta, is_available, sort_order)
      select ng, name, price_delta, is_available, sort_order from product_options where group_id = g.id;
    end loop;

    select count(*) into n from product_option_groups where product_id = p;
    if n <> 4 then raise exception '% : % groupes au lieu de 4', plat.nom, n; end if;
  end loop;

  select count(*) into n from products where restaurant_id = r and is_featured;
  if n <> 8 then raise exception 'controle final : % plats a l''affiche (8 attendus)', n; end if;
end $$;
