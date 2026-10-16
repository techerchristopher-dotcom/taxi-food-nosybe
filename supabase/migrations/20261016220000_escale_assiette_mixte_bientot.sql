-- 20261016220000_escale_assiette_mixte_bientot.sql
--
-- Retour du porteur du projet (2026-10-16, le soir même) : NE RIEN SUPPRIMER.
-- Les références de L'escale Créole restent telles quelles, et on AJOUTE une
-- « Assiette mixte à composer » (sambos, demi-lunes, bouchons…), affichée
-- « Bientôt disponible » tant que le restaurant ne l'a pas validée.
--
-- 1. Les quatre produits archivés par 20261016210000 reviennent à la carte
--    (Sambos zébu ou poulet (lot de 5), Sambos fromage, Demi-lune poulet, Bouchon porc).
-- 2. « Sambos & demi-lunes à composer » devient « Assiette mixte à composer »,
--    reçoit le bouchon porc, et passe en coming_soon (non commandable : is_available
--    = false, comme les autres plats « Bientôt »).
-- 3. Le composeur séparé « Bouchons porc » est retiré (archivé), l'assiette le couvre.
--
-- Pour l'ouvrir une fois validée : listing_status = 'visible', is_available = true.

do $$
declare
  v_resto uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_ass   uuid;
  v_grp   uuid;
  n       int;
begin
  update public.products set is_available = true, in_menu = true, is_archived = false
   where restaurant_id = v_resto
     and name in ('Sambos zébu ou poulet (lot de 5)', 'Sambos fromage', 'Demi-lune poulet', 'Bouchon porc')
     and is_archived;
  get diagnostics n = row_count;
  if n <> 4 then raise exception 'garde : 4 produits a restaurer, % trouves', n; end if;

  select id into v_ass from public.products
   where restaurant_id = v_resto and name = 'Sambos & demi-lunes à composer';
  if v_ass is null then raise exception 'composeur introuvable'; end if;

  update public.products
     set name = 'Assiette mixte à composer',
         description = 'Compose ton assiette, 5 pièces minimum, en mélangeant comme tu veux : sambos zébu, poulet ou fromage, demi-lunes au poulet, bouchons au porc. Le prix suit les pièces choisies.',
         listing_status = 'coming_soon', is_available = false, in_menu = true
   where id = v_ass;

  select id into v_grp from public.product_option_groups where product_id = v_ass;
  update public.product_option_groups set name = 'Compose ton assiette' where id = v_grp;
  insert into public.product_options (group_id, name, price_delta, sort_order)
  select v_grp, 'Bouchon porc', 3000, 4
   where not exists (select 1 from public.product_options where group_id = v_grp and name = 'Bouchon porc');

  update public.products set is_available = false, in_menu = false, is_archived = true
   where restaurant_id = v_resto and name = 'Bouchons porc' and price = 0;
end $$;
