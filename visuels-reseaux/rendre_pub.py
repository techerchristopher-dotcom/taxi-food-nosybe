# -*- coding: utf-8 -*-
"""Rend le visuel pub et le verifie. Quatre controles, aucun a l'oeil :

  1. bas du badge Google Play == bas du bloc promo   (regle de charte)
  2. la ligne secondaire tient sur le nombre de lignes prevu
  3. la pastille d'annonce ne mord sur AUCUN objet de la scene
     -> mesure sur la carte d'occupation reelle de la photo, pas estimee
  4. rien ne deborde du cadre
"""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
TRAVAIL = os.path.abspath(os.environ.get('TF_TRAVAIL', D))
os.chdir(TRAVAIL)
from mesure import standalone
import pub_milkshake as P

AIR_MINI = 20.0


def occupation(scene, larg, haut, seuil=6.0):
    """Carte booleenne des pixels « occupes » de la scene, a la taille ou elle
    est posee dans le visuel. Un fond en degrade lisse a un ecart-type local
    quasi nul ; un gobelet, un fruit, une eclaboussure, non."""
    im = Image.open(scene).convert('RGB').resize((larg, haut), Image.LANCZOS)
    gris = np.asarray(im).astype(float).mean(2)
    moy = ndimage.uniform_filter(gris, 25)
    ecart = np.sqrt(np.maximum(ndimage.uniform_filter(gris*gris, 25) - moy*moy, 0))
    return ecart > seuil


def air_badge(occ, cx, cy, r):
    """Distance minimale entre le bord du cercle et le premier pixel occupe.
    Negative = la pastille mord sur la scene."""
    ys, xs = np.nonzero(occ)
    if not len(xs):
        return 999.0
    return float(np.hypot(xs - cx, ys - cy).min() - r)


async def rendre(fichier='pub-milkshakes-lacabane.png'):
    from playwright.async_api import async_playwright
    cfg = dict(P.MILKSHAKES)
    # La bande vaut ce que le contenu demande, pas 500 par principe : la ligne
    # secondaire fait DEUX lignes ici (huit parfums), le bloc promo descend, la
    # colonne suit. Mesure : 594 px. La photo prend le reste, et scene.png est
    # deja recadree a cette hauteur exacte — object-fit n'a donc rien a couper.
    h, red = 1350, 594
    ph = h - red - P.FILET
    bd, bx, by = 235, 800, 470

    open('pub.dc.html', 'w').write(P.pub(h=h, red=red, badge=(bd, bx, by), h_col=505, **cfg))
    open('sa-pub.html', 'w').write(standalone('pub.dc.html'))

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': h}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath("sa-pub.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        v = await pg.evaluate("""() => {
          const q = s => [...document.querySelectorAll(s)];
          const cands = q('div').filter(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
          const pr = cands.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
          const gp = q('img').find(i => (i.alt||'').includes('Google Play'));
          const se = q('div').find(d => d.style.lineHeight === '1.26');
          const B = e => Math.round(e.getBoundingClientRect().bottom);
          const R = e => { const r = e.getBoundingClientRect();
                           return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
          return {promo: B(pr), gp: B(gp), sec_h: Math.round(se.getBoundingClientRect().height),
                  sec: R(se), corps: R(document.body)};
        }""")
        await pg.screenshot(path=fichier, clip={'x': 0, 'y': 0, 'width': 1080, 'height': h})
        await b.close()

    ecart = v['promo'] - v['gp']
    lignes = round(v['sec_h'] / (25 * 1.26))
    occ = occupation(cfg['scene'], 1080, ph)
    air = air_badge(occ, bx + bd/2, by + bd/2, bd/2)
    deborde = v['corps'][2] > 1080 or v['corps'][3] > h

    ok = (ecart == 0) and (lignes == 2) and (air >= AIR_MINI) and not deborde
    print(f"{fichier}")
    print(f"  ecart promo/Google Play : {ecart:+d} px      (attendu 0)")
    print(f"  ligne secondaire        : {lignes} lignes    (attendu 2)")
    print(f"  air autour de la pastille : {air:6.1f} px   (mini {AIR_MINI})")
    print(f"  debord du cadre         : {'OUI' if deborde else 'non'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok


if __name__ == '__main__':
    asyncio.run(rendre(*sys.argv[1:]))
