# -*- coding: utf-8 -*-
"""
Pictogramme « Sans sauce » — construit, jamais genere.

Regle 1 de la charte : le modele ne dessine ni lettre ni logo. Cette icone est
donc de la geometrie calculee (PIL), pas une image generee : aucun texte, aucun
lettrage, rien d'invente.

Les trois nombres qui comptent sont MESURES sur les 9 icones de sauce deja en
ligne, pas choisis :
  - fond    : mediane des moyennes de coins des 9 references
  - diametre: mediane des largeurs de bbox du sujet des 9 references
  - encre   : resolue pour atteindre un contraste cible sur ce fond, puis
              quantifiee AVANT le test (sinon l'arrondi repasse sous la cible).
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S       = 1024      # format des icones existantes
SS      = 4         # sur-echantillonnage
CIBLE   = 4.5       # contraste vise encre / fond

def lum(c):
    """Luminance relative sRGB (WCAG)."""
    v = np.asarray(c, dtype=float) / 255.0
    v = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    return float(0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2])

def contraste(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

def encre_pour(fond, cible):
    """Le niveau de gris ENTIER le plus clair qui tient la cible sur ce fond.
    On quantifie dans la boucle : tester un flottant puis arrondir fait
    retomber le resultat sous la cible (erreur deja payee sur la carte)."""
    for g in range(255, -1, -1):
        if contraste((g, g, g), fond) >= cible:
            return g
    return 0

def batir(fond, encre, diam, dash=False, ombre=True):
    W = S * SS
    im = Image.new('RGB', (W, W), tuple(fond))

    # --- ombre douce, comme les dollops de la serie ---
    if ombre:
        oc = Image.new('L', (W, W), 0)
        do = ImageDraw.Draw(oc)
        r = diam * SS / 2
        do.ellipse([W/2 - r*1.02, W/2 - r*0.92 + 18*SS,
                    W/2 + r*1.02, W/2 + r*0.92 + 18*SS], fill=70)
        oc = oc.filter(ImageFilter.GaussianBlur(26 * SS))
        gris = Image.new('RGB', (W, W), (max(0, fond[0]-26),)*3)
        im = Image.composite(gris, im, oc)

    d = ImageDraw.Draw(im)
    R  = diam * SS / 2
    TR = round(diam * 0.052) * SS          # epaisseur de l'anneau
    C  = W / 2

    if dash:
        n, plein = 28, 0.56
        pas = 360.0 / n
        for k in range(n):
            a0 = k * pas
            d.arc([C-R, C-R, C+R, C+R], a0, a0 + pas*plein,
                  fill=tuple([encre]*3), width=TR)
    else:
        d.ellipse([C-R, C-R, C+R, C+R], outline=tuple([encre]*3), width=TR)

    # --- barre diagonale, avec un jour de fond de part et d'autre ---
    import math
    ang = math.radians(-45)
    ux, uy = math.cos(ang), math.sin(ang)
    L = R * 1.00
    p0 = (C - ux*L, C - uy*L)
    p1 = (C + ux*L, C + uy*L)
    d.line([p0, p1], fill=tuple([fond[0]]*3), width=int(TR*2.6))   # le jour
    d.line([p0, p1], fill=tuple([encre]*3), width=TR)              # la barre

    return im.resize((S, S), Image.LANCZOS)

if __name__ == '__main__':
    import glob, json, sys
    fonds, diams = [], []
    for f in sorted(glob.glob('/home/claude/sauces/ref/[a-z]*.png')):
        a = np.asarray(Image.open(f).convert('RGB')).astype(np.int16)
        coins = np.concatenate([a[:40,:40].reshape(-1,3), a[:40,-40:].reshape(-1,3),
                                a[-40:,:40].reshape(-1,3), a[-40:,-40:].reshape(-1,3)])
        fo = coins.mean(0)
        fonds.append(fo)
        m = np.abs(a - fo).sum(2) > 40
        xs = np.where(m.any(0))[0]
        diams.append(xs.max() - xs.min())
    fond_med = int(round(float(np.median([f.mean() for f in fonds]))))
    diam_med = int(round(float(np.median(diams))))
    fond  = (fond_med,)*3
    encre = encre_pour(fond, CIBLE)
    print(json.dumps({'fond': fond_med, 'diametre': diam_med, 'encre': encre,
                      'contraste': round(contraste((encre,)*3, fond), 2)}))
    batir(fond, encre, diam_med, dash=False).save('/home/claude/sauces/plein.png')
    batir(fond, encre, diam_med, dash=True ).save('/home/claude/sauces/tirets.png')
