-- Le Nandipo : le Rougail saucisse revient sur sa carte, le Zébu bourguignon devient un plat du
-- jour à part entière (hors carte) — 2026-10-10, décision du porteur du projet.
--
-- La ligne 036c85c1 est RENDUE au rougail, plutôt que de recréer un rougail neuf : c'est elle
-- qui porte l'histoire du plat — la commande TF-371, donc l'avis de Jenn (5/5/5) et sa photo,
-- et la publication Facebook de cet avis. Tant qu'elle s'appelait « Zebu bourguignon », la fiche
-- du bourguignon affichait l'avis d'une cliente sur le rougail.
-- Le bourguignon reçoit une ligne NEUVE, telle que save_featured_product l'aurait créée par
-- « Ajouter un plat à l'affiche » : sans catégorie, in_menu = false, avec la photo, la
-- description et le prix saisis par le patron.
do $$
declare
  v_resto constant uuid := 'cb7fda65-3ed0-41aa-940c-b8974f7363c8';
  v_ligne constant uuid := '036c85c1-ea09-4c72-800c-b80fc95e849f';
  v_b public.products;
  n int;
begin
  select * into v_b from public.products
   where id = v_ligne and restaurant_id = v_resto and name = 'Zebu bourguignon' and not is_archived;
  if v_b.id is null then raise exception 'ligne 036c85c1 : plus « Zebu bourguignon », rien fait'; end if;

  -- 1. Le bourguignon, plat du jour hors carte.
  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, stock_quantity, is_featured, featured_label, in_menu, diet_tags)
  values
    (v_resto, null, v_b.name, v_b.description, v_b.price, v_b.photo_url,
     true, v_b.stock_quantity, true, 'Plat du jour', false, '{}');

  -- 2. Le rougail, de retour sur la carte (« Côté terre », rang 80), tel qu'avant le 2026-10-09.
  update public.products
     set name = 'Rougail saucisse',
         description = 'Saucisse de porc, sauce tomate épicée, accompagnement au choix.',
         price = 30000,
         photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/rougail-saucisse-ia.jpg',
         vraie_photo_url = null,
         diet_tags = array['porc'],
         stock_quantity = null,
         is_featured = false,
         featured_label = null,
         is_available = true,
         in_menu = true
   where id = v_ligne;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'rougail : % ligne(s)', n; end if;
end $$;
