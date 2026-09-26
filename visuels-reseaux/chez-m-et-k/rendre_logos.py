# -*- coding: utf-8 -*-
"""Rend les deux sceaux et les controle. Sept mesures, aucune a l'oeil."""
import asyncio, os, json
import numpy as np
from PIL import Image

D = '/root/logos/mk'
C, RH = 500.0, 444.0
MARGE = 8.0          # air minimal entre un texte et le filet interieur

def lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def L(c): return float(lin(c) @ np.array([0.2126, 0.7152, 0.0722]))
def ratio(a, b):
    la, lb = L(a)+0.05, L(b)+0.05
    return max(la, lb)/min(la, lb)

async def rendre():
    from playwright.async_api import async_playwright
    res = {}
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        for v in 'AB':
            pg = await b.new_page(viewport={'width':1000,'height':1000}, device_scale_factor=2)
            await pg.goto('file://%s/sceau-%s.html' % (D, v), wait_until='load')
            await pg.wait_for_timeout(450)
            m = await pg.evaluate("""() => {
              const R = e => { const r = e.getBoundingClientRect();
                 // la boite d'un .tx fait toute la largeur : on mesure le TEXTE,
                 // pas le conteneur, sinon le controle du filet est faux.
                 const g = document.createRange(); g.selectNodeContents(e);
                 const t = g.getBoundingClientRect();
                 return {l:t.left, t:t.top, r:t.right, b:t.bottom, h:t.height}; };
              return {tx: [...document.querySelectorAll('.tx')].map(e =>
                        Object.assign(R(e), {txt: e.textContent.trim()})),
                      corps: (()=>{const r=document.body.getBoundingClientRect();
                              return [r.width, r.height];})()};
            }""")
            await pg.screenshot(path='%s/sceau-%s.png' % (D, v), omit_background=True)
            await pg.close()
            res[v] = m
        await b.close()
    return res

def controler(v, m):
    a = np.asarray(Image.open('%s/sceau-%s.png' % (D, v)).convert('RGBA')).astype(np.float32)
    px, al = a[..., :3], a[..., 3]
    n = px.shape[0]
    ok = True
    print('\nSCEAU %s' % v)

    # 1. chaque texte tient DANS le filet interieur
    for t in m['tx']:
        d = max(np.hypot(x-C, y-C) for x in (t['l'], t['r']) for y in (t['t'], t['b']))
        reste = RH - d
        bon = reste >= MARGE
        ok &= bon
        print('   %-30s largeur %4.0f px   air au filet %+6.1f px  %s'
              % ('"%s"' % t['txt'][:28], t['r']-t['l'], reste, 'ok' if bon else 'DEBORDE'))

    # 2. aucun chevauchement entre deux textes
    T = m['tx']
    for i in range(len(T)):
        for j in range(i+1, len(T)):
            A, B = T[i], T[j]
            ch = not (A['b'] <= B['t'] or B['b'] <= A['t'] or A['r'] <= B['l'] or B['r'] <= A['l'])
            if ch: ok = False
            print('   ecart vertical texte %d/%d        %+6.1f px            %s'
                  % (i+1, j+1, B['t']-A['b'], 'CHEVAUCHE' if ch else 'ok'))

    # 3. contraste reel mesure sur les pixels rendus
    opaque = al > 250
    lum = (px @ np.array([0.2126, 0.7152, 0.0722]))
    # Le percentile echouait sur B : un plateau de pixels a la luminance max
    # rendait le « > » vide. On prend donc les pixels les plus clairs PAR RANG,
    # ce qui ne depend d'aucun plateau.
    lo = lum[opaque]; po = px[opaque]
    k = max(200, int(len(lo)*0.004))
    idx = np.argsort(lo)
    clair = po[idx[-k:]].mean(0)
    sombre = po[idx[:max(200, int(len(lo)*0.25))]].mean(0)
    r_int = ratio(clair, sombre)
    ok &= r_int >= 7.0
    print('   or mesure  #%02X%02X%02X  sur fond #%02X%02X%02X   %5.2f:1   (mini 7,0)'
          % (*clair.astype(int), *sombre.astype(int), r_int))
    r_charte = ratio(sombre, (0xE8, 0x34, 0x2A))
    ok &= r_charte >= 3.0
    print('   fond du disque sur rouge charte #E8342A     %5.2f:1   (mini 3,0)' % r_charte)

    # 4. le disque ne deborde pas du cadre
    ys, xs = np.nonzero(al > 8)
    deb = xs.min() < 0 or ys.min() < 0 or xs.max() >= n or ys.max() >= n
    marge_px = min(xs.min(), ys.min(), n-1-xs.max(), n-1-ys.max())/2
    print('   marge du disque au bord du cadre            %5.1f px   %s'
          % (marge_px, 'ok' if not deb else 'DEBORD'))
    ok &= not deb

    # 5. lisibilite reduite : ce qui reste a 48 px
    p = Image.open('%s/sceau-%s.png' % (D, v)).convert('RGB')
    g48 = np.asarray(p.resize((48,48), Image.LANCZOS).convert('L')).astype(np.float32)
    gx, gy = np.gradient(g48)
    energie = float(np.hypot(gx, gy).mean())
    ok &= energie >= 6.0
    print('   energie de contour a 48 px                  %5.2f     (mini 6,0)' % energie)
    print('   ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
    return ok

if __name__ == '__main__':
    m = asyncio.run(rendre())
    tout = all([controler(v, m[v]) for v in 'AB'])
    print('\n%s' % ('LES DEUX SCEAUX SONT CONFORMES' if tout else 'AU MOINS UN SCEAU EST A CORRIGER'))
