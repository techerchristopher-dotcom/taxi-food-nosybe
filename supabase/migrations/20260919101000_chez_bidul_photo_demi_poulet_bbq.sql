-- Photo du 1/2 poulet grillé BBQ de Chez Bidul & Truc (2026-09-19).
--
-- POURQUOI À PART. Même découpage que les trois fournées précédentes : le plat existe d'abord,
-- la photo le rejoint ensuite. Une migration de photo rejouée ne doit jamais créer de plat, et
-- une migration de plat ne doit jamais dépendre d'un fichier déposé.
--
-- Visuel fourni par le porteur du projet, dans le style de sa carte — RECONSTITUTION, pas une
-- photo prise dans sa cuisine (exception assumée, docs/PARTENAIRES.md). Il montre le poulet
-- SEUL, sans garniture : on ne promet ni frites ni riz tant que le restaurateur n'a pas dit ce
-- qu'il sert avec. Source : visuels-reseaux/photos/plat-demi-poulet-grille-bbq.png.
--
-- Déposée par la fonction `deposer-visuel` (secret dans .secrets.local, empreinte seule en base,
-- `ecraser: false`) : aucune fonction jetable portant la service_role.
--
-- Clause de garde : ne touche que ce plat du jour à l'affiche et non archivé.
update public.products
   set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/plat-demi-poulet-grille-bbq.png'
 where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and name = '1/2 poulet grillé BBQ'
   and is_featured
   and not is_archived;
