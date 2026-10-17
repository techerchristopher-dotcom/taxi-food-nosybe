# -*- coding: utf-8 -*-
"""Animations des 9 scènes du film « Paiement Orange Money ». Une chaîne JavaScript par scène,
insérée dans le timeline GSAP en pause de la sous-composition. Temps LOCAUX réels (0 = début de la
scène), grille 135 BPM : un temps = 0,444 s.

Mêmes enveloppes que le 1er film : .cam (entrée / sortie avec flou de vitesse), .push (caméra lente).
fromTo partout (seek-safe), aucun aléatoire, aucune animation sur le .clip hôte.
"""
ROUGE, OR, CREME, ENCRE, BLANC, OM = '#E8342A', '#FFC72C', '#F6EFE2', '#18130F', '#FFFBF4', '#FF7900'

B = 60 / 135
ECLATS = [(-330, -300), (330, -280), (-400, 40), (400, 60), (-260, 330), (270, 340),
          (0, -420), (-120, 430), (140, -440), (420, -120), (-430, -110), (60, 450)]


def entree_zoom(sel, de=1.25, flou=14, duree=0.32):
    return (f'tl.fromTo("{sel} .cam", {{scale:{de}, filter:"blur({flou}px)"}}, '
            f'{{scale:1, filter:"blur(0px)", duration:{duree}, ease:"power3.out"}}, 0);')


def entree_fouet(sel, dy=700, flou=16, duree=0.34):
    return (f'tl.fromTo("{sel} .cam", {{y:{dy}, filter:"blur({flou}px)"}}, '
            f'{{y:0, filter:"blur(0px)", duration:{duree}, ease:"power4.out"}}, 0);')


def sortie_zoom(sel, t, vers=1.5, flou=16, duree=0.2):
    return (f'tl.fromTo("{sel} .cam", {{scale:1, filter:"blur(0px)"}}, '
            f'{{scale:{vers}, filter:"blur({flou}px)", duration:{duree}, ease:"power2.in", immediateRender:false}}, {t});')


def sortie_fouet(sel, t, dy=-800, flou=18, duree=0.18):
    return (f'tl.fromTo("{sel} .cam", {{y:0, filter:"blur(0px)"}}, '
            f'{{y:{dy}, filter:"blur({flou}px)", duration:{duree}, ease:"power3.in", immediateRender:false}}, {t});')


def respire(sel, cible, duree, amp=1.08):
    return (f'tl.fromTo("{sel} {cible}", {{scale:1}}, {{scale:{amp}, duration:{duree/2:.2f}, ease:"sine.inOut", '
            f'yoyo:true, repeat:1}}, 0);')


M = {}

# ------------------------------------------------------------------ 1. Logo (1,333 s)
M['f01'] = f'''
{entree_zoom('#f01', 1.6, 18, 0.32)}
{respire('#f01', '.lueur', 1.33, 1.12)}
tl.fromTo("#f01 .carre", {{scale:0, rotation:-28}}, {{scale:1, rotation:0, duration:0.5, ease:"back.out(2.2)"}}, 0.04);
tl.fromTo("#f01 .carre img", {{x:-170, opacity:0}}, {{x:0, opacity:1, duration:0.36, ease:"power4.out"}}, 0.26);
tl.fromTo("#f01 .mot", {{clipPath:"inset(0% 100% 0% 0%)", y:30}}, {{clipPath:"inset(0% 0% 0% 0%)", y:0, duration:0.4, ease:"power3.out"}}, 0.4);
tl.fromTo("#f01 .filet", {{scaleX:0}}, {{scaleX:1, duration:0.3, ease:"power2.inOut", transformOrigin:"0% 50%"}}, 0.66);
tl.fromTo("#f01 .lieu", {{opacity:0, y:24, scaleX:1.25}}, {{opacity:1, y:0, scaleX:1, duration:0.34, ease:"power2.out"}}, 0.78);
tl.fromTo("#f01 .scoot", {{x:-760, rotation:-3}}, {{x:1140, rotation:0, duration:1.0, ease:"power2.inOut"}}, 0.3);
tl.fromTo("#f01 .scoot", {{y:0}}, {{y:-10, duration:0.08, ease:"sine.inOut", yoyo:true, repeat:11, immediateRender:false}}, 0.3);
{sortie_zoom('#f01', 1.15, 1.7, 18, 0.18)}
'''

# ------------------------------------------------------- 2. Pas de monnaie (2,667 s)
M['f02'] = f'''
{entree_zoom('#f02', 0.8, 14, 0.3)}
tl.fromTo("#f02 .push", {{scale:1}}, {{scale:1.06, duration:2.3, ease:"sine.inOut"}}, 0.2);
tl.fromTo("#f02 .ding", {{y:-80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)"}}, 0.05);
tl.fromTo("#f02 .ding", {{rotation:-2}}, {{rotation:2, duration:0.06, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, 0.35);
tl.fromTo("#f02 .apayer", {{y:60, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, 0.3);
tl.fromTo("#f02 .maki", {{x:-700, rotation:-6}}, {{x:0, rotation:0, duration:0.6, ease:"back.out(1.2)"}}, 0.55);
(function(){{
  var n = document.querySelector("#f02 .n"); var p = {{v:0}};
  tl.fromTo(p, {{v:0}}, {{v:43000, duration:0.55, ease:"power2.out", onUpdate:function(){{
    var v = Math.round(p.v/1000)*1000; n.textContent = v.toString().replace(/\\B(?=(\\d{{3}})+(?!\\d))/g, " ");
  }}}}, 0.4);
}})();
tl.fromTo("#f02 .billet", {{y:-600, rotation:14, opacity:0}}, {{y:0, rotation:6, opacity:1, duration:0.5, ease:"power4.out"}}, 0.95);
tl.fromTo("#f02 .billet", {{rotation:6}}, {{rotation:3, duration:0.8, ease:"sine.inOut", immediateRender:false}}, 1.45);
tl.fromTo("#f02 .bulle", {{scale:0, rotation:-8, opacity:0}}, {{scale:1, rotation:-2, opacity:1, duration:0.32, ease:"back.out(2.4)", transformOrigin:"0% 100%"}}, 1.73);
tl.fromTo("#f02 .maki", {{rotation:0}}, {{rotation:-3, duration:0.18, ease:"sine.inOut", yoyo:true, repeat:3, immediateRender:false}}, 1.75);
tl.fromTo("#f02 .push", {{x:0}}, {{x:12, duration:0.05, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, 1.82);
tl.fromTo("#f02 .billet", {{opacity:1}}, {{opacity:0.4, duration:0.3, ease:"power1.out", immediateRender:false}}, 2.0);
{sortie_zoom('#f02', 2.48, 1.45, 16, 0.18)}
'''

# ------------------------------------------- 3. PLUS BESOIN DE MONNAIE. (1,778 s, 4 temps)
M['f03'] = f'''
tl.fromTo("#f03 .w:nth-child(1)", {{x:-800}}, {{x:0, duration:0.2, ease:"power4.out"}}, 0.000);
tl.fromTo("#f03 .w:nth-child(2)", {{y:-260, opacity:0}}, {{y:0, opacity:1, duration:0.2, ease:"power4.out"}}, {B:.3f});
tl.fromTo("#f03 .w:nth-child(3)", {{scale:2.2, opacity:0}}, {{scale:1, opacity:1, duration:0.18, ease:"power3.out", transformOrigin:"0% 50%"}}, {2*B:.3f});
tl.fromTo("#f03 .w:nth-child(4)", {{scale:0, rotation:8}}, {{scale:1, rotation:0, duration:0.28, ease:"back.out(2.6)", transformOrigin:"0% 50%"}}, {3*B:.3f});
tl.fromTo("#f03 .mots", {{x:0}}, {{x:-10, duration:0.04, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, {3*B+0.05:.3f});
{sortie_fouet('#f03', 1.62, 900, 20, 0.15)}
'''

# ------------------------------------------------------- 4. Choisis Orange Money (3,556 s)
M['f04'] = f'''
{entree_fouet('#f04', 800, 18, 0.34)}
tl.fromTo("#f04 .recap", {{y:-220, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power3.out"}}, 0.1);
tl.fromTo("#f04 .feuille", {{y:1500}}, {{y:0, duration:0.6, ease:"back.out(1.1)"}}, 0.22);
tl.fromTo("#f04 .q", {{y:60, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, 0.55);
tl.fromTo("#f04 .mode", {{x:-120, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.08}}, 0.72);
tl.fromTo("#f04 .neuf", {{scale:0, rotation:-12}}, {{scale:1, rotation:-4, duration:0.3, ease:"back.out(3)"}}, 1.05);
tl.fromTo("#f04 .sel", {{opacity:0, scale:1.08, y:0}}, {{opacity:1, scale:1, duration:0.2, ease:"power2.out"}}, 1.3);
tl.fromTo("#f04 .sel", {{y:0}}, {{y:218, duration:0.22, ease:"power3.inOut", immediateRender:false}}, 1.72);
tl.fromTo("#f04 .sel", {{y:218}}, {{y:436, duration:0.26, ease:"back.out(1.6)", immediateRender:false}}, 2.14);
tl.fromTo("#f04 .m3", {{backgroundColor:"{CREME}", boxShadow:"inset 0 0 0 4px rgba(24,19,15,.10), 0 0px 0px rgba(255,121,0,0)"}}, {{backgroundColor:"{OM}", boxShadow:"inset 0 0 0 0px rgba(24,19,15,0), 0 26px 54px rgba(255,121,0,.35)", duration:0.2, ease:"power2.out", immediateRender:false}}, 2.22);
tl.fromTo("#f04 .m3 .mn", {{color:"{ENCRE}"}}, {{color:"{ENCRE}", duration:0.2, immediateRender:false}}, 2.22);
tl.fromTo("#f04 .m3 .ms", {{color:"rgba(24,19,15,.55)"}}, {{color:"rgba(24,19,15,.8)", duration:0.2, immediateRender:false}}, 2.22);
tl.fromTo("#f04 .m3", {{scale:1}}, {{scale:1.04, duration:0.12, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false}}, 2.22);
tl.fromTo("#f04 .bouton", {{backgroundColor:"{BLANC}", color:"{OM}"}}, {{backgroundColor:"{OM}", color:"#ffffff", duration:0.3, ease:"power2.out"}}, 2.5);
tl.fromTo("#f04 .bouton", {{scale:1}}, {{scale:0.93, duration:0.08, ease:"power1.in", immediateRender:false}}, 2.98);
tl.fromTo("#f04 .bouton", {{scale:0.93}}, {{scale:1, duration:0.28, ease:"back.out(3)", immediateRender:false}}, 3.06);
tl.fromTo("#f04 .onde", {{scale:0.2, opacity:0.55}}, {{scale:2.6, opacity:0, duration:0.45, ease:"power2.out"}}, 3.0);
{sortie_zoom('#f04', 3.36, 1.35, 16, 0.18)}
'''

# ------------------------------------------------------------- 5. #144# (2,667 s)
_frappes = [('#', 0.40, 'kd'), ('1', 0.62, 'k1'), ('4', 0.84, 'k4'), ('4', 1.06, 'k4'), ('#', 1.28, 'kd')]
_touches = '\n'.join(
    f'tl.fromTo("#f05 .{k}", {{backgroundColor:"{BLANC}", color:"{ENCRE}", scale:1}}, '
    f'{{backgroundColor:"{OM}", color:"#ffffff", scale:0.92, duration:0.06, ease:"power1.out", immediateRender:false}}, {t:.2f});\n'
    f'tl.fromTo("#f05 .{k}", {{backgroundColor:"{OM}", color:"#ffffff", scale:0.92}}, '
    f'{{backgroundColor:"{BLANC}", color:"{ENCRE}", scale:1, duration:0.12, ease:"power2.out", immediateRender:false}}, {t+0.08:.2f});'
    for _c, t, k in _frappes)
_cases = '\n'.join(
    f'tl.fromTo("#f05 .c{i}", {{backgroundColor:"rgba(255,255,255,.08)"}}, {{backgroundColor:"{OM}", duration:0.1, ease:"power2.out"}}, {1.6 + i*0.13:.2f});\n'
    f'tl.fromTo("#f05 .c{i} span", {{scale:0, opacity:0}}, {{scale:1, opacity:1, duration:0.22, ease:"back.out(3)"}}, {1.6 + i*0.13:.2f});'
    for i in range(6))
M['f05'] = f'''
{entree_zoom('#f05', 0.85, 12, 0.3)}
tl.fromTo("#f05 .titre", {{y:-60, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, 0.05);
tl.fromTo("#f05 .k", {{scale:0.6, opacity:0}}, {{scale:1, opacity:1, duration:0.2, ease:"back.out(2)", stagger:0.01}}, 0.08);
tl.fromTo("#f05 .curseur", {{opacity:1}}, {{opacity:0, duration:0.12, ease:"none", yoyo:true, repeat:9}}, 0.1);
(function(){{
  var s = document.querySelector("#f05 .saisie"); var txt = "#144#"; var p = {{v:0}};
  tl.fromTo(p, {{v:0}}, {{v:5, duration:1.10, ease:"none", onUpdate:function(){{
    s.textContent = txt.slice(0, Math.min(5, Math.floor(p.v + 0.0001)));
  }}}}, 0.18);
}})();
{_touches}
tl.fromTo("#f05 .saisie", {{scale:1}}, {{scale:1.08, duration:0.12, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false}}, 1.29);
tl.fromTo("#f05 .code", {{y:900}}, {{y:0, duration:0.4, ease:"back.out(1.3)"}}, 1.35);
{_cases}
tl.fromTo("#f05 .push", {{scale:1}}, {{scale:1.04, duration:2.4, ease:"sine.inOut"}}, 0.2);
{sortie_zoom('#f05', 2.48, 1.45, 16, 0.18)}
'''

# ------------------------------------------------------- 6. Paiement confirmé (1,778 s)
_eclats = '\n'.join(
    f'tl.fromTo("#f06 .e{i}", {{x:0, y:0, scale:0, rotation:0}}, {{x:{x}, y:{y}, scale:1, rotation:{(i*47)%180 - 90}, '
    f'duration:0.5, ease:"power3.out"}}, 0.32);\n'
    f'tl.fromTo("#f06 .e{i}", {{opacity:1}}, {{opacity:0, duration:0.4, ease:"power1.in"}}, 0.95);'
    for i, (x, y) in enumerate(ECLATS))
M['f06'] = f'''
{entree_zoom('#f06', 0.7, 14, 0.28)}
tl.fromTo("#f06 .disque", {{scale:0}}, {{scale:1, duration:0.4, ease:"back.out(2.4)"}}, 0.04);
tl.fromTo("#f06 .trait", {{strokeDasharray:200, strokeDashoffset:200}}, {{strokeDasharray:200, strokeDashoffset:0, duration:0.3, ease:"power2.out"}}, 0.28);
{_eclats}
tl.fromTo("#f06 .t1", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.32, ease:"power4.out"}}, 0.4);
tl.fromTo("#f06 .t2, #f06 .t3", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.1}}, 0.6);
tl.fromTo("#f06 .push", {{scale:1}}, {{scale:1.05, duration:1.5, ease:"sine.out"}}, 0.3);
{sortie_zoom('#f06', 1.6, 1.55, 18, 0.16)}
'''

# ------------------------------------------------- 7. PAYÉ. RIEN À SORTIR. (1,333 s, 3 temps)
M['f07'] = f'''
tl.fromTo("#f07 .w:nth-child(1)", {{scale:2.6, opacity:0}}, {{scale:1, opacity:1, duration:0.2, ease:"power3.out", transformOrigin:"0% 50%"}}, 0.000);
tl.fromTo("#f07 .w:nth-child(2)", {{x:800}}, {{x:0, duration:0.2, ease:"power4.out"}}, {B:.3f});
tl.fromTo("#f07 .w:nth-child(3)", {{y:240, opacity:0}}, {{y:0, opacity:1, duration:0.2, ease:"power4.out"}}, {2*B:.3f});
tl.fromTo("#f07 .mots", {{x:0}}, {{x:10, duration:0.04, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, {2*B+0.05:.3f});
{sortie_zoom('#f07', 1.18, 1.6, 18, 0.15)}
'''

# ------------------------------------------------------- 8. Le livreur est là (2,667 s)
M['f08'] = f'''
{entree_zoom('#f08', 0.85, 12, 0.3)}
tl.fromTo("#f08 .ding", {{y:-80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)"}}, 0.05);
tl.fromTo("#f08 .ding", {{rotation:-2}}, {{rotation:2, duration:0.06, ease:"none", yoyo:true, repeat:5, immediateRender:false}}, 0.35);
tl.fromTo("#f08 .maki", {{y:1200, rotation:4}}, {{y:0, rotation:0, duration:0.65, ease:"back.out(1.1)"}}, 0.3);
tl.fromTo("#f08 .maki", {{scale:1}}, {{scale:1.04, duration:0.5, ease:"sine.inOut", yoyo:true, repeat:3, immediateRender:false}}, 1.0);
tl.fromTo("#f08 .paye", {{scale:0, opacity:0}}, {{scale:1, opacity:1, duration:0.4, ease:"back.out(2)"}}, 0.9);
tl.fromTo("#f08 .ok", {{scale:0}}, {{scale:1, duration:0.3, ease:"back.out(3)"}}, 1.2);
tl.fromTo("#f08 .bon", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power4.out"}}, 1.5);
tl.fromTo("#f08 .push", {{scale:1}}, {{scale:1.04, duration:2.4, ease:"sine.inOut"}}, 0.2);
{sortie_zoom('#f08', 2.48, 1.4, 14, 0.18)}
'''

# ------------------------------------------------------------------ 9. Fin (2,222 s)
M['f09'] = f'''
tl.fromTo("#f09 .cam", {{opacity:0, scale:1.06}}, {{opacity:1, scale:1, duration:0.35, ease:"power2.out"}}, 0);
{respire('#f09', '.lueur', 2.2, 1.12)}
tl.fromTo("#f09 .carre", {{scale:0, rotation:-20}}, {{scale:1, rotation:0, duration:0.42, ease:"back.out(2.2)"}}, 0.05);
tl.fromTo("#f09 .fois", {{scale:0}}, {{scale:1, duration:0.3, ease:"back.out(3)"}}, 0.18);
tl.fromTo("#f09 .omc", {{scale:0, rotation:20}}, {{scale:1, rotation:0, duration:0.42, ease:"back.out(2.2)"}}, 0.25);
tl.fromTo("#f09 .phrase", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power4.out"}}, 0.45);
tl.fromTo("#f09 .frais", {{scale:2.2, rotation:-8, opacity:0}}, {{scale:1, rotation:-2, opacity:1, duration:0.32, ease:"back.out(2.6)"}}, 1.1);
tl.fromTo("#f09 .badges img", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)", stagger:0.08}}, 0.8);
tl.fromTo("#f09 .url", {{opacity:0}}, {{opacity:1, duration:0.3, ease:"power2.out"}}, 1.0);
'''
