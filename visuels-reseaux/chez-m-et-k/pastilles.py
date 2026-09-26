# -*- coding: utf-8 -*-
"""Une pastille ronde par logo — la regle de charte (§6) : « le logo du
restaurant, en pastille ronde blanche ».

Trois cas, et on MESURE lequel s'applique plutot que de decider a l'oeil :
  * le logo est deja un disque pose sur un carre de couleur  -> on coupe le disque
  * le logo est rond sur fond blanc                          -> on coupe au bord
  * le logo est rectangulaire                                -> on le CONTIENT
    dans une pastille blanche, sans le rogner
"""
import numpy as np
from PIL import Image, ImageDraw

D = 520          # diametre de travail
S = 4            # sur-echantillonnage du masque

def _disque_alpha(n):
    y, x = np.mgrid[0:n*S, 0:n*S] / S
    r = n/2
    a = np.clip((r - np.hypot(x-r, y-r))*S, 0, 1)
    return Image.fromarray((np.asarray(
        Image.fromarray((a*255).astype(np.uint8)).resize((n, n), Image.LANCZOS))).astype(np.uint8))

def mesurer_fond(im):
    """Couleur des quatre coins : si elle est franche et identique partout,
    le logo est pose sur un aplat."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    H, W, _ = a.shape; c = max(4, int(min(H, W)*0.04))
    coins = [a[:c,:c], a[:c,-c:], a[-c:,:c], a[-c:,-c:]]
    meds = np.array([np.median(k.reshape(-1,3), 0) for k in coins])
    return np.median(meds, 0), float(meds.std(0).mean())

def boite_du_sujet(im, fond, tol=34):
    """Boite du contenu qui n'est PAS la couleur de fond."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    d = np.abs(a - fond).max(2)
    m = d > tol
    if m.sum() < 50: return None
    ys, xs = np.where(m)
    return int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1

def pastille(src, sortie, forcer_contenir=False):
    im = Image.open(src).convert('RGB')
    fond, disp = mesurer_fond(im)
    b = boite_du_sujet(im, fond)
    W, H = im.size
    couvre = b and (b[2]-b[0]) > W*0.80 and (b[3]-b[1]) > H*0.80
    carre = b and abs((b[2]-b[0]) - (b[3]-b[1])) < 0.10*max(b[2]-b[0], b[3]-b[1])
    mode = 'couper' if (couvre and carre and not forcer_contenir) else 'contenir'

    out = Image.new('RGBA', (D, D), (0,0,0,0))
    if mode == 'couper':
        cx, cy = (b[0]+b[2])/2, (b[1]+b[3])/2
        r = min(b[2]-b[0], b[3]-b[1])/2
        crop = im.crop((int(cx-r), int(cy-r), int(cx+r), int(cy+r))).resize((D, D), Image.LANCZOS)
        out.paste(crop, (0,0))
    else:
        out.paste((255,255,255,255), (0,0,D,D))
        bb = b or (0,0,W,H)
        sub = im.crop(bb)
        # le contenu tient dans le carre inscrit du cercle : cote = D/sqrt(2), moins une marge
        cote = int(D/np.sqrt(2)) - 14
        s = min(cote/sub.width, cote/sub.height)
        sub = sub.resize((max(1,int(sub.width*s)), max(1,int(sub.height*s))), Image.LANCZOS)
        out.paste(sub, ((D-sub.width)//2, (D-sub.height)//2))
    out.putalpha(_disque_alpha(D))
    out.save(sortie)
    print(f"  {src:14s} fond rgb({int(fond[0])},{int(fond[1])},{int(fond[2])}) "
          f"dispersion {disp:4.1f}  sujet {b}  -> {mode}")
    return mode

print("Pastilles :")
for src, dst, force in [('cabane.jpg','p-cabane.png',False),
                        ('bidul.jpeg','p-bidul.png',False),
                        ('laplage.jpeg','p-laplage.png',True),
                        ('mk.jpg','p-mk.png',False)]:
    pastille(src, dst, force)
