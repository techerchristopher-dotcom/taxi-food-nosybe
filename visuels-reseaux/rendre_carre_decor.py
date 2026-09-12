# -*- coding: utf-8 -*-
"""Rend la carte carree 1080x1080 sur decor, et la verifie. Cinq controles."""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from mesure import standalone
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)


def _lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)


def _L(x):
    return 0.2126*_lin(x[...,0]) + 0.7152*_lin(x[...,1]) + 0.0722*_lin(x[...,2])


async def rendre(slug, decor, titre, secondaire, prix, lieu, logo, produit_haut=522, sortie=None):
    from playwright.async_api import async_playwright
    sortie = sortie or f'CARRE-{slug}.png'
    open(f'car-{slug}.dc.html', 'w').write(
        g.visuel_carre_decor(titre=titre, secondaire=secondaire, prix=prix,
                             ligne_lieu=lieu, logo=logo, decor=decor,
                             produit_haut=produit_haut, badge='remise'))
    open(f'sa-car-{slug}.html', 'w').write(standalone(f'car-{slug}.dc.html'))
    async with async_playwright() as pw:
        b  = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': g.CA_W, 'height': g.CA_H}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-car-{slug}.html")}', wait_until='load')
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const boite = (el) => { const r = el.getBoundingClientRect();
            return {L:r.left, R:r.right, T:r.top, B:r.bottom}; };
          const parts = ['ca-col','ca-droite'].map(i => document.getElementById(i))
            .flatMap(c => [c, ...c.querySelectorAll('*')])
            ;
          let L=1e9,R=-1e9,T=1e9,B=-1e9;
          for (const e of parts) { const r = e.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
          return {L:Math.round(L),R:Math.round(R),T:Math.round(T),B:Math.round(B),
                  bande: Math.round(document.getElementById('ca-bande').getBoundingClientRect().bottom),
                  w:document.documentElement.scrollWidth, h:document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x':0,'y':0,'width':g.CA_W,'height':g.CA_H})
        await b.close()

    a = np.asarray(Image.open(sortie).convert('RGB')).astype(float)
    fen  = a[v['T']:v['B'], v['L']:v['R']]
    lum  = _L(fen); fond = lum[lum < np.percentile(lum, 70)]
    c_med = float(1.05/(np.median(fond)+0.05)); c_p95 = float(1.05/(np.percentile(fond,95)+0.05))
    var  = float(a[max(30,v['T']+10):v['bande']-10, 40:1040].reshape(-1,3).std(0).mean())

    marge  = v['L'] >= g.CA_PAD-2 and v['R'] <= g.CA_W-g.CA_PAD+2 and v['T'] >= g.CA_COL_Y-2
    produit= v['bande'] <= produit_haut - 20 and v['B'] <= v['bande'] - 8
    cadre  = v['w'] == g.CA_W and v['h'] == g.CA_H
    contr  = c_p95 >= 4.20
    trans  = var >= 6.0
    ok = marge and produit and cadre and contr and trans

    print(f"{sortie}")
    print(f"  1 marges        gauche {v['L']:4d}/{g.CA_PAD:<4d} droite {v['R']:4d}/{g.CA_W-g.CA_PAD:<4d} "
          f"haut {v['T']:4d}/{g.CA_COL_Y:<4d}   {'ok' if marge else 'NON'}")
    print(f"  2 produit libre bandeau {v['bande']:4d}  texte {v['B']:4d}  croute {produit_haut}          {'ok' if produit else 'NON'}")
    print(f"    air texte->filet {v['bande']-v['B']:4d} px   air filet->croute {produit_haut-v['bande']:4d} px")
    print(f"  3 cadre         {v['w']} x {v['h']}                                {'ok' if cadre else 'NON'}")
    print(f"  4 contraste     mediane {c_med:.2f}:1   p95 {c_p95:.2f}:1  (rouge opaque = 4,24)   {'ok' if contr else 'NON'}")
    print(f"  5 transparence  ecart-type {var:.1f}                              {'ok' if trans else 'NON'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok


if __name__ == '__main__':
    from tiktok import plat
    p = plat(sys.argv[1] if len(sys.argv) > 1 else 'reine')
    asyncio.run(rendre(slug=p['slug'], decor=sys.argv[2], titre=p['titre'],
                       secondaire=p['secondaire'], prix=p['prix'],
                       lieu=p['lieu'], logo=p['logo']))
