# -*- coding: utf-8 -*-
"""Ou poser la pastille promo dans la mosaique de M&K ? La mesure decide.

Sur La Plage la pastille tombait sur un morceau de table en bois nu. M&K n'a
pas de table nue — mais plusieurs de ses plats sont photographies sur un
CARRELAGE clair, qui joue le meme role. On cherche donc, pour chaque photo et
chaque forme de cellule, le plus grand disque libre d'assiette."""
import glob, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from laplage_remplir_cellule import remplir

def masque_assiette(cell):
    """L'assiette : claire ET peu saturee. Le carrelage l'est aussi — on le
    distingue par la FORME : une assiette est une tache compacte de plus de
    4 % de la cellule ; un carrelage est un fond qui touche les bords et que
    les joints decoupent. On garde donc les composantes compactes non
    debordantes, plus tout ce qui est colore (la nourriture)."""
    a = np.asarray(cell.convert('RGB')).astype(np.float32)/255
    mx, mn = a.max(2), a.min(2)
    S = np.where(mx > 0, (mx-mn)/np.maximum(mx, 1e-6), 0)
    nourriture = (S > 0.34) & (mx > 0.20)
    faience = ndimage.binary_opening((mx > 0.62) & (S < 0.20), np.ones((7,7)))
    h, w = faience.shape
    lab, n = ndimage.label(faience)
    garde = np.zeros_like(faience)
    for i in range(1, n+1):
        m = lab == i
        if m.mean() < 0.035: continue                 # poussiere
        ys, xs = np.nonzero(m)
        bord = (xs.min() == 0) + (xs.max() == w-1) + (ys.min() == 0) + (ys.max() == h-1)
        etendue = (xs.max()-xs.min()+1)*(ys.max()-ys.min()+1)
        if bord >= 3 and m.sum()/etendue > 0.55: continue   # le sol, pas une assiette
        garde |= m
    return ndimage.binary_closing(garde | ndimage.binary_opening(nourriture, np.ones((5,5))),
                                  np.ones((9,9)))

def meilleur_disque(masque, d, marge=14):
    """Le centre qui maximise la distance a l'element le plus proche."""
    libre = ~masque
    dist = ndimage.distance_transform_edt(libre)
    r = d*1.115/2 + 0  # un disque de d tourne de -7 deg occupe d*1.115
    h, w = masque.shape
    dist[:int(r+marge), :] = 0; dist[-int(r+marge):, :] = 0
    dist[:, :int(r+marge)] = 0; dist[:, -int(r+marge):] = 0
    if dist.max() == 0: return None
    cy, cx = np.unravel_index(dist.argmax(), dist.shape)
    return int(cx), int(cy), float(dist[cy, cx] - r)

if __name__ == '__main__':
    W, H = 380, 284
    res = []
    for f in sorted(glob.glob('mk/*.jpg')):
        if '00-enseigne' in f: continue
        cell, _ = remplir(f, W, H, (0.5, 0.5))
        m = masque_assiette(cell)
        for d in (235, 205):
            b = meilleur_disque(m, d)
            if b: res.append((b[2], d, f.split('/')[-1][:-4], b[0], b[1], m.mean()*100))
    res.sort(reverse=True)
    print('cellule 380 x 284   (celle du bas-droite)')
    print('%-8s %-5s %-42s %-12s %s' % ('air', 'diam', 'photo', 'centre', 'occupe'))
    for air, d, nom, cx, cy, occ in res[:14]:
        print('%+7.1f  %4d  %-42s (%3d,%3d)   %4.1f %%' % (air, d, nom, cx, cy, occ))
