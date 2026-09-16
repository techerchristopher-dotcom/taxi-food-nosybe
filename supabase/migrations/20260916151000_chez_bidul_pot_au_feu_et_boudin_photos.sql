-- Photos du pot-au-feu et du boudin noir façon hachis de Chez Bidul & Truc (2026-09-16).
--
-- POURQUOI À PART. Même découpage que le 15 septembre (20260915083553) : le plat existe
-- d'abord, la photo le rejoint ensuite. Une migration de photo rejouée ne doit jamais
-- créer de plat, et une migration de plat ne doit jamais dépendre d'un fichier déposé.
--
-- Visuels générés dans le style de sa carte (ardoise / fond noir, 1024×1024), fournis par le
-- porteur du projet — RECONSTITUTIONS, pas des photos prises dans sa cuisine : même exception
-- assumée que les trois précédents et le « Poisson fumé » (docs/PARTENAIRES.md). Deux points
-- restent à confirmer par le restaurateur avant l'ouverture réelle des commandes : le
-- contenant du boudin en hachis (ardoise sur le visuel, souvent plat à gratin individuel en
-- vrai) et la structure de ses couches, qui n'a pas de canon.
-- Sources : visuels-reseaux/photos/plat-pot-au-feu.png, plat-boudin-noir-facon-hachis.png.
--
-- Dépôt dans le bucket `produits` : par la fonction `deposer-visuel`, et NON par une nouvelle
-- fonction jetable portant la service_role comme le 15 septembre. Celle-ci ne stocke que
-- l'empreinte de son secret et refuse d'écraser une photo existante : aucune fonction de plus
-- à neutraliser puis supprimer.
--
-- Clause de garde : ne touche que les plats du jour à l'affiche et non archivés.
update public.products p
   set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/' || v.fichier
  from (values ('Pot-au-feu', 'plat-pot-au-feu.png'),
               ('Boudin noir façon hachis', 'plat-boudin-noir-facon-hachis.png')) as v(nom, fichier)
 where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and p.name = v.nom
   and p.is_featured
   and not p.is_archived;
