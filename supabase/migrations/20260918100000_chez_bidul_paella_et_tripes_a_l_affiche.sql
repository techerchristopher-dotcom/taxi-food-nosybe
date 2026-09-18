-- Chez Bidul & Truc : la paella et les tripes à la mode de Caen passent à l'affiche,
-- le pot-au-feu et le boudin noir rentrent en bibliothèque (2026-09-18).
--
-- Même découpage que les deux fournées précédentes (20260915082305, 20260916150000) : les plats
-- qui sortent de l'affiche ne sont PAS archivés (`is_featured = false`, `is_archived = false`,
-- photo intacte), ils dorment dans la bibliothèque du restaurateur et reviennent en un tap depuis
-- Réglages. Un plat archivé, lui, sort de la bibliothèque (`getFeaturedLibrary` filtre
-- `is_archived = false`) : c'est exactement ce qu'il ne faut pas faire.
--
-- Mêmes valeurs que les précédents, pour les mêmes raisons :
--   * `category_id` null et `in_menu = false` : ils ne vivent que dans le bandeau « Offre du jour » ;
--   * pas de catégorie, donc AUCUNE plage horaire : commandables dès que le restaurant est ouvert.
--
-- PRIX : 30 000 Ar, le tarif habituel des plats du jour de Chez Bidul & Truc (porteur du projet,
-- 2026-09-18 : « au même tarif que d'hab »).
--
-- `sort_order` 6 et 7 : le bandeau suit `sort_order` (getMenu trie sur sort_order puis name).
--
-- Idempotent : ne recrée pas un plat du même nom déjà présent et non archivé.
insert into public.products
  (restaurant_id, category_id, name, description, price, photo_url,
   is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
select '700e8f32-e966-476a-b371-02884d08dea1', null, v.name, null, 30000, null,
       true, null, true, 'Plat du jour', false, v.ord
from (values ('Paella', 6), ('Tripes à la mode de Caen', 7)) as v(name, ord)
where not exists (
  select 1 from public.products p
  where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
    and lower(p.name) = lower(v.name)
    and not p.is_archived
);

-- Les deux plats du jour de la veille quittent l'affiche sans rien perdre.
update public.products
   set is_featured = false
 where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and name in ('Pot-au-feu', 'Boudin noir façon hachis')
   and is_featured
   and not is_archived;
