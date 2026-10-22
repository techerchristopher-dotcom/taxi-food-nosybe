# -*- coding: utf-8 -*-
"""Visuel « plats du jour » de L'escale Creole — tableau du 2026-10-22.

Le gabarit de l'annonce (`../pub_escale.py`) a l'identique : seules la scene, la
signature et les textes changent. Signature « PLATS DU JOUR » a la place de
« NOUVEAU SUR TAXI FOOD ». Titre PASSIF (Taxi Food livre, pas le restaurant).

Faits relus en base le 2026-10-22 (restaurant 128e68ab) : 8 plats a l'affiche,
de 32 000 Ar (bol renverse) a 40 000 Ar (pave de vivaneau) ;
accompagnement riz ou pates, grains, piment ; horaires inchanges.
"""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(D))
import pub_escale as B
from pub_escale import *            # constantes du gabarit (FILET, PAD_H, LOGO_D, LOGO_CX…)

def pub(**kw):
    return B.pub(**kw).replace('>Nouveau sur Taxi&nbsp;Food<', '>Plats du jour<')

ESCALE = dict(
    scene='scene-jour.png',
    titre='Ses plats du jour,<br>livr&eacute;s chez toi.',
    secondaire=('Jarret de porc brais&eacute; &middot; &eacute;minc&eacute; de poulet sauce hu&icirc;tre&hellip;<br>'
                'Au tableau &middot; de 32&nbsp;000 &agrave; 40&nbsp;000&nbsp;Ar &middot; livraison d&egrave;s 2&nbsp;000&nbsp;Ar'),
    lieu='L&rsquo;escale Cr&eacute;ole &middot; Ambatoloaka &middot; lun.&ndash;sam., midi et soir',
    logo='logo-escale-rond.png',
)
