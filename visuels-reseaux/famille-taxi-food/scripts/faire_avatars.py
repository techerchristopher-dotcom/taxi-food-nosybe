"""Avatars d'accueil : les personnages détourés, TOUS au même gabarit.

Règle unique (demande du 2026-10-22, « ils n'ont pas tous les mêmes dimensions ») :
carré 600 px, fond crème identique, personnage à 86 % de la hauteur (de la tête aux
semelles), pieds posés à 95 %, centré, même ombre au sol. Un personnage trop large pour
tenir est réduit (le script le signale).
Usage : python3 scripts/faire_avatars.py   (depuis famille-taxi-food/)"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 600
FOND = (247, 236, 222)       # crème de la famille
HAUT, BAS, LARG_MAX = 0.86, 0.95, 0.92
SLUGS = ['la-cabane', 'les-siciliens', 'escale-creole', 'la-plage', 'chez-m-et-k', 'manson']

def fond():
    """Crème légèrement plus clair au centre, comme les rendus studio."""
    y, x = np.mgrid[0:S, 0:S]
    d = np.sqrt((x - S / 2) ** 2 + (y - S * 0.45) ** 2) / (S * 0.75)
    k = np.clip(1 - d, 0, 1)[..., None]
    base = np.array(FOND, float)
    return Image.fromarray(np.clip(base + k * 8, 0, 255).astype(np.uint8))

for slug in SLUGS:
    p = Image.open(f'detoures/{slug}.png').convert('RGBA')
    p = p.crop(p.getbbox())
    s = HAUT * S / p.height
    if p.width * s > LARG_MAX * S:
        s = LARG_MAX * S / p.width
        print(f'{slug}: réduit pour tenir en largeur')
    p = p.resize((round(p.width * s), round(p.height * s)), Image.LANCZOS)
    im = fond()
    # ombre de contact
    om = Image.new('L', (S, S), 0)
    bas = int(BAS * S); w = int(p.width * 0.55)
    ImageDraw.Draw(om).ellipse((S / 2 - w / 2, bas - 14, S / 2 + w / 2, bas + 10), fill=110)
    om = om.filter(ImageFilter.GaussianBlur(10))
    im = Image.composite(Image.new('RGB', (S, S), (150, 120, 95)), im, om)
    im.paste(p, ((S - p.width) // 2, bas - p.height), p)
    im.save(f'avatars/{slug}.png', optimize=True)
    print(slug, p.size)
