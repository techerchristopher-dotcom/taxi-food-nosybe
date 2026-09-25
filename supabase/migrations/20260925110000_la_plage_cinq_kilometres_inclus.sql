-- La Plage : 5 km inclus dans les 10 000 Ar, au lieu de 3 (2026-09-25).
--
-- POURQUOI. La Plage est à Hell-Ville, à 7–10 km de route de la zone touristique (Ambatoloaka,
-- Madirokely, Dar es Salam) d'où viennent la plupart des clients. Au barème commun (3 km inclus),
-- ils passaient de 10 000 à 15 000–18 000 Ar de livraison du jour au lendemain. Deux kilomètres
-- offerts ramènent tout le monde de 2 000 Ar : Madirokely 13 000, Ambatoloaka 16 000, Hell-Ville
-- inchangé à 10 000.
--
-- Décision du porteur du projet après simulation sur ses vrais clients, appliquée le jour même par
-- `admin_set_tarif_livraison` — rapatriée ici pour que le dépôt ne diverge pas de la base.
--
-- ⚠️ Ce n'est PAS neutre : une course Hell-Ville → Ambatoloaka, c'est 20 km aller-retour, environ
-- 2 600 Ar d'essence et 45 minutes de livreur. À 16 000 Ar elle reste rentable ; si le barème
-- baissait encore, ces courses seraient subventionnées.
update public.restaurants
   set livraison_km_inclus = 5
 where id = 'eb10f338-fb78-4c16-82d5-810ae37b49fe';
