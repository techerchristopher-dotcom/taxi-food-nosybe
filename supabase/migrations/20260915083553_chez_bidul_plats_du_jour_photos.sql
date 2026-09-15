-- Photos des trois plats du jour de Chez Bidul & Truc (2026-09-15).
--
-- Visuels générés dans le style de sa carte (ardoise / fond noir, 1024×1024), fournis par le
-- porteur du projet — même exception assumée que le « Poisson fumé » (docs/PARTENAIRES.md).
-- Sources : visuels-reseaux/photos/plat-*.png.
--
-- Dépôt dans le bucket `produits` : fonction Edge JETABLE `upload-plats-du-jour-bidul`
-- (sources et chemins figés, jeton à usage unique, clé service_role restée dans la fonction),
-- appelée une fois puis NEUTRALISÉE (410). ⚠️ À supprimer depuis le tableau de bord Supabase.
update public.products p
   set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/' || v.fichier
  from (values ('Poulet basquaise', 'plat-poulet-basquaise.png'),
               ('Blanquette de poisson', 'plat-blanquette-de-poisson.png'),
               ('Tartare de zébu', 'plat-tartare-de-zebu.png')) as v(nom, fichier)
 where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and p.name = v.nom
   and p.is_featured
   and not p.is_archived;
