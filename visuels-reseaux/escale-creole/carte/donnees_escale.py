# -*- coding: utf-8 -*-
"""LA CARTE DE L'ESCALE CREOLE (Ambatoloaka), relevee le 2026-10-20.

DEUX SOURCES, ET ELLES NE DISENT PAS LA MEME CHOSE :
  - sa carte papier (photo IMG_2541, recto) : bar, desserts, amuses-bouches
    A LA PIECE, omelettes, cafes. Elle ne porte PAS ses plats principaux.
  - la base Taxi Food (restaurant 128e68ab-…) : ses plats tous les jours,
    les lots de 5, les descriptions, les badges porc.
Les prix des deux sources concordent partout ou elles se recoupent
(3 000 Ar la piece x 5 = 15 000 Ar le lot ; sambos zebu/poulet 2 000 x 5 =
10 000 ; bieres et softs identiques).

CHOIX PAR DEFAUT VALIDES PAR LE PORTEUR DU PROJET LE 2026-10-20 :
  1. amuses-bouches : prix a la piece ET prix du lot de 5 ;
  2. bol renverse : poulet, zebu OU CREVETTES (sa carte papier) — la base
     n'a que poulet ou zebu ;
  3. tout ce qui n'est pas dans l'appli (alcools, desserts, cafes,
     omelettes) est imprime, mais marque « sur place » ;
  4. prix ouverts (beignets, soupe chinoise) : « des ».

LES PLATS DU JOUR NE SONT PAS LISTES AVEC UN PRIX : ils changent, la carte
renvoie au tableau. Les quatre plats « a l'affiche » en base sont cites
comme EXEMPLES, sans prix.

Un plat = dict : nom, prix, ig (ingredients), pr (presentation, de nous),
photo (fichier de ../visuels sans extension), porc, des (prix « des »),
unite (suffixe du prix), lot (texte du lot de 5).
"""

PLATS = [
 dict(nom="Rougail saucisses", prix=38000, porc=1, photo="pj-rougail-saucisses",
      ig="Saucisses de porc fumées, tomates, oignons, ail, gingembre, curcuma, une pointe de piment.",
      pr="Le plat du dimanche à La Réunion. Ici, tous les jours."),
 dict(nom="Saucisse frite", prix=38000, porc=1,
      ig="Saucisses de porc dorées à la poêle, croustillantes dehors, fondantes dedans."),
 dict(nom="Bol renversé", prix=32000, photo="pj-bol-renverse",
      ig="Poulet, zébu ou crevettes, légumes sautés au wok, sauce soja, riz blanc, œuf au plat.",
      pr="Tassé à l'envers dans le bol, retourné sur l'assiette au moment de servir."),
 dict(nom="Riz frit poulet ou zébu", prix=35000,
      ig="Riz sauté au wok, œuf, oignon, petits légumes, sauce soja."),
 dict(nom="Émincé de zébu", prix=35000, photo="pj-emince-zebu-oignons",
      ig="Fines lamelles de zébu saisies à feu vif, au choix : <b>brède chinois</b>, "
         "<b>poivre vert</b>, <b>oignons</b> ou <b>gingembre</b>."),
 dict(nom="Émincé de poulet", prix=35000, photo="pj-emince-poulet-brede",
      ig="Fines lamelles de poulet saisies à feu vif, au choix : <b>brède chinois</b>, "
         "<b>poivre vert</b>, <b>oignons</b> ou <b>gingembre</b>.",
      pr="Le brède tombe juste le temps qu'il faut : il reste croquant."),
]
PLATS_SS = "Servis avec du riz et des grains (haricots blancs)."

# L'ardoise : AUCUN PRIX, des exemples seulement (les plats a l'affiche en base).
ARDOISE_EX = ["Massalé cabri", "Rôti de porc à la créole",
              "Poisson frit entier", "Sauté de porc aux gros piments"]

AMUSES = [
 dict(nom="Demi-lunes poulet", prix=3000, unite="la pièce", lot="15 000 Ar le lot de 5",
      photo="ab-demi-lune-poulet",
      ig="Pâte fine pliée en demi-lune, poulet haché, oignon, ail, épices. Frites."),
 dict(nom="Bouchons porc", prix=3000, unite="la pièce", lot="15 000 Ar le lot de 5", porc=1,
      ig="Pâte fine farcie de porc haché, cuits à la vapeur. Sauce soja, avec ou sans piment."),
 dict(nom="Sambos fromage", prix=3000, unite="la pièce", lot="15 000 Ar le lot de 5",
      ig="Pâte fine pliée en triangle, fromage fondant. Frits."),
 dict(nom="Sambos zébu ou poulet", prix=2000, unite="la pièce", lot="10 000 Ar le lot de 5",
      photo="ab-sambos-zebu",
      ig="Pâte fine pliée en triangle, zébu ou poulet haché, oignon, ail, épices. Frits."),
 dict(nom="Beignets crevettes ou calamars", prix=20000, des=1,
      ig="Pâte à beignet légère, frits bien dorés. 8 à 12 pièces selon la portion."),
 dict(nom="Soupe chinoise", prix=25000, des=1,
      ig="Bouillon au gingembre, nouilles, viande, légumes, œuf, ciboule."),
 dict(nom="Assiette de crudité", prix=7000, photo="ab-assiette-crudite",
      ig="Carottes, chou blanc, tomate, concombre, poivrons, salade."),
]

OMELETTES = [("Omelette nature", 8000, None), ("Omelette fromage", 10000, None)]

DESSERTS = [
 ("Milk-shake", 8000, "vanille, chocolat ou banane"),
 ("Banana split", 16000, None),
 ("Coupe colonel", 18000, "vodka, sorbet citron"),
]
# Sa carte papier les montre en photo, SANS PRIX. On ne l'invente pas.
DESSERTS_SANS_PRIX = "Mousse au chocolat · Nougat glacé · Gâteau au chocolat"

SOFTS = [
 ("Coca · Sprite · Fanta", 6000, "30 cl"),
 ("Tonic · Cristal · Grenadine · Bonbon anglais", 5000, None),
 ("Jus de fruit frais", 6000, "selon saison"),
 ("Eau Vive", 6000, "grand modèle"),
 ("Eau Vive", 4000, "petit modèle"),
 ("Sirop", 2000, None),
]
CHAUDES = [("Café Mokarabia", 5000, None), ("Thé", 6000, None), ("Café au lait", 7000, None)]
BIERES = [
 ("Gold blanche", 7000, "33 cl"), ("Gold · THB", 8000, "65 cl"),
 ("Fresh", 5000, "33 cl"), ("Beaufort", 7000, None),
]
VIN = [("Vin au verre", 14000, "rouge, rosé ou blanc")]
APERITIFS = [
 ("Pastis local", 6000, "servi avec de l'eau filtrée"),
 ("Pastis ou Ricard importé", 15000, "servi avec une Eau Vive PM"),
 ("Kir crème de cassis", 18000, None),
 ("Gin · Vodka", 9000, None),
 ("Martini", 15000, "rouge ou blanc"),
]
WHISKY = [("J&B", 20000, None), ("Johnnie Walker Red", 20000, None),
          ("Johnnie Walker Black", 25000, None)]
RHUMS = [("Rhum blanc", 5000, None), ("Rhums arrangés", 6000, None),
         ("Rhum mangoustan", 9000, None), ("Rhum menthe", 8000, "glace arak")]
COCKTAILS = [
 ("Caïpirinha ou mojito", 9000, "blanc"),
 ("Caïpirinha ou mojito", 12000, "mangoustan"),
 ("Caïpirinha ou mojito", 7000, "citron"),
 ("Petit Réunionnais", 10000, None),
]

SUR_PLACE = "Servis sur place."
# (titre, forme, donnees, sous-titre). Forme 'groupe' : une liste de
# (sous-titre, lignes) — une seule barre et une seule mention « sur place »
# pour tout le bar, au lieu de six.
SECTIONS = [
 ("Plats tous les jours", 'plat',    PLATS,     PLATS_SS),
 ("L'ardoise du jour",    'ardoise', None,      None),
 ("Amuses-bouches",       'plat',    AMUSES,    None),
 ("À boire, à emporter",  'groupe',  [("Softs et jus", SOFTS), ("Bières", BIERES)],
  "Aussi livrés avec Taxi Food."),
 ("Omelettes et desserts", 'groupe', [("Omelettes", OMELETTES), ("Desserts et glaces", DESSERTS)],
  SUR_PLACE),
 ("Au bar",               'groupe',  [("Boissons chaudes", CHAUDES), ("Vin", VIN),
                                      ("Apéritifs", APERITIFS), ("Whiskys", WHISKY),
                                      ("Rhums", RHUMS), ("Cocktails — au rhum", COCKTAILS)], SUR_PLACE),
]
