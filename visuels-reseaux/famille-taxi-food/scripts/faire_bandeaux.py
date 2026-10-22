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

def plat(f, fy=0.5):
    """Le plat LE PLUS VENDU, plein cadre (décision du 2026-10-22) : photo mise à la largeur
    du bandeau, bande de 2,5:1 centrée sur `fy` (fraction de hauteur où est le plat)."""
    im = Image.open(SRC + f).convert('RGB')
    s = W / im.width
    im = im.resize((W, round(im.height * s)), Image.LANCZOS)
    y = max(0, min(int(fy * im.height - H / 2), im.height - H))
    return im.crop((0, y, W, y + H))

def mosaique(fs):
    out = Image.new('RGB', (W, H), 'white'); w = W // len(fs)
    for k, f in enumerate(fs):
        im = Image.open(SRC + f).convert('RGB')
        s = max(w / im.width, H / im.height)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
        x, y = (im.width - w) // 2, (im.height - H) // 2
        out.paste(im.crop((x, y, x + w, y + H)), (k * w, 0))
    return out

# 2026-10-22 (2e version, demande du porteur du projet) : le bandeau montre le plat le plus
# vendu du restaurant (commandes livrées, hors boissons). Sans vente : son plat phare.
# Les anciennes fonctions (bande, entier, mosaique) restent pour d'autres usages.
BANDEAUX = {
    'la-cabane': lambda: plat('plat-la-cabane.png', 0.50),          # Tacos — 24 vendus
    'escale-creole': lambda: plat('plat-escale-creole.jpg', 0.55),  # Sambos zébu/poulet — 6
    'la-plage': lambda: plat('plat-la-plage.png', 0.55),            # Poulet coco — 4
    'les-siciliens': lambda: plat('plat-les-siciliens.png', 0.50),  # Pizza Salame — 4
    'chez-m-et-k': lambda: plat('plat-chez-m-et-k.jpg', 0.69),      # Soupe spéciale MK — 1
    'manson': lambda: plat('plat-manson.jpg', 0.62),                # Cannibal (aucune vente)
    'madame-oh': lambda: plat('plat-madame-oh.png', 0.55),          # Pad thaï royal (aucune vente)
    'oh-hazar': lambda: plat('plat-oh-hazar.png', 0.55),            # Couscous royal (aucune vente)
}

if __name__ == '__main__':
    for slug, f in BANDEAUX.items():
        f().save(f'bandeaux/{slug}.jpg', quality=86, optimize=True)
        print(slug)
