# -*- coding: utf-8 -*-
"""Rend l'annonce de Chez M&K et la verifie. Sept controles, aucun a l'oeil."""
import asyncio, os, sys
import numpy as np
from PIL import Image
import pub_mk as P
import mk_scene_mosaique as M
from mesure import standalone

AIR_MINI = 20.0

def air_a_la_plaque(bx, by, bd):
    """La pastille tourne de -7 deg : elle occupe bd*1,115. On mesure l'air
    restant entre son carre englobant et les bords de la plaque."""
    o = round(bd*1.115)
    return min(bx - M.PLAQUE['x0'], M.PLAQUE['x1'] - (bx+o),
               by - M.PLAQUE['y0'], M.PLAQUE['y1'] - (by+o))

async def rendre(etat='bientot'):
    from playwright.async_api import async_playwright
    cfg = dict(P.MK_BIENTOT if etat == 'bientot' else P.MK_DISPONIBLE)
    fichier = 'PUB-mk-annonce-%s.png' % etat
    h, red = 1350, 594
    ph = h - red - P.FILET
    bd = M.BADGE_D; bx, by = M.BADGE

    open('pub-mk.dc.html', 'w').write(P.pub(h=h, red=red, badge=(bd, bx, by), h_col=505, **cfg))
    open('sa-pub-mk.html', 'w').write(standalone('pub-mk.dc.html'))

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': h}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto('file://' + os.path.abspath('sa-pub-mk.html'), wait_until='load')
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const q = s => [...document.querySelectorAll(s)];
          const c = q('div').filter(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
          const pr = c.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
          const gp = q('img').find(i => (i.alt||'').includes('Google Play'));
          const tf = q('img').filter(i => (i.alt||'') === 'Taxi Food').sort((a,b) => b.width - a.width)[0];
          const lg = q('img').find(i => (i.alt||'') === 'Logo');
          const se = q('div').find(d => d.style.lineHeight === '1.26');
          const ti = q('div').find(d => d.style.lineHeight === '0.98');
          const B = e => Math.round(e.getBoundingClientRect().bottom);
          const R = e => { const r = e.getBoundingClientRect();
                           return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
          return {promo: B(pr), gp: B(gp), tf: B(tf), logo: R(lg),
                  sec_h: Math.round(se.getBoundingClientRect().height), sec: R(se),
                  ti_h: Math.round(ti.getBoundingClientRect().height), ti: R(ti),
                  corps: R(document.body)};
        }""")
        await pg.screenshot(path=fichier, clip={'x': 0, 'y': 0, 'width': 1080, 'height': h})
        await b.close()

    a = np.asarray(Image.open(fichier).convert('RGB')).astype(np.float32)
    ecart = v['promo'] - v['tf']
    lignes = round(v['sec_h'] / (25 * 1.26))
    ti_lignes = round(v['ti_h'] / (68 * 0.98))
    air = air_a_la_plaque(bx, by, bd)
    deborde = v['corps'][2] > 1080 or v['corps'][3] > h
    sec_ok = v['sec'][2] <= 1080 - 62 - 190 - 34 + 1
    # Le sceau mord-il la bande rouge comme prevu (52 % au-dessus du filet) ?
    chevauche = round((v['logo'][3] - ph) / (v['logo'][3] - v['logo'][1]) * 100)
    logo_ok = 44 <= chevauche <= 52

    ok = (ecart == 0 and lignes == 2 and ti_lignes == 2 and air >= AIR_MINI
          and not deborde and sec_ok and logo_ok)
    print(fichier)
    print('  pastille promo             : d=%d en (%d, %d), dans la plaque' % (bd, bx, by))
    print("  air pastille / bord plaque : %6.1f px   (mini %.0f)" % (air, AIR_MINI))
    print('  sceau M&K pose a nu        : %d px, %d %% sous le filet   (attendu 44-52)'
          % (v['logo'][2]-v['logo'][0], chevauche))
    print('  logo Taxi Food (detoure)   : bas a %d px' % v['tf'])
    print('  ecart promo / logo Taxi Food : %+d px      (attendu 0)' % ecart)
    print('  titre                      : %d lignes   (attendu 2)' % ti_lignes)
    print('  ligne secondaire           : %d lignes   (attendu 2), bord droit a %d px (max %d)'
          % (lignes, v['sec'][2], 1080 - 62 - 190 - 34))
    print('  debord du cadre            : %s' % ('OUI' if deborde else 'non'))
    print('  ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
    return ok

if __name__ == '__main__':
    asyncio.run(rendre(*sys.argv[1:]))
