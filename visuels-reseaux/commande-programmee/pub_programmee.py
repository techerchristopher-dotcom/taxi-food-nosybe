# -*- coding: utf-8 -*-
"""Annonce « Commande pour plus tard » (le jour même) — à publier le lundi 19/10/2026.

Fonction en ligne depuis le 17/10 (app + web + base), annoncée la semaine suivante :
visuel, push et e-mail le même jour.

Charte reprise de cinq-restos/pub_cinq_restos.py : bandeau crème #F6EFE2, filet or 8,
bande rouge #E8342A, colonne droite badges + logo Taxi Food. Le bandeau crème explique
la fonction en TROIS TEMPS (heures données en exemple, celles de La Cabane qui ouvre à 16 h),
puis une rangée de VRAIS plats commandables (photos du bucket `produits/`, une par maison).

Aucune image générée : tout le texte vient de ce gabarit (règle 1 de la charte).
"""
import os

CREME, ROUGE, OR, ENCRE = '#F6EFE2', '#E8342A', '#FFC72C', '#131313'
FILET, PAD_V, PAD_H, COL_W = 8, 28, 62, 190
PH = 900                      # hauteur du bandeau crème

ETAPES = [
    ('10 h', 'Tu commandes', 'même si le resto<br>est encore fermé'),
    ('16 h', 'Le resto ouvre', 'et reçoit ta commande<br>tout de suite'),
    ('19 h', 'Tu es livré', 'à l’heure que<br>tu as choisie'),
]
# (photo, zoom) — une maison par plat : La Cabane, Chez Bidule & Truc, Les Siciliens,
# La Plage, L'escale Créole. Zoom > 1 recadre un packshot sur fond ardoise.
PLATS = [('src/c2.png', 1.45), ('src/b1.png', 1.1), ('src/s1.png', 1.15), ('src/p2.jpg', 1.0), ('src/e1.jpg', 1.15)]


def html():
    etapes = ''.join(
        f'''<div class="et"><div class="ro">{h}</div><div class="ea">{a}</div><div class="eb">{b}</div></div>'''
        for h, a, b in ETAPES)
    plats = ''.join(f'<div class="pl"><img src="{f}" style="transform:scale({z});"></div>' for f, z in PLATS)
    red = 1350 - PH - FILET
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
<style>
*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:1080px;height:1350px;overflow:hidden;font-family:Archivo,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;}}
.cv{{position:relative;width:1080px;height:1350px;background:{ROUGE};overflow:hidden;}}
.cr{{position:absolute;top:0;left:0;width:1080px;height:{PH}px;background:{CREME};}}
.st{{position:absolute;top:44px;left:0;width:1080px;text-align:center;font-size:19px;font-weight:800;
  letter-spacing:4.2px;text-transform:uppercase;color:rgba(19,19,19,0.52);}}
.st b{{color:{ROUGE};}}
.h1{{position:absolute;top:92px;left:0;width:1080px;text-align:center;font-size:66px;font-weight:900;
  line-height:1.0;letter-spacing:-1.6px;color:{ENCRE};}}
.h1 em{{font-style:normal;color:{ROUGE};}}
.tl{{position:absolute;top:300px;left:60px;width:960px;display:flex;justify-content:space-between;}}
.li{{position:absolute;top:362px;left:220px;width:640px;height:6px;border-radius:3px;
  background:repeating-linear-gradient(90deg,{OR} 0 22px,transparent 22px 34px);}}
.et{{width:300px;display:flex;flex-direction:column;align-items:center;text-align:center;}}
.ro{{width:132px;height:132px;border-radius:50%;background:{ENCRE};color:#fff;display:flex;align-items:center;
  justify-content:center;font-size:44px;font-weight:900;letter-spacing:-1px;
  box-shadow:0 0 0 6px {CREME},0 0 0 10px {OR},0 14px 28px rgba(0,0,0,0.22);}}
.et:last-child .ro{{background:{ROUGE};}}
.ea{{margin-top:26px;font-size:30px;font-weight:900;color:{ENCRE};letter-spacing:-0.4px;}}
.eb{{margin-top:8px;font-size:21px;font-weight:500;line-height:1.28;color:rgba(19,19,19,0.62);}}
.pls{{position:absolute;top:640px;left:0;width:1080px;display:flex;justify-content:center;gap:18px;}}
.pl{{width:186px;height:186px;border-radius:20px;overflow:hidden;background:#222;box-shadow:0 10px 22px rgba(0,0,0,0.20);}}
.pl img{{width:100%;height:100%;object-fit:cover;display:block;}}
.ex{{position:absolute;top:846px;left:0;width:1080px;text-align:center;font-size:15px;font-weight:500;color:rgba(19,19,19,0.45);}}
.fi{{position:absolute;top:{PH}px;left:0;width:1080px;height:{FILET}px;background:{OR};}}
.rb{{position:absolute;top:{PH+FILET}px;left:0;width:1080px;height:{red}px;padding:{PAD_V}px {PAD_H}px;
  display:flex;align-items:flex-end;justify-content:space-between;gap:34px;}}
.gc{{display:flex;flex-direction:column;align-items:flex-start;flex:1 1 auto;}}
.su{{display:flex;align-items:center;gap:12px;}}
.su img{{width:36px;height:auto;display:block;}}
.su span{{font-size:20px;font-weight:700;letter-spacing:3.8px;color:{OR};text-transform:uppercase;}}
.ti{{margin-top:10px;font-size:60px;font-weight:900;line-height:0.98;color:#fff;letter-spacing:-1.5px;}}
.se{{margin-top:12px;font-size:23px;font-weight:400;line-height:1.26;color:rgba(255,255,255,0.92);}}
.pr{{margin-top:16px;display:inline-flex;flex-direction:column;background:{ENCRE};border-radius:12px;padding:13px 23px 14px;}}
.pr .a{{font-size:22px;font-weight:800;color:#fff;}}
.pr .b{{margin-top:5px;font-size:20px;font-weight:600;color:rgba(255,255,255,0.9);}}
.pr .b b{{font-weight:900;color:{OR};}}
.ur{{margin-top:12px;font-size:17px;font-weight:600;color:rgba(255,255,255,0.72);}}
.dc{{display:flex;flex-direction:column;align-items:center;gap:16px;width:{COL_W}px;flex:0 0 auto;}}
.dc .bd{{display:flex;flex-direction:column;gap:11px;width:{COL_W}px;}}
.dc img{{width:{COL_W}px;height:auto;display:block;}}
.dc .lg{{width:150px;filter:drop-shadow(0 10px 22px rgba(0,0,0,0.38));}}
</style></head><body><div class="cv">
  <div class="cr">
    <div class="st"><b>Nouveau</b> dans l’appli Taxi Food</div>
    <div class="h1">Ton resto est fermé ?<br><em>Commande quand même.</em></div>
    <div class="li"></div>
    <div class="tl">{etapes}</div>
    <div class="pls">{plats}</div>
    <div class="ex">Exemple : La Cabane ouvre à 16 h.</div>
  </div>
  <div class="fi"></div>
  <div class="rb">
    <div class="gc">
      <div class="su"><img src="src/taxifood-transparent.png" alt=""><span>Taxi Food · Nosy Be</span></div>
      <div class="ti">Choisis ton heure,<br>on s’occupe du reste.</div>
      <div class="se">Pour le jour même, dans tous les restos de l’appli.<br>Livraison dès 2 000 Ar.</div>
      <div class="pr"><span class="a">Au moment de payer :</span>
        <span class="b">« <b>Quand veux-tu être livré ?</b> »</span></div>
      <div class="ur">taxifoodnosybe.distripro207.com</div>
    </div>
    <div class="dc"><div class="bd"><img src="src/appstore.png" alt="App Store"><img src="src/googleplay.png" alt="Google Play"></div>
      <img class="lg" src="src/taxifood-transparent.png" alt="Taxi Food"></div>
  </div>
</div>
<script>
window.addEventListener('load', () => setTimeout(() => {{
  const r = e => e.getBoundingClientRect();
  const out = [];
  let deb = 0;
  document.querySelectorAll('.st,.h1,.tl,.et,.pls,.pl,.ex,.gc,.dc,.pr,.ur,.ti').forEach(e => {{
    const b = r(e); if (b.left < -.5 || b.right > 1080.5 || b.top < -.5 || b.bottom > 1350.5) deb++; }});
  out.push('debord_cadre ' + deb);
  let horsCreme = 0; document.querySelectorAll('.h1,.tl,.pls,.ex').forEach(e => {{ if (r(e).bottom > {PH} - 8) horsCreme++; }});
  out.push('hors_creme ' + horsCreme);
  const h1 = r(document.querySelector('.h1')), tl = r(document.querySelector('.tl')), pls = r(document.querySelector('.pls'));
  out.push('air_titre_frise ' + Math.round(tl.top - h1.bottom) + ' air_frise_plats ' + Math.round(pls.top - tl.bottom));
  let lignes = 0; document.querySelectorAll('.ea').forEach(e => {{ if (r(e).height > 40) lignes++; }});
  out.push('etapes_sur_2_lignes ' + lignes);
  const rb = r(document.querySelector('.rb')), gc = r(document.querySelector('.gc')), dc = r(document.querySelector('.dc'));
  out.push('air_haut_rouge ' + Math.round(Math.min(gc.top, dc.top) - rb.top));
  out.push('police ' + (document.fonts.check('900 60px Archivo') ? 'Archivo' : 'REPLI'));
  document.body.insertAdjacentHTML('beforeend', '<pre id="m" style="display:none">' + out.join('\\n') + '</pre>');
}}, 1500));
</script>
</body></html>'''


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    open('commande-programmee.html', 'w', encoding='utf-8').write(html())
    print('commande-programmee.html ecrit')
