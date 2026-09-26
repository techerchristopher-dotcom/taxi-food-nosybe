# -*- coding: utf-8 -*-
"""La carte de La Plage — Bistrot · Bar, Hell-Ville.

SOURCE DES PRIX : ses DEUX CARTONS photographies le 23/09/2026, releves ligne a
ligne (`COMPARAISON-CARTE-PAPIER-LA-PLAGE.md`). Les 38 plats correspondent au
centime pres a la base ; les 39 boissons n'y sont pas du tout. AUCUNE HAUSSE :
contrairement a Chez Bidul & Truc, les prix sortent tels quels.

Chaque plat : (nom, prix, ingredients, presentation, a_valider, photo|None)

`a_valider` a 1 marque une ligne dont LA RECETTE VARIE D'UNE MAISON A L'AUTRE et
que je n'ai pas pu verifier chez elle. Le romazava, le bol renverse, le mi xao et
la soupe chinoise se font differemment partout ; ce que j'ecris est la version
documentee, pas forcement la sienne. Ces lignes doivent lui passer sous les yeux
avant impression. Le reste est descriptif et ne prete pas a discussion.

SOURCES DE LA RECHERCHE
  romazava        Wikipedia (en) « Romazava » : viande de zebu, bredes, tomates,
                  oignons, servi avec du riz ; les bredes mafana (anamalaho)
                  donnent le picotement caracteristique.
  bol renverse    HerveCuisine, recette sino-mauricienne : riz blanc moule,
                  saute de poulet et legumes (chou chinois, carottes,
                  champignons, mais, pousses de bambou), soja / sesame /
                  huitre, oeuf au plat pose au fond du bol puis renverse.
  mi xao          Wikipedia (fr) « Mi xao » : nouilles sautees au wok.
  THB             Wikipedia (en) « Three Horses Beer » : pale lager 5,4 %,
                  brassee par Star depuis 1958, la plus vendue du pays.
  Beaufort        Wikipedia (fr) : blonde du groupe Castel, brassee sous licence
                  a Madagascar par Star.
  Cody's          codys-drinks.com : brasseur allemand de Breme ; gamme bieres
                  fortes et melanges vodka-energy.
"""

# ============================================================ LA CUISINE

ENTREES = [
 ("Assiette de crudités", 11000,
  "Tomate, carotte, concombre, salade verte, vinaigrette maison.",
  "Le plein de frais avant le reste, quand il fait 32° dehors.",
  0, "entree-assiette-de-crudites-reel"),
 ("Beignets de poisson", 22000,
  "Poisson en morceaux, pâte à beignet, frits minute. Sauce à part.",
  "Dorés à la commande, servis brûlants — on les mange avec les doigts.",
  0, "entree-beignets-de-poisson"),
 ("Assiette de poisson fumé", 24000,
  "Poisson fumé émincé, oignon rouge, citron vert, huile.",
  "Fumé ici, tranché fin. L'entrée qui sent le port.",
  0, "entree-assiette-de-poisson-fume-reel"),
 ("Beignets de crevettes", 24000,
  "Crevettes entières, pâte à beignet, frites minute.",
  "La crevette garde son croquant sous la pâte. Rien à ajouter.",
  0, "entree-beignets-de-crevettes"),
 ("Nems viande — 3 pièces", 24000,
  "Galette de riz, viande hachée, vermicelles, carotte, champignon noir. Frits. "
  "Servis avec salade et sauce nuoc-mâm.",
  "Trois nems roulés à la main, croustillants, à tremper dans leur sauce.",
  0, "entree-nems-viande"),
 ("Rouleaux de printemps — 3 pièces", 24000,
  "Galette de riz fraîche, crevette, vermicelles, salade, menthe, coriandre. "
  "Sauce cacahuète ou nuoc-mâm.",
  "Les nems, version fraîche : rien n'est frit, tout est cru et croquant.",
  0, "entree-rouleaux-de-printemps-reel"),
 ("Tartare de poisson", 24000,
  "Poisson cru taillé au couteau, citron vert, oignon rouge, coriandre, huile.",
  "Le poisson du jour, cru, réveillé au citron vert. La fraîcheur à l'état pur.",
  0, "entree-tartare-de-poisson-reel"),
 ("Beignets de calamars", 29000,
  "Anneaux de calamar, pâte à beignet, frits minute. Quartier de citron.",
  "Tendres dedans, croustillants dehors — le calamar n'aime pas attendre.",
  0, "entree-beignets-de-calamars"),
]

GRILLADES = [
 ("Brochettes de thazard", 27000,
  "Thazard en cubes, grillé au feu de bois. Accompagnement au choix.",
  "Le thazard a une chair ferme qui tient sur la braise sans se défaire.",
  0, "grillade-brochettes-thazard"),
 ("Brochettes de poulet", 29000,
  "Poulet en cubes mariné, grillé au feu de bois. Accompagnement au choix.",
  "Mariné avant, saisi vif sur la braise : doré dehors, moelleux dedans.",
  0, "grillade-brochettes-poulet"),
 ("Poisson entier grillé — dès", 29000,
  "Poisson entier du jour, grillé au feu de bois. Accompagnement au choix. "
  "Prix selon la pièce.",
  "On vous montre la pièce avant de la mettre sur le feu.",
  0, "grillade-poisson-entier"),
 ("Poulet grillé", 29000,
  "Demi-poulet grillé au feu de bois. Accompagnement au choix.",
  "Peau craquante, chair qui se détache — la braise fait tout le travail.",
  0, "grillade-poulet-grille-reel"),
 ("Brochettes de crevettes", 31000,
  "Crevettes grillées au feu de bois. Accompagnement au choix.",
  "Juste le temps qu'il faut sur la braise, pas une seconde de plus.",
  0, "grillade-brochettes-crevettes"),
 ("Brochettes de filet de zébu", 34000,
  "Filet de zébu en cubes, grillé au feu de bois. Accompagnement au choix.",
  "Le morceau le plus tendre du zébu, taillé pour la braise.",
  0, "grillade-brochettes-filet-de-zebu-reel"),
 ("Steak de zébu", 34000,
  "Steak de zébu grillé au feu de bois. Accompagnement au choix.",
  "Le zébu, c'est la viande d'ici : moins grasse, plus de goût.",
  0, "grillade-steak-de-zebu-reel"),
 ("Côtes de zébu grillées", 35000,
  "Côtes de zébu grillées au feu de bois. Accompagnement au choix.",
  "À manger à la main, sans se poser de question. La pièce du partage.",
  0, "grillade-cotes-de-zebu-reel"),
]

# Sur son carton, un encadre a part entre les grillades et les sandwichs.
ACCOMPAGNEMENTS = dict(
    choix=["Frites", "Pommes sautées", "Riz blanc", "Salade", "Légumes sautés", "Pâtes"],
    ligne=("Supplément accompagnement", 5000),
    presentation="Un accompagnement compris avec chaque grillade et chaque plat. "
                 "Le deuxième est à 5 000 Ar.",
)

SANDWICHS = [
 ("Sandwich omelette", 13000,
  "Demi-baguette, omelette, salade, tomate.",
  "Le sandwich qu'on emporte sur la plage. Chaud, simple, suffisant.",
  0, "sandwich-omelette"),
 ("Sandwich fromage", 15000,
  "Demi-baguette, fromage, salade, tomate.",
  "Trois ingrédients, du bon pain, et c'est réglé.",
  0, "sandwich-fromage"),
 ("Sandwich poisson fumé", 19000,
  "Demi-baguette, poisson fumé, salade, tomate, citron.",
  "Son poisson fumé maison, entre deux tranches de baguette.",
  0, "sandwich-poisson-fume"),
]

PLATS = [
 ("Romazava poisson", 25000,
  "Poisson, brèdes mafana, tomate, oignon, gingembre. Servi avec du riz.",
  "Le plat national de Madagascar, en version marine.",
  1, "plat-romazava-poisson"),
 ("Spaghetti bolognaise", 25000,
  "Spaghetti, sauce tomate à la viande hachée de zébu, oignon, ail.",
  "La bolognaise de bord de mer : on la fait au zébu.",
  0, "plat-spaghetti-bolognaise-reel"),
 ("Poisson pané", 27000,
  "Filet de poisson pané, frit. Accompagnement au choix.",
  "Panure fine, poisson qui reste moelleux. Le plat que les enfants finissent.",
  0, "plat-poisson-pane-reel"),
 ("Bol renversé", 29000,
  "Riz blanc moulé, sauté de poulet et légumes (chou, carotte, champignon), "
  "sauce soja, œuf au plat posé au fond du bol puis retourné à l'assiette.",
  "Le bol arrive retourné, l'œuf sur le dessus : on casse le jaune et on mélange.",
  1, "plat-bol-renverse"),
 ("Mi Xao — à partir de", 29000,
  "Nouilles sautées au wok, viande ou crevettes, légumes, sauce soja. "
  "Prix selon la déclinaison.",
  "Le wok à pleine chaleur, les nouilles qui prennent la fumée : ça se joue en deux minutes.",
  1, "plat-mi-xao-reel"),
 ("Poisson coco", 29000,
  "Poisson mijoté au lait de coco, tomate, oignon, gingembre. Servi avec du riz.",
  "Le lait de coco arrondit tout, le gingembre l'empêche de s'endormir.",
  0, "plat-poisson-coco"),
 ("Poulet citronné", 29000,
  "Poulet mijoté au citron, ail, oignon. Servi avec du riz.",
  "Le citron travaille le poulet jusqu'à ce qu'il se défasse à la fourchette.",
  0, "plat-poulet-citronne-reel"),
 ("Romazava poulet", 29000,
  "Poulet, brèdes mafana, tomate, oignon, gingembre. Servi avec du riz.",
  "Les brèdes mafana font picoter la langue — c'est à ça qu'on le reconnaît.",
  1, "plat-romazava-poulet"),
 ("Romazava viande", 29000,
  "Zébu, brèdes mafana, tomate, oignon, gingembre. Servi avec du riz.",
  "La version d'origine, au zébu. Le plat que toute l'île sait faire, chacun à sa façon.",
  1, "plat-romazava-viande"),
 ("Soupe chinoise — à partir de", 29000,
  "Bouillon, nouilles, légumes, viande ou crevettes. Prix selon la déclinaison.",
  "Un bol brûlant, à touiller longtemps. Le remède à tout.",
  1, "plat-soupe-chinoise-reel"),
 ("Poulet coco", 31000,
  "Poulet mijoté au lait de coco, tomate, oignon, gingembre. Servi avec du riz.",
  "Doux, parfumé, généreux — le plat qu'on commande quand on a faim pour deux.",
  0, "plat-poulet-coco"),
 ("Poulet pané", 31000,
  "Escalope de poulet panée, frite. Accompagnement au choix.",
  "Dorée à la poêle, servie avec ce que vous voulez à côté.",
  0, "plat-poulet-pane"),
 ("Poulet façon KFC", 35000,
  "Morceaux de poulet panés et épicés, frits. Accompagnement au choix.",
  "Sa version, panée épicée et frite minute. Prévoyez des serviettes.",
  1, "plat-poulet-facon-kfc-reel"),
]

DESSERTS = [
 ("Boule de glace", 6000,
  "Une boule, parfum du jour.",
  "La fin de repas la plus courte, et souvent la meilleure.",
  0, "dessert-boule-de-glace"),
 ("Crêpe banane", 11000,
  "Crêpe, banane fraîche.",
  "La banane de l'île dans une crêpe. Rien de plus.",
  0, "dessert-crepe-banane"),
 ("Crêpe confiture ou sucre", 11000,
  "Crêpe, confiture ou sucre.",
  "Le dessert d'enfance, qui marche aussi à 40 ans.",
  0, "dessert-crepe-confiture-ou-sucre"),
 ("Crêpe au chocolat", 13000,
  "Crêpe, chocolat fondu.",
  "Pliée en quatre, le chocolat encore chaud dedans.",
  0, "dessert-crepe-au-chocolat"),
 ("Ananas ou banane flambée", 14000,
  "Ananas ou banane, flambés au rhum.",
  "Flambé devant vous. Le seul dessert qui fait un peu de spectacle.",
  0, "dessert-ananas-banane-flambee"),
 ("Salade de fruits", 14000,
  "Fruits frais de saison, taillés le jour même.",
  "Ce que le marché a donné ce matin, coupé en morceaux.",
  0, "dessert-salade-de-fruits"),
]


# ============================================================ LES BOISSONS
# Releve integral de son second carton. Aucune de ces 39 lignes n'existe en base
# au 24/09/2026. Format : (nom, prix, detail).
#
# CE QUI EST ECRIT DANS `detail` EST SOURCE OU N'EST PAS ECRIT. Quatre bieres de
# sa carte — Queen's, Booster, Racine, et la Gold en degre — n'ont pas de source
# publique fiable : leur `detail` ne porte donc que le format imprime sur son
# carton. Inventer un degre ou un style sur une etiquette qu'on n'a pas vue,
# c'est exactement ce que la charte interdit.

FRAICHES = [
 ("Jus de fruits de saison", 7000, "Pressé du jour"),
 ("Sirop à l'eau", 3000, ""),
 ("Diabolo menthe ou grenadine", 4000, ""),
 ("Eau Vive", 4000, "50 cl"),
 ("Eau Vive", 5000, "150 cl"),
 ("Coca-Cola", 5000, "33 cl"),
 ("Coca-Cola", 7000, "50 cl"),
 ("Boisson sucrée", 4000, "30 cl"),
 ("Boisson sucrée", 9000, "100 cl"),
 ("Boisson énergétique", 8000, ""),
]
FRAICHES_TXT = "De quoi tenir entre deux bains. L'Eau Vive est l'eau de l'île."

CHAUDES = [
 ("Thé ou café", 3000, ""),
 ("Espresso", 4000, ""),
]
CHAUDES_TXT = "Pour ceux qui commencent la journée autrement."

BIERES = [
 ("THB", 7000, "65 cl · pale lager 5,4 %"),
 ("THB", 6000, "33 cl · pale lager 5,4 %"),
 ("THB boîte", 7000, "33 cl"),
 ("THB boîte", 10000, "50 cl"),
 ("Gold", 8000, "65 cl · blonde, brasserie Star"),
 ("Gold blanche boîte", 11000, "50 cl · blanche"),
 ("Gold boîte", 10000, "50 cl"),
 ("Beaufort", 7000, "33 cl · blonde, groupe Castel"),
 ("Beaufort boîte", 11000, "50 cl"),
 ("Queen's", 9000, "65 cl"),
 ("Booster", 8000, "50 cl"),
 ("Racine", 7000, "30 cl"),
 ("Cody's Bière", 12000, "50 cl · 5,4 %"),
 ("Cody's Bière", 12000, "50 cl · 7,5 %"),
 ("Cody's Bière Citron Vodka", 12000, "50 cl · 5,9 %"),
 ("Cody's Vody Energy Vodka", 12000, "25 cl · 18 %"),
]
BIERES_TXT = ("La THB est brassée à Madagascar depuis 1958, c'est la bière du pays. "
              "Les Cody's viennent d'Allemagne, de Brême.")

COCKTAILS = [
 ("Rhum blanc", 6000, "5 cl"),
 ("Rhum arrangé", 7000, "5 cl · macéré maison"),
 ("Mangoustan", 7000, "5 cl · rhum arrangé au mangoustan"),
 ("Punch coco", 7000, "5 cl · rhum, coco"),
 ("Caipirinha", 8000, "Cachaça, citron vert, sucre de canne"),
 ("Mojito", 9000, "Rhum blanc, menthe fraîche, citron vert, sucre de canne"),
]
COCKTAILS_TXT = "Les arrangés macèrent ici, dans leurs bocaux, derrière le bar."

VIN = [
 ("Ballon de vin", 12000, "12 cl"),
 ("Pichet de vin", 35000, "50 cl"),
]
VIN_TXT = "Au verre ou au pichet, rouge ou blanc selon l'arrivage."

SPIRITUEUX = [
 ("Pastis local", 7000, "5 cl"),
 ("Vodka · gin · tequila · whisky local", 8000, "5 cl"),
 ("Alcool importé — whisky, pastis…", 20000, "5 cl"),
]
SPIRITUEUX_TXT = "Servis au 5 cl. L'importé est à part, il coûte ce qu'il coûte."


# ============================================================ L'ORDRE
# Les boissons AVANT les plats : c'est la regle posee sur la carte de Chez Bidul
# & Truc — on commande a boire avant de commander a manger. Son propre carton
# met la cuisine d'abord, mais ce sont deux cartons separes ; ici tout tient
# dans un seul document, et l'ordre de service l'emporte.
SECTIONS = [
    ('Boissons fraîches',        'FRAICHES',        FRAICHES_TXT),
    ('Boissons chaudes',         'CHAUDES',         CHAUDES_TXT),
    ('Les bières',               'BIERES',          BIERES_TXT),
    ('Rhums et cocktails',       'COCKTAILS',       COCKTAILS_TXT),
    ('Le vin',                   'VIN',             VIN_TXT),
    ('Les spiritueux 5 cl',      'SPIRITUEUX',      SPIRITUEUX_TXT),
    ('Nos traditions et entrées','ENTREES',         None),
    ('Grillades au feu de bois', 'GRILLADES',       None),
    ('Accompagnements',          'ACCOMPAGNEMENTS', None),
    ('Sandwichs demi-baguette',  'SANDWICHS',       None),
    ('Plats maison',             'PLATS',           None),
    ('Le coin douceur',          'DESSERTS',        None),
]

MAISON = dict(
    nom='La Plage',
    accroche='Bistrot · Bar',
    lieu='Hell-Ville, Nosy Be',
    horaires='10 h – 15 h et 18 h – 22 h · fermé le lundi',
    tel='+261 32 71 548 96',
)
