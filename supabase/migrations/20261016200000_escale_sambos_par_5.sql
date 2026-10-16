-- 20261016200000_escale_sambos_par_5.sql
--
-- L'escale Créole : les sambos zébu / poulet se vendent PAR LOT DE 5, avec UN
-- emballage (1 000 Ar) pour le lot. Demande du porteur du projet après TF-416
-- (Opaline, 6 sambos = 6 000 Ar d'emballage pour 12 000 Ar de sambos).
--
-- On crée un NOUVEAU produit et on archive l'ancien, au lieu de changer le prix
-- de l'ancien : un panier persisté contenant « 6 × Sambos » à 2 000 Ar serait
-- sinon facturé 6 lots (60 000 Ar) par create_order, qui relit le prix en base.
-- Avec un nouvel identifiant, ce panier est refusé (produit indisponible).

do $$
declare
  v_ancien uuid := '1cb10c38-271d-47f6-8a4d-3cacd59ac6c3';
  v_resto  uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_old    public.products;
  v_new    uuid;
  v_grp    uuid;
begin
  select * into v_old from public.products where id = v_ancien and restaurant_id = v_resto;
  if v_old.id is null then raise exception 'Sambos zébu ou poulet introuvable'; end if;
  if exists (select 1 from public.products where restaurant_id = v_resto and name = 'Sambos zébu ou poulet (lot de 5)') then
    raise notice 'deja fait'; return;
  end if;

  insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
      is_available, in_menu, diet_tags, packaging_fee, packaging_label, sort_order)
  values (v_resto, v_old.category_id, 'Sambos zébu ou poulet (lot de 5)',
      'Vendus par 5. ' || v_old.description, 10000, v_old.photo_url,
      true, true, v_old.diet_tags, 1000, 'Emballage à emporter', v_old.sort_order)
  returning id into v_new;

  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
  values (v_new, 'Choix (1 au choix)', 1, 1, true, 0) returning id into v_grp;
  insert into public.product_options (group_id, name, price_delta, sort_order) values
    (v_grp, 'Zébu', 0, 0), (v_grp, 'Poulet', 0, 1);

  update public.products set is_available = false, in_menu = false, is_archived = true where id = v_ancien;

  if (select count(*) from public.products where restaurant_id = v_resto and name ilike 'Sambos zébu%' and not is_archived) <> 1 then
    raise exception 'garde : un seul produit sambos zébu/poulet actif attendu';
  end if;
end $$;
