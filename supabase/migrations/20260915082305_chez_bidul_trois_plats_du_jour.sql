-- Chez Bidul & Truc : trois plats du jour à l'affiche (demande du porteur du projet, 2026-09-15).
--
-- Créations « À l'affiche » : SANS catégorie et hors carte permanente
-- (`in_menu = false`), exactement ce que produit `save_featured_product` quand le
-- partenaire crée un plat du jour depuis Réglages. Conséquences voulues :
--   * ils n'apparaissent QUE dans le bandeau « Offre du jour » de la fiche
--     restaurant (`getMenu` → `featured`), jamais dans Entrée / Plat ;
--   * aucune plage horaire ne s'applique (pas de catégorie) : commandables dès
--     que le restaurant est ouvert, midi et soir ;
--   * le partenaire peut les retirer ou les modifier seul (« À l'affiche »), et
--     les remettre plus tard depuis sa bibliothèque.
--
-- Photos : en cours de génération au moment de la migration → `photo_url` null
-- (l'app affiche les initiales). À renseigner dès que les visuels sont prêts.
--
-- Idempotent : ne recrée pas un plat du même nom déjà présent chez ce restaurant.
insert into public.products
  (restaurant_id, category_id, name, description, price, photo_url,
   is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
select '700e8f32-e966-476a-b371-02884d08dea1', null, v.name, null, 30000, null,
       true, null, true, 'Plat du jour', false, v.ord
from (values ('Poulet basquaise', 1), ('Blanquette de poisson', 2), ('Tartare de zébu', 3)) as v(name, ord)
where not exists (
  select 1 from public.products p
  where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
    and lower(p.name) = lower(v.name)
    and not p.is_archived
);
