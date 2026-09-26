# -*- coding: utf-8 -*-
"""La scene d'annonce de Chez M&K : une mosaique de SES photos.

MEME GEOMETRIE QUE LA PLAGE, choix des photos refait par la mesure.
1080 x 748, filets or de 2 px, jamais sur le bord exterieur :
  gauche 698 : bol renverse 698x448  |  tsa siou 348x298 + magret 348x298
  droite 380 : van tan frit 380x216 | nems 380x216 | PLAQUE 380x312

POURQUOI CES CINQ-LA. Trois criteres mesures sur ses 28 photos
(`mk_mesurer.py`, `/tmp/mk_cells.py`), aucun choix a l'oeil :

  1. LE TEXTE INCRUSTE. Trois de ses photos portent un lettrage grave
     (« ribs laque » 6,7 %, la poitrine de porc 5,9 %, la cote d'echine 3,8 %).
     Dans une mosaique ce lettrage se lit comme une erreur de montage. Toutes
     les retenues sont sous 2,5 %, et le saute de porc est le plus propre de
     ses 28 visuels (0,7 %).

  2. LA BOITE DU PLAT DOIT TENIR : bol renverse 88 %, tsa siou 90 %,
     magret 94 %. Les recalees le sont par la mesure : la soupe speciale
     deborde a 270 % dans la grande cellule, la soupe garnie a 112 % dans une
     cellule de 216, l'assiette de friture a 134 %.

  2 bis. ET ELLE DOIT ETRE NETTE — critere ajoute apres coup, et il a coute
     un montage. Le saute de porc passait les deux premiers criteres haut la
     main (lettrage 0,7 %, le plus propre des 28 ; boite a 72 %) et sortait en
     bouillie brune : agrandi 1,77 fois, sa variance de laplacien mesuree SUR
     LA CELLULE RENDUE tombe a 3,9, contre 440 de mediane et 662 pour le mi
     sao. Un critere qui ne regarde ni la nettete ni l'agrandissement ne
     mesurait pas ce qu'on croyait. Plancher retenu : 150. Il ecarte aussi les
     rouleaux de printemps (89,9) et le ti pan mixte (24,7).

  2 ter. ET LE PLAT DOIT REMPLIR LA CELLULE — deuxieme critere ajoute apres
     coup, et deuxieme montage jete. Le mi sao et les grosses crevettes
     passaient lettrage, boite ET nettete : le mi sao sortait en plan large de
     la salle (chaises, porte, carrelage) et les crevettes en deux rouleaux
     poses sur un chiffon. Aucun des trois criteres ne regardait ce que le
     cadre contient VRAIMENT. On mesure donc la part de la cellule couverte par
     le masque assiette+nourriture : mi sao 33,8 %, grosses crevettes 26,3 %,
     saute 18,8 %, contre 82,8 % pour le van tan et 80,1 % pour les nems.
     Plancher retenu : 55 %. Sur les 28 photos, trois seulement passent les
     quatre criteres dans cette cellule.

  3. LA PASTILLE PROMO NE PEUT PAS ALLER SUR UNE PHOTO — ET C'EST MESURE.
     Sur La Plage elle tombait sur un morceau de table en bois nu. Les
     28 photos de M&K ont ete testees une a une dans la cellule
     (`mk_lit_pastille.py`) : la MEILLEURE laisse -42,5 px d'air, c'est-a-dire
     que la pastille mordrait une assiette de 42 px. Il n'y a pas de bois chez
     lui, et son enseigne doree — d'abord retenue — est desormais remplacee par
     son vrai logo en pastille : la remettre dans la mosaique, ce serait dire
     deux fois la meme chose, et poser de l'or sur de l'or.

     La cellule devient donc une PLAQUE de braise #0A0705 — le fond de son
     nouveau logo. Ce n'est pas un trou : c'est la seule surface de la
     composition ou la pastille atteint 12,8:1 au lieu de se battre avec une
     faience. Elle est portee a 312 px de haut pour qu'une pastille de 240 px
     tournee de -7 deg (267,6 px) y garde 22 px d'air de chaque cote.
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from laplage_remplir_cellule import remplir

NETTETE_MINI = 150.0
REMPLIT_MINI = 55.0

from mk_lit_pastille import masque_assiette

def nettete(cell):
    """Variance du laplacien sur la cellule RENDUE, agrandissement compris :
    une photo nette agrandie 1,8 fois devient floue, et c'est cela qui compte."""
    g = np.asarray(cell.convert('L')).astype(np.float32)
    return float(ndimage.laplace(ndimage.gaussian_filter(g, 0.5)).var())

L, H = 1080, 748
OR      = (255, 199, 44)
BRAISE  = (10, 7, 5)
OR_LOGO = (253, 197, 103)
FILET = 2
GL = 698; GR = L - GL - FILET          # 698 | 380
HH = 448; HB = H - HH - FILET          # 448 + 2 + 298
PL = (GL - FILET) // 2                 # 348
HD = 216                               # les deux cellules hautes de droite

PLAQUE = dict(x0=GL+FILET, y0=2*(HD+FILET), x1=L, y1=H)   # 700..1080, 436..748
BADGE_D = 240
BADGE = (PLAQUE['x0'] + (GR - round(BADGE_D*1.115))//2,
         PLAQUE['y0'] + ((PLAQUE['y1']-PLAQUE['y0']) - round(BADGE_D*1.115))//2)

# La pastille du logo du restaurant, en coordonnees scene (charte : 180 px,
# centre a 52 % de son diametre au-dessus du filet).
LOGO = dict(x0=62, x1=62+180, y0=H-round(180*0.52), y1=H+round(180*0.48))

CELLULES = [
    ('heros',       'mk/22-bol-renverse-boeuf-poulet-ou-porc.jpg',   0,          0,          GL,              HH,  (0.50, 0.50)),
    # A gauche sous la pastille : celle dont le centre d'assiette echappe au
    # rectangle du logo. Verifie a l'execution, colonne « logo ».
    ('bas-gauche',  'mk/25-assiette-de-tsa-siou.jpg',                0,          HH + FILET, PL,              HB,  (0.50, 0.42)),
    ('bas-milieu',  'mk/06-magret-de-canard-sauce-poivre-vert.jpg',  PL + FILET, HH + FILET, GL - PL - FILET, HB,  (0.50, 0.50)),
    ('droite-haut', 'mk/18-van-tan-frit.jpg',                        GL + FILET, 0,          GR,              HD,  (0.50, 0.50)),
    ('droite-mil',  'mk/04-nem-porc-poulet-ou-zebu.jpg',             GL + FILET, HD + FILET, GR,              HD,  (0.50, 0.50)),
]

if __name__ == '__main__':
    scene = Image.new('RGB', (L, H), OR)
    print('cellule      photo                                  echelle borne par    plat   nettete remplit  logo')
    ok = True
    for nom, f, x, y, w, hh, a in CELLULES:
        cell, d = remplir(f, w, hh, a)
        scene.paste(cell, (x, y))
        bx1, by1, bx2, by2 = d['boite']
        acx, acy = x + (bx1+bx2)/2, y + (by1+by2)/2
        mord = (LOGO['x0'] <= acx <= LOGO['x1'] and LOGO['y0'] <= acy <= LOGO['y1'])
        n = nettete(cell); r = masque_assiette(cell).mean()*100
        ok &= (n >= NETTETE_MINI) and (r >= REMPLIT_MINI) and not d['coupee'] and not mord
        print('%-12s %-38s %5.2f  %-11s %5.1f %%  %6.1f%s %5.1f%%%s %s'
              % (nom, f.split('/')[-1][:-4], d['ech'], d['borne_par'], d['part']*100,
                 n, ' ' if n >= NETTETE_MINI else '!', r, ' ' if r >= REMPLIT_MINI else '!',
                 'MORD LE CENTRE' if mord else 'ok'))
    # La plaque : le fond de son logo, pas un trou. Un filet or a 28 % en
    # retrait de 16 px reprend le double filet du sceau et la designe comme un
    # element voulu.
    d_ = ImageDraw.Draw(scene, 'RGBA')
    d_.rectangle([PLAQUE['x0'], PLAQUE['y0'], PLAQUE['x1']-1, PLAQUE['y1']-1], fill=BRAISE)
    d_.rectangle([PLAQUE['x0']+16, PLAQUE['y0']+16, PLAQUE['x1']-17, PLAQUE['y1']-17],
                 outline=OR_LOGO + (72,), width=2)
    scene.save('scene-mk.png')
    print('  ->  %s  (nettete mini %.0f, remplissage mini %.0f %%)'
          % ('CONFORME' if ok else 'A CORRIGER', NETTETE_MINI, REMPLIT_MINI))
    print('scene-mk.png %dx%d   plaque : x %d..%d  y %d..%d   pastille %d px en (%d, %d)'
          % (*scene.size, PLAQUE['x0'], PLAQUE['x1'], PLAQUE['y0'], PLAQUE['y1'],
             BADGE_D, *BADGE))
