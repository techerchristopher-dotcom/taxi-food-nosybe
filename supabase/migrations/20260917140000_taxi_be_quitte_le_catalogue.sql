-- Taxi Be quitte le catalogue (decision du porteur du projet, 2026-09-17).
--
-- `hidden` et pas une suppression :
--   * aucune donnee n'est effacee — carte, photos, categories restent en base ;
--   * `listRestaurants` (app) et `partenaires.js` (vitrine) filtrent deja
--     `listing_status <> 'hidden'`, la recherche de l'accueil travaille sur
--     cette liste, les selections exigent `visible` ;
--   * `commandable_maintenant()` exige `visible` : `create_order` refuse, la
--     garde est en base, pas a l'ecran.
--
-- ⚠️ Le compte de demonstration Apple `demo.resto@taxifood.mg` RESTE rattache a
-- Taxi Be (`restaurant_staff`). L'espace restaurant lit son restaurant par
-- `current_restaurant_id()` / `getMyRestaurant`, sans filtre de statut : le
-- relecteur garde un espace restaurant fonctionnel, sur un restaurant qu'aucun
-- client ne voit ni ne peut commander. Voir docs/FICHE-APP-STORE.md § 4.
--
-- Etat verifie avant : 0 commande chez Taxi Be, aucun canal Telegram.

update public.restaurants
   set listing_status = 'hidden'
 where id = 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886';
