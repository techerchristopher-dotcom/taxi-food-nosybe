# -*- coding: utf-8 -*-
"""Detourage d'un plat rond sur fond sombre.

Deux essais rates avant celui-ci, et la raison est la meme : on separait le
plat du fond par la LUMINOSITE. Or une croute brulee est aussi sombre que
l'ardoise — l'enveloppe convexe enjambait des morceaux de pierre, le median
mordait dans la croute pale.

Ce qui separe vraiment les deux, c'est la COULEUR : le fond studio et
l'ardoise sont parfaitement neutres (R = B, mesure a 0,0), la nourriture est
chaude meme quand elle est noire (R - B jusqu'a 100). Le seuil porte donc sur
R - B, avec un rattrapage sur la luminosite pour le fromage blanc, neutre mais
lumineux. Le median polaire ne sert plus qu'a lisser le bord.

Sortie : PNG a fond transparent + .json du cadre.
"""
from PIL import Image, ImageFilter
import numpy as np, json
from scipy import ndimage

ANGLES  = 1440
FENETRE = 15          # ~2 degres de chaque cote : on lisse, on ne redessine pas
CHROMA  = 12          # R - B : le fond et l'ardoise sont neutres, la nourriture non
CLAIR   = 120         # fromage blanc : neutre mais lumineux

def _profil_polaire(m):
    ys, xs = np.nonzero(m)
    cy, cx = ys.mean(), xs.mean()
    a = np.arctan2(ys - cy, xs - cx)
    r = np.hypot(ys - cy, xs - cx)
    idx = ((a + np.pi) / (2*np.pi) * ANGLES).astype(int) % ANGLES
    rmax = np.zeros(ANGLES)
    np.maximum.at(rmax, idx, r)
    # les angles vides (aucun pixel) heritent du voisin non vide
    vide = rmax == 0
    if vide.any():
        bons = np.nonzero(~vide)[0]
        rmax[vide] = np.interp(np.nonzero(vide)[0], bons, rmax[bons], period=ANGLES)
    lisse = ndimage.median_filter(rmax, size=FENETRE, mode='wrap')
    return (cy, cx), lisse

def _masque_depuis_profil(forme, centre, rayons):
    h, w = forme
    cy, cx = centre
    yy, xx = np.mgrid[0:h, 0:w]
    a = np.arctan2(yy - cy, xx - cx)
    r = np.hypot(yy - cy, xx - cx)
    idx = ((a + np.pi) / (2*np.pi) * ANGLES).astype(int) % ANGLES
    return r <= rayons[idx]

def detoure_plat(src, out, seuil=80, flou=1.4, marge=2):
    im = Image.open(src).convert('RGB')
    a = np.asarray(im).astype(int)
    lum = a.mean(axis=2)
    # le fond studio et l'ardoise sont parfaitement neutres (R = B) ; la croute,
    # meme brulee, reste chaude. C'est ce qui les separe, pas la luminosite.
    m = ((a[:, :, 0] - a[:, :, 2]) > CHROMA) | (lum > CLAIR)
    lab, n = ndimage.label(m)
    m = lab == int(np.argmax(ndimage.sum(m, lab, range(1, n+1)))) + 1
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, np.ones((9, 9)), iterations=3))
    m = ndimage.binary_opening(m, np.ones((5, 5)), iterations=2)
    lab, n = ndimage.label(m)
    m = ndimage.binary_fill_holes(lab == int(np.argmax(ndimage.sum(m, lab, range(1, n+1)))) + 1)

    centre, rayons = _profil_polaire(m)
    m = _masque_depuis_profil(m.shape, centre, rayons)

    ys, xs = np.nonzero(m)
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(flou))
    res = Image.merge('RGBA', (*im.split(), alpha))
    boite = (int(xs.min()-marge), int(ys.min()-marge), int(xs.max()+marge+1), int(ys.max()+marge+1))
    res.crop(boite).save(out)
    json.dump({'bbox': list(boite), 'src': list(im.size)},
              open(out.rsplit('.', 1)[0] + '.json', 'w'))
    return boite, im.size

if __name__ == '__main__':
    import sys
    print(detoure_plat(sys.argv[1], sys.argv[2]))
