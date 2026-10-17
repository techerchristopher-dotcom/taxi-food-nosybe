# -*- coding: utf-8 -*-
"""Annonce « Paiement Orange Money » — variante 3D du visuel validé (demande du porteur du projet, 18/10).

Même visuel que pub_orange_money.py (gabarit de la série, textes, plats, Maki), dont le HTML est repris
TEL QUEL puis transformé ici : le visuel plat validé reste donc à l'octet près ce qu'il était. La 3D est
celle de la vidéo v5 (video/trois.py, Three.js r147) :
- les trois étapes deviennent des objets en relief : la tuile Orange Money (vrai logo d'Orange en
  texture), une tuile noire « #144# », la pièce Orange Money avec sa coche blanche en relief ;
- le titre prend de l'épaisseur (couches décalées, comme les mots de la vidéo) ;
- les cinq plats (photos réelles) se rangent en tambour, en perspective (le plat du centre devant).
Aucune image générée, aucun logo redessiné. Rendu : `sh rendre_orange_money_3d.sh` (Chrome du Mac).
"""
import os
import sys

import pub_orange_money as plat

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, 'video'))
import trois  # noqa: E402

CREME, ROUGE, OR, ENCRE, OM, OMT = plat.CREME, plat.ROUGE, plat.OR, plat.ENCRE, plat.OM, plat.OMT

# Zone de la 3D des étapes : la frise du visuel plat (cercles de 132 px centrés à y = 366, aux x 210 /
# 540 / 870). Le canvas la couvre ; les libellés restent du HTML, à leur place.
C_TOP, C_H = 210, 330
CENTRES = [210, 540, 870]
CY = 366


def mix(c0, c1, t):
    a = [int(c0[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    return '#' + ''.join(f'{round(a[k] + (b[k] - a[k]) * t):02x}' for k in range(3))


def epais(texte, face, c0, c1, n=9, dx=0.35, dy=1.05):
    """Titre en volume : n copies décalées vers le bas, du plus proche (c0) au plus lointain (c1),
    la face par-dessus (règle 3d-text-depth-layers). Les couches sont décoratives : aria-hidden."""
    couches = ''.join(
        f'<span class="x" aria-hidden="true" style="color:{mix(c0, c1, i / (n - 1))};'
        f'transform:translate({(i + 1) * dx:.2f}px,{(i + 1) * dy:.2f}px)">{texte}</span>'
        for i in reversed(range(n)))
    return f'<span class="d3">{couches}<span class="c" style="color:{face}">{texte}</span></span>'


CSS_3D = f'''
.v3 .h1 div,.v3 .ti div{{display:block;}}
.v3 .d3{{position:relative;display:inline-block;}}
.v3 .d3 .x{{position:absolute;left:0;top:0;white-space:nowrap;}}
.v3 .d3 .c{{position:relative;white-space:nowrap;}}
.v3 .ro{{background:transparent!important;box-shadow:none!important;}}
.v3 .li{{z-index:0;}}
.v3 canvas.trois{{position:absolute;left:0;top:{C_TOP}px;width:1080px;height:{C_H}px;display:block;z-index:3;pointer-events:none;}}
.v3 .ombre{{position:absolute;width:150px;height:26px;margin-left:-75px;border-radius:50%;z-index:1;
  background:radial-gradient(closest-side, rgba(60,30,0,.30), rgba(60,30,0,0));}}
.v3 .pls{{perspective:1000px;perspective-origin:50% 45%;gap:26px;}}
.v3 .pl{{transform-origin:50% 50%;}}
.v3 .pl:nth-child(1){{transform:rotateY(-22deg) translateZ(-38px);}}
.v3 .pl:nth-child(2){{transform:rotateY(-11deg) translateZ(-10px);}}
.v3 .pl:nth-child(3){{transform:translateZ(12px);}}
.v3 .pl:nth-child(4){{transform:rotateY(11deg) translateZ(-10px);}}
.v3 .pl:nth-child(5){{transform:rotateY(22deg) translateZ(-38px);}}
'''

# La pièce Orange Money : même profil tourné et même coche que la vidéo (scene_piece de trois.py),
# posée, la coche entière. R en unités 3D.
JS_PIECE = r'''
function pieceOM(K, T, R){
  var g = new T.Group(), h0 = 0.075*R;
  var pr = [[0,-h0],[R*.78,-h0],[R*.82,-h0-R*.035],[R*.92,-h0-R*.045],[R*.975,-h0-R*.02],[R,0],[R*.975,h0+R*.02],[R*.92,h0+R*.045],[R*.82,h0+R*.035],[R*.78,h0],[0,h0]];
  var gp = new T.LatheGeometry(pr.map(function(q){ return new T.Vector2(q[0], q[1]); }), 160); gp.rotateX(Math.PI/2);
  g.add(new T.Mesh(gp, new T.MeshPhysicalMaterial({color: 0xFF7900, roughness: 0.28, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new T.Color(0xffb36b)})));
  var k = R/230, z = h0 + 0.035*R;
  var A = new T.Vector3(-72*k, -6*k, z), B = new T.Vector3(-18*k, -60*k, z), C = new T.Vector3(78*k, 51*k, z);
  var ch = new T.CurvePath(); ch.add(new T.LineCurve3(A, B)); ch.add(new T.LineCurve3(B, C));
  var rt = 16.5*k, blanc = new T.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05});
  g.add(new T.Mesh(new T.TubeGeometry(ch, 160, rt, 20, false), blanc));
  var gs = new T.SphereGeometry(rt, 24, 16);
  [A, B, C].forEach(function(p){ var s = new T.Mesh(gs, blanc); s.position.copy(p); g.add(s); });
  return g;
}
'''


def scene_js():
    return trois.LIB + JS_PIECE + trois.tpl(r'''
// Construite D'UN SEUL TENANT (aucune attente asynchrone) : sous le temps virtuel du Chrome sans tête,
// un await laisse filer l'horloge et la capture partirait avant la 3D. Appelée 1,2 s après le
// chargement : images déjà décodées, police Archivo déjà là (contrôlé ci-dessous).
function construire(){
  var K = T3, T = THREE;
  if (!document.fonts.check('900 250px Archivo')) throw new Error('police Archivo absente');
  var cv = document.querySelector('canvas.trois'), W = 1080, H = @H@, TOP = @TOP@;
  var r = new T.WebGLRenderer({canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true});
  r.setPixelRatio(window.devicePixelRatio || 1); r.setSize(W, H, false);
  r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.NoToneMapping; r.physicallyCorrectLights = true; r.setClearColor(0x000000, 0);
  var sc = new T.Scene(), cam = new T.PerspectiveCamera(16, W/H, 0.1, 400), D = 34;
  cam.position.set(0, 0, D); cam.lookAt(0, 0, 0);
  sc.environment = K.studio(r); K.lumieres(sc, 2.6);
  var u = K.uParPx(cam, D, H);
  function X(cx){ return (cx - 540)*u; } function Y(cy){ return (TOP + H/2 - cy)*u; }
  var img = document.querySelector('img.src-om');
  if (!img.complete || !img.naturalWidth) throw new Error('logo Orange Money non chargé');
  // 1. Tu choisis Orange Money : la tuile au vrai logo, tournée vers le centre.
  var o1 = K.tuileOM(img, 136*u); o1.position.set(X(@X1@), Y(@CY@), 0); o1.rotation.set(-0.24, 0.44, 0.03); sc.add(o1);
  // 2. Tu tapes ton code : tuile noire, « #144# » en orange (Archivo, police du visuel).
  var tex = K.texCanvas(1024, 1024, function(g, w, h){ g.fillStyle = '#131313'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#FF7900'; g.font = '900 268px Archivo'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('#144#', w/2, h/2 + 14); });
  var o2 = K.tuile({tex: tex, taille: 136*u, aspect: 1, couleurTranche: function(){ return [19, 19, 19]; }});
  o2.position.set(X(@X2@), Y(@CY@), 0); o2.rotation.set(-0.16, 0.05, 0); sc.add(o2);
  // 3. C'est payé : la pièce Orange Money et sa coche, tournée vers le centre.
  var o3 = pieceOM(K, T, 77*u); o3.position.set(X(@X3@), Y(@CY@), 0); o3.rotation.set(-0.22, -0.44, -0.03); sc.add(o3);
  r.render(sc, cam);
  // Mesures sur les pixels réellement rendus (pas sur des boîtes calculées).
  var gl = r.getContext(), bw = gl.drawingBufferWidth, bh = gl.drawingBufferHeight, s = bw/W;
  var px = new Uint8Array(4*bw*bh); gl.readPixels(0, 0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
  function mesure(cx){ var n = 0, bas = -1, haut = 1e9, x0 = Math.round((cx - 125)*s), x1 = Math.round((cx + 125)*s);
    for (var y = 0; y < bh; y++) for (var x = x0; x < x1; x++){ if (px[4*(y*bw + x) + 3] > 24){ n++;
      var yc = (bh - 1 - y)/s + TOP; if (yc > bas) bas = yc; if (yc < haut) haut = yc; } }
    return {aire: Math.round(n/(s*s)), bas: bas, haut: haut}; }
  return [mesure(@X1@), mesure(@X2@), mesure(@X3@)];
}
''', H=C_H, TOP=C_TOP, X1=CENTRES[0], X2=CENTRES[1], X3=CENTRES[2], CY=CY)


CONTROLES_3D = r'''
window.addEventListener('load', () => setTimeout(async () => {
  const r = e => e.getBoundingClientRect();
  const out = [];
  let m3 = null;
  try { m3 = construire(); } catch (e) { out.push('ERREUR_3D ' + (e && e.message)); }
  let deb = 0;
  document.querySelectorAll('.st,.h1,.tl,.et,.pls,.pl,.ex,.gc,.dc,.pr,.ur,.ti').forEach(e => {
    const b = r(e); if (b.left < -.5 || b.right > 1080.5 || b.top < -.5 || b.bottom > 1350.5) deb++; });
  out.push('debord_cadre ' + deb);
  let horsCreme = 0; document.querySelectorAll('.h1,.tl,.pls,.ex').forEach(e => { if (r(e).bottom > @PH@ - 8) horsCreme++; });
  out.push('hors_creme ' + horsCreme);
  const h1 = r(document.querySelector('.h1')), pls = r(document.querySelector('.pls'));
  // Le bas du titre compte son épaisseur (couche la plus lointaine).
  let basTitre = h1.bottom; document.querySelectorAll('.h1 .x').forEach(e => { basTitre = Math.max(basTitre, r(e).bottom); });
  if (m3) {
    const vis = m3.filter(m => m.aire > 6000).length;
    out.push('objets_3d_visibles ' + vis + '/3 (aires ' + m3.map(m => m.aire).join(', ') + ' px²)');
    const ea = [...document.querySelectorAll('.ea')].map(e => r(e).top);
    out.push('air_objet_libelle ' + Math.round(Math.min(...m3.map((m, i) => ea[i] - m.bas))));
    out.push('air_titre_objets ' + Math.round(Math.min(...m3.map(m => m.haut)) - basTitre));
    out.push('objets_dans_canvas ' + (m3.every(m => m.haut > @TOP@ + 1 && m.bas < @TOP@ + @H@ - 1) ? 'oui' : 'NON'));
    out.push('air_objets_plats ' + Math.round(pls.top - Math.max(...m3.map(m => m.bas))));
  }
  let basPlats = 0; document.querySelectorAll('.pl').forEach(e => { basPlats = Math.max(basPlats, r(e).bottom); });
  out.push('air_plats_mention ' + Math.round(r(document.querySelector('.ex')).top - basPlats));
  const pl = [...document.querySelectorAll('.pl')].map(r);
  out.push('marges_plats ' + Math.round(pl[0].left) + ' / ' + Math.round(1080 - pl[pl.length - 1].right));
  let lignes = 0; document.querySelectorAll('.ea').forEach(e => { if (r(e).height > 40) lignes++; });
  out.push('etapes_sur_2_lignes ' + lignes);
  const rb = r(document.querySelector('.rb')), gc = r(document.querySelector('.gc')), dc = r(document.querySelector('.dc'));
  out.push('air_haut_rouge ' + Math.round(Math.min(gc.top, dc.top) - rb.top));
  out.push('police ' + (document.fonts.check('900 60px Archivo') ? 'Archivo' : 'REPLI'));
  document.body.insertAdjacentHTML('beforeend', '<pre id="m" style="display:none">' + out.join('\n') + '</pre>');
}, 1200));
'''.replace('@PH@', str(plat.PH)).replace('@TOP@', str(C_TOP)).replace('@H@', str(C_H))


def remplacer(s, a, b):
    assert s.count(a) == 1, f'ancre absente ou multiple : {a[:70]!r}'
    return s.replace(a, b)


def html():
    s = plat.html()
    s = remplacer(s, '</style></head>', CSS_3D + f'</style>\n<script src="{trois.THREE_CDN}"></script></head>')
    s = remplacer(s, '<div class="cv">', '<div class="cv v3">')
    s = remplacer(s, '<div class="h1">Plus besoin de monnaie.<br><em>Paie avec Orange Money.</em></div>',
                  '<div class="h1"><div>' + epais('Plus besoin de monnaie.', ENCRE, '#5c5047', '#75685c') + '</div>'
                  '<div>' + epais('Paie avec Orange Money.', OMT, '#7a3a00', '#954a0c') + '</div></div>')
    s = remplacer(s, '<div class="ti">Rien à sortir<br>à la livraison.</div>',
                  '<div class="ti"><div>' + epais('Rien à sortir', '#ffffff', '#8f1a12', '#a8231a', n=7, dx=0.3, dy=0.95) + '</div>'
                  '<div>' + epais('à la livraison.', '#ffffff', '#8f1a12', '#a8231a', n=7, dx=0.3, dy=0.95) + '</div></div>')
    for h, _a, _b in plat.ETAPES:
        s = remplacer(s, f'<div class="ro">{h}</div>', '<div class="ro"></div>')
    ombres = ''.join(f'<div class="ombre" style="left:{x}px;top:{CY + 66}px;"></div>' for x in CENTRES)
    s = remplacer(s, '<div class="li"></div>', '<div class="li"></div>' + ombres)
    s = remplacer(s, '<div class="pls">',
                  f'<canvas class="trois" width="1080" height="{C_H}"></canvas>'
                  '<img class="src-om" src="src/om-logo.png" alt="" style="display:none">'
                  '<div class="pls">')
    debut = s.index('<script>\nwindow.addEventListener')
    fin = s.index('</script>', debut) + len('</script>')
    s = s[:debut] + '<script>\n' + scene_js() + CONTROLES_3D + '</script>' + s[fin:]
    return s


if __name__ == '__main__':
    os.chdir(ICI)
    open('orange-money-3d.html', 'w', encoding='utf-8').write(html())
    print('orange-money-3d.html ecrit')
