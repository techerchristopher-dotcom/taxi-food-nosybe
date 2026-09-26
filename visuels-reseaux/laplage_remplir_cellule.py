# -*- coding: utf-8 -*-
"""Le remplissage de cellule, version 2 : L'ASSIETTE A UNE TAILLE, PAS LA PHOTO.

Ce que faisait la version 1, et pourquoi c'etait faux. Elle prenait l'echelle
minimale qui couvre la cellule (`max(larg/W0, haut/H0)`) et centrait sur
l'assiette. Consequence mesuree : l'assiette sortait a la taille qu'elle avait
dans la photo source. Les brochettes, photographiees de loin, remplissaient 38 %
de leur cellule ; le poisson pane, photographie de pres, 112 % — donc coupe.
Deux defauts qui se voient : une tuile « pas alignee », une tuile « trop loin ».

Ce que fait la version 2. On mesure la boite de l'assiette dans la source, puis
on choisit l'echelle pour que cette boite occupe CIBLE de la cellule dans sa
dimension dominante. L'echelle ne descend jamais sous celle qui couvre la
cellule, sinon il resterait du vide. C'est la regle « une serie, c'est une
BOITE, pas une largeur » de la charte, appliquee a une mosaique.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CIBLE = 0.72          # part de la cellule que l'assiette occupe, dimension dominante


def boite_assiette(im):
    """La boite de la faience dans la photo. Separation par la couleur : claire
    et desaturee. Plus grande composante connexe, trous rebouches (la nourriture
    est saturee, elle est donc dedans)."""
    W0, H0 = im.size
    p = im.resize((W0 // 4, H0 // 4), Image.BILINEAR)
    a = np.asarray(p).astype(np.float32) / 255
    mx = a.max(2); mn = a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # Le seuil de clarte est RELATIF a l'image, pas absolu. Avec un seuil fixe a
    # 0,55 la photo des brochettes, sombre (luminance mediane 50/255), ne
    # rendait que la partie eclairee de l'assiette : boite mesuree 432 px au
    # lieu de ~900, donc echelle deux fois trop grande et assiette coupee.
    seuil = max(0.40, float(np.percentile(mx, 68)))
    m = (mx > seuil) & (S < 0.30)
    if m.sum() < 200:
        m = mx > np.percentile(mx, 88)
    m = ndimage.binary_opening(m, np.ones((3, 3)))
    # FERMER AVANT D'ETIQUETER. Sans ca, la nourriture qui touche le bord de
    # l'assiette coupe la faience en plusieurs composantes : sur les brochettes
    # la plus grande ne faisait que 28 % de la largeur (mesure), sur le poulet
    # citronne la boite sortait plate (1236 x 148). Le noyau fait 15 px sur
    # l'image reduite au quart, soit 60 px en pleine resolution — assez pour
    # franchir une brochette, pas pour rejoindre la nappe.
    m = ndimage.binary_closing(m, np.ones((15, 15)))
    lab, n = ndimage.label(m)
    if n == 0:
        return 0, 0, W0, H0
    t = ndimage.sum(m, lab, range(1, n + 1))
    c = ndimage.binary_fill_holes(lab == 1 + int(np.argmax(t)))
    ys, xs = np.nonzero(c)
    # Percentiles 1/99 et non min/max : une trainee claire sur la nappe suffit a
    # etirer une boite min/max de plusieurs centaines de pixels.
    return (int(np.percentile(xs, 1)) * 4, int(np.percentile(ys, 1)) * 4,
            int(np.percentile(xs, 99)) * 4, int(np.percentile(ys, 99)) * 4)


def remplir(chemin, larg, haut, ancre=(0.5, 0.5), cible=CIBLE):
    im = Image.open(chemin).convert('RGB')
    W0, H0 = im.size
    x1, y1, x2, y2 = boite_assiette(im)
    bw, bh = max(x2 - x1, 1), max(y2 - y1, 1)
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

    ech_plat = min(larg * cible / bw, haut * cible / bh)
    ech_couv = max(larg / W0, haut / H0)
    ech = max(ech_plat, ech_couv)

    nw, nh = int(round(W0 * ech)), int(round(H0 * ech))
    im = im.resize((nw, nh), Image.LANCZOS)
    cx *= ech; cy *= ech
    x0 = int(round(min(max(cx - larg * ancre[0], 0), nw - larg)))
    y0 = int(round(min(max(cy - haut * ancre[1], 0), nh - haut)))
    cell = im.crop((x0, y0, x0 + larg, y0 + haut))

    # ou l'assiette tombe DANS la cellule, apres echelle et recadrage
    ax1, ay1 = x1 * ech - x0, y1 * ech - y0
    ax2, ay2 = x2 * ech - x0, y2 * ech - y0
    diag = dict(ech=ech, borne_par='assiette' if ech_plat >= ech_couv else 'couverture',
                boite=(round(ax1), round(ay1), round(ax2), round(ay2)),
                part=round(max((ax2 - ax1) / larg, (ay2 - ay1) / haut), 3),
                coupee=(ax1 < -1 or ay1 < -1 or ax2 > larg + 1 or ay2 > haut + 1))
    return cell, diag
