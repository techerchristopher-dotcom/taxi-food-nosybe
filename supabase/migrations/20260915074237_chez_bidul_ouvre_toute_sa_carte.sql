-- Chez Bidul & Truc ouvre toute sa carte.
--
-- Le 2026-09-09 (migration 20260909210000), le restaurant ne lançait que la
-- pizza : six catégories coupées (Entrée, Plat, Pâtes, Tapas, Hamburger,
-- Dessert — 48 plats). Le porteur du projet confirme le 2026-09-15 que le reste
-- de la carte est prêt : on rouvre tout.
--
-- Ce que la réouverture NE touche PAS, volontairement :
--   * la plage horaire de « Pizza » (18:00 → 22:00) : son four ne tourne
--     toujours pas avant 18 h. Les catégories rouvertes n'ont aucune plage, donc
--     elles sont servies dès que le restaurant est ouvert, midi et soir ;
--   * `is_featured` : les deux plats retirés de « l'offre du jour » le 09/09
--     (Œuf mimosa, Salade de fruit) ne sont pas remis d'office — choix à faire
--     par le porteur du projet ;
--   * la garde `is_active` dans `create_order` : elle reste, elle sert à la
--     prochaine coupe.

-- 1. Rouvrir les six catégories (cadré par restaurant ; Pizza, Bières et Softs
--    sont déjà actives et ne bougent pas).
update public.categories
   set is_active = true
 where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and name in ('Entrée', 'Plat', 'Pâtes', 'Tapas', 'Hamburger', 'Dessert')
   and not is_active;

-- 2. Les étiquettes d'accueil suivent la carte rouverte.
--
-- ⚠️ Rien ne synchronise `food_types` avec `categories.is_active` (piège noté le
-- 09/09) : on le refait à la main. Seules les valeurs connues de
-- `FOOD_TYPE_ORDER` (app/data/types.ts) produisent un filtre ; ordre repris de
-- cette liste. « Hamburger » s'annonce « Burger », comme chez La Cabane et
-- Les Siciliens. Entrée / Plat / Dessert n'ont pas de type d'accueil.
-- `cuisine_type` (« Restaurant, bar & tapas ») redevient exact : inchangé.
update public.restaurants
   set food_types = array['Pizza', 'Pâtes', 'Burger', 'Tapas']
 where id = '700e8f32-e966-476a-b371-02884d08dea1';
