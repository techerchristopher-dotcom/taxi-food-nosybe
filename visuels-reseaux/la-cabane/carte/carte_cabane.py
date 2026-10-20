# -*- coding: utf-8 -*-
"""LA CARTE DE LA CABANE (snacks, burgers & crepes, Ambatoloaka) — meme chaine que Les Siciliens, L'escale Creole, La Plage.

  python3 carte_cabane.py   ->  CARTE-LA-CABANE.pdf

Generee le 2026-10-20. SOURCES : la base Taxi Food (restaurant 958faac6-…), copiee dans donnees_cabane.json
(33 plats et milkshakes + 14 boissons, prix, descriptions, supplements, photos dans ./visuels) ; et sa carte
papier (partenaire /la cabane/COMPARAISON-CARTE-PAPIER-LA-CABANE.md) pour ce que l'appli n'a pas :
6 cocktails, 5 alcools et le sirop, marques « servis sur place » (source = papier dans le json).

PALETTE = SON LOGO (../../assets/cabane.png) : noir #0C0C0C, orange #FA6A06, orange brule #B4540C (mesures).
L'orange est assombri a teinte constante jusqu'a 4,5:1 pour les titres et les prix.
La frise reprend les trois teintes du logo. Chaque plat qui a une photo dans Taxi Food la porte.
"""
import asyncio, base64, json, os, re
import numpy as np
from playwright.async_api import async_playwright

ICI = os.path.dirname(os.path.abspath(__file__))
VIS = os.path.join(ICI, 'visuels')
ASSETS = os.path.join(ICI, '..', '..', 'assets')
os.chdir(ICI)
NOM_PDF, NOM_HTML = 'CARTE-LA-CABANE.pdf', 'carte-cabane.html'

def b64(p):
    ext = 'png' if p.endswith('.png') else 'jpeg'
    return f"data:image/{ext};base64,{base64.b64encode(open(p,'rb').read()).decode()}"
def photo(n): return b64(os.path.join(VIS, n + '.jpg'))
def asset(n): return b64(os.path.join(ASSETS, n + '.png'))

# ---- palette ------------------------------------------------------------------
FOND   = '#FEEDE1'   # son orange eclairci a 88 % : le papier
CARTON = '#FFF8F2'   # encarts Taxi Food
ENCRE  = '#0C0C0C'   # son noir
GRIS   = '#6A4630'   # descriptions
GRIS2  = '#74513A'   # presentations
BLEU   = '#B44C04'   # son orange #FA6A06 assombri a teinte constante (titres)
ROUGE  = '#9F4304'   # le meme, plus sombre (prix)
FILET  = '#F4D3BC'
B_BLEU, B_JAUNE, B_ROUGE = '#0C0C0C', '#FA6A06', '#B4540C'   # frises : teintes du logo
LOGO_F = os.path.join(ASSETS, 'cabane.png')

def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def lum(c):
    c = np.array(rgb(c), float)/255
    c = np.where(c <= 0.03928, c/12.92, ((c+0.055)/1.055)**2.4)
    return float(0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2])
def contraste(c, f=None):
    a, b = lum(c), lum(f or FOND); return (max(a, b)+.05)/(min(a, b)+.05)
for n, c in (('encre', ENCRE), ('gris', GRIS), ('gris2', GRIS2), ('bleu', BLEU), ('rouge', ROUGE)):
    print('  %-6s %s %5.2f:1  (encart %5.2f:1)' % (n, c, contraste(c), contraste(c, CARTON)))
    assert contraste(c) >= 4.5, n
    assert contraste(c, CARTON) >= 4.5, n + ' sur encart'
assert contraste('#FFFFFF', ROUGE) >= 4.5, 'badge porc'

E = float(os.environ.get('ECHELLE', '1.36'))
PH = float(os.environ.get('PHOTO', '26'))
def pt(x): return f'{round(x*E, 2)}pt'

FRISE = (f"background:linear-gradient(135deg,{B_BLEU} 25%,transparent 25%) -3mm 0/6mm 6mm,"
         f"linear-gradient(225deg,{B_ROUGE} 25%,transparent 25%) -3mm 0/6mm 6mm,"
         f"linear-gradient(315deg,{B_JAUNE} 25%,transparent 25%) 0 0/6mm 6mm,"
         f"linear-gradient(45deg,{B_BLEU} 25%,transparent 25%) 0 0/6mm 6mm;")
BARRE = (f"linear-gradient(90deg,{B_BLEU} 0 32%,{FOND} 32% 34%,{B_JAUNE} 34% 66%,"
         f"{FOND} 66% 68%,{B_ROUGE} 68% 100%)")

STYLE = f'''
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Nunito:wght@700;800;900&display=block');
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{background:{FOND};}}
body{{font-family:Inter,sans-serif;color:{ENCRE};-webkit-font-smoothing:antialiased;}}
.pg{{width:210mm;height:297mm;background:{FOND};padding:15mm 14mm 12mm;position:relative;
  overflow:hidden;page-break-after:always;break-after:page;display:flex;gap:9mm;}}
.pg:last-child{{page-break-after:auto;}}
.cx{{width:86.5mm;flex:0 0 86.5mm;}}
.ent{{break-inside:avoid;}}
.st{{font-family:Nunito,sans-serif;font-size:{pt(12.2)};font-weight:900;color:{BLEU};
  line-height:1.12;letter-spacing:.01em;}}
.st i{{font-style:italic;font-weight:700;font-size:.62em;color:{GRIS2};font-family:Inter;}}
.ss{{font-size:{pt(7.2)};font-style:italic;color:{GRIS2};margin-top:1.1mm;line-height:1.38;}}
.rg{{height:2.2pt;margin:1.8mm 0 2.8mm;background:{BARRE};border-radius:1pt;}}
.pl{{break-inside:avoid;margin-bottom:3.4mm;}}
.l1{{display:flex;align-items:baseline;gap:1.6mm;}}
.nm{{font-family:Nunito,sans-serif;font-weight:800;font-size:{pt(10)};line-height:1.16;color:{ENCRE};}}
.pt{{flex:1;border-bottom:.5pt dotted rgba(58,47,23,.35);transform:translateY(-.9mm);min-width:3mm;}}
.px{{font-weight:700;font-size:{pt(9.2)};color:{ROUGE};white-space:nowrap;font-variant-numeric:tabular-nums;}}
.px i{{font-style:normal;font-size:.8em;opacity:.85;margin-left:.3mm;}}
.px s{{text-decoration:none;font-weight:500;font-size:.72em;color:{GRIS};margin-right:.8mm;}}
.px u{{text-decoration:none;font-weight:500;font-size:.72em;color:{GRIS};margin-left:.8mm;}}
.ig{{font-size:{pt(7.1)};color:{GRIS};line-height:1.45;margin-top:.7mm;}}
.ig b{{font-weight:600;color:{ENCRE};}}
.lot{{font-size:{pt(7.1)};color:{ROUGE};font-weight:600;margin-top:.6mm;}}
.pr{{font-style:italic;font-size:{pt(7.6)};color:{GRIS2};line-height:1.4;margin-top:.55mm;}}
.porc{{display:inline-block;font-family:Inter;font-size:{pt(5.6)};font-weight:700;letter-spacing:.06em;
  color:#fff;background:{ROUGE};border-radius:1mm;padding:.25mm 1.1mm;margin-left:1.4mm;
  vertical-align:.25em;text-transform:uppercase;}}
.sig{{display:flex;gap:3.2mm;align-items:flex-start;}}
.sig .tx{{flex:1;min-width:0;}}
.sig .pt{{display:none;}} .sig .nm{{flex:1;}}
.ph{{flex:0 0 {PH}mm;width:{PH}mm;height:{PH}mm;border-radius:50%;overflow:hidden;
  box-shadow:0 0 0 .8pt {B_JAUNE},0 0 0 2pt {FOND},0 0 0 2.8pt {B_BLEU};}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block;}}
.bl{{display:flex;align-items:baseline;gap:1.4mm;margin-bottom:2.2mm;break-inside:avoid;}}
.bl .nm{{font-size:{pt(9.3)};font-weight:700;}}
.bl .nm i{{font-family:Inter;font-style:italic;font-weight:400;font-size:.74em;color:{GRIS2};margin-left:1mm;}}
.grp{{break-inside:avoid;display:flow-root;}}
.sous{{font-family:Nunito;font-weight:900;font-size:{pt(8.4)};letter-spacing:.12em;text-transform:uppercase;color:{ROUGE};margin:1.2mm 0 1.8mm;}}
.note{{font-size:{pt(7.4)};color:{GRIS};font-style:italic;line-height:1.45;margin:.4mm 0 2.6mm;break-inside:avoid;}}
/* l'ardoise : un tableau noir, comme celui du restaurant */
.ard{{break-inside:avoid;background:#26332B;border-radius:2.4mm;padding:5mm 5mm 4.6mm;margin-bottom:4mm;
  box-shadow:inset 0 0 0 1.6mm #7A5A36,inset 0 0 0 2.1mm #5C4226;color:#F3EFE2;}}
.ard-t{{font-family:Nunito;font-weight:900;font-size:{pt(12)};padding-left:1.5mm;}}
.ard-p{{font-size:{pt(8.1)};line-height:1.5;margin-top:1.6mm;padding-left:1.5mm;color:#E4DFCF;}}
.ard-p b{{color:{B_JAUNE};font-weight:600;}}
.ard-ex{{font-size:{pt(7.2)};font-style:italic;color:#C9C4B2;margin-top:2.2mm;padding-left:1.5mm;line-height:1.5;}}
/* bandeau Taxi Food */
.bd{{position:absolute;left:14mm;right:14mm;bottom:12mm;height:16mm;border:.7pt solid {FILET};
  border-radius:2mm;background:{CARTON};padding:0 5mm;display:flex;align-items:center;gap:4.5mm;}}
.bd-logo{{width:11mm;height:auto;}}
.bd-tx{{flex:1;min-width:0;}}
.bd-t{{font-family:Nunito;font-weight:900;font-size:{pt(8.6)};white-space:nowrap;}}
.bd-p{{font-size:{pt(6.4)};color:{GRIS};margin-top:.8mm;white-space:nowrap;}}
.bd-p b{{color:{ROUGE};}}
.bd-ad{{text-align:right;line-height:1.3;}}
.bd-ad b{{display:block;font-size:{pt(6.8)};white-space:nowrap;}}
.bd-ad span{{display:block;font-size:{pt(5.8)};color:{ROUGE};font-weight:700;letter-spacing:.04em;}}
/* couverture et dos */
.cv,.ds{{display:flex;align-items:center;justify-content:center;text-align:center;}}
.frise{{position:absolute;left:0;right:0;height:6mm;{FRISE}}}
.frise.h{{top:0;}} .frise.b{{bottom:0;transform:scaleY(-1);}}
.cv-in{{width:178mm;}}
.cv-logo{{width:86mm;height:86mm;display:block;margin:0 auto 4mm;border-radius:50%;box-shadow:0 0 0 1.2pt {B_JAUNE},0 0 0 3pt {FOND},0 0 0 4pt {B_BLEU};}}
.cv-fil{{height:2.4pt;width:78mm;margin:5mm auto;background:{BARRE};border-radius:1pt;}}
.cv-sub{{font-size:{pt(8.2)};letter-spacing:.32em;text-transform:uppercase;color:{GRIS};}}
.cv-lieu{{font-family:Nunito;font-weight:800;font-size:{pt(13)};color:{ENCRE};}}
.cv-info{{display:flex;justify-content:center;gap:12mm;margin-top:7mm;}}
.cv-info div{{font-size:{pt(8)};color:{GRIS};line-height:1.6;}}
.cv-info b{{display:block;font-size:{pt(6.2)};letter-spacing:.2em;text-transform:uppercase;color:{ROUGE};
  font-weight:700;margin-bottom:1.2mm;}}
.cv-tf{{display:flex;align-items:center;gap:6mm;text-align:left;margin-top:10mm;border:.8pt solid {FILET};
  border-radius:2.6mm;background:{CARTON};padding:6mm 7mm;}}
.cv-tf-logo{{width:17mm;height:auto;flex:0 0 17mm;}}
.cv-tf-t{{font-family:Nunito;font-weight:900;font-size:{pt(12.4)};line-height:1.14;margin-bottom:2mm;}}
.cv-tf-p{{font-size:{pt(7.8)};color:{GRIS};line-height:1.54;}}
.cv-tf-p b{{color:{ENCRE};}} .cv-tf-p b.cd{{color:{ROUGE};letter-spacing:.04em;}}
.qr{{width:21mm;height:21mm;background:#fff;padding:1.1mm;border-radius:1mm;box-shadow:0 0 0 .5pt {FILET};}}
.st2 img{{width:17mm;display:block;margin-bottom:1.5mm;}}
.dl{{display:flex;align-items:center;gap:3.5mm;flex:0 0 auto;}}
.cv-pied{{margin-top:5mm;font-size:{pt(6.6)};color:{GRIS2};letter-spacing:.05em;}}
.ds-in{{width:150mm;}}
.ds-logo{{width:44mm;height:44mm;border-radius:50%;box-shadow:0 0 0 1pt {B_JAUNE},0 0 0 2.5pt {FOND},0 0 0 3.3pt {B_BLEU};display:block;margin:0 auto 3mm;}}
.ds-part{{font-size:{pt(7)};letter-spacing:.32em;text-transform:uppercase;color:{GRIS2};margin-bottom:3mm;}}
.ds-tf{{width:26mm;display:block;margin:0 auto 2.5mm;}}
.ds-tft{{font-family:Nunito;font-weight:900;font-size:{pt(19)};}}
.ds-p{{font-size:{pt(8.3)};color:{GRIS};line-height:1.62;margin:4.5mm auto 0;max-width:120mm;}}
.ds-code{{margin:5mm auto 0;display:inline-block;border:.8pt solid {FILET};border-radius:2mm;
  background:{CARTON};padding:3mm 7mm;font-size:{pt(8.6)};}}
.ds-code b{{color:{ROUGE};letter-spacing:.05em;}} .ds-code span{{display:block;font-size:{pt(7)};color:{GRIS2};margin-top:.8mm;}}
.ds .dl{{justify-content:center;margin-top:6mm;}}
.ds-pied{{font-size:{pt(7.4)};color:{GRIS2};}}
@page{{size:A4;margin:0;}}
'''

# ---- le restaurant (base Taxi Food : phone +261322759576, zone Ambatoloaka, mar.–dim. 16 h – 22 h, ferme le lundi) ----
DONNEES = 'donnees_cabane.json'
M = dict(nom='La Cabane', tel='032 27 595 76', lieu='Ambatoloaka, Nosy Be',
         lieu_html='Ambatoloaka, Nosy&nbsp;Be', edition='Édition octobre 2026',
         cuisine='Snacks &middot; Burgers &middot; Crêpes',
         service='mar. – dim.<br>16 h – 22 h', fermeture='le lundi',
         tf_p='Les plats de cette carte', dos='La Cabane livre ses tacos, ses burgers et ses crêpes')
BANDEAUX = [
 ("Ses plats sont sur Taxi&nbsp;Food.", "Tu commandes dans l'appli, on t'apporte le plat."),
 ("Livré chez toi ou sur la plage.", "Tacos, burgers, crêpes : sans bouger de ta chaise."),
 ("&minus;50 % sur ta première livraison.", "Avec le code <b>TAXIFOOD50</b>, au moment de payer."),
 ("Installe, commande, c'est livré.", "Sur l'App&nbsp;Store et sur Google&nbsp;Play. Le QR est au dos."),
]

# ---- blocs --------------------------------------------------------------------
def prix(p, des=False, unite=None):
    m, r = divmod(p, 1000)
    return (f'<span class="px">{"<s>dès</s>" if des else ""}{m}<i>{r:03d}</i>'
            f'{f"<u>{unite}</u>" if unite else ""}</span>')

def bloc_plat(d):
    porc = '<span class="porc">porc</span>' if d.get('porc') else ''
    corps = (f'<div class="l1"><span class="nm">{d["nom"]}{porc}</span><span class="pt"></span>'
             f'{prix(d["prix"], d.get("des"), d.get("unite"))}</div>'
             + (f'<div class="lot">{d["lot"]}</div>' if d.get('lot') else '')
             + (f'<div class="ig">{d["ig"]}</div>' if d.get('ig') else '')
             + (f'<div class="pr">{d["pr"]}</div>' if d.get('pr') else ''))
    if d.get('photo'):
        return (f'<div class="pl sig"><div class="ph"><img src="{photo(d["photo"])}"></div>'
                f'<div class="tx">{corps}</div></div>')
    return f'<div class="pl">{corps}</div>'

def bloc_ligne(x):
    d = f' <i>{x["det"]}</i>' if x.get('det') else ''
    return f'<div class="bl"><span class="nm">{x["nom"]}{d}</span><span class="pt"></span>{prix(x["prix"])}</div>'

def entete(titre, ss, suite=False):
    t = titre + (' <i>(suite)</i>' if suite else '')
    return (f'<div class="ent"><div class="st">{t}</div>'
            + (f'<div class="ss">{ss}</div>' if ss and not suite else '')
            + '<div class="rg"></div></div>')

SECTIONS = json.load(open(DONNEES))
ITEMS, N_PLATS, N_BOIS, N_PHOTOS = [], 0, 0, 0
for s in SECTIONS:
    titre, ss = s['titre'], s.get('ss', '')
    ss = re.sub(r'\+ (\d+) (\d{3}) Ar', r'+&nbsp;\1&nbsp;\2&nbsp;Ar', ss)   # un prix ne se coupe pas
    ITEMS.append(('ent', entete(titre, ss), titre))
    ITEMS.append(('ent_suite', entete(titre, ss, True), titre))
    # chaque plat qui a une photo dans Taxi Food la porte
    for x in s.get('plats', []):
        ITEMS.append(('item', bloc_plat(x), titre)); N_PLATS += 1; N_PHOTOS += bool(x.get('photo'))
    # boissons : des lignes, sans photo
    for g in s.get('groupes', []):
        for k, x in enumerate(g['lignes']):
            h = (f'<div class="sous">{g["sous"]}</div>' if k == 0 else '')
            h += bloc_plat(dict(x, photo=None)) if g.get('cocktails') else bloc_ligne(x)
            ITEMS.append(('item', f'<div class="grp">{h}</div>', titre)); N_BOIS += 1
print(f'  {N_PLATS} plats ({N_PHOTOS} avec photo) + {N_BOIS} boissons')
for f in os.listdir(VIS):
    assert any(f'"photo": "{f[:-4]}"' in open(DONNEES).read() for _ in [0]), 'photo orpheline ' + f

# ---- Taxi Food -----------------------------------------------------------------
TF = asset('taxifood-transparent')
def bandeau(i):
    t, p = BANDEAUX[i % len(BANDEAUX)]
    return (f'<div class="bd"><img class="bd-logo" src="{TF}"><div class="bd-tx"><div class="bd-t">{t}</div>'
            f'<div class="bd-p">{p}</div></div><div class="bd-ad"><b>taxifoodnosybe.distripro207.com</b>'
            f'<span>CODE TAXIFOOD50</span></div></div>')

LOGO = b64(LOGO_F)
DL = (f'<div class="dl"><img class="qr" src="{asset("qr")}"><div class="st2">'
      f'<img src="{asset("appstore")}"><img src="{asset("googleplay")}"></div></div>')

COUV = f'''<section class="pg cv"><div class="frise h"></div><div class="frise b"></div><div class="cv-in">
  <img class="cv-logo" src="{LOGO}" alt="{M['nom']}">
  <div class="cv-sub">{M['cuisine']}</div>
  <div class="cv-fil"></div>
  <div class="cv-lieu">{M['lieu_html']}</div>
  <div class="cv-info">
    <div><b>Service</b>{M['service']}</div>
    <div><b>Fermeture</b>{M['fermeture']}</div>
    <div><b>Réservation</b>{M['tel']}</div>
  </div>
  <div class="cv-tf"><img class="cv-tf-logo" src="{TF}"><div style="flex:1">
    <div class="cv-tf-t">Tu peux aussi te faire livrer.</div>
    <div class="cv-tf-p">{M['tf_p']} sont sur <b>Taxi Food</b>,
    la livraison de repas à Nosy&nbsp;Be. Tu commandes depuis l'application, on t'apporte le plat chez
    toi, à l'hôtel ou sur la plage. Première commande : le code <b class="cd">TAXIFOOD50</b> met la
    livraison à moitié prix.</div></div>{DL}</div>
  <div class="cv-pied">Tous les prix sont en ariary, service compris. &nbsp;&middot;&nbsp; {M['edition']}</div>
</div></section>'''

DOS = f'''<section class="pg ds"><div class="frise h"></div><div class="frise b"></div><div class="ds-in">
  <img class="ds-logo" src="{LOGO}">
  <div class="cv-fil"></div>
  <div class="ds-part">Partenaire</div>
  <img class="ds-tf" src="{TF}"><div class="ds-tft">Taxi&nbsp;Food</div>
  <div class="ds-p">{M['dos']} avec Taxi&nbsp;Food, le service de livraison de repas
  de Nosy&nbsp;Be. Tu choisis tes plats dans l'application, tu poses ton adresse sur la carte, et on te
  l'apporte — chez toi, à l'hôtel, ou sur la plage. Aucun minimum de commande.</div>
  <div class="ds-code">Première commande : <b>TAXIFOOD50</b><span>la livraison à moitié prix</span></div>
  {DL}
  <div class="cv-fil"></div>
  <div class="ds-pied">{M['lieu']} &nbsp;&middot;&nbsp; {M['tel']}</div>
</div></section>'''

# ---- mesure puis composition en colonnes ---------------------------------------
COL_H = 266.0 - 20.0
async def mesurer(html_path):
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width': 900, 'height': 1200})
        await pg.goto('file://' + html_path); await pg.evaluate('document.fonts.ready')
        await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""() => [...document.querySelectorAll('.mb')].map(e => {
            const k = e.firstElementChild, s = getComputedStyle(k);
            return (k.getBoundingClientRect().height + parseFloat(s.marginTop)
                    + parseFloat(s.marginBottom)) / 3.7795275591; })""")
        await b.close(); return r

corps = ''.join(f'<div class="mb" style="width:86.5mm">{h}</div>' for _, h, _ in ITEMS)
open('_blocs.html', 'w').write(f'<!doctype html><meta charset="utf-8"><style>{STYLE}</style><body>{corps}')
HT = asyncio.run(mesurer(os.path.abspath('_blocs.html')))
ENT   = {s: (h, HT[i]) for i, (t, h, s) in enumerate(ITEMS) if t == 'ent'}
SUITE = {s: (h, HT[i]) for i, (t, h, s) in enumerate(ITEMS) if t == 'ent_suite'}
FLUX  = [(h, HT[i], s) for i, (t, h, s) in enumerate(ITEMS) if t == 'item']

def composer(n, cap):
    cols, i, cour = [], 0, None
    for _ in range(n*2):
        h, dedans = 0.0, []
        while i < len(FLUX):
            html, hb, sec = FLUX[i]
            tete = ENT[sec] if sec != cour else (SUITE[sec] if not dedans else None)
            ht = tete[1] if tete else 0
            # une entete de section ne reste jamais seule en bas de colonne
            if h + ht + hb > cap: break
            if tete: dedans.append(tete[0]); h += ht
            dedans.append(html); h += hb; cour = sec; i += 1
        cols.append((dedans, h))
        if i >= len(FLUX): break
    return cols, i >= len(FLUX)

n = next(k for k in range(1, 12) if composer(k, COL_H)[1])
lo, hi = 0.0, COL_H
for _ in range(40):
    mi = (lo+hi)/2
    lo, hi = (lo, mi) if composer(n, mi)[1] else (mi, hi)
cols, _ = composer(n, hi)
while len(cols) < n*2: cols.append(([], 0))
print(f'\ntypo x{E}, photos {PH} mm : {n} pages de carte + couverture + dos = {n+2} pages A4'
      f'  (colonne {hi:.0f}/{COL_H:.0f} mm, total {sum(c[1] for c in cols):.0f} mm)')

pages = [COUV] + [f'<section class="pg">' + ''.join(f'<div class="cx">{"".join(cols[k][0])}</div>'
          for k in (2*j, 2*j+1)) + bandeau(j) + '</section>' for j in range(n)] + [DOS]
open(NOM_HTML, 'w').write(f'<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    f'<title>Carte — {M["nom"]}</title><style>{STYLE}</style></head><body>{"".join(pages)}</body></html>')

async def rendre():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', args=['--font-render-hinting=none'])
        pg = await b.new_page(viewport={'width': 794, 'height': 1123}, device_scale_factor=2)
        await pg.goto('file://' + os.path.abspath(NOM_HTML))
        await pg.evaluate('document.fonts.ready'); await pg.wait_for_timeout(1500)
        # controles : rien sous la limite utile, rien hors colonne, aucune photo cassee
        ko = await pg.evaluate("""() => { const MM=3.7795275591; let k=[];
          document.querySelectorAll('.pg').forEach((p,i)=>{ const r=p.getBoundingClientRect();
            const bd=p.querySelector('.bd'); const lim = bd ? bd.getBoundingClientRect().top-2 : r.bottom;
            p.querySelectorAll('.cx > *').forEach(e=>{const b=e.getBoundingClientRect();
              if(b.bottom>lim+.5) k.push('page '+(i+1)+' deborde en bas');
              if(b.right>e.parentElement.getBoundingClientRect().right+1) k.push('page '+(i+1)+' deborde a droite');});
            p.querySelectorAll('.bl,.l1').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1) k.push('page '+(i+1)+' ligne trop large');});
            p.querySelectorAll('.cv-in,.ds-in').forEach(e=>{ const b=e.getBoundingClientRect();
              if(b.top<r.top+22 || b.bottom>r.bottom-22) k.push('page '+(i+1)+' couverture/dos trop haut');});
            p.querySelectorAll('.bd-t,.bd-p,.bd-ad b').forEach(e=>{ if(e.scrollWidth>e.clientWidth+1) k.push('page '+(i+1)+' bandeau coupe');});
          });
          document.querySelectorAll('img').forEach(im=>{ if(!im.complete||!im.naturalWidth) k.push('image cassee'); });
          return k; }""")
        nb = await pg.evaluate("document.querySelectorAll('.cx .ph img').length")
        print('photos rendues :', nb, '/', N_PHOTOS); assert nb == N_PHOTOS
        print('controles :', 'OK' if not ko else ko)
        await pg.pdf(path=NOM_PDF, format='A4', print_background=True,
                     margin={'top': '0', 'bottom': '0', 'left': '0', 'right': '0'})
        await b.close()
asyncio.run(rendre())
os.remove('_blocs.html')
print('->', NOM_PDF)
