-- 20261016210000_options_a_composer_par_quantite.sql
--
-- PLATS « À COMPOSER » (demande du porteur du projet, 2026-10-16, après TF-416).
-- L'escale Créole vend ses sambos et demi-lunes à la pièce, mais par 5 minimum, en
-- mélangeant les garnitures (3 zébu + 2 fromage…), avec UN emballage par barquette.
--
-- 1. `product_option_groups.par_quantite` : chaque option du groupe porte une
--    QUANTITÉ, et min_select / max_select bornent la SOMME des quantités (le nombre
--    de pièces), plus le nombre d'options cochées. Faux partout ailleurs : rien ne
--    change pour les autres plats.
-- 2. create_order (patch par ancres, jamais recopiée) :
--    - la garde du groupe compte les pièces quand le groupe est à composer ;
--    - le libellé figé de l'option porte la quantité quand elle dépasse 1
--      (« 3 × Sambos zébu ») : Telegram du restaurant, e-mail, écrans et admin le
--      lisent sans aucune autre modification. Prix et emballage multipliaient déjà
--      par la quantité (`price_delta * quantity`, depuis 20260905).
-- 3. Le catalogue de L'escale Créole : deux plats à composer (sambos & demi-lune ;
--    bouchons porc à part, cuits vapeur et marqués « porc »), prix de base 0, prix
--    par pièce en option, 1 000 Ar d'emballage par barquette. Les quatre anciens
--    produits (dont le « lot de 5 » créé plus tôt ce soir) sont archivés.

alter table public.product_option_groups
  add column if not exists par_quantite boolean not null default false;

do $$
declare
  v_def text := pg_get_functiondef('public.create_order(uuid,uuid,text,jsonb,text,boolean)'::regprocedure);
  a1 constant text := E'      select count(*) into v_group_selected_count\n        from jsonb_array_elements(v_item_options) as opt';
  b1 constant text := E'      -- Groupe a composer : on compte les PIECES (somme des quantites), pas les options.\n'
                   || E'      select coalesce(sum(case when v_group.par_quantite then greatest(coalesce((opt->>''quantity'')::integer, 1), 1) else 1 end), 0)\n'
                   || E'        into v_group_selected_count\n        from jsonb_array_elements(v_item_options) as opt';
  a2 constant text := E'    select v_item_id, po.id, po.name, po.price_delta, greatest(coalesce((opt->>''quantity'')::integer, 1), 1)';
  b2 constant text := E'    select v_item_id, po.id,\n'
                   || E'           case when greatest(coalesce((opt->>''quantity'')::integer, 1), 1) > 1\n'
                   || E'                then greatest(coalesce((opt->>''quantity'')::integer, 1), 1)::text || '' × '' || po.name\n'
                   || E'                else po.name end,\n'
                   || E'           po.price_delta, greatest(coalesce((opt->>''quantity'')::integer, 1), 1)';
begin
  if position('par_quantite' in v_def) > 0 then
    raise notice 'create_order deja patchee'; return;
  end if;
  if position(a1 in v_def) = 0 then raise exception 'ancre 1 introuvable'; end if;
  if position(a2 in v_def) = 0 then raise exception 'ancre 2 introuvable'; end if;
  execute replace(replace(v_def, a1, b1), a2, b2);
end $$;

do $$
declare
  v_resto uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_cat   uuid;
  v_new   uuid;
  v_grp   uuid;
  p_lot   public.products;
  p_fro   public.products;
  p_dem   public.products;
  p_bou   public.products;
begin
  if exists (select 1 from public.products where restaurant_id = v_resto and name = 'Sambos & demi-lunes à composer') then
    raise notice 'catalogue deja fait'; return;
  end if;
  select * into p_lot from public.products where restaurant_id = v_resto and name = 'Sambos zébu ou poulet (lot de 5)';
  select * into p_fro from public.products where restaurant_id = v_resto and name = 'Sambos fromage' and not is_archived;
  select * into p_dem from public.products where restaurant_id = v_resto and name = 'Demi-lune poulet' and not is_archived;
  select * into p_bou from public.products where restaurant_id = v_resto and name = 'Bouchon porc' and not is_archived;
  if p_lot.id is null or p_fro.id is null or p_dem.id is null or p_bou.id is null then
    raise exception 'produits sources introuvables';
  end if;
  v_cat := p_lot.category_id;

  -- Sambos & demi-lunes
  insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
      is_available, in_menu, diet_tags, packaging_fee, packaging_label, sort_order)
  values (v_resto, v_cat, 'Sambos & demi-lunes à composer',
      'Compose ta barquette, 5 pièces minimum, en mélangeant comme tu veux : sambos zébu, poulet ou fromage, et demi-lunes au poulet. Pâte fine garnie… et le secret du chef, frite jusqu''à être bien dorée et croustillante.',
      0, p_lot.photo_url, true, true, '{}', 1000, 'Emballage à emporter', 30)
  returning id into v_new;
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order, par_quantite)
  values (v_new, 'Compose tes pièces', 5, 100, true, 0, true) returning id into v_grp;
  insert into public.product_options (group_id, name, price_delta, sort_order, photo_url) values
    (v_grp, 'Sambos zébu',      2000, 0, null),
    (v_grp, 'Sambos poulet',    2000, 1, null),
    (v_grp, 'Sambos fromage',   3000, 2, null),
    (v_grp, 'Demi-lune poulet', 3000, 3, null);

  -- Bouchons porc
  insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
      is_available, in_menu, diet_tags, packaging_fee, packaging_label, sort_order)
  values (v_resto, v_cat, 'Bouchons porc', '5 pièces minimum. ' || p_bou.description,
      0, p_bou.photo_url, true, true, array(select distinct unnest(p_bou.diet_tags || array['porc'])), 1000, 'Emballage à emporter', p_bou.sort_order)
  returning id into v_new;
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order, par_quantite)
  values (v_new, 'Nombre de bouchons', 5, 100, true, 0, true) returning id into v_grp;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_grp, 'Bouchon porc', 3000, 0);

  update public.products set is_available = false, in_menu = false, is_archived = true
   where id in (p_lot.id, p_fro.id, p_dem.id, p_bou.id);

  if (select count(*) from public.products where restaurant_id = v_resto and category_id = v_cat
        and not is_archived and (name ilike 'sambos%' or name ilike 'demi-lune%' or name ilike 'bouchon%')) <> 2 then
    raise exception 'garde : deux plats a composer attendus';
  end if;
end $$;
