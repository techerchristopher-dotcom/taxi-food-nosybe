-- Chez Bidul & Truc : « Boudin noir façon hachis » (30 000 Ar) passe à l'affiche,
-- demande du 26/09/2026.
--
-- Le produit existait déjà dans la bibliothèque des plats du jour du restaurant
-- (`in_menu = false`, `featured_label = 'Plat du jour'`, photo déjà déposée) : il n'y
-- avait rien à créer, seulement à l'allumer. Même effet que
-- `set_product_featured(id, true, 'Plat du jour')`, dont l'appel RPC exige une session
-- restaurateur que MCP n'a pas.
--
-- Pour le retirer de l'affiche : `is_featured = false` (le libellé est conservé pour
-- la prochaine fois, c'est le comportement de `set_product_featured`).
update public.products
   set is_featured = true,
       featured_label = 'Plat du jour'
 where id = 'bedaf488-a5bf-4f5c-8b5d-2a1fc50b84b0'
   and restaurant_id = (select id from public.restaurants where name = 'Chez Bidul & Truc')
   and is_archived = false;
