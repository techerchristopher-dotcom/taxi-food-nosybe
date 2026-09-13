# -*- coding: utf-8 -*-
"""Pose une lueur de lampe sur une photo passee en nuit, et la mesure.

Un passage en nuit sort juste : la scene est bleue, la lampe est chaude, tout
est en place. Mais il sort SOUS-EXPOSE — sur la Reine du dimanche soir, le
visage de la femme du fond tombait a L=49 et le dos de l'autre a L=36. Une pub
demande qu'on voie les gens et que le plat soit le point le plus clair.

On ne remonte pas l'exposition globale : ca deteint le noir de la nuit en gris.
On pose une LUEUR : un ajout chaud, radial, centre sur la lampe, calcule en
lumiere lineaire pour que les hautes lumieres ne bavent pas, et amorti la ou le
pixel est deja bleu — la nuit dehors reste froide, seul l'interieur se rechauffe.
"""
import numpy as np
from PIL import Image


def _lin(x):
    return np.where(x <= 0.04045, x/12.92, ((x+0.055)/1.055)**2.4)


def _srgb(x):
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x*12.92, 1.055*x**(1/2.4) - 0.055)


def lueur(src, sortie, sources=None, centre=(0.5, 0.55), rayon=(0.62, 0.42),
          force=0.55, teinte=(1.00, 0.72, 0.42), releve=0.030, sature=1.08,
          garde_nuit=0.85):
    """Une ou plusieurs sources. Chaque source est un dict
    {centre, rayon, force, teinte}. Sans `sources`, on retombe sur la source
    unique decrite par les arguments simples.

    La lueur s'ajoute PROPORTIONNELLEMENT a ce qui est deja eclaire : une ombre
    portee recoit donc moins qu'un mur en pleine lumiere, et elle survit au
    relevage. C'est ce qui permet de remonter la piece sans effacer l'ombre de
    la femme sur le mur — le defaut qu'on avait avant."""
    if sources is None:
        sources = [dict(centre=centre, rayon=rayon, force=force, teinte=teinte)]
    a = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)/255.0
    H, W, _ = a.shape
    y, x = np.mgrid[0:H, 0:W]
    bleu = np.clip((a[...,2] - a[...,0]) * 3.0, 0, 1)   # la nuit dehors
    lin = _lin(a)
    reflect = 0.35 + 0.65*np.clip(lin.mean(2), 0, 1)[..., None]

    for s in sources:
        c, r = s['centre'], s['rayon']
        d = np.sqrt(((x/W - c[0])/r[0])**2 + ((y/H - c[1])/r[1])**2)
        halo = np.clip(1.0 - d, 0, 1)**2.0 * (1.0 - garde_nuit*bleu)
        t = np.array(s.get('teinte', teinte), dtype=np.float32)
        lin = lin + halo[..., None] * reflect * t * s['force']

    # les ombres les plus profondes remontent un peu, sans grisailler
    lin = lin + releve * (1.0 - np.clip(lin/0.06, 0, 1))

    out = _srgb(lin)
    gris = out.mean(2, keepdims=True)
    out = np.clip(gris + (out - gris)*sature, 0, 1)
    Image.fromarray((out*255).round().astype(np.uint8)).save(sortie, quality=96)
    return sortie


def mesurer(f, k=None):
    a = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
    L = a.mean(2); W = a.shape[1]; k = k or W/500.0
    zones = {'pizza':(320,355,375,390), 'table':(250,330,380,420),
             'femme fond':(280,285,330,345), 'femme dos':(180,330,270,430),
             'sol':(150,500,400,620), 'exterieur':(390,200,490,300)}
    r = {}
    for n,(x0,y0,x1,y1) in zones.items():
        s = L[int(y0*k):int(y1*k), int(x0*k):int(x1*k)]
        c = a[int(y0*k):int(y1*k), int(x0*k):int(x1*k)].reshape(-1,3).mean(0)
        r[n] = (float(s.mean()), c)
    r['image'] = (float(L.mean()), a.reshape(-1,3).mean(0))
    r['ecrete'] = float((L > 252).mean())
    return r
