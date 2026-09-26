# -*- coding: utf-8 -*-
"""Rend l'annonce des partenaires et la verifie. Huit controles, aucun a l'oeil."""
import asyncio, os, sys
import numpy as np
from PIL import Image
import pub_partenaires as P
from mesure import standalone

def lin(c):
    c = np.asarray(c, float)/255.0
    return np.where(c <= 0.04045, c/12.92, ((c+0.055)/1.055)**2.4)
def L(c): return float(lin(c) @ np.array([0.2126, 0.7152, 0.0722]))
def ratio(a, b):
    la, lb = L(a)+0.05, L(b)+0.05
    return max(la, lb)/min(la, lb)

async def rendre(fichier='PUB-partenaires-annonce.png'):
    from playwright.async_api import async_playwright
    h, red = 1350, 594
    ph = h - red - P.FILET
    open('pub-part.dc.html', 'w').write(P.pub(h=h, red=red, **P.PARTENAIRES))
    open('sa-pub-part.html', 'w').write(standalone('pub-part.dc.html'))
    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': 1080, 'height': h}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto('file://' + os.path.abspath('sa-pub-part.html'), wait_until='load')
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const q = s => [...document.querySelectorAll(s)];
          const R = e => { const r = e.getBoundingClientRect();
                           return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
          const T = e => { const g = document.createRange(); g.selectNodeContents(e);
                           const r = g.getBoundingClientRect();
                           return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; };
          const past = q('img').filter(i => i.style.position === 'absolute' && i.width === 210).map(i => [i.alt, R(i)]);
          const nv = q('div').find(d => d.textContent.trim() === 'NOUVEAU');
          const c = q('div').filter(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
          const pr = c.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
          const tf = q('img').filter(i => (i.alt||'') === 'Taxi Food').sort((a,b) => b.width - a.width)[0];
          const se = q('div').find(d => d.style.lineHeight === '1.26');
          const B = e => Math.round(e.getBoundingClientRect().bottom);
          return {past, nv: R(nv),
                  noms: q('.nm').map(e => [e.textContent.trim(), T(e)]),
                  zones: q('.zn').map(e => T(e)),
                  promo: B(pr), tf: B(tf), sec: R(se),
                  sec_h: Math.round(se.getBoundingClientRect().height),
                  corps: R(document.body)};
        }""")
        await pg.screenshot(path=fichier, clip={'x': 0, 'y': 0, 'width': 1080, 'height': h})
        await b.close()

    a = np.asarray(Image.open(fichier).convert('RGB')).astype(np.float32)
    ok = True
    print(fichier)
    print('  quatre pastilles de 210 px, marge au bandeau creme et contraste sur le creme :')
    CREME = (0xF6, 0xEF, 0xE2)
    for alt, (x0, y0, x1, y1) in v['past']:
        marge = min(x0, y0, 1080-x1, P.PH-y1)
        # le contraste du BORD de la pastille avec le creme, la ou elle s'y pose
        cx, cy, r = (x0+x1)/2, (y0+y1)/2, (x1-x0)/2
        Y, X = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        dist = np.hypot(X-cx, Y-cy)
        # On mesure LE CERNE, qui est a l'EXTERIEUR de l'image (box-shadow),
        # pas les derniers pixels du logo : c'est le cerne qui fait le bord.
        # Premiere version du controle : elle sondait r-6..r-2, donc l'interieur
        # du logo, et declarait « pas de bord » alors que le cerne etait pose.
        bord = a[(dist > r+0.6) & (dist < r+P.CERNE-0.4)].mean(0)
        rc = ratio(bord, CREME)
        bon = marge >= 40 and rc >= 3.0
        ok &= bon
        print('    %-22s marge %3d px   cerne #%02X%02X%02X sur creme %5.2f:1   %s'
              % (alt.replace('&amp;','&'), marge, *bord.astype(int), rc, 'ok' if bon else 'A CORRIGER'))
    # aucun recouvrement entre pastilles ni entre textes
    B = [b for _, b in v['past']] + [b for _, b in v['noms']] + v['zones'] + [v['nv']]
    chev = 0
    for i in range(len(B)):
        for j in range(i+1, len(B)):
            A_, C_ = B[i], B[j]
            if not (A_[3] <= C_[1] or C_[3] <= A_[1] or A_[2] <= C_[0] or C_[2] <= A_[0]):
                chev += 1
    # le badge NOUVEAU chevauche VOLONTAIREMENT sa pastille : un seul couple attendu
    ok &= chev == 1
    print('  recouvrements                : %d   (attendu 1 : le badge sur sa pastille)' % chev)
    nv_dans = v['nv'][1] >= 0 and v['nv'][3] <= P.PH and v['nv'][2] <= 1080
    sous_nom = min(n[1][1] for n in v['noms'])
    ok &= nv_dans
    print('  badge NOUVEAU                : (%d, %d)-(%d, %d)   dans le bandeau : %s'
          % (*v['nv'], 'oui' if nv_dans else 'NON'))
    ecart = v['promo'] - v['tf']; ok &= ecart == 0
    print('  ecart promo / logo Taxi Food : %+d px      (attendu 0)' % ecart)
    lignes = round(v['sec_h']/(25*1.26)); ok &= lignes == 2
    sec_ok = v['sec'][2] <= 1080-62-190-34+1; ok &= sec_ok
    print('  ligne secondaire             : %d lignes   bord droit a %d px (max %d)'
          % (lignes, v['sec'][2], 1080-62-190-34))
    deb = v['corps'][2] > 1080 or v['corps'][3] > h; ok &= not deb
    print('  debord du cadre              : %s' % ('OUI' if deb else 'non'))
    print('  ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
    return ok

if __name__ == '__main__':
    asyncio.run(rendre(*sys.argv[1:]))
