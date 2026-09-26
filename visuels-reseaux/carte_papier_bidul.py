# -*- coding: utf-8 -*-
"""La carte PAPIER de Chez Bidul & Truc, relevee sur les 3 photos du 24/09/2026.

Trois pages : BOISSON SANS ALCOOL + TAPAS, ENTREE + HAMBURGER + PLAT,
et la suite des PLAT + PATES + GRILLADE BRASERO + DESSERT.

LECTURE DE LA COLONNE DES PRIX. Sur la page des boissons, la colonne des prix
est decalee d'une ligne vers le haut par rapport aux intitules : le premier
prix est imprime a hauteur du titre de rubrique. Le decalage se prouve par la
coherence interne — Ricard 2 cl a 10 000 et Ricard 4 cl a 15 000, J.B 2 cl a
10 000 et J.B 4 cl a 15 000 — et se confirme par la base, ou les douze
aperitifs portent exactement ces douze valeurs.
"""

PAPIER = {
 # --- TAPAS ---
 "Poisson fumé": 18000,
 "Beignets crevettes, calamar ou poisson": 17000,
 "Crevettes croustillantes": 17000,
 "Poulet croustillant": 17000,
 "Pommes frites": 10000,
 # --- ENTREE ---
 "Camembert pané": 22000,
 "Foie gras poêlé": 29000,
 "Terrine foie gras": 29000,
 "Salade légumes": 8000,
 "Œuf mimosa": 9000,
 "Salade tomate œuf dur": 9000,
 "Salade crudité œuf dur": 9000,
 "Salade tomate crevettes": 14000,
 "Tartare de poisson": 18000,
 "Carpaccio de poisson": 18000,
 "Carpaccio de zébu": 20000,
 "Terrine de campagne maison": 10000,
 # --- HAMBURGER ---
 "Le classique": 24000,
 "Le poisson": 24000,
 "Le patron": 28000,
 # --- PLAT ---
 "Soupe de poisson maison": 22000,
 "Omelette légumes": 14000,
 "Omelette campagnarde": 25000,
 "Cordon bleu": 28000,
 "Croque-monsieur": 22000,
 "Croque-madame": 24000,
 "Poisson (filet)": 27000,
 "Filet de poisson sauce au choix": 30000,
 "Cuisse de poulet": 28000,
 "Filet de zébu": 30000,
 "Pavé de zébu piqué à l'ail": 31000,
 "Filet de zébu sauce au choix": 33000,
 "Crevette ou calamar sauté": 30000,
 "Crevette ou calamar sauce": 32000,
 "Marmite du pêcheur": 33000,
 "Émincé de poulet sauce estragon": 31000,
 "Steak haché": 24000,
 "Steak haché à cheval": 26000,
 # --- PATES ---
 "Pâtes au beurre": 14000,
 "Pâtes carbonara": 30000,
 "Pâtes bolognaise": 29000,
 "Pâtes fruit de mer": 30000,
 # --- DESSERT ---
 "Mousse au chocolat": 12000,
 "Crêpes": 9000,
 "Crème caramel ou chocolat": 12000,
 "Crème brûlée": 15000,
 "Banane flambée": 9000,
 "Salade de fruit de saison": 9000,
 # --- BOISSONS : PM, EAU, APERITIF ---
 "Caprice Grenadine 33 cl": 5000,
 "Caprice Bonbon Anglais 33 cl": 5000,
 "Caprice Orange 33 cl": 5000,
 "World Cola 33 cl": 5000,
 "Cristal GM": 10000,
 "Eau-vive PM": 5000,
 "Eau vive GM": 7000,
 "Pastis Prado 4 cl": 5000,
 "Pastis Pastanis 4 cl": 5000,
 "Pastis Ricard 2 cl": 10000,
 "Pastis Ricard 4 cl": 15000,
 "Punch coco 4 cl": 5000,
 "Cuvée noire 4 cl": 8000,
 "Cuvée blanche 4 cl": 8000,
 "Whisky J.B 2 cl": 10000,
 "Whisky J.B 4 cl": 15000,
 "Mangoustan's 4 cl": 6000,
 "Caipirinha": 6000,
 "Ti-punch": 6000,
}

# Ce que le papier facture EN PLUS, hors plats
SUPPLEMENTS_PAPIER = {
 "Supplément riz ou Rougail tomate": 4000,
 "Supplément sauce": 5000,
 "Supplément fromage (pâtes)": 6000,
}

# Ce que le papier ne chiffre pas
SANS_PRIX_AU_PAPIER = [
 "Merguez de mouton frites (les 3)", "Brochette de filet mignon de porc",
 "Côte de porc échine", "Brochette de poisson", "Brochette de filet de zébu",
 "Côte de zébu extra maturée", "Magret de canard", "Langouste grillée",
 "Capitaine grillé",
]   # « Voir tableau » : le brasero renvoie a un tableau separe
