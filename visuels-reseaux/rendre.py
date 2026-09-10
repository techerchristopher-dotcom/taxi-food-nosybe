# -*- coding: utf-8 -*-
"""Rend les visuels produit en variante debord, et les verifie.

Aucun reglage au cas par cas : le placement est celui de la serie
(gabarit.debord_serie). Trois controles automatiques a chaque rendu :
  1. bas du badge Google Play == bas du bloc promo
  2. la ligne secondaire tient sur UNE ligne
  3. >= 20 px d'air entre la croute et la pastille, et entre la croute et le QR
"""
import asyncio, importlib.util, json, os, sys
import numpy as np
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
# Dossier de travail : la ou vivent les det-<slug>.png/.json et ou tombent les
# rendus. Par defaut le dossier du script ; TF_TRAVAIL le deplace sans rien
# toucher au code (les photos sources pesent des Mo, elles ne sont pas versionnees).
TRAVAIL = os.path.abspath(os.environ.get('TF_TRAVAIL', D))
TMP = os.path.join(TRAVAIL, '_travail'); os.makedirs(TMP, exist_ok=True)
os.chdir(TRAVAIL)
from plats import PLATS

spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
AIR_MINI = 20.0
PASTILLE = (g.PAD_H + g.LOGO_D/2, g.PHOTO_H - round(g.LOGO_D*0.52) + g.LOGO_D/2)
QR_X, QR_Y = 828, 608          # bord gauche et haut du bloc QR


def cadre(p):
    return json.load(open(p['detour'].rsplit('.', 1)[0] + '.json'))['bbox']


def place(p):
    return g.debord_boite(cadre(p), getattr(g, 'SERIE_' + p['serie']))


def air(p, pas=4):
    """Air reelle, mesuree sur le masque du plat — pas sur un cercle equivalent.

    Le cercle marchait pour huit pizzas rondes. Un panini de 1,95:1 n'est pas un
    cercle : approximer, c'est se mentir de 100 px. On lit donc l'alpha du PNG
    detoure, on le place, et on mesure la vraie distance.
    """
    pos = place(p)
    im = Image.open(p['detour']).convert('RGBA')
    ech = pos['width'] / im.width
    al = np.asarray(im.resize((max(1, round(im.width*ech/pas)),
                               max(1, round(im.height*ech/pas))), Image.BILINEAR))[:, :, 3]
    ys, xs = np.nonzero(al > 96)
    X = pos['left'] + xs*pas; Y = pos['top'] + ys*pas
    a_logo = np.hypot(X-PASTILLE[0], Y-PASTILLE[1]).min() - g.LOGO_D/2
    sous_qr = Y >= QR_Y
    a_qr = (QR_X - X[sous_qr]).min() if sous_qr.any() else 999.0
    return round(float(a_logo), 1), round(float(a_qr), 1)


def html(slug, web=False):
    p = PLATS[slug]
    return g.visuel(photo=None, alt=p['titre'], titre=p['titre'],
                    secondaire=p['secondaire'], prix=p['prix'],
                    ligne_lieu=p['lieu'], logo=p['logo'], h=1080,
                    plat=dict(img=p['detour_web'] if web else p['detour'], **place(p)))


async def rendre(slugs):
    from mesure import standalone
    from playwright.async_api import async_playwright
    rates = []
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': 1080}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        for slug in slugs:
            p = PLATS[slug]
            open(f'BT_{slug}.dc.html', 'w').write(html(slug, web=True))   # pour le canvas
            open(f'{TMP}/{slug}-hd.dc.html', 'w').write(html(slug))        # pour l'export
            open(f'{TMP}/sa-{slug}.html', 'w').write(standalone(f'{TMP}/{slug}-hd.dc.html'))
            await pg.goto(f'file://{TMP}/sa-{slug}.html', wait_until='load')
            await pg.wait_for_timeout(450)
            v = await pg.evaluate("""() => {
              const q=s=>[...document.querySelectorAll(s)];
              const pr=q('div').find(d=>d.textContent.trim().startsWith('1re commande')&&d.style.borderRadius);
              const gp=q('img').find(i=>(i.alt||'').includes('Google Play'));
              const se=q('div').find(d=>d.style.lineHeight==='1.26');
              const B=e=>Math.round(e.getBoundingClientRect().bottom);
              return [B(pr), B(gp), Math.round(se.getBoundingClientRect().height)];
            }""")
            await pg.screenshot(path=p['fichier'], clip={'x':0,'y':0,'width':1080,'height':1080})
            ec, lignes = v[0]-v[1], (1 if v[2] < 45 else 2)
            al, aq = air(p)
            ok = ec == 0 and lignes == 1 and min(al, aq) >= AIR_MINI
            if not ok: rates.append(slug)
            print(f"{p['fichier']:16s} ecart {ec:3d}  secondaire {lignes} ligne"
                  f"  air {al:5.1f}/{aq:5.1f}  ->  {'CONFORME' if ok else 'A CORRIGER'}")
        await b.close()
    print(f"\n{len(slugs)-len(rates)}/{len(slugs)} conformes"
          + (f"  ·  a corriger : {', '.join(rates)}" if rates else ""))


if __name__ == '__main__':
    asyncio.run(rendre(sys.argv[1:] or list(PLATS)))
