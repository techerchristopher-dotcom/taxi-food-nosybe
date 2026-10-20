# -*- coding: utf-8 -*-
"""CE QUE PORTE LA CARTE PAPIER DES SICILIENS ET PAS LA BASE TAXI FOOD (photos IMG_2073 / IMG_2074, 2026-10-20).
Les plats et leurs prix concordent ligne a ligne avec la base Taxi Food (46 plats) : ils viennent de
donnees_siciliens.json. On ajoute ici les boissons, les desserts (sans prix sur la carte papier) et les
supplements. Boissons et desserts ne sont pas sur Taxi Food : marques « servis sur place »."""

SUPPLEMENTS = {
    'Pizza': 'Pizza à emporter : + 2 000 Ar · Chaque ingrédient en plus : + 4 000 Ar',
    'Pâtes': 'Ajouter du fromage : + 5 000 Ar',
    'Burger': 'Chaque ingrédient en plus : + 4 000 Ar',
}

# (titre de groupe, [(nom, prix, detail)])
BOISSONS = [
    ('Eaux et softs', [('Eau Vive', 7000, 'grande'), ('Eau Vive', 5000, 'petite'),
                       ('Boisson Star', 5000, 'bouteille'), ('Boisson Star', 6000, 'canette')]),
    ('Vin', [('Vin', 15000, 'au verre')]),
    ('Bières', [('THB', 8000, '65 cl'), ('THB Fresh', 7000, '65 cl'), ('THB', 9000, 'canette'),
                ('Gold', 9000, '65 cl'), ('Gold Blanche', 9000, 'canette grand modèle'),
                ('Beaufort', 10000, 'grand modèle'), ('Beaufort', 8000, 'petit modèle')]),
    ('Alcools', [('Rhum', 7000, 'différentes saveurs'), ('Rhum de la maison glacé', 9000, ''),
                 ('Gin', 10000, ''), ('Vodka', 10000, ''), ('Whisky', 10000, ''), ('Pastis', 6000, ''),
                 ('Caipirinha', 10000, '')]),
    ('Jus, boissons chaudes et milkshake', [('Jus naturel', 6000, 'différentes saveurs'), ('Milkshake', 18000, ''),
                 ('Café italien', 6000, ''), ('Café américain', 6000, ''), ('Cappuccino', 8000, ''),
                 ('Chocolat chaud', 8000, ''), ('Thé', 6000, 'différentes saveurs')]),
]

DESSERTS = ['Tiramisù', 'Glaces', 'Nougat']
