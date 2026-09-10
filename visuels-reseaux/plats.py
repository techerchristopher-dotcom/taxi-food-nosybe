# -*- coding: utf-8 -*-
"""Registre des plats. Une entree = un visuel. Rien d'autre ne se touche.

Variante VALIDEE : debord (plat detoure sur fond studio, pose par-dessus le rouge).

Pour ajouter un plat :
  1. detourage.py sur la photo source   ->  det-<slug>.png + det-<slug>.json
  2. une entree ci-dessous, dx=None
  3. rendre.py <slug>  ->  cherche le dx, rend le PNG, verifie les trois regles

titre       : le nom EXACT de la base, pour que le client le retrouve dans l'appli
secondaire  : 4 ingredients maxi, ceux qui vendent. Le detail complet va dans la legende.
prix        : tel qu'en base, au chiffre pres
dx          : decalage horizontal, cherche par controle_air(), jamais estime
"""

BIDUL_LIEU = ('<b style="font-weight:800;letter-spacing:2.2px;text-transform:uppercase;">'
              'Chez Bidul &amp; Truc</b> &nbsp;·&nbsp; au feu de bois &nbsp;·&nbsp; le soir, 7 j/7')
BIDUL_LOGO = 'bidul.jpg'


def _pizza(slug, titre, secondaire, prix, base, dx=None):
    return dict(titre=titre, secondaire=secondaire, prix=prix, base_complete=base,
                detour=f'det-{slug}.png', detour_web=f'web-{slug}.webp',
                dx=dx, lieu=BIDUL_LIEU, logo=BIDUL_LOGO, fichier=f'{slug}.png')


PLATS = {
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
}
