# -*- coding: utf-8 -*-
"""Rend la carte verticale 9:16 et la verifie. Quatre controles, aucun a l'oeil.

La serie TikTok a une contrainte que les deux autres n'ont pas : l'interface du
telephone recouvre les bords. Un texte qui deborde de 20 px n'est pas « un peu
serre », il est SOUS le pseudo et la legende. On mesure donc la boite reelle du
contenu dans le DOM, pas la boite theorique.

  1. le contenu tient dans la zone sure   x 86..940, y 200..1586
  2. le plat ne monte pas au-dessus de y = 200 (sinon la barre de recherche)
  3. >= 20 px d'air entre la croute et la pastille, mesures sur l'alpha du PNG
  4. le cadre fait exactement 1080 x 1920
"""
import asyncio, importlib.util, json, os, sys
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
TRAVAIL = os.path.abspath(os.environ.get('TF_TRAVAIL', D))
os.chdir(TRAVAIL)
from mesure import standalone

spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

AIR_MINI = 20.0
S = g.TT_SAFE


def place(detour):
    """Ou poser le plat : la serie decide, pas le plat."""
    bbox = json.load(open(detour.rsplit('.', 1)[0] + '.json'))['bbox']
    return g.debord_boite(bbox, g.SERIE_TIKTOK)


def air_badge(detour, pas=4):
    """Distance reelle croute <-> pastille, lue sur l'alpha. Un cercle equivalent
    se trompe de 100 px des que le plat n'est pas rond."""
    pos = place(detour)
    im = Image.open(detour).convert('RGBA')
    ech = pos['width'] / im.width
    al = np.asarray(im.resize((max(1, round(im.width*ech/pas)),
                               max(1, round(im.height*ech/pas))), Image.BILINEAR))[:, :, 3]
    ys, xs = np.nonzero(al > 96)
    X = pos['left'] + xs*pas; Y = pos['top'] + ys*pas
    b = g.TT_BADGE
    d = np.hypot(X - (b['x']+b['d']/2), Y - (b['y']+b['d']/2)).min() - b['d']/2
    return round(float(d), 1), round(float(Y.min()), 1)


async def rendre(slug, detour, titre, secondaire, prix, lieu, logo, sortie=None):
    from playwright.async_api import async_playwright
    sortie = sortie or f'VERT-{slug}.png'
    pos = place(detour)
    open(f'tt-{slug}.dc.html', 'w').write(
        g.visuel_tiktok(titre=titre, secondaire=secondaire, prix=prix,
                        ligne_lieu=lieu, logo=logo,
                        plat=dict(img=detour, **pos),
                        fond=g.FONDS[g.SERIE_TIKTOK['fond']],
                        badge=g.SERIE_TIKTOK['badge']))
    open(f'sa-tt-{slug}.html', 'w').write(standalone(f'tt-{slug}.dc.html'))

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': g.TT_W, 'height': g.TT_H}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-tt-{slug}.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        # La colonne de texte est le seul bloc qui puisse deborder : le plat et la
        # bande DOIVENT toucher les bords. On mesure donc chaque enfant de la
        # colonne, pas le corps entier.
        v = await pg.evaluate("""() => {
          const col = [...document.querySelectorAll('div')]
            .find(d => d.style.flexDirection === 'column' && d.style.position === 'absolute'
                       && d.style.alignItems === 'flex-start');
          const els = [col, ...col.querySelectorAll('*')];
          let L=1e9, R=-1e9, T=1e9, B=-1e9;
          for (const e of els) { const r = e.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
          return {L:Math.round(L), R:Math.round(R), T:Math.round(T), B:Math.round(B),
                  w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x': 0, 'y': 0, 'width': g.TT_W, 'height': g.TT_H})
        await b.close()

    ab, plat_haut = air_badge(detour)
    zone   = v['L'] >= S['x0'] and v['R'] <= S['x1'] and v['B'] <= S['y1']
    sommet = plat_haut >= S['y0']
    cadre  = v['w'] == g.TT_W and v['h'] == g.TT_H
    ok = zone and sommet and ab >= AIR_MINI and cadre

    print(f"{sortie}")
    print(f"  contenu gauche {v['L']:4d}/{S['x0']:<4d} droite {v['R']:4d}/{S['x1']:<4d} bas {v['B']:4d}/{S['y1']}")
    print(f"  sommet du plat {plat_haut:6.1f}   (mini {S['y0']})")
    print(f"  air croute <-> pastille {ab:6.1f} px   (mini {AIR_MINI})")
    print(f"  cadre {v['w']} x {v['h']}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok


ORIENTAL = dict(
    slug='oriental', detour='det-oriental.png', titre='Oriental',
    secondaire='Merguez, viande hachée, poivron, œuf', prix='31 000 Ar',
    lieu='Chez Bidul &amp; Truc · au feu de bois · le soir, 7 j/7', logo='bidul.jpg')

if __name__ == '__main__':
    asyncio.run(rendre(**ORIENTAL))
