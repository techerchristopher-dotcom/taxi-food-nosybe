-- La position GPS de La Plage (2026-09-25).
--
-- POURQUOI. Depuis le passage à la livraison au kilomètre (20260924150000), un restaurant sans
-- position fait payer le tarif de base à tout le monde : les clients de La Plage payaient 10 000 Ar
-- même à 9 km. Lien Google Maps envoyé par le porteur du projet, « La Plage, Hell-Ville ».
--
-- Conséquence immédiate, à connaître : La Plage est à Hell-Ville, à ~5,5 km d'Ambatoloaka et de
-- Madirokely à vol d'oiseau. Ses clients de la zone touristique passeront donc de 10 000 Ar à
-- environ 15 000 Ar. C'est le tarif voulu, mais c'est un vrai changement de prix pour eux.
update public.restaurants
   set latitude = -13.3945489, longitude = 48.2645362
 where id = 'eb10f338-fb78-4c16-82d5-810ae37b49fe';
