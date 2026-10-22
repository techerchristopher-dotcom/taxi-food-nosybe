"""Prépare les logos des restaurants en PNG détourés, prêts à imprimer sur les t-shirts.
Usage : python3 scripts/preparer_logos.py  (depuis famille-taxi-food/)"""
import numpy as np
from PIL import Image, ImageDraw

def rond(src, rayon_frac, dst):
    im = Image.open(src).convert('RGBA'); w, h = im.size
    r = rayon_frac * min(w, h); cx, cy = w / 2, h / 2
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    im.putalpha(m); im.crop((int(cx - r), int(cy - r), int(cx + r), int(cy + r))).save(dst)

def sans_fond(src, dst, seuil=40):
    im = np.asarray(Image.open(src).convert('RGB')).astype(float)
    fond = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3)]), axis=0)
    d = np.sqrt(((im - fond) ** 2).sum(-1))
    a = np.clip((d - seuil * 0.5) / (seuil * 0.5), 0, 1)
    out = np.dstack([im, a * 255]).astype(np.uint8)
    o = Image.fromarray(out, 'RGBA'); o.crop(o.getbbox()).save(dst)

rond('logos/cabane-db.jpg', 0.475, 'logos/pret-cabane.png')
rond('logos/laplage-db.png', 0.495, 'logos/pret-laplage.png')
sans_fond('logos/escale-db.png', 'logos/pret-escale.png')
for s, d in [('logos/mk-db.png', 'logos/pret-mk.png'), ('logos/siciliens-rond.png', 'logos/pret-siciliens.png')]:
    o = Image.open(s).convert('RGBA'); o.crop(o.getbbox()).save(d)


def badge_sombre(src, dst, marge=0.10, rayon=0.18):
    """Logo clair sur fond noir (Manson) : recadré sur son contenu, posé dans un badge noir
    arrondi — le serpent blanc reste lisible sur le t-shirt blanc."""
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int)
    m = a.max(-1) > 60
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    pad = int(marge * (x1 - x0))
    c = im.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    mask = Image.new('L', c.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, c.width - 1, c.height - 1),
                                           radius=int(rayon * c.height), fill=255)
    c = c.convert('RGBA'); c.putalpha(mask); c.save(dst)

badge_sombre('logos/manson-db.png', 'logos/pret-manson.png')
