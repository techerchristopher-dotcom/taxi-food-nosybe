-- La Plage : livraison 10 000 Ar, zone « Nosy Be », téléphone du restaurant (2026-09-17).
--
-- Valeurs données par le porteur du projet. Le téléphone est celui que le patron a saisi à son
-- inscription ; il était déjà arrivé en base au format local (0327154896), remis ici au format
-- international comme les autres restaurants. Appliquée par MCP le jour même, rapatriée ici.
update public.restaurants
   set delivery_fee = 10000,
       zone_served  = 'Nosy Be',
       phone        = '+261327154896'
 where id = 'eb10f338-fb78-4c16-82d5-810ae37b49fe';
