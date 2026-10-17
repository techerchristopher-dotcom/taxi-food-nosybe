# -*- coding: utf-8 -*-
"""Générateur de la vidéo « Paiement Orange Money » (Taxi Food, 9:16, 20 s).

Deuxième film de la série (le premier : ../../commande-programmee/video). Même charte, même musique,
même mécanique : un seul fichier source pour les 9 scènes, la charte écrite UNE fois ici et recopiée
dans chaque sous-composition. Les animations vivent dans motion.py, en temps locaux réels (pas
d'étirement). `python3 gen.py` réécrit compositions/frames/*.html et index.html.
"""
import os

W, H = 1080, 1920
CREME, ROUGE, OR, ENCRE, BLANC = '#F6EFE2', '#E8342A', '#FFC72C', '#18130F', '#FFFBF4'
OM = '#FF7900'          # orange Orange Money : la couleur d'action de ce film (aplats, boutons)
OMT = '#CF6200'         # le même orange, assombri pour le TEXTE sur crème (contraste ≥ 3:1)

B = 60 / 135            # un temps de la musique (135 BPM) = 0,4444 s
# (id, fichier, début en temps, durée en temps) — 64 temps = 28,4 s (v2 du 17/10 : « trop rapide »,
# tout est ralenti). La musique part de son début : sa reprise (14,196 s ≈ temps 32) tombe sur le
# #144#, et sa vraie fin (28,4 s) sur la fin de la vidéo.
SCENES_T = [
    ('f01', '01-logo', 0, 4),
    ('f02', '02-monnaie', 4, 9),
    ('f03', '03-plus-besoin', 13, 8),      # mots : x2 exact, chaque mot reste sur un temps
    ('f04', '04-choix', 21, 11),
    ('f05', '05-code', 32, 9),
    ('f06', '06-confirme', 41, 5),
    ('f07', '07-paye', 46, 6),             # mots : x2 exact
    ('f08', '08-livre', 52, 7),
    ('f09', '09-fin', 59, 5),
]
# Durées (en temps) pour lesquelles motion.py est écrit : chaque scène est étirée de nouvelle/ancienne.
ECRIT_T = {'f01': 3, 'f02': 6, 'f03': 4, 'f04': 8, 'f05': 6, 'f06': 4, 'f07': 3, 'f08': 6, 'f09': 5}
K = {c: d / ECRIT_T[c] for c, _f, _s, d in SCENES_T}
DEBUT = {c: s0 * B for c, _f, s0, _d in SCENES_T}
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
#ID .lueur.om {{ background:radial-gradient(circle, rgba(255,121,0,.22) 0%, rgba(255,121,0,0) 62%); }}
#ID .om-logo {{ display:block; background:#000; overflow:hidden; }}
#ID .om-logo img {{ width:100%; height:100%; object-fit:contain; display:block; }}
'''

BODY, CSS, FONDS = {}, {}, {}

# ------------------------------------------------------------------ 1. Logo (repris du 1er film)
BODY['f01'] = '''
<div class="lueur"></div><div class="grain"></div>
<div class="bloc">
  <div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>
  <div class="mot">Taxi Food</div>
  <div class="filet"></div>
  <div class="lieu">Nosy Be</div>
</div>'''
CSS['f01'] = f'''
#ID .bloc {{ position:absolute; left:0; right:0; top:560px; display:flex; flex-direction:column; align-items:center; }}
#ID .carre {{ width:340px; height:340px; border-radius:84px; background:{ROUGE}; display:flex; align-items:center;
  justify-content:center; box-shadow:0 40px 80px rgba(232,52,42,.35); }}
#ID .carre img {{ width:250px; height:auto; display:block; }}
#ID .mot {{ margin-top:64px; font-size:150px; font-weight:900; letter-spacing:-6px; line-height:1; }}
#ID .filet {{ margin-top:30px; width:560px; height:18px; border-radius:9px; background:{OR}; }}
#ID .lieu {{ margin-top:34px; font-size:34px; font-weight:800; letter-spacing:14px; text-transform:uppercase; color:{ROUGE}; }}
'''

# ------------------------------------------------------------- 2. Pas de monnaie
BODY['f02'] = '''
<div class="lueur"></div><div class="grain"></div>
<div class="arrivee">
  <div class="ico"><img src="../../assets/taxifood-transparent.png" alt=""></div>
  <div><div class="a1">Ton livreur est devant chez toi</div><div class="a2">Ding-dong !</div></div>
</div>
<div class="apayer"><div class="lab">À payer</div><div class="mt"><span class="n">43 000</span> Ar</div></div>
<div class="billet">
  <div class="b-coin">50 000</div><div class="b-centre"><div class="b-val">50 000</div><div class="b-ar">ARIARY</div></div>
  <div class="b-coin bas">50 000</div>
</div>
<div class="bulle"><div class="qui">Le livreur</div>Désolé… j'ai pas la monnaie sur&nbsp;50&nbsp;000&nbsp;!</div>'''
CSS['f02'] = f'''
#ID .arrivee {{ position:absolute; left:80px; right:80px; top:170px; display:flex; align-items:center; gap:36px; padding:36px 40px;
  border-radius:48px; background:{BLANC}; box-shadow:0 30px 70px rgba(24,19,15,.14); }}
#ID .ico {{ width:150px; height:150px; border-radius:40px; background:{ROUGE}; display:flex; align-items:center; justify-content:center; flex:0 0 auto; }}
#ID .ico img {{ width:112px; height:auto; display:block; }}
#ID .a1 {{ font-size:46px; font-weight:900; letter-spacing:-1.5px; line-height:1.05; }}
#ID .a2 {{ margin-top:10px; font-size:40px; font-weight:700; color:{ROUGE}; }}
#ID .apayer {{ position:absolute; left:80px; right:80px; top:500px; text-align:center; }}
#ID .lab {{ font-size:44px; font-weight:800; letter-spacing:12px; text-transform:uppercase; color:rgba(24,19,15,.5); }}
#ID .mt {{ margin-top:6px; font-size:200px; font-weight:900; letter-spacing:-9px; line-height:1; font-variant-numeric:tabular-nums; }}
#ID .billet {{ position:absolute; left:140px; top:880px; width:800px; height:400px; border-radius:30px;
  background:linear-gradient(135deg,#c9a86b 0%,#e8d3a1 45%,#b98f4f 100%);
  box-shadow:inset 0 0 0 14px rgba(255,255,255,.35), inset 0 0 0 18px rgba(90,60,20,.35), 0 40px 80px rgba(24,19,15,.28); }}
#ID .b-coin {{ position:absolute; left:46px; top:34px; font-size:46px; font-weight:900; color:rgba(70,45,10,.75); letter-spacing:-1px; }}
#ID .b-coin.bas {{ left:auto; top:auto; right:46px; bottom:34px; }}
#ID .b-centre {{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; }}
#ID .b-val {{ font-size:150px; font-weight:900; letter-spacing:-6px; white-space:nowrap; color:rgba(70,45,10,.85); line-height:1; }}
#ID .b-ar {{ margin-top:6px; font-size:34px; font-weight:800; letter-spacing:18px; color:rgba(70,45,10,.6); }}
#ID .bulle {{ position:absolute; left:110px; right:110px; top:1390px; padding:44px 54px; border-radius:56px 56px 56px 12px;
  background:{ENCRE}; color:#fff; font-size:66px; font-weight:900; letter-spacing:-2px; line-height:1.08;
  box-shadow:0 0 0 8px {OR}, 0 30px 60px rgba(0,0,0,.3); }}
#ID .qui {{ font-size:32px; font-weight:800; letter-spacing:6px; text-transform:uppercase; color:{OR}; margin-bottom:14px; }}
'''

# ------------------------------------------------------------- mots plein cadre
def mots(fond, lignes):
    html = ''.join(f'<div class="w" style="color:{c};font-size:{t}px;">{m}</div>' for m, c, t in lignes)
    return fond, f'<div class="grain"></div><div class="mots">{html}</div>'

MOTS_CSS = '''
#ID .mots { position:absolute; left:70px; right:70px; top:0; bottom:0; display:flex; flex-direction:column;
  justify-content:center; gap:6px; }
#ID .w { font-weight:900; line-height:.9; letter-spacing:-8px; text-transform:uppercase; white-space:nowrap; }
'''
FONDS['f03'], BODY['f03'] = mots(ENCRE, [('Plus', BLANC, 220), ('besoin', BLANC, 220),
                                          ('de', 'rgba(255,251,244,.4)', 170), ('monnaie.', OM, 150)])
CSS['f03'] = MOTS_CSS
FONDS['f07'], BODY['f07'] = mots(OM, [('Payé.', ENCRE, 270), ('Rien à', ENCRE, 196), ('sortir.', ENCRE, 220)])
CSS['f07'] = MOTS_CSS

# ------------------------------------------------------------- 4. Choisis Orange Money
BODY['f04'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="recap">
  <div class="vign"><img src="../../assets/c2.png" alt="" data-layout-allow-overflow></div>
  <div class="rt"><div class="pn">La Cabane</div><div class="pr">Tacos · livraison comprise</div></div>
  <div class="tot">43 000 Ar</div>
</div>
<div class="feuille">
  <div class="poignee"></div>
  <div class="q">Comment veux-tu<br>payer ?</div>
  <div class="modes">
    <div class="mode m1"><div class="mi">💵</div><div class="mn">Espèces<div class="ms">au livreur</div></div></div>
    <div class="mode m2"><div class="mi">💳</div><div class="mn">Carte bancaire<div class="ms">Visa, Mastercard</div></div></div>
    <div class="mode m3"><div class="om-logo mlogo"><img src="../../assets/om-logo.png" alt=""></div>
      <div class="mn">Orange Money<div class="ms">Paie maintenant, sans frais</div></div><div class="neuf">Nouveau</div></div>
    <div class="sel"></div>
  </div>
  <div class="bouton"><div class="onde"></div><span>Payer 43 000 Ar</span></div>
</div>'''
CSS['f04'] = f'''
#ID .recap {{ position:absolute; left:80px; right:80px; top:170px; display:flex; align-items:center; gap:34px; padding:32px;
  border-radius:48px; background:{BLANC}; box-shadow:0 30px 70px rgba(24,19,15,.12); }}
#ID .vign {{ width:150px; height:150px; border-radius:32px; overflow:hidden; background:#1d1814; flex:0 0 auto; }}
#ID .vign img {{ width:100%; height:100%; object-fit:cover; transform:scale(1.4); display:block; }}
#ID .rt {{ flex:1; }}
#ID .pn {{ font-size:54px; font-weight:900; letter-spacing:-2px; }}
#ID .pr {{ margin-top:6px; font-size:32px; font-weight:500; color:rgba(24,19,15,.6); }}
#ID .tot {{ font-size:50px; font-weight:900; letter-spacing:-1.5px; white-space:nowrap; }}
#ID .feuille {{ position:absolute; left:0; right:0; bottom:0; height:1420px; border-radius:72px 72px 0 0; background:{BLANC};
  box-shadow:0 -30px 90px rgba(24,19,15,.18); padding:40px 80px 0; }}
#ID .poignee {{ width:140px; height:14px; border-radius:7px; background:rgba(24,19,15,.15); margin:0 auto 60px; }}
#ID .q {{ font-size:96px; font-weight:900; letter-spacing:-4px; line-height:1.0; }}
#ID .modes {{ position:relative; margin-top:60px; display:flex; flex-direction:column; gap:28px; }}
#ID .mode {{ position:relative; height:190px; border-radius:44px; display:flex; align-items:center; gap:36px; padding:0 40px;
  background:{CREME}; box-shadow:inset 0 0 0 4px rgba(24,19,15,.10); }}
#ID .mi {{ width:110px; height:110px; border-radius:30px; background:{BLANC}; display:flex; align-items:center; justify-content:center;
  font-size:64px; flex:0 0 auto; }}
#ID .mlogo {{ width:110px; height:110px; border-radius:30px; flex:0 0 auto; }}
#ID .mn {{ font-size:58px; font-weight:900; letter-spacing:-2px; line-height:1.05; }}
#ID .ms {{ font-size:32px; font-weight:600; letter-spacing:0; color:rgba(24,19,15,.55); margin-top:4px; }}
#ID .mode.on {{ background:{OM}; box-shadow:0 26px 54px rgba(255,121,0,.35); }}
#ID .mode.on .mn {{ color:#fff; }}
#ID .mode.on .ms {{ color:rgba(255,255,255,.85); }}
#ID .neuf {{ position:absolute; right:34px; top:50%; margin-top:-28px; padding:10px 22px; border-radius:30px; background:{ENCRE}; color:{OR};
  font-size:30px; font-weight:900; letter-spacing:2px; text-transform:uppercase; }}
#ID .sel {{ position:absolute; left:0; top:0; width:100%; height:190px; border-radius:44px; box-shadow:0 0 0 10px {OR}; pointer-events:none; }}
#ID .bouton {{ position:absolute; left:80px; right:80px; bottom:110px; height:170px; border-radius:85px; background:{OM};
  color:#fff; display:flex; align-items:center; justify-content:center; font-size:62px; font-weight:900; letter-spacing:-1px;
  box-shadow:0 30px 60px rgba(255,121,0,.4); overflow:hidden; }}
#ID .onde {{ position:absolute; left:50%; top:50%; width:320px; height:320px; margin:-160px 0 0 -160px; border-radius:50%; background:rgba(255,255,255,.55); }}
#ID .bouton span {{ position:relative; }}
'''

# ------------------------------------------------------------- 5. #144# et le code
TOUCHES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#']
BODY['f05'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="titre">Ton code de paiement&nbsp;: tape</div>
<div class="ecranTel"><span class="saisie"></span><span class="curseur"></span></div>
<div class="clavier">''' + ''.join(f'<div class="k k{t if t.isdigit() else ("e" if t=="*" else "d")}">{t}</div>' for t in TOUCHES) + '''</div>
<div class="code" data-layout-allow-overflow>
  <div class="cl">Code de paiement</div>
  <div class="cases">''' + ''.join(f'<div class="c c{i}"><span>{d}</span></div>' for i, d in enumerate('747112')) + '''</div>
</div>'''
CSS['f05'] = f'''
#ID .titre {{ position:absolute; left:0; right:0; top:170px; text-align:center; font-size:70px; font-weight:900; letter-spacing:-2.5px; }}
#ID .ecranTel {{ position:absolute; left:0; right:0; top:280px; height:240px; display:flex; align-items:center; justify-content:center; }}
#ID .saisie {{ font-size:230px; font-weight:900; letter-spacing:-6px; color:{OMT}; line-height:1; font-variant-numeric:tabular-nums; }}
#ID .curseur {{ width:12px; height:190px; margin-left:12px; border-radius:6px; background:{ENCRE}; }}
#ID .clavier {{ position:absolute; left:150px; right:150px; top:600px; display:grid; grid-template-columns:repeat(3,1fr); gap:30px 46px; }}
#ID .k {{ height:170px; border-radius:85px; background:{BLANC}; display:flex; align-items:center; justify-content:center;
  font-size:80px; font-weight:800; box-shadow:0 14px 30px rgba(24,19,15,.10), inset 0 0 0 4px rgba(24,19,15,.06); }}
#ID .code {{ position:absolute; left:70px; right:70px; top:1180px; padding:50px 46px 56px; border-radius:56px; background:{ENCRE};
  box-shadow:0 40px 90px rgba(24,19,15,.35); }}
#ID .cl {{ font-size:40px; font-weight:800; letter-spacing:8px; text-transform:uppercase; color:{OR}; text-align:center; }}
#ID .cases {{ margin-top:40px; display:flex; justify-content:center; gap:22px; }}
#ID .c {{ width:126px; height:170px; border-radius:30px; background:rgba(255,255,255,.08); box-shadow:inset 0 0 0 4px rgba(255,255,255,.18);
  display:flex; align-items:center; justify-content:center; font-size:110px; font-weight:900; color:#fff; }}
'''

# ------------------------------------------------------------- 6. Paiement confirmé
ECLATS = [(-330, -300, OM), (330, -280, OR), (-400, 40, OR), (400, 60, OM), (-260, 330, OM), (270, 340, OR),
          (0, -420, OR), (-120, 430, ROUGE), (140, -440, ROUGE), (420, -120, OM), (-430, -110, ROUGE), (60, 450, OM)]
BODY['f06'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="centre">''' + ''.join(f'<div class="ec e{i}" style="background:{c};"></div>' for i, (x, y, c) in enumerate(ECLATS)) + '''
  <div class="disque"><svg viewBox="0 0 200 200"><path class="trait" d="M52 104 L88 140 L152 66" fill="none" stroke="#fff"
    stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
</div>
<div class="txt">
  <div class="t1">Paiement confirmé</div>
  <div class="t2">43 000 Ar · Orange Money</div>
  <div class="t3">La Cabane reçoit ta commande</div>
</div>'''
CSS['f06'] = f'''
#ID .centre {{ position:absolute; left:540px; top:690px; width:0; height:0; }}
#ID .disque {{ position:absolute; left:-230px; top:-230px; width:460px; height:460px; border-radius:50%; background:{OM};
  box-shadow:0 0 0 22px rgba(255,121,0,.18), 0 40px 90px rgba(255,121,0,.45); display:flex; align-items:center; justify-content:center; }}
#ID .disque svg {{ width:300px; height:300px; }}
#ID .ec {{ position:absolute; left:-22px; top:-22px; width:44px; height:44px; border-radius:12px; }}
#ID .txt {{ position:absolute; left:60px; right:60px; top:1060px; text-align:center; }}
#ID .t1 {{ font-size:118px; font-weight:900; letter-spacing:-5px; line-height:1; }}
#ID .t2 {{ margin-top:34px; font-size:56px; font-weight:800; color:{OMT}; }}
#ID .t3 {{ margin-top:22px; font-size:44px; font-weight:600; color:rgba(24,19,15,.6); }}
'''

# ------------------------------------------------------------- 8. Le livreur est là
BODY['f08'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="tel">
  <div class="ecran">
    <div class="fond"></div>
    <div class="ilot">
      <div class="haut"><div class="ico"><img src="../../assets/taxifood-transparent.png" alt=""></div>
        <div class="marque">Taxi Food</div><div class="eta">Arrivé</div></div>
      <div class="l1">Ton livreur est devant chez toi</div>
      <div class="paye"><div class="om-logo pl"><img src="../../assets/om-logo.png" alt=""></div>
        <div class="pt">Déjà payé · Orange Money</div><div class="ok">✓</div></div>
    </div>
    <div class="plat"><img src="../../assets/c2.png" alt="" data-layout-allow-overflow></div>
    <div class="bon">Rien à sortir.<br><span>Bon appétit&nbsp;!</span></div>
  </div>
</div>'''
CSS['f08'] = f'''
#ID .tel {{ position:absolute; left:110px; top:200px; width:860px; height:1580px; border-radius:130px; background:{ENCRE};
  padding:26px; box-shadow:0 60px 120px rgba(24,19,15,.35); }}
#ID .ecran {{ position:relative; width:100%; height:100%; border-radius:106px; overflow:hidden; }}
#ID .fond {{ position:absolute; inset:0; background:radial-gradient(120% 90% at 20% 110%, {OR} 0%, {OM} 45%, #a33f00 100%); }}
#ID .ilot {{ position:absolute; left:34px; right:34px; top:34px; padding:40px 44px 44px; border-radius:76px; background:#0e0b09; color:#fff; }}
#ID .haut {{ display:flex; align-items:center; gap:24px; }}
#ID .ico {{ width:96px; height:96px; border-radius:26px; background:{ROUGE}; display:flex; align-items:center; justify-content:center; }}
#ID .ico img {{ width:72px; height:auto; display:block; }}
#ID .marque {{ font-size:46px; font-weight:900; flex:1; }}
#ID .eta {{ font-size:42px; font-weight:900; color:{OR}; }}
#ID .l1 {{ margin-top:30px; font-size:48px; font-weight:700; line-height:1.1; }}
#ID .paye {{ margin-top:28px; display:flex; align-items:center; gap:22px; padding:20px 24px; border-radius:36px; background:rgba(255,121,0,.18);
  box-shadow:inset 0 0 0 3px rgba(255,121,0,.6); }}
#ID .pl {{ width:74px; height:74px; border-radius:20px; flex:0 0 auto; }}
#ID .pt {{ flex:1; font-size:38px; font-weight:800; color:#fff; }}
#ID .ok {{ width:64px; height:64px; border-radius:50%; background:{OM}; color:#fff; display:flex; align-items:center; justify-content:center;
  font-size:40px; font-weight:900; }}
#ID .plat {{ position:absolute; left:110px; right:110px; top:640px; height:470px; border-radius:60px; overflow:hidden; background:#1d1814;
  box-shadow:0 40px 80px rgba(0,0,0,.35); }}
#ID .plat img {{ width:100%; height:100%; object-fit:cover; transform:scale(1.25); display:block; }}
#ID .bon {{ position:absolute; left:0; right:0; top:1190px; text-align:center; font-size:92px; font-weight:900; letter-spacing:-4px;
  line-height:1.02; color:#fff; }}
#ID .bon span {{ color:{ENCRE}; }}
'''

# ------------------------------------------------------------- 9. Fin
BODY['f09'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="bloc">
  <div class="duo">
    <div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>
    <div class="fois">×</div>
    <div class="om-logo omc"><img src="../../assets/om-logo.png" alt=""></div>
  </div>
  <div class="phrase">Paie avec<br><span>Orange Money</span><br>dans l'appli.</div>
  <div class="frais">Sans frais</div>
  <div class="badges"><img src="../../assets/appstore.png" alt=""><img src="../../assets/googleplay.png" alt=""></div>
  <div class="url">taxifoodnosybe.distripro207.com</div>
</div>'''
CSS['f09'] = f'''
#ID .bloc {{ position:absolute; left:0; right:0; top:250px; display:flex; flex-direction:column; align-items:center; text-align:center; }}
#ID .duo {{ display:flex; align-items:center; gap:46px; }}
#ID .carre {{ width:250px; height:250px; border-radius:62px; background:{ROUGE}; display:flex; align-items:center; justify-content:center;
  box-shadow:0 30px 60px rgba(232,52,42,.35); }}
#ID .carre img {{ width:184px; height:auto; display:block; }}
#ID .fois {{ font-size:110px; font-weight:900; color:rgba(24,19,15,.6); }}
#ID .omc {{ width:250px; height:250px; border-radius:62px; box-shadow:0 30px 60px rgba(0,0,0,.3); }}
#ID .phrase {{ margin-top:100px; font-size:110px; font-weight:900; letter-spacing:-5px; line-height:1.0; }}
#ID .phrase span {{ color:{OMT}; }}
#ID .frais {{ margin-top:56px; padding:22px 52px; border-radius:60px; background:{ENCRE}; color:{OR}; font-size:52px; font-weight:900;
  letter-spacing:4px; text-transform:uppercase; }}
#ID .badges {{ margin-top:90px; display:flex; gap:28px; }}
#ID .badges img {{ height:120px; width:auto; display:block; }}
#ID .url {{ margin-top:56px; font-size:38px; font-weight:700; color:rgba(24,19,15,.55); }}
'''

import motion, re

def etirer(js, k):
    js = re.sub(r'duration:([0-9.]+)', lambda m: 'duration:%.3f' % (float(m.group(1)) * k), js)
    js = re.sub(r'\}, ([0-9.]+)\);', lambda m: '}, %.3f);' % (float(m.group(1)) * k), js)
    return js

MOTION = {c: etirer(motion.M[c], K[c]) for c, _f, _s, _d in SCENES}


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
    total = round(SCENES[-1][2] + SCENES[-1][3], 4)
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
# Même musique que le 1er film (HeyGen bgm_001, 135 BPM) prise de 8,418 s : la reprise (14,196 s)
# tombe au temps 13, sur l'écran de paiement. Effets : (fichier, début global en s, volume), posés
# un peu avant le geste (pic du whoosh 0,16 s, pop 0,12 s, carillon 0,24 s).
def t(beat, local=0.0):
    return round(beat * B + local, 3)

MUSIQUE = ('assets/audio/musique.wav', 0.0, 0.6)
# (scène, temps LOCAL tel qu'écrit dans motion.py, effet, volume) : le temps est étiré comme l'animation.
SFX_L = [
    ('f01', 0.00, 'whoosh', 0.55), ('f01', 0.10, 'pop', 0.5), ('f01', 0.62, 'scintille', 0.35),
    ('f02', -0.25, 'whoosh', 0.6), ('f02', 0.15, 'pop', 0.5), ('f02', 0.55, 'pop', 0.45),
    ('f02', 0.95, 'whoosh', 0.55), ('f02', 1.70, 'impact', 0.75),
    ('f03', -0.2, 'whoosh', 0.6), ('f03', -0.03, 'impact', 0.65), ('f03', B - 0.1, 'pop', 0.55),
    ('f03', 2 * B - 0.1, 'pop', 0.5), ('f03', 3 * B - 0.03, 'impact', 0.75),
    ('f04', -0.15, 'whoosh', 0.65), ('f04', 0.2, 'whoosh', 0.4), ('f04', 0.75, 'pop', 0.4),
    ('f04', 1.30, 'clic', 0.7), ('f04', 1.72, 'clic', 0.7), ('f04', 2.14, 'clic', 0.75), ('f04', 2.20, 'scintille', 0.3),
    ('f04', 3.00, 'clic', 0.8), ('f04', 3.30, 'whoosh', 0.6),
    ('f05', 0.40, 'clic', 0.7), ('f05', 0.62, 'clic', 0.7), ('f05', 0.84, 'clic', 0.7), ('f05', 1.06, 'clic', 0.7),
    ('f05', 1.28, 'clic', 0.75), ('f05', 1.35, 'whoosh', 0.45),
    ('f05', 1.58, 'pop', 0.45), ('f05', 1.71, 'pop', 0.45), ('f05', 1.84, 'pop', 0.45), ('f05', 1.97, 'pop', 0.45),
    ('f05', 2.10, 'pop', 0.45), ('f05', 2.23, 'pop', 0.5), ('f05', 2.45, 'whoosh', 0.6),
    ('f06', 0.05, 'impact', 0.65), ('f06', 0.2, 'carillon', 0.6), ('f06', 0.35, 'scintille', 0.4), ('f06', 1.6, 'whoosh', 0.6),
    ('f07', -0.03, 'impact', 0.75), ('f07', B - 0.03, 'impact', 0.6), ('f07', 2 * B - 0.03, 'impact', 0.7), ('f07', 2 * B + 0.25, 'whoosh', 0.55),
    ('f08', 0.0, 'whoosh', 0.4), ('f08', 0.55, 'carillon', 0.6), ('f08', 1.1, 'pop', 0.45), ('f08', 1.5, 'pop', 0.45),
    ('f08', 1.8, 'scintille', 0.3), ('f08', 2.45, 'whoosh', 0.5),
    ('f09', 0.05, 'pop', 0.45), ('f09', 0.25, 'pop', 0.45), ('f09', 0.5, 'scintille', 0.4), ('f09', 1.1, 'pop', 0.4),
]
# Un effet placé AVANT le geste (pic du son) garde son avance : seul le geste est étiré.
AVANCE = {'whoosh': 0.16, 'pop': 0.12, 'carillon': 0.24, 'impact': 0.03, 'clic': 0.0, 'scintille': 0.0, 'tic': 0.0}
SFX = [(nom, round(DEBUT[c] + (loc + AVANCE[nom]) * K[c] - AVANCE[nom], 3), v) for c, loc, nom, v in SFX_L]
DUREES = {'whoosh': 0.6, 'pop': 0.7, 'impact': 2.1, 'clic': 0.4, 'tic': 0.4, 'carillon': 2.5, 'scintille': 1.8}


def audio_html(total):
    f, debut, vol = MUSIQUE
    pts = '[{"t":0,"v":0},{"t":0.12,"v":1},{"t":%s,"v":1},{"t":%s,"v":0}]' % (round(total - 0.5, 3), total)
    lignes = [f'      <audio id="musique" src="{f}" data-start="0" data-duration="{total}" data-media-start="{debut}" '
              f'data-track-index="5" data-volume="{vol}" data-automation=\'{{"version":1,"lanes":[{{"target":"volume","points":{pts}}}]}}\'></audio>']
    fins = []
    for i, (nom, tt, v) in enumerate(sorted(SFX, key=lambda s: s[1])):
        tt = max(0.0, tt)
        d = min(DUREES[nom], round(total - tt, 3))
        piste = next((k for k, f_ in enumerate(fins) if f_ <= tt), None)
        if piste is None:
            fins.append(0); piste = len(fins) - 1
        fins[piste] = tt + d
        lignes.append(f'      <audio id="sfx{i:02d}-{nom}" src="assets/audio/{nom}.mp3" data-start="{tt}" data-duration="{d}" '
                      f'data-track-index="{6 + piste}" data-volume="{v}"></audio>')
    return '\n'.join(lignes)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs('compositions/frames', exist_ok=True)
    for cid, f, s, d in SCENES:
        open(f'compositions/frames/{f}.html', 'w', encoding='utf-8').write(frame(cid, f))
    open('index.html', 'w', encoding='utf-8').write(index())
    print('ok :', len(SCENES), 'scènes,', SCENES[-1][2] + SCENES[-1][3], 's')
