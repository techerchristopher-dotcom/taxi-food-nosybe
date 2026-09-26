# -*- coding: utf-8 -*-
"""Rend l'annonce de La Plage et la verifie. Cinq controles, aucun a l'oeil."""
import asyncio, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
import pub_laplage as P
from mesure import standalone

AIR_MINI = 20.0
BOIS = dict(x0=700, x1=1080, y0=464, y1=748)   # cellule reservee, cf. scene_mosaique.py


def masque_assiettes(scene, larg, haut):
    """Ou sont les assiettes dans la scene finale.

    La charte mesure l'air de la pastille sur une CARTE D'OCCUPATION (ecart-type
    local > 6). Juste sur un fond en degrade ; faux sur une mosaique : le grain
    du bois de sa table a un ecart-type local de 13 (mesure), donc tout le cadre
    est « occupe » et le controle renvoyait -116,8 px quelle que soit la
    position. Il mesurait la texture, pas le risque.

    Ce que le controle protege vraiment, c'est qu'AUCUNE ASSIETTE NE SOIT
    MORDUE. On mesure donc cela, et par la couleur comme la charte l'exige : la
    faience est claire et desaturee, le bois est brun donc sature."""
    im = Image.open(scene).convert('RGB').resize((larg, haut), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    mx = a.max(2); mn = a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return ndimage.binary_opening((mx > 0.55) & (S < 0.28), np.ones((5, 5)))


def air_badge(masque, cx, cy, r):
    ys, xs = np.nonzero(masque)
    if not len(xs):
        return 999.0
    return float(np.hypot(xs - cx, ys - cy).min() - r)


async def rendre(fichier='PUB-laplage-annonce.png'):
    from playwright.async_api import async_playwright
    cfg = dict(P.LAPLAGE)
    h, red = 1350, 594
    ph = h - red - P.FILET
    bd = 235
    bx = BOIS['x0'] + (BOIS['x1'] - BOIS['x0'] - bd) // 2
    by = BOIS['y0'] + (BOIS['y1'] - BOIS['y0'] - bd) // 2

    open('pub.dc.html', 'w').write(P.pub(h=h, red=red, badge=(bd, bx, by), h_col=505, **cfg))
    open('sa-pub.html', 'w').write(standalone('pub.dc.html'))

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': h}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto('file://' + os.path.abspath('sa-pub.html'), wait_until='load')
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const q = s => [...document.querySelectorAll(s)];
          const c = q('div').filter(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
          const pr = c.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
          const gp = q('img').find(i => (i.alt||'').includes('Google Play'));
          // Le logo est pose a nu : on mesure l'image elle-meme, c'est elle qui
          // ferme la colonne.
          const tf = q('img').filter(i => (i.alt||'') === 'Taxi Food').sort((a,b) => b.width - a.width)[0];
          const qr = q('img').find(i => (i.alt||'').includes('Scannez'));
          const se = q('div').find(d => d.style.lineHeight === '1.26');
          const B = e => Math.round(e.getBoundingClientRect().bottom);
          const R = e => { const r = e.getBoundingClientRect();
                           return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
          return {promo: B(pr), gp: B(gp), tf: B(tf), tf_w: Math.round(tf.getBoundingClientRect().width),
                  qr: qr ? 'PRESENT' : 'absent',
                  sec_h: Math.round(se.getBoundingClientRect().height), sec: R(se), corps: R(document.body)};
        }""")
        await pg.screenshot(path=fichier, clip={'x': 0, 'y': 0, 'width': 1080, 'height': h})
        await b.close()

    # Le bas de colonne est desormais le LOGO TAXI FOOD, pas Google Play : les
    # badges sont remontes et le logo est passe dessous.
    ecart = v['promo'] - v['tf']
    lignes = round(v['sec_h'] / (25 * 1.26))
    air = air_badge(masque_assiettes(cfg['scene'], 1080, ph), bx + bd / 2, by + bd / 2, bd / 2)
    deborde = v['corps'][2] > 1080 or v['corps'][3] > h
    marge = round(bd * 0.057)
    dans_bois = (bx - marge >= BOIS['x0'] and bx + bd + marge <= BOIS['x1']
                 and by - marge >= BOIS['y0'] and by + bd + marge <= BOIS['y1'])
    sec_ok = v['sec'][2] <= 1080 - 62 - 190 - 34 + 1

    ok = (ecart == 0 and lignes == 2 and air >= AIR_MINI and not deborde
          and dans_bois and sec_ok and v['qr'] == 'absent')
    print(fichier)
    print('  pastille (remise)          : d=%d en (%d, %d)' % (bd, bx, by))
    print('  QR code                    : %s      (attendu absent)' % v['qr'])
    print('  logo Taxi Food (detoure)   : %d px de large, bas a %d px' % (v['tf_w'], v['tf']))
    print('  badges remontes de          : %d px  (Google Play finit a %d)' % (v['tf'] - v['gp'], v['gp']))
    print('  ecart promo / logo Taxi Food : %+d px      (attendu 0)' % ecart)
    print('  ligne secondaire           : %d lignes   (attendu 2), bord droit a %d px (max %d)'
          % (lignes, v['sec'][2], 1080 - 62 - 190 - 34))
    print("  air jusqu'a la 1re assiette : %6.1f px   (mini %.0f)" % (air, AIR_MINI))
    print('  pastille dans le bois      : %s  (marge de rotation %d px)' % ('oui' if dans_bois else 'NON', marge))
    print('  debord du cadre            : %s' % ('OUI' if deborde else 'non'))
    print('  ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
    return ok


if __name__ == '__main__':
    asyncio.run(rendre(*sys.argv[1:]))
