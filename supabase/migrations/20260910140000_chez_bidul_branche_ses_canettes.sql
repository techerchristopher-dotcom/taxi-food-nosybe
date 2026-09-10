-- Chez Bidul & Truc : les dix boissons prennent leurs vrais packshots.
--
-- Onze packshots 2048x2048 ont ete produits a partir de photos prises au bar,
-- puis televerses dans le bucket `boissons` le 2026-09-10. Dix sont branches ici
-- (le onzieme, `canette-gold-blonde-50cl.png`, n'a pas de produit correspondant
-- chez ce restaurant — il reste disponible pour un usage futur).
--
-- ⚠️ CE QUE CE BRANCHEMENT CORRIGE. Sept des dix produits montraient soit RIEN,
-- soit un visuel qui n'etait pas le produit servi :
--   * Caprice Grenadine       montrait une BOUTEILLE DE SIROP — un autre produit
--   * Caprice Orange          une bouteille PET 1,5 L
--   * Caprice Bonbon Anglais  une bouteille verre
--   * THB 50 cl               une bouteille, pas une canette
--   * Gold Blanche, Fresh, Fosa, XXL : aucune image
-- C'est exactement ce que l'ADR-007 interdit : « sans visuel du produit
-- reellement servi, on laisse vide » — le personnel se sert de la vignette pour
-- controler ce qu'il sert.
--
-- ⚠️ CIBLAGE PAR RESTAURANT **ET** PAR NOM, jamais en masse. Angelo, La Cabane
-- et Taxi Be gardent leurs images : leurs produits s'appellent « THB PM »,
-- « THB GM », « Gold Blanche PM » — petit et grand modele, c'est-a-dire des
-- BOUTEILLES. Y coller une canette 50 cl remplacerait une image fausse par une
-- autre. Verifie apres coup : 10 canettes chez Chez Bidul, 0 ailleurs.
--
-- ⚠️ AUCUN FICHIER SUPPRIME du bucket : les anciens servent encore aux trois
-- autres restaurants.
--
-- ⚠️ RESTE A FAIRE, signale et NON corrige a l'aveugle : `thb-pm.jpg` est un
-- VERRE VIDE, et il illustre le THB PM vendu 6 000 a 7 000 Ar chez Angelo,
-- La Cabane et Taxi Be. C'est le pire visuel du catalogue. Il faut une photo de
-- la bouteille 33 cl — pas une canette.
--
-- ⚠️ RIEN A DEPLOYER : donnee pure. Et le poids des fichiers (~3,5 Mo) ne pese
-- pas sur le client — `ProductThumb` passe par `thumbnailUrl()`, qui demande une
-- vignette redimensionnee a l'endpoint /render/image.

with r as (select id from public.restaurants where name = 'Chez Bidul & Truc'),
     b as (select 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/' as u)
update public.products p set photo_url = (select u from b) || m.fichier
from (values
  ('THB 50 cl',                    'canette-thb-50cl.png'),
  ('Gold Blanche 50 cl',           'canette-gold-blanche-50cl.png'),
  ('Beaufort 33 cl',               'canette-beaufort-33cl.png'),
  ('Fresh 33 cl',                  'canette-fresh-33cl.png'),
  ('Energy Drink Fosa 50 cl',      'canette-fosa-50cl.png'),
  ('Energy Drink XXL',             'canette-xxl.png'),
  ('World Cola 33 cl',             'canette-world-cola-33cl.png'),
  ('Caprice Grenadine 33 cl',      'canette-caprice-grenadine-33cl.png'),
  ('Caprice Orange 33 cl',         'canette-caprice-orange-33cl.png'),
  ('Caprice Bonbon Anglais 33 cl', 'canette-caprice-bonbon-anglais-33cl.png')
) as m(nom, fichier)
where p.restaurant_id = (select id from r) and p.name = m.nom;
