# -*- coding: utf-8 -*-
"""Scene du visuel « plats du jour » de L'escale Creole (tableau du 2026-10-22).

MEME GEOMETRIE ET MEME CONSTRUCTEUR que l'annonce (`../escale_scene_mosaique.py`) :
seules les photos changent. Uniquement des plats A L'AFFICHE en base le 2026-10-22
(is_featured, is_available) — les deux nouveaux en evidence :

    heros        pj-jarret-porc-braise         Jarret de porc braise             38 000  porc  NOUVEAU
    droite-haut  pj-emince-poulet-huitre       Emince de poulet sauce huitre     38 000        NOUVEAU
    droite-mil   pj-filet-vivaneau-combava     Pave de vivaneau creme combava    40 000
    bas-gauche   pj-emince-zebu-poivre-vert    Emince de zebu poivre vert        38 000
    bas-milieu   pj-roti-porc-creole           Roti porc a la creole             38 000  porc
  story, rangee du haut :
    haut-gauche  pj-rougail-saucisses          Rougail saucisses                 38 000  porc
    haut-droite  pj-bol-renverse               Bol renverse poulet ou zebu       32 000
  (riz frit poulet ou zebu, 35 000, a l'affiche mais pas en photo)
La cellule de la pastille garde son morceau de drapeau (photo de l'emince au brede).
"""
import os, sys
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(D))
import escale_scene_mosaique as M

GL, GR, HH, HB, PL, HD, FILET = M.GL, M.GR, M.HH, M.HB, M.PL, M.HD, M.FILET

def cellules(dy=0):
    return [
        ('heros',       'pj-jarret-porc-braise.jpg',     0,          dy,              GL,              HH),
        ('bas-gauche',  'pj-emince-zebu-poivre-vert.jpg', 0,          dy + HH + FILET, PL,              HB),
        ('bas-milieu',  'pj-roti-porc-creole.jpg',       PL + FILET, dy + HH + FILET, GL - PL - FILET, HB),
        ('droite-haut', 'pj-emince-poulet-huitre.jpg'  , GL + FILET, dy,              GR,              HD),
        ('droite-mil',  'pj-filet-vivaneau-combava.jpg', GL + FILET, dy + HD + FILET, GR,              HD),
    ]

def cellules_story():
    return [
        ('haut-gauche', 'pj-rougail-saucisses.jpg', 0,                0, M.DEMI,               M.RANGEE),
        ('haut-droite', 'pj-bol-renverse.jpg',      M.DEMI + FILET,   0, M.L - M.DEMI - FILET, M.RANGEE),
    ] + cellules(M.RANGEE + FILET)

M.cellules, M.cellules_story = cellules, cellules_story
M.D = D          # scene-jour*.png ecrites ici

if __name__ == '__main__':
    M.construire(False, 'scene-jour.png')
    M.construire(True, 'scene-jour-story.png')
