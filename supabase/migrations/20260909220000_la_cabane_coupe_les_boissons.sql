-- La Cabane coupe ses boissons : Bieres, Softs, Milkshakes.
--
-- Ils ne sont pas prets sur ces trois cartes (22 references). Le reste de leur
-- offre — Sandwichs & Repas, Burgers, Crepes — continue normalement : ce
-- restaurant est ouvert et prend des commandes, contrairement a Chez Bidul.
--
-- Trois endroits liraient ces categories, tous verifies avant d'appliquer :
--   * la carte du restaurant — filtre deja sur `is_active` (data/api.ts)
--   * « l'offre du jour » — leurs deux plats en avant sont dans Sandwichs &
--     Repas, donc aucun ne disparait sous le carrousel (le piege rencontre chez
--     Chez Bidul le meme jour)
--   * les suggestions du panier — filtrent deja sur `is_active`
--     (data/suggestions.ts), donc aucune biere ne sera proposee a l'ajout
--
-- La garde posee dans `create_order` le meme jour fait le reste : une biere
-- encore presente dans un panier ouvert avant ce changement sera refusee au
-- moment de valider, et non servie par erreur.
--
-- Pour rouvrir : repasser `is_active` a true sur les categories voulues.
update public.categories
   set is_active = false
 where restaurant_id = '958faac6-61ab-4ff5-9226-b8adab46ed24'
   and name in ('Bières', 'Softs', 'Milkshakes')
   and is_active;
