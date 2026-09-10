# -*- coding: utf-8 -*-
"""Du matte transparent au plat pret a poser : nettoyage + ombre de contact.

Pourquoi cette etape existe. Le detourage par la couleur (detourage.py) tient les
pizzas et rien d'autre : sur un burger pose a plat, l'ombre chaude que les frites
projettent sur l'ardoise a EXACTEMENT la signature du steak saisi — luminosite 36
contre 42, R-B 60 contre 59. Mesure, pas suppose. Aucun seuil ne les separe.

La chaine est donc : photo reelle -> gpt_image_2 la regenere sur fond blanc, plat
identique, sans ardoise -> le matteur de Higgsfield sort l'alpha -> ce script pose
l'ombre. Le plat reste fidele, le bord est propre, et il ne flotte plus.

L'ombre n'est PAS une ellipse generique : elle est tiree de la silhouette du plat
lui-meme (bande basse de l'alpha, ecrasee puis floutee). C'est ce qui l'adapte a
chaque plat sans reglage — un kebab ne se pose pas comme un burger.
"""
from PIL import Image, ImageFilter
import numpy as np, json, sys

BANDE   = 0.30   # part basse de l'objet qui projette l'ombre
ECRAS   = 0.14   # de combien on ecrase cette bande pour en faire une flaque
OPACITE = 135    # noir de l'ombre, avant flou
FLOU    = 0.045  # rayon de flou, en part de la hauteur du plat
ENCRE   = 6      # l'ombre n'est jamais noir pur


def packshot(src, out, bande=BANDE, ecras=ECRAS, opacite=OPACITE, flou=FLOU, dy=0.0):
    """dy : decale l'ombre vers le bas, en part de la hauteur (pour un plat en hauteur)."""
    net = Image.open(src).convert('RGBA')
    net = net.crop(net.getbbox())
    W, H = net.size

    al = np.asarray(net)[:, :, 3]
    y0 = int(H * (1 - bande))
    pied = Image.fromarray(al[y0:, :])                       # l'empreinte au sol
    hp = max(4, int(pied.height * ecras))
    pied = pied.resize((W, hp), Image.BILINEAR)
    pied = pied.point(lambda v: min(255, int(v * opacite / 255)))

    r = max(3, int(H * flou))
    marge = r * 3
    toile = Image.new('RGBA', (W + 2*marge, H + marge + int(H*dy) + hp//2), (0, 0, 0, 0))
    masque = Image.new('L', toile.size, 0)
    masque.paste(pied, (marge, int(H + int(H*dy) - hp//2)))
    masque = masque.filter(ImageFilter.GaussianBlur(r))
    toile.alpha_composite(Image.merge('RGBA', (Image.new('L', toile.size, ENCRE),)*3 + (masque,)))
    toile.alpha_composite(net, (marge, 0))

    toile = toile.crop(toile.getbbox())
    toile.save(out)
    json.dump({'bbox': [0, 0, toile.width, toile.height], 'src': list(toile.size)},
              open(out.rsplit('.', 1)[0] + '.json', 'w'))
    web = toile.copy(); web.thumbnail((1000, 1000))
    web.save(out.replace('det-', 'web-').rsplit('.', 1)[0] + '.webp', 'WEBP', quality=84, method=6)
    return toile.size


if __name__ == '__main__':
    print(sys.argv[2], packshot(sys.argv[1], sys.argv[2]))
