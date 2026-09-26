# -*- coding: utf-8 -*-
"""Compose la carte de La Plage bloc par bloc, en colonnes explicites.

Meme methode que pour Chez Bidul & Truc, et pour la meme raison : a l'echelle
typographique demandee, une section entiere depasse la hauteur d'une colonne.
Laisser le navigateur equilibrer, c'est decouvrir le debord APRES l'impression.

On mesure donc la hauteur REELLE de chaque bloc dans une colonne de 86,5 mm,
marges comprises — `getBoundingClientRect()` ne les inclut pas, et sans elles
une colonne de seize blocs perd une cinquantaine de millimetres — puis on
remplit les colonnes une par une. Une section qui deborde reprend en haut de la
colonne suivante sous un rappel « (suite) ».
"""
import asyncio, os
from playwright.async_api import async_playwright
import donnees_laplage as D

# 1,34 et non 1,38 : a 1,38 la carte demandait 5 pages de carte, soit 7 pages A4
# en tout — un nombre impair qui gaspille une face a l'impression recto-verso.
# A 1,34 elle tient en 4, soit 6 pages : trois feuilles pile. Le plus petit
# corps passe de 8,83 a 8,58 pt, ce qui ne se voit pas.
os.environ.setdefault('ECHELLE', '1.34')
import batir_laplage as A

# 297 - 15 (haut) - 12 (bas) - 4 mm de garde = 266, MOINS le bandeau Taxi Food
# qui occupe desormais 16 mm en pied de chaque page, plus 4 mm d'air au-dessus.
#
# POURQUOI 16 ET PAS 21. Un bandeau de 21 mm permettait d'y loger un QR
# scannable (17 mm), mais faisait passer la carte a 5 pages de carte, soit
# 7 pages A4 — un nombre impair, avec une derniere colonne a moitie vide.
# A 16 mm la carte tient en 4 pages, soit 6 pages : trois feuilles pile en
# recto-verso. Le bandeau porte donc l'adresse du site plutot qu'un QR, et le
# QR reste la ou il se scanne : 21 mm en couverture, 24 mm au dos.
BANDEAU_H = 16.0 + 4.0
COL_H = 266.0 - BANDEAU_H
PHOTO = float(os.environ.get('PHOTO', '19'))

def bloc_plat(p):
    nom, prix, ingr, pres, _valider, photo = p
    corps = (f'<div class="l1"><span class="nm">{nom}</span>'
             f'<span class="pt"></span><span class="px">{prix//1000}<i>000</i></span></div>'
             f'<div class="ig">{ingr}</div><div class="pr">{pres}</div>')
    if photo:
        return (f'<div class="pl sig"><div class="ph"><img src="{A.img(photo)}"></div>'
                f'<div class="tx">{corps}</div></div>')
    return f'<div class="pl">{corps}</div>'

def bloc_boisson(b):
    nom, prix, det = b
    d = f' <i>{det}</i>' if det else ''
    return (f'<div class="bl"><span class="nm">{nom}{d}</span>'
            f'<span class="pt"></span><span class="px">{prix//1000}<i>000</i></span></div>')

def bloc_accomp(_):
    """L'encadre des accompagnements. Un seul bloc, jamais coupe.

    Sur son carton c'est un encadre a part entre les grillades et les
    sandwichs : six garnitures au choix, comprises, et un supplement. On garde
    cette forme plutot que d'en faire six lignes tarifees, parce que ce ne sont
    pas six articles a vendre mais un choix a faire."""
    ch = ' &nbsp;&middot;&nbsp; '.join(A.D.ACCOMPAGNEMENTS['choix'])
    nom, prix = A.D.ACCOMPAGNEMENTS['ligne']
    # La phrase de presentation est DEJA le sous-titre de la section : la
    # repeter dans l'encadre la faisait apparaitre deux fois sur la meme page.
    return (f'<div class="pl acc"><div class="ch"><b>Au choix, compris :</b> {ch}</div>'
            f'<div class="bl" style="margin-top:2.2mm;margin-bottom:0"><span class="nm">{nom}</span>'
            f'<span class="pt"></span><span class="px">{prix//1000}<i>000</i></span></div></div>')

def entete(titre, ss, suite=False):
    t = titre + (' <i>(suite)</i>' if suite else '')
    h = f'<div class="ent"><div class="st">{t}</div>'
    if ss and not suite: h += f'<div class="ss">{ss}</div>'
    return h + '<div class="rg"></div></div>'

SECTIONS = []
for titre, cle, txt in D.SECTIONS:
    if cle == 'ACCOMPAGNEMENTS':
        SECTIONS.append((titre, D.ACCOMPAGNEMENTS['presentation'], [None], bloc_accomp))
    else:
        lst = getattr(D, cle)
        f = bloc_boisson if cle in ('FRAICHES','CHAUDES','BIERES','COCKTAILS','VIN','SPIRITUEUX') else bloc_plat
        SECTIONS.append((titre, txt, lst, f))

# --- 1. la liste a plat ------------------------------------------------------
ITEMS = []
for titre, ss, lst, f in SECTIONS:
    ITEMS.append(('ent', entete(titre, ss), titre))
    ITEMS.append(('ent_suite', entete(titre, ss, suite=True), titre))
    for x in lst:
        ITEMS.append(('item', f(x), titre))

# --- 2. mesurer --------------------------------------------------------------
STYLE = A.STYLE + f"""
.ph{{flex:0 0 {PHOTO}mm;width:{PHOTO}mm;height:{PHOTO}mm;}}
/* Colonne de texte etroite : le nom doit pouvoir se replier, sinon le prix
   sort de la colonne. Le pointille de conduite n'a plus la place et pendait
   seul en bout de premiere ligne — il est retire dans la variante photo. */
.sig .l1{{flex-wrap:nowrap;gap:2.2mm;}}
.sig .nm{{flex:1 1 auto;min-width:0;}}
.sig .pt{{display:none;}}
.sig .px{{flex:0 0 auto;}}
.ent{{break-inside:avoid;}}
.st i{{font-style:italic;font-weight:400;font-size:.62em;color:var(--gris2);}}
.pg{{display:flex;gap:9mm;}}
.cx{{width:86.5mm;flex:0 0 86.5mm;}}
"""
corps = ''.join(f'<div class="mb" data-i="{i}" style="width:86.5mm">{h}</div>'
                for i, (t, h, s) in enumerate(ITEMS))
open('_blocs.html', 'w').write(
    f'<!doctype html><meta charset="utf-8"><style>{STYLE}</style>'
    f'<body style="background:{A.FOND}">{corps}</body>')

async def mesurer():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 900, 'height': 1200})
        await pg.goto('file://' + os.path.abspath('_blocs.html'))
        await pg.wait_for_timeout(2000)
        r = await pg.evaluate("""() => [...document.querySelectorAll('.mb')].map(e => {
            const k = e.firstElementChild || e;
            const s = getComputedStyle(k);
            const h = k.getBoundingClientRect().height
                    + parseFloat(s.marginTop) + parseFloat(s.marginBottom);
            return {i:+e.dataset.i, h: h/3.7795275591};
        })""")
        await b.close(); return {x['i']: x['h'] for x in r}
HT = asyncio.run(mesurer())

ENT   = {s: (h, HT[i]) for i, (t, h, s) in enumerate(ITEMS) if t == 'ent'}
SUITE = {s: (h, HT[i]) for i, (t, h, s) in enumerate(ITEMS) if t == 'ent_suite'}
FLUX  = [(h, HT[i], s) for i, (t, h, s) in enumerate(ITEMS) if t == 'item']

def composer(n_pages, cible=COL_H):
    cols, i, sec_cour = [], 0, None
    for c in range(n_pages*2):
        cap, h, dedans = min(cible, COL_H), 0.0, []
        while i < len(FLUX):
            html, hb, sec = FLUX[i]
            tete = ENT[sec] if sec != sec_cour else (SUITE[sec] if not dedans else None)
            ht = tete[1] if tete else 0.0
            if h + ht + hb > cap: break
            if tete: dedans.append(tete[0]); h += ht
            dedans.append(html); h += hb; sec_cour = sec; i += 1
        cols.append((dedans, h, cap))
        if i >= len(FLUX): break
    return cols, i >= len(FLUX)

def tient(n, cible):
    c, fini = composer(n, cible)
    return fini and len(c) <= n*2

n = None
for k in range(2, 12):
    if tient(k, COL_H):
        n = k; break
if n is None:
    raise SystemExit('la carte ne tient pas en 11 pages')
lo, hi = 0.0, COL_H
for _ in range(40):
    mi = (lo+hi)/2
    if tient(n, mi): hi = mi
    else: lo = mi
cible = hi
cols, _ = composer(n, cible)
while len(cols) < n*2: cols.append(([], 0.0, COL_H))

print('\nhauteur de colonne retenue : %.1f mm (plafond %.0f mm)' % (cible, COL_H))
print('typo x%s, photos %.0f mm' % (os.environ['ECHELLE'], PHOTO))
print('contenu total : %.0f mm  ->  %d pages de carte + couverture = %d pages A4'
      % (sum(c[1] for c in cols), n, n+1))
for j in range(n):
    a, b = cols[2*j], cols[2*j+1]
    print('  page %d  col.1 %5.1f/%.0f mm   col.2 %5.1f/%.0f mm' % (j+2, a[1], a[2], b[1], b[2]))

def page(j):
    h = '<section class="pg">'
    for k in (2*j, 2*j+1):
        h += '<div class="cx">' + ''.join(cols[k][0]) + '</div>'
    return h + A.bandeau(j) + '</section>'

# Couverture, les pages de carte, puis le dos : chaque page de carte porte son
# bandeau, et le dos porte la marque complete.
PAGES = [A.COUVERTURE] + [page(j) for j in range(n)] + [A.DOS]
open('carte-laplage.html', 'w').write(
    f'<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    f'<title>Carte — La Plage</title><style>{STYLE}</style></head>'
    f'<body>{"".join(PAGES)}</body></html>')
print('  -> carte-laplage.html  %d Ko' % (os.path.getsize('carte-laplage.html')//1024))
