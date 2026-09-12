# -*- coding: utf-8 -*-
"""Rend la carte 9:16 sur decor et la verifie. Cinq controles, aucun a l'oeil.

  1. le contenu tient dans la zone sure TikTok   x 86..940, y 200..1586
  2. le contenu ne descend PAS sur le produit    bas <= TT_DECOR_BAS
  3. le cadre fait exactement 1080 x 1920
  4. le contraste reel du blanc sur ce qui est derriere, mesure sur le PNG rendu
  5. le bandeau laisse voir le decor (il n'est pas devenu opaque par accident)
"""
import asyncio, importlib.util, os, sys
import numpy as np
from PIL import Image

D = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, D)
from mesure import standalone
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
S = g.TT_SAFE


def _lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)


def _L(rgb):
    return 0.2126*_lin(rgb[...,0]) + 0.7152*_lin(rgb[...,1]) + 0.0722*_lin(rgb[...,2])


async def rendre(slug, decor, titre, secondaire, prix, lieu, logo, sortie=None):
    from playwright.async_api import async_playwright
    sortie = sortie or f'DECOR-{slug}.png'
    open(f'dec-{slug}.dc.html', 'w').write(
        g.visuel_tiktok_decor(titre=titre, secondaire=secondaire, prix=prix,
                              ligne_lieu=lieu, logo=logo, decor=decor,
                              badge=g.SERIE_TIKTOK['badge']))
    open(f'sa-dec-{slug}.html', 'w').write(standalone(f'dec-{slug}.dc.html'))
    async with async_playwright() as pw:
        b  = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': g.TT_W, 'height': g.TT_H}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-dec-{slug}.html")}', wait_until='load')
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const col = [...document.querySelectorAll('div')]
            .find(d => d.style.flexDirection === 'column' && d.style.position === 'absolute'
                       && d.style.alignItems === 'flex-start');
          const els = [col, ...col.querySelectorAll('*')];
          let L=1e9,R=-1e9,T=1e9,B=-1e9;
          for (const e of els) { const r = e.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            L=Math.min(L,r.left); R=Math.max(R,r.right); T=Math.min(T,r.top); B=Math.max(B,r.bottom); }
          const bande = document.getElementById('tt-bande');
          const past  = document.getElementById('tt-pastille');
          return {L:Math.round(L),R:Math.round(R),T:Math.round(T),B:Math.round(B),
                  bande: Math.round(bande.getBoundingClientRect().bottom),
                  past:  Math.round(past.getBoundingClientRect().bottom),
                  w:document.documentElement.scrollWidth, h:document.documentElement.scrollHeight};
        }""")
        await pg.screenshot(path=sortie, clip={'x':0,'y':0,'width':g.TT_W,'height':g.TT_H})
        await b.close()

    a = np.asarray(Image.open(sortie).convert('RGB')).astype(float)

    # 4. contraste : on lit le fond REEL sous la colonne, en excluant le texte
    #    lui-meme (les pixels tres clairs) et le badge.
    fen = a[v['T']:v['B'], v['L']:v['R']]
    lum = _L(fen)
    fond = lum[lum < np.percentile(lum, 70)]          # les 70 % les plus sombres = le bandeau
    c_med = float(1.05/(np.median(fond)+0.05))
    c_p95 = float(1.05/(np.percentile(fond, 95)+0.05))

    # 5. le bandeau laisse-t-il passer le decor ? Un aplat pur aurait un
    #    ecart-type quasi nul ; on veut voir la structure du four au travers.
    bande = a[max(210, v['T']+10):v['bande']-10, 60:1020]
    var = float(bande.reshape(-1,3).std(0).mean())

    zone   = v['L'] >= S['x0'] and v['R'] <= S['x1'] and v['B'] <= S['y1'] and v['T'] >= S['y0']
    produit= v['bande'] <= 945 - 40 and v['past'] <= 945 + 30
    cadre  = v['w'] == g.TT_W and v['h'] == g.TT_H
    contr  = c_p95 >= 4.20                            # >= le rouge opaque des 13 carres
    trans  = var >= 6.0
    ok = zone and produit and cadre and contr and trans

    print(f"{sortie}")
    print(f"  1 zone sure     gauche {v['L']:4d}/{S['x0']:<4d} droite {v['R']:4d}/{S['x1']:<4d} "
          f"haut {v['T']:4d}/{S['y0']:<4d} bas {v['B']:4d}/{S['y1']:<4d}  {'ok' if zone else 'NON'}")
    print(f"  2 produit libre bandeau {v['bande']:4d} (filet) | pastille {v['past']:4d} | croute 945   {'ok' if produit else 'NON'}")
    print(f"    air texte->filet {v['bande']-v['B']:4d} px   rouge vide au-dessus {v['T']:4d} px")
    print(f"  3 cadre         {v['w']} x {v['h']}                                {'ok' if cadre else 'NON'}")
    print(f"  4 contraste     blanc/fond  mediane {c_med:.2f}:1   p95 {c_p95:.2f}:1  "
          f"(rouge opaque = 4,24)   {'ok' if contr else 'NON'}")
    print(f"  5 transparence  ecart-type sous le bandeau {var:.1f}  (aplat = 0)         {'ok' if trans else 'NON'}")
    print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
    return ok


if __name__ == '__main__':
    from tiktok import plat
    p = plat(sys.argv[1] if len(sys.argv) > 1 else 'reine')
    asyncio.run(rendre(slug=p['slug'], decor=sys.argv[2], titre=p['titre'],
                       secondaire=p['secondaire'], prix=p['prix'],
                       lieu=p['lieu'], logo=p['logo']))
