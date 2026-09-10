# -*- coding: utf-8 -*-
"""Registre des plats. Une entree = un visuel. Rien d'autre ne se touche.

Variante VALIDEE : debord (plat detoure sur fond studio, pose par-dessus le rouge).
Le placement est celui de la SERIE (gabarit.debord_serie), identique pour tous
les plats d'un meme restaurant : meme largeur, meme centre, meme ligne de fuite.
Un reglage par plat a ete essaye puis abandonne — il donnait une collection,
pas une serie.

Pour ajouter un plat :
  1. detourage.py sur la photo source   ->  det-<slug>.png + det-<slug>.json
  2. une entree ci-dessous
  3. rendre.py <slug>  ->  rend le PNG et verifie les trois regles

titre       : le nom EXACT de la base, pour que le client le retrouve dans l'appli
secondaire  : 4 ingredients maxi, ceux qui vendent. Le detail complet va dans la legende.
prix        : tel qu'en base, au chiffre pres
"""

BIDUL_LIEU = ('<b style="font-weight:800;letter-spacing:2.2px;text-transform:uppercase;">'
              'Chez Bidul &amp; Truc</b> &nbsp;·&nbsp; au feu de bois &nbsp;·&nbsp; le soir, 7 j/7')
CABANE_LIEU = ('<b style="font-weight:800;letter-spacing:2.2px;text-transform:uppercase;">'
               'La Cabane</b> &nbsp;·&nbsp; Ambatoloaka &nbsp;·&nbsp; burgers, tacos, crêpes')


def _plat(slug, titre, secondaire, prix, base, lieu, logo, serie):
    return dict(titre=titre, secondaire=secondaire, prix=prix, base_complete=base,
                detour=f'det-{slug}.png', detour_web=f'web-{slug}.webp',
                lieu=lieu, logo=logo, serie=serie, fichier=f'{slug}.png')


def _pizza(slug, titre, secondaire, prix, base):
    return _plat(slug, titre, secondaire, prix, base, BIDUL_LIEU, 'bidul.jpg', 'PIZZA')


def _cabane(slug, titre, secondaire, prix, base):
    return _plat(slug, titre, secondaire, prix, base, CABANE_LIEU, 'cabane.jpg', 'CABANE')


PLATS = {
 # ---------- Chez Bidul & Truc — les pizzas au feu de bois ----------
 'gargantua': _pizza('gargantua', 'Gargantua', 'Viande hachée, poulet, merguez, œuf', '35 000 Ar',
    'Tomate, gouda, mozzarella, viande hachée, poulet, merguez, oignon, poivron, œuf'),
 'savoyarde': _pizza('savoyarde', 'Savoyarde', 'Crème, lardon, pomme de terre, œuf', '35 000 Ar',
    'Crème, oignon, fromage de montagne, gouda, lardon, pomme de terre, œuf'),
 '4fromages': _pizza('4fromages', '4 Fromages', 'Gouda, mozzarella, bleu, raclette', '32 000 Ar',
    "Crème, gouda, mozzarella, bleu d'Antsirabe, raclette"),
 'oriental': _pizza('oriental', 'Oriental', 'Merguez, viande hachée, poivron, œuf', '31 000 Ar',
    'Tomate, gouda, mozzarella, merguez, viande hachée, oignon, poivron, œuf'),
 'napolitaine': _pizza('napolitaine', 'Napolitaine', 'Câpres, anchois, olives noires', '31 000 Ar',
    'Tomate, gouda, mozzarella, câpres, anchois, olives noires'),
 'paysanne': _pizza('paysanne', 'Paysanne', 'Crème, jambon, champignons', '29 000 Ar',
    'Crème, fromage local, mozzarella, jambon de porc, champignons'),
 'oceane': _pizza('oceane', 'Océane', 'Calamar, crevette, poisson, mozzarella', '29 000 Ar',
    'Tomate, calamar, crevette, poisson, gouda, mozzarella'),
 'maitrecoq': _pizza('maitrecoq', 'Maître Coq', 'Tomate, mozzarella, poulet', '27 000 Ar',
    'Tomate, gouda, mozzarella, poulet'),

 # ---------- La Cabane — Ambatoloaka ----------
 # Pas de milkshake ici : un verre transparent sur fond neutre est invisible pour
 # un detourage par la couleur (le pied du verre disparait). Les boissons se
 # traitent en packshot, comme les canettes — pas avec ce gabarit.
 'lc-burger-montagnard': _cabane('lc-burger-montagnard', 'Burger Montagnard',
    'Steak, raclette, poitrine, oignon confit', '35 000 Ar',
    'Steak, raclette, poitrine, cheddar, oignon caramélisé. Frites incluses.'),
 'lc-burger-tenders': _cabane('lc-burger-tenders', 'Burger Tenders',
    'Poulet croustillant, cheddar, salade', '35 000 Ar',
    'Poulet croustillant, cheddar, oignon, salade, tomate. Frites incluses.'),
 'lc-americain': _cabane('lc-americain', 'Américain',
    'Viande au choix, frites dedans, sauce', '30 000 Ar',
    'Viande au choix (agneau, poulet, steak ou merguez). Frites incluses, sauce au choix incluse.'),
 'lc-tacos': _cabane('lc-tacos', 'Tacos',
    'Viande au choix, frites, sauce fromagère', '30 000 Ar',
    'Viande au choix (agneau, poulet, steak, merguez, nugget ou tenders). Sauce au choix incluse.'),
 'lc-kebab': _cabane('lc-kebab', 'Kebab (ou assiette)',
    'Viande au choix, salade, tomate, sauce', '25 000 Ar',
    'Viande au choix (agneau, poulet, steak ou merguez). En sandwich ou en assiette.'),
 'lc-panini': _cabane('lc-panini', 'Panini',
    'Viande au choix, fromage fondu, sauce', '25 000 Ar',
    'Viande au choix (agneau, poulet, steak ou merguez). Sauce au choix incluse.'),
 'lc-double-cheese-burger': _cabane('lc-double-cheese-burger', 'Double Cheese Burger',
    'Deux steaks, deux cheddar, salade', '29 000 Ar',
    '2 steak, 2 cheddar, salade, oignon, tomate. Frites incluses.'),
 'lc-crepe-nutella': _cabane('lc-crepe-nutella', 'Crêpe Nutella',
    'Nutella, faite minute', '18 000 Ar',
    'Crêpe au Nutella.'),
}
