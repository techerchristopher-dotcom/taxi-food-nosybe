"""Imprime le logo de chaque restaurant sur le t-shirt blanc de son personnage.

Pourquoi pas l'IA : demandé « en grand », Nano Banana laisse le logo petit ou le rogne
(essais v4 et v5 du 2026-10-22). Ici le logo est le fichier ORIGINAL, posé à la plus
grande taille qui tient dans la face avant du t-shirt (relevée à la main sur grille,
pixels de l'image 1792 x 2400), courbé comme sur un corps cylindrique, puis ombré par
le tissu (multiplication par la luminance du t-shirt) : les plis passent dans l'encre.
Une main posée devant le t-shirt reste devant (on n'imprime que sur le tissu).

Usage : python3 scripts/imprimer_tshirts.py   (depuis famille-taxi-food/)
"""
import numpy as np
from PIL import Image

# base au t-shirt vierge, logo prêt, sortie, face avant du t-shirt (x0, y0, x1, y1)
PERSOS = [
    ('v1/1-tacos-la-cabane.png', 'logos/pret-cabane.png',
     'final/1-monsieur-tacos-la-cabane.png', (520, 1255, 1290, 1690)),
    ('v1/5-pizza-les-siciliens.png', 'logos/pret-siciliens.png',
     'final/2-signor-pizza-les-siciliens.png', (480, 1285, 1370, 1625)),
    ('v3/I-bouchon-escale-a.png', 'logos/pret-escale.png',
     'final/3-monsieur-bouchon-escale-creole.png', (430, 1300, 1370, 1665)),
    ('v3/K-croustille-filet.png', 'logos/pret-laplage.png',
     'final/4-madame-croustille-la-plage.png', (570, 1095, 1270, 1540)),
    ('v3/M-nem-a.png', 'logos/pret-mk.png',
     'final/5-madame-nem-chez-mk.png', (570, 1095, 1280, 1545)),
    ('manson/piste1-v2-A.png', 'logos/pret-manson.png',
     'final/6-monsieur-manson-manson.png', (880, 990, 1225, 1600)),
]
MARGE = 18      # px de tissu blanc gardés autour du logo
COURBE = 0.85   # rad : courbure du corps (0 = plat)


def courber(lg):
    """Compresse les bords comme un imprimé sur un cylindre vu de face."""
    a = np.asarray(lg).astype(float); h, w = a.shape[:2]
    u = np.linspace(-1, 1, w)
    src = (np.sin(u * COURBE) / np.sin(COURBE) + 1) / 2 * (w - 1)
    i0 = np.floor(src).astype(int); t = (src - i0)[None, :, None]
    i1 = np.minimum(i0 + 1, w - 1)
    return a[:, i0] * (1 - t) + a[:, i1] * t


for base, logo, sortie, (x0, y0, x1, y1) in PERSOS:
    rgb = np.asarray(Image.open(base).convert('RGB')).astype(float)
    lg = Image.open(logo).convert('RGBA')
    bw, bh = x1 - x0 - 2 * MARGE, y1 - y0 - 2 * MARGE
    s = min(bw / lg.width, bh / lg.height)
    w, h = int(lg.width * s), int(lg.height * s)
    lg = courber(lg.resize((w, h), Image.LANCZOS))
    lx, ly = (x0 + x1) // 2 - w // 2, (y0 + y1) // 2 - h // 2
    zone = rgb[ly:ly + h, lx:lx + w]
    lum = zone.mean(-1, keepdims=True)
    mn, mx = zone.min(-1), zone.max(-1)
    tissu = ((mn > 120) & ((mx - mn) < 60)).astype(float)[..., None]  # pas la main
    panneau = rgb[y0:y1, x0:x1].mean(-1)
    ref = np.percentile(panneau, 95)
    ombre = np.clip(lum / ref, 0.5, 1.04)
    encre = lg[..., :3] * ombre
    a = lg[..., 3:4] / 255 * 0.97 * tissu
    rgb[ly:ly + h, lx:lx + w] = zone * (1 - a) + encre * a
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(sortie)
    cache = ((lg[..., 3] > 25) & (tissu[..., 0] == 0)).mean()
    print(f'{sortie}: logo {w}x{h}px = {w / (x1 - x0):.0%} de la largeur et '
          f'{h / (y1 - y0):.0%} de la hauteur du t-shirt ; part masquée {cache:.1%}')
