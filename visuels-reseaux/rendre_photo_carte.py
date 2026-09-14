# -*- coding: utf-8 -*-
"""Rend la pub « carte » et la verifie. Six controles.

Le controle qui compte ici n est pas la marge : c est que la bande ne mange
rien de ce que la photo doit montrer. La bouche, le burger et le tatouage ont
chacun leur boite en coordonnees SOURCE ; le rendu les reprojette et exige une
garde. Une bande trop haute est donc refusee, pas rattrapee a l oeil.
"""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from mesure import standalone
sp = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(sp); sp.loader.exec_module(g)

# Boites mesurees sur la source 4096 x 4096 (voir le journal du tatouage).
ESSENTIEL = {
    'bouche':   (1500, 520, 2750, 1400),
    'burger':   ( 280, 700, 2400, 2500),
    'tatouage': (2484, 2916, 3105, 3546),
}


def _lin(c):
    c = np.asarray(c, float) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def _L(x):
    return 0.2126*_lin(x[..., 0]) + 0.7152*_lin(x[..., 1]) + 0.0722*_lin(x[..., 2])


def _contraste(a, b):
    a, b = sorted((float(a), float(b)))
    return (b + 0.05) / (a + 0.05)


def projeter(boite, src_w, src_h, larg, ph_h):
    """object-fit: cover + object-position: 50% 0%  ->  meme transformation ici."""
    s = max(larg / src_w, ph_h / src_h)
    dx = (src_w * s - larg) / 2.0          # 50 % : recadrage horizontal centre
    dy = 0.0                               #  0 % : cale en haut
    x0, y0, x1, y1 = boite
    return (x0*s - dx, y0*s - dy, x1*s - dx, y1*s - dy)


async def rendre(nom, photo, larg=1350, haut=1800, sortie=None, garde=100, **kw):
    from playwright.async_api import async_playwright
    sortie = sortie or f'PUB-{nom}.png'
    bande = kw.get('bande', g.BC_BANDE)
    ph_h  = haut - bande
    open(f'pc-{nom}.dc.html', 'w').write(
        g.visuel_photo_carte(photo=photo, larg=larg, haut=haut, **kw))
    open(f'sa-pc-{nom}.html', 'w').write(standalone(f'pc-{nom}.dc.html'))

    async with async_playwright() as pw:
        b  = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': larg, 'height': haut}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-pc-{nom}.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        v = await pg.evaluate("""() => {
          const bx = id => { const c = document.getElementById(id);
            const els = [c, ...c.querySelectorAll('*')];
            let L=1e9,R=-1e9,T=1e9,B=-1e9;
            for (const e of els) { const r = e.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) continue;
              L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
            return {L:Math.round(L),R:Math.round(R),T:Math.round(T),B:Math.round(B)}; };
          return {col: bx('bc-col'), droite: bx('bc-droite'),
                  w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x': 0, 'y': 0, 'width': larg, 'height': haut})
        await b.close()

    a  = np.asarray(Image.open(sortie).convert('RGB')).astype(float)
    PV, PH = g.BC_PAD_V, g.BC_PAD_H

    # 1 — cadre exact
    cadre = (v['w'] == larg and v['h'] == haut and a.shape[:2] == (haut, larg))

    # 2 — les deux colonnes dans la bande, sans se croiser
    dedans = all(v[c]['L'] >= PH - 2 and v[c]['R'] <= larg - PH + 2
                 and v[c]['T'] >= ph_h + PV - 4 and v[c]['B'] <= haut - PV + 2
                 for c in ('col', 'droite'))
    ecart  = v['droite']['L'] - v['col']['R']
    sepa   = ecart >= 40

    # 3 — contraste encre / bande, mesure sur le rendu
    res = {}
    for cle in ('col', 'droite'):
        z = v[cle]
        fen = a[z['T']:z['B'], z['L']:z['R']]
        lum = _L(fen)
        res[cle] = _contraste(np.percentile(lum, 12), np.percentile(lum, 88))
    contr = min(res.values()) >= 4.50

    # 4 — la bande ne mange rien d essentiel
    sw, sh = Image.open(photo).size
    gardes = {}
    for k, boite in ESSENTIEL.items():
        _, _, _, y1 = projeter(boite, sw, sh, larg, ph_h)
        gardes[k] = ph_h - y1
    intact = min(gardes.values()) >= garde

    # 5 — la bande fait bien la hauteur annoncee et sa couleur est celle voulue
    gout = [a[haut - PV + 10: haut - 8, 8: larg - 8].reshape(-1, 3),   # sous les colonnes
            a[ph_h + 8: haut - 8, 8: PH - 12].reshape(-1, 3)]           # gouttiere gauche
    coul = np.concatenate(gout)
    attendu = np.array([int(g.BC_ORANGE[i:i+2], 16) for i in (1, 3, 5)], float)
    teinte = float(np.abs(coul.mean(0) - attendu).max()) < 3.0

    ok = cadre and dedans and sepa and contr and intact and teinte
    print(f'{sortie}')
    print(f"  1 cadre        {v['w']} x {v['h']}                                     {'ok' if cadre else 'NON'}")
    print(f"  2 bande        colonnes {v['col']['L']}..{v['col']['R']} | {v['droite']['L']}..{v['droite']['R']}   "
          f"bas {max(v['col']['B'], v['droite']['B'])}/{haut-PV}                {'ok' if dedans else 'NON'}")
    print(f"  3 separation   {ecart} px entre colonnes (mini 40)                {'ok' if sepa else 'NON'}")
    print(f"  4 contraste    gauche {res['col']:.2f}:1   droite {res['droite']:.2f}:1   (mini 4,50)  "
          f"{'ok' if contr else 'NON'}")
    print('  5 photo intacte ' + '   '.join(f'{k} +{gardes[k]:.0f}' for k in ESSENTIEL)
          + f'  px au-dessus de la bande (mini {garde})   ' + ('ok' if intact else 'NON'))
    print(f"  6 teinte bande RGB {coul.mean(0)[0]:.0f} {coul.mean(0)[1]:.0f} {coul.mean(0)[2]:.0f} "
          f"vs {g.BC_ORANGE}                       {'ok' if teinte else 'NON'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok


if __name__ == '__main__':
    asyncio.run(rendre(
        'cabane-editorial', 'photo-tf-tatoo.jpg',
        titre='Burger Tenders',
        secondaire='Poulet pané maison, cheddar, salade &nbsp;·&nbsp; frites incluses',
        prix='35 000 Ar',
        ligne_lieu='La Cabane &nbsp;·&nbsp; Ambatoloaka',
        logo='cabane.png'))
