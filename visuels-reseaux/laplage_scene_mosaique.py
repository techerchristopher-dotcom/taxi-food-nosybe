# -*- coding: utf-8 -*-
"""La scene d'annonce de La Plage : une mosaique de SES photos.

POURQUOI PAS UN DETOURAGE. Tente puis rejete, par la mesure : la faience et le
bois se separent mal (le score de faience V*(1-S) n'est pas bimodal — p25 0,13,
mediane 0,24, p95 0,68 sur les cotes de zebu ; Otsu y vidait le masque et un
balayage du seuil emportait 58 % du cadre, donc le bois avec l'assiette), et ses
photos sont prises de trois quarts a des angles differents : meme bien
detourees, elles ne posent pas sur un meme plan. La mosaique ne simule rien,
elle MONTRE cinq photos reelles — ce qui est le message.

L'ASSIETTE A UNE TAILLE, PAS LA PHOTO. Premiere version : echelle minimale qui
couvre la cellule, centree sur l'assiette. Resultat mesure : l'assiette sortait
a la taille qu'elle avait dans la source — brochettes a 38 % de leur cellule
(« trop loin »), poisson pane a 112 % (« pas aligne », donc coupe). La version 2
choisit l'echelle pour que la BOITE DE L'ASSIETTE occupe 94 % de la cellule dans
sa dimension dominante, sans jamais descendre sous l'echelle de couverture.
C'est la regle « une serie, c'est une BOITE, pas une largeur » de la charte,
appliquee a une mosaique.

LES CELLULES SE DISTRIBUENT SELON CE QUI TIENT, PAS SELON LE GOUT. Mesure de la
part de cellule occupee par l'assiette :

  cellule presque carree 348 x 298 (ratio 1,17) — SEULES DEUX TIENNENT
     poisson pane 94 %   brochettes 94 %
     crudites 123 %  poisson fume 126 %  tartare 111 %  poulet citronne 140 %
  cellule allongee 380 x 230 (ratio 1,65, proche des sources 1,78) — TOUTES
     poulet citronne 99 %  crudites 96 %  poisson fume 96 %  tartare 94 %

Ses photos sont cadrees serre : une assiette large ne tient pas dans une cellule
presque carree. Les deux qui tiennent vont donc a gauche, les autres a droite.

LES PHOTOS SE CHOISISSENT AUSSI PAR MESURE. Trois sont sur fond noir — mi xao
29,8 % de pixels noirs, rouleaux 32,8 %, poulet grille 22,3 % : melangees aux
autres elles cassent l'idee d'UNE table. Et la soupe chinoise, le mi xao et le
poisson entier grille sont `is_available = false` en base : la charte interdit de
montrer ce qui n'est pas commandable.

LE VIDE EST CONSTRUIT, PAS SUBI. La charte §13 pose la pastille dans le vide de
la scene. Sur une mosaique il n'y a pas de vide : on en RESERVE un. La cellule
bas-droite, 380 x 284, recoit un morceau du BOIS DE SA TABLE, cherche par
variance locale minimale. Deux erreurs payees : sans exigence de couleur la
recherche renvoyait le FOND NOIR d'une photo studio (ecart-type 4,06,
imbattable) ; avec un creneau de teinte trop large (8-52 deg) elle renvoyait un
gros plan de MACARONIS (34 deg, saturation 0,81). Son bois, mesure sur deux
zones nues : 13-18 deg, saturation 0,40-0,64.

284 px et non 248 : la pastille de 235 px tournee de -7 deg occupe une boite de
262 px. A 248 la cellule la refusait.

GEOMETRIE sur 1080 x 748, filets or de 2 px, jamais sur le bord exterieur :
  gauche 698 : cotes de zebu 698x448  |  brochettes 348x298 + poisson pane 348x298
  droite 380 : poulet citronne 380x230 | crudites 380x230 | BOIS 380x284
"""
import numpy as np
from PIL import Image
from scipy import ndimage
from laplage_remplir_cellule import remplir, boite_assiette

L, H = 1080, 748
OR = (255, 199, 44)
FILET = 2
LOGO = dict(x0=62, x1=242, y0=654, y1=748)   # ce que la pastille du logo recouvre


def _teinte_sat_lum(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(2); mn = a.min(2); d = mx - mn
    dd = np.where(d == 0, 1, d)
    h = np.where(mx == r, ((g - b) / dd) % 6,
                 np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    S = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    Lm = 0.2126 * r + 0.7152 * g + 0.0722 * b
    return h, S, Lm


def bois_le_plus_lisse(chemins, larg, haut):
    best = None
    for c in chemins:
        im = Image.open(c).convert('RGB')
        a = np.asarray(im).astype(np.float32) / 255
        h, S, Lm = _teinte_sat_lum(a)
        bois = (Lm > 0.10) & (Lm < 0.60) & (S > 0.25) & (S < 0.72) & (h > 5) & (h < 26)
        g = np.asarray(im).astype(float).mean(2)
        moy = ndimage.uniform_filter(g, 25)
        ec = np.sqrt(np.maximum(ndimage.uniform_filter(g * g, 25) - moy * moy, 0))
        W0, H0 = im.size
        for y in range(0, H0 - haut, 16):
            for x in range(0, W0 - larg, 16):
                part = float(bois[y:y+haut, x:x+larg].mean())
                if part < 0.72:
                    continue
                s = float(ec[y:y+haut, x:x+larg].mean())
                if best is None or s < best[0]:
                    best = (s, c, x, y, part)
    if best is None:
        raise SystemExit('aucun morceau de bois assez uniforme')
    s, c, x, y, part = best
    print('  bois : %s en (%d,%d) — %.0f %% de brun chaud, ecart-type local %.2f'
          % (c, x, y, part * 100, s))
    return Image.open(c).convert('RGB').crop((x, y, x + larg, y + haut))


GL = 698; GR = L - GL - FILET          # 698 + 2 + 380
HH = 448; HB = H - HH - FILET          # 448 + 2 + 298
PL = (GL - FILET) // 2                 # 348
HD = 230                               # cellules droites ; le bois prend le reste

CELLULES = [
    # nom,          fichier,                  x,           y,          larg,           haut, ancre
    ('heros',       'p80-cotes.jpg',           0,           0,          GL,             HH,   (0.50, 0.50)),
    # Le poisson pane va A GAUCHE, sous la pastille du logo, et ce n'est pas un
    # choix d'esthete : mesure sur les sept photos, c'est la SEULE qui tienne
    # entiere dans cette cellule presque carree (93,2 %) ET dont le centre
    # d'assiette echappe au rectangle du logo (y 138 contre y 204 pour le logo).
    # Les brochettes, elles, ont leur centre a y 206 — pile dessous.
    ('bas-gauche',  'p77-poissonpane.jpg',     0,           HH + FILET, PL,             HB,   (0.50, 0.50)),
    ('bas-milieu',  'p61-brochettes.jpg',      PL + FILET,  HH + FILET, GL - PL - FILET, HB,  (0.50, 0.50)),
    ('droite-haut', 'p76-pouletcitronne.jpg',  GL + FILET,  0,          GR,             HD,   (0.50, 0.50)),
    ('droite-mil',  'p22-crudites.jpg',        GL + FILET,  HD + FILET, GR,             HD,   (0.50, 0.50)),
]

if __name__ == '__main__':
    scene = Image.new('RGB', (L, H), OR)
    print('cellule      fichier                 echelle borne par    assiette  coupee  logo')
    for nom, f, x, y, w, hh, a in CELLULES:
        cell, d = remplir(f, w, hh, a)
        scene.paste(cell, (x, y))
        # la pastille du logo mord-elle le CENTRE d'une assiette ?
        bx1, by1, bx2, by2 = d['boite']
        acx, acy = x + (bx1 + bx2) / 2, y + (by1 + by2) / 2
        dans_logo = (LOGO['x0'] <= acx <= LOGO['x1'] and LOGO['y0'] <= acy <= LOGO['y1'])
        print('%-12s %-23s %5.2f  %-11s %6.1f %%  %-6s  %s'
              % (nom, f, d['ech'], d['borne_par'], d['part'] * 100,
                 'OUI' if d['coupee'] else 'non',
                 'MORD LE CENTRE' if dans_logo else 'ok'))
    y_bois = 2 * (HD + FILET)
    scene.paste(bois_le_plus_lisse(
        ['p77-poissonpane.jpg', 'p76-pouletcitronne.jpg', 'p80-cotes.jpg'],
        GR, H - y_bois), (GL + FILET, y_bois))
    scene.save('scene.png')
    print('scene.png %dx%d   cellule bois : x %d..%d  y %d..%d'
          % (*scene.size, GL + FILET, L, y_bois, H))
