-- Taxi Be est a Ambatoloaka, pas a Hell-Ville.
-- Corrige le 2026-09-05 sur signalement du porteur du projet : la zone affichee
-- sur la vitrine et dans l'app envoyait les clients au mauvais endroit.
update public.restaurants set zone_served = 'Ambatoloaka' where name = 'Taxi Be';
