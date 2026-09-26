# -*- coding: utf-8 -*-
"""La carte de La Plage : palette, feuille de style, couverture.

MEME CHAINE QUE CHEZ BIDUL & TRUC, trois ecarts, tous dictes par son logo.

1. LA PALETTE VIENT DE SON LOGO, pas de ses photos. Mesuree sur les 262 144 px
   de `produits/la-plage/divers/logo.jpeg` (voir `palette_laplage.py`) : un
   soleil orange-rouge couchant sur deux vagues bleues, posé sur du blanc.
   Deux familles de teintes et non une — c'est cette opposition chaud/froid qui
   fait son identite, et la carte s'y tient.

2. LE FILET DE SECTION EST ORANGE PUIS BLEU. Chez Bidul c'etaient les deux
   barres du drapeau malgache. Ici ce sont les deux moities de son propre logo :
   le soleil, puis la mer. Meme dispositif, source differente.

3. AUCUN BADGE PORC. Sa carte n'en comporte aucun.

Les corrections de couleur se font a TEINTE ET SATURATION CONSTANTES : un rouge
« corrige » composante par composante devient un autre rouge, ce qui trahit la
marque. On ne change que la luminosite, jusqu'au contraste voulu.
"""
import base64, os, colorsys
import numpy as np
import donnees_laplage as D

def b64(p):
    ext = 'png' if p.endswith('.png') else 'jpeg'
    return f"data:image/{ext};base64,{base64.b64encode(open(p,'rb').read()).decode()}"
def img(n): return b64(f'web/{n}.jpg')
def png(n): return b64(f'web/{n}.png')
def css(n): return open(f'fonts/{n}.css').read()

# ---- La palette, mesuree puis calculee (palette_laplage.py) -----------------
FOND   = '#FFFCF6'   # son blanc #FEFFFE tire de 3,5 % vers le sable (teinte 38)
ENCRE  = '#102D39'   # son bleu profond #266D8A descendu a 14,08:1
GRIS   = '#576B71'   # l'encre diluee a 30 % dans le fond      5,49:1
GRIS2  = '#65777C'   # l'encre diluee a 36 %                   4,59:1
BLEU   = '#0D7EA3'   # son bleu mer #0F90BA, a 4,53:1
ORANGE = '#C64F07'   # son orange soleil #F76309, a 4,53:1
ROUGE  = '#E90D1D'   # son rouge soleil #F10D1E, a 4,52:1
FILET  = '#CFE3EA'   # le bleu mer tres dilue : un filet, pas un trait
# Les BARRES sont graphiques et non textuelles : elles gardent les teintes
# exactes du logo, sans correction de contraste.
BARRE_O, BARRE_B = '#F76309', '#0F90BA'

def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def lum(c):
    c = np.array(rgb(c) if isinstance(c, str) else c, float)/255
    c = np.where(c <= 0.03928, c/12.92, ((c+0.055)/1.055)**2.4)
    return float(0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2])
Lf = lum(FOND)
def contraste(c):
    L = lum(c); return (max(L, Lf)+0.05)/(min(L, Lf)+0.05)

for nom, c in (('fond', FOND), ('encre', ENCRE), ('gris', GRIS), ('gris2', GRIS2),
               ('bleu', BLEU), ('orange', ORANGE), ('rouge', ROUGE), ('filet', FILET)):
    print('  %-7s %s  contraste %5.2f:1' % (nom, c, contraste(c)))

# ---- La couverture ----------------------------------------------------------
M = D.MAISON
COUVERTURE = f'''<section class="pg cv">
  <div class="cv-in">
    <img class="cv-logo" src="{png('logo-laplage')}" alt="La Plage">
    <div class="cv-fil"></div>
    <h1>La Plage</h1>
    <div class="cv-sub">{M['accroche'].replace(' · ', ' &middot; ')}</div>
    <div class="cv-fil"></div>
    <div class="cv-lieu">{M['lieu']}</div>
    <div class="cv-info">
      <div><b>Service</b>10 h – 15 h<br>18 h – 22 h</div>
      <div><b>Fermeture</b>le lundi</div>
      <div><b>Réservation</b>{M['tel']}</div>
    </div>
    <div class="cv-tf">
      <img class="cv-tf-logo" src="{png('taxifood-transparent')}" alt="Taxi Food">
      <div class="cv-tf-tx">
        <div class="cv-tf-t">Tu peux aussi te faire livrer.</div>
        <div class="cv-tf-p">Toute cette carte est sur <b>Taxi Food</b>, la livraison de repas à
          Nosy&nbsp;Be. Tu commandes depuis l'application, on t'apporte le plat chez toi, à
          l'hôtel ou sur la plage. Première commande : le code <b class="cd">TAXIFOOD50</b> met
          la livraison à moitié prix.</div>
      </div>
      <div class="cv-tf-dl"><img class="cv-tf-qr" src="{png('qr')}" alt="">
        <div class="cv-tf-st"><img src="{png('appstore')}" alt="App Store"><img src="{png('googleplay')}" alt="Google Play"></div>
      </div>
    </div>
    <div class="cv-pied">Tous les prix sont en ariary, service compris.</div>
  </div>
</section>'''

STYLE = f'''
{css('playfair')}
{css('inter')}
:root{{
  --fond:{FOND}; --encre:{ENCRE}; --gris:{GRIS}; --gris2:{GRIS2};
  --bleu:{BLEU}; --orange:{ORANGE}; --rouge:{ROUGE}; --filet:{FILET};
  --barreO:{BARRE_O}; --barreB:{BARRE_B};
}}
*{{margin:0;padding:0;box-sizing:border-box;}}
html,body{{background:var(--fond);}}
body{{font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;}}
.pg{{width:210mm;height:297mm;background:var(--fond);
  padding:15mm 14mm 12mm;position:relative;overflow:hidden;color:var(--encre);
  page-break-after:always;break-after:page;}}
.pg:last-child{{page-break-after:auto;break-after:auto;}}

/* --- sections --- */
.sec{{margin-bottom:6.2mm;}}
.st,.rg,.ss{{break-after:avoid;break-inside:avoid;}}
.st{{font-family:'Playfair Display',serif;font-size:13.4pt;font-weight:700;letter-spacing:.012em;
  color:var(--encre);line-height:1.1;}}
.ss{{color:var(--gris2);line-height:1.38;margin-top:1.1mm;
  font-style:italic;font-family:'Playfair Display',serif;font-size:7.4pt;}}
/* Le soleil, puis la mer : les deux moities de son logo. */
.rg{{height:1.6pt;margin:1.9mm 0 2.6mm;
  background:linear-gradient(90deg,var(--barreO) 0 45%,var(--fond) 45% 55%,var(--barreB) 55% 100%);}}

/* --- un plat --- */
.pl{{break-inside:avoid;margin-bottom:3.3mm;}}
.l1{{display:flex;align-items:baseline;gap:1.4mm;}}
.nm{{font-family:'Playfair Display',serif;font-size:9.9pt;font-weight:500;color:var(--encre);
  line-height:1.16;}}
.pt{{flex:1;border-bottom:.45pt dotted rgba(16,45,57,.26);transform:translateY(-.9mm);min-width:3mm;}}
.px{{font-size:9.1pt;font-weight:600;color:var(--rouge);font-variant-numeric:tabular-nums;
  white-space:nowrap;letter-spacing:.005em;}}
.px i{{font-style:normal;font-size:7.4pt;opacity:.82;margin-left:.35mm;}}
.ig{{font-size:7.1pt;color:var(--gris);line-height:1.42;margin-top:.7mm;}}
.pr{{font-family:'Playfair Display',serif;font-style:italic;font-size:7.9pt;color:var(--gris2);
  line-height:1.36;margin-top:.55mm;}}

/* --- plat avec photo : le disque est cercle d'orange puis de bleu --- */
.sig{{display:flex;gap:3.2mm;align-items:flex-start;margin-bottom:3.8mm;}}
.ph{{flex:0 0 22mm;width:22mm;height:22mm;border-radius:50%;overflow:hidden;
  box-shadow:0 0 0 .6pt var(--barreB), 0 0 0 1.5pt var(--fond), 0 0 0 2pt var(--barreO);}}
.ph img{{width:100%;height:100%;object-fit:cover;display:block;}}
.sig .tx{{flex:1;min-width:0;}}

/* --- boissons --- */
.bl{{display:flex;align-items:baseline;gap:1.4mm;margin-bottom:2.1mm;break-inside:avoid;}}
.bl .nm{{font-size:9.4pt;}}
.bl .nm i{{font-style:normal;font-size:6.9pt;color:var(--gris2);margin-left:1mm;
  font-family:Inter,sans-serif;}}

/* --- l'encadre des accompagnements --- */
.acc{{break-inside:avoid;border:.7pt solid var(--filet);border-radius:2mm;
  padding:3.2mm 3.6mm;margin-bottom:3.6mm;background:rgba(13,126,163,.035);}}
.acc .ch{{font-size:8.2pt;color:var(--encre);line-height:1.62;}}
.acc .ch b{{font-weight:600;color:var(--bleu);}}
.acc .pr{{margin-top:1.4mm;}}

/* --- couverture --- */
.cv{{display:flex;align-items:center;justify-content:center;text-align:center;}}
.cv-in{{width:178mm;}}
.cv-logo{{width:52mm;height:52mm;display:block;margin:0 auto 6mm;border-radius:50%;
  filter:drop-shadow(0 2mm 5mm rgba(16,45,57,.16));}}
.cv-fil{{height:1.6pt;width:78mm;margin:6mm auto;
  background:linear-gradient(90deg,var(--barreO) 0 45%,var(--fond) 45% 55%,var(--barreB) 55% 100%);}}
.cv h1{{font-family:'Playfair Display',serif;font-size:38pt;font-weight:700;line-height:1.04;
  letter-spacing:.005em;color:var(--encre);}}
.cv-sub{{font-size:8.6pt;letter-spacing:.34em;text-transform:uppercase;color:var(--gris);
  margin-top:3.4mm;font-weight:400;}}
.cv-lieu{{font-family:'Playfair Display',serif;font-size:12.5pt;font-style:italic;color:var(--encre);}}
.cv-info{{display:flex;justify-content:center;gap:13mm;margin-top:8mm;}}
.cv-info div{{font-size:8.2pt;color:var(--gris);line-height:1.62;}}
.cv-info b{{display:block;font-size:6.4pt;letter-spacing:.2em;text-transform:uppercase;
  color:var(--orange);font-weight:600;margin-bottom:1.5mm;}}
.cv-pied{{margin-top:5mm;font-size:6.8pt;color:var(--gris2);letter-spacing:.055em;}}

/* --- bloc Taxi Food en pied de couverture --- */
.cv-tf{{display:flex;align-items:center;gap:6mm;text-align:left;margin-top:11mm;
  border:.8pt solid var(--filet);border-radius:2.6mm;background:rgba(13,126,163,.05);
  padding:6mm 7mm;}}
.cv-tf-logo{{flex:0 0 17mm;width:17mm;height:auto;filter:drop-shadow(0 1.5mm 3.5mm rgba(16,45,57,.18));}}
.cv-tf-tx{{flex:1;}}
.cv-tf-t{{font-family:'Playfair Display',serif;font-size:12.6pt;font-weight:700;color:var(--encre);
  line-height:1.14;margin-bottom:2mm;}}
.cv-tf-p{{font-size:7.9pt;color:var(--gris);line-height:1.54;}}
.cv-tf-p b{{color:var(--encre);font-weight:600;}}
.cv-tf-p b.cd{{color:var(--rouge);letter-spacing:.045em;}}
.cv-tf-dl{{flex:0 0 40mm;display:flex;align-items:center;gap:3.5mm;}}
.cv-tf-qr{{width:21mm;height:21mm;display:block;border-radius:1mm;background:#fff;flex:0 0 21mm;
  box-shadow:0 0 0 .5pt var(--filet);}}
.cv-tf-st img{{width:17mm;display:block;margin-bottom:1.5mm;}}

/* --- le bandeau Taxi Food, en pied de chaque page de carte --- */
.bd{{position:absolute;left:14mm;right:14mm;bottom:12mm;height:16mm;
  border:.7pt solid var(--filet);border-radius:2mm;background:rgba(13,126,163,.045);
  padding:0 5mm;display:flex;align-items:center;gap:4.5mm;}}
.bd-logo{{flex:0 0 11mm;width:11mm;height:auto;
  filter:drop-shadow(0 .8mm 2mm rgba(16,45,57,.18));}}
.bd-tx{{flex:1;min-width:0;}}
.bd-t{{font-family:'Playfair Display',serif;font-size:8.8pt;white-space:nowrap;font-weight:700;color:var(--encre);
  line-height:1.12;}}
.bd-p{{font-size:6.6pt;color:var(--gris);line-height:1.42;margin-top:.9mm;white-space:nowrap;}}
.bd-p b{{color:var(--encre);font-weight:600;}}
.bd-p b.cd{{color:var(--rouge);letter-spacing:.04em;}}
 /* PAS DE QR DANS LE BANDEAU, ET C'EST MESURE. Le QR de Taxi Food fait
   42 modules de cote ; pour qu'un telephone le lise il faut 0,40 mm par
   module, donc 17 mm de cote. Dans un bandeau de 16 mm il ne peut pas
   depasser 12 mm, ou chaque module tombe a 0,29 mm : le code serait la et
   ne se scannerait pas. Le QR vit donc ou il fonctionne — 21 mm en
   couverture, 24 mm au dos — et le bandeau porte l'adresse, qui se lit a
   n'importe quelle taille. */
.bd-ad{{flex:0 0 auto;text-align:right;line-height:1.28;}}
.bd-ad b{{display:block;font-size:7.2pt;font-weight:700;color:var(--encre);
  font-family:'Playfair Display',serif;white-space:nowrap;}}
.bd-ad span{{display:block;font-size:6pt;color:var(--rouge);font-weight:600;
  letter-spacing:.04em;margin-top:.5mm;white-space:nowrap;}}

/* --- le dos de carte --- */
.ds{{display:flex;align-items:center;justify-content:center;text-align:center;}}
.ds-in{{width:150mm;}}
.ds-logo{{width:42mm;height:42mm;display:block;margin:0 auto 4mm;border-radius:50%;
  filter:drop-shadow(0 2mm 5mm rgba(16,45,57,.16));}}
.ds-nom{{font-family:'Playfair Display',serif;font-size:26pt;font-weight:700;color:var(--encre);
  line-height:1.05;}}
.ds-sub{{font-size:7.6pt;letter-spacing:.28em;text-transform:uppercase;color:var(--gris);
  margin-top:2.6mm;}}
.ds-part{{font-size:7pt;letter-spacing:.32em;text-transform:uppercase;color:var(--gris2);
  margin-bottom:3mm;}}
.ds-tf{{width:26mm;height:auto;display:block;margin:0 auto 2.5mm;
  filter:drop-shadow(0 1.5mm 3.5mm rgba(16,45,57,.18));}}
.ds-tft{{font-family:'Playfair Display',serif;font-size:19pt;font-weight:700;color:var(--encre);
  line-height:1;}}
.ds-p{{font-size:8.4pt;color:var(--gris);line-height:1.62;margin:4.5mm auto 0;max-width:118mm;}}
.ds-code{{margin:5mm auto 0;display:inline-flex;flex-direction:column;align-items:center;
  border:.8pt solid var(--filet);border-radius:2mm;background:rgba(13,126,163,.05);
  padding:3mm 7mm;font-size:8.6pt;color:var(--encre);}}
.ds-code b{{color:var(--rouge);font-weight:700;letter-spacing:.05em;}}
.ds-code span{{display:block;font-size:7.2pt;color:var(--gris2);margin-top:.8mm;}}
.ds-dl{{display:flex;align-items:center;justify-content:center;gap:6mm;margin-top:6mm;}}
.ds-qr{{width:24mm;height:24mm;display:block;border-radius:1mm;background:#fff;
  box-shadow:0 0 0 .5pt var(--filet);}}
.ds-st img{{width:20mm;display:block;margin-bottom:1.6mm;}}
.ds-url{{font-size:6.4pt;color:var(--gris2);letter-spacing:.02em;margin-top:1.4mm;text-align:left;}}
.ds-pied{{font-size:7.4pt;color:var(--gris2);letter-spacing:.03em;}}

@page{{size:A4;margin:0;}}
@media print{{html,body{{background:var(--fond);}}}}
'''

# ---- Grossir toute la typographie -------------------------------------------
# Une seule valeur a regler. Sa clientele est touristique et melangee, mais la
# carte se lit souvent en terrasse en plein soleil : on ne descend pas sous
# 7 pt de corps reel.
ECHELLE = float(os.environ.get('ECHELLE', '1.26'))
import re as _re
_av = []
def _gros(m):
    a = float(m.group(1)); b = round(a*ECHELLE, 2)
    _av.append((a, b)); return f'font-size:{b}pt'
STYLE = _re.sub(r'font-size:([\d.]+)pt', _gros, STYLE)
STYLE = STYLE.replace('line-height:1.42', 'line-height:1.46').replace('line-height:1.36', 'line-height:1.42')
_u = sorted(set(_av))
print('\ntypographie x%s : %s' % (ECHELLE, '  '.join('%s->%spt' % (a, b) for a, b in _u)))
print('  plus petit corps de la carte : %s pt' % min(b for _, b in _u))


# ---- Le bandeau Taxi Food, un par page --------------------------------------
# « Au moins une occurrence par page », et integre a la carte plutot que colle
# dessus : meme filet, meme fond tres pale, meme famille typographique que les
# encadres d'accompagnement. Le MESSAGE CHANGE a chaque page — quatre fois la
# meme phrase, le lecteur cesse de la voir des la deuxieme.
BANDEAUX = [
    ("Cette carte est sur Taxi&nbsp;Food.",
     "Tu commandes dans l'appli, on t'apporte le plat."),
    ("Livré chez toi ou sur la plage.",
     "Toute la carte de La&nbsp;Plage, sans bouger de ta chaise."),
    ("&minus;50 % sur ta première livraison.",
     "Avec le code <b class=\"cd\">TAXIFOOD50</b>, au moment de payer."),
    ("Installe, commande, c'est livré.",
     "Sur l'App&nbsp;Store et sur Google&nbsp;Play. Le QR est au dos."),
]

def bandeau(i):
    t, p = BANDEAUX[i % len(BANDEAUX)]
    return f'''<div class="bd">
  <img class="bd-logo" src="{png('taxifood-transparent')}" alt="Taxi Food">
  <div class="bd-tx"><div class="bd-t">{t}</div><div class="bd-p">{p}</div></div>
  <div class="bd-ad"><b>taxifoodnosybe.distripro207.com</b><span>CODE TAXIFOOD50</span></div>
</div>'''

# ---- Le dos de carte ---------------------------------------------------------
DOS = f'''<section class="pg ds">
  <div class="ds-in">
    <img class="ds-logo" src="{png('logo-laplage')}" alt="La Plage">
    <div class="ds-nom">La Plage</div>
    <div class="ds-sub">{M['accroche'].replace(' · ', ' &middot; ')} &middot; {M['lieu']}</div>
    <div class="cv-fil"></div>
    <div class="ds-part">Partenaire</div>
    <img class="ds-tf" src="{png('taxifood-transparent')}" alt="Taxi Food">
    <div class="ds-tft">Taxi&nbsp;Food</div>
    <div class="ds-p">La Plage livre toute sa carte avec Taxi&nbsp;Food, le service de livraison
      de repas de Nosy&nbsp;Be. Tu choisis tes plats dans l'application, tu poses ton adresse sur
      la carte, et on te l'apporte — chez toi, à l'hôtel, ou sur la plage.
      Aucun minimum de commande. Espèces ou carte bancaire.</div>
    <div class="ds-code">Première commande : <b>TAXIFOOD50</b><span>la livraison à moitié prix</span></div>
    <div class="ds-dl">
      <img class="ds-qr" src="{png('qr')}" alt="Scanne pour commander">
      <div class="ds-st">
        <img src="{png('appstore')}" alt="App Store">
        <img src="{png('googleplay')}" alt="Google Play">
        <div class="ds-url">taxifoodnosybe.distripro207.com</div>
      </div>
    </div>
    <div class="cv-fil"></div>
    <div class="ds-pied">{M['lieu']} &nbsp;&middot;&nbsp; {M['horaires']} &nbsp;&middot;&nbsp; {M['tel']}</div>
  </div>
</section>'''

PAGES = [COUVERTURE]
