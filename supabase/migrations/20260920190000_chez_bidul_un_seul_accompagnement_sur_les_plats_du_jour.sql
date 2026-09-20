-- Chez Bidul & Truc : un seul accompagnement sur les plats du jour (2026-09-20).
--
-- POURQUOI. Décision du porteur du projet ce soir : « 1 seul accompagnement ». Le groupe
-- facultatif « 2e accompagnement (+5 000 Ar) » disparaît donc des PLATS DU JOUR. L'accompagnement
-- inclus, lui, ne bouge pas : le client choisit toujours entre frites, légumes sautés, pâtes, riz
-- et purée, dans le prix du plat.
--
-- PÉRIMÈTRE VOLONTAIREMENT ÉTROIT. Le même groupe existe sur 15 plats de la CARTE PERMANENTE
-- (cordon bleu, filet de zébu, marmite du pêcheur…) : ceux-là ne sont pas touchés. La demande
-- portait sur les plats du jour, et une carte qu'on modifie plus largement qu'annoncé est une
-- surprise pour le restaurateur.
--
-- AUCUNE COMMANDE N'EST CONCERNÉE : `order_item_options` ne référence aucune option de ces
-- groupes (vérifié avant application). La suppression des options suit par cascade.
--
-- Idempotent par nature : rejouer ne trouve plus rien à supprimer.
delete from public.product_option_groups g
 using public.products p
 where g.product_id = p.id
   and p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and p.featured_label = 'Plat du jour'
   and not p.is_archived
   and g.name like '2e accompagnement%';
