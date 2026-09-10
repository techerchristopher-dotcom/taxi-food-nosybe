# -*- coding: utf-8 -*-
"""Detourage d'un plat sur fond studio sombre (pizza, burger, sandwich, crepe...).

Deux essais rates avant celui-ci, et la raison est la meme : on separait le
plat du fond par la LUMINOSITE. Or une croute brulee est aussi sombre que
l'ardoise — l'enveloppe convexe enjambait des morceaux de pierre, le median
mordait dans la croute pale.

Ce qui separe vraiment les deux, c'est la COULEUR : le fond studio et
l'ardoise sont parfaitement neutres (R = B, mesure a 0,0), la nourriture est
chaude meme quand elle est noire (R - B jusqu'a 100). Le seuil porte donc sur
R - B, avec un rattrapage sur la luminosite pour le fromage blanc, neutre mais
lumineux. Le median polaire ne sert plus qu'a lisser le bord.

Et il ne lisse QUE les formes rondes. Reconstruire un masque en etoile depuis
le centre marche sur une pizza ; sur un sandwich allongé pose sur l'ardoise, le
rayon balaye la pierre sous le pain et la ramene avec. La regle n'est pas « rond
ou pas » a l'oeil : on compare l'aire avant et apres. Si le lissage GAGNE plus de
ENFLURE %, c'est qu'il enjambe — on garde le masque brut, deja ferme et bouche.

Sortie : PNG a fond transparent + .json du cadre.
"""
from PIL import Image, ImageFilter
import numpy as np, json
from scipy import ndimage

ANGLES  = 1440
FENETRE = 15          # ~2 degres de chaque cote : on lisse, on ne redessine pas
CHROMA  = 12          # R - B : le fond et l'ardoise sont neutres, la nourriture non
CLAIR   = 120         # fromage blanc : neutre mais lumineux
ENFLURE = 0.04        # au-dela de +4 % d'aire, le lissage polaire enjambe : on l'annule
CHROMA_FORT = 32      # « c'est de la nourriture, sans discussion »
PORTEE  = 6           # de combien de pixels le sur (fort) peut recruter du douteux (faible)
RABOT   = 1           # la fermeture invente de la matiere sur des pixels neutres : on la rabote

# L'ardoise recoit un rebond chaud de la nourriture : elle passe le seuil CHROMA
# et se retrouve collee au plat. Deux garde-fous, tous deux mesures sur les
# photos de La Cabane (sandwichs et burgers poses a plat, ou l'ardoise est
# largement visible sous l'aliment) :
#   - reconstruction geodesique : on part du certain (CHROMA_FORT ou tres clair)
#     et on ne recrute le douteux que sur PORTEE pixels. L'ardoise, reliee au
#     plat par sa seule ligne de contact, ne se propage pas.
#   - rabot : apres la fermeture morphologique, on intersecte avec le douteux
#     dilate de RABOT pixels. Sans ca, une fermeture 9x9 x3 enjambe le plat vers
#     l'ardoise voisine et « bouche le trou » entre les deux.

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
    ch = a[:, :, 0] - a[:, :, 2]
    fort   = (ch > CHROMA_FORT) | (lum > CLAIR)     # certainement de la nourriture
    faible = (ch > CHROMA)      | (lum > CLAIR)     # douteux : bord du plat, ou ardoise eclairee
    m = fort.copy()
    for _ in range(PORTEE):
        m = ndimage.binary_dilation(m, np.ones((3, 3))) & faible
    lab, n = ndimage.label(m)
    m = lab == int(np.argmax(ndimage.sum(m, lab, range(1, n+1)))) + 1
    m = ndimage.binary_fill_holes(ndimage.binary_closing(m, np.ones((9, 9))))
    m = ndimage.binary_opening(m, np.ones((5, 5)), iterations=2)
    m = ndimage.binary_fill_holes(m & ndimage.binary_dilation(faible, np.ones((3, 3)), iterations=RABOT))
    lab, n = ndimage.label(m)
    m = ndimage.binary_fill_holes(lab == int(np.argmax(ndimage.sum(m, lab, range(1, n+1)))) + 1)

    centre, rayons = _profil_polaire(m)
    lisse = _masque_depuis_profil(m.shape, centre, rayons)
    aire = m.sum()
    gain = (lisse.sum() - aire) / aire
    if gain <= ENFLURE:
        m = lisse                       # forme ronde : le lissage nettoie le bord
    # sinon : forme allongee, on garde le masque brut

    ys, xs = np.nonzero(m)
    alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(flou))
    res = Image.merge('RGBA', (*im.split(), alpha))
    boite = (int(xs.min()-marge), int(ys.min()-marge), int(xs.max()+marge+1), int(ys.max()+marge+1))
    res.crop(boite).save(out)
    json.dump({'bbox': list(boite), 'src': list(im.size)},
              open(out.rsplit('.', 1)[0] + '.json', 'w'))
    return boite, im.size, round(gain * 100, 1)

if __name__ == '__main__':
    import sys
    b, taille, gain = detoure_plat(sys.argv[1], sys.argv[2])
    print(f"{sys.argv[2]}  cadre {b}  source {taille}  "
          f"lissage polaire {'applique' if gain <= ENFLURE*100 else f'ANNULE (+{gain} %)'}")
