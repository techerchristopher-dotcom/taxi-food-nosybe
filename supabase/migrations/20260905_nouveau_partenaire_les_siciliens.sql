-- NOUVEAU PARTENAIRE : « Les Siciliens », pizzeria / pates italienne, Hell-Ville.
--
-- Intention : creer la fiche restaurant et sa carte complete relevee sur la carte
-- papier (photos du 2026-09-05), soit 46 produits sur 4 categories :
-- 17 pizzas, 14 pates, 6 entrees, 9 burgers.
--
-- CREE VOLONTAIREMENT FERME (is_open = false). La policy restaurants_select_public
-- est `using (true)` : ni is_open ni la presence d'un menu ne filtrent l'affichage,
-- la fiche serait donc visible aux vrais clients des l'insert. A rouvrir par
-- l'update separe tout en bas, une fois la carte relue a l'ecran.
--
-- COMMISSION : 0.05 ecrit explicitement. Le defaut de la colonne (0.15) et celui du
-- formulaire admin (15 %) ne correspondent PAS au taux pratique chez les 4 autres
-- partenaires. L'oublier commissionnerait le restaurant au triple.
--
-- AUTO_OPEN : false, et aucune ligne restaurant_hours. ouvert_maintenant() renvoie
-- false par defaut quand auto_open = true sans planning : passer l'un sans l'autre
-- fermerait le restaurant en silence. Les horaires n'ont pas ete releves.
--
-- « PIZZA A EMPORTER 2000 Ar PLUS » (mention en tete de la carte) : modelise en
-- products.packaging_fee / packaging_label, comme la boite a pizza de Chez Bidul &
-- Truc (voir 20260905_frais_emballage_ligne_de_panier.sql). Ce n'est PAS un groupe
-- d'options : le client ne choisit rien, la ligne apparait d'elle-meme au panier,
-- juste au-dessus des frais de livraison. Sur Taxi Food tout est livre, donc le
-- supplement s'applique toujours.
--
-- DIET_TAGS : uniquement « bacon », seul marqueur de porc EXPLICITE au sens de
-- docs/LABELS-ALIMENTAIRES.md (memes mots-cles que la migration
-- 20260905_label_alimentaire_porc). « Jambon italien », « jambon cru », « salame
-- (chorizo) italienne » et « salami italien » sont volontairement NON tagues : la
-- carte ne precise pas l'espece, et le piege deja rencontre (les Reine d'Angelo et
-- Taxi Be sont au jambon DE VOLAILLE) coute exactement les clients que le label
-- doit servir. A poser au restaurateur, puis appliquer par set_product_diet_tags.
--
-- VISUELS : 41 images generees pour cette carte (exception ADR-007 accordee
-- explicitement par le porteur du projet pour ce partenaire, comme pour Chez Bidul
-- & Truc), style « pizza italienne » impose : pate fine, cornicione boursoufle et
-- tachete de four a bois, mozzarella en flaques fondues, garniture sobre, ardoise
-- noire, fond gris-anthracite — le meme que la photothèque existante.
-- 3 visuels sont REUTILISES d'autres partenaires, composition verifiee ingredient
-- par ingredient. 2 produits restent SANS visuel (photo_url null) : leur libelle
-- offre deux plats differents sous un seul prix, aucune image ne peut etre fidele
-- aux deux — l'app affiche son repli propre. Voir le rapport de preparation.
--
-- ⚠️ Les fichiers doivent etre deposes dans le bucket AVANT de jouer ce script :
--    produits/les-siciliens/<nom>.png

do $$
declare
  rid  uuid;
  base text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/les-siciliens/';
  -- Visuels empruntes a d'autres partenaires (composition strictement identique).
  autres text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/';
begin
  ------------------------------------------------------------------- 1. La fiche
  insert into public.restaurants
    (name, cuisine_type, zone_served, food_types,
     delivery_fee, min_order, commission_rate, is_open, auto_open, phone)
  values
    ('Les Siciliens',
     'Pizzeria & Pâtes italiennes',
     'Hell-Ville',
     array['Pizza', 'Pâtes', 'Burger'],
     5000,
     0,
     0.05,
     false,
     false,
     null)                                  -- << TELEPHONE PUBLIC, non releve >>
  returning id into rid;

  --------------------------------------------------------------- 2. Categories
  -- sort_order reprend la convention en place :
  -- 5 Entree · 8 Pizza · 10 Plat · 15 Pates · 20 Tapas · 25 Hamburger · 40 Dessert
  insert into public.categories (restaurant_id, name, icon, sort_order, is_active)
  values
    (rid, 'Entrée', '🥗',  5, true),
    (rid, 'Pizza',  '🍕',  8, true),
    (rid, 'Pâtes',  '🍝', 15, true),
    (rid, 'Burger', '🍔', 25, true);

  ------------------------------------------------------------------ 3. Produits
  -- Une seule table de valeurs pour toute la carte : categorie, nom, composition,
  -- prix, fichier visuel (null = pas de visuel fidele possible), tag porc,
  -- emballage. Rejointe sur categories pour recuperer category_id.
  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, diet_tags, packaging_fee, packaging_label)
  select
    rid, c.id, v.nom, v.compo, v.prix,
    case
      when v.photo is null    then null
      when v.photo like '%/%' then autres || v.photo   -- visuel d'un autre partenaire
      else base || v.photo
    end,
    true,
    case when v.porc then array['porc'] else '{}'::text[] end,
    v.emballage,
    v.emballage_label
  from (values
    ----------------------------------------------------------------- PIZZE (17)
    -- Toutes a 2 000 Ar de boite : « PIZZA A EMPORTER 2000 Ar PLUS ».
    ('Pizza', 'Margherita',              'Tomate, mozzarella, basilic',                                                              28000, 'pizza-margherita.png',              false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Focaccia',                'Mozzarella, fromage râpé, oignon, olive noire',                                            31000, 'pizza-focaccia.png',                false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Pomme de terre',          'Tomate, mozzarella, pommes de terre frites',                                               31000, 'pizza-pomme-de-terre.png',          false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Marinara',                'Tomate, mozzarella, anchois, olives noires',                                               32000, 'pizza-marinara.png',                false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Jambon italien',          'Tomate, mozzarella, jambon italien',                                                       32000, 'pizza-jambon-italien.png',          false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Jambon et champignons',   'Tomate, mozzarella, champignons, jambon italien',                                          32000, 'pizza-jambon-et-champignons.png',   false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Champignon',              'Tomate, mozzarella, champignons',                                                          32000, 'pizza-champignon.png',              false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Fruits de la mer',        'Tomate, mozzarella, crevettes, calamars',                                                  32000, 'pizza-fruits-de-la-mer.png',        false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Poisson fumé',            'Tomate, mozzarella, poisson fumé (tazar ou espadon)',                                      32000, 'pizza-poisson-fume.png',            false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Bolognese',               'Tomate, mozzarella, sauce bolognaise',                                                     32000, 'pizza-bolognese.png',               false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Poulet',                  'Tomate, mozzarella, poulet, sauce barbecue',                                               32000, 'pizza-poulet.png',                  false, 2000, 'Boîte à pizza'),
    -- Visuel emprunte a Taxi Be : « Pepperoni » y est composee de sauce tomate,
    -- mozzarella et CHORIZO — exactement cette pizza. Verifie en base, pas au nom.
    ('Pizza', 'Salame (chorizo) italienne', 'Tomate, mozzarella, salame (chorizo) italien',                                          32000, 'taxi-be/pizza-pepperoni.png',       false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Vegetariana',             'Tomate, mozzarella, aubergine, courgette',                                                 32000, 'pizza-vegetariana.png',             false, 2000, 'Boîte à pizza'),
    ('Pizza', '4 fromages',              'Tomate, mozzarella, divers fromages, gorgonzola',                                          34000, 'pizza-4-fromages.png',              false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Carbonara',               'Tomate, mozzarella, œuf, fromage râpé, bacon frit',                                        34000, 'pizza-carbonara.png',               true,  2000, 'Boîte à pizza'),
    ('Pizza', 'Les Siciliens',           'Tomate, mozzarella, anchois, tomate en tranches, oignon, fromage râpé, olive noire',       34000, 'pizza-les-siciliens.png',           false, 2000, 'Boîte à pizza'),
    ('Pizza', 'Jambon cru et parmesan',  'Tomate, mozzarella, jambon cru, parmesan',                                                 40000, 'pizza-jambon-cru-parmesan.png',     false, 2000, 'Boîte à pizza'),

    ----------------------------------------------------------------- PATES (14)
    ('Pâtes', 'Tomate',                  'Tomate, basilic',                                                                          28000, 'pates-tomate.png',                  false, 0, null),
    ('Pâtes', 'Lasagne',                 'Sauce tomate, viande hachée de zébu, carottes, oignon, béchamel, fromage râpé',            30000, 'pates-lasagne.png',                 false, 0, null),
    ('Pâtes', 'Bolognese',               'Viande hachée de zébu, carottes, oignon, sauce tomate',                                    30000, 'pates-bolognese.png',               false, 0, null),
    ('Pâtes', 'Francescana',             'Sauce tomate, lait, jambon italien, champignons, persil',                                  30000, 'pates-francescana.png',             false, 0, null),
    ('Pâtes', 'Amatriciana',             'Sauce tomate, bacon, persil, oignon',                                                      30000, 'pates-amatriciana.png',             true,  0, null),
    ('Pâtes', 'Lido',                    'Sauce tomate, poisson (tazar ou espadon), aubergine, menthe',                              30000, 'pates-lido.png',                    false, 0, null),
    -- Visuel emprunte a Chez Bidul & Truc : pates cremeuses aux lardons de bacon
    -- et parmesan, sans creme visible — exactement œuf / bacon / fromage rape.
    ('Pâtes', 'Carbonara',               'Œuf, bacon, fromage râpé',                                                                 32000, 'chez-bidul-truc/pates-pates-carbonara.png', true, 0, null),
    ('Pâtes', 'Les Siciliens',           'Sauce tomate, pesto au basilic',                                                           30000, 'pates-les-siciliens.png',           false, 0, null),
    ('Pâtes', 'Pizzaiola',               'Sauce tomate, mozzarella, aubergines frites, origan',                                      30000, 'pates-pizzaiola.png',               false, 0, null),
    ('Pâtes', '4 fromages',              'Gorgonzola, emmenthal, fromage râpé',                                                      32000, 'pates-4-fromages.png',              false, 0, null),
    -- Visuel emprunte a Chez Bidul & Truc (« Pâtes bolognaise ») : ce sont des
    -- pates LONGUES plates au ragu, donc un tagliolino au ragu. Affecte ici plutot
    -- qu'a « Bolognese » ci-dessus, pour ne pas montrer deux fois la meme image
    -- dans une seule carte.
    ('Pâtes', 'Tagliolino ragù',         'Viande hachée de zébu, carottes, oignon, sauce tomate',                                    32000, 'chez-bidul-truc/pates-pates-bolognaise.png', false, 0, null),
    ('Pâtes', 'Norma',                   'Sauce tomate, aubergines frites, ricotta salée ou parmesan',                               32000, 'pates-norma.png',                   false, 0, null),
    ('Pâtes', 'Fruits de mer',           'Sauce tomate, crevettes, calamars',                                                        30000, 'pates-fruits-de-mer.png',           false, 0, null),
    ('Pâtes', 'Pâtes aux moules',        'Ail, tomate, persil, moules',                                                              34000, 'pates-aux-moules.png',              false, 0, null),

    --------------------------------------------------------------- ENTREES (6)
    ('Entrée', 'Salade mixte',           'Tomates tranchées, laitue, carottes, oignon, olives noires',                               18000, 'entree-salade-mixte.png',           false, 0, null),
    ('Entrée', 'Popcorn au poulet',      'Morceaux de poulet frit, sauce barbecue',                                                  24000, 'entree-popcorn-au-poulet.png',      false, 0, null),
    ('Entrée', 'Parmigiana',             'Sauce tomate, fromage, aubergine, basilic',                                                22000, 'entree-parmigiana.png',             false, 0, null),
    ('Entrée', 'Légumes grillés',        'Aubergines, champignons, carottes, courgettes',                                            20000, 'entree-legumes-grilles.png',        false, 0, null),
    ('Entrée', 'Plats mixtes',           'Jambon italien, salami italien, emmenthal, champignons, olives noires, anchois',           45000, 'entree-plats-mixtes.png',           false, 0, null),
    ('Entrée', 'Poisson fumé',           'Avec salade verte, tazar ou espadon',                                                      28000, 'entree-poisson-fume.png',           false, 0, null),

    --------------------------------------------------------------- BURGERS (9)
    -- photo_url null : le libelle recouvre DEUX plats differents sous un seul prix
    -- (steak grille OU escalope milanaise panee ; steak hache OU poulet). Aucune
    -- image ne peut etre fidele aux deux, ADR-007 s'applique : on laisse vide,
    -- l'app affiche son repli.
    ('Burger', 'Steak grillé ou steak milanaise', 'Steak grillé ou steak milanaise, au choix',                                       28000, null,                                false, 0, null),
    ('Burger', 'Burger',                 'Viande hachée, tomate tranchée, salade verte',                                             26000, 'burger-burger.png',                 false, 0, null),
    ('Burger', 'Cheeseburger',           'Viande hachée, tomate tranchée, salade verte, fromage',                                    28000, 'burger-cheeseburger.png',           false, 0, null),
    ('Burger', 'Big cheeseburger',       'Viande hachée, tomate tranchée, salade verte, fromage, bacon, oignon',                     32000, 'burger-big-cheeseburger.png',       true,  0, null),
    ('Burger', 'Chicken burger',         'Poulet frit, tomate tranchée, salade verte',                                               26000, 'burger-chicken-burger.png',         false, 0, null),
    ('Burger', 'Chicken cheeseburger',   'Poulet frit, tomate tranchée, salade verte, fromage',                                      28000, 'burger-chicken-cheeseburger.png',   false, 0, null),
    ('Burger', 'Poulet grillé',          'Poulet grillé, accompagné de salade ou de frites',                                         28000, 'burger-poulet-grille.png',          false, 0, null),
    ('Burger', 'Poulet milanese',        'Poulet frit, accompagné de salade ou de frites',                                           28000, 'burger-poulet-milanese.png',        false, 0, null),
    ('Burger', 'Crispy burger',          'Viande hachée ou poulet, au choix',                                                        34000, null,                                false, 0, null)
  ) as v(cat, nom, compo, prix, photo, porc, emballage, emballage_label)
  join public.categories c on c.restaurant_id = rid and c.name = v.cat;

  ------------------------------------------------- 4. Les choix « ou » de la carte
  -- « tazar OU espadon », « ricotta salee OU parmesan », « salade OU frites »,
  -- « viande hachee OU poulet », « steak grille OU milanaise » sont de vrais choix
  -- client : un groupe OBLIGATOIRE a un seul choix, a +0 Ar, pas des produits
  -- separes.
  --
  -- ⚠️ PIEGE DEJA RENCONTRE (6 migrations correctives chez Chez Bidul & Truc) :
  -- l'insert des options doit filtrer par PRODUIT **et** par NOM DE GROUPE, sinon
  -- les memes options se reinjectent dans les groupes precedents. D'ou la jointure
  -- sur (v.produit, v.groupe) ci-dessous plutot qu'un cross join.
  --
  -- ⚠️ Le couple (categorie, produit) est la clef, pas le nom du produit seul :
  -- « Poisson fumé » existe DEUX fois dans cette carte, une fois en pizza et une
  -- fois en entree. Filtrer sur le nom seul poserait le groupe deux fois sur
  -- chacun des deux.
  insert into public.product_option_groups
    (product_id, name, min_select, max_select, required, sort_order)
  select p.id, v.groupe, 1, 1, true, 10
  from (values
    ('Pizza',  'Poisson fumé',                    'Poisson au choix'),
    ('Entrée', 'Poisson fumé',                    'Poisson au choix'),
    ('Pâtes',  'Lido',                            'Poisson au choix'),
    ('Pâtes',  'Norma',                           'Fromage au choix'),
    ('Burger', 'Steak grillé ou steak milanaise', 'Préparation au choix'),
    ('Burger', 'Poulet grillé',                   'Accompagnement'),
    ('Burger', 'Poulet milanese',                 'Accompagnement'),
    ('Burger', 'Crispy burger',                   'Garniture au choix')
  ) as v(cat, produit, groupe)
  join public.categories c on c.restaurant_id = rid and c.name = v.cat
  join public.products   p on p.restaurant_id = rid and p.category_id = c.id and p.name = v.produit;

  -- Les options, rattachees a (produit, groupe) — jamais au seul nom de groupe.
  insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
  select g.id, v.option, 0, true, v.ordre
  from (values
    ('Poisson au choix',     'Tazar',            1),
    ('Poisson au choix',     'Espadon',          2),
    ('Fromage au choix',     'Ricotta salée',    1),
    ('Fromage au choix',     'Parmesan',         2),
    ('Préparation au choix', 'Steak grillé',     1),
    ('Préparation au choix', 'Steak milanaise',  2),
    ('Accompagnement',       'Salade',           1),
    ('Accompagnement',       'Frites',           2),
    ('Garniture au choix',   'Viande hachée',    1),
    ('Garniture au choix',   'Poulet',           2)
  ) as v(groupe, option, ordre)
  join public.product_option_groups g on g.name = v.groupe
  join public.products p on p.id = g.product_id and p.restaurant_id = rid;
end $$;

------------------------------------------------------------------ CONTROLES
-- A passer AVANT de rouvrir le restaurant. Attendus :
--   produits      : 46  (17 pizzas, 14 pates, 6 entrees, 9 burgers)
--   emballage     : 17  (les pizzas, 2 000 Ar chacune)
--   tagues porc   :  4  (pizza Carbonara, pates Amatriciana, pates Carbonara,
--                        Big cheeseburger — « bacon » explicite uniquement)
--   sans visuel   :  2  (Steak grille ou milanaise, Crispy burger)
--   groupes       :  8, chacun avec EXACTEMENT 2 options (16 options au total)
--
-- select count(*) from products p join restaurants r on r.id = p.restaurant_id where r.name = 'Les Siciliens';
-- select count(*) from products p join restaurants r on r.id = p.restaurant_id where r.name = 'Les Siciliens' and p.packaging_fee > 0;
-- select p.name from products p join restaurants r on r.id = p.restaurant_id where r.name = 'Les Siciliens' and 'porc' = any(p.diet_tags);
-- select p.name from products p join restaurants r on r.id = p.restaurant_id where r.name = 'Les Siciliens' and p.photo_url is null;
-- select p.name as produit, g.name as groupe, count(o.*) as options
--   from products p join restaurants r on r.id = p.restaurant_id
--   join product_option_groups g on g.product_id = p.id
--   left join product_options o on o.group_id = g.id
--  where r.name = 'Les Siciliens' group by 1,2 order by 1;
--   -- ⚠️ toute ligne a 4 options au lieu de 2 = les options se sont reinjectees
--   --    dans un groupe voisin. C'est le defaut a chercher en priorite.

------------------------------------------------------------- MISE EN SERVICE
-- A jouer SEPAREMENT, une fois les controles ci-dessus passes et la carte relue
-- a l'ecran :
-- update public.restaurants set is_open = true where name = 'Les Siciliens';
