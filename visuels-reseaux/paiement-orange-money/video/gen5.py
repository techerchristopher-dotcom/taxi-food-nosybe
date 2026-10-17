# -*- coding: utf-8 -*-
"""Générateur de la v5 du film « Paiement Orange Money » : voix off + 3D.

Même charte, mêmes neuf scènes et mêmes raccords que la v4 validée (gen.py, que ce fichier réutilise),
avec trois changements :
1. une voix off française (voix.py) : une réplique par scène, et chaque geste de l'image tombe sur
   l'attaque de SON mot (horodatage HeyGen). Les durées de scène découlent de la voix, arrondies au
   temps musical (135 BPM) ; la musique est allongée d'une ou deux mesures si le film dépasse 64 temps ;
2. de la vraie 3D (trois.py, Three.js) : l'icône Taxi Food en tuile laquée (f01), la pièce Orange Money
   avec sa coche en relief et des confettis 3D (f06), le duo Taxi Food × Orange Money (f09) ;
3. de la typographie en volume (extrusion CSS 3D) pour les mots plein cadre (f03, f07), et des cartes
   d'interface qui basculent en perspective (billet, feuille de paiement, clavier, encarts).

`VOIX=chloe python3 gen5.py` réécrit compositions/frames/*.html et index.html. Puis le mixage :
`node ~/.claude/skills/hyperframes-audio/scripts/carve.mjs --comp index.html` (creuse la musique sous
la voix), `npx --yes hyperframes@0.8.167 check`.
"""
import math
import os
import wave

import numpy as np

import gen as v4
import motion as v4m
import trois
import voix
from gen import W, H, CREME, ROUGE, OR, ENCRE, BLANC, OM, OMT, B

VOIX = os.environ.get('VOIX', 'chloe')
REP = voix.charger(VOIX)
OVERLAP = v4.OVERLAP

# (id, fichier, avance de la voix après la coupe (s), traîne après le dernier mot (s), minimum en temps)
PLAN = [
    ('f01', '01-logo', 0.30, 0.35, 4),
    ('f02', '02-monnaie', 0.15, 0.55, 8),
    ('f03', '03-plus-besoin', 0.20, 0.95, 5),
    ('f04', '04-choix', 0.30, 0.90, 8),
    ('f05', '05-code', 0.25, 0.70, 8),
    ('f06', '06-confirme', 0.25, 0.25, 7),
    ('f07', '07-paye', 0.12, 0.70, 5),
    ('f08', '08-livre', 0.20, 0.33, 7),
    ('f09', '09-fin', 0.20, 1.20, 9),
]


FIN_APRES_COUP = 2     # temps de musique après le coup final


def _temps():
    t = [max(mini, math.ceil((av + REP[i]['duree'] + tr) / B - 0.08)) for i, (_c, _f, av, tr, mini) in enumerate(PLAN)]
    tot = sum(t)
    # Le coup final de la musique (temps 64 de la piste) tombe DEUX temps avant la fin du film, pour
    # que sa résonance s'entende sur le carton de fin. La musique s'allonge par mesures entières
    # (4 temps) : le film fait donc 64 + 4k + 2 temps. Le complément va au carton de fin.
    cible = tot
    while cible - FIN_APRES_COUP < 64 or (cible - FIN_APRES_COUP - 64) % 4:
        cible += 1
    t[-1] += cible - tot
    return t


TEMPS = _temps()
TOTAL_T = sum(TEMPS)
DEBUT_T = [sum(TEMPS[:i]) for i in range(len(TEMPS))]
SCENES = [(c, f, round(DEBUT_T[i] * B, 4), round(TEMPS[i] * B, 4)) for i, (c, f, *_r) in enumerate(PLAN)]
TOTAL = round(TOTAL_T * B, 4)


class Ancres:
    """Temps locaux (s, depuis la coupe d'entrée de la scène) des mots de la réplique."""

    def __init__(self, i):
        self.lead = PLAN[i][2]
        self.mots = REP[i]['mots']
        self.D = round(TEMPS[i] * B, 4)
        self.fin = round(self.lead + REP[i]['duree'], 3)

    def m(self, k):      # attaque du k-ième mot
        return round(self.lead + self.mots[k][1], 3)

    def mf(self, k):     # fin du k-ième mot
        return round(self.lead + self.mots[k][2], 3)


A = {c: Ancres(i) for i, (c, *_r) in enumerate(PLAN)}


def mix(c0, c1, t):
    a = [int(c0[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[k] + (b[k] - a[k]) * t):02x}' for k in range(3))


# ================================================================ CORPS ET STYLES (repris de la v4)
BODY, CSS, FONDS = dict(v4.BODY), dict(v4.CSS), dict(v4.FONDS)
IMG_TF = '<img class="src-tf" src="../../assets/taxifood-transparent.png" alt="" style="display:none">'
IMG_OM = '<img class="src-om" src="../../assets/om-logo.png" alt="" style="display:none">'

# ------------------------------------------------- f01 : la tuile 3D remplace le carré rouge
BODY['f01'] = BODY['f01'].replace(
    '<div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>',
    '<div class="carre3d"><canvas class="trois" width="760" height="760"></canvas></div>') + IMG_TF
CSS['f01'] += f'''
#ID .carre3d {{ position:relative; width:340px; height:340px; }}
#ID .carre3d canvas {{ position:absolute; left:-210px; top:-210px; width:760px; height:760px; display:block; }}
#ID .halo {{ position:absolute; left:290px; top:480px; width:500px; height:500px; border-radius:50%;
  background:radial-gradient(circle, rgba(232,52,42,.30) 0%, rgba(232,52,42,0) 66%); }}
'''
BODY['f01'] = '<div class="halo"></div>' + BODY['f01']

# ------------------------------------------------- f03 / f07 : mots plein cadre EN VOLUME
PROF, PAS = 16, 4.5    # 16 couches, 4,5 px : 72 px d'extrusion (rule 3d-text-depth-layers, version Z vraie)


def mots3d(fond, lignes):
    html = ''
    for m, face, c0, c1, t in lignes:
        couches = ''.join(
            f'<span class="x" aria-hidden="true" data-layout-ignore style="color:{mix(c0, c1, i / (PROF - 1))};transform:translateZ(-{(i + 1) * PAS:g}px)">{m}</span>'
            for i in reversed(range(PROF)))
        html += f'<div class="w" style="font-size:{t}px;">{couches}<span class="c" style="color:{face}">{m}</span></div>'
    return fond, f'<div class="grain"></div><div class="mots">{html}</div>'


MOTS3D_CSS = '''
#ID .push { perspective:1500px; perspective-origin:50% 46%; }
#ID .mots { position:absolute; left:70px; right:70px; top:0; bottom:0; display:flex; flex-direction:column;
  justify-content:center; gap:6px; transform-style:preserve-3d; }
#ID .w { position:relative; font-weight:900; line-height:.9; letter-spacing:-8px; text-transform:uppercase;
  white-space:nowrap; transform-style:preserve-3d; }
#ID .w .c { display:block; position:relative; }
#ID .w .x { position:absolute; left:0; top:0; }
'''
FONDS['f03'], BODY['f03'] = mots3d(ENCRE, [
    ('Plus', BLANC, '#8f867d', '#2f2924', 220), ('besoin', BLANC, '#8f867d', '#2f2924', 220),
    ('de', '#857e77', '#4a443f', '#26211d', 170), ('monnaie.', OM, '#b04e00', '#3f1c00', 150)])
CSS['f03'] = MOTS3D_CSS
FONDS['f07'], BODY['f07'] = mots3d(OM, [
    ('Payé.', ENCRE, '#4a2200', '#a44a00', 270), ('Rien à', ENCRE, '#4a2200', '#a44a00', 196),
    ('sortir.', ENCRE, '#4a2200', '#a44a00', 220)])
CSS['f07'] = MOTS3D_CSS

# ------------------------------------------------- f02 / f04 / f05 / f08 : profondeur des cartes
# (v4 : la pastille coupait « Orange / Money » ; une espace insécable garde le nom entier sur sa ligne)
BODY['f08'] = BODY['f08'].replace('Déjà payé · Orange Money', 'Déjà payé · Orange&nbsp;Money')
assert 'Orange&nbsp;Money' in BODY['f08']
CSS['f05'] += '\n#ID .clavier { transform-style:preserve-3d; }\n'

# ------------------------------------------------- f06 : la pièce 3D remplace le disque et les éclats
BODY['f06'] = '''
<div class="lueur om"></div><div class="grain"></div>
<div class="halo"></div><div class="anneau"></div>
<canvas class="trois" width="1080" height="1240"></canvas>
<div class="txt">
  <div class="t1">Paiement confirmé</div>
  <div class="t2">43 000 Ar · Orange Money</div>
  <div class="t3">La Cabane reçoit ta commande</div>
</div>'''
CSS['f06'] = f'''
#ID canvas.trois {{ position:absolute; left:0; top:70px; width:1080px; height:1240px; display:block; }}
#ID .halo {{ position:absolute; left:190px; top:340px; width:700px; height:700px; border-radius:50%;
  background:radial-gradient(circle, rgba(255,121,0,.34) 0%, rgba(255,121,0,0) 64%); }}
#ID .anneau {{ position:absolute; left:290px; top:440px; width:500px; height:500px; border-radius:50%;
  box-shadow:0 0 0 14px rgba(255,121,0,.55); }}
#ID .txt {{ position:absolute; left:60px; right:60px; top:1060px; text-align:center; }}
#ID .t1 {{ font-size:118px; font-weight:900; letter-spacing:-5px; line-height:1; }}
#ID .t2 {{ margin-top:34px; font-size:56px; font-weight:800; color:{OMT}; }}
#ID .t3 {{ margin-top:22px; font-size:44px; font-weight:600; color:rgba(24,19,15,.6); }}
'''

# ------------------------------------------------- f09 : le duo en 3D
BODY['f09'] = BODY['f09'].replace(
    '''<div class="duo">
    <div class="carre"><img src="../../assets/taxifood-transparent.png" alt=""></div>
    <div class="fois">×</div>
    <div class="om-logo omc"><img src="../../assets/om-logo.png" alt=""></div>
  </div>''',
    '''<div class="duo"><canvas class="trois" width="1080" height="640"></canvas><div class="fois">×</div></div>''') + IMG_TF + IMG_OM
assert 'canvas' in BODY['f09'] and 'canvas' in BODY['f01']
CSS['f09'] += '''
#ID .duo { position:relative; width:1080px; height:280px; display:block; }
#ID .duo canvas { position:absolute; left:0; top:-180px; width:1080px; height:640px; display:block; }
#ID .duo .fois { position:absolute; left:0; right:0; top:50%; margin-top:-62px; text-align:center; line-height:1; }
'''


# ================================================================ ANIMATIONS (temps locaux, calés sur la voix)
def sfx(*l):
    return list(l)


M, SFX_L = {}, {}


def f01():
    a = A['f01']; D = a.D
    taxi, food = a.m(2), a.m(3)
    js = f'''
{v4m.respire('#f01', '.lueur', D, 1.12)}
tl.fromTo("#f01 .halo", {{scale:0.4, opacity:0}}, {{scale:1, opacity:1, duration:0.6, ease:"power2.out"}}, 0.35);
tl.fromTo("#f01 .mot", {{clipPath:"inset(0% 100% 0% 0%)", y:30}}, {{clipPath:"inset(0% 0% 0% 0%)", y:0, duration:0.42, ease:"power3.out"}}, {taxi - 0.06:.3f});
tl.fromTo("#f01 .filet", {{scaleX:0}}, {{scaleX:1, duration:0.32, ease:"power2.inOut", transformOrigin:"0% 50%"}}, {food + 0.10:.3f});
tl.fromTo("#f01 .lieu", {{opacity:0, y:24, scaleX:1.25}}, {{opacity:1, y:0, scaleX:1, duration:0.34, ease:"power2.out"}}, {food + 0.24:.3f});
tl.fromTo("#f01 .scoot .g0", {{x:-760}}, {{x:1140, duration:1.15, ease:"power2.inOut"}}, 0.55);
tl.fromTo("#f01 .scoot .g1", {{x:-760}}, {{x:1140, duration:1.15, ease:"power2.inOut"}}, 0.58);
tl.fromTo("#f01 .scoot .g2", {{x:-760}}, {{x:1140, duration:1.15, ease:"power2.inOut"}}, 0.61);
tl.fromTo("#f01 .scoot .g3", {{x:-760}}, {{x:1140, duration:1.15, ease:"power2.inOut"}}, 0.64);
tl.fromTo("#f01 .scoot", {{y:0}}, {{y:-10, duration:0.09, ease:"sine.inOut", yoyo:true, repeat:11, immediateRender:false}}, 0.55);
''' + trois.scene_tf('f01', 760, 760, arrivee=0.02, pose=0.74, fin=round(D + OVERLAP, 3), taille=340)
    s = sfx((0.02, 'whoosh', 0.45), (0.70, 'impact', 0.42), (0.74, 'scintille', 0.28), (0.62, 'whoosh', 0.32))
    return js, s


def f02():
    a = A['f02']; D = a.D
    ding, ton, est, mais, monn = a.m(0), a.m(1), a.m(3), a.m(5), a.m(10)
    js = f'''
tl.fromTo("#f02 .push", {{scale:1}}, {{scale:1.06, duration:{D - 0.2:.3f}, ease:"sine.inOut"}}, 0.2);
tl.fromTo("#f02 .ding", {{y:-80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)"}}, {ding - 0.08:.3f});
tl.fromTo("#f02 .ding", {{rotation:-2}}, {{rotation:2, duration:0.06, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, {ding + 0.22:.3f});
tl.fromTo("#f02 .apayer", {{y:60, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, {ding + 0.12:.3f});
(function(){{
  var n = document.querySelector("#f02 .n"); var p = {{v:0}};
  tl.fromTo(p, {{v:0}}, {{v:43000, duration:0.6, ease:"power2.out", onUpdate:function(){{
    var v = Math.round(p.v/1000)*1000; n.textContent = v.toString().replace(/\\B(?=(\\d{{3}})+(?!\\d))/g, " ");
  }}}}, {ding + 0.15:.3f});
}})();
tl.fromTo("#f02 .maki", {{x:-700, rotation:-6}}, {{x:0, rotation:0, duration:0.6, ease:"back.out(1.2)"}}, {ton - 0.22:.3f});
tl.fromTo("#f02 .billet", {{y:-620, rotation:14, rotationY:-80, opacity:0}}, {{y:0, rotation:6, rotationY:0, opacity:1, duration:0.6, ease:"power4.out"}}, {est - 0.12:.3f});
tl.fromTo("#f02 .billet", {{rotation:6}}, {{rotation:3, duration:0.8, ease:"sine.inOut", immediateRender:false}}, {est + 0.48:.3f});
tl.fromTo("#f02 .bulle", {{scale:0, rotation:-8, opacity:0}}, {{scale:1, rotation:-2, opacity:1, duration:0.32, ease:"back.out(2.4)", transformOrigin:"0% 100%"}}, {mais - 0.05:.3f});
tl.fromTo("#f02 .maki", {{rotation:0}}, {{rotation:-3, duration:0.18, ease:"sine.inOut", yoyo:true, repeat:3, immediateRender:false}}, {monn - 0.02:.3f});
tl.fromTo("#f02 .push", {{x:0}}, {{x:12, duration:0.05, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, {monn + 0.04:.3f});
tl.fromTo("#f02 .billet", {{opacity:1}}, {{opacity:0.4, duration:0.3, ease:"power1.out", immediateRender:false}}, {monn + 0.3:.3f});
'''
    s = sfx((ding, 'pop', 0.32), (ton - 0.22, 'whoosh', 0.38), (est - 0.12, 'whoosh', 0.36), (est + 0.3, 'pop', 0.3),
            (mais - 0.05, 'pop', 0.42), (monn, 'impact', 0.5))
    return js, s


def mots_anim(cid, debuts, styles, D):
    """Entrées 3D des mots : chaque mot arrive sur l'attaque de son mot dit ; la « caméra » (.mots)
    tourne lentement pour montrer l'épaisseur. Une secousse sur le dernier mot."""
    js = [f'tl.fromTo("#{cid} .mots", {{rotationY:-21, rotationX:14}}, {{rotationY:-9, rotationX:6, duration:{D + OVERLAP:.3f}, ease:"sine.inOut"}}, 0);']
    for k, (t0, (de, vers, du, ea)) in enumerate(zip(debuts, styles)):
        js.append(f'tl.fromTo("#{cid} .w:nth-child({k + 1})", {de}, {{{vers}, duration:{du}, ease:"{ea}"}}, {max(0.0, t0):.3f});')
    js.append(f'tl.fromTo("#{cid} .mots", {{x:0}}, {{x:-10, duration:0.04, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, {debuts[-1] + 0.06:.3f});')
    return '\n'.join(js)


def f03():
    a = A['f03']; D = a.D
    t = [a.m(k) - 0.06 for k in range(4)]
    st = [('{x:-900, rotationY:70, opacity:0}', 'x:0, rotationY:0, opacity:1', 0.26, 'power4.out'),
          ('{y:-300, rotationX:-85, opacity:0}', 'y:0, rotationX:0, opacity:1', 0.26, 'power4.out'),
          ('{z:700, opacity:0}', 'z:0, opacity:1', 0.22, 'power3.out'),
          ('{scale:0, rotation:8, rotationY:-55, opacity:0, transformOrigin:"0% 50%"}', 'scale:1, rotation:0, rotationY:0, opacity:1, transformOrigin:"0% 50%"', 0.34, 'back.out(2.2)')]
    js = mots_anim('f03', t, st, D)
    s = sfx((t[0], 'impact', 0.42), (t[1], 'pop', 0.38), (t[2], 'pop', 0.32), (t[3], 'impact', 0.55))
    return js, s


def f04():
    a = A['f04']; D = a.D
    ch, org, mon, fin = a.m(4), a.m(5), a.m(6), a.fin
    js = f'''
tl.fromTo("#f04 .push", {{scale:1}}, {{scale:1.03, duration:{D:.3f}, ease:"sine.inOut"}}, 0);
tl.fromTo("#f04 .recap", {{y:-220, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power3.out"}}, 0.08);
tl.fromTo("#f04 .feuille", {{y:1500, rotationX:26}}, {{y:0, rotationX:0, duration:0.65, ease:"back.out(1.05)", transformOrigin:"50% 100%"}}, 0.15);
tl.fromTo("#f04 .q", {{y:60, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, 0.45);
tl.fromTo("#f04 .mode", {{x:-120, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.08}}, 0.58);
tl.fromTo("#f04 .neuf", {{scale:0, rotation:-12}}, {{scale:1, rotation:-4, duration:0.3, ease:"back.out(3)"}}, 0.95);
tl.fromTo("#f04 .sel", {{opacity:0, scale:1.08, y:0}}, {{opacity:1, scale:1, duration:0.2, ease:"power2.out"}}, {ch - 0.1:.3f});
tl.fromTo("#f04 .sel", {{y:0}}, {{y:218, duration:0.22, ease:"power3.inOut", immediateRender:false}}, {ch + 0.22:.3f});
tl.fromTo("#f04 .sel", {{y:218}}, {{y:436, duration:0.26, ease:"back.out(1.6)", immediateRender:false}}, {max(org - 0.14, ch + 0.46):.3f});
tl.fromTo("#f04 .m3", {{backgroundColor:"{CREME}", boxShadow:"inset 0 0 0 4px rgba(24,19,15,.10), 0 0px 0px rgba(255,121,0,0)"}}, {{backgroundColor:"{OM}", boxShadow:"inset 0 0 0 0px rgba(24,19,15,0), 0 26px 54px rgba(255,121,0,.35)", duration:0.2, ease:"power2.out", immediateRender:false}}, {org + 0.04:.3f});
tl.fromTo("#f04 .m3 .mn", {{color:"{ENCRE}"}}, {{color:"{ENCRE}", duration:0.2, immediateRender:false}}, {org + 0.04:.3f});
tl.fromTo("#f04 .m3 .ms", {{color:"rgba(24,19,15,.55)"}}, {{color:"rgba(24,19,15,.8)", duration:0.2, immediateRender:false}}, {org + 0.04:.3f});
tl.fromTo("#f04 .m3", {{scale:1}}, {{scale:1.04, duration:0.12, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false}}, {org + 0.04:.3f});
tl.fromTo("#f04 .bouton", {{backgroundColor:"{BLANC}", color:"{OMT}"}}, {{backgroundColor:"{OM}", color:"{ENCRE}", duration:0.3, ease:"power2.out"}}, {mon + 0.05:.3f});
tl.fromTo("#f04 .bouton", {{scale:1}}, {{scale:0.93, duration:0.08, ease:"power1.in", immediateRender:false}}, {fin + 0.22:.3f});
tl.fromTo("#f04 .bouton", {{scale:0.93}}, {{scale:1, duration:0.28, ease:"back.out(3)", immediateRender:false}}, {fin + 0.30:.3f});
tl.fromTo("#f04 .onde", {{scale:0.2, opacity:0.55}}, {{scale:2.6, opacity:0, duration:0.45, ease:"power2.out"}}, {fin + 0.24:.3f});
'''
    s = sfx((0.15, 'whoosh', 0.32), (0.58, 'pop', 0.28), (ch - 0.1, 'clic', 0.5), (ch + 0.22, 'clic', 0.5),
            (max(org - 0.14, ch + 0.46), 'clic', 0.55), (org + 0.04, 'scintille', 0.25), (fin + 0.22, 'clic', 0.6))
    return js, s


def f05():
    a = A['f05']; D = a.D
    q0, q1 = a.m(4), a.mf(4)
    ks = [a.m(2), a.m(3), q0, q0 + 0.55 * (q1 - q0), a.m(5)]           # # 1 4 4 #
    puis, tape, code = a.m(6), a.m(7), a.mf(9)
    pas = (code + 0.08 - tape) / 5
    touches = [('#', 'kd'), ('1', 'k1'), ('4', 'k4'), ('4', 'k4'), ('#', 'kd')]
    frappes = '\n'.join(
        f'tl.fromTo("#f05 .{k}", {{backgroundColor:"{BLANC}", color:"{ENCRE}", scale:1, z:0}}, '
        f'{{backgroundColor:"{OM}", color:"#ffffff", scale:0.92, z:-40, duration:0.06, ease:"power1.out", immediateRender:false}}, {t:.3f});\n'
        f'tl.fromTo("#f05 .{k}", {{backgroundColor:"{OM}", color:"#ffffff", scale:0.92, z:-40}}, '
        f'{{backgroundColor:"{BLANC}", color:"{ENCRE}", scale:1, z:0, duration:0.14, ease:"power2.out", immediateRender:false}}, {t + 0.09:.3f});'
        for (_c, k), t in zip(touches, ks))
    cases = '\n'.join(
        f'tl.fromTo("#f05 .c{i}", {{backgroundColor:"rgba(255,255,255,.08)"}}, {{backgroundColor:"{OM}", duration:0.1, ease:"power2.out"}}, {tape + i * pas:.3f});\n'
        f'tl.fromTo("#f05 .c{i} span", {{scale:0, opacity:0}}, {{scale:1, opacity:1, duration:0.22, ease:"back.out(3)"}}, {tape + i * pas:.3f});'
        for i in range(6))
    js = f'''
tl.fromTo("#f05 .push", {{scale:1}}, {{scale:1.04, duration:{D:.3f}, ease:"sine.inOut"}}, 0);
tl.fromTo("#f05 .titre", {{y:-60, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, 0.05);
tl.fromTo("#f05 .clavier", {{rotationX:34, y:90}}, {{rotationX:12, y:0, duration:0.55, ease:"power3.out", transformOrigin:"50% 100%"}}, 0.05);
tl.fromTo("#f05 .k", {{scale:0.6, opacity:0}}, {{scale:1, opacity:1, duration:0.2, ease:"back.out(2)", stagger:0.012}}, 0.08);
tl.fromTo("#f05 .curseur", {{opacity:1}}, {{opacity:0, duration:0.12, ease:"none", yoyo:true, repeat:{int((ks[-1] + 0.2) / 0.24) * 2 + 1}}}, 0.1);
(function(){{
  var s = document.querySelector("#f05 .saisie"), txt = "#144#", ks = {[round(x, 3) for x in ks]}, p = {{t:0}};
  tl.fromTo(p, {{t:0}}, {{t:{D:.3f}, duration:{D:.3f}, ease:"none", onUpdate:function(){{
    var n = 0; for (var i=0;i<ks.length;i++) if (p.t >= ks[i]) n++; s.textContent = txt.slice(0, n);
  }}}}, 0);
}})();
{frappes}
tl.fromTo("#f05 .saisie", {{scale:1}}, {{scale:1.1, duration:0.12, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false}}, {ks[-1]:.3f});
tl.fromTo("#f05 .code", {{y:900, rotationX:-28}}, {{y:0, rotationX:0, duration:0.45, ease:"back.out(1.3)", transformOrigin:"50% 0%"}}, {puis - 0.12:.3f});
{cases}
'''
    s = sfx(*[(t, 'clic', 0.55) for t in ks], (puis - 0.12, 'whoosh', 0.35),
            *[(tape + i * pas, 'pop', 0.3) for i in range(6)])
    return js, s


def f06():
    a = A['f06']; D = a.D
    pai, conf, la = a.m(0), a.m(1), a.m(2)
    pose = round(max(0.55, pai + 0.02), 3)
    t0 = round(max(pose - 0.02, conf - 0.04), 3)
    t1 = round(t0 + 0.4, 3)
    js = f'''
tl.fromTo("#f06 .push", {{scale:1}}, {{scale:1.05, duration:{D:.3f}, ease:"sine.out"}}, 0.1);
tl.fromTo("#f06 .halo", {{scale:0.3, opacity:0}}, {{scale:1, opacity:1, duration:0.5, ease:"power2.out"}}, {pose - 0.25:.3f});
tl.fromTo("#f06 .anneau", {{scale:0.7}}, {{scale:1.55, duration:0.7, ease:"power2.out"}}, {t1 - 0.05:.3f});
tl.fromTo("#f06 .anneau", {{opacity:0}}, {{opacity:1, duration:0.08, ease:"none"}}, {t1 - 0.05:.3f});
tl.fromTo("#f06 .anneau", {{opacity:1}}, {{opacity:0, duration:0.6, ease:"power2.out", immediateRender:false}}, {t1 + 0.05:.3f});
tl.fromTo("#f06 .t1", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.32, ease:"power4.out"}}, {pai - 0.06:.3f});
tl.fromTo("#f06 .t2", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, {conf + 0.42:.3f});
tl.fromTo("#f06 .t3", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, {la - 0.06:.3f});
''' + trois.scene_piece('f06', 1080, 1240, arrivee=0.0, pose=pose, trace0=t0, trace1=t1, eclat=round(t1 - 0.04, 3),
                        fin=round(D + OVERLAP, 3), rayon_px=230)
    s = sfx((0.0, 'whoosh', 0.4), (pose, 'impact', 0.45), (t1 - 0.05, 'carillon', 0.5), (t1, 'scintille', 0.32))
    return js, s


def f07():
    a = A['f07']; D = a.D
    t = [a.m(0) - 0.06, a.m(1) - 0.06, a.m(3) - 0.06]
    st = [('{scale:2.6, z:300, opacity:0, transformOrigin:"0% 50%"}', 'scale:1, z:0, opacity:1, transformOrigin:"0% 50%"', 0.24, 'power3.out'),
          ('{x:900, rotationY:-70, opacity:0}', 'x:0, rotationY:0, opacity:1', 0.26, 'power4.out'),
          ('{y:280, rotationX:80, opacity:0}', 'y:0, rotationX:0, opacity:1', 0.26, 'power4.out')]
    js = mots_anim('f07', t, st, D)
    s = sfx((t[0], 'impact', 0.55), (t[1], 'impact', 0.45), (t[2], 'impact', 0.55))
    return js, s


def f08():
    a = A['f08']; D = a.D
    ding, cette, deja, paye, bon = a.m(0), a.m(1), a.m(4), a.m(5), a.m(6)
    js = f'''
tl.fromTo("#f08 .push", {{scale:1}}, {{scale:1.04, duration:{D:.3f}, ease:"sine.inOut"}}, 0);
tl.fromTo("#f08 .ding", {{y:-80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)"}}, {ding - 0.08:.3f});
tl.fromTo("#f08 .ding", {{rotation:-2}}, {{rotation:2, duration:0.06, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, {ding + 0.22:.3f});
tl.fromTo("#f08 .maki", {{y:1200, rotation:4}}, {{y:0, rotation:0, duration:0.65, ease:"back.out(1.1)"}}, {cette - 0.4:.3f});
tl.fromTo("#f08 .maki", {{scale:1}}, {{scale:1.04, duration:0.5, ease:"sine.inOut", yoyo:true, repeat:3, immediateRender:false}}, {cette + 0.3:.3f});
tl.fromTo("#f08 .paye", {{rotationX:-95, scale:0.7, opacity:0}}, {{rotationX:0, scale:1, opacity:1, duration:0.45, ease:"back.out(1.8)", transformOrigin:"50% 0%"}}, {deja - 0.1:.3f});
tl.fromTo("#f08 .ok", {{scale:0}}, {{scale:1, duration:0.3, ease:"back.out(3)"}}, {paye - 0.02:.3f});
tl.fromTo("#f08 .bon", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power4.out"}}, {bon - 0.06:.3f});
'''
    s = sfx((ding, 'pop', 0.32), (cette - 0.4, 'whoosh', 0.35), (deja - 0.1, 'carillon', 0.42), (paye, 'pop', 0.38),
            (bon, 'scintille', 0.25))
    return js, s


def f09():
    a = A['f09']; D = a.D
    taxi, paie, avec, org, sans, fin = a.m(0), a.m(2), a.m(3), a.m(4), a.m(6), a.fin
    tf1 = round(max(0.55, taxi + 0.12), 3)
    om0, om1 = round(avec - 0.3, 3), round(org + 0.1, 3)
    js = f'''
{v4m.respire('#f09', '.lueur', D, 1.12)}
tl.fromTo("#f09 .fois", {{scale:0}}, {{scale:1, duration:0.3, ease:"back.out(3)"}}, {tf1 + 0.05:.3f});
tl.fromTo("#f09 .phrase", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power4.out"}}, {paie - 0.06:.3f});
tl.fromTo("#f09 .frais", {{scale:2.2, rotation:-8, opacity:0}}, {{scale:1, rotation:-2, opacity:1, duration:0.32, ease:"back.out(2.6)"}}, {sans - 0.05:.3f});
tl.fromTo("#f09 .badges img", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)", stagger:0.08}}, {fin + 0.12:.3f});
tl.fromTo("#f09 .url", {{opacity:0}}, {{opacity:1, duration:0.3, ease:"power2.out"}}, {fin + 0.32:.3f});
''' + trois.scene_duo('f09', 1080, 640, tf0=0.0, tf1=tf1, om0=om0, om1=om1, fin=round(D, 3), taille=260, ecart=215)
    s = sfx((0.0, 'whoosh', 0.35), (tf1, 'impact', 0.4), (om0, 'whoosh', 0.35), (om1, 'impact', 0.45),
            (paie, 'pop', 0.3), (sans - 0.05, 'impact', 0.5), (fin + 0.12, 'pop', 0.3), (fin + 0.2, 'pop', 0.3),
            (fin + 0.35, 'scintille', 0.3))
    return js, s


for _c, _fn in [('f01', f01), ('f02', f02), ('f03', f03), ('f04', f04), ('f05', f05), ('f06', f06),
                ('f07', f07), ('f08', f08), ('f09', f09)]:
    M[_c], SFX_L[_c] = _fn()

# ================================================================ RACCORDS (identiques à la v4)
ORDRE = [c for c, *_r in SCENES]
MOTION, ENTREE_HTML, SEAM = {}, {}, {}
for i, (c, _f, _s, d) in enumerate(SCENES):
    js = M[c]
    if i > 0:
        kind, dir_ = v4.TRANSITIONS[ORDRE[i - 1]]
        js = v4.trans_in(c, kind, dir_) + '\n' + js
        SEAM[c] = v4.seam_html(c, kind, dir_)
    ENTREE_HTML[c] = v4.filtre_html(c)
    if c in v4.TRANSITIONS:
        kind, dir_ = v4.TRANSITIONS[c]
        js = js + '\n' + v4.trans_out(c, kind, dir_, round(d, 4))
    MOTION[c] = js
TROIS = {'f01', 'f06', 'f09'}


def frame(cid):
    fond = FONDS.get(cid, CREME)
    css = (v4.BASE_CSS + CSS[cid]).replace('#ID', '#' + cid)
    css = css.replace(f'#{cid} {{ position:absolute; inset:0; overflow:hidden;',
                      f'#{cid} {{ position:absolute; inset:0; overflow:hidden; background:transparent !important;', 1)
    css += f'\n#{cid} .cam {{ background:{fond}; }}'
    lib = trois.LIB if cid in TROIS else ''
    return f'''<!doctype html>
<html><head><meta charset="UTF-8"></head><body>
<template>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
<style>{css}</style>
<div id="{cid}" data-composition-id="{cid}" data-width="{W}" data-height="{H}">{ENTREE_HTML[cid]}<div class="cam"><div class="push">{BODY[cid]}
</div>{SEAM.get(cid, '')}</div></div>
<script>
(function(){{
  const tl = gsap.timeline({{ paused: true }});
  {lib}
  {MOTION[cid]}
  window.__timelines["{cid}"] = tl;
}})();
</script>
</template>
</body></html>
'''


# ================================================================ BANDE SON
MUSIQUE_SRC = 'assets/audio/musique.wav'
MUSIQUE_V5 = 'assets/audio/musique-v5.wav'


def musique_allongee():
    """La musique (135 BPM, 19 600 échantillons par temps à 44,1 kHz, grille calée à 0) dure 64 temps
    jusqu'à son coup final. On répète des mesures du refrain (temps 48-55, motif de 8 temps) pour que
    le coup final tombe deux temps avant la fin du film. Raccords à l'échantillon près, fondus de 6 ms."""
    ajout = TOTAL_T - FIN_APRES_COUP - 64
    w = wave.open(MUSIQUE_SRC); sr = w.getframerate(); ch = w.getnchannels(); sw = w.getsampwidth()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, ch).astype(np.float32)
    w.close()
    tb = int(round(sr * 60 / 135))
    if ajout <= 0:
        y = x
    else:
        reps = []
        reste = ajout
        while reste > 0:
            n = min(8, reste)
            reps.append((48, 48 + n))
            reste -= n
        morceaux = [x[:56 * tb]] + [x[a * tb:b * tb] for a, b in reps] + [x[56 * tb:]]
        f = int(0.006 * sr)
        y = morceaux[0]
        for m in morceaux[1:]:
            ramp = np.linspace(0, 1, f)[:, None]
            jonction = y[-f:] * (1 - ramp) + m[:f] * ramp
            y = np.concatenate([y[:-f], jonction, m[f:]])
    out = wave.open(MUSIQUE_V5, 'wb'); out.setnchannels(ch); out.setsampwidth(sw); out.setframerate(sr)
    out.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes()); out.close()
    return len(y) / sr


AVANCE = v4.AVANCE
DUREES = v4.DUREES


def audio_html():
    lignes = []
    duree_mus = musique_allongee()
    fin = TOTAL
    pts = '[{"t":0,"v":0},{"t":0.12,"v":1},{"t":%s,"v":1},{"t":%s,"v":0}]' % (round(fin - 0.5, 3), fin)
    lignes.append(f'      <audio id="musique" src="{MUSIQUE_V5}" data-start="0" data-duration="{min(fin, round(duree_mus, 3))}" '
                  f'data-media-start="0" data-track-index="5" data-volume="0.62" data-audio-group="music" '
                  f'data-automation=\'{{"version":1,"lanes":[{{"target":"volume","points":{pts}}}]}}\'></audio>')
    for i, (c, _f, s, _d) in enumerate(SCENES):
        r = REP[i]
        t0 = round(s + PLAN[i][2] - r['fichier_avance'], 3)
        lignes.append(f'      <audio id="voix-l{i + 1}" src="{voix.fichier(VOIX, i)}" data-start="{t0}" data-duration="{r["fichier_duree"]}" '
                      f'data-track-index="3" data-volume="1" data-audio-group="voiceover"></audio>')
    evts = []
    for i, (c, _f, s, _d) in enumerate(SCENES):
        for loc, nom, v in SFX_L[c]:
            evts.append((nom, round(s + loc - AVANCE[nom], 3), v))
    fins = []
    for k, (nom, tt, v) in enumerate(sorted(evts, key=lambda e: e[1])):
        tt = max(0.0, tt)
        d = min(DUREES[nom], round(fin - tt, 3))
        piste = next((j for j, f_ in enumerate(fins) if f_ <= tt), None)
        if piste is None:
            fins.append(0); piste = len(fins) - 1
        fins[piste] = tt + d
        lignes.append(f'      <audio id="sfx{k:02d}-{nom}" src="assets/audio/{nom}.mp3" data-start="{tt}" data-duration="{d}" '
                      f'data-track-index="{6 + piste}" data-volume="{v}" data-audio-group="sfx"></audio>')
    return '\n'.join(lignes)


def index():
    hotes = '\n'.join(
        f'      <div id="{cid}" class="clip" data-composition-id="{cid}" data-composition-src="compositions/frames/{f}.html" '
        f'data-start="{s}" data-duration="{round(d + (OVERLAP if i < len(SCENES) - 1 else 0), 4)}" data-track-index="1" '
        f'data-width="{W}" data-height="{H}" style="z-index:{i + 1}"></div>'
        for i, (cid, f, s, d) in enumerate(SCENES))
    return f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="{trois.THREE_CDN}"></script>
    <style>
      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ margin:0; width:{W}px; height:{H}px; overflow:hidden; background:{CREME}; }}
      #root {{ position:relative; width:100%; height:100%; background:{CREME}; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="{W}" data-height="{H}">
{hotes}
{audio_html()}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs('compositions/frames', exist_ok=True)
    for cid, f, s, d in SCENES:
        open(f'compositions/frames/{f}.html', 'w', encoding='utf-8').write(frame(cid))
    open('index.html', 'w', encoding='utf-8').write(index())
    print(f'v5 ({VOIX}) : {len(SCENES)} scènes, {TOTAL_T} temps = {TOTAL} s')
    for i, (c, f, s, d) in enumerate(SCENES):
        print(f'  {c} {f:16s} {s:6.2f} → {s + d:6.2f}  ({TEMPS[i]} temps)  « {voix.TEXTES[i]} »')
