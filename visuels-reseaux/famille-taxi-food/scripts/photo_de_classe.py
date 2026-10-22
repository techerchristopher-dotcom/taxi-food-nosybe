"""La photo de classe de la famille Taxi Food (2026-10-22).

L'IA ne fait QUE le décor (cour d'école, banc vide, scooter + top-case, Maki photographe) :
en scène de groupe elle déforme les logos et confond les personnages (essais A et B). Les
membres sont les détourages des personnages VALIDÉS, posés ici à la main ; le nouveau venu
est la silhouette noire de son vrai détourage, avec un « ? ».
Usage : python3 scripts/photo_de_classe.py   (depuis famille-taxi-food/)"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DECOR = 'photo-de-classe/decor-A.png'          # 1856 x 2304
FONT = '../escale-creole/video/assets/fonts/Archivo_900Black.ttf'
FONT2 = '../escale-creole/video/assets/fonts/Archivo_800ExtraBold.ttf'
ROUGE, OR = (232, 52, 42), (255, 199, 44)

# (détourage, centre x, y des pieds, hauteur, silhouette ?)  — coordonnées du décor
# Rang du fond : debout sur la table (pieds à y 1236), à droite du top-case pour qu'il reste
# visible. Rang de devant : AU SOL devant le banc (pieds à y 1720) — sur le banc, leurs têtes
# montaient à hauteur des logos du fond et les cachaient. Jamais au-delà de x ~1250 (Maki).
RANGS = [
    ('les-siciliens', 805, 1236, 350, False),
    ('escale-creole', 1090, 1236, 350, False),
    ('la-plage', 1365, 1236, 350, False),
    ('la-cabane', 520, 1720, 430, False),
    ('chez-m-et-k', 830, 1720, 430, False),
    ('manson', 1105, 1720, 430, True),      # le nouveau : silhouette
]

def membre(slug, h, silhouette):
    p = Image.open(f'detoures/{slug}.png').convert('RGBA')
    p = p.crop(p.getbbox())
    p = p.resize((round(p.width * h / p.height), h), Image.LANCZOS)
    a = np.asarray(p).astype(float)
    if silhouette:
        a[..., :3] = (20, 18, 22)
    else:
        a[..., :3] *= (1.03, 1.0, 0.95)    # lumière chaude du décor
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def ombre(img, cx, y, w):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((cx - w / 2, y - 12, cx + w / 2, y + 12), fill=120)
    m = m.filter(ImageFilter.GaussianBlur(9))
    return Image.composite(Image.new('RGB', img.size, (70, 45, 25)), img, m)

def point_interrogation(img, cx, top, h):
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, int(h * 0.42))
    x, y = cx, top + h * 0.42
    for dx, dy in [(-4, 4), (4, 4), (0, 6)]:
        d.text((x + dx, y + dy), '?', font=f, fill=(0, 0, 0), anchor='mm')
    d.text((x, y), '?', font=f, fill=OR, anchor='mm', stroke_width=6, stroke_fill=(255, 255, 255))

def titre(img, y0=0):
    d = ImageDraw.Draw(img)
    W = img.width
    f1 = ImageFont.truetype(FONT, 104)
    f2 = ImageFont.truetype(FONT2, 54)
    for txt, f, y, col in [('La famille', f1, 0, (255, 255, 255)), ('Taxi Food', f1, 108, OR),
                           ('s\u2019agrandit\u2026 qui est le nouveau ?', f2, 210, (255, 255, 255))]:
        d.text((W / 2 + 5, y0 + y + 6), txt, font=f, fill=(60, 30, 20), anchor='mt')
        d.text((W / 2, y0 + y), txt, font=f, fill=col, anchor='mt', stroke_width=5, stroke_fill=ROUGE)

# Cadre resserré sur la classe (4:5) : on garde le top-case à gauche et Maki à droite.
CADRE = (340, 200, 1856, 200 + round(1516 * 5 / 4))

im = Image.open(DECOR).convert('RGB')
for slug, cx, pieds, h, sil in RANGS:
    p = membre(slug, h, sil)
    im = ombre(im, cx, pieds - 4, p.width * 0.75)
    im.paste(p, (cx - p.width // 2, pieds - p.height), p)
    if sil:
        point_interrogation(im, cx, pieds - h, h)
im.save('photo-de-classe/photo-de-classe-scene-HD.png')
c = im.crop(CADRE).resize((1080, 1350), Image.LANCZOS)
titre(c, 34)
c.save('photo-de-classe/PUB-famille-taxi-food-4x5.jpg', quality=92)
# Story 9:16 : la même image, prolongée en haut et en bas par son propre flou.
st = c.resize((1080, 1920)).filter(ImageFilter.GaussianBlur(40))
st.paste(c, (0, (1920 - 1350) // 2))
st.save('photo-de-classe/PUB-famille-taxi-food-story.jpg', quality=92)
print('ok')
