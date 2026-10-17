# -*- coding: utf-8 -*-
"""La 3D du film « Paiement Orange Money » (v5) : vraie 3D temps réel (Three.js r147, build global).

Trois scènes en relief, rendues dans un <canvas> de la sous-composition :
- f01 : l'icône Taxi Food en tuile 3D (laquée, biseautée, tranches peintes dans le dégradé de l'icône) ;
- f06 : la pièce Orange Money qui arrive en tournant, la coche blanche en relief qui se trace, confettis 3D ;
- f09 : le duo Taxi Food × Orange Money en tuiles 3D qui se balancent en opposition de phase.

Règles (hyperframes-animation/adapters/three.md + charte Taxi Food) :
- l'état 3D est une fonction PURE du temps local de la scène : une tween « moteur » en ease:"none" sur la
  timeline GSAP de la sous-composition appelle rendu(t) dans son onUpdate (seek-safe, rejouable) ;
- aucun Math.random (pseudo-aléatoire indexé), aucune horloge, aucune boucle requestAnimationFrame ;
- textures tirées des <img> déjà présents (le logo réel, jamais redessiné), attendues par
  window.__hf.buildReady avant la première image ;
- taille et pixelRatio figés ; preserveDrawingBuffer pour la capture.
"""

THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'


def tpl(js, **kw):
    for k, v in kw.items():
        js = js.replace('@' + k + '@', str(v))
    assert '@' not in js.replace('@media', ''), 'jeton non remplacé'
    return js


# --------------------------------------------------------------------------- bibliothèque commune
LIB = r'''
var T3 = (function(){
  var T = THREE;
  T.ColorManagement.legacyMode = false;
  function prand(n){ var x = Math.sin(n*127.1+311.7)*43758.5453; return x - Math.floor(x); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function seg(t,a,b){ return clamp((t-a)/(b-a), 0, 1); }
  var E = {
    out2: function(x){ return 1-(1-x)*(1-x); },
    out3: function(x){ return 1-Math.pow(1-x,3); },
    out4: function(x){ return 1-Math.pow(1-x,4); },
    in2: function(x){ return x*x; },
    inOut3: function(x){ return x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2; },
    inOutS: function(x){ return -(Math.cos(Math.PI*x)-1)/2; },
    back: function(x,s){ s = s===undefined ? 1.7 : s; var c3 = s+1; return 1 + c3*Math.pow(x-1,3) + s*Math.pow(x-1,2); }
  };
  function moteur(canvas, w, h){
    var r = new T.WebGLRenderer({canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true});
    r.setPixelRatio(1); r.setSize(w, h, false);
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.NoToneMapping;
    r.physicallyCorrectLights = true;
    r.setClearColor(0x000000, 0);
    return r;
  }
  // Studio : une pièce sombre et chaude, quatre boîtes à lumière, convertie en carte d'environnement
  // (PMREM) : ce sont ces rectangles que le laqué et la clearcoat reflètent.
  function studio(r){
    var s = new T.Scene();
    s.add(new T.Mesh(new T.BoxGeometry(24,24,24), new T.MeshBasicMaterial({color: new T.Color(0.05,0.042,0.035), side: T.BackSide})));
    function boite(w,h,x,y,z,rx,ry,i,c){ var col = new T.Color(c || 0xffffff).multiplyScalar(i);
      var m = new T.Mesh(new T.PlaneGeometry(w,h), new T.MeshBasicMaterial({color: col, side: T.DoubleSide}));
      m.position.set(x,y,z); m.rotation.set(rx,ry,0); s.add(m); }
    boite(14, 5, 0, 11.5, 1, Math.PI/2, 0, 5.5);               // plafond
    boite(4, 12, -11.5, 1.5, 3, 0, Math.PI/2, 3.2);            // gauche
    boite(3, 12, 11.5, 0.5, -1, 0, -Math.PI/2, 2.2, 0xffd9a0); // droite, chaude
    boite(10, 2.2, 0, -2, 11.5, 0, Math.PI, 1.3);               // face, basse
    var pm = new T.PMREMGenerator(r);
    var env = pm.fromScene(s, 0.035).texture;
    pm.dispose();
    return env;
  }
  function lumieres(scene, cle){
    scene.add(new T.HemisphereLight(0xfff4e6, 0x3a2a1e, 0.9));
    var d = new T.DirectionalLight(0xffffff, cle || 2.6); d.position.set(-3.2, 5, 6); scene.add(d);
    var r = new T.DirectionalLight(0xffe0b0, 1.4); r.position.set(4, 1.5, -3); scene.add(r);
  }
  // Superellipse (« squircle » des icônes d'appli) dans le carré [0,1]² : UV des faces = (x, y).
  function squircle(n, inset){
    var s = new T.Shape(), N = 360, k = inset || 0;
    for (var i=0;i<=N;i++){ var th = i/N*2*Math.PI, c = Math.cos(th), sn = Math.sin(th);
      var x = 0.5 + (0.5-k)*Math.sign(c)*Math.pow(Math.abs(c), 2/n);
      var y = 0.5 + (0.5-k)*Math.sign(sn)*Math.pow(Math.abs(sn), 2/n);
      if (i===0) s.moveTo(x,y); else s.lineTo(x,y); }
    return s;
  }
  // Tuile d'icône : face = texture (moitié « dessus » des couvercles), dos et tranches en couleurs de
  // sommet. couleurTranche(u,v) -> [r,g,b] sRGB 0..255 : les tranches prolongent le dégradé de la face.
  function tuile(o){
    var prof = o.prof || 0.11, bev = o.bev || 0.045;
    var g = new T.ExtrudeGeometry(squircle(o.n || 5.4, 0.004), {depth: prof, bevelEnabled: true, bevelThickness: bev,
      bevelSize: bev*0.9, bevelSegments: 10, curveSegments: 4, steps: 1});
    var g0 = g.groups[0], g1 = g.groups[1], moitie = g0.count/2;
    g.clearGroups(); g.addGroup(g0.start, moitie, 2); g.addGroup(g0.start + moitie, moitie, 0); g.addGroup(g1.start, g1.count, 1);
    var pos = g.attributes.position, cols = new Float32Array(pos.count*3), c = new T.Color();
    for (var i=0;i<pos.count;i++){ var rgb = o.couleurTranche(pos.getX(i), pos.getY(i));
      c.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255); c.convertSRGBToLinear(); cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b; }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    g.translate(-0.5, -0.5, -prof/2);
    g.scale(o.taille, o.taille*(o.aspect||1), o.taille);
    var face = new T.MeshPhysicalMaterial({map: o.tex, roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.07});
    var tranche = new T.MeshPhysicalMaterial({vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08});
    var dos = new T.MeshPhysicalMaterial({vertexColors: true, roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.15});
    return new T.Mesh(g, [face, tranche, dos]);
  }
  function texCanvas(w, h, dessin){
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h; dessin(cv.getContext('2d'), w, h);
    var t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; t.anisotropy = 8;
    t.minFilter = T.LinearMipmapLinearFilter; return t;
  }
  // Dégradé de l'icône Taxi Food (relevé sur le PNG) : rouge en bas à gauche, jaune en haut à droite.
  function gradTF(u, v){ var t = clamp((u + v)/2, 0, 1);
    var a = [197,34,53], m = [241,112,35], b = [248,188,38];
    return t < .5 ? [lerp(a[0],m[0],t*2), lerp(a[1],m[1],t*2), lerp(a[2],m[2],t*2)]
                  : [lerp(m[0],b[0],t*2-1), lerp(m[1],b[1],t*2-1), lerp(m[2],b[2],t*2-1)]; }
  function texTF(img){ return texCanvas(1024, 1024, function(g, w, h){
      var gr = g.createLinearGradient(0, h, w, 0); gr.addColorStop(0, 'rgb(197,34,53)'); gr.addColorStop(.5, 'rgb(241,112,35)'); gr.addColorStop(1, 'rgb(248,188,38)');
      g.fillStyle = gr; g.fillRect(0,0,w,h); g.drawImage(img, 0, 0, w, h); }); }
  function texOM(img){ return texCanvas(1024, 1024, function(g, w, h){
      // Le PNG d'Orange porte un filet gris d'un pixel sur son pourtour : on le laisse hors champ (4 px).
      g.fillStyle = '#000'; g.fillRect(0,0,w,h); var sw = img.naturalWidth - 8, sh = img.naturalHeight - 8, k = 0.80*Math.min(w/sw, h/sh);
      var iw = sw*k, ih = sh*k; g.drawImage(img, 4, 4, sw, sh, (w-iw)/2, (h-ih)/2 + h*0.01, iw, ih); }); }
  function tuileTF(img, taille){ return tuile({tex: texTF(img), taille: taille, aspect: 403/392, couleurTranche: gradTF}); }
  function tuileOM(img, taille){ return tuile({tex: texOM(img), taille: taille, aspect: 1, couleurTranche: function(){ return [16,13,11]; }}); }
  function attendre(imgs){ return Promise.all(imgs.map(function(i){ return (i.decode ? i.decode() : Promise.resolve()).catch(function(){}); })); }
  function pret(cle, p){ window.__hf = window.__hf || {}; window.__hf.buildReady = window.__hf.buildReady || {}; window.__hf.buildReady[cle] = p; }
  // Unités 3D par pixel au plan z = 0, caméra perspective à « distance ».
  function uParPx(cam, distance, hauteurPx){ return 2*distance*Math.tan(cam.fov*Math.PI/360)/hauteurPx; }
  return {T:T, prand:prand, clamp:clamp, lerp:lerp, seg:seg, E:E, moteur:moteur, studio:studio, lumieres:lumieres,
          tuile:tuile, tuileTF:tuileTF, tuileOM:tuileOM, texCanvas:texCanvas, attendre:attendre, pret:pret, uParPx:uParPx};
})();
'''


# --------------------------------------------------------------------------- f01 : l'icône en 3D
def scene_tf(cid, w, h, arrivee, pose, fin, taille):
    """La tuile Taxi Food arrive de sous le cadre en tournant (1,75 tour), se pose avec un léger
    dépassement, puis se balance doucement : les reflets du studio glissent sur la laque."""
    return tpl(r'''
(function(){
  var K = T3, T = THREE, cv = document.querySelector("#@CID@ canvas.trois"), img = document.querySelector("#@CID@ img.src-tf");
  var r = K.moteur(cv, @W@, @H@), sc = new T.Scene(), cam = new T.PerspectiveCamera(26, @W@/@H@, 0.1, 100);
  cam.position.set(0, 0, 12); cam.lookAt(0, 0, 0);
  sc.environment = K.studio(r); K.lumieres(sc, 2.4);
  var u = K.uParPx(cam, 12, @H@), piv = new T.Group(); sc.add(piv);
  var etat = {t:0}, construit = false;
  function rendu(t){
    if (!construit) return;
    var p = K.seg(t, @ARR@, @POSE@), pe = K.E.out4(p), apres = Math.max(0, t - @POSE@), calme = K.seg(t, @POSE@, @POSE@ + 0.6);
    piv.position.set(0, K.lerp(-300*u, 0, pe), K.lerp(-7, 0, pe));
    piv.rotation.y = K.lerp(-Math.PI*1.75, 0, K.E.back(p, 1.15)) + 0.17*Math.sin(apres*1.7)*calme;
    piv.rotation.x = K.lerp(0.7, 0, pe) - 0.06*Math.sin(apres*1.2)*calme;
    piv.rotation.z = K.lerp(-0.4, 0, pe);
    var s = K.lerp(0.2, 1, K.E.back(p, 1.5)); piv.scale.set(s, s, s);
    r.render(sc, cam);
  }
  var p = K.attendre([img]).then(function(){ piv.add(K.tuileTF(img, @TAILLE@*u)); construit = true; rendu(etat.t); });
  K.pret("@CID@-trois", p);
  tl.fromTo(etat, {t:0}, {t:@FIN@, duration:@FIN@, ease:"none", onUpdate:function(){ rendu(etat.t); }}, 0);
})();
''', CID=cid, W=w, H=h, ARR=arrivee, POSE=pose, FIN=fin, TAILLE=taille)


# --------------------------------------------------------------------------- f06 : la pièce Orange Money
def scene_piece(cid, w, h, arrivee, pose, trace0, trace1, eclat, fin, rayon_px, n_conf=60):
    """Pièce orange (profil tourné : face, listel, tranche arrondie), coche blanche en tube qui se trace
    (drawRange), confettis 3D balistiques (InstancedMesh, gravité, culbute, rétrécissent en fin de vie)."""
    return tpl(r'''
(function(){
  var K = T3, T = THREE, cv = document.querySelector("#@CID@ canvas.trois");
  var r = K.moteur(cv, @W@, @H@), sc = new T.Scene(), cam = new T.PerspectiveCamera(28, @W@/@H@, 0.1, 100);
  cam.position.set(0, 0, 14); cam.lookAt(0, 0, 0);
  sc.environment = K.studio(r); K.lumieres(sc, 2.8);
  var u = K.uParPx(cam, 14, @H@), R = @RAYON@*u, h0 = 0.075*R;
  // Profil de la pièce (x = rayon, y = hauteur), tourné autour de Y puis couché face caméra.
  // du centre du DESSOUS au centre du DESSUS (sens montant = normales vers l'extérieur)
  var pr = [[0,-h0],[R*.78,-h0],[R*.82,-h0-R*.035],[R*.92,-h0-R*.045],[R*.975,-h0-R*.02],[R,0],[R*.975,h0+R*.02],[R*.92,h0+R*.045],[R*.82,h0+R*.035],[R*.78,h0],[0,h0]];
  var pts = pr.map(function(q){ return new T.Vector2(q[0], q[1]); });
  var gp = new T.LatheGeometry(pts, 160); gp.rotateX(Math.PI/2);
  var orange = new T.Color(0xFF7900);
  var mp = new T.MeshPhysicalMaterial({color: orange, roughness: 0.28, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.4, sheenColor: new T.Color(0xffb36b)});
  var piece = new T.Mesh(gp, mp);
  // La coche : trois points de la coche du film (SVG 200 → disque de 460 px), tube rond en relief.
  var k = R/230, z = h0 + 0.035*R;
  var A = new T.Vector3(-72*k, -6*k, z), B = new T.Vector3(-18*k, -60*k, z), C = new T.Vector3(78*k, 51*k, z);
  var chemin = new T.CurvePath(); chemin.add(new T.LineCurve3(A, B)); chemin.add(new T.LineCurve3(B, C));
  var NS = 160, NR = 20, rt = 16.5*k;
  var gt = new T.TubeGeometry(chemin, NS, rt, NR, false);
  var blanc = new T.MeshPhysicalMaterial({color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05});
  var coche = new T.Mesh(gt, blanc);
  var gs = new T.SphereGeometry(rt, 24, 16);
  var capA = new T.Mesh(gs, blanc), capB = new T.Mesh(gs, blanc), bout = new T.Mesh(gs, blanc);
  capA.position.copy(A); capB.position.copy(B);
  var lAB = A.distanceTo(B), lBC = B.distanceTo(C), fAB = lAB/(lAB+lBC);
  var piv = new T.Group(); piv.add(piece); piv.add(coche); piv.add(capA); piv.add(capB); piv.add(bout); sc.add(piv);
  // Confettis : rectangles fins, quatre couleurs de la charte, une seule matière instanciée.
  var N = @NCONF@, gc = new T.BoxGeometry(0.17*R, 0.105*R, 0.012*R);
  var mc = new T.MeshStandardMaterial({roughness: 0.42, metalness: 0.15, side: T.DoubleSide});
  var conf = new T.InstancedMesh(gc, mc, N), pal = [0xFF7900, 0xFFC72C, 0xE8342A, 0xFFFBF4], col = new T.Color();
  var P = [];
  for (var i=0;i<N;i++){ col.set(pal[i%4]); conf.setColorAt(i, col);
    // vitesses en px/s (comme les confettis 2D de la v4), converties en unités 3D par u
    var a = K.prand(i*3+1)*Math.PI*2, el = (K.prand(i*5+2)-0.35)*1.2, sp = (650 + K.prand(i*7+3)*850)*u;
    P.push({vx: Math.cos(a)*Math.cos(el)*sp, vy: Math.sin(el)*sp*0.8 + (520 + K.prand(i*17+9)*620)*u, vz: Math.sin(a)*Math.cos(el)*sp*0.5,
            wx: (K.prand(i*11+4)-.5)*22, wy: (K.prand(i*13+5)-.5)*22, wz: (K.prand(i*19+6)-.5)*16, sc: 0.65 + K.prand(i*23+7)*0.7,
            vie: 1.15 + K.prand(i*29+8)*0.55}); }
  conf.instanceColor.needsUpdate = true; conf.frustumCulled = false; sc.add(conf);
  var m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), vp = new T.Vector3(), vs = new T.Vector3();
  var G = 2600*u, etat = {t:0};
  function rendu(t){
    // Arrivée : du fond, 2,5 tours sur Y, pose avec un dépassement ; puis la pièce respire.
    var p = K.seg(t, @ARR@, @POSE@), pe = K.E.out4(p), apres = Math.max(0, t - @POSE@), calme = K.seg(t, @POSE@, @POSE@ + 0.5);
    piv.position.set(0, 0.04*R*Math.sin(apres*2.0)*calme, K.lerp(-16, 0, pe));
    piv.rotation.y = K.lerp(-Math.PI*5, 0, K.E.back(p, 1.05)) + 0.2*Math.sin(apres*1.6)*calme;
    piv.rotation.x = K.lerp(-0.5, 0, pe) + 0.07*Math.sin(apres*1.3 + 0.7)*calme;
    var s = K.lerp(0.3, 1, K.E.back(p, 1.6)); piv.scale.set(s, s, s);
    // La coche se trace (A → B → C), bouts arrondis.
    var c = K.E.inOut3(K.seg(t, @T0@, @T1@));
    coche.geometry.setDrawRange(0, Math.floor(c*NS)*NR*6);
    capA.visible = c > 0; capB.visible = c >= fAB; bout.visible = c > 0 && c < 1;
    if (c > 0) bout.position.copy(chemin.getPointAt(Math.min(c, 1)));
    // Confettis, fonction pure du temps depuis l'éclat.
    var te = t - @ECLAT@;
    for (var i=0;i<N;i++){ var Q = P[i], tt = Math.max(0, te), vie = K.clamp(1 - (tt - Q.vie*0.7)/(Q.vie*0.3), 0, 1);
      var sc_ = te > 0 ? Q.sc*vie : 0;
      vp.set(Q.vx*tt, Q.vy*tt - 0.5*G*tt*tt, Q.vz*tt + 0.35*R); eu.set(Q.wx*tt, Q.wy*tt, Q.wz*tt); q.setFromEuler(eu);
      vs.set(sc_, sc_, sc_); m4.compose(vp, q, vs); conf.setMatrixAt(i, m4); }
    conf.instanceMatrix.needsUpdate = true;
    r.render(sc, cam);
  }
  K.pret("@CID@-trois", Promise.resolve().then(function(){ rendu(etat.t); }));
  tl.fromTo(etat, {t:0}, {t:@FIN@, duration:@FIN@, ease:"none", onUpdate:function(){ rendu(etat.t); }}, 0);
  rendu(0);
})();
''', CID=cid, W=w, H=h, ARR=arrivee, POSE=pose, T0=trace0, T1=trace1, ECLAT=eclat, FIN=fin, RAYON=rayon_px, NCONF=n_conf)


# --------------------------------------------------------------------------- f09 : le duo
def scene_duo(cid, w, h, tf0, tf1, om0, om1, fin, taille, ecart):
    """Les deux tuiles arrivent de part et d'autre (rotations opposées), se posent, puis se balancent en
    opposition de phase (split-tilt-cards) : la 3D reste vivante jusqu'à la dernière image."""
    return tpl(r'''
(function(){
  var K = T3, T = THREE, cv = document.querySelector("#@CID@ canvas.trois");
  var itf = document.querySelector("#@CID@ img.src-tf"), iom = document.querySelector("#@CID@ img.src-om");
  var r = K.moteur(cv, @W@, @H@), sc = new T.Scene(), cam = new T.PerspectiveCamera(24, @W@/@H@, 0.1, 100);
  cam.position.set(0, 0, 13); cam.lookAt(0, 0, 0);
  sc.environment = K.studio(r); K.lumieres(sc, 2.4);
  var u = K.uParPx(cam, 13, @H@), g1 = new T.Group(), g2 = new T.Group(); sc.add(g1); sc.add(g2);
  var X = @ECART@*u, etat = {t:0}, construit = false;
  function pose(g, t, a, b, sens, phase){
    var p = K.seg(t, a, b), pe = K.E.out4(p), apres = Math.max(0, t - b), calme = K.seg(t, b, b + 0.6);
    g.visible = t >= a;   // pas de tuile en attente au bord du cadre avant son entrée
    g.position.set(sens*K.lerp(X + 520*u, X, pe), 0.035*@TAILLE@*u*Math.sin(apres*1.9 + phase)*calme, K.lerp(-5, 0, pe));
    g.rotation.y = sens*K.lerp(-Math.PI*1.2, 0, K.E.back(p, 1.2)) + sens*0.22*Math.sin(apres*1.5 + phase)*calme;
    g.rotation.x = K.lerp(0.5, 0, pe) + 0.05*Math.sin(apres*1.2 + phase)*calme;
    var s = K.lerp(0.15, 1, K.E.back(p, 1.5)); g.scale.set(s, s, s);
  }
  function rendu(t){
    if (!construit) return;
    pose(g1, t, @TF0@, @TF1@, -1, 0); pose(g2, t, @OM0@, @OM1@, 1, Math.PI);
    r.render(sc, cam);
  }
  var p = K.attendre([itf, iom]).then(function(){
    g1.add(K.tuileTF(itf, @TAILLE@*u)); g2.add(K.tuileOM(iom, @TAILLE@*u)); construit = true; rendu(etat.t); });
  K.pret("@CID@-trois", p);
  tl.fromTo(etat, {t:0}, {t:@FIN@, duration:@FIN@, ease:"none", onUpdate:function(){ rendu(etat.t); }}, 0);
})();
''', CID=cid, W=w, H=h, TF0=tf0, TF1=tf1, OM0=om0, OM1=om1, FIN=fin, TAILLE=taille, ECART=ecart)
