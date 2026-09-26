# -*- coding: utf-8 -*-
"""Telecharge les 38 visuels de La Plage et les prepare pour l'impression.

700 px et pas 1024 : le plus grand visuel de la carte fait 58 mm, soit 685 px a
300 dpi. On ne transporte pas des pixels qu'on n'imprimera jamais.

SES VISUELS VIENNENT DE DEUX SERIES — 14 photos reelles (`*-reel.jpg`) et
24 packshots studio (`*.png`). On les prend toutes, c'est la consigne. Le
script MESURE quand meme l'ecart de fond entre les deux series et l'imprime :
si l'ecart est fort, il se verra sur la page, et il vaut mieux le savoir avant
de lancer l'impression qu'apres.
"""
import io, json, os, sys, urllib.request
import numpy as np
from PIL import Image

BASE = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/la-plage/'
os.makedirs('web', exist_ok=True)

def fond(im):
    """La couleur du fond : la bordure de 6 % de l'image, la ou l'assiette n'est pas."""
    a = np.asarray(im.resize((120, 120), Image.LANCZOS)).astype(np.float32)
    b = 7
    bord = np.concatenate([a[:b].reshape(-1,3), a[-b:].reshape(-1,3),
                           a[:, :b].reshape(-1,3), a[:, -b:].reshape(-1,3)])
    return bord.mean(0), bord.std(0).mean()

if __name__ == '__main__':
    lignes = json.load(open('base_laplage.json'))
    series = {'reelle': [], 'packshot': []}
    for L in lignes:
        f = L['fichier']; slug = f.rsplit('.', 1)[0]
        dst = f'web/{slug}.jpg'
        if not os.path.exists(dst):
            b = urllib.request.urlopen(BASE + f).read()
            im = Image.open(io.BytesIO(b)).convert('RGB').resize((700, 700), Image.LANCZOS)
            im.save(dst, quality=86, optimize=True, subsampling=1)
        c, s = fond(Image.open(dst))
        series['reelle' if slug.endswith('-reel') else 'packshot'].append((slug, c, s))
    # le logo, en rond, pour la couverture
    if not os.path.exists('web/logo-laplage.png'):
        b = urllib.request.urlopen(
            'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/'
            'produits/la-plage/divers/logo.jpeg').read()
        Image.open(io.BytesIO(b)).convert('RGB').resize((560, 560), Image.LANCZOS)\
             .save('web/logo-laplage.png')

    print('ECART DE FOND ENTRE SES DEUX SERIES')
    moy = {}
    for k, v in series.items():
        C = np.array([c for _, c, _ in v]); S = np.array([s for _, _, s in v])
        moy[k] = C.mean(0)
        print('  %-9s %2d visuels   fond moyen #%02X%02X%02X   ecart-type interne %5.1f'
              % (k, len(v), *moy[k].astype(int), S.mean()))
    d = float(np.abs(moy['reelle'] - moy['packshot']).mean())
    print('  ecart entre les deux series : %.1f niveaux sur 255 (%.1f %%)' % (d, d/255*100))
    print('  -> %s' % ('les deux series se melangent sans se voir' if d < 12 else
                       'DEUX FONDS DIFFERENTS : cela se verra sur la page imprimee'))
    n = len([p for p in os.listdir('web') if p.endswith(('.jpg', '.png'))])
    tot = sum(os.path.getsize('web/'+p) for p in os.listdir('web'))
    print('\n%d fichiers, %d Ko au total' % (n, tot//1024))
