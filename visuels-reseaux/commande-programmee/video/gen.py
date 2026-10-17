# -*- coding: utf-8 -*-
"""Générateur de la vidéo « Commande pour plus tard » (Taxi Food, 9:16, 20 s).

Un seul fichier source pour les 9 scènes : la charte (couleurs, police, grain) est écrite UNE fois
ici et recopiée dans chaque sous-composition, ce qui garde la série cohérente. `python3 gen.py`
réécrit compositions/frames/*.html et index.html.

Passe actuelle : CROQUIS (review-loop § 2) — chaque scène est posée à son moment clé, sans
mouvement. Les animations s'ajoutent dans MOTION[...] à la passe suivante.
"""
import os

W, H = 1080, 1920
CREME, ROUGE, OR, ENCRE, BLANC = '#F6EFE2', '#E8342A', '#FFC72C', '#18130F', '#FFFBF4'

# (id, fichier, début, durée)
B = 60 / 135          # un temps de la musique (135 BPM) = 0,4444 s
# (id, fichier, début en temps, durée en temps) — 45 temps = 20,0 s, chaque coupe sur un temps
SCENES_T = [
    ('f01', '01-logo', 0, 3),
    ('f02', '02-ferme', 3, 5),
    ('f03', '03-quand-meme', 8, 5),
    ('f04', '04-heure', 13, 8),       # 13 = la reprise de la musique (drop)
    ('f05', '05-choisis', 21, 3),
    ('f06', '06-frise', 24, 9),
    ('f07', '07-livre', 33, 3),
    ('f08', '08-notif', 36, 5),
    ('f09', '09-fin', 41, 4),
]
SCENES = [(c, f, round(s0 * B, 4), round(d * B, 4)) for c, f, s0, d in SCENES_T]

BASE_CSS = f'''
#ID {{ position:absolute; inset:0; overflow:hidden; font-family:Archivo,"Helvetica Neue",Arial,sans-serif;
  -webkit-font-smoothing:antialiased; color:{ENCRE}; background:{CREME}; }}
#ID .cam, #ID .push {{ position:absolute; inset:0; will-change:transform; }}
#ID .push {{ perspective:2400px; }}
#ID .grain {{ position:absolute; inset:0; pointer-events:none; opacity:.35;
  background-image:radial-gradient(rgba(24,19,15,.10) 1px, transparent 1.2px);
  background-size:6px 6px; }}
#ID .lueur {{ position:absolute; width:1400px; height:1400px; border-radius:50%; left:-160px; top:260px;
  background:radial-gradient(circle, rgba(255,199,44,.28) 0%, rgba(255,199,44,0) 62%); }}
#ID .fantome {{ position:absolute; left:-40px; font-size:420px; font-weight:900; line-height:.85;
  letter-spacing:-18px; color:rgba(232,52,42,.07); white-space:nowrap; }}
'''

# --------------------------------------------------------------- les scènes
BODY = {}

BODY['f01'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="bloc">
  <div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>
  <div class="mot">Taxi Food</div>
  <div class="filet"></div>
  <div class="lieu">Nosy Be</div>
</div>'''
CSS = {}
CSS['f01'] = f'''
#ID .bloc {{ position:absolute; left:0; right:0; top:560px; display:flex; flex-direction:column; align-items:center; }}
#ID .carre {{ width:340px; height:340px; border-radius:84px; background:{ROUGE}; display:flex; align-items:center;
  justify-content:center; box-shadow:0 40px 80px rgba(232,52,42,.35); }}
#ID .carre img {{ width:250px; height:auto; display:block; }}
#ID .mot {{ margin-top:64px; font-size:150px; font-weight:900; letter-spacing:-6px; line-height:1; }}
#ID .filet {{ margin-top:30px; width:560px; height:18px; border-radius:9px; background:{OR}; }}
#ID .lieu {{ margin-top:34px; font-size:34px; font-weight:800; letter-spacing:14px; text-transform:uppercase; color:{ROUGE}; }}
'''

BODY['f02'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="horloge">
  <svg viewBox="0 0 120 120" class="cadran"><circle cx="60" cy="60" r="52" fill="none" stroke="{ENCRE}" stroke-width="9"/>
    <line x1="60" y1="60" x2="60" y2="24" stroke="{ENCRE}" stroke-width="9" stroke-linecap="round"/>
    <line x1="60" y1="60" x2="36" y2="60" stroke="{ROUGE}" stroke-width="9" stroke-linecap="round"/></svg>
  <div class="heure">10:00</div>
</div>
<div class="carte">
  <div class="photo"><img src="../../assets/c2.png" alt="" data-layout-allow-overflow></div>
  <div class="logo"><img src="../../assets/logo-cabane.jpg" alt=""></div>
  <div class="nom">La Cabane</div>
  <div class="type">Tacos, burgers · Ambatoloaka</div>
  <div class="badge">Fermé · Ouvre à 16h</div>
  <div class="plustard">Commander pour plus tard</div>
</div>'''
CSS['f02'] = f'''
#ID .horloge {{ position:absolute; left:80px; top:170px; display:flex; align-items:center; gap:34px; }}
#ID .cadran {{ width:150px; height:150px; }}
#ID .heure {{ font-size:190px; font-weight:900; letter-spacing:-8px; line-height:1; font-variant-numeric:tabular-nums; }}
#ID .carte {{ position:absolute; left:80px; right:80px; top:480px; height:1250px; border-radius:64px; background:{BLANC};
  box-shadow:0 50px 110px rgba(24,19,15,.18), 0 0 0 4px rgba(24,19,15,.06); overflow:hidden; }}
#ID .photo {{ height:700px; background:#1d1814; overflow:hidden; }}
#ID .photo img {{ width:100%; height:100%; object-fit:cover; transform:scale(1.35); display:block; }}
#ID .logo {{ position:absolute; left:60px; top:600px; width:200px; height:200px; border-radius:50%; overflow:hidden;
  box-shadow:0 0 0 10px {BLANC}, 0 16px 34px rgba(0,0,0,.25); }}
#ID .logo img {{ width:100%; height:100%; object-fit:cover; display:block; }}
#ID .nom {{ position:absolute; left:60px; top:840px; font-size:92px; font-weight:900; letter-spacing:-3px; }}
#ID .type {{ position:absolute; left:60px; top:956px; font-size:38px; font-weight:500; color:rgba(24,19,15,.6); }}
#ID .plustard {{ position:absolute; left:60px; right:60px; top:1060px; height:130px; border-radius:65px; display:flex;
  align-items:center; justify-content:center; font-size:46px; font-weight:900; color:{ROUGE}; box-shadow:inset 0 0 0 5px {ROUGE}; }}
#ID .badge {{ position:absolute; right:56px; top:612px; padding:22px 34px; border-radius:60px; background:{ENCRE}; color:#fff;
  font-size:42px; font-weight:900; letter-spacing:-.5px; box-shadow:0 0 0 6px {OR}, 0 20px 40px rgba(0,0,0,.3); }}
'''

def mots(fond, lignes):
    """Mots plein cadre. lignes = [(texte, couleur, taille)]."""
    html = ''.join(f'<div class="w" style="color:{c};font-size:{t}px;">{m}</div>' for m, c, t in lignes)
    return fond, f'<div class="grain"></div><div class="mots">{html}</div>'

MOTS_CSS = f'''
#ID .mots {{ position:absolute; left:70px; right:70px; top:0; bottom:0; display:flex; flex-direction:column;
  justify-content:center; gap:6px; }}
#ID .w {{ font-weight:900; line-height:.9; letter-spacing:-8px; text-transform:uppercase; white-space:nowrap; }}
'''

FONDS = {}
FONDS['f03'], BODY['f03'] = mots(ENCRE, [('Resto', 'rgba(255,251,244,.35)', 170), ('fermé ?', 'rgba(255,251,244,.35)', 170),
                                          ('Commande', BLANC, 148), ('quand', ROUGE, 205), ('même.', ROUGE, 205)])
CSS['f03'] = MOTS_CSS
FONDS['f05'], BODY['f05'] = mots(CREME, [('Choisis', ENCRE, 196), ('ton', ENCRE, 196), ('heure.', ROUGE, 220)])
CSS['f05'] = MOTS_CSS
FONDS['f07'], BODY['f07'] = mots(ENCRE, [('Livré', BLANC, 250), ("à l'heure.", OR, 150)])
CSS['f07'] = MOTS_CSS

BODY['f04'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="panier">
  <div class="vign"><img src="../../assets/c2.png" alt="" data-layout-allow-overflow></div>
  <div><div class="pn">Tacos</div><div class="pr">La Cabane · fermé jusqu'à 16h</div></div>
</div>
<div class="feuille">
  <div class="poignee"></div>
  <div class="q">Quand veux-tu<br>être livré ?</div>
  <div class="chips">
    <div class="chip">18:30</div><div class="chip">18:45</div>
    <div class="chip on">19:00</div><div class="chip">19:15</div>
    <div class="sel"></div>
  </div>
  <div class="note">La Cabane reçoit ta commande à son ouverture et la prépare pour 19h00.</div>
  <div class="bouton"><div class="onde"></div><span>Commander pour 19h00</span></div>
</div>'''
CSS['f04'] = f'''
#ID .panier {{ position:absolute; left:80px; right:80px; top:200px; display:flex; align-items:center; gap:40px; padding:36px;
  border-radius:48px; background:{BLANC}; box-shadow:0 30px 70px rgba(24,19,15,.12); }}
#ID .vign {{ width:190px; height:190px; border-radius:36px; overflow:hidden; background:#1d1814; flex:0 0 auto; }}
#ID .vign img {{ width:100%; height:100%; object-fit:cover; transform:scale(1.4); display:block; }}
#ID .pn {{ font-size:64px; font-weight:900; letter-spacing:-2px; }}
#ID .pr {{ margin-top:8px; font-size:34px; font-weight:500; color:rgba(24,19,15,.6); }}
#ID .feuille {{ position:absolute; left:0; right:0; bottom:0; height:1340px; border-radius:72px 72px 0 0; background:{BLANC};
  box-shadow:0 -30px 90px rgba(24,19,15,.18); padding:40px 80px 0; }}
#ID .poignee {{ width:140px; height:14px; border-radius:7px; background:rgba(24,19,15,.15); margin:0 auto 70px; }}
#ID .q {{ font-size:96px; font-weight:900; letter-spacing:-4px; line-height:1.0; }}
#ID .chips {{ position:relative; margin-top:70px; display:grid; grid-template-columns:1fr 1fr; gap:30px; }}
#ID .chip {{ height:170px; border-radius:40px; display:flex; align-items:center; justify-content:center; font-size:76px;
  font-weight:800; letter-spacing:-2px; background:{CREME}; box-shadow:inset 0 0 0 4px rgba(24,19,15,.12);
  font-variant-numeric:tabular-nums; }}
#ID .chip.on {{ background:{ROUGE}; color:#fff; }}
#ID .sel {{ position:absolute; left:0; top:0; width:445px; height:170px; border-radius:40px; box-shadow:0 0 0 9px {OR}; pointer-events:none; }}
#ID .onde {{ position:absolute; left:50%; top:50%; width:320px; height:320px; margin:-160px 0 0 -160px; border-radius:50%; background:rgba(255,255,255,.55); }}
#ID .bouton span {{ position:relative; }}
#ID .note {{ margin-top:60px; font-size:38px; font-weight:500; line-height:1.3; color:rgba(24,19,15,.65); }}
#ID .bouton {{ position:absolute; left:80px; right:80px; bottom:110px; height:170px; border-radius:85px; background:{ROUGE};
  color:#fff; display:flex; align-items:center; justify-content:center; font-size:62px; font-weight:900; letter-spacing:-1px;
  box-shadow:0 30px 60px rgba(232,52,42,.4); overflow:hidden; }}
'''

BODY['f06'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="fantome" aria-hidden="true" data-layout-allow-overflow style="top:1610px;">10h 16h 19h</div>
<div class="titre">Aujourd'hui</div>
<div class="rail"><div class="plein"></div></div>
<div class="jalon j1"><div class="pt">✓</div><div class="h">10h</div><div class="t">Tu commandes</div></div>
<div class="jalon j2"><div class="pt">✓</div><div class="h">16h</div><div class="t">La Cabane ouvre</div></div>
<div class="bulle">La Cabane a reçu ta commande</div>
<div class="scoot"><img src="../../assets/taxifood-transparent.png" alt=""></div>
<div class="jalon j3"><div class="pt vide"></div><div class="h">19h</div><div class="t">Tu es livré</div></div>'''
CSS['f06'] = f'''
#ID .titre {{ position:absolute; left:110px; top:250px; font-size:54px; font-weight:800; letter-spacing:10px; text-transform:uppercase; color:{ROUGE}; }}
#ID .rail {{ position:absolute; left:205px; top:430px; width:18px; height:1140px; border-radius:9px; background:rgba(24,19,15,.12); overflow:hidden; }}
#ID .plein {{ position:absolute; left:0; top:0; width:100%; height:100%; background:{OR}; }}
#ID .jalon {{ position:absolute; left:130px; display:flex; align-items:center; gap:46px; }}
#ID .j1 {{ top:380px; }} #ID .j2 {{ top:860px; }} #ID .j3 {{ top:1480px; }}
#ID .pt {{ width:168px; height:168px; border-radius:50%; background:{ENCRE}; color:{OR}; display:flex; align-items:center;
  justify-content:center; font-size:76px; font-weight:900; box-shadow:0 0 0 12px {CREME}; }}
#ID .pt.vide {{ background:{ROUGE}; color:#fff; }}
#ID .h {{ font-size:150px; font-weight:900; letter-spacing:-6px; line-height:1; width:300px; }}
#ID .t {{ font-size:46px; font-weight:700; color:rgba(24,19,15,.7); }}
#ID .bulle {{ position:absolute; left:320px; top:1060px; padding:30px 44px; border-radius:40px 40px 40px 8px; background:{BLANC};
  font-size:42px; font-weight:800; box-shadow:0 26px 60px rgba(24,19,15,.16), 0 0 0 4px {OR}; }}
#ID .scoot {{ position:absolute; left:145px; top:1270px; width:140px; height:140px; border-radius:36px; background:{ROUGE};
  display:flex; align-items:center; justify-content:center; box-shadow:0 20px 40px rgba(232,52,42,.4); }}
#ID .scoot img {{ width:104px; height:auto; display:block; }}
'''

BODY['f08'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="tel">
  <div class="ecran">
    <div class="fond"></div>
    <div class="ilot">
      <div class="haut"><div class="ico"><img src="../../assets/taxifood-transparent.png" alt=""></div>
        <div class="marque">Taxi Food</div><div class="eta">19:00</div></div>
      <div class="l1">Livraison prévue à <b>19h00</b></div>
      <div class="l2">La Cabane prépare ta commande</div>
      <div class="barre"><div class="rempli"></div><div class="moto"></div><div class="fin"></div></div>
    </div>
    <div class="heureTel">18:27</div>
  </div>
</div>'''
CSS['f08'] = f'''
#ID .tel {{ position:absolute; left:110px; top:220px; width:860px; height:1560px; border-radius:130px; background:{ENCRE};
  padding:26px; box-shadow:0 60px 120px rgba(24,19,15,.35); }}
#ID .ecran {{ position:relative; width:100%; height:100%; border-radius:106px; overflow:hidden; }}
#ID .fond {{ position:absolute; inset:0; background:radial-gradient(120% 90% at 20% 110%, {OR} 0%, {ROUGE} 45%, #8f1d16 100%); }}
#ID .heureTel {{ position:absolute; left:0; right:0; top:560px; text-align:center; font-size:230px; font-weight:800; color:rgba(255,251,244,.92); letter-spacing:-8px; }}
#ID .ilot {{ position:absolute; left:34px; right:34px; top:34px; padding:40px 44px 46px; border-radius:76px; background:#0e0b09; color:#fff; }}
#ID .haut {{ display:flex; align-items:center; gap:24px; }}
#ID .ico {{ width:96px; height:96px; border-radius:26px; background:{ROUGE}; display:flex; align-items:center; justify-content:center; }}
#ID .ico img {{ width:72px; height:auto; display:block; }}
#ID .marque {{ font-size:46px; font-weight:900; flex:1; }}
#ID .eta {{ font-size:46px; font-weight:900; color:{OR}; font-variant-numeric:tabular-nums; }}
#ID .l1 {{ margin-top:34px; font-size:48px; font-weight:600; }}
#ID .l1 b {{ color:{OR}; font-weight:900; }}
#ID .l2 {{ margin-top:10px; font-size:38px; font-weight:500; color:rgba(255,255,255,.7); }}
#ID .barre {{ position:relative; margin-top:40px; height:14px; border-radius:7px; background:rgba(255,255,255,.18); }}
#ID .rempli {{ position:absolute; left:0; top:0; height:100%; width:100%; border-radius:7px; background:{OR}; }}
#ID .moto {{ position:absolute; left:0; top:-17px; width:48px; height:48px; margin-left:-24px; border-radius:50%; background:{ROUGE}; box-shadow:0 0 0 6px #0e0b09; }}
#ID .fin {{ position:absolute; right:-6px; top:-8px; width:30px; height:30px; border-radius:50%; background:#fff; }}
'''

BODY['f09'] = f'''
<div class="lueur"></div><div class="grain"></div>
<div class="bloc">
  <div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>
  <div class="mot">Taxi Food</div>
  <div class="phrase">Commande à l'avance,<br><span>le jour même.</span></div>
  <div class="badges"><img src="../../assets/appstore.png" alt=""><img src="../../assets/googleplay.png" alt=""></div>
  <div class="url">taxifoodnosybe.distripro207.com</div>
</div>'''
CSS['f09'] = f'''
#ID .bloc {{ position:absolute; left:0; right:0; top:330px; display:flex; flex-direction:column; align-items:center; text-align:center; }}
#ID .carre {{ width:250px; height:250px; border-radius:62px; background:{ROUGE}; display:flex; align-items:center; justify-content:center;
  box-shadow:0 30px 60px rgba(232,52,42,.35); }}
#ID .carre img {{ width:184px; height:auto; display:block; }}
#ID .mot {{ margin-top:40px; font-size:110px; font-weight:900; letter-spacing:-4px; }}
#ID .phrase {{ margin-top:110px; font-size:82px; font-weight:900; letter-spacing:-3.5px; line-height:1.02; }}
#ID .phrase span {{ color:{ROUGE}; }}
#ID .badges {{ margin-top:120px; display:flex; gap:28px; }}
#ID .badges img {{ height:120px; width:auto; display:block; }}
#ID .url {{ margin-top:60px; font-size:38px; font-weight:700; color:rgba(24,19,15,.55); }}
'''

import motion, re
# Les animations ont été écrites pour les durées d'origine (1,5 / 2 / 3,5 / 2,5 / 2 s) : on les
# étire à la durée calée sur la musique. Les scènes de mots (f03, f05, f07) sont écrites
# directement sur les temps dans motion.py et ne sont pas étirées.
DUREE_ECRITE = {'f01': 1.5, 'f02': 2.0, 'f04': 3.5, 'f06': 4.0, 'f08': 2.5, 'f09': 2.0}

def etirer(js, k):
    js = re.sub(r'duration:([0-9.]+)', lambda m: 'duration:%.3f' % (float(m.group(1)) * k), js)
    js = re.sub(r'\}, ([0-9.]+)\);', lambda m: '}, %.3f);' % (float(m.group(1)) * k), js)
    return js

MOTION = {}
for _c, _f, _s, _d in SCENES:
    MOTION[_c] = etirer(motion.M[_c], _d / DUREE_ECRITE[_c]) if _c in DUREE_ECRITE else motion.M[_c]


def frame(cid, fichier):
    fond = FONDS.get(cid, CREME)
    css = (BASE_CSS + CSS[cid]).replace('#ID', '#' + cid)
    css = css.replace(f'#{cid} {{ position:absolute; inset:0; overflow:hidden;',
                      f'#{cid} {{ position:absolute; inset:0; overflow:hidden; background:{fond} !important;', 1)
    return f'''<!doctype html>
<html><head><meta charset="UTF-8"></head><body>
<template>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
<style>{css}</style>
<div id="{cid}" data-composition-id="{cid}" data-width="{W}" data-height="{H}"><div class="cam"><div class="push">{BODY[cid]}
</div></div></div>
<script>
(function(){{
  const tl = gsap.timeline({{ paused: true }});
  {MOTION[cid]}
  window.__timelines["{cid}"] = tl;
}})();
</script>
</template>
</body></html>
'''


def index():
    total = SCENES[-1][2] + SCENES[-1][3]
    hotes = '\n'.join(
        f'      <div id="{cid}" class="clip" data-composition-id="{cid}" data-composition-src="compositions/frames/{f}.html" '
        f'data-start="{s}" data-duration="{d}" data-track-index="1" data-width="{W}" data-height="{H}"></div>'
        for cid, f, s, d in SCENES)
    return f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ margin:0; width:{W}px; height:{H}px; overflow:hidden; background:{CREME}; }}
      #root {{ position:relative; width:100%; height:100%; background:{CREME}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{total}" data-width="{W}" data-height="{H}">
{hotes}
{audio_html(total)}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''


# ---------------------------------------------------------------- bande son
# Musique HeyGen (bgm_001, 135 BPM, licence du catalogue) prise de 8,418 s à 28,418 s : sa vraie fin
# tombe sur la fin de la vidéo, et sa reprise (14,196 s) sur l'arrivée du panneau « Quand veux-tu
# être livré ? » (temps 13). Effets : (fichier, début global en s, volume). Chaque début tient compte
# du pic de l'effet (whoosh 0,16 s, pop 0,12 s, carillon 0,24 s) pour que le pic tombe sur le geste.
MUSIQUE = ('assets/audio/musique.wav', 8.418, 0.6)
SFX = [
    ('whoosh', 0.00, 0.55), ('pop', 0.10, 0.5), ('scintille', 0.62, 0.35), ('whoosh', 1.00, 0.6),
    ('tic', 1.45, 0.45), ('tic', 1.62, 0.45), ('tic', 1.79, 0.45), ('tic', 1.96, 0.45), ('tic', 2.13, 0.45),
    ('impact', 2.62, 0.7), ('whoosh', 3.20, 0.6),
    ('impact', 3.53, 0.65), ('pop', 3.88, 0.55), ('pop', 4.32, 0.55), ('pop', 4.77, 0.55), ('impact', 5.31, 0.75),
    ('whoosh', 5.47, 0.65), ('whoosh', 5.90, 0.4), ('pop', 6.50, 0.4),
    ('clic', 7.10, 0.7), ('clic', 7.55, 0.7), ('clic', 7.99, 0.7), ('pop', 8.00, 0.45),
    ('clic', 8.82, 0.8), ('scintille', 8.85, 0.3), ('whoosh', 9.00, 0.6),
    ('impact', 9.31, 0.65), ('pop', 9.66, 0.55), ('impact', 10.20, 0.7), ('whoosh', 10.36, 0.6),
    ('pop', 10.86, 0.45), ('pop', 11.80, 0.45), ('carillon', 11.93, 0.55), ('pop', 12.40, 0.45), ('pop', 12.75, 0.45),
    ('scintille', 13.90, 0.3), ('whoosh', 14.33, 0.6),
    ('impact', 14.64, 0.7), ('impact', 15.09, 0.55), ('whoosh', 15.69, 0.55), ('whoosh', 16.00, 0.4),
    ('carillon', 16.40, 0.6), ('whoosh', 17.90, 0.5), ('scintille', 18.25, 0.4), ('pop', 18.70, 0.4),
]
DUREES = {'whoosh': 0.6, 'pop': 0.7, 'impact': 2.1, 'clic': 0.4, 'tic': 0.4, 'carillon': 2.5, 'scintille': 1.8}


def audio_html(total):
    f, debut, vol = MUSIQUE
    pts = '[{"t":0,"v":0},{"t":0.12,"v":1},{"t":%s,"v":1},{"t":%s,"v":0}]' % (round(total - 0.5, 3), total)
    lignes = [f'      <audio id="musique" src="{f}" data-start="0" data-duration="{total}" data-media-start="{debut}" '
              f'data-track-index="5" data-volume="{vol}" data-automation=\'{{"version":1,"lanes":[{{"target":"volume","points":{pts}}}]}}\'></audio>']
    fins = []                                   # fin du dernier effet posé sur chaque piste
    for i, (nom, t, v) in enumerate(SFX):
        d = min(DUREES[nom], round(total - t, 3))
        piste = next((k for k, f_ in enumerate(fins) if f_ <= t), None)
        if piste is None:
            fins.append(0); piste = len(fins) - 1
        fins[piste] = t + d
        lignes.append(f'      <audio id="sfx{i:02d}-{nom}" src="assets/audio/{nom}.mp3" data-start="{t}" data-duration="{d}" '
                      f'data-track-index="{6 + piste}" data-volume="{v}"></audio>')
    return '\n'.join(lignes)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    for cid, f, s, d in SCENES:
        open(f'compositions/frames/{f}.html', 'w', encoding='utf-8').write(frame(cid, f))
    open('index.html', 'w', encoding='utf-8').write(index())
    print('ok :', len(SCENES), 'scènes')
