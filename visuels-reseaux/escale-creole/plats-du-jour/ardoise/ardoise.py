# -*- coding: utf-8 -*-
"""Visuel « ardoise » des plats du jour de L'escale Creole (tableau du 2026-10-20).

Les 8 plats A L'AFFICHE, chacun en photo avec son nom et son prix (relus en base le 20/10,
restaurant 128e68ab, products is_featured/is_available). Photos = celles du catalogue
(visuels/pj-*.jpg = produits/escale-creole/). Aucun texte dessine par un modele.
Rendu : python3 ardoise.py  ->  PUB-escale-ardoise.png (1080 x 1350), controles a la fin.
"""
import asyncio, os
D = os.path.dirname(os.path.abspath(__file__))
V = os.path.abspath(os.path.join(D, '..', '..', 'visuels'))
A = os.path.abspath(os.path.join(D, '..', '..', '..', 'assets'))
F = '/Users/christopher/taxi-food-nosybe/app/node_modules/@expo-google-fonts/archivo'

PLATS = [  # (fichier, nom, prix, porc) — ordre : les nouveautes du tableau d'abord
    ('pj-rougail-morue.jpg', 'Rougail morue', 40000, False),
    ('pj-filet-vivaneau-combava.jpg', 'Filet de vivaneau sauce combava', 40000, False),
    ('pj-cari-poulet-pays.jpg', 'Cari poulet pays', 38000, False),
    ('pj-massale-cabri.jpg', 'Massalé cabri', 38000, False),
    ('pj-emince-poulet-poivre-vert.jpg', 'Émincé de poulet au poivre vert', 38000, False),
    ('pj-roti-porc-creole.jpg', 'Rôti porc à la créole', 38000, True),
    ('pj-rougail-saucisses.jpg', 'Rougail saucisses', 38000, True),
    ('pj-bol-renverse.jpg', 'Bol renversé poulet ou zébu', 32000, False),
]
ar = lambda n: f'{n:,}'.replace(',', '&nbsp;') + '&nbsp;Ar'

def html():
    cartes = ''.join(f'''<div class="c"><div class="ph" style="background-image:url('file://{V}/{f}')"></div>
      <div class="t"><b>{n}</b><span class="px">{ar(p)}</span>{'<i>porc</i>' if porc else ''}</div></div>''' for f, n, p, porc in PLATS)
    fonts = ''.join(f'@font-face{{font-family:A;src:url("file://{F}/{d}/Archivo_{d}.ttf");font-weight:{w}}}'
                    for d, w in [('500Medium', 500), ('700Bold', 700), ('800ExtraBold', 800), ('900Black', 900)])
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>{fonts}
*{{box-sizing:border-box;margin:0}}body{{width:1080px;height:1350px;font-family:A;background:#14294F;color:#fff;overflow:hidden;position:relative}}
.fl{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,#21457F 0,#14294F 70%)}}
.top{{position:relative;display:flex;align-items:center;gap:26px;padding:44px 48px 0}}
.logo{{width:150px;height:150px;border-radius:50%;background:#fff url('file://{V}/logo-escale-rond.png') center/96% no-repeat;border:5px solid #FFC72C;flex:none}}
.k{{display:inline-block;background:#E8342A;color:#FFC72C;font-weight:800;letter-spacing:.16em;font-size:22px;padding:8px 16px;border-radius:8px}}
h1{{font-weight:900;font-size:76px;line-height:.95;letter-spacing:-.02em;margin-top:12px}}
.sous{{font-weight:500;font-size:24px;opacity:.9;margin-top:8px}}
.g{{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:30px 40px 0}}
.c{{background:#FFF8EA;border-radius:18px;overflow:hidden;color:#1E1E1E;display:flex;flex-direction:column;height:406px}}
.ph{{height:280px;background-size:140%;background-position:center 78%}}
.t{{padding:10px 13px 0;display:flex;flex-direction:column;flex:1;position:relative}}
.t b{{font-weight:800;font-size:20.5px;line-height:1.1}}
.px{{margin-top:auto;margin-bottom:12px;font-weight:900;font-size:25px;color:#E8342A}}
.t i{{position:absolute;right:12px;bottom:15px;font-style:normal;font-weight:700;font-size:13px;color:#B5543A;border:1.5px solid currentColor;border-radius:99px;padding:1px 8px}}
.bas{{position:absolute;left:0;right:0;bottom:0;height:262px;background:#E8342A;border-top:6px solid #FFC72C;display:flex;align-items:center;padding:0 40px;gap:28px}}
.tf{{width:150px;height:150px;border-radius:30px;background:url('file://{A}/taxifood.png') center/cover;flex:none;box-shadow:0 8px 24px rgba(0,0,0,.25)}}
.m{{flex:1}}.m .l1{{font-weight:900;font-size:40px;line-height:1.02}}.m .l2{{font-weight:500;font-size:22px;margin-top:8px}}
.code{{display:inline-block;margin-top:14px;background:#141414;border-radius:12px;padding:9px 16px;font-weight:700;font-size:20px}}.code em{{font-style:normal;color:#FFC72C;font-weight:900}}
.st{{display:flex;flex-direction:column;gap:12px;flex:none}}.st img{{height:56px;display:block}}
</style></head><body><div class="fl"></div>
<div class="top"><div class="logo"></div><div><span class="k">PLATS DU JOUR</span><h1>L&rsquo;escale Cr&eacute;ole</h1>
<div class="sous">Cuisine r&eacute;unionnaise &middot; Ambatoloaka &middot; avec riz ou p&acirc;tes, grains et piment</div></div></div>
<div class="g">{cartes}</div>
<div class="bas"><div class="tf"></div><div class="m"><div class="l1">Livr&eacute;s chez toi,<br>midi et soir.</div>
<div class="l2">Lun.&ndash;sam. &middot; livraison d&egrave;s 2&nbsp;000&nbsp;Ar</div>
<div class="code">1re commande&nbsp;: &minus;50&nbsp;% sur la livraison &middot; <em>TAXIFOOD50</em></div></div>
<div class="st"><img src="file://{A}/appstore.png"><img src="file://{A}/googleplay.png"></div></div>
</body></html>'''

async def rendre():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width': 1080, 'height': 1350})
        h = os.path.join(D, 'ardoise.html'); open(h, 'w').write(html())
        await pg.goto('file://' + h, wait_until='load')
        await pg.evaluate('document.fonts.ready')
        m = await pg.evaluate('''() => {
          const W=1080,H=1350, r=[...document.querySelectorAll('.c,.top>*,.bas *')].map(e=>e.getBoundingClientRect());
          const deb = r.filter(x=>x.left<0||x.right>W||x.bottom>H||x.top<0).length;
          const g=document.querySelector('.g').getBoundingClientRect().bottom, bas=document.querySelector('.bas').getBoundingClientRect().top;
          const noms=[...document.querySelectorAll('.t b')].map(b=>Math.round(b.getBoundingClientRect().height/ (parseFloat(getComputedStyle(b).fontSize)*1.1)));
          const chev=[...document.querySelectorAll('.t')].filter(t=>{const b=t.querySelector('b').getBoundingClientRect(), x=t.querySelector('.px').getBoundingClientRect(); return b.bottom>x.top}).length;
          const fam=getComputedStyle(document.querySelector('h1')).fontFamily;
          return {debords:deb, air_grille_bandeau:Math.round(bas-g), lignes_max_nom:Math.max(...noms), chevauchements:chev, police:document.fonts.check('900 76px A')};
        }''')
        await pg.screenshot(path=os.path.join(D, 'PUB-escale-ardoise.png'))
        await b.close()
    print(m)
    ok = m['debords'] == 0 and m['air_grille_bandeau'] >= 20 and m['lignes_max_nom'] <= 3 and m['chevauchements'] == 0 and m['police']
    print('CONFORME' if ok else 'NON CONFORME')

if __name__ == '__main__':
    asyncio.run(rendre())
