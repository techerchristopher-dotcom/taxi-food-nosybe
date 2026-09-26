# -*- coding: utf-8 -*-
"""Choisir les photos de la mosaique M&K PAR LA MESURE, pas au gout.

Trois criteres, chacun pour une raison payee sur La Plage :
  1. du TEXTE incruste dans la photo casse la mosaique (et la charte interdit
     de laisser le moteur ecrire ; ici c'est lui qui a incruste, mais l'effet
     visuel est le meme) ;
  2. la BOITE DU PLAT doit tenir dans la cellule sans etre rognee ;
  3. la cellule du bas-droite doit etre CALME : c'est la que se pose la pastille.
"""
import os, glob
import numpy as np
from PIL import Image
from scipy import ndimage
from laplage_remplir_cellule import boite_assiette

def score_texte(p):
    """Du lettrage = des contours fins, tres contrastes, sur peu de pixels.
    On mesure la part de pixels a fort laplacien DANS des zones claires."""
    im = Image.open(p).convert('L').resize((360, 360))
    a = np.asarray(im).astype(np.float32)
    lap = np.abs(ndimage.laplace(ndimage.gaussian_filter(a, 0.6)))
    return float(((lap > 26) & (a > 150)).mean()*100)

def variance_locale(p):
    a = np.asarray(Image.open(p).convert('L').resize((240,240))).astype(np.float32)
    m = ndimage.uniform_filter(a, 17)
    return float(np.sqrt(np.maximum(ndimage.uniform_filter(a*a,17)-m*m, 0)).mean())

def part_boite(p, larg, haut):
    im = Image.open(p).convert('RGB')
    try:
        x0,y0,x1,y1 = boite_assiette(im)
    except Exception:
        return None
    W,H = im.size
    ech = max(larg/W, haut/H)          # echelle de couverture
    return (x1-x0)*ech/larg, (y1-y0)*ech/haut

print(f"{'photo':40s} {'texte%':>7} {'var':>6}   carree 348x298   allongee 380x230")
lignes = []
for p in sorted(glob.glob('mk/*.jpg')):
    if p.endswith('00-enseigne-chez-m-et-k.jpg'): continue
    t, v = score_texte(p), variance_locale(p)
    c = part_boite(p, 348, 298); a = part_boite(p, 380, 230)
    fc = f"{c[0]*100:5.0f}% {c[1]*100:5.0f}%" if c else "   —      "
    fa = f"{a[0]*100:5.0f}% {a[1]*100:5.0f}%" if a else "   —      "
    print(f"{os.path.basename(p)[:-4]:40s} {t:7.2f} {v:6.1f}   {fc}     {fa}")
    lignes.append((os.path.basename(p)[:-4], t, v))
print()
print("Enseigne (candidate pour la cellule calme) : "
      f"variance {variance_locale('mk/00-enseigne-chez-m-et-k.jpg'):.1f}")
