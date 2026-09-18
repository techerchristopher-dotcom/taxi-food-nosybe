-- Photos de la paella et des tripes à la mode de Caen de Chez Bidul & Truc (2026-09-18).
--
-- POURQUOI À PART. Même découpage que les fournées précédentes : le plat existe d'abord, la photo
-- le rejoint ensuite. Une migration de photo rejouée ne doit jamais créer de plat.
--
-- Visuels fournis par le porteur du projet, dans le style de sa carte (fond sombre) —
-- RECONSTITUTIONS, pas des photos prises dans sa cuisine : même exception assumée que les quatre
-- précédents (docs/PARTENAIRES.md).
-- Sources : visuels-reseaux/photos/plat-paella.png, plat-tripes-a-la-mode-de-caen.png.
--
-- Dépôt dans le bucket `produits` par la fonction `deposer-visuel` (secret dans .secrets.local) :
-- aucune fonction jetable portant la service_role.
--
-- Clause de garde : ne touche que les plats du jour à l'affiche et non archivés.
update public.products p
   set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/' || v.fichier
  from (values ('Paella', 'plat-paella.png'),
               ('Tripes à la mode de Caen', 'plat-tripes-a-la-mode-de-caen.png')) as v(nom, fichier)
 where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and p.name = v.nom
   and p.is_featured
   and not p.is_archived;
