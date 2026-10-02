-- Livraison moins chère (décision du porteur du projet, 2026-10-02) :
-- 2 000 Ar jusqu'à 3 km de ROUTE, puis 1 000 Ar par km entamé. Avant : 10 000 Ar jusqu'à 3 km
-- (5 km chez La Plage). Tous les restaurants, La Plage comprise ; même formule qu'avant
-- (frais_livraison_detail : vol d'oiseau × livraison_coef_route, ceil du dépassement) —
-- AUCUNE fonction n'est modifiée, seules les valeurs.
--
-- En production, les valeurs ont été posées par admin_set_tarif_livraison (une trace par
-- restaurant dans admin_actions). Ce fichier les rejoue pour que le dépôt dise la même chose.
--
-- Conséquences voulues ou acceptées :
-- - TAXIFOOD50 (−50 % sur la livraison) : 2 000 → 1 000 Ar sur une course courte.
-- - Code de remerciement AVIS<PRENOM> (2 000 Ar sur la livraison, inchangé, décision du porteur
--   du projet) : rend désormais la livraison GRATUITE sous 3 km (remise plafonnée à la livraison).
-- - Les livreurs sont salariés : la baisse sort entièrement de la marge Taxi Food.
update public.restaurants
   set delivery_fee = 2000, livraison_km_inclus = 3, livraison_prix_par_km = 1000, livraison_coef_route = 1.3;

alter table public.restaurants alter column delivery_fee set default 2000;
