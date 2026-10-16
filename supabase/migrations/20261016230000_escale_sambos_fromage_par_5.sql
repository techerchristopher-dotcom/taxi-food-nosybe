-- 20261016230000_escale_sambos_fromage_par_5.sql
--
-- L'escale Créole : le sambos fromage passe en LOT DE 5 (15 000 Ar, un emballage de
-- 1 000 Ar par lot), comme les sambos zébu / poulet (20261016200000). Même méthode :
-- nouveau produit + ancien archivé, pour qu'un panier resté ouvert avec « 6 × Sambos
-- fromage » à 3 000 Ar ne soit pas facturé 6 lots.

do $$
declare
  v_resto uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_old   public.products;
begin
  if exists (select 1 from public.products where restaurant_id = v_resto and name = 'Sambos fromage (lot de 5)') then
    raise notice 'deja fait'; return;
  end if;
  select * into v_old from public.products
   where restaurant_id = v_resto and name = 'Sambos fromage' and not is_archived;
  if v_old.id is null then raise exception 'Sambos fromage introuvable'; end if;

  insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
      is_available, in_menu, diet_tags, packaging_fee, packaging_label, sort_order)
  values (v_resto, v_old.category_id, 'Sambos fromage (lot de 5)', 'Vendus par 5. ' || v_old.description,
      15000, v_old.photo_url, true, true, v_old.diet_tags, 1000, 'Emballage à emporter', v_old.sort_order);

  update public.products set is_available = false, in_menu = false, is_archived = true where id = v_old.id;
end $$;
