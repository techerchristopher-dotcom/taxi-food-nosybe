# -*- coding: utf-8 -*-
"""Rend une pub posee sur une photo de scene, et la verifie. Cinq controles."""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from mesure import standalone
sp = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(sp); sp.loader.exec_module(g)


def _lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)


def _L(x):
    return 0.2126*_lin(x[...,0]) + 0.7152*_lin(x[...,1]) + 0.0722*_lin(x[...,2])


async def rendre(nom, photo, larg, haut, bas_sujet, sortie=None, **kw):
    from playwright.async_api import async_playwright
    sortie = sortie or f'PUB-{nom}.png'
    open(f'pp-{nom}.dc.html', 'w').write(
        g.visuel_photo_pub(photo=photo, larg=larg, haut=haut, bas_sujet=bas_sujet, **kw))
    open(f'sa-pp-{nom}.html', 'w').write(standalone(f'pp-{nom}.dc.html'))
    async with async_playwright() as pw:
        b  = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': larg, 'height': haut}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-pp-{nom}.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        v = await pg.evaluate("""() => {
          const bx = id => { const c = document.getElementById(id);
            const els = [c, ...c.querySelectorAll('*')];
            let L=1e9,R=-1e9,T=1e9,B=-1e9;
            for (const e of els) { const r = e.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) continue;
              L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
            return {L:Math.round(L),R:Math.round(R),T:Math.round(T),B:Math.round(B)}; };
          return {col: bx('pp-col'), logos: bx('pp-logos'),
                  w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x':0,'y':0,'width':larg,'height':haut})
        await b.close()

    a = np.asarray(Image.open(sortie).convert('RGB')).astype(float)
    c = v['col']
    fen = a[c['T']:c['B'], c['L']:c['R']]
    lum = _L(fen); fond = lum[lum < np.percentile(lum, 70)]
    c_med = float(1.05/(np.median(fond)+0.05)); c_pire = float(1.05/(fond.max()+0.05))

    M = g.PP_MARGE
    marges = c['L'] >= M-2 and c['R'] <= larg-M+2 and c['T'] >= g.PP_COL_Y-4 \
             and v['logos']['R'] <= larg-M+2 and v['logos']['B'] <= haut-M+2
    sujet  = c['B'] <= bas_sujet
    cadre  = v['w'] == larg and v['h'] == haut
    contr  = c_pire >= 4.50
    ok = marges and sujet and cadre and contr

    print(f"{sortie}")
    print(f"  1 marges     texte {c['L']}..{c['R']} / {M}..{larg-M}   logos droite {v['logos']['R']} bas {v['logos']['B']}   {'ok' if marges else 'NON'}")
    print(f"  2 sujet libre bas du texte {c['B']} <= {bas_sujet}                        {'ok' if sujet else 'NON'}")
    print(f"  3 cadre      {v['w']} x {v['h']}                                     {'ok' if cadre else 'NON'}")
    print(f"  4 contraste  blanc/fond  mediane {c_med:.2f}:1   PIRE {c_pire:.2f}:1  (rouge opaque 4,24)  {'ok' if contr else 'NON'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok
