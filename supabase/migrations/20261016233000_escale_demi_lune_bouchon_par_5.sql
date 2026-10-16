-- 20261016233000_escale_demi_lune_bouchon_par_5.sql
--
-- L'escale Créole : demi-lune poulet et bouchon porc passent en LOT DE 5 (15 000 Ar,
-- un emballage de 1 000 Ar par lot), comme les sambos (20261016200000, 20261016230000).
-- Nouveau produit + ancien archivé (un panier resté ouvert ne sera pas facturé N lots).
-- Les repères alimentaires (diet_tags, « porc ») sont recopiés.

do $$
declare
  v_resto uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_old   public.products;
  v_nom   text;
begin
  foreach v_nom in array array['Demi-lune poulet', 'Bouchon porc'] loop
    if exists (select 1 from public.products where restaurant_id = v_resto and name = v_nom || ' (lot de 5)') then
      continue;
    end if;
    select * into v_old from public.products
     where restaurant_id = v_resto and name = v_nom and not is_archived;
    if v_old.id is null then raise exception '% introuvable', v_nom; end if;

    insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
        is_available, in_menu, diet_tags, packaging_fee, packaging_label, sort_order)
    values (v_resto, v_old.category_id, v_nom || ' (lot de 5)', 'Vendus par 5. ' || v_old.description,
        v_old.price * 5, v_old.photo_url, true, true, v_old.diet_tags, 1000, 'Emballage à emporter', v_old.sort_order);

    update public.products set is_available = false, in_menu = false, is_archived = true where id = v_old.id;
  end loop;
end $$;
