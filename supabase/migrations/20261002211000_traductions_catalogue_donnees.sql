-- Première traduction du catalogue (anglais + italien), 2026-10-02 : 785 textes.
-- Produite par trois agents (noms de plats, descriptions, textes courts) puis relue ; plats
-- malgaches et locaux : nom gardé + courte explication (décision du porteur du projet).
-- Rejouable : on conflict met à jour. Les textes ajoutés ensuite se traduisent un par un
-- (voir admin_textes_a_traduire()).
with x as (select * from jsonb_to_recordset($tr$[
{
"fr": "Dessert",
"en": "Dessert",
"it": "Dessert"
},
{
"fr": "Entrée",
"en": "Starter",
"it": "Antipasto"
},
{
"fr": "Nos traditions et entrées",
"en": "Our traditional dishes & starters",
"it": "Le nostre tradizioni e antipasti"
},
{
"fr": "Plat du jour",
"en": "Today's special",
"it": "Piatto del giorno"
},
{
"fr": "Plats maison",
"en": "Homemade dishes",
"it": "Piatti della casa"
},
{
"fr": "Sandwichs & Repas",
"en": "Sandwiches & Meals",
"it": "Panini & Pasti"
},
{
"fr": "Amuses-bouches",
"en": "Appetizers",
"it": "Stuzzichini"
},
{
"fr": "Apéritifs",
"en": "Aperitifs",
"it": "Aperitivi"
},
{
"fr": "Bières",
"en": "Beers",
"it": "Birre"
},
{
"fr": "Brasero",
"en": "Brasero (charcoal grill)",
"it": "Braciere"
},
{
"fr": "Burger",
"en": "Burger",
"it": "Burger"
},
{
"fr": "Burgers",
"en": "Burgers",
"it": "Burger"
},
{
"fr": "Côté mer",
"en": "From the sea",
"it": "Dal mare"
},
{
"fr": "Côté terre",
"en": "From the land",
"it": "Dalla terra"
},
{
"fr": "Crêpes",
"en": "Crêpes",
"it": "Crêpes"
},
{
"fr": "Eaux",
"en": "Water",
"it": "Acqua"
},
{
"fr": "Entrées",
"en": "Starters",
"it": "Antipasti"
},
{
"fr": "Entrées & à partager",
"en": "Starters & sharing plates",
"it": "Antipasti & da condividere"
},
{
"fr": "Entrées chaudes",
"en": "Hot starters",
"it": "Antipasti caldi"
},
{
"fr": "Entrées froides",
"en": "Cold starters",
"it": "Antipasti freddi"
},
{
"fr": "Extras",
"en": "Extras",
"it": "Extra"
},
{
"fr": "Grillades au feu de bois",
"en": "Wood-fired grills",
"it": "Grigliate alla brace di legna"
},
{
"fr": "Hamburger",
"en": "Hamburger",
"it": "Hamburger"
},
{
"fr": "Le coin douceur",
"en": "Sweet corner",
"it": "Angolo dolce"
},
{
"fr": "Milkshakes",
"en": "Milkshakes",
"it": "Milkshake"
},
{
"fr": "Pâtes",
"en": "Pasta",
"it": "Pasta"
},
{
"fr": "Pizza",
"en": "Pizza",
"it": "Pizza"
},
{
"fr": "Pizzas",
"en": "Pizzas",
"it": "Pizze"
},
{
"fr": "Plat",
"en": "Main course",
"it": "Piatto"
},
{
"fr": "Plats",
"en": "Main courses",
"it": "Piatti"
},
{
"fr": "Plats du jour",
"en": "Today's specials",
"it": "Piatti del giorno"
},
{
"fr": "Riz, nouilles & bols",
"en": "Rice, noodles & bowls",
"it": "Riso, noodles & bowl"
},
{
"fr": "Sandwichs demi-baguette",
"en": "Half-baguette sandwiches",
"it": "Panini mezza baguette"
},
{
"fr": "Softs",
"en": "Soft drinks",
"it": "Bibite"
},
{
"fr": "Soupes",
"en": "Soups",
"it": "Zuppe"
},
{
"fr": "Sur commande",
"en": "Made to order",
"it": "Su ordinazione"
},
{
"fr": "Tapas",
"en": "Tapas",
"it": "Tapas"
},
{
"fr": "Ti pan — à la plancha",
"en": "Ti pan — on the plancha",
"it": "Ti pan — alla piastra"
},
{
"fr": "Viandes",
"en": "Meats",
"it": "Carni"
},
{
"fr": "Wok & sautés",
"en": "Wok & stir-fries",
"it": "Wok & saltati"
},
{
"fr": "Bistrot & bar",
"en": "Bistro & bar",
"it": "Bistrot & bar"
},
{
"fr": "Brasserie, zébu & pizzeria",
"en": "Brasserie, zebu & pizzeria",
"it": "Brasserie, zebù & pizzeria"
},
{
"fr": "Cuisine créole réunionnaise",
"en": "Réunion Creole cuisine",
"it": "Cucina creola della Riunione"
},
{
"fr": "Cuisine marocaine",
"en": "Moroccan cuisine",
"it": "Cucina marocchina"
},
{
"fr": "Cuisine thaïlandaise",
"en": "Thai cuisine",
"it": "Cucina thailandese"
},
{
"fr": "Pizzeria & Pâtes italiennes",
"en": "Pizzeria & Italian pasta",
"it": "Pizzeria & Pasta italiana"
},
{
"fr": "Restaurant chinois",
"en": "Chinese restaurant",
"it": "Ristorante cinese"
},
{
"fr": "Restaurant, bar & tapas",
"en": "Restaurant, bar & tapas",
"it": "Ristorante, bar & tapas"
},
{
"fr": "Snacks, Burgers & Crêpes",
"en": "Snacks, Burgers & Crêpes",
"it": "Snack, Burger & Crêpes"
},
{
"fr": "Boîte à pizza",
"en": "Pizza box",
"it": "Cartone pizza"
},
{
"fr": "Consigne bouteille",
"en": "Bottle deposit",
"it": "Cauzione bottiglia"
},
{
"fr": "Emballage à emporter",
"en": "Takeaway packaging",
"it": "Imballaggio da asporto"
},
{
"fr": "2e accompagnement (+5 000 Ar)",
"en": "2nd side (+5 000 Ar)",
"it": "2° contorno (+5 000 Ar)"
},
{
"fr": "Accompagnement",
"en": "Side",
"it": "Contorno"
},
{
"fr": "Accompagnement (+5 000 Ar)",
"en": "Side (+5 000 Ar)",
"it": "Contorno (+5 000 Ar)"
},
{
"fr": "Accompagnement (1 au choix, inclus)",
"en": "Side (choose 1, included)",
"it": "Contorno (1 a scelta, incluso)"
},
{
"fr": "Accompagnement (inclus)",
"en": "Side (included)",
"it": "Contorno (incluso)"
},
{
"fr": "Accompagnement supplémentaire",
"en": "Extra side",
"it": "Contorno extra"
},
{
"fr": "Au choix",
"en": "Your choice",
"it": "A scelta"
},
{
"fr": "Avec ou sans porc",
"en": "With or without pork",
"it": "Con o senza maiale"
},
{
"fr": "Choix (1 au choix)",
"en": "Choice (choose 1)",
"it": "Scelta (1 a scelta)"
},
{
"fr": "Choix de la viande",
"en": "Choice of meat",
"it": "Scelta della carne"
},
{
"fr": "Crevette ou calamar",
"en": "Shrimp or squid",
"it": "Gambero o calamaro"
},
{
"fr": "Format",
"en": "Size",
"it": "Formato"
},
{
"fr": "Fromage au choix",
"en": "Choice of cheese",
"it": "Formaggio a scelta"
},
{
"fr": "Fruit",
"en": "Fruit",
"it": "Frutta"
},
{
"fr": "Garniture",
"en": "Filling",
"it": "Farcitura"
},
{
"fr": "Garniture au choix",
"en": "Choice of filling",
"it": "Farcitura a scelta"
},
{
"fr": "Nappage au choix",
"en": "Choice of topping",
"it": "Topping a scelta"
},
{
"fr": "Œuf",
"en": "Egg",
"it": "Uovo"
},
{
"fr": "Poisson au choix",
"en": "Choice of fish",
"it": "Pesce a scelta"
},
{
"fr": "Préparation au choix",
"en": "Choice of preparation",
"it": "Preparazione a scelta"
},
{
"fr": "Salade au choix",
"en": "Choice of salad",
"it": "Insalata a scelta"
},
{
"fr": "Sauce",
"en": "Sauce",
"it": "Salsa"
},
{
"fr": "Sauce au choix",
"en": "Choice of sauce",
"it": "Salsa a scelta"
},
{
"fr": "Sauce supplémentaire",
"en": "Extra sauce",
"it": "Salsa extra"
},
{
"fr": "Supplément",
"en": "Extra",
"it": "Aggiunta"
},
{
"fr": "Supplément garniture",
"en": "Extra filling",
"it": "Farcitura extra"
},
{
"fr": "Supplément nappage",
"en": "Extra topping",
"it": "Topping extra"
},
{
"fr": "Suppléments",
"en": "Extras",
"it": "Aggiunte"
},
{
"fr": "Taille (1 au choix)",
"en": "Size (choose 1)",
"it": "Misura (1 a scelta)"
},
{
"fr": "Viande au choix",
"en": "Choice of meat",
"it": "Carne a scelta"
},
{
"fr": "+ Bacon",
"en": "+ Bacon",
"it": "+ Bacon"
},
{
"fr": "+ Bleu",
"en": "+ Blue cheese",
"it": "+ Formaggio erborinato"
},
{
"fr": "+ Chantilly",
"en": "+ Whipped cream",
"it": "+ Panna montata"
},
{
"fr": "+ Cheddar",
"en": "+ Cheddar",
"it": "+ Cheddar"
},
{
"fr": "+ Coulis chocolat",
"en": "+ Chocolate sauce",
"it": "+ Salsa al cioccolato"
},
{
"fr": "+ Crevettes",
"en": "+ Shrimp",
"it": "+ Gamberi"
},
{
"fr": "+ Frites",
"en": "+ Fries",
"it": "+ Patatine fritte"
},
{
"fr": "+ Fromage",
"en": "+ Cheese",
"it": "+ Formaggio"
},
{
"fr": "+ Glace vanille",
"en": "+ Vanilla ice cream",
"it": "+ Gelato alla vaniglia"
},
{
"fr": "+ Légumes sautés",
"en": "+ Sautéed vegetables",
"it": "+ Verdure saltate"
},
{
"fr": "+ Oignon",
"en": "+ Onion",
"it": "+ Cipolla"
},
{
"fr": "+ Oignon caramélisé",
"en": "+ Caramelized onion",
"it": "+ Cipolla caramellata"
},
{
"fr": "+ Oignons caramélisés",
"en": "+ Caramelized onions",
"it": "+ Cipolle caramellate"
},
{
"fr": "+ Pâtes",
"en": "+ Pasta",
"it": "+ Pasta"
},
{
"fr": "+ Poitrine",
"en": "+ Pork belly",
"it": "+ Pancetta"
},
{
"fr": "+ Pommes sautées",
"en": "+ Sautéed potatoes",
"it": "+ Patate saltate"
},
{
"fr": "+ Poulet",
"en": "+ Chicken",
"it": "+ Pollo"
},
{
"fr": "+ Poulet croustillant",
"en": "+ Crispy chicken",
"it": "+ Pollo croccante"
},
{
"fr": "+ Raclette",
"en": "+ Raclette",
"it": "+ Raclette"
},
{
"fr": "+ Riz blanc",
"en": "+ White rice",
"it": "+ Riso bianco"
},
{
"fr": "+ Salade",
"en": "+ Salad",
"it": "+ Insalata"
},
{
"fr": "+ Steak",
"en": "+ Steak",
"it": "+ Hamburger di manzo"
},
{
"fr": "+ Tomate",
"en": "+ Tomato",
"it": "+ Pomodoro"
},
{
"fr": "+ Viande",
"en": "+ Meat",
"it": "+ Carne"
},
{
"fr": "3 poivres",
"en": "3-pepper",
"it": "3 pepi"
},
{
"fr": "Agneau",
"en": "Lamb",
"it": "Agnello"
},
{
"fr": "Ail",
"en": "Garlic",
"it": "Aglio"
},
{
"fr": "Algérienne",
"en": "Algérienne",
"it": "Algérienne"
},
{
"fr": "Ananas",
"en": "Pineapple",
"it": "Ananas"
},
{
"fr": "Anchois",
"en": "Anchovies",
"it": "Acciughe"
},
{
"fr": "Andalouse",
"en": "Andalouse",
"it": "Andalouse"
},
{
"fr": "Au plat",
"en": "Fried",
"it": "All'occhio di bue"
},
{
"fr": "Aubergine",
"en": "Eggplant",
"it": "Melanzana"
},
{
"fr": "Avec porc",
"en": "With pork",
"it": "Con maiale"
},
{
"fr": "Bacon",
"en": "Bacon",
"it": "Bacon"
},
{
"fr": "Bacon frit",
"en": "Fried bacon",
"it": "Bacon fritto"
},
{
"fr": "Banane",
"en": "Banana",
"it": "Banana"
},
{
"fr": "Basilic",
"en": "Basil",
"it": "Basilico"
},
{
"fr": "Blanche",
"en": "White sauce",
"it": "Salsa bianca"
},
{
"fr": "Bleu",
"en": "Blue cheese",
"it": "Formaggio erborinato"
},
{
"fr": "Bœuf",
"en": "Beef",
"it": "Manzo"
},
{
"fr": "Brownie",
"en": "Brownie",
"it": "Brownie"
},
{
"fr": "Calamar",
"en": "Squid",
"it": "Calamaro"
},
{
"fr": "Calamars",
"en": "Squid",
"it": "Calamari"
},
{
"fr": "Calmar",
"en": "Squid",
"it": "Calamaro"
},
{
"fr": "Caramel",
"en": "Caramel",
"it": "Caramello"
},
{
"fr": "Champignon",
"en": "Mushroom",
"it": "Funghi"
},
{
"fr": "Champignons",
"en": "Mushrooms",
"it": "Funghi"
},
{
"fr": "Chocolat",
"en": "Chocolate",
"it": "Cioccolato"
},
{
"fr": "Citron confit",
"en": "Preserved lemon",
"it": "Limone candito"
},
{
"fr": "Combava",
"en": "Combava (kaffir lime)",
"it": "Combava (lime kaffir)"
},
{
"fr": "Confiture",
"en": "Jam",
"it": "Marmellata"
},
{
"fr": "Cookies",
"en": "Cookies",
"it": "Cookies"
},
{
"fr": "Courgette",
"en": "Zucchini",
"it": "Zucchina"
},
{
"fr": "Crevette",
"en": "Shrimp",
"it": "Gambero"
},
{
"fr": "Crevettes",
"en": "Shrimp",
"it": "Gamberi"
},
{
"fr": "Curry",
"en": "Curry",
"it": "Curry"
},
{
"fr": "Divers fromages",
"en": "Assorted cheeses",
"it": "Formaggi misti"
},
{
"fr": "En omelette",
"en": "Omelette",
"it": "In frittata"
},
{
"fr": "Espadon",
"en": "Swordfish",
"it": "Pesce spada"
},
{
"fr": "Fraise",
"en": "Strawberry",
"it": "Fragola"
},
{
"fr": "Frites",
"en": "Fries",
"it": "Patatine fritte"
},
{
"fr": "Fromage",
"en": "Cheese",
"it": "Formaggio"
},
{
"fr": "Fromage râpé",
"en": "Grated cheese",
"it": "Formaggio grattugiato"
},
{
"fr": "Gingembre",
"en": "Ginger",
"it": "Zenzero"
},
{
"fr": "Gorgonzola",
"en": "Gorgonzola",
"it": "Gorgonzola"
},
{
"fr": "Grand modèle",
"en": "Large",
"it": "Grande"
},
{
"fr": "Haricots verts",
"en": "Green beans",
"it": "Fagiolini"
},
{
"fr": "Harissa",
"en": "Harissa",
"it": "Harissa"
},
{
"fr": "Jambon cru",
"en": "Cured ham",
"it": "Prosciutto crudo"
},
{
"fr": "Jambon italien",
"en": "Italian ham",
"it": "Prosciutto italiano"
},
{
"fr": "Ketchup",
"en": "Ketchup",
"it": "Ketchup"
},
{
"fr": "Lait concentré",
"en": "Condensed milk",
"it": "Latte condensato"
},
{
"fr": "Légumes",
"en": "Vegetables",
"it": "Verdure"
},
{
"fr": "Légumes sautés",
"en": "Sautéed vegetables",
"it": "Verdure saltate"
},
{
"fr": "Mayonnaise",
"en": "Mayonnaise",
"it": "Maionese"
},
{
"fr": "Merguez",
"en": "Merguez",
"it": "Merguez"
},
{
"fr": "Miel",
"en": "Honey",
"it": "Miele"
},
{
"fr": "Moutarde",
"en": "Mustard",
"it": "Senape"
},
{
"fr": "Mozzarella",
"en": "Mozzarella",
"it": "Mozzarella"
},
{
"fr": "Nugget",
"en": "Nugget",
"it": "Nugget"
},
{
"fr": "Oignon",
"en": "Onion",
"it": "Cipolla"
},
{
"fr": "Olive noire",
"en": "Black olive",
"it": "Oliva nera"
},
{
"fr": "Olives noires",
"en": "Black olives",
"it": "Olive nere"
},
{
"fr": "Oreos",
"en": "Oreos",
"it": "Oreo"
},
{
"fr": "Parmesan",
"en": "Parmesan",
"it": "Parmigiano"
},
{
"fr": "Petit modèle",
"en": "Small",
"it": "Piccola"
},
{
"fr": "Poireaux",
"en": "Leek",
"it": "Porri"
},
{
"fr": "Poisson",
"en": "Fish",
"it": "Pesce"
},
{
"fr": "Poisson fumé",
"en": "Smoked fish",
"it": "Pesce affumicato"
},
{
"fr": "Poivre vert",
"en": "Green pepper",
"it": "Pepe verde"
},
{
"fr": "Pommes de terre frites",
"en": "Fried potatoes",
"it": "Patate fritte"
},
{
"fr": "Pommes sautées",
"en": "Sautéed potatoes",
"it": "Patate saltate"
},
{
"fr": "Porc",
"en": "Pork",
"it": "Maiale"
},
{
"fr": "Poulet",
"en": "Chicken",
"it": "Pollo"
},
{
"fr": "Poulet frit",
"en": "Fried chicken",
"it": "Pollo fritto"
},
{
"fr": "Provençale",
"en": "Provençale",
"it": "Provenzale"
},
{
"fr": "Pruneaux",
"en": "Prunes",
"it": "Prugne secche"
},
{
"fr": "Purée",
"en": "Mashed potatoes",
"it": "Purè"
},
{
"fr": "Ricotta salée",
"en": "Ricotta salata",
"it": "Ricotta salata"
},
{
"fr": "Riz",
"en": "Rice",
"it": "Riso"
},
{
"fr": "Riz blanc",
"en": "White rice",
"it": "Riso bianco"
},
{
"fr": "Riz safrané",
"en": "Saffron rice",
"it": "Riso allo zafferano"
},
{
"fr": "Rougail tomate",
"en": "Tomato rougail (Creole tomato relish)",
"it": "Rougail di pomodoro (salsa creola)"
},
{
"fr": "Salade",
"en": "Salad",
"it": "Insalata"
},
{
"fr": "Salade crudité",
"en": "Raw vegetable salad",
"it": "Insalata di verdure crude"
},
{
"fr": "Salade mixte",
"en": "Mixed salad",
"it": "Insalata mista"
},
{
"fr": "Salade verte",
"en": "Green salad",
"it": "Insalata verde"
},
{
"fr": "Salame (chorizo) italien",
"en": "Italian salame (chorizo)",
"it": "Salame italiano (chorizo)"
},
{
"fr": "Samouraï",
"en": "Samouraï",
"it": "Samouraï"
},
{
"fr": "Sans porc",
"en": "Without pork",
"it": "Senza maiale"
},
{
"fr": "Sans sauce",
"en": "No sauce",
"it": "Senza salsa"
},
{
"fr": "Sauce barbecue",
"en": "Barbecue sauce",
"it": "Salsa barbecue"
},
{
"fr": "Sauce bolognaise",
"en": "Bolognese sauce",
"it": "Ragù alla bolognese"
},
{
"fr": "Simple",
"en": "Regular",
"it": "Semplice"
},
{
"fr": "Spécial",
"en": "Special",
"it": "Speciale"
},
{
"fr": "Spéculoos",
"en": "Speculoos",
"it": "Speculoos"
},
{
"fr": "Steak",
"en": "Steak",
"it": "Hamburger di manzo"
},
{
"fr": "Steak grillé",
"en": "Grilled steak",
"it": "Bistecca alla griglia"
},
{
"fr": "Steak milanaise",
"en": "Steak milanese",
"it": "Cotoletta alla milanese"
},
{
"fr": "Sucre",
"en": "Sugar",
"it": "Zucchero"
},
{
"fr": "Tazar",
"en": "Tazar (kingfish)",
"it": "Tazar (sgombro reale)"
},
{
"fr": "Tenders",
"en": "Tenders",
"it": "Tenders"
},
{
"fr": "Tomate",
"en": "Tomato",
"it": "Pomodoro"
},
{
"fr": "Tomate en tranches",
"en": "Sliced tomato",
"it": "Pomodoro a fette"
},
{
"fr": "Tomate tranchée",
"en": "Sliced tomato",
"it": "Pomodoro a fette"
},
{
"fr": "Vanille",
"en": "Vanilla",
"it": "Vaniglia"
},
{
"fr": "Viande hachée",
"en": "Minced meat",
"it": "Carne macinata"
},
{
"fr": "Zébu",
"en": "Zebu",
"it": "Zebù"
},
{
"fr": "10 pièces.",
"en": "10 pieces.",
"it": "10 pezzi."
},
{
"fr": "10 van tan, 10 demi-lunes, environ 400 g de pâtes, garniture tsa siou et un œuf au plat ou en omelette.",
"en": "10 van tan (wontons), 10 half-moon dumplings, about 400 g of noodles, tsa siou (char siu pork) topping and a fried egg or omelette.",
"it": "10 van tan (wonton), 10 mezzelune, circa 400 g di pasta, guarnizione tsa siou (maiale char siu) e un uovo all'occhio di bue o in frittata."
},
{
"fr": "2 brochettes.",
"en": "2 skewers.",
"it": "2 spiedini."
},
{
"fr": "2 nems grand modèle.",
"en": "2 large nems (spring rolls).",
"it": "2 nem (involtini primavera) formato grande."
},
{
"fr": "2 steak, 2 cheddar, bacon, bleu, oignons caramélisés, salade, tomate. Frites incluses.",
"en": "2 patties, 2 cheddar, bacon, blue cheese, caramelised onions, lettuce, tomato. Fries included.",
"it": "2 hamburger, 2 cheddar, bacon, formaggio erborinato, cipolle caramellate, insalata, pomodoro. Patatine incluse."
},
{
"fr": "2 steak, 2 cheddar, salade, oignon, tomate. Frites incluses.",
"en": "2 patties, 2 cheddar, lettuce, onion, tomato. Fries included.",
"it": "2 hamburger, 2 cheddar, insalata, cipolla, pomodoro. Patatine incluse."
},
{
"fr": "4 nems cocktail, 6 van tan frits, 6 demi-lunes frites.",
"en": "4 mini nems (spring rolls), 6 fried van tan (wontons), 6 fried half-moon dumplings.",
"it": "4 mini nem (involtini primavera), 6 van tan (wonton) fritti, 6 mezzelune fritte."
},
{
"fr": "6 pièces.",
"en": "6 pieces.",
"it": "6 pezzi."
},
{
"fr": "À commander 24 h à l'avance, 2 personnes minimum. Prix par personne.",
"en": "To be ordered 24 hours in advance, minimum 2 people. Price per person.",
"it": "Da ordinare con 24 ore di anticipo, minimo 2 persone. Prezzo a persona."
},
{
"fr": "Ail, tomate, persil, moules",
"en": "Garlic, tomato, parsley, mussels",
"it": "Aglio, pomodoro, prezzemolo, cozze"
},
{
"fr": "Au choix : crevettes, calamar ou poisson. Pâte à beignet, frits minute. Les 10.",
"en": "Your choice: shrimp, squid or fish. In batter, fried to order. 10 pieces.",
"it": "A scelta: gamberi, calamari o pesce. In pastella, fritti al momento. 10 pezzi."
},
{
"fr": "Aubergines, champignons, carottes, courgettes",
"en": "Aubergines, mushrooms, carrots, courgettes",
"it": "Melanzane, funghi, carote, zucchine"
},
{
"fr": "Avec salade verte, tazar ou espadon",
"en": "With green salad, tazar (kingfish) or swordfish",
"it": "Con insalata verde, tazar (sgombro reale) o pesce spada"
},
{
"fr": "Bananes, sucre, rhum flambé.",
"en": "Bananas, sugar, flambéed with rum.",
"it": "Banane, zucchero, flambate al rum."
},
{
"fr": "Beignets de crevettes ou de calamars, en portion.",
"en": "Shrimp or squid fritters, by the portion.",
"it": "Frittelle di gamberi o di calamari, a porzione."
},
{
"fr": "Blanc de poulet, jambon, fromage, pané, crème de poireaux. Accompagnement inclus.",
"en": "Chicken breast, ham, cheese, breaded, leek cream sauce. Side included.",
"it": "Petto di pollo, prosciutto cotto, formaggio, impanato, crema di porri. Contorno incluso."
},
{
"fr": "Bouchon vapeur au porc, à la réunionnaise. Prix à la pièce.",
"en": "Steamed pork dumpling (bouchon), Réunion style. Price per piece.",
"it": "Raviolo al vapore di maiale (bouchon), alla riunionese. Prezzo al pezzo."
},
{
"fr": "Brochette de crevette, de calamar et de poisson, accompagnement au choix.",
"en": "Shrimp, squid and fish skewer, side of your choice.",
"it": "Spiedino di gamberi, calamari e pesce, contorno a scelta."
},
{
"fr": "Brochette de filet de zébu grillée au brasero.",
"en": "Zebu beef fillet skewer, grilled over the brazier.",
"it": "Spiedino di filetto di manzo zebù, grigliato alla brace."
},
{
"fr": "Brochette de filet mignon de porc grillée au brasero.",
"en": "Pork tenderloin skewer, grilled over the brazier.",
"it": "Spiedino di filetto di maiale, grigliato alla brace."
},
{
"fr": "Brochette de poisson du jour grillée au brasero.",
"en": "Catch-of-the-day fish skewer, grilled over the brazier.",
"it": "Spiedino di pesce del giorno, grigliato alla brace."
},
{
"fr": "Brochette de poulet grillée au brasero.",
"en": "Chicken skewer, grilled over the brazier.",
"it": "Spiedino di pollo, grigliato alla brace."
},
{
"fr": "Cabri au massala, accompagnement au choix.",
"en": "Goat in massala spices, side of your choice.",
"it": "Capretto al massala (miscela di spezie), contorno a scelta."
},
{
"fr": "Cabri mijoté au massalé. Servi avec grains et piments.",
"en": "Goat slow-cooked in massalé spices. Served with grains (pulses) and chilli.",
"it": "Capretto stufato al massalé (miscela di spezie). Servito con grains (legumi) e peperoncino."
},
{
"fr": "Calamar grillé, accompagnement au choix.",
"en": "Grilled squid, side of your choice.",
"it": "Calamari alla griglia, contorno a scelta."
},
{
"fr": "Calamar sauté ail et persil, accompagnement au choix.",
"en": "Squid sautéed with garlic and parsley, side of your choice.",
"it": "Calamari saltati con aglio e prezzemolo, contorno a scelta."
},
{
"fr": "Camembert pané et frit, salade, confiture de fruits rouges.",
"en": "Breaded and fried Camembert, salad, red berry jam.",
"it": "Camembert impanato e fritto, insalata, confettura di frutti rossi."
},
{
"fr": "Capitaine grillé au brasero, citron.",
"en": "Capitaine (local white fish) grilled over the brazier, lemon.",
"it": "Capitaine (pesce bianco locale) grigliato alla brace, limone."
},
{
"fr": "Carangue entière frite. Servie avec grains et piments.",
"en": "Whole fried trevally. Served with grains (pulses) and chilli.",
"it": "Carangide intero fritto. Servito con grains (legumi) e peperoncino."
},
{
"fr": "Carottes, chou blanc, tomate, concombre, poivrons, salade.",
"en": "Carrots, white cabbage, tomato, cucumber, peppers, lettuce.",
"it": "Carote, cavolo bianco, pomodoro, cetriolo, peperoni, insalata."
},
{
"fr": "Carottes, chou blanc, tomate, salade, poivrons.",
"en": "Carrots, white cabbage, tomato, lettuce, peppers.",
"it": "Carote, cavolo bianco, pomodoro, insalata, peperoni."
},
{
"fr": "Chausson frit au poulet. Prix à la pièce.",
"en": "Fried chicken turnover. Price per piece.",
"it": "Fagottino fritto al pollo. Prezzo al pezzo."
},
{
"fr": "Chocolat noir, œufs, montée maison.",
"en": "Dark chocolate, eggs, whipped in-house.",
"it": "Cioccolato fondente, uova, montata in casa."
},
{
"fr": "Citron vert, sucre de canne, glace pilée.",
"en": "Lime, cane sugar, crushed ice.",
"it": "Lime, zucchero di canna, ghiaccio tritato."
},
{
"fr": "Côte de porc échine grillée au brasero.",
"en": "Pork shoulder chop, grilled over the brazier.",
"it": "Braciola di coppa di maiale, grigliata alla brace."
},
{
"fr": "Côte de zébu maturée, grillée au brasero.",
"en": "Aged zebu beef rib steak, grilled over the brazier.",
"it": "Costata di manzo zebù frollata, grigliata alla brace."
},
{
"fr": "Côte de zébu, accompagnement au choix, sauce au champignon et vin.",
"en": "Zebu beef rib steak, side of your choice, mushroom and wine sauce.",
"it": "Costata di manzo zebù, contorno a scelta, salsa ai funghi e vino."
},
{
"fr": "Côtes de zébu grillées au feu de bois. Accompagnement au choix : frites, pommes sautées, riz, salade, légumes sautés ou pâtes.",
"en": "Zebu beef ribs grilled over a wood fire. Side of your choice: fries, sautéed potatoes, rice, salad, sautéed vegetables or pasta.",
"it": "Costate di manzo zebù grigliate sul fuoco a legna. Contorno a scelta: patatine fritte, patate saltate, riso, insalata, verdure saltate o pasta."
},
{
"fr": "Crème maison, caramel ou chocolat au choix.",
"en": "Homemade custard, caramel or chocolate, your choice.",
"it": "Crema fatta in casa, al caramello o al cioccolato a scelta."
},
{
"fr": "Crème vanille, sucre caramélisé au chalumeau.",
"en": "Vanilla custard, torch-caramelised sugar.",
"it": "Crema alla vaniglia, zucchero caramellato al cannello."
},
{
"fr": "Crème, fromage local, mozzarella, jambon de porc, champignons.",
"en": "Cream, local cheese, mozzarella, pork ham, mushrooms.",
"it": "Panna, formaggio locale, mozzarella, prosciutto di maiale, funghi."
},
{
"fr": "Crème, gouda, mozzarella, bleu d'Antsirabe, raclette.",
"en": "Cream, gouda, mozzarella, Antsirabe blue cheese, raclette.",
"it": "Panna, gouda, mozzarella, erborinato di Antsirabe, raclette."
},
{
"fr": "Crème, lardon, champignon, mozzarella, œuf.",
"en": "Cream, bacon lardons, mushroom, mozzarella, egg.",
"it": "Panna, pancetta a cubetti, funghi, mozzarella, uovo."
},
{
"fr": "Crème, lardons, oignons, mozzarella.",
"en": "Cream, bacon lardons, onions, mozzarella.",
"it": "Panna, pancetta a cubetti, cipolle, mozzarella."
},
{
"fr": "Crème, oignon, fromage de montagne, gouda, lardon, pomme de terre, œuf.",
"en": "Cream, onion, mountain cheese, gouda, bacon lardons, potato, egg.",
"it": "Panna, cipolla, formaggio di montagna, gouda, pancetta a cubetti, patate, uovo."
},
{
"fr": "Crêpe à la confiture.",
"en": "Crêpe with jam.",
"it": "Crêpe alla confettura."
},
{
"fr": "Crêpe à la fraise.",
"en": "Strawberry crêpe.",
"it": "Crêpe alla fragola."
},
{
"fr": "Crêpe au caramel.",
"en": "Caramel crêpe.",
"it": "Crêpe al caramello."
},
{
"fr": "Crêpe au chocolat.",
"en": "Chocolate crêpe.",
"it": "Crêpe al cioccolato."
},
{
"fr": "Crêpe au lait concentré.",
"en": "Crêpe with condensed milk.",
"it": "Crêpe al latte condensato."
},
{
"fr": "Crêpe au miel.",
"en": "Honey crêpe.",
"it": "Crêpe al miele."
},
{
"fr": "Crêpe au Nutella.",
"en": "Nutella crêpe.",
"it": "Crêpe alla Nutella."
},
{
"fr": "Crêpe au sucre.",
"en": "Sugar crêpe.",
"it": "Crêpe allo zucchero."
},
{
"fr": "Crêpes maison. Nappage au choix : sucre, chocolat, confiture ou miel.",
"en": "Homemade crêpes. Topping of your choice: sugar, chocolate, jam or honey.",
"it": "Crêpes fatte in casa. Copertura a scelta: zucchero, cioccolato, confettura o miele."
},
{
"fr": "Crevette, crème curcuma, accompagnement au choix.",
"en": "Shrimp, turmeric cream sauce, side of your choice.",
"it": "Gamberi, crema alla curcuma, contorno a scelta."
},
{
"fr": "Crevettes ou calamars sautés, à l'ail ou au gingembre. Accompagnement inclus.",
"en": "Sautéed shrimp or squid, with garlic or ginger. Side included.",
"it": "Gamberi o calamari saltati, all'aglio o allo zenzero. Contorno incluso."
},
{
"fr": "Crevettes ou calamars, sauce au choix : combava, poivre vert ou curry. Accompagnement inclus.",
"en": "Shrimp or squid, sauce of your choice: combava (kaffir lime), green peppercorn or curry. Side included.",
"it": "Gamberi o calamari, salsa a scelta: combava (lime kaffir), pepe verde o curry. Contorno incluso."
},
{
"fr": "Crevettes panées, frites minute. Les 10.",
"en": "Breaded shrimp, fried to order. 10 pieces.",
"it": "Gamberi impanati, fritti al momento. 10 pezzi."
},
{
"fr": "Crevettes sautées au wok avec des pousses de maïs. Riz ou pâtes inclus, au choix.",
"en": "Wok-fried shrimp with baby corn. Rice or noodles included, your choice.",
"it": "Gamberi saltati al wok con mais baby. Riso o pasta inclusi, a scelta."
},
{
"fr": "Crevettes, cheddar, oignon, salade, tomate. Frites incluses.",
"en": "Shrimp, cheddar, onion, lettuce, tomato. Fries included.",
"it": "Gamberi, cheddar, cipolla, insalata, pomodoro. Patatine incluse."
},
{
"fr": "Crevettes, concombre, cornichon, sauce cocktail.",
"en": "Shrimp, cucumber, gherkin, cocktail sauce.",
"it": "Gamberi, cetriolo, cetriolini sottaceto, salsa cocktail."
},
{
"fr": "Crevettes, pâte à beignet, salade, tomate, oignons.",
"en": "Shrimp in batter, lettuce, tomato, onions.",
"it": "Gamberi in pastella, insalata, pomodoro, cipolle."
},
{
"fr": "Croque-monsieur + œuf au plat. Accompagnement inclus.",
"en": "Croque-monsieur + fried egg. Side included.",
"it": "Croque-monsieur + uovo all'occhio di bue. Contorno incluso."
},
{
"fr": "Crudités de saison, œufs durs, vinaigrette maison.",
"en": "Seasonal raw vegetables, hard-boiled eggs, homemade vinaigrette.",
"it": "Verdure crude di stagione, uova sode, vinaigrette della casa."
},
{
"fr": "Cuisse de poulet rôtie. Accompagnement inclus au choix.",
"en": "Roast chicken leg. Side of your choice included.",
"it": "Coscia di pollo arrosto. Contorno a scelta incluso."
},
{
"fr": "Demi pizza au choix, salade crudité ou salade mixte.",
"en": "Half pizza of your choice, raw vegetable salad or mixed salad.",
"it": "Mezza pizza a scelta, insalata di verdure crude o insalata mista."
},
{
"fr": "Eau minérale, grande bouteille.",
"en": "Mineral water, large bottle.",
"it": "Acqua minerale, bottiglia grande."
},
{
"fr": "Eau minérale, petite bouteille.",
"en": "Mineral water, small bottle.",
"it": "Acqua minerale, bottiglia piccola."
},
{
"fr": "Émincé de poulet, crème à l'estragon. Accompagnement inclus au choix.",
"en": "Sliced chicken, tarragon cream sauce. Side of your choice included.",
"it": "Straccetti di pollo, crema al dragoncello. Contorno a scelta incluso."
},
{
"fr": "Émincé de poulet, sauce au poivre vert. Servi avec grains et piments.",
"en": "Sliced chicken, green peppercorn sauce. Served with grains (pulses) and chilli.",
"it": "Straccetti di pollo, salsa al pepe verde. Servito con grains (legumi) e peperoncino."
},
{
"fr": "Émincé de zébu aux brèdes. Servi avec grains et piments.",
"en": "Sliced zebu beef with local leafy greens (brèdes). Served with grains (pulses) and chilli.",
"it": "Straccetti di manzo zebù con verdure a foglia (brèdes). Servito con grains (legumi) e peperoncino."
},
{
"fr": "Émincés de poulet panés, frits minute.",
"en": "Breaded chicken strips, fried to order.",
"it": "Straccetti di pollo impanati, fritti al momento."
},
{
"fr": "Filet de poisson grillé. Accompagnement inclus au choix.",
"en": "Grilled fish fillet. Side of your choice included.",
"it": "Filetto di pesce alla griglia. Contorno a scelta incluso."
},
{
"fr": "Filet de poisson, sauce au choix : curry, poireaux ou poivre vert. Accompagnement inclus.",
"en": "Fish fillet, sauce of your choice: curry, leek or green peppercorn. Side included.",
"it": "Filetto di pesce, salsa a scelta: curry, porri o pepe verde. Contorno incluso."
},
{
"fr": "Filet de zébu grillé. Accompagnement inclus au choix.",
"en": "Grilled zebu beef fillet. Side of your choice included.",
"it": "Filetto di manzo zebù alla griglia. Contorno a scelta incluso."
},
{
"fr": "Filet de zébu, accompagnement au choix, sauce au poivre vert.",
"en": "Zebu beef fillet, side of your choice, green peppercorn sauce.",
"it": "Filetto di manzo zebù, contorno a scelta, salsa al pepe verde."
},
{
"fr": "Filet de zébu, sauce au choix : 3 poivres ou champignons. Accompagnement inclus.",
"en": "Zebu beef fillet, sauce of your choice: 3 peppercorns or mushroom. Side included.",
"it": "Filetto di manzo zebù, salsa a scelta: 3 pepi o funghi. Contorno incluso."
},
{
"fr": "Fines tranches de poisson cru, huile d'olive, citron, baies roses.",
"en": "Thin slices of raw fish, olive oil, lemon, pink peppercorns.",
"it": "Fettine sottili di pesce crudo, olio d'oliva, limone, pepe rosa."
},
{
"fr": "Foie gras poêlé, réduction sucrée, pain grillé.",
"en": "Pan-seared foie gras, sweet reduction, toasted bread.",
"it": "Foie gras scottato in padella, riduzione dolce, pane tostato."
},
{
"fr": "Frites, tomate, oignon, fromage, origan. Viande au choix, sauce au choix.",
"en": "Fries, tomato, onion, cheese, oregano. Meat of your choice, sauce of your choice.",
"it": "Patatine fritte, pomodoro, cipolla, formaggio, origano. Carne a scelta, salsa a scelta."
},
{
"fr": "Fruits frais de saison, taillés minute.",
"en": "Fresh seasonal fruit, cut to order.",
"it": "Frutta fresca di stagione, tagliata al momento."
},
{
"fr": "Garniture au choix (Oreos, Spéculoos, Brownie, Cookies, Banane) et nappage au choix (Chocolat, Caramel, Fraise, Lait concentré) — à préciser en commentaire.",
"en": "Filling of your choice (Oreos, Speculoos, Brownie, Cookies, Banana) and topping of your choice (Chocolate, Caramel, Strawberry, Condensed milk) — please specify in the comment.",
"it": "Farcitura a scelta (Oreo, Speculoos, Brownie, Cookies, Banana) e copertura a scelta (Cioccolato, Caramello, Fragola, Latte condensato) — da indicare nel commento."
},
{
"fr": "Gorgonzola, emmenthal, fromage râpé",
"en": "Gorgonzola, Emmental, grated cheese",
"it": "Gorgonzola, emmental, formaggio grattugiato"
},
{
"fr": "Jambon italien, salami italien, emmenthal, champignons, olives noires, anchois",
"en": "Italian ham, Italian salami, Emmental, mushrooms, black olives, anchovies",
"it": "Prosciutto italiano, salame italiano, emmental, funghi, olive nere, acciughe"
},
{
"fr": "Langouste grillée au brasero, beurre citronné.",
"en": "Spiny lobster grilled over the brazier, lemon butter.",
"it": "Aragosta grigliata alla brace, burro al limone."
},
{
"fr": "Langue de zébu, sauce tomate, carotte, cornichons, accompagnement au choix.",
"en": "Zebu beef tongue, tomato sauce, carrot, gherkins, side of your choice.",
"it": "Lingua di manzo zebù, salsa di pomodoro, carota, cetriolini sottaceto, contorno a scelta."
},
{
"fr": "Le plat malgache aux brèdes, version poulet. Accompagnement au choix : frites, pommes sautées, riz, salade, légumes sautés ou pâtes.",
"en": "The Malagasy dish with local leafy greens (brèdes), chicken version. Side of your choice: fries, sautéed potatoes, rice, salad, sautéed vegetables or pasta.",
"it": "Il piatto malgascio con verdure a foglia (brèdes), versione al pollo. Contorno a scelta: patatine fritte, patate saltate, riso, insalata, verdure saltate o pasta."
},
{
"fr": "Magret de canard grillé au brasero, peau croustillante.",
"en": "Duck breast grilled over the brazier, crispy skin.",
"it": "Petto d'anatra grigliato alla brace, pelle croccante."
},
{
"fr": "Mélange de fruit de mer (calamar, crevettes, poisson), riz, crème, fromage.",
"en": "Seafood mix (squid, shrimp, fish), rice, cream, cheese.",
"it": "Misto di frutti di mare (calamari, gamberi, pesce), riso, panna, formaggio."
},
{
"fr": "Mélange de fruit de mer, sauce tomate.",
"en": "Seafood mix, tomato sauce.",
"it": "Misto di frutti di mare, salsa di pomodoro."
},
{
"fr": "Milkshake chocolat, chantilly.",
"en": "Chocolate milkshake, whipped cream.",
"it": "Milkshake al cioccolato, panna montata."
},
{
"fr": "Milkshake fraise, chantilly.",
"en": "Strawberry milkshake, whipped cream.",
"it": "Milkshake alla fragola, panna montata."
},
{
"fr": "Milkshake Kinder Bueno, chantilly.",
"en": "Kinder Bueno milkshake, whipped cream.",
"it": "Milkshake Kinder Bueno, panna montata."
},
{
"fr": "Milkshake Oreo, chantilly.",
"en": "Oreo milkshake, whipped cream.",
"it": "Milkshake Oreo, panna montata."
},
{
"fr": "Milkshake spéculoos, chantilly.",
"en": "Speculoos milkshake, whipped cream.",
"it": "Milkshake speculoos, panna montata."
},
{
"fr": "Milkshake vanille, chantilly.",
"en": "Vanilla milkshake, whipped cream.",
"it": "Milkshake alla vaniglia, panna montata."
},
{
"fr": "Morceaux de poulet frit, sauce barbecue",
"en": "Fried chicken pieces, barbecue sauce",
"it": "Bocconcini di pollo fritto, salsa barbecue"
},
{
"fr": "Morceaux de poulet panés, croustillants. Accompagnement au choix : frites, pommes sautées, riz, salade, légumes sautés ou pâtes.",
"en": "Crispy breaded chicken pieces. Side of your choice: fries, sautéed potatoes, rice, salad, sautéed vegetables or pasta.",
"it": "Bocconcini di pollo impanati, croccanti. Contorno a scelta: patatine fritte, patate saltate, riso, insalata, verdure saltate o pasta."
},
{
"fr": "Morceaux de Snickers, coulis caramel-chocolat, chantilly.",
"en": "Snickers pieces, caramel-chocolate sauce, whipped cream.",
"it": "Pezzi di Snickers, coulis caramello-cioccolato, panna montata."
},
{
"fr": "Morceaux de Twix, coulis de caramel, chantilly.",
"en": "Twix pieces, caramel sauce, whipped cream.",
"it": "Pezzi di Twix, coulis al caramello, panna montata."
},
{
"fr": "Mozzarella, chapelure, salade, tomate, oignons.",
"en": "Mozzarella, breadcrumbs, lettuce, tomato, onions.",
"it": "Mozzarella, pangrattato, insalata, pomodoro, cipolle."
},
{
"fr": "Mozzarella, fromage râpé, oignon, olive noire",
"en": "Mozzarella, grated cheese, onion, black olive",
"it": "Mozzarella, formaggio grattugiato, cipolla, olive nere"
},
{
"fr": "Nouilles sautées. Format simple ou spécial, avec ou sans porc.",
"en": "Stir-fried noodles. Regular or special, with or without pork.",
"it": "Noodles saltati. Formato semplice o speciale, con o senza maiale."
},
{
"fr": "Nouilles, poulet, crevettes et légumes en bouillon.",
"en": "Noodles, chicken, shrimp and vegetables in broth.",
"it": "Noodles, pollo, gamberi e verdure in brodo."
},
{
"fr": "Œuf, bacon, fromage râpé",
"en": "Egg, bacon, grated cheese",
"it": "Uovo, bacon, formaggio grattugiato"
},
{
"fr": "Œufs durs, jaunes montés à la mayonnaise maison, ciboulette.",
"en": "Hard-boiled eggs, yolks whipped with homemade mayonnaise, chives.",
"it": "Uova sode, tuorli montati con maionese della casa, erba cipollina."
},
{
"fr": "Œufs, lardons, pommes de terre, oignon, fromage. Accompagnement + 5 000 Ar.",
"en": "Eggs, bacon lardons, potatoes, onion, cheese. Side + 5,000 Ar.",
"it": "Uova, pancetta a cubetti, patate, cipolla, formaggio. Contorno + 5.000 Ar."
},
{
"fr": "Œufs, légumes de saison, herbes. Accompagnement + 5 000 Ar.",
"en": "Eggs, seasonal vegetables, herbs. Side + 5,000 Ar.",
"it": "Uova, verdure di stagione, erbe aromatiche. Contorno + 5.000 Ar."
},
{
"fr": "Os à moëlle rôti au brasero, fleur de sel, pain grillé.",
"en": "Bone marrow roasted over the brazier, fleur de sel, toasted bread.",
"it": "Osso con midollo arrostito alla brace, fior di sale, pane tostato."
},
{
"fr": "Pain burger maison, salade, tomate, oignons, cornichons, sauce burger, steack haché, fromage.",
"en": "Homemade burger bun, lettuce, tomato, onions, gherkins, burger sauce, beef patty, cheese.",
"it": "Panino per burger fatto in casa, insalata, pomodoro, cipolle, cetriolini sottaceto, salsa burger, hamburger di carne, formaggio."
},
{
"fr": "Pain burger maison, salade, tomate, oignons, cornichons, sauce burger, steack haché.",
"en": "Homemade burger bun, lettuce, tomato, onions, gherkins, burger sauce, beef patty.",
"it": "Panino per burger fatto in casa, insalata, pomodoro, cipolle, cetriolini sottaceto, salsa burger, hamburger di carne."
},
{
"fr": "Pain de mie, jambon, fromage, béchamel, gratiné. Accompagnement + 5 000 Ar.",
"en": "Sandwich bread, ham, cheese, béchamel, grilled au gratin. Side + 5,000 Ar.",
"it": "Pancarré, prosciutto cotto, formaggio, besciamella, gratinato. Contorno + 5.000 Ar."
},
{
"fr": "Pain, légumes, oignon, poisson, frites incluses. Sauce au choix.",
"en": "Bread, vegetables, onion, fish, fries included. Sauce of your choice.",
"it": "Pane, verdure, cipolla, pesce, patatine incluse. Salsa a scelta."
},
{
"fr": "Pain, légumes, oignon, zébu ou poulet, frites incluses. Sauce au choix.",
"en": "Bread, vegetables, onion, zebu beef or chicken, fries included. Sauce of your choice.",
"it": "Pane, verdure, cipolla, manzo zebù o pollo, patatine incluse. Salsa a scelta."
},
{
"fr": "Pain, viande, oignon, légumes, bacon, fromage, frites incluses. Sauce au choix.",
"en": "Bread, meat, onion, vegetables, bacon, cheese, fries included. Sauce of your choice.",
"it": "Pane, carne, cipolla, verdure, bacon, formaggio, patatine incluse. Salsa a scelta."
},
{
"fr": "Pâtes fraîches aux crevettes, version épicée.",
"en": "Fresh noodles with shrimp, spicy version.",
"it": "Pasta fresca ai gamberi, versione piccante."
},
{
"fr": "Pâtes, beurre, parmesan.",
"en": "Pasta, butter, parmesan.",
"it": "Pasta, burro, parmigiano."
},
{
"fr": "Pâtes, crevettes, calamars, poisson, sauce tomate.",
"en": "Pasta, shrimp, squid, fish, tomato sauce.",
"it": "Pasta, gamberi, calamari, pesce, salsa di pomodoro."
},
{
"fr": "Pâtes, lardons, crème, œuf, parmesan.",
"en": "Pasta, bacon lardons, cream, egg, parmesan.",
"it": "Pasta, pancetta a cubetti, panna, uovo, parmigiano."
},
{
"fr": "Pâtes, sauce tomate mijotée, viande de zébu hachée, parmesan.",
"en": "Pasta, slow-simmered tomato sauce, minced zebu beef, parmesan.",
"it": "Pasta, sugo di pomodoro cotto a lungo, carne macinata di manzo zebù, parmigiano."
},
{
"fr": "Pavé de zébu piqué à l'ail, grillé. Accompagnement inclus au choix.",
"en": "Thick-cut zebu beef steak studded with garlic, grilled. Side of your choice included.",
"it": "Trancio di manzo zebù steccato all'aglio, alla griglia. Contorno a scelta incluso."
},
{
"fr": "Poisson cru taillé au couteau, citron vert, huile d'olive, oignon rouge, coriandre.",
"en": "Hand-cut raw fish, lime, olive oil, red onion, coriander.",
"it": "Pesce crudo tagliato al coltello, lime, olio d'oliva, cipolla rossa, coriandolo."
},
{
"fr": "Poisson fumé, beurre.",
"en": "Smoked fish, butter.",
"it": "Pesce affumicato, burro."
},
{
"fr": "Poisson fumé, huile d'olive, citron, pain grillé.",
"en": "Smoked fish, olive oil, lemon, toasted bread.",
"it": "Pesce affumicato, olio d'oliva, limone, pane tostato."
},
{
"fr": "Poisson grillé, accompagnement au choix.",
"en": "Grilled fish, side of your choice.",
"it": "Pesce alla griglia, contorno a scelta."
},
{
"fr": "Poisson mijoté au lait de coco. Accompagnement au choix : frites, pommes sautées, riz, salade, légumes sautés ou pâtes.",
"en": "Fish simmered in coconut milk. Side of your choice: fries, sautéed potatoes, rice, salad, sautéed vegetables or pasta.",
"it": "Pesce stufato al latte di cocco. Contorno a scelta: patatine fritte, patate saltate, riso, insalata, verdure saltate o pasta."
},
{
"fr": "Poisson, chapelure, salade, tomate, oignons.",
"en": "Fish, breadcrumbs, lettuce, tomato, onions.",
"it": "Pesce, pangrattato, insalata, pomodoro, cipolle."
},
{
"fr": "Poisson, crevettes, calamars, légumes, bouillon safrané. Accompagnement inclus.",
"en": "Fish, shrimp, squid, vegetables, saffron broth. Side included.",
"it": "Pesce, gamberi, calamari, verdure, brodo allo zafferano. Contorno incluso."
},
{
"fr": "Poisson, sauce poireau, accompagnement au choix.",
"en": "Fish, leek sauce, side of your choice.",
"it": "Pesce, salsa ai porri, contorno a scelta."
},
{
"fr": "Poissons de roche mixés, croûtons à l'ail, rouille (ail, safran, piment, huile d'olive).",
"en": "Blended rock fish, garlic croutons, rouille (garlic, saffron, chilli, olive oil).",
"it": "Pesci di scoglio frullati, crostini all'aglio, rouille (aglio, zafferano, peperoncino, olio d'oliva)."
},
{
"fr": "Poitrine fumée, oignons, crème, vin blanc.",
"en": "Smoked pork belly, onions, cream, white wine.",
"it": "Pancetta affumicata, cipolle, panna, vino bianco."
},
{
"fr": "Pommes de terre, sel.",
"en": "Potatoes, salt.",
"it": "Patate, sale."
},
{
"fr": "Porc sauté aux gros piments. Servi avec grains et piments.",
"en": "Pork sautéed with large chilli peppers. Served with grains (pulses) and chilli.",
"it": "Maiale saltato con peperoncini grandi. Servito con grains (legumi) e peperoncino."
},
{
"fr": "Porc, foie, persil, cornichons, pain grillé. Terrine maison.",
"en": "Pork, liver, parsley, gherkins, toasted bread. Homemade terrine.",
"it": "Maiale, fegato, prezzemolo, cetriolini sottaceto, pane tostato. Terrina della casa."
},
{
"fr": "Poulet croustillant, cheddar, oignon, salade, tomate. Frites incluses.",
"en": "Crispy chicken, cheddar, onion, lettuce, tomato. Fries included.",
"it": "Pollo croccante, cheddar, cipolla, insalata, pomodoro. Patatine incluse."
},
{
"fr": "Poulet et bœuf, sans porc.",
"en": "Chicken and beef, no pork.",
"it": "Pollo e manzo, senza maiale."
},
{
"fr": "Poulet frit, accompagné de salade ou de frites",
"en": "Fried chicken, served with salad or fries",
"it": "Pollo fritto, accompagnato da insalata o patatine fritte"
},
{
"fr": "Poulet frit, tomate tranchée, salade verte",
"en": "Fried chicken, sliced tomato, lettuce",
"it": "Pollo fritto, pomodoro a fette, insalata verde"
},
{
"fr": "Poulet frit, tomate tranchée, salade verte, fromage",
"en": "Fried chicken, sliced tomato, lettuce, cheese",
"it": "Pollo fritto, pomodoro a fette, insalata verde, formaggio"
},
{
"fr": "Poulet grillé, accompagné de salade ou de frites",
"en": "Grilled chicken, served with salad or fries",
"it": "Pollo alla griglia, accompagnato da insalata o patatine fritte"
},
{
"fr": "Poulet grillé, accompagnement au choix.",
"en": "Grilled chicken, side of your choice.",
"it": "Pollo alla griglia, contorno a scelta."
},
{
"fr": "Poulet sauce au coco, accompagnement au choix.",
"en": "Chicken in coconut sauce, side of your choice.",
"it": "Pollo in salsa al cocco, contorno a scelta."
},
{
"fr": "Prix à partir de 29 000 Ar selon la déclinaison, à confirmer avec le restaurant.",
"en": "Price from 29,000 Ar depending on the variation, to be confirmed with the restaurant.",
"it": "Prezzo a partire da 29.000 Ar a seconda della variante, da confermare con il ristorante."
},
{
"fr": "Prix à partir de 29 000 Ar, à confirmer avec le restaurant.",
"en": "Price from 29,000 Ar, to be confirmed with the restaurant.",
"it": "Prezzo a partire da 29.000 Ar, da confermare con il ristorante."
},
{
"fr": "Rhum ambré Dzama, distillé à Nosy Be.",
"en": "Dzama amber rum, distilled in Nosy Be.",
"it": "Rum ambrato Dzama, distillato a Nosy Be."
},
{
"fr": "Rhum blanc Dzama, distillé à Nosy Be.",
"en": "Dzama white rum, distilled in Nosy Be.",
"it": "Rum bianco Dzama, distillato a Nosy Be."
},
{
"fr": "Rhum blanc, citron vert, sucre de canne.",
"en": "White rum, lime, cane sugar.",
"it": "Rum bianco, lime, zucchero di canna."
},
{
"fr": "Rhum malgache, Fournie Frères.",
"en": "Malagasy rum, Fournie Frères.",
"it": "Rum malgascio, Fournie Frères."
},
{
"fr": "Rhum, lait de coco, sucre de canne.",
"en": "Rum, coconut milk, cane sugar.",
"it": "Rum, latte di cocco, zucchero di canna."
},
{
"fr": "Riz moulé, viande et légumes sautés au wok, œuf au plat sur le dessus.",
"en": "Moulded rice, wok-fried meat and vegetables, topped with a fried egg.",
"it": "Riso a cupola, carne e verdure saltate al wok, uovo all'occhio di bue sopra."
},
{
"fr": "Riz sauté. Format simple ou spécial, avec ou sans porc.",
"en": "Fried rice. Regular or special, with or without pork.",
"it": "Riso saltato. Formato semplice o speciale, con o senza maiale."
},
{
"fr": "Rôti de porc, sauce créole. Servi avec grains et piments.",
"en": "Roast pork, Creole sauce. Served with grains (pulses) and chilli.",
"it": "Arrosto di maiale, salsa creola. Servito con grains (legumi) e peperoncino."
},
{
"fr": "Salade verte, tomate, carotte, concombre, vinaigrette maison.",
"en": "Green salad, tomato, carrot, cucumber, homemade vinaigrette.",
"it": "Insalata verde, pomodoro, carota, cetriolo, vinaigrette della casa."
},
{
"fr": "Salade, carottes, chou blanc, tomate, poisson fumé, frite, fromage, œuf au plat.",
"en": "Lettuce, carrots, white cabbage, tomato, smoked fish, fries, cheese, fried egg.",
"it": "Insalata, carote, cavolo bianco, pomodoro, pesce affumicato, patatine fritte, formaggio, uovo all'occhio di bue."
},
{
"fr": "Salade, oignons.",
"en": "Lettuce, onions.",
"it": "Insalata, cipolle."
},
{
"fr": "Salade, Tomate, Oignon, Poulet croustillant, Cheddar.",
"en": "Lettuce, Tomato, Onion, Crispy chicken, Cheddar.",
"it": "Insalata, Pomodoro, Cipolla, Pollo croccante, Cheddar."
},
{
"fr": "Samoussa au fromage. Prix à la pièce.",
"en": "Cheese samosa. Price per piece.",
"it": "Samosa al formaggio. Prezzo al pezzo."
},
{
"fr": "Samoussa au zébu ou au poulet, au choix. Prix à la pièce.",
"en": "Zebu beef or chicken samosa, your choice. Price per piece.",
"it": "Samosa di manzo zebù o di pollo, a scelta. Prezzo al pezzo."
},
{
"fr": "Sauce tomate, aubergines frites, ricotta salée ou parmesan",
"en": "Tomato sauce, fried aubergines, ricotta salata or parmesan",
"it": "Salsa di pomodoro, melanzane fritte, ricotta salata o parmigiano"
},
{
"fr": "Sauce tomate, bacon, persil, oignon",
"en": "Tomato sauce, bacon, parsley, onion",
"it": "Salsa di pomodoro, bacon, prezzemolo, cipolla"
},
{
"fr": "Sauce tomate, crevettes, calamars",
"en": "Tomato sauce, shrimp, squid",
"it": "Salsa di pomodoro, gamberi, calamari"
},
{
"fr": "Sauce tomate, fromage, aubergine, basilic",
"en": "Tomato sauce, cheese, aubergine, basil",
"it": "Salsa di pomodoro, formaggio, melanzane, basilico"
},
{
"fr": "Sauce tomate, lait, jambon italien, champignons, persil",
"en": "Tomato sauce, milk, Italian ham, mushrooms, parsley",
"it": "Salsa di pomodoro, latte, prosciutto italiano, funghi, prezzemolo"
},
{
"fr": "Sauce tomate, mozzarella, aubergines frites, origan",
"en": "Tomato sauce, mozzarella, fried aubergines, oregano",
"it": "Salsa di pomodoro, mozzarella, melanzane fritte, origano"
},
{
"fr": "Sauce tomate, pesto au basilic",
"en": "Tomato sauce, basil pesto",
"it": "Salsa di pomodoro, pesto al basilico"
},
{
"fr": "Sauce tomate, poisson (tazar ou espadon), aubergine, menthe",
"en": "Tomato sauce, fish (tazar (kingfish) or swordfish), aubergine, mint",
"it": "Salsa di pomodoro, pesce (tazar (sgombro reale) o pesce spada), melanzane, menta"
},
{
"fr": "Sauce tomate, viande hachée de zébu, carottes, oignon, béchamel, fromage râpé",
"en": "Tomato sauce, minced zebu beef, carrots, onion, béchamel, grated cheese",
"it": "Salsa di pomodoro, carne macinata di manzo zebù, carote, cipolla, besciamella, formaggio grattugiato"
},
{
"fr": "Saucisse de porc, sauce tomate épicée, accompagnement au choix.",
"en": "Pork sausage, spicy tomato sauce, side of your choice.",
"it": "Salsiccia di maiale, salsa di pomodoro piccante, contorno a scelta."
},
{
"fr": "Saucisses de porc mijotées à la tomate, oignon et gingembre. Servi avec grains et piments.",
"en": "Pork sausages simmered with tomato, onion and ginger. Served with grains (pulses) and chilli.",
"it": "Salsicce di maiale stufate con pomodoro, cipolla e zenzero. Servito con grains (legumi) e peperoncino."
},
{
"fr": "Sec, sur glace ou allongé.",
"en": "Neat, on the rocks or with a mixer.",
"it": "Liscio, con ghiaccio o allungato."
},
{
"fr": "Sec, sur glace ou allongé. Dose double.",
"en": "Neat, on the rocks or with a mixer. Double measure.",
"it": "Liscio, con ghiaccio o allungato. Dose doppia."
},
{
"fr": "Servi avec eau fraîche et glaçons.",
"en": "Served with chilled water and ice cubes.",
"it": "Servito con acqua fresca e cubetti di ghiaccio."
},
{
"fr": "Servi avec eau fraîche et glaçons. Dose double.",
"en": "Served with chilled water and ice cubes. Double measure.",
"it": "Servito con acqua fresca e cubetti di ghiaccio. Dose doppia."
},
{
"fr": "Steak de bœuf tranché, sauce tomate douce, poivrons et oignons.",
"en": "Sliced beef steak, mild tomato sauce, peppers and onions.",
"it": "Bistecca di manzo a fette, salsa di pomodoro dolce, peperoni e cipolle."
},
{
"fr": "Steak grillé ou steak milanaise, au choix",
"en": "Grilled steak or steak milanese, your choice",
"it": "Bistecca alla griglia o cotoletta alla milanese, a scelta"
},
{
"fr": "Steak haché de zébu, œuf au plat. Accompagnement inclus au choix.",
"en": "Zebu beef patty, fried egg. Side of your choice included.",
"it": "Hamburger di manzo zebù, uovo all'occhio di bue. Contorno a scelta incluso."
},
{
"fr": "Steak haché de zébu. Accompagnement inclus au choix.",
"en": "Zebu beef patty. Side of your choice included.",
"it": "Hamburger di manzo zebù. Contorno a scelta incluso."
},
{
"fr": "Steak, cheddar, salade, oignon, tomate. Frites incluses.",
"en": "Patty, cheddar, lettuce, onion, tomato. Fries included.",
"it": "Hamburger, cheddar, insalata, cipolla, pomodoro. Patatine incluse."
},
{
"fr": "Steak, raclette, poitrine, cheddar, oignon caramélisé. Frites incluses.",
"en": "Patty, raclette, pork belly, cheddar, caramelised onion. Fries included.",
"it": "Hamburger, raclette, pancetta, cheddar, cipolla caramellata. Patatine incluse."
},
{
"fr": "Terrine de foie gras, fleur de sel, pain grillé.",
"en": "Foie gras terrine, fleur de sel, toasted bread.",
"it": "Terrina di foie gras, fior di sale, pane tostato."
},
{
"fr": "Tomate, aubergine, poivron, courgette, gouda, mozzarella, oignon, herbes de Provence.",
"en": "Tomato, aubergine, pepper, courgette, gouda, mozzarella, onion, herbes de Provence.",
"it": "Pomodoro, melanzane, peperoni, zucchine, gouda, mozzarella, cipolla, erbe di Provenza."
},
{
"fr": "Tomate, basilic",
"en": "Tomato, basil",
"it": "Pomodoro, basilico"
},
{
"fr": "Tomate, calamar, crevette, poisson, gouda, mozzarella.",
"en": "Tomato, squid, shrimp, fish, gouda, mozzarella.",
"it": "Pomodoro, calamari, gamberi, pesce, gouda, mozzarella."
},
{
"fr": "Tomate, gouda, mozzarella, câpres, anchois, olives noires.",
"en": "Tomato, gouda, mozzarella, capers, anchovies, black olives.",
"it": "Pomodoro, gouda, mozzarella, capperi, acciughe, olive nere."
},
{
"fr": "Tomate, gouda, mozzarella, jambon de porc, champignons, olive noire.",
"en": "Tomato, gouda, mozzarella, pork ham, mushrooms, black olive.",
"it": "Pomodoro, gouda, mozzarella, prosciutto di maiale, funghi, olive nere."
},
{
"fr": "Tomate, gouda, mozzarella, merguez, viande hachée, oignon, poivron, œuf.",
"en": "Tomato, gouda, mozzarella, merguez, minced meat, onion, pepper, egg.",
"it": "Pomodoro, gouda, mozzarella, merguez, carne macinata, cipolla, peperoni, uovo."
},
{
"fr": "Tomate, gouda, mozzarella, poulet.",
"en": "Tomato, gouda, mozzarella, chicken.",
"it": "Pomodoro, gouda, mozzarella, pollo."
},
{
"fr": "Tomate, gouda, mozzarella, viande hachée, oignon.",
"en": "Tomato, gouda, mozzarella, minced meat, onion.",
"it": "Pomodoro, gouda, mozzarella, carne macinata, cipolla."
},
{
"fr": "Tomate, gouda, mozzarella, viande hachée, poulet, merguez, oignon, poivron, œuf.",
"en": "Tomato, gouda, mozzarella, minced meat, chicken, merguez, onion, pepper, egg.",
"it": "Pomodoro, gouda, mozzarella, carne macinata, pollo, merguez, cipolla, peperoni, uovo."
},
{
"fr": "Tomate, mozzarella, anchois, olives noires",
"en": "Tomato, mozzarella, anchovies, black olives",
"it": "Pomodoro, mozzarella, acciughe, olive nere"
},
{
"fr": "Tomate, mozzarella, anchois, tomate en tranches, oignon, fromage râpé, olive noire",
"en": "Tomato, mozzarella, anchovies, sliced tomato, onion, grated cheese, black olive",
"it": "Pomodoro, mozzarella, acciughe, pomodoro a fette, cipolla, formaggio grattugiato, olive nere"
},
{
"fr": "Tomate, mozzarella, aubergine, courgette",
"en": "Tomato, mozzarella, aubergine, courgette",
"it": "Pomodoro, mozzarella, melanzane, zucchine"
},
{
"fr": "Tomate, mozzarella, basilic",
"en": "Tomato, mozzarella, basil",
"it": "Pomodoro, mozzarella, basilico"
},
{
"fr": "Tomate, mozzarella, champignons",
"en": "Tomato, mozzarella, mushrooms",
"it": "Pomodoro, mozzarella, funghi"
},
{
"fr": "Tomate, mozzarella, champignons, jambon italien",
"en": "Tomato, mozzarella, mushrooms, Italian ham",
"it": "Pomodoro, mozzarella, funghi, prosciutto italiano"
},
{
"fr": "Tomate, mozzarella, crevettes, calamars",
"en": "Tomato, mozzarella, shrimp, squid",
"it": "Pomodoro, mozzarella, gamberi, calamari"
},
{
"fr": "Tomate, mozzarella, divers fromages, gorgonzola",
"en": "Tomato, mozzarella, assorted cheeses, gorgonzola",
"it": "Pomodoro, mozzarella, formaggi misti, gorgonzola"
},
{
"fr": "Tomate, mozzarella, jambon cru, parmesan",
"en": "Tomato, mozzarella, cured ham, parmesan",
"it": "Pomodoro, mozzarella, prosciutto crudo, parmigiano"
},
{
"fr": "Tomate, mozzarella, jambon italien",
"en": "Tomato, mozzarella, Italian ham",
"it": "Pomodoro, mozzarella, prosciutto italiano"
},
{
"fr": "Tomate, mozzarella, jambon, champignons.",
"en": "Tomato, mozzarella, ham, mushrooms.",
"it": "Pomodoro, mozzarella, prosciutto cotto, funghi."
},
{
"fr": "Tomate, mozzarella, jambon, rondelle de tomates.",
"en": "Tomato, mozzarella, ham, tomato slices.",
"it": "Pomodoro, mozzarella, prosciutto cotto, rondelle di pomodoro."
},
{
"fr": "Tomate, mozzarella, merguez.",
"en": "Tomato, mozzarella, merguez.",
"it": "Pomodoro, mozzarella, merguez."
},
{
"fr": "Tomate, mozzarella, œuf, fromage râpé, bacon frit",
"en": "Tomato, mozzarella, egg, grated cheese, fried bacon",
"it": "Pomodoro, mozzarella, uovo, formaggio grattugiato, bacon fritto"
},
{
"fr": "Tomate, mozzarella, olive, origan.",
"en": "Tomato, mozzarella, olive, oregano.",
"it": "Pomodoro, mozzarella, olive, origano."
},
{
"fr": "Tomate, mozzarella, poisson fumé (tazar ou espadon)",
"en": "Tomato, mozzarella, smoked fish (tazar (kingfish) or swordfish)",
"it": "Pomodoro, mozzarella, pesce affumicato (tazar (sgombro reale) o pesce spada)"
},
{
"fr": "Tomate, mozzarella, poisson fumé.",
"en": "Tomato, mozzarella, smoked fish.",
"it": "Pomodoro, mozzarella, pesce affumicato."
},
{
"fr": "Tomate, mozzarella, poisson, crevettes, calamar.",
"en": "Tomato, mozzarella, fish, shrimp, squid.",
"it": "Pomodoro, mozzarella, pesce, gamberi, calamari."
},
{
"fr": "Tomate, mozzarella, poitrine fumée, poivrons, oignons, œufs.",
"en": "Tomato, mozzarella, smoked pork belly, peppers, onions, eggs.",
"it": "Pomodoro, mozzarella, pancetta affumicata, peperoni, cipolle, uova."
},
{
"fr": "Tomate, mozzarella, pommes de terre frites",
"en": "Tomato, mozzarella, fried potatoes",
"it": "Pomodoro, mozzarella, patate fritte"
},
{
"fr": "Tomate, mozzarella, poulet, sauce barbecue",
"en": "Tomato, mozzarella, chicken, barbecue sauce",
"it": "Pomodoro, mozzarella, pollo, salsa barbecue"
},
{
"fr": "Tomate, mozzarella, poulet.",
"en": "Tomato, mozzarella, chicken.",
"it": "Pomodoro, mozzarella, pollo."
},
{
"fr": "Tomate, mozzarella, raclette, fromage bleu.",
"en": "Tomato, mozzarella, raclette, blue cheese.",
"it": "Pomodoro, mozzarella, raclette, formaggio erborinato."
},
{
"fr": "Tomate, mozzarella, ratatouille.",
"en": "Tomato, mozzarella, ratatouille.",
"it": "Pomodoro, mozzarella, ratatouille."
},
{
"fr": "Tomate, mozzarella, salame (chorizo) italien",
"en": "Tomato, mozzarella, Italian salame (chorizo)",
"it": "Pomodoro, mozzarella, salame (chorizo) italiano"
},
{
"fr": "Tomate, mozzarella, sauce bolognaise",
"en": "Tomato, mozzarella, bolognese sauce",
"it": "Pomodoro, mozzarella, ragù alla bolognese"
},
{
"fr": "Tomate, mozzarella.",
"en": "Tomato, mozzarella.",
"it": "Pomodoro, mozzarella."
},
{
"fr": "Tomate, Oignon, Bleu, Poulet, Cheddar.",
"en": "Tomato, Onion, Blue cheese, Chicken, Cheddar.",
"it": "Pomodoro, Cipolla, Formaggio erborinato, Pollo, Cheddar."
},
{
"fr": "Tomates tranchées, laitue, carottes, oignon, olives noires",
"en": "Sliced tomatoes, lettuce, carrots, onion, black olives",
"it": "Pomodori a fette, lattuga, carote, cipolla, olive nere"
},
{
"fr": "Tomates, crevettes, salade, sauce cocktail.",
"en": "Tomatoes, shrimp, lettuce, cocktail sauce.",
"it": "Pomodori, gamberi, insalata, salsa cocktail."
},
{
"fr": "Tomates, œufs durs, oignon, vinaigrette maison.",
"en": "Tomatoes, hard-boiled eggs, onion, homemade vinaigrette.",
"it": "Pomodori, uova sode, cipolla, vinaigrette della casa."
},
{
"fr": "Trois merguez de mouton grillées au brasero, frites.",
"en": "Three lamb merguez sausages grilled over the brazier, fries.",
"it": "Tre merguez di montone grigliate alla brace, patatine fritte."
},
{
"fr": "Une dizaine de pièces.",
"en": "About ten pieces.",
"it": "Una decina di pezzi."
},
{
"fr": "Viande au choix (agneau, poulet, steak ou merguez). Frites incluses, sauce au choix incluse.",
"en": "Meat of your choice (lamb, chicken, steak or merguez). Fries included, sauce of your choice included.",
"it": "Carne a scelta (agnello, pollo, bistecca o merguez). Patatine incluse, salsa a scelta inclusa."
},
{
"fr": "Viande au choix (agneau, poulet, steak ou merguez). Sauce au choix incluse.",
"en": "Meat of your choice (lamb, chicken, steak or merguez). Sauce of your choice included.",
"it": "Carne a scelta (agnello, pollo, bistecca o merguez). Salsa a scelta inclusa."
},
{
"fr": "Viande au choix (agneau, poulet, steak ou merguez). Sauce au choix incluse. En sandwich ou en assiette.",
"en": "Meat of your choice (lamb, chicken, steak or merguez). Sauce of your choice included. As a sandwich or a plate.",
"it": "Carne a scelta (agnello, pollo, bistecca o merguez). Salsa a scelta inclusa. In panino o al piatto."
},
{
"fr": "Viande au choix (agneau, poulet, steak, merguez, nugget ou tenders). Sauce au choix incluse.",
"en": "Meat of your choice (lamb, chicken, steak, merguez, nuggets or tenders). Sauce of your choice included.",
"it": "Carne a scelta (agnello, pollo, bistecca, merguez, nugget o tenders). Salsa a scelta inclusa."
},
{
"fr": "Viande de zébu, carottes, oignons, sauce tomate.",
"en": "Zebu beef, carrots, onions, tomato sauce.",
"it": "Carne di manzo zebù, carote, cipolle, salsa di pomodoro."
},
{
"fr": "Viande de zébu, poivre vert, pesto maison.",
"en": "Zebu beef, green peppercorns, homemade pesto.",
"it": "Carne di manzo zebù, pepe verde, pesto della casa."
},
{
"fr": "Viande de zébu, tomate, poivrons, oignons, gingembre, accompagnement au choix.",
"en": "Zebu beef, tomato, peppers, onions, ginger, side of your choice.",
"it": "Carne di manzo zebù, pomodoro, peperoni, cipolle, zenzero, contorno a scelta."
},
{
"fr": "Viande hachée de zébu, carottes, oignon, sauce tomate",
"en": "Minced zebu beef, carrots, onion, tomato sauce",
"it": "Carne macinata di manzo zebù, carote, cipolla, salsa di pomodoro"
},
{
"fr": "Viande hachée ou poulet, au choix",
"en": "Minced beef or chicken, your choice",
"it": "Carne macinata o pollo, a scelta"
},
{
"fr": "Viande hachée, tomate tranchée, salade verte",
"en": "Minced beef, sliced tomato, lettuce",
"it": "Carne macinata, pomodoro a fette, insalata verde"
},
{
"fr": "Viande hachée, tomate tranchée, salade verte, fromage",
"en": "Minced beef, sliced tomato, lettuce, cheese",
"it": "Carne macinata, pomodoro a fette, insalata verde, formaggio"
},
{
"fr": "Viande hachée, tomate tranchée, salade verte, fromage, bacon, oignon",
"en": "Minced beef, sliced tomato, lettuce, cheese, bacon, onion",
"it": "Carne macinata, pomodoro a fette, insalata verde, formaggio, bacon, cipolla"
},
{
"fr": "Zébu cru en fines tranches, huile d'olive, parmesan, roquette, citron.",
"en": "Thinly sliced raw zebu beef, olive oil, parmesan, rocket, lemon.",
"it": "Manzo zebù crudo a fettine sottili, olio d'oliva, parmigiano, rucola, limone."
},
{
"fr": "3 merguez de mouton + frites",
"en": "3 lamb merguez sausages + fries",
"it": "3 merguez di montone + patatine fritte"
},
{
"fr": "4 fromages",
"en": "4 cheeses",
"it": "4 formaggi"
},
{
"fr": "4 Fromages",
"en": "4 Cheeses",
"it": "4 Formaggi"
},
{
"fr": "Amatriciana",
"en": "Amatriciana",
"it": "Amatriciana"
},
{
"fr": "Américain",
"en": "Américain (meat and fries sandwich)",
"it": "Américain (panino con carne e patatine)"
},
{
"fr": "Américaine",
"en": "American",
"it": "Americana"
},
{
"fr": "Ananas ou banane flambée",
"en": "Flambéed pineapple or banana",
"it": "Ananas o banana flambé"
},
{
"fr": "Assiette de crudité",
"en": "Raw vegetable plate",
"it": "Piatto di verdure crude"
},
{
"fr": "Assiette de crudités",
"en": "Raw vegetable plate",
"it": "Piatto di verdure crude"
},
{
"fr": "Assiette de frites",
"en": "Plate of fries",
"it": "Piatto di patatine fritte"
},
{
"fr": "Assiette de friture",
"en": "Fried platter",
"it": "Piatto di fritti misti"
},
{
"fr": "Assiette de nem cocktail",
"en": "Cocktail spring roll platter",
"it": "Piatto di mini involtini primavera"
},
{
"fr": "Assiette de poisson fumé",
"en": "Smoked fish platter",
"it": "Piatto di pesce affumicato"
},
{
"fr": "Assiette de tsa siou",
"en": "Tsa siou plate (Chinese barbecue pork)",
"it": "Piatto di tsa siou (maiale arrosto alla cinese)"
},
{
"fr": "Banane flambée",
"en": "Flambéed banana",
"it": "Banana flambé"
},
{
"fr": "Bâtonnet de poisson",
"en": "Fish sticks",
"it": "Bastoncini di pesce"
},
{
"fr": "Bâtonnets de mozzarella",
"en": "Mozzarella sticks",
"it": "Bastoncini di mozzarella"
},
{
"fr": "Beaufort",
"en": "Beaufort beer",
"it": "Birra Beaufort"
},
{
"fr": "Beaufort 33 cl",
"en": "Beaufort beer 33 cl",
"it": "Birra Beaufort 33 cl"
},
{
"fr": "Beignet de crevettes",
"en": "Shrimp fritters",
"it": "Frittelle di gamberi"
},
{
"fr": "Beignet de porc sauce aigre-douce",
"en": "Pork fritters in sweet and sour sauce",
"it": "Frittelle di maiale in salsa agrodolce"
},
{
"fr": "Beignets crevettes ou calamars",
"en": "Shrimp or squid fritters",
"it": "Frittelle di gamberi o calamari"
},
{
"fr": "Beignets crevettes, calamar ou poisson",
"en": "Shrimp, squid or fish fritters",
"it": "Frittelle di gamberi, calamari o pesce"
},
{
"fr": "Beignets de calamars",
"en": "Squid fritters",
"it": "Frittelle di calamari"
},
{
"fr": "Beignets de crevettes",
"en": "Shrimp fritters",
"it": "Frittelle di gamberi"
},
{
"fr": "Beignets de poisson",
"en": "Fish fritters",
"it": "Frittelle di pesce"
},
{
"fr": "Bière en canette",
"en": "Canned beer",
"it": "Birra in lattina"
},
{
"fr": "Big cheeseburger",
"en": "Big cheeseburger",
"it": "Big cheeseburger"
},
{
"fr": "Bol renversé",
"en": "Bol renversé (upside-down rice bowl)",
"it": "Bol renversé (ciotola di riso capovolta)"
},
{
"fr": "Bol renversé bœuf, poulet ou porc",
"en": "Bol renversé (upside-down rice bowl) with beef, chicken or pork",
"it": "Bol renversé (ciotola di riso capovolta) con manzo, pollo o maiale"
},
{
"fr": "Bol renversé fruits de mer",
"en": "Bol renversé (upside-down rice bowl) with seafood",
"it": "Bol renversé (ciotola di riso capovolta) ai frutti di mare"
},
{
"fr": "Bol renversé poulet ou zébu",
"en": "Bol renversé (upside-down rice bowl with stir-fry and fried egg), chicken or zebu",
"it": "Bol renversé (ciotola di riso capovolta con saltato e uovo all'occhio di bue), pollo o zebù"
},
{
"fr": "Bolognaise",
"en": "Bolognese",
"it": "Bolognese"
},
{
"fr": "Bolognese",
"en": "Bolognese",
"it": "Bolognese"
},
{
"fr": "Bonbon Anglais",
"en": "Bonbon Anglais (local soda)",
"it": "Bonbon Anglais (bibita locale)"
},
{
"fr": "Bouchon porc",
"en": "Pork bouchon (steamed dumpling)",
"it": "Bouchon di maiale (raviolo al vapore)"
},
{
"fr": "Bouchon porc ou poulet ou bœuf",
"en": "Bouchons (steamed dumplings), pork, chicken or beef",
"it": "Bouchon (ravioli al vapore) di maiale, pollo o manzo"
},
{
"fr": "Boule de glace",
"en": "Scoop of ice cream",
"it": "Pallina di gelato"
},
{
"fr": "Boulette kefta",
"en": "Kefta meatballs",
"it": "Polpette kefta"
},
{
"fr": "Bowl Frites",
"en": "Fries bowl",
"it": "Bowl di patatine"
},
{
"fr": "Brochette de filet de zébu",
"en": "Zebu fillet skewer",
"it": "Spiedino di filetto di zebù"
},
{
"fr": "Brochette de filet mignon",
"en": "Pork tenderloin skewer",
"it": "Spiedino di filetto di maiale"
},
{
"fr": "Brochette de poisson",
"en": "Fish skewer",
"it": "Spiedino di pesce"
},
{
"fr": "Brochette de poulet",
"en": "Chicken skewer",
"it": "Spiedino di pollo"
},
{
"fr": "Brochette kefta",
"en": "Kefta skewer",
"it": "Spiedino kefta"
},
{
"fr": "Brochette merguez",
"en": "Merguez skewer",
"it": "Spiedino di merguez"
},
{
"fr": "Brochette mixte",
"en": "Mixed seafood skewer",
"it": "Spiedino misto di mare"
},
{
"fr": "Brochettes de crevettes",
"en": "Shrimp skewers",
"it": "Spiedini di gamberi"
},
{
"fr": "Brochettes de filet de zébu",
"en": "Zebu fillet skewers",
"it": "Spiedini di filetto di zebù"
},
{
"fr": "Brochettes de poulet",
"en": "Chicken skewers",
"it": "Spiedini di pollo"
},
{
"fr": "Brochettes de thazard",
"en": "Kingfish skewers",
"it": "Spiedini di sgombro reale"
},
{
"fr": "Brochettes de zébu gingembre",
"en": "Ginger zebu skewers",
"it": "Spiedini di zebù allo zenzero"
},
{
"fr": "Burger Bleu Cheese",
"en": "Blue Cheese Burger",
"it": "Burger al formaggio erborinato"
},
{
"fr": "Burger Crevettes",
"en": "Shrimp Burger",
"it": "Burger di gamberi"
},
{
"fr": "Burger Montagnard",
"en": "Mountain Burger",
"it": "Burger Montanaro"
},
{
"fr": "Burger Tenders",
"en": "Chicken Tenders Burger",
"it": "Burger con tenders di pollo"
},
{
"fr": "Cabri massalé",
"en": "Cabri massalé (goat curry with massala spices)",
"it": "Cabri massalé (capretto al curry massala)"
},
{
"fr": "Caipirinha",
"en": "Caipirinha",
"it": "Caipirinha"
},
{
"fr": "Calamar grillé",
"en": "Grilled squid",
"it": "Calamari alla griglia"
},
{
"fr": "Calamar persillade",
"en": "Squid with garlic and parsley",
"it": "Calamari aglio e prezzemolo"
},
{
"fr": "Camembert pané",
"en": "Breaded Camembert",
"it": "Camembert impanato"
},
{
"fr": "Capitaine grillé",
"en": "Grilled capitaine fish",
"it": "Pesce capitaine alla griglia"
},
{
"fr": "Caprice Bonbon Anglais 33 cl",
"en": "Caprice Bonbon Anglais soda 33 cl",
"it": "Bibita Caprice Bonbon Anglais 33 cl"
},
{
"fr": "Caprice Citron",
"en": "Caprice Lemon soda",
"it": "Bibita Caprice al limone"
},
{
"fr": "Caprice Grenadine",
"en": "Caprice Grenadine soda",
"it": "Bibita Caprice alla granatina"
},
{
"fr": "Caprice Grenadine 33 cl",
"en": "Caprice Grenadine soda 33 cl",
"it": "Bibita Caprice alla granatina 33 cl"
},
{
"fr": "Caprice Orange",
"en": "Caprice Orange soda",
"it": "Bibita Caprice all'arancia"
},
{
"fr": "Caprice Orange 33 cl",
"en": "Caprice Orange soda 33 cl",
"it": "Bibita Caprice all'arancia 33 cl"
},
{
"fr": "Carbonara",
"en": "Carbonara",
"it": "Carbonara"
},
{
"fr": "Carnivore",
"en": "Carnivore",
"it": "Carnivora"
},
{
"fr": "Carpaccio de poisson",
"en": "Fish carpaccio",
"it": "Carpaccio di pesce"
},
{
"fr": "Carpaccio de zébu",
"en": "Zebu carpaccio",
"it": "Carpaccio di zebù"
},
{
"fr": "Cheeseburger",
"en": "Cheeseburger",
"it": "Cheeseburger"
},
{
"fr": "Chicken burger",
"en": "Chicken burger",
"it": "Chicken burger"
},
{
"fr": "Chicken cheeseburger",
"en": "Chicken cheeseburger",
"it": "Chicken cheeseburger"
},
{
"fr": "Coca-Cola 30 cl",
"en": "Coca-Cola 30 cl",
"it": "Coca-Cola 30 cl"
},
{
"fr": "Coca-Cola petit modèle",
"en": "Coca-Cola (small)",
"it": "Coca-Cola (piccola)"
},
{
"fr": "Cocktail de crevettes",
"en": "Shrimp cocktail",
"it": "Cocktail di gamberi"
},
{
"fr": "Cordon bleu",
"en": "Chicken cordon bleu",
"it": "Cordon bleu di pollo"
},
{
"fr": "Côte d'échine de porc",
"en": "Pork shoulder chop",
"it": "Braciola di coppa di maiale"
},
{
"fr": "Côte de porc échine",
"en": "Pork shoulder chop",
"it": "Braciola di coppa di maiale"
},
{
"fr": "Côte de zébu extra maturée",
"en": "Extra-aged zebu rib steak",
"it": "Costata di zebù extra frollata"
},
{
"fr": "Côte de zébu forestière",
"en": "Zebu rib steak with mushroom sauce",
"it": "Costata di zebù ai funghi"
},
{
"fr": "Côtes de zébu grillées",
"en": "Grilled zebu ribs",
"it": "Costate di zebù alla griglia"
},
{
"fr": "Couscous royal pour 4 personnes",
"en": "Royal couscous for 4 people",
"it": "Cuscus reale per 4 persone"
},
{
"fr": "Crème brûlée",
"en": "Crème brûlée",
"it": "Crème brûlée"
},
{
"fr": "Crème caramel ou chocolat",
"en": "Caramel or chocolate custard",
"it": "Crema al caramello o al cioccolato"
},
{
"fr": "Crêpe au chocolat",
"en": "Chocolate crêpe",
"it": "Crêpe al cioccolato"
},
{
"fr": "Crêpe banane",
"en": "Banana crêpe",
"it": "Crêpe alla banana"
},
{
"fr": "Crêpe Caramel",
"en": "Caramel Crêpe",
"it": "Crêpe al caramello"
},
{
"fr": "Crêpe Chocolat",
"en": "Chocolate Crêpe",
"it": "Crêpe al cioccolato"
},
{
"fr": "Crêpe Confiture",
"en": "Jam Crêpe",
"it": "Crêpe alla marmellata"
},
{
"fr": "Crêpe confiture ou sucre",
"en": "Jam or sugar crêpe",
"it": "Crêpe alla marmellata o allo zucchero"
},
{
"fr": "Crêpe Fraise",
"en": "Strawberry Crêpe",
"it": "Crêpe alla fragola"
},
{
"fr": "Crêpe Gourmandise",
"en": "Indulgence Crêpe",
"it": "Crêpe golosa"
},
{
"fr": "Crêpe Lait Concentré",
"en": "Condensed Milk Crêpe",
"it": "Crêpe al latte condensato"
},
{
"fr": "Crêpe Miel",
"en": "Honey Crêpe",
"it": "Crêpe al miele"
},
{
"fr": "Crêpe Nutella",
"en": "Nutella Crêpe",
"it": "Crêpe alla Nutella"
},
{
"fr": "Crêpe Sucre",
"en": "Sugar Crêpe",
"it": "Crêpe allo zucchero"
},
{
"fr": "Crevette façon Nandipo",
"en": "Nandipo-style shrimp",
"it": "Gamberi alla Nandipo"
},
{
"fr": "Crevette ou calamar sauce",
"en": "Shrimp or squid in sauce",
"it": "Gamberi o calamari in salsa"
},
{
"fr": "Crevette ou calamar sauté",
"en": "Sautéed shrimp or squid",
"it": "Gamberi o calamari saltati"
},
{
"fr": "Crevettes croustillantes",
"en": "Crispy shrimp",
"it": "Gamberi croccanti"
},
{
"fr": "Crevettes sautées aux pousses de maïs",
"en": "Shrimp stir-fried with baby corn",
"it": "Gamberi saltati con mais baby"
},
{
"fr": "Crispy burger",
"en": "Crispy burger",
"it": "Crispy burger"
},
{
"fr": "Cristal",
"en": "Cristal water",
"it": "Acqua Cristal"
},
{
"fr": "Cristal GM",
"en": "Cristal water (large)",
"it": "Acqua Cristal (grande)"
},
{
"fr": "Croque-madame",
"en": "Croque-madame",
"it": "Croque-madame"
},
{
"fr": "Croque-monsieur",
"en": "Croque-monsieur",
"it": "Croque-monsieur"
},
{
"fr": "Croustillant de crevette ou de calmar",
"en": "Crispy shrimp or squid",
"it": "Croccanti di gamberi o calamari"
},
{
"fr": "Cuisse de poulet",
"en": "Chicken leg",
"it": "Coscia di pollo"
},
{
"fr": "Curry jaune",
"en": "Yellow curry",
"it": "Curry giallo"
},
{
"fr": "Curry panang",
"en": "Panang curry",
"it": "Curry panang"
},
{
"fr": "Curry rouge",
"en": "Red curry",
"it": "Curry rosso"
},
{
"fr": "Curry vert",
"en": "Green curry",
"it": "Curry verde"
},
{
"fr": "Cuvée blanche 4 cl",
"en": "Cuvée blanche white rum 4 cl",
"it": "Rum bianco Cuvée blanche 4 cl"
},
{
"fr": "Cuvée noire 4 cl",
"en": "Cuvée noire amber rum 4 cl",
"it": "Rum ambrato Cuvée noire 4 cl"
},
{
"fr": "Demi pizza et salade",
"en": "Half pizza and salad",
"it": "Mezza pizza e insalata"
},
{
"fr": "Demi-lune poulet",
"en": "Chicken demi-lune (fried half-moon turnover)",
"it": "Demi-lune di pollo (fagottino fritto a mezzaluna)"
},
{
"fr": "Double Cheese Burger",
"en": "Double Cheese Burger",
"it": "Double Cheese Burger"
},
{
"fr": "Eau vive GM",
"en": "Eau Vive water (large)",
"it": "Acqua Eau Vive (grande)"
},
{
"fr": "Eau Vive GM",
"en": "Eau Vive water (large)",
"it": "Acqua Eau Vive (grande)"
},
{
"fr": "Eau Vive PM",
"en": "Eau Vive water (small)",
"it": "Acqua Eau Vive (piccola)"
},
{
"fr": "Eau-vive PM",
"en": "Eau Vive water (small)",
"it": "Acqua Eau Vive (piccola)"
},
{
"fr": "Émincé de poulet poivre vert",
"en": "Sliced chicken with green pepper sauce",
"it": "Straccetti di pollo al pepe verde"
},
{
"fr": "Émincé de poulet sauce estragon",
"en": "Sliced chicken in tarragon sauce",
"it": "Straccetti di pollo al dragoncello"
},
{
"fr": "Émincé de zébu aux brèdes",
"en": "Sliced zebu with brèdes (local leafy greens)",
"it": "Straccetti di zebù con brèdes (verdure a foglia locali)"
},
{
"fr": "Energy Drink Fosa 50 cl",
"en": "Fosa Energy Drink 50 cl",
"it": "Energy drink Fosa 50 cl"
},
{
"fr": "Energy Drink XXL",
"en": "XXL Energy Drink",
"it": "Energy drink XXL"
},
{
"fr": "Fanta 30 cl",
"en": "Fanta 30 cl",
"it": "Fanta 30 cl"
},
{
"fr": "Filet de poisson sauce au choix",
"en": "Fish fillet, choice of sauce",
"it": "Filetto di pesce, salsa a scelta"
},
{
"fr": "Filet de zébu",
"en": "Zebu fillet",
"it": "Filetto di zebù"
},
{
"fr": "Filet de zébu sauce au choix",
"en": "Zebu fillet, choice of sauce",
"it": "Filetto di zebù, salsa a scelta"
},
{
"fr": "Filet de zébu sauce au poivre",
"en": "Zebu fillet with pepper sauce",
"it": "Filetto di zebù al pepe"
},
{
"fr": "Flambée",
"en": "Flambée",
"it": "Flambée"
},
{
"fr": "Focaccia",
"en": "Focaccia",
"it": "Focaccia"
},
{
"fr": "Foie gras poêlé",
"en": "Pan-seared foie gras",
"it": "Foie gras in padella"
},
{
"fr": "Fondue chinoise terre et mer",
"en": "Chinese hot pot, surf and turf",
"it": "Fonduta cinese terra e mare"
},
{
"fr": "Francescana",
"en": "Francescana",
"it": "Francescana"
},
{
"fr": "Fresh 33 cl",
"en": "Fresh beer 33 cl",
"it": "Birra Fresh 33 cl"
},
{
"fr": "Fresh PM",
"en": "Fresh beer (small)",
"it": "Birra Fresh (piccola)"
},
{
"fr": "Fromagère",
"en": "Cheese lover's",
"it": "Ai formaggi"
},
{
"fr": "Fruit de mer",
"en": "Seafood",
"it": "Frutti di mare"
},
{
"fr": "Fruits de la mer",
"en": "Seafood",
"it": "Frutti di mare"
},
{
"fr": "Fruits de mer",
"en": "Seafood",
"it": "Frutti di mare"
},
{
"fr": "Gargantua",
"en": "Gargantua",
"it": "Gargantua"
},
{
"fr": "Glaces",
"en": "Ice cream",
"it": "Gelati"
},
{
"fr": "Gold",
"en": "Gold beer",
"it": "Birra Gold"
},
{
"fr": "Gold 65 cl",
"en": "Gold beer 65 cl",
"it": "Birra Gold 65 cl"
},
{
"fr": "Gold Blanche 33 cl",
"en": "Gold Blanche wheat beer 33 cl",
"it": "Birra Gold Blanche 33 cl"
},
{
"fr": "Gold Blanche 50 cl",
"en": "Gold Blanche wheat beer 50 cl",
"it": "Birra Gold Blanche 50 cl"
},
{
"fr": "Gratin de fruit de mer",
"en": "Seafood gratin",
"it": "Gratin di frutti di mare"
},
{
"fr": "Italienne",
"en": "Italian",
"it": "Italiana"
},
{
"fr": "Jambon cru et parmesan",
"en": "Cured ham and parmesan",
"it": "Prosciutto crudo e parmigiano"
},
{
"fr": "Jambon et champignons",
"en": "Ham and mushrooms",
"it": "Prosciutto e funghi"
},
{
"fr": "Kebab (ou assiette)",
"en": "Kebab (or plate)",
"it": "Kebab (o piatto)"
},
{
"fr": "Langouste grillée",
"en": "Grilled spiny lobster",
"it": "Aragosta alla griglia"
},
{
"fr": "Langue de zébu",
"en": "Zebu tongue",
"it": "Lingua di zebù"
},
{
"fr": "Lasagne",
"en": "Lasagne",
"it": "Lasagne"
},
{
"fr": "Le classique",
"en": "The classic",
"it": "Il classico"
},
{
"fr": "Le patron",
"en": "The boss",
"it": "Il padrone"
},
{
"fr": "Le poisson",
"en": "The fish",
"it": "Il pesce"
},
{
"fr": "Légumes grillés",
"en": "Grilled vegetables",
"it": "Verdure grigliate"
},
{
"fr": "Les Siciliens",
"en": "Les Siciliens",
"it": "Les Siciliens"
},
{
"fr": "Lido",
"en": "Lido",
"it": "Lido"
},
{
"fr": "Magret de canard",
"en": "Duck breast",
"it": "Petto d'anatra"
},
{
"fr": "Magret de canard sauce poivre vert",
"en": "Duck breast with green pepper sauce",
"it": "Petto d'anatra al pepe verde"
},
{
"fr": "Maître Coq",
"en": "Maître Coq",
"it": "Maître Coq"
},
{
"fr": "Mangoustan's 4 cl",
"en": "Mangoustan's rum 4 cl",
"it": "Rum Mangoustan's 4 cl"
},
{
"fr": "Margarita",
"en": "Margherita",
"it": "Margherita"
},
{
"fr": "Margherita",
"en": "Margherita",
"it": "Margherita"
},
{
"fr": "Marinara",
"en": "Marinara",
"it": "Marinara"
},
{
"fr": "Marmite du pêcheur",
"en": "Fisherman's stew",
"it": "Zuppa del pescatore"
},
{
"fr": "Massalé cabri",
"en": "Massalé cabri (goat curry with massala spices)",
"it": "Massalé cabri (capretto al curry massala)"
},
{
"fr": "Mi sao",
"en": "Mi sao (stir-fried noodles)",
"it": "Mi sao (noodles saltati)"
},
{
"fr": "Mi Xao",
"en": "Mi Xao (stir-fried noodles)",
"it": "Mi Xao (noodles saltati)"
},
{
"fr": "Milkshake Chocolat",
"en": "Chocolate Milkshake",
"it": "Milkshake al cioccolato"
},
{
"fr": "Milkshake Fraise",
"en": "Strawberry Milkshake",
"it": "Milkshake alla fragola"
},
{
"fr": "Milkshake Kinder Bueno",
"en": "Kinder Bueno Milkshake",
"it": "Milkshake Kinder Bueno"
},
{
"fr": "Milkshake Oreo",
"en": "Oreo Milkshake",
"it": "Milkshake Oreo"
},
{
"fr": "Milkshake Snickers",
"en": "Snickers Milkshake",
"it": "Milkshake Snickers"
},
{
"fr": "Milkshake Spéculoos",
"en": "Speculoos Milkshake",
"it": "Milkshake Speculoos"
},
{
"fr": "Milkshake Twix",
"en": "Twix Milkshake",
"it": "Milkshake Twix"
},
{
"fr": "Milkshake Vanille",
"en": "Vanilla Milkshake",
"it": "Milkshake alla vaniglia"
},
{
"fr": "Mousse au chocolat",
"en": "Chocolate mousse",
"it": "Mousse al cioccolato"
},
{
"fr": "Mousse chocolat",
"en": "Chocolate mousse",
"it": "Mousse al cioccolato"
},
{
"fr": "Napolitaine",
"en": "Napoletana",
"it": "Napoletana"
},
{
"fr": "Nem au poulet",
"en": "Chicken spring roll",
"it": "Involtino primavera al pollo"
},
{
"fr": "Nem porc ou poulet ou zébu",
"en": "Spring rolls, pork, chicken or zebu",
"it": "Involtini primavera di maiale, pollo o zebù"
},
{
"fr": "Nems viande 3 pièces",
"en": "Meat spring rolls, 3 pieces",
"it": "Involtini primavera di carne, 3 pezzi"
},
{
"fr": "Nordique",
"en": "Nordic",
"it": "Nordica"
},
{
"fr": "Norma",
"en": "Norma",
"it": "Norma"
},
{
"fr": "Nuggets × 5",
"en": "Nuggets × 5",
"it": "Nuggets × 5"
},
{
"fr": "Océane",
"en": "Océane (seafood)",
"it": "Océane (frutti di mare)"
},
{
"fr": "Œuf mimosa",
"en": "Deviled eggs",
"it": "Uova ripiene"
},
{
"fr": "Omelette campagnarde",
"en": "Country-style omelette",
"it": "Frittata alla contadina"
},
{
"fr": "Omelette légumes",
"en": "Vegetable omelette",
"it": "Frittata di verdure"
},
{
"fr": "Oriental",
"en": "Oriental",
"it": "Orientale"
},
{
"fr": "Os à moëlle rôti",
"en": "Roasted bone marrow",
"it": "Midollo osseo arrosto"
},
{
"fr": "Pad thaï royal",
"en": "Royal pad thai",
"it": "Pad thai reale"
},
{
"fr": "Panini",
"en": "Panini",
"it": "Panino"
},
{
"fr": "Parmigiana",
"en": "Parmigiana",
"it": "Parmigiana"
},
{
"fr": "Pastis Pastanis 4 cl",
"en": "Pastanis pastis 4 cl",
"it": "Pastis Pastanis 4 cl"
},
{
"fr": "Pastis Prado 4 cl",
"en": "Prado pastis 4 cl",
"it": "Pastis Prado 4 cl"
},
{
"fr": "Pastis Ricard 2 cl",
"en": "Ricard pastis 2 cl",
"it": "Pastis Ricard 2 cl"
},
{
"fr": "Pastis Ricard 4 cl",
"en": "Ricard pastis 4 cl",
"it": "Pastis Ricard 4 cl"
},
{
"fr": "Pâtes au beurre",
"en": "Buttered pasta",
"it": "Pasta al burro"
},
{
"fr": "Pâtes aux moules",
"en": "Pasta with mussels",
"it": "Pasta con le cozze"
},
{
"fr": "Pâtes bolognaise",
"en": "Pasta bolognese",
"it": "Pasta alla bolognese"
},
{
"fr": "Pâtes carbonara",
"en": "Pasta carbonara",
"it": "Pasta alla carbonara"
},
{
"fr": "Pâtes fraîches épicées aux crevettes",
"en": "Spicy fresh noodles with shrimp",
"it": "Pasta fresca piccante ai gamberi"
},
{
"fr": "Pâtes fruit de mer",
"en": "Seafood pasta",
"it": "Pasta ai frutti di mare"
},
{
"fr": "Pavé de zébu piqué à l'ail",
"en": "Garlic-studded zebu steak",
"it": "Trancio di zebù all'aglio"
},
{
"fr": "Paysanne",
"en": "Country-style",
"it": "Contadina"
},
{
"fr": "Pizzaiola",
"en": "Pizzaiola",
"it": "Pizzaiola"
},
{
"fr": "Plats mixtes",
"en": "Mixed platter",
"it": "Piatto misto"
},
{
"fr": "Poisson (filet)",
"en": "Fish (fillet)",
"it": "Pesce (filetto)"
},
{
"fr": "Poisson coco",
"en": "Fish in coconut sauce",
"it": "Pesce al cocco"
},
{
"fr": "Poisson entier grillé",
"en": "Whole grilled fish",
"it": "Pesce intero alla griglia"
},
{
"fr": "Poisson frit entier",
"en": "Whole fried fish",
"it": "Pesce intero fritto"
},
{
"fr": "Poisson grillé",
"en": "Grilled fish",
"it": "Pesce alla griglia"
},
{
"fr": "Poisson pané",
"en": "Breaded fish",
"it": "Pesce impanato"
},
{
"fr": "Poisson sauce poireau",
"en": "Fish with leek sauce",
"it": "Pesce in salsa di porri"
},
{
"fr": "Poitrine de porc",
"en": "Pork belly",
"it": "Pancetta di maiale"
},
{
"fr": "Pomme de terre",
"en": "Potato",
"it": "Patate"
},
{
"fr": "Pommes frites",
"en": "French fries",
"it": "Patatine fritte"
},
{
"fr": "Popcorn au poulet",
"en": "Popcorn chicken",
"it": "Pollo popcorn"
},
{
"fr": "Poulet au coco",
"en": "Chicken in coconut sauce",
"it": "Pollo al cocco"
},
{
"fr": "Poulet citronné",
"en": "Lemon chicken",
"it": "Pollo al limone"
},
{
"fr": "Poulet coco",
"en": "Coconut chicken",
"it": "Pollo al cocco"
},
{
"fr": "Poulet croustillant",
"en": "Crispy chicken",
"it": "Pollo croccante"
},
{
"fr": "Poulet façon KFC",
"en": "KFC-style chicken",
"it": "Pollo stile KFC"
},
{
"fr": "Poulet grillé",
"en": "Grilled chicken",
"it": "Pollo alla griglia"
},
{
"fr": "Poulet milanese",
"en": "Chicken milanese",
"it": "Pollo alla milanese"
},
{
"fr": "Poulet pané",
"en": "Breaded chicken",
"it": "Pollo impanato"
},
{
"fr": "Punch coco 4 cl",
"en": "Coconut rum punch 4 cl",
"it": "Punch al cocco 4 cl"
},
{
"fr": "Reine",
"en": "Reine",
"it": "Regina"
},
{
"fr": "Ribs laqué",
"en": "Glazed ribs",
"it": "Costine laccate"
},
{
"fr": "Riz cantonais",
"en": "Cantonese fried rice",
"it": "Riso alla cantonese"
},
{
"fr": "Romana",
"en": "Romana",
"it": "Romana"
},
{
"fr": "Romazava poisson",
"en": "Fish romazava (Malagasy leafy greens stew)",
"it": "Romazava di pesce (stufato malgascio di verdure a foglia)"
},
{
"fr": "Romazava poulet",
"en": "Chicken romazava (Malagasy leafy greens stew)",
"it": "Romazava di pollo (stufato malgascio di verdure a foglia)"
},
{
"fr": "Romazava viande",
"en": "Meat romazava (Malagasy leafy greens stew)",
"it": "Romazava di carne (stufato malgascio di verdure a foglia)"
},
{
"fr": "Rôti porc à la créole",
"en": "Creole-style roast pork",
"it": "Arrosto di maiale alla creola"
},
{
"fr": "Rougail saucisse",
"en": "Rougail saucisse (sausages in spicy tomato sauce)",
"it": "Rougail saucisse (salsicce in salsa di pomodoro piccante)"
},
{
"fr": "Rougail saucisses",
"en": "Rougail saucisses (sausages simmered in tomato, onion and ginger)",
"it": "Rougail saucisses (salsicce stufate con pomodoro, cipolla e zenzero)"
},
{
"fr": "Rouleaux",
"en": "Rolls",
"it": "Involtini"
},
{
"fr": "Rouleaux de grosses crevettes",
"en": "Large shrimp rolls",
"it": "Involtini di gamberoni"
},
{
"fr": "Rouleaux de printemps 3 pièces",
"en": "Fresh spring rolls, 3 pieces",
"it": "Involtini primavera freschi, 3 pezzi"
},
{
"fr": "Rouleaux de printemps aux crevettes",
"en": "Fresh shrimp spring rolls",
"it": "Involtini primavera freschi ai gamberi"
},
{
"fr": "Salade Bleu / Poulet",
"en": "Blue Cheese / Chicken Salad",
"it": "Insalata formaggio erborinato / pollo"
},
{
"fr": "Salade crudité œuf dur",
"en": "Raw vegetable salad with hard-boiled egg",
"it": "Insalata di verdure crude con uovo sodo"
},
{
"fr": "Salade de crudité",
"en": "Raw vegetable salad",
"it": "Insalata di verdure crude"
},
{
"fr": "Salade de fruit de saison",
"en": "Seasonal fruit salad",
"it": "Macedonia di frutta di stagione"
},
{
"fr": "Salade de fruits",
"en": "Fruit salad",
"it": "Macedonia di frutta"
},
{
"fr": "Salade de papaye",
"en": "Papaya salad",
"it": "Insalata di papaya"
},
{
"fr": "Salade légumes",
"en": "Vegetable salad",
"it": "Insalata di verdure"
},
{
"fr": "Salade Nandipo",
"en": "Nandipo Salad",
"it": "Insalata Nandipo"
},
{
"fr": "Salade Tenders",
"en": "Chicken Tenders Salad",
"it": "Insalata con tenders di pollo"
},
{
"fr": "Salade tomate crevettes",
"en": "Tomato and shrimp salad",
"it": "Insalata di pomodori e gamberi"
},
{
"fr": "Salade tomate œuf dur",
"en": "Tomato and hard-boiled egg salad",
"it": "Insalata di pomodori e uovo sodo"
},
{
"fr": "Salame (chorizo) italienne",
"en": "Italian salami",
"it": "Salame italiano"
},
{
"fr": "Sambos fromage",
"en": "Cheese sambos (samosa)",
"it": "Sambos al formaggio (samosa)"
},
{
"fr": "Sambos zébu ou poulet",
"en": "Zebu or chicken sambos (samosa)",
"it": "Sambos di zebù o pollo (samosa)"
},
{
"fr": "Sambossa au zébu",
"en": "Zebu sambossa (samosa)",
"it": "Sambossa di zebù (samosa)"
},
{
"fr": "Sandwich fromage",
"en": "Cheese sandwich",
"it": "Panino al formaggio"
},
{
"fr": "Sandwich omelette",
"en": "Omelette sandwich",
"it": "Panino con frittata"
},
{
"fr": "Sandwich poisson fumé",
"en": "Smoked fish sandwich",
"it": "Panino al pesce affumicato"
},
{
"fr": "Satay de poulet",
"en": "Chicken satay",
"it": "Satay di pollo"
},
{
"fr": "Sauce aigre-douce",
"en": "Sweet and sour",
"it": "In agrodolce"
},
{
"fr": "Sauté de porc aux légumes",
"en": "Pork stir-fry with vegetables",
"it": "Maiale saltato con verdure"
},
{
"fr": "Sauté porc aux gros piments",
"en": "Pork sautéed with large chili peppers",
"it": "Maiale saltato con peperoncini grossi"
},
{
"fr": "Savoyarde",
"en": "Savoyarde",
"it": "Savoiarda"
},
{
"fr": "Sirop",
"en": "Syrup drink",
"it": "Sciroppo"
},
{
"fr": "Soupe chinoise",
"en": "Soupe chinoise (noodle soup)",
"it": "Soupe chinoise (zuppa di noodles)"
},
{
"fr": "Soupe de poisson maison",
"en": "Homemade fish soup",
"it": "Zuppa di pesce della casa"
},
{
"fr": "Soupe garnie",
"en": "Hearty soup",
"it": "Zuppa guarnita"
},
{
"fr": "Soupe spéciale MK",
"en": "MK special soup",
"it": "Zuppa speciale MK"
},
{
"fr": "Spaghetti bolognaise",
"en": "Spaghetti bolognese",
"it": "Spaghetti alla bolognese"
},
{
"fr": "Sprite 30 cl",
"en": "Sprite 30 cl",
"it": "Sprite 30 cl"
},
{
"fr": "Sprite petit modèle",
"en": "Sprite (small)",
"it": "Sprite (piccola)"
},
{
"fr": "Steak de zébu",
"en": "Zebu steak",
"it": "Bistecca di zebù"
},
{
"fr": "Steak grillé ou steak milanaise",
"en": "Grilled steak or steak milanese",
"it": "Bistecca alla griglia o alla milanese"
},
{
"fr": "Steak haché",
"en": "Zebu patty",
"it": "Hamburger di zebù"
},
{
"fr": "Steak haché à cheval",
"en": "Zebu patty with fried egg",
"it": "Hamburger di zebù con uovo"
},
{
"fr": "Tacos",
"en": "French tacos",
"it": "Tacos"
},
{
"fr": "Tagliolino ragù",
"en": "Tagliolino ragù",
"it": "Tagliolino ragù"
},
{
"fr": "Tajine d'agneau",
"en": "Lamb tagine",
"it": "Tajine di agnello"
},
{
"fr": "Tajine de poisson",
"en": "Fish tagine",
"it": "Tajine di pesce"
},
{
"fr": "Tajine de poulet",
"en": "Chicken tagine",
"it": "Tajine di pollo"
},
{
"fr": "Tajine de zébu",
"en": "Zebu tagine",
"it": "Tajine di zebù"
},
{
"fr": "Tartare de poisson",
"en": "Fish tartare",
"it": "Tartare di pesce"
},
{
"fr": "Tenders × 4",
"en": "Tenders × 4",
"it": "Tenders × 4"
},
{
"fr": "Terrine de campagne maison",
"en": "Homemade country pâté",
"it": "Terrina di campagna della casa"
},
{
"fr": "Terrine foie gras",
"en": "Foie gras terrine",
"it": "Terrina di foie gras"
},
{
"fr": "THB 50 cl",
"en": "THB beer 50 cl",
"it": "Birra THB 50 cl"
},
{
"fr": "THB 65 cl",
"en": "THB beer 65 cl",
"it": "Birra THB 65 cl"
},
{
"fr": "THB GM",
"en": "THB beer (large)",
"it": "Birra THB (grande)"
},
{
"fr": "THB PM",
"en": "THB beer (small)",
"it": "Birra THB (piccola)"
},
{
"fr": "Ti pan de steak de zébu",
"en": "Zebu steak ti pan (sizzling griddle plate)",
"it": "Ti pan di bistecca di zebù (piastra)"
},
{
"fr": "Ti pan mixte",
"en": "Mixed ti pan (sizzling griddle plate)",
"it": "Ti pan misto (piastra)"
},
{
"fr": "Ti pan porc",
"en": "Pork ti pan (sizzling griddle plate)",
"it": "Ti pan di maiale (piastra)"
},
{
"fr": "Ti pan poulet",
"en": "Chicken ti pan (sizzling griddle plate)",
"it": "Ti pan di pollo (piastra)"
},
{
"fr": "Ti-punch",
"en": "Ti-punch",
"it": "Ti-punch"
},
{
"fr": "Tom kha gai",
"en": "Tom kha gai",
"it": "Tom kha gai"
},
{
"fr": "Tom yam",
"en": "Tom yam",
"it": "Tom yam"
},
{
"fr": "Tonic",
"en": "Tonic",
"it": "Acqua tonica"
},
{
"fr": "Toscana",
"en": "Toscana",
"it": "Toscana"
},
{
"fr": "Toscane",
"en": "Tuscan",
"it": "Toscana"
},
{
"fr": "Van tan frit",
"en": "Fried wonton",
"it": "Wonton fritti"
},
{
"fr": "Vegetariana",
"en": "Vegetariana",
"it": "Vegetariana"
},
{
"fr": "Végétarienne",
"en": "Vegetarian",
"it": "Vegetariana"
},
{
"fr": "Whisky J.B 2 cl",
"en": "J&B whisky 2 cl",
"it": "Whisky J&B 2 cl"
},
{
"fr": "Whisky J.B 4 cl",
"en": "J&B whisky 4 cl",
"it": "Whisky J&B 4 cl"
},
{
"fr": "World Cola",
"en": "World Cola",
"it": "World Cola"
},
{
"fr": "World Cola 33 cl",
"en": "World Cola 33 cl",
"it": "World Cola 33 cl"
},
{
"fr": "Zébu sauté poivre noir",
"en": "Zebu stir-fried with black pepper",
"it": "Zebù saltato al pepe nero"
},
{
"fr": "1/2 poulet grillé BBQ",
"en": "1/2 BBQ grilled chicken",
"it": "1/2 pollo alla griglia BBQ"
},
{
"fr": "Blanquette de poisson",
"en": "Fish blanquette (creamy white stew)",
"it": "Blanquette di pesce (spezzatino in salsa bianca)"
},
{
"fr": "Boudin noir façon hachis",
"en": "Black pudding, hachis-style (with mashed potato)",
"it": "Sanguinaccio in stile hachis (con purè)"
},
{
"fr": "Camaron grillé brasero",
"en": "Camaron (large freshwater prawns) grilled over the brazier",
"it": "Camaron (gamberoni d'acqua dolce) grigliati alla brace"
},
{
"fr": "Choucroute minute",
"en": "Quick choucroute (sauerkraut with pork)",
"it": "Choucroute veloce (crauti con maiale)"
},
{
"fr": "Escalope de poulet milanaise sauce champignon",
"en": "Chicken escalope milanese, mushroom sauce",
"it": "Cotoletta di pollo alla milanese, salsa ai funghi"
},
{
"fr": "Hachis parmentier",
"en": "Hachis parmentier (shepherd's pie)",
"it": "Hachis parmentier (pasticcio di carne e purè)"
},
{
"fr": "Linguines aux crevettes",
"en": "Shrimp linguine",
"it": "Linguine ai gamberi"
},
{
"fr": "Paella",
"en": "Paella",
"it": "Paella"
},
{
"fr": "Pesto de calamars",
"en": "Squid with pesto",
"it": "Calamari al pesto"
},
{
"fr": "Pot-au-feu",
"en": "Pot-au-feu (French beef and vegetable stew)",
"it": "Pot-au-feu (bollito di manzo e verdure)"
},
{
"fr": "Poulet basquaise",
"en": "Basque-style chicken",
"it": "Pollo alla basca"
},
{
"fr": "Poulet sauté aux noix de cajou",
"en": "Chicken stir-fried with cashew nuts",
"it": "Pollo saltato con anacardi"
},
{
"fr": "Poulpe à la provençale",
"en": "Provençal-style octopus",
"it": "Polpo alla provenzale"
},
{
"fr": "Rôti de porc provençale ou miel",
"en": "Roast pork, Provençal or honey",
"it": "Arrosto di maiale alla provenzale o al miele"
},
{
"fr": "Salade Marseillaise",
"en": "Marseille salad",
"it": "Insalata marsigliese"
},
{
"fr": "Salade Parisienne",
"en": "Parisian salad",
"it": "Insalata parigina"
},
{
"fr": "Sauté de porc à l'ananas",
"en": "Pork stir-fry with pineapple",
"it": "Maiale saltato all'ananas"
},
{
"fr": "Steak à la chinoise",
"en": "Chinese-style steak",
"it": "Bistecca alla cinese"
},
{
"fr": "Tartare de zébu",
"en": "Zebu tartare",
"it": "Tartare di zebù"
},
{
"fr": "Tiramisu",
"en": "Tiramisu",
"it": "Tiramisù"
},
{
"fr": "Tripes à la mode de Caen",
"en": "Tripes à la mode de Caen (Normandy-style tripe)",
"it": "Trippa alla moda di Caen (alla normanna)"
}
]$tr$::jsonb) as x(fr text, en text, it text))
insert into public.traductions_catalogue (fr, langue, texte)
select fr, 'en', en from x union all select fr, 'it', it from x
on conflict (fr, langue) do update set texte = excluded.texte, maj_le = now();
