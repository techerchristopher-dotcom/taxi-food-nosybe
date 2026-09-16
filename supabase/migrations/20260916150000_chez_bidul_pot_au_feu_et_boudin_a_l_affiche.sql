-- Chez Bidul & Truc : le pot-au-feu et le boudin noir façon hachis passent à l'affiche
-- (demande du porteur du projet, 2026-09-16).
--
-- POURQUOI UNE NOUVELLE MIGRATION ET PAS UNE RÉÉCRITURE. Les trois plats du jour du
-- 15 septembre (poulet basquaise, blanquette de poisson, tartare de zébu) ne sont PAS
-- remplacés : ils dorment dans la bibliothèque du restaurateur (`is_featured = false`,
-- `is_archived = false`, photo intacte), pour revenir en un tap depuis Réglages. Les
-- toucher ici serait risquer de les archiver — et un plat archivé sort de la bibliothèque
-- (`getFeaturedLibrary` filtre `is_archived = false`), c'est-à-dire exactement ce que le
-- porteur du projet veut éviter. Cette migration n'AJOUTE que les deux nouveaux.
--
-- Mêmes valeurs que les trois précédents (20260915082305), pour les mêmes raisons :
--   * `category_id` null et `in_menu = false` : ils ne vivent que dans le bandeau
--     « Offre du jour », jamais dans Entrée ni Plat ;
--   * pas de catégorie, donc AUCUNE plage horaire : commandables dès que le restaurant
--     est ouvert, midi et soir. Une catégorie leur imposerait ses horaires, et un plat du
--     jour deviendrait indisponible le soir sans que personne comprenne pourquoi.
--
-- `sort_order` 4 et 5 : le bandeau suit `sort_order` (getMenu trie tous les produits sur
-- sort_order puis name, et le bandeau garde cet ordre) — ce n'est pas une valeur décorative.
--
-- PRIX : 30 000 Ar, confirmé par le porteur du projet le 2026-09-16 pour les deux plats.
--
-- Insérés directement, et non par `save_featured_product` : cette fonction exige la
-- session du restaurateur (`current_restaurant_id()`), qu'une migration n'a pas. Le
-- résultat est identique à ce qu'elle produit, comme pour les trois précédents.
--
-- Idempotent : ne recrée pas un plat du même nom déjà présent et non archivé.
insert into public.products
  (restaurant_id, category_id, name, description, price, photo_url,
   is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
select '700e8f32-e966-476a-b371-02884d08dea1', null, v.name, null, 30000, null,
       true, null, true, 'Plat du jour', false, v.ord
from (values ('Pot-au-feu', 4), ('Boudin noir façon hachis', 5)) as v(name, ord)
where not exists (
  select 1 from public.products p
  where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
    and lower(p.name) = lower(v.name)
    and not p.is_archived
);
