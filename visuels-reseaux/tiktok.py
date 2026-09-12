# -*- coding: utf-8 -*-
"""Les donnees d'un plat, vues par la serie TikTok.

Le catalogue vit dans plats.py et sert d'abord aux visuels carres : sa ligne
`lieu` porte du HTML (le nom du restaurant en gras majuscule). La carte verticale
la veut nue — le titre y fait deja 84 px, une deuxieme ligne criee ne laisse plus
rien respirer. On derive, on ne duplique pas : un prix corrige dans plats.py doit
corriger la video aussi.
"""
import os, re, sys

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
from plats import PLATS

# Le detourage nomme les fichiers comme le catalogue ; seul l'Oriental avait ete
# decoupe sous un autre nom pendant le test.
ALIAS = {'4fromages': 'det-4-fromages.png', 'oriental': 'det-oriental.png',
         'gargantua': 'det-gargantua.png', 'oceane': 'det-oceane.png'}


def _nu(html):
    """La ligne lieu, sans balises ni espaces insecables decoratifs."""
    t = re.sub(r'<[^>]+>', '', html)
    return re.sub(r'\s*&nbsp;\s*', ' ', t).strip()


def plat(slug):
    p = PLATS[slug]
    return dict(slug=slug, titre=p['titre'], secondaire=p['secondaire'],
                prix=p['prix'], lieu=_nu(p['lieu']), logo=p['logo'],
                detour=ALIAS.get(slug, p['detour']))


if __name__ == '__main__':
    for s in sys.argv[1:] or ['oriental', '4fromages']:
        print(plat(s))
