-- Madame Oh, Oh Hazar et La Plage s'annoncent.
--
-- POURQUOI. Trois restaurants de Hell-Ville sont en négociation. Les montrer
-- avant la signature, c'est laisser les clients voir ce qui arrive — et laisser
-- les restaurateurs voir leur carte en ligne, ce qui aide à signer. Ils entrent
-- donc en `coming_soon` : visibles, jamais commandables. La garde est en base,
-- pas à l'écran : commandable_maintenant() exige `listing_status = 'visible'`.
--
-- CE QUI N'EST PAS RENSEIGNÉ, VOLONTAIREMENT. Zone livrée, horaires, frais de
-- livraison et commission ne sont pas connus : ils gardent les défauts de la
-- table plutôt que des valeurs inventées. ⚠️ Ces défauts ne sont PAS ceux des
-- restaurants en service : commission 15 % (les autres sont à 5 %) et livraison
-- 0 Ar (les autres à 10 000). Sans conséquence tant que personne ne peut
-- commander ; à régler AVANT tout passage en `visible`.
--
-- LES PRIX « À PARTIR DE ». Le poisson entier grillé, le mi xao et la soupe
-- chinoise de La Plage sont affichés « dès » ou « à partir de » 29 000 Ar sur la
-- carte papier : le vrai prix dépend d'une déclinaison qu'on ne connaît pas. Ils
-- sont créés avec leur photo mais INDISPONIBLES, pour ne tromper personne sur le
-- prix. Décision du porteur du projet, 2026-09-16.
--
-- LES CHOIX SONT DES OPTIONS, PAS DES PLATS. Un tajine au choix pruneaux ou
-- citron confit, c'est un plat avec un choix — pas huit plats. Même règle pour
-- les desserts « ananas ou banane », « confiture ou sucre », et pour les
-- accompagnements de La Plage : un inclus au choix, les suivants à 5 000 Ar
-- (décision du porteur du projet). Modèle déjà en place :
-- product_option_groups / product_options, comme les suppléments des pizzas.
--
-- LES PHOTOS. 60 visuels déposés dans le bucket `produits`, un dossier par
-- restaurant, nom de fichier repris de la source. Ramenés de 1792×2240 (jusqu'à
-- 7 Mo) à 1024×1280 (2,3 Mo au plus), au format des photos déjà en ligne.
-- ⚠️ Correction du 2026-09-16 : une première version de ce commentaire affirmait que
-- l'application téléchargeait la photo sans transformateur. C'est FAUX — ses
-- vignettes passent par /render/image (app/data/types.ts). Le redimensionnement sert
-- ce qui charge le fichier d'origine : la vitrine, les pages de partage, les
-- aperçus WhatsApp. Ce sont des RECONSTITUTIONS d'après les recettes, pas des photos
-- prises dans leurs cuisines (même exception assumée que docs/PARTENAIRES.md) :
-- à confirmer par chaque restaurateur avant l'ouverture des commandes.
--
-- ⚠️ Identifiants FIXES pour les trois restaurants : les rangs, les chemins de
-- photos et les vérifications de recette s'y réfèrent.


-- =====================================================================
-- 1. Les trois restaurants
-- =====================================================================
insert into public.restaurants (id, name, cuisine_type, listing_status, auto_open, sort_order) values
  ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Madame Oh', 'Cuisine thaïlandaise', 'coming_soon', false, 40),
  ('c2a49e11-d839-459f-a332-024796102155', 'Oh Hazar',  'Cuisine marocaine',    'coming_soon', false, 50),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'La Plage',  'Bistrot & bar',        'coming_soon', false, 60);


-- =====================================================================
-- 2. Les catégories
-- =====================================================================
insert into public.categories (restaurant_id, name, icon, sort_order) values
  ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', '🥗', 10),
  ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   '🍽️', 20),
  ('c2a49e11-d839-459f-a332-024796102155', 'Plats',   '🍽️', 10),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', '🥗', 10),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois',  '🔥', 20),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Sandwichs demi-baguette',   '🥖', 30),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',              '🍽️', 40),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur',           '🍰', 50);


-- =====================================================================
-- 3. Les 60 plats
-- =====================================================================
-- Les sandwichs s'appellent « Sandwich fromage » et non « Fromage » : le panier
-- et le ticket du restaurant affichent le nom du plat SANS sa catégorie.
insert into public.products (restaurant_id, category_id, name, price, photo_url, sort_order, is_available, description)
select v.resto::uuid, c.id, v.nom, v.prix,
       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/' || v.fichier,
       v.rang, v.dispo, v.descr
  from (values
    -- Madame Oh
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', 10, 'Nem au poulet',          16000, 'madame-oh/entree-nem-poulet.png',          true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', 20, 'Sambossa au zébu',       22000, 'madame-oh/entree-sambossa-zebu.png',       true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', 30, 'Rouleaux',               21000, 'madame-oh/entree-rouleaux.png',            true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', 40, 'Satay de poulet',        18000, 'madame-oh/entree-satay-poulet.png',        true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Entrées', 50, 'Salade de papaye',       20000, 'madame-oh/entree-salade-papaye.png',       true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   10, 'Tom yam',                28000, 'madame-oh/plat-tom-yam.png',               true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   20, 'Tom kha gai',            24000, 'madame-oh/plat-tom-kha-gai.png',           true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   30, 'Pad thaï royal',         26000, 'madame-oh/plat-pad-thai-royal.png',        true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   40, 'Curry vert',             30000, 'madame-oh/plat-curry-vert.png',            true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   50, 'Curry rouge',            32000, 'madame-oh/plat-curry-rouge.png',           true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   60, 'Curry jaune',            32000, 'madame-oh/plat-curry-jaune.png',           true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   70, 'Curry panang',           32000, 'madame-oh/plat-curry-panang.png',          true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   80, 'Zébu sauté poivre noir', 38000, 'madame-oh/plat-zebu-saute-poivre-noir.png', true, null),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f', 'Plats',   90, 'Sauce aigre-douce',      36000, 'madame-oh/plat-sauce-aigre-douce.png',     true, null),
    -- Oh Hazar
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 10, 'Couscous royal pour 4 personnes', 120000, 'oh-hazar/plat-couscous-royal.png',             true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 20, 'Brochette kefta',                  30000, 'oh-hazar/plat-brochette-kefta.png',            true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 30, 'Brochette merguez',                30000, 'oh-hazar/plat-brochette-merguez.png',          true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 40, 'Boulette kefta',                   35000, 'oh-hazar/plat-boulette-kefta.png',             true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 50, 'Tajine de poulet',                 58000, 'oh-hazar/plat-tajine-poulet-citron-confit.png', true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 60, 'Tajine de zébu',                   58000, 'oh-hazar/plat-tajine-zebu-pruneaux.png',       true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 70, 'Tajine d''agneau',                 58000, 'oh-hazar/plat-tajine-agneau-pruneaux.png',     true, null),
    ('c2a49e11-d839-459f-a332-024796102155', 'Plats', 80, 'Tajine de poisson',                52000, 'oh-hazar/plat-tajine-poisson-chermoula.png',   true, null),
    -- La Plage — entrées
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 10, 'Nems viande 3 pièces',            24000, 'la-plage/entree-nems-viande.png',             true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 20, 'Assiette de crudités',            11000, 'la-plage/entree-assiette-de-crudites.png',    true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 30, 'Tartare de poisson',              24000, 'la-plage/entree-tartare-de-poisson.png',      true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 40, 'Rouleaux de printemps 3 pièces',  24000, 'la-plage/entree-rouleaux-de-printemps.png',   true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 50, 'Assiette de poisson fumé',        24000, 'la-plage/entree-assiette-de-poisson-fume.png', true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 60, 'Beignets de crevettes',           24000, 'la-plage/entree-beignets-de-crevettes.png',   true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 70, 'Beignets de calamars',            29000, 'la-plage/entree-beignets-de-calamars.png',    true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Nos traditions et entrées', 80, 'Beignets de poisson',             22000, 'la-plage/entree-beignets-de-poisson.png',     true, null),
    -- La Plage — grillades
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 10, 'Poisson entier grillé',        29000, 'la-plage/grillade-poisson-entier.png',            false, 'Prix à partir de 29 000 Ar, à confirmer avec le restaurant.'),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 20, 'Côtes de zébu grillées',       35000, 'la-plage/grillade-cotes-de-zebu.png',             true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 30, 'Steak de zébu',                34000, 'la-plage/grillade-steak-de-zebu.png',             true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 40, 'Poulet grillé',                29000, 'la-plage/grillade-poulet-grille.png',             true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 50, 'Brochettes de thazard',        27000, 'la-plage/grillade-brochettes-thazard.png',        true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 60, 'Brochettes de filet de zébu',  34000, 'la-plage/grillade-brochettes-filet-de-zebu.png',  true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 70, 'Brochettes de crevettes',      31000, 'la-plage/grillade-brochettes-crevettes.png',      true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Grillades au feu de bois', 80, 'Brochettes de poulet',         29000, 'la-plage/grillade-brochettes-poulet.png',         true, null),
    -- La Plage — sandwichs
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Sandwichs demi-baguette', 10, 'Sandwich poisson fumé', 19000, 'la-plage/sandwich-poisson-fume.png', true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Sandwichs demi-baguette', 20, 'Sandwich omelette',     13000, 'la-plage/sandwich-omelette.png',     true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Sandwichs demi-baguette', 30, 'Sandwich fromage',      15000, 'la-plage/sandwich-fromage.png',      true, null),
    -- La Plage — plats maison
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  10, 'Poisson pané',         27000, 'la-plage/plat-poisson-pane.png',         true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  20, 'Poulet pané',          31000, 'la-plage/plat-poulet-pane.png',          true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  30, 'Poulet façon KFC',     35000, 'la-plage/plat-poulet-facon-kfc.png',     true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  40, 'Mi Xao',               29000, 'la-plage/plat-mi-xao.png',               false, 'Prix à partir de 29 000 Ar selon la déclinaison, à confirmer avec le restaurant.'),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  50, 'Soupe chinoise',       29000, 'la-plage/plat-soupe-chinoise.png',       false, 'Prix à partir de 29 000 Ar selon la déclinaison, à confirmer avec le restaurant.'),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  60, 'Spaghetti bolognaise', 25000, 'la-plage/plat-spaghetti-bolognaise.png', true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  70, 'Poulet citronné',      29000, 'la-plage/plat-poulet-citronne.png',      true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  80, 'Bol renversé',         29000, 'la-plage/plat-bol-renverse.png',         true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison',  90, 'Romazava poulet',      29000, 'la-plage/plat-romazava-poulet.png',      true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison', 100, 'Romazava poisson',     25000, 'la-plage/plat-romazava-poisson.png',     true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison', 110, 'Romazava viande',      29000, 'la-plage/plat-romazava-viande.png',      true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison', 120, 'Poulet coco',          31000, 'la-plage/plat-poulet-coco.png',          true,  null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Plats maison', 130, 'Poisson coco',         29000, 'la-plage/plat-poisson-coco.png',         true,  null),
    -- La Plage — desserts
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 10, 'Ananas ou banane flambée', 14000, 'la-plage/dessert-ananas-banane-flambee.png',    true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 20, 'Boule de glace',            6000, 'la-plage/dessert-boule-de-glace.png',          true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 30, 'Salade de fruits',         14000, 'la-plage/dessert-salade-de-fruits.png',        true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 40, 'Crêpe banane',             11000, 'la-plage/dessert-crepe-banane.png',            true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 50, 'Crêpe au chocolat',        13000, 'la-plage/dessert-crepe-au-chocolat.png',       true, null),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe', 'Le coin douceur', 60, 'Crêpe confiture ou sucre', 11000, 'la-plage/dessert-crepe-confiture-ou-sucre.png', true, null)
  ) as v(resto, categorie, rang, nom, prix, fichier, dispo, descr)
  join public.categories c on c.restaurant_id = v.resto::uuid and c.name = v.categorie;


-- =====================================================================
-- 4. Les choix
-- =====================================================================
-- Un choix sans supplément : obligatoire, une seule réponse.
-- ⚠️ Des `values` en CTE, pas de table temporaire : une table « on commit drop »
-- disparaît entre deux instructions si la migration ne tourne pas dans UNE
-- transaction, et l'insertion suivante échoue.
with choix(resto, plat, groupe, options) as (values
  ('c2a49e11-d839-459f-a332-024796102155'::uuid, 'Tajine de poulet',         'Garniture', array['Pruneaux', 'Citron confit']),
  ('c2a49e11-d839-459f-a332-024796102155'::uuid, 'Tajine de zébu',           'Garniture', array['Pruneaux', 'Citron confit']),
  ('c2a49e11-d839-459f-a332-024796102155'::uuid, 'Tajine d''agneau',         'Garniture', array['Pruneaux', 'Citron confit']),
  ('c2a49e11-d839-459f-a332-024796102155'::uuid, 'Tajine de poisson',        'Garniture', array['Pruneaux', 'Citron confit']),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe'::uuid, 'Ananas ou banane flambée', 'Fruit',     array['Ananas', 'Banane']),
  ('eb10f338-fb78-4c16-82d5-810ae37b49fe'::uuid, 'Crêpe confiture ou sucre', 'Garniture', array['Confiture', 'Sucre'])
),
groupes as (
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
  select p.id, c.groupe, 1, 1, true, 10
    from choix c
    join public.products p on p.restaurant_id = c.resto and p.name = c.plat
  returning id, product_id
)
insert into public.product_options (group_id, name, price_delta, sort_order)
select g.id, o.nom, 0, (o.rang * 10)::integer
  from groupes g
  join public.products p on p.id = g.product_id
  join choix c on c.resto = p.restaurant_id and c.plat = p.name
  cross join lateral unnest(c.options) with ordinality as o(nom, rang);

-- Les accompagnements de La Plage : UN inclus, au choix ; les suivants à 5 000 Ar.
-- Deux groupes, parce que le modèle ne sait pas dire « le premier gratuit » dans
-- un seul : un groupe obligatoire à 0 Ar, puis un groupe facultatif à 5 000 Ar.
-- Posés sur les grillades et les plats maison — SAUF ceux dont la base est déjà
-- un féculent (mi xao, soupe chinoise, spaghetti, bol renversé) : leur imposer
-- un accompagnement serait absurde. À confirmer avec le restaurateur.
with plats(plat) as (values
  ('Poisson entier grillé'), ('Côtes de zébu grillées'), ('Steak de zébu'), ('Poulet grillé'),
  ('Brochettes de thazard'), ('Brochettes de filet de zébu'), ('Brochettes de crevettes'), ('Brochettes de poulet'),
  ('Poisson pané'), ('Poulet pané'), ('Poulet façon KFC'), ('Poulet citronné'),
  ('Romazava poulet'), ('Romazava poisson'), ('Romazava viande'), ('Poulet coco'), ('Poisson coco')
),
groupes as (
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
  select p.id, g.nom, g.mini, g.maxi, g.oblig, g.rang
    from plats pl
    join public.products p on p.restaurant_id = 'eb10f338-fb78-4c16-82d5-810ae37b49fe' and p.name = pl.plat
    cross join (values
      ('Accompagnement',                1, 1, true,  10),
      ('Accompagnement supplémentaire', 0, 6, false, 20)
    ) as g(nom, mini, maxi, oblig, rang)
  returning id, name
)
insert into public.product_options (group_id, name, price_delta, sort_order)
select g.id,
       case when g.name = 'Accompagnement' then a.nom else '+ ' || a.nom end,
       case when g.name = 'Accompagnement' then 0 else 5000 end,
       (a.rang * 10)::integer
  from groupes g
  cross join unnest(array['Frites', 'Pommes sautées', 'Riz blanc', 'Salade', 'Légumes sautés', 'Pâtes'])
       with ordinality as a(nom, rang);
