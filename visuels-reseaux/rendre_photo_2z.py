# -*- coding: utf-8 -*-
"""Rend la pub deux zones et la verifie. Cinq controles, dont un nouveau :
le texte doit se poser sur du FOND, jamais sur le produit."""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from mesure import standalone
sp = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(sp); sp.loader.exec_module(g)


def _lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)


def _L(x):
    return 0.2126*_lin(x[...,0]) + 0.7152*_lin(x[...,1]) + 0.0722*_lin(x[...,2])


def masque_fond(photo, larg, haut, tol=26):
    """Le fond de la photo : l'aplat de couleur, hors produit."""
    a = np.asarray(Image.open(photo).convert('RGB').resize((larg, haut), Image.LANCZOS)).astype(float)
    bord = np.concatenate([a[:40].reshape(-1,3), a[-40:].reshape(-1,3),
                           a[:, :40].reshape(-1,3), a[:, -40:].reshape(-1,3)])
    coul = np.median(bord, 0)
    m = np.abs(a - coul).mean(2) < tol
    return nd.binary_opening(m, np.ones((7,7))), coul


async def rendre(nom, photo, larg=1350, haut=1800, sortie=None, **kw):
    from playwright.async_api import async_playwright
    sortie = sortie or f'PUB-{nom}.png'
    open(f'pd-{nom}.dc.html', 'w').write(
        g.visuel_photo_deux_zones(photo=photo, larg=larg, haut=haut, **kw))
    open(f'sa-pd-{nom}.html', 'w').write(standalone(f'pd-{nom}.dc.html'))
    async with async_playwright() as pw:
        b  = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': larg, 'height': haut}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-pd-{nom}.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        v = await pg.evaluate("""() => {
          const bx = id => { const c = document.getElementById(id);
            const els = [c, ...c.querySelectorAll('*')];
            let L=1e9,R=-1e9,T=1e9,B=-1e9;
            for (const e of els) { const r = e.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) continue;
              L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
            return {L:Math.round(L),R:Math.round(R),T:Math.round(T),B:Math.round(B)}; };
          return {haut: bx('pd-haut'), bas: bx('pd-bas'),
                  w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x':0,'y':0,'width':larg,'height':haut})
        await b.close()

    fond, coul = masque_fond(photo, larg, haut)
    a = np.asarray(Image.open(sortie).convert('RGB')).astype(float)
    M = g.PD_MARGE
    res = {}
    for cle in ('haut','bas'):
        z = v[cle]
        libre = float(fond[z['T']:z['B'], z['L']:z['R']].mean())
        fen = a[z['T']:z['B'], z['L']:z['R']]
        lum = _L(fen); clair = lum[lum > np.percentile(lum, 40)]   # le fond, pas l'encre
        res[cle] = (libre, float((np.median(clair)+0.05)/0.05))

    marges = all(v[c]['L'] >= M-2 and v[c]['R'] <= larg-M+2 for c in ('haut','bas')) \
             and v['haut']['T'] >= M-4 and v['bas']['B'] <= haut-M+2
    propre = res['haut'][0] >= 0.90 and res['bas'][0] >= 0.90
    cadre  = v['w'] == larg and v['h'] == haut
    contr  = min(res['haut'][1], res['bas'][1]) >= 4.50
    ok = marges and propre and cadre and contr

    print(f"{sortie}   fond mesure RGB {coul[0]:.0f} {coul[1]:.0f} {coul[2]:.0f}")
    print(f"  1 marges      haut {v['haut']['L']}..{v['haut']['R']}  bas {v['bas']['L']}..{v['bas']['R']}  "
          f"/ {M}..{larg-M}   bas du bloc {v['bas']['B']}/{haut-M}   {'ok' if marges else 'NON'}")
    print(f"  2 texte sur FOND   haut {100*res['haut'][0]:.0f} %   bas {100*res['bas'][0]:.0f} %   (mini 90 %)   {'ok' if propre else 'NON'}")
    print(f"  3 cadre       {v['w']} x {v['h']}                                  {'ok' if cadre else 'NON'}")
    print(f"  4 contraste   noir/fond  haut {res['haut'][1]:.2f}:1   bas {res['bas'][1]:.2f}:1   (mini 4,50)   {'ok' if contr else 'NON'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok
