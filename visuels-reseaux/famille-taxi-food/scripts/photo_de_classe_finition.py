"""Photo de classe — finition (2026-10-22, 2e version, après « trop amateur »).

Le montage (photo_de_classe.py) sert de plan de mise en scène ; Nano Banana Pro le
re-rend en une seule image cohérente (lumière, ombres, rang de devant assis, ardoise) :
photo-de-classe/rendu-D.png. Comme toujours en scène de groupe, l'IA déforme les logos :
on repose ici les VRAIS logos sur chaque t-shirt, on réécrit le top-case, on écrit
l'ardoise à la craie et le titre. Positions relevées sur grille (image 1856 x 2304).
Usage : python3 scripts/photo_de_classe_finition.py   (depuis famille-taxi-food/)"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from scipy.ndimage import gaussian_filter

BASE = 'photo-de-classe/rendu-D.png'
NOIR = '../escale-creole/video/assets/fonts/Archivo_900Black.ttf'
CRAIE = '/System/Library/Fonts/Supplemental/Chalkduster.ttf'
OR = (255, 199, 44)

# logo prêt, centre (x, y), hauteur visée — couvre entièrement le logo déformé par l'IA
LOGOS = [
    ('logos/pret-siciliens.png', (588, 1091), 104),
    ('logos/pret-escale.png', (921, 1098), 100),
    ('logos/pret-laplage.png', (1247, 1060), 92),
    ('logos/pret-cabane.png', (229, 1520), 124),
    ('logos/pret-mk.png', (593, 1500), 116),
]
COURBE = 0.8


def courber(a):
    h, w = a.shape[:2]
    u = np.linspace(-1, 1, w)
    src = (np.sin(u * COURBE) / np.sin(COURBE) + 1) / 2 * (w - 1)
    i0 = np.floor(src).astype(int); t = (src - i0)[None, :, None]
    i1 = np.minimum(i0 + 1, w - 1)
    return a[:, i0] * (1 - t) + a[:, i1] * t


def effacer(rgb, x0, y0, w, h, marge=8):
    """Repeint le tissu sous l'ancien logo, sans rectangle visible : teinte = moyenne locale
    des pixels du t-shirt (ni l'encre sombre, ni les reflets), raccord fondu sur 10 px."""
    B = 60
    X0, Y0 = x0 - marge - B, y0 - marge - B
    R = rgb[Y0:y0 + h + marge + B, X0:x0 + w + marge + B]
    lum = R.mean(-1)
    tissu = ((lum > np.percentile(lum, 40)) & (lum < np.percentile(lum, 97))).astype(float)
    den = gaussian_filter(tissu, 22) + 1e-6
    rempli = np.dstack([gaussian_filter(R[..., k] * tissu, 22) / den for k in range(3)])
    m = np.zeros(lum.shape)
    m[B:B + h + 2 * marge, B:B + w + 2 * marge] = 1
    m = gaussian_filter(m, 5)[..., None]
    R[:] = R * (1 - m) + rempli * m


def imprimer(rgb, logo, centre, h):
    lg = Image.open(logo).convert('RGBA')
    w = round(lg.width * h / lg.height)
    a = courber(np.asarray(lg.resize((w, h), Image.LANCZOS)).astype(float))
    x0, y0 = centre[0] - w // 2, centre[1] - h // 2
    effacer(rgb, x0, y0, w, h)
    zone = rgb[y0:y0 + h, x0:x0 + w]
    # l'ombrage du tissu, pris sur une zone élargie (le logo déformé n'en est qu'une partie)
    autour = rgb[y0 - 20:y0 + h + 20, x0 - 30:x0 + w + 30].mean(-1)
    ref = np.percentile(autour, 96)
    lum = zone.mean(-1, keepdims=True)
    # sous l'ancien logo la luminance est fausse : on la lisse fortement
    lum = np.asarray(Image.fromarray(np.clip(lum[..., 0], 0, 255).astype(np.uint8))
                     .filter(ImageFilter.GaussianBlur(25))).astype(float)[..., None]
    ombre = np.clip(lum / ref, 0.7, 1.03)
    al = a[..., 3:4] / 255 * 0.97
    rgb[y0:y0 + h, x0:x0 + w] = zone * (1 - al) + a[..., :3] * ombre * al


def top_case(im):
    """Efface le lettrage déformé du top-case (interpolation verticale de l'orange) et
    l'écrit proprement."""
    rgb = np.asarray(im).astype(float)
    x0, x1, y0, y1 = 284, 388, 1012, 1046
    haut, bas = rgb[y0 - 3, x0:x1], rgb[y1 + 3, x0:x1]
    t = np.linspace(0, 1, y1 - y0)[:, None, None]
    rgb[y0:y1, x0:x1] = haut[None] * (1 - t) + bas[None] * t
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(NOIR, 21)
    d.text(((x0 + x1) / 2, (y0 + y1) / 2 + 1), 'TAXI FOOD', font=f, fill=(255, 255, 255), anchor='mm')
    return im


def ardoise(im):
    x0, y0, x1, y1 = 660, 1772, 985, 1985
    calque = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(calque)
    cx = (x0 + x1) / 2
    d.text((cx, y0 + 52), 'La famille', font=ImageFont.truetype(CRAIE, 40), fill=(245, 245, 240, 235), anchor='mm')
    d.text((cx, y0 + 112), 'Taxi Food', font=ImageFont.truetype(CRAIE, 52), fill=(255, 214, 90, 240), anchor='mm')
    d.line((cx - 95, y0 + 150, cx + 95, y0 + 150), fill=(245, 245, 240, 170), width=3)
    d.text((cx, y0 + 180), 'Promo 2026', font=ImageFont.truetype(CRAIE, 26), fill=(245, 245, 240, 215), anchor='mm')
    # grain de craie : on troue le trait au hasard
    a = np.asarray(calque).astype(float)
    rng = np.random.default_rng(7)
    a[..., 3] *= (rng.random(a.shape[:2]) > 0.18)
    calque = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    return Image.alpha_composite(im.convert('RGBA'), calque).convert('RGB')


def titre(im):
    d = ImageDraw.Draw(im)
    W = im.width
    for txt, taille, y, col in [('La famille s’agrandit…', 76, 70, (255, 255, 255)),
                                ('Qui est le nouveau ?', 76, 158, OR)]:
        f = ImageFont.truetype(NOIR, taille)
        ombre = Image.new('L', im.size, 0)
        ImageDraw.Draw(ombre).text((W / 2, y + 5), txt, font=f, fill=170, anchor='mt')
        ombre = ombre.filter(ImageFilter.GaussianBlur(7))
        im = Image.composite(Image.new('RGB', im.size, (70, 35, 15)), im, ombre)
        d = ImageDraw.Draw(im)
        d.text((W / 2, y), txt, font=f, fill=col, anchor='mt')
    return im


im = Image.open(BASE).convert('RGB')
rgb = np.asarray(im).astype(float)
for logo, c, h in LOGOS:
    imprimer(rgb, logo, c, h)
im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
im = top_case(im)
im = ardoise(im)
s = 1350 / im.height
im = im.resize((round(im.width * s), 1350), Image.LANCZOS)
x = (im.width - 1080) // 2
im = im.crop((x, 0, x + 1080, 1350))
im = titre(im)
im.save('photo-de-classe/PUB-famille-taxi-food-4x5.jpg', quality=93)
print('ok')
