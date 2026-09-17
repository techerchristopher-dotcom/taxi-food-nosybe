-- La Plage : commission de 7 %, décidée par le porteur du projet le 2026-09-17.
--
-- Appliquée par MCP le jour même (le restaurant était déjà `visible`), rapatriée ici pour que
-- le dépôt ne diverge pas de la base. Aucune commande existante chez La Plage à ce moment-là :
-- rien à recalculer.
update public.restaurants
   set commission_rate = 0.07
 where id = 'eb10f338-fb78-4c16-82d5-810ae37b49fe';
