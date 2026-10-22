"""Bandeaux d'accueil : un par restaurant, TOUS au même format (1200 x 480, 2,5:1).

- Couverture photo (La Cabane, La Plage) : recadrage d'une bande choisie à la main pour
  que l'enseigne reste entière (paramètre `haut` = fraction de hauteur où commence la bande).
- Couverture-texte ou logo (Chez M&K, Manson) : JAMAIS rognée — l'image entière est posée
  à la hauteur du bandeau, les côtés prolongés par sa couleur de bord.
- Pas de couverture (L'escale Créole, Les Siciliens, Madame Oh, Oh Hazar) : trois photos de
  plats de SA carte, côte à côte.
Usage : python3 scripts/faire_bandeaux.py   (depuis famille-taxi-food/)"""
import numpy as np
from PIL import Image, ImageFilter

W, H = 1200, 480
SRC = 'bandeaux/src/'

def bande(f, haut):
    im = Image.open(SRC + f).convert('RGB')
    h = round(im.width * H / W)
    y = round(haut * im.height)
    y = max(0, min(y, im.height - h))
    return im.crop((0, y, im.width, y + h)).resize((W, H), Image.LANCZOS)

def entier(f, marge=0.0, uni=None):
    """Image entière, jamais rognée. `marge` : vide en haut ET en bas (texte collé au bord).
    Fond : `uni` (couleur) ou la couverture étirée et floutée ; les bords de l'image posée
    sont fondus sur 5 % de sa largeur (plus, le fondu mange le texte de M&K) pour qu'aucun raccord ne se voie."""
    src = Image.open(SRC + f).convert('RGB')
    h = round(H * (1 - 2 * marge))
    im = src.resize((round(src.width * h / src.height), h), Image.LANCZOS)
    if uni is not None:
        out = Image.new('RGB', (W, H), uni)
    else:
        out = src.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(60))
    x = np.linspace(0, 1, im.width)
    f_ = np.clip(np.minimum(x, 1 - x) / 0.05, 0, 1)
    y = np.linspace(0, 1, im.height)
    g_ = np.clip(np.minimum(y, 1 - y) / 0.10, 0, 1) if marge else np.ones_like(y)
    a = Image.fromarray((np.outer(g_, f_) * 255).astype(np.uint8))
    out.paste(im, ((W - im.width) // 2, (H - im.height) // 2), a)
    return out

def mosaique(fs):
    out = Image.new('RGB', (W, H), 'white'); w = W // len(fs)
    for k, f in enumerate(fs):
        im = Image.open(SRC + f).convert('RGB')
        s = max(w / im.width, H / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - w) // 2, (im.height - H) // 2
        out.paste(im.crop((x, y, x + w, y + H)), (k * w, 0))
    return out

BANDEAUX = {
    'la-cabane': lambda: bande('cover-la-cabane.jpg', 0.22),
    'la-plage': lambda: bande('cover-la-plage.jpg', 0.12),
    'chez-m-et-k': lambda: entier('cover-chez-m-et-k.jpg', marge=0.06),
    'manson': lambda: entier('cover-manson.jpg', uni=(0, 0, 0)),
    'escale-creole': lambda: mosaique(['escale-creole--pj-rougail-saucisses.jpg',
                                       'escale-creole--ab-sambos-zebu.jpg',
                                       'escale-creole--ab-bouchon-porc.jpg']),
    'les-siciliens': lambda: mosaique(['les-siciliens--pizza-les-siciliens.png',
                                       'les-siciliens--pates-lasagne.png',
                                       'les-siciliens--burger-burger.png']),
    'madame-oh': lambda: mosaique(['madame-oh--plat-pad-thai-royal.png',
                                   'madame-oh--plat-curry-vert.png',
                                   'madame-oh--entree-nem-poulet.png']),
    'oh-hazar': lambda: mosaique(['oh-hazar--plat-tajine-agneau-pruneaux.png',
                                  'oh-hazar--plat-couscous-royal.png',
                                  'oh-hazar--plat-brochette-kefta.png']),
}

if __name__ == '__main__':
    for slug, f in BANDEAUX.items():
        f().save(f'bandeaux/{slug}.jpg', quality=86, optimize=True)
        print(slug)
