# -*- coding: utf-8 -*-
"""La planche de choix : les deux sceaux, et les quatre epreuves qui decident.

Un logo ne se juge pas a 1000 px sur fond noir. Il se juge la ou il servira :
en pastille de 180 px sur le rouge de la charte, en avatar de 96 px, en
favicon de 48 px, et imprime en une seule encre. Les quatre colonnes de droite
sont ces quatre epreuves, a l'echelle reelle."""
import asyncio
from PIL import Image, ImageDraw, ImageFont

F = ('/root/.claude/skills/synced/aec50b4c-a11d-4564-b082-ed985abd2a29'
     '_503dea82-df58-4607-a359-41492125f335/canvas-design/canvas-fonts')
ROUGE, ENCRE, CREME, OR = (232,52,42), (19,19,19), (246,240,231), (253,197,103)
W = 1680
G = 56                      # gouttiere

def tf(f, s): return ImageFont.truetype(f'{F}/{f}.ttf', s)

def bloc(planche, d, y, lettre, titre, sous, png):
    sceau = Image.open(png).convert('RGBA')
    GR = 520
    grand = sceau.resize((GR, GR), Image.LANCZOS)
    x = G
    planche.paste(grand, (x, y), grand)

    # colonne de droite : les quatre epreuves, a l'echelle reelle
    cx = x + GR + 64
    d.text((cx, y+2), lettre, font=tf('Gloock-Regular', 46), fill=OR)
    d.text((cx+62, y+14), titre, font=tf('Gloock-Regular', 34), fill=(255,255,255))
    d.text((cx, y+72), sous, font=tf('WorkSans-Regular', 19), fill=(150,150,150))

    ey = y + 132
    ep = [('pastille 180 px\nsur le rouge charte', 180, ROUGE),
          ('avatar 96 px\nsur creme', 96, CREME),
          ('favicon 48 px\nsur encre', 48, ENCRE)]
    ex = cx
    for lab, taille, fond in ep:
        case = 208
        d.rectangle([ex, ey, ex+case, ey+case], fill=fond)
        v = sceau.resize((taille, taille), Image.LANCZOS)
        planche.paste(v, (ex+(case-taille)//2, ey+(case-taille)//2), v)
        for i, l in enumerate(lab.split('\n')):
            d.text((ex, ey+case+12+i*21), l, font=tf('WorkSans-Regular', 16), fill=(150,150,150))
        ex += case + 26
    # une seule encre : la meme image reduite a l'or pur sur blanc
    case = 208
    d.rectangle([ex, ey, ex+case, ey+case], fill=(255,255,255))
    # L'epreuve une encre n'est pas la silhouette du disque — ce serait un rond
    # noir et ne prouverait rien. C'est le DESSIN tire en une encre : la
    # luminance devient la densite d'encre, l'or fonce, la braise blanchit.
    import numpy as np
    q = np.asarray(sceau.convert('RGBA')).astype(np.float32)
    lum = q[..., :3] @ np.array([0.2126, 0.7152, 0.0722])
    dens = (lum/255.0) * (q[..., 3]/255.0)          # 0 = papier, 1 = encre pleine
    enc = np.zeros(q.shape, np.uint8)
    enc[..., 0], enc[..., 1], enc[..., 2] = ENCRE
    enc[..., 3] = np.clip(dens*255*1.15, 0, 255).astype(np.uint8)
    m = Image.fromarray(enc, 'RGBA').resize((160,160), Image.LANCZOS)
    planche.paste(m, (ex+(case-160)//2, ey+(case-160)//2), m)
    for i, l in enumerate('une seule encre\n(silhouette)'.split('\n')):
        d.text((ex, ey+case+12+i*21), l, font=tf('WorkSans-Regular', 16), fill=(150,150,150))
    return y + GR + 78


def planche():
    H = 1330
    im = Image.new('RGB', (W, H), (10, 7, 5))
    d = ImageDraw.Draw(im)
    d.text((G, 44), 'CHEZ M&K', font=tf('Gloock-Regular', 52), fill=OR)
    d.text((G, 112), 'deux propositions de logo  ·  construites, non generees  ·  '
                     'or #FDC567 et laque #981A02 mesures sur son propre materiel',
           font=tf('WorkSans-Regular', 20), fill=(150,150,150))
    d.line([G, 164, W-G, 164], fill=(60, 48, 32), width=1)
    y = 202
    y = bloc(im, d, y, 'A', "L'ÉCUELLE",
             "le bol renversé fumant — et, pour qui connaît l'île, le mont vu de la mer.\n"
             "Poiret One  ·  quatre repères d'axe  ·  neuf stries creusées dans l'or",
             '/root/logos/mk/sceau-A.png')
    d.line([G, y-30, W-G, y-30], fill=(60, 48, 32), width=1)
    bloc(im, d, y+8, 'B', 'LE SCEAU',
         "le monogramme frappé dans le laque — la marque qu'on appose sur ce qui sort de la cuisine.\n"
         'Gloock  ·  quarante-huit crans de bezel  ·  carré presque vif, arrondi 2,7 %',
         '/root/logos/mk/sceau-B.png')
    im.save('/root/logos/mk/PLANCHE-LOGOS-M-ET-K.png')
    print('PLANCHE-LOGOS-M-ET-K.png %dx%d' % im.size)

if __name__ == '__main__':
    planche()
