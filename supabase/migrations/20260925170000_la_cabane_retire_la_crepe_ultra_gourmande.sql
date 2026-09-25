-- Retrait de « Crêpe Ultra Gourmande » (18 000 Ar) de la carte de La Cabane,
-- catégorie Crêpes. Demande du 25/09/2026.
--
-- ⚠️ On ARCHIVE, on ne supprime pas : le produit a déjà été commandé une fois et
-- `order_items` le référence en NO ACTION — une suppression casserait l'historique
-- de cette commande. C'est exactement ce que fait `archive_product()` quand le
-- produit a des commandes ; on reproduit ses trois écritures ici, l'appel RPC
-- exigeant une session restaurateur que MCP n'a pas.
--
-- Réversible : remettre `is_archived = false, is_available = true`.
update public.products
   set is_archived = true,
       is_available = false,
       is_featured = false
 where id = '114cd794-9462-4697-b083-62cd7ad5a856'
   and restaurant_id = '958faac6-61ab-4ff5-9226-b8adab46ed24';
