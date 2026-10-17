# -*- coding: utf-8 -*-
"""Animations des 9 scènes (passe « build »). Une chaîne JavaScript par scène, insérée dans le
timeline GSAP en pause de la sous-composition. Temps LOCAUX à la scène (0 = début de la scène).

Grille : 120 BPM → un temps = 0,5 s. Coupes et frappes posées sur les temps et demi-temps.

Deux enveloppes par scène :
  .cam  — transitions : entrée (zoom / fouetté avec flou de vitesse) et sortie vers la scène suivante ;
  .push — caméra lente pendant la scène (poussée, dérive).
Règles respectées : fromTo partout (seek-safe), aucun aléatoire, aucune animation sur le .clip hôte.
"""
ROUGE, OR, CREME, ENCRE, BLANC = '#E8342A', '#FFC72C', '#F6EFE2', '#18130F', '#FFFBF4'


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

# ------------------------------------------------------------------ 1. Logo (1,5 s)
M['f01'] = f'''
{entree_zoom('#f01', 1.6, 18, 0.35)}
{respire('#f01', '.lueur', 1.5, 1.12)}
tl.fromTo("#f01 .carre", {{scale:0, rotation:-28}}, {{scale:1, rotation:0, duration:0.55, ease:"back.out(2.2)"}}, 0.05);
tl.fromTo("#f01 .carre img", {{x:-170, opacity:0}}, {{x:0, opacity:1, duration:0.4, ease:"power4.out"}}, 0.3);
tl.fromTo("#f01 .mot", {{clipPath:"inset(0% 100% 0% 0%)", y:30}}, {{clipPath:"inset(0% 0% 0% 0%)", y:0, duration:0.45, ease:"power3.out"}}, 0.45);
tl.fromTo("#f01 .filet", {{scaleX:0}}, {{scaleX:1, duration:0.35, ease:"power2.inOut", transformOrigin:"0% 50%"}}, 0.75);
tl.fromTo("#f01 .lieu", {{opacity:0, y:24, scaleX:1.25}}, {{opacity:1, y:0, scaleX:1, duration:0.4, ease:"power2.out"}}, 0.9);
{sortie_zoom('#f01', 1.3, 1.7, 18, 0.2)}
'''

# ------------------------------------------------------- 2. Le resto est fermé (2 s)
M['f02'] = f'''
{entree_zoom('#f02', 0.8, 14, 0.3)}
tl.fromTo("#f02 .push", {{scale:1}}, {{scale:1.07, duration:1.6, ease:"sine.inOut"}}, 0.2);
(function(){{
  var h = document.querySelector("#f02 .heure");
  var aig = document.querySelectorAll("#f02 .cadran line");
  var p = {{m:420}};
  tl.fromTo(p, {{m:420}}, {{m:600, duration:0.85, ease:"power2.out", onUpdate:function(){{
    var m = Math.round(p.m/5)*5, hh = Math.floor(m/60), mm = m%60;
    h.textContent = (hh<10?"0":"")+hh+":"+(mm<10?"0":"")+mm;
    aig[0].setAttribute("transform","rotate("+(m*6)+" 60 60)");
    aig[1].setAttribute("transform","rotate("+((m/60-9)*30)+" 60 60)");
  }}}}, 0.1);
}})();
tl.fromTo("#f02 .carte", {{y:1000, rotation:7}}, {{y:0, rotation:0, duration:0.6, ease:"power4.out"}}, 0.2);
tl.fromTo("#f02 .photo img", {{scale:1.75}}, {{scale:1.35, duration:1.0, ease:"power2.out"}}, 0.2);
tl.fromTo("#f02 .logo", {{scale:0}}, {{scale:1, duration:0.4, ease:"back.out(2.4)"}}, 0.6);
tl.fromTo("#f02 .nom, #f02 .type", {{y:50, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out", stagger:0.07}}, 0.65);
tl.fromTo("#f02 .badge", {{scale:2.6, rotation:-14, opacity:0}}, {{scale:1, rotation:-3, opacity:1, duration:0.32, ease:"back.out(3)"}}, 1.2);
tl.fromTo("#f02 .carte", {{x:0}}, {{x:14, duration:0.05, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, 1.27);
tl.fromTo("#f02 .plustard", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.3, ease:"power3.out"}}, 1.4);
{sortie_zoom('#f02', 1.82, 1.4, 16, 0.18)}
'''

# ------------------------------------------------------ 3. Commande quand même (1,5 s)
M['f03'] = f'''
tl.fromTo("#f03 .w:nth-child(1)", {{x:-700}}, {{x:0, duration:0.22, ease:"power4.out"}}, 0.000);
tl.fromTo("#f03 .w:nth-child(2)", {{y:-260, rotation:-6, opacity:0}}, {{y:0, rotation:0, opacity:1, duration:0.22, ease:"power4.out"}}, 0.444);
tl.fromTo("#f03 .w:nth-child(3)", {{scale:2.2, opacity:0}}, {{scale:1, opacity:1, duration:0.2, ease:"power3.out", transformOrigin:"0% 50%"}}, 0.889);
tl.fromTo("#f03 .w:nth-child(4)", {{y:220, skewY:8, opacity:0}}, {{y:0, skewY:0, opacity:1, duration:0.2, ease:"power4.out"}}, 1.333);
tl.fromTo("#f03 .w:nth-child(5)", {{scale:0, rotation:8}}, {{scale:1, rotation:0, duration:0.3, ease:"back.out(2.6)", transformOrigin:"0% 50%"}}, 1.778);
tl.fromTo("#f03 .mots", {{x:0}}, {{x:-10, duration:0.04, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, 1.828);
{sortie_fouet('#f03', 2.072, 900, 20, 0.14)}
'''

# ------------------------------------------------------- 4. Choisis ton heure (3,5 s)
M['f04'] = f'''
{entree_fouet('#f04', 800, 18, 0.34)}
tl.fromTo("#f04 .panier", {{y:-220, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power3.out"}}, 0.1);
tl.fromTo("#f04 .feuille", {{y:1400}}, {{y:0, duration:0.6, ease:"back.out(1.1)"}}, 0.25);
tl.fromTo("#f04 .q", {{y:60, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, 0.6);
tl.fromTo("#f04 .chip", {{scale:0.6, opacity:0}}, {{scale:1, opacity:1, duration:0.3, ease:"back.out(2)", stagger:0.06}}, 0.8);
tl.fromTo("#f04 .sel", {{opacity:0, scale:1.15, x:0, y:0}}, {{opacity:1, scale:1, duration:0.2, ease:"power2.out"}}, 1.312);
tl.fromTo("#f04 .sel", {{x:0, y:0}}, {{x:475, y:0, duration:0.2, ease:"power3.inOut", immediateRender:false}}, 1.75);
tl.fromTo("#f04 .sel", {{x:475, y:0}}, {{x:0, y:200, duration:0.24, ease:"back.out(1.6)", immediateRender:false}}, 2.187);
tl.fromTo("#f04 .chip.on", {{backgroundColor:"{CREME}", color:"{ENCRE}", boxShadow:"inset 0 0 0 4px rgba(24,19,15,.12), 0 0px 0px rgba(232,52,42,0)"}}, {{backgroundColor:"{ROUGE}", color:"#ffffff", boxShadow:"inset 0 0 0 0px rgba(24,19,15,0), 0 24px 50px rgba(232,52,42,.4)", duration:0.18, ease:"power2.out"}}, 2.25);
tl.fromTo("#f04 .chip.on", {{scale:1}}, {{scale:1.06, duration:0.12, ease:"power2.out", yoyo:true, repeat:1, immediateRender:false}}, 2.25);
tl.fromTo("#f04 .note", {{opacity:0, y:20}}, {{opacity:1, y:0, duration:0.3, ease:"power2.out"}}, 2.4);
tl.fromTo("#f04 .bouton", {{backgroundColor:"{BLANC}", color:"{ROUGE}"}}, {{backgroundColor:"{ROUGE}", color:"#ffffff", duration:0.3, ease:"power2.out"}}, 2.55);
tl.fromTo("#f04 .bouton", {{scale:1}}, {{scale:0.93, duration:0.08, ease:"power1.in", immediateRender:false}}, 2.98);
tl.fromTo("#f04 .bouton", {{scale:0.93}}, {{scale:1, duration:0.3, ease:"back.out(3)", immediateRender:false}}, 3.06);
tl.fromTo("#f04 .onde", {{scale:0.2, opacity:0.55}}, {{scale:2.6, opacity:0, duration:0.45, ease:"power2.out"}}, 3.0);
{sortie_zoom('#f04', 3.32, 1.35, 16, 0.18)}
'''

# ------------------------------------------------------ 5. CHOISIS TON HEURE (1,5 s)
M['f05'] = f'''
tl.fromTo("#f05 .w:nth-child(1)", {{x:900}}, {{x:0, duration:0.22, ease:"power4.out"}}, 0.000);
tl.fromTo("#f05 .w:nth-child(2)", {{y:240, opacity:0}}, {{y:0, opacity:1, duration:0.2, ease:"power4.out"}}, 0.444);
tl.fromTo("#f05 .w:nth-child(3)", {{scale:2.4, opacity:0}}, {{scale:1, opacity:1, duration:0.22, ease:"power3.out", transformOrigin:"0% 50%"}}, 0.889);
tl.fromTo("#f05 .mots", {{scale:1}}, {{scale:1.05, duration:0.4, ease:"sine.out", immediateRender:false}}, 0.939);
{sortie_zoom('#f05', 1.183, 1.6, 18, 0.15)}
'''

# ------------------------------------------------------------- 6. La frise (4 s)
M['f06'] = f'''
{entree_zoom('#f06', 0.75, 14, 0.32)}
tl.fromTo("#f06 .fantome", {{x:0}}, {{x:-260, duration:4, ease:"none"}}, 0);
tl.fromTo("#f06 .titre", {{opacity:0, x:-80}}, {{opacity:1, x:0, duration:0.4, ease:"power3.out"}}, 0.15);
tl.fromTo("#f06 .plein", {{scaleY:0}}, {{scaleY:0.04, duration:0.2, ease:"power2.out", transformOrigin:"50% 0%"}}, 0.3);
tl.fromTo("#f06 .j1 .pt", {{scale:0}}, {{scale:1, duration:0.35, ease:"back.out(2.6)"}}, 0.3);
tl.fromTo("#f06 .j1 .h, #f06 .j1 .t", {{x:-60, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.06}}, 0.4);
tl.fromTo("#f06 .plein", {{scaleY:0.04}}, {{scaleY:0.45, duration:0.7, ease:"power2.inOut", immediateRender:false}}, 0.6);
tl.fromTo("#f06 .j2 .pt", {{scale:0}}, {{scale:1, duration:0.35, ease:"back.out(2.6)"}}, 1.25);
tl.fromTo("#f06 .j2 .h, #f06 .j2 .t", {{x:-60, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.06}}, 1.32);
tl.fromTo("#f06 .bulle", {{scale:0, opacity:0}}, {{scale:1, opacity:1, duration:0.4, ease:"back.out(2.2)", transformOrigin:"0% 100%"}}, 1.5);
tl.fromTo("#f06 .scoot", {{scale:0}}, {{scale:1, duration:0.3, ease:"back.out(2)"}}, 1.85);
tl.fromTo("#f06 .scoot", {{y:-380}}, {{y:0, duration:1.25, ease:"power1.inOut"}}, 2.0);
tl.fromTo("#f06 .scoot", {{rotation:-4}}, {{rotation:4, duration:0.12, ease:"sine.inOut", yoyo:true, repeat:9, immediateRender:false}}, 2.0);
tl.fromTo("#f06 .plein", {{scaleY:0.45}}, {{scaleY:0.8, duration:1.25, ease:"power1.inOut", immediateRender:false}}, 2.0);
tl.fromTo("#f06 .j3 .pt", {{scale:0}}, {{scale:1, duration:0.35, ease:"back.out(2.6)"}}, 2.2);
tl.fromTo("#f06 .j3 .h, #f06 .j3 .t", {{x:-60, opacity:0}}, {{x:0, opacity:1, duration:0.3, ease:"power3.out", stagger:0.06}}, 2.27);
tl.fromTo("#f06 .j3 .pt", {{scale:1}}, {{scale:1.14, duration:0.22, ease:"sine.inOut", yoyo:true, repeat:1, immediateRender:false}}, 3.25);
{sortie_zoom('#f06', 3.82, 1.45, 16, 0.18)}
'''

# ------------------------------------------------------ 7. LIVRÉ À L'HEURE (1,5 s)
M['f07'] = f'''
tl.fromTo("#f07 .w:nth-child(1)", {{scale:2.6, opacity:0}}, {{scale:1, opacity:1, duration:0.22, ease:"power3.out", transformOrigin:"0% 50%"}}, 0.000);
tl.fromTo("#f07 .w:nth-child(2)", {{x:800}}, {{x:0, duration:0.24, ease:"power4.out"}}, 0.444);
tl.fromTo("#f07 .mots", {{x:0}}, {{x:10, duration:0.04, ease:"none", yoyo:true, repeat:3, immediateRender:false}}, 0.494);
tl.fromTo("#f07 .mots", {{scale:1}}, {{scale:1.04, duration:0.6, ease:"sine.out", immediateRender:false}}, 0.694);
{sortie_zoom('#f07', 1.183, 1.6, 18, 0.15)}
'''

# ------------------------------------------------------- 8. La notification (2,5 s)
M['f08'] = f'''
{entree_zoom('#f08', 0.85, 12, 0.3)}
tl.fromTo("#f08 .tel", {{rotationX:38, rotationY:-28, y:560, scale:0.82}}, {{rotationX:0, rotationY:0, y:0, scale:1, duration:0.75, ease:"power3.out"}}, 0.0);
tl.fromTo("#f08 .heureTel", {{opacity:0, scale:0.9}}, {{opacity:1, scale:1, duration:0.4, ease:"power2.out"}}, 0.35);
tl.fromTo("#f08 .ilot", {{scaleX:0.34, scaleY:0.22}}, {{scaleX:1, scaleY:1, duration:0.5, ease:"back.out(1.5)", transformOrigin:"50% 0%"}}, 0.7);
tl.fromTo("#f08 .ilot > *", {{opacity:0, y:14}}, {{opacity:1, y:0, duration:0.3, ease:"power2.out", stagger:0.06}}, 0.95);
tl.fromTo("#f08 .rempli", {{scaleX:0}}, {{scaleX:0.62, duration:0.9, ease:"power2.inOut", transformOrigin:"0% 50%"}}, 1.25);
tl.fromTo("#f08 .moto", {{x:0}}, {{x:436, duration:0.9, ease:"power2.inOut"}}, 1.25);
tl.fromTo("#f08 .push", {{scale:1}}, {{scale:1.05, duration:2.2, ease:"sine.inOut"}}, 0.2);
{sortie_zoom('#f08', 2.32, 1.4, 14, 0.18)}
'''

# ------------------------------------------------------------------ 9. Fin (2 s)
M['f09'] = f'''
tl.fromTo("#f09 .cam", {{opacity:0, scale:1.06}}, {{opacity:1, scale:1, duration:0.35, ease:"power2.out"}}, 0);
{respire('#f09', '.lueur', 2.0, 1.12)}
tl.fromTo("#f09 .carre", {{scale:0, rotation:-20}}, {{scale:1, rotation:0, duration:0.45, ease:"back.out(2.2)"}}, 0.05);
tl.fromTo("#f09 .mot", {{y:50, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"power3.out"}}, 0.25);
tl.fromTo("#f09 .phrase", {{y:80, opacity:0}}, {{y:0, opacity:1, duration:0.4, ease:"power4.out"}}, 0.4);
tl.fromTo("#f09 .badges img", {{y:40, opacity:0}}, {{y:0, opacity:1, duration:0.35, ease:"back.out(1.8)", stagger:0.08}}, 0.6);
tl.fromTo("#f09 .url", {{opacity:0}}, {{opacity:1, duration:0.3, ease:"power2.out"}}, 0.8);
'''
