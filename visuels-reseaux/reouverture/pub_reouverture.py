# -*- coding: utf-8 -*-
"""Réouverture après la pause du week-end (2026-10-18) — TROIS visuels 1080 × 1350.

Demande du porteur du projet, le soir de la reprise :
  1. « La version officielle » : Orange Money branché dans l'appli (partenariat avec
     Orange, BIENTÔT disponible — l'interrupteur est encore éteint, on ne dit pas « c'est
     fait ») + le livreur qui n'a jamais remis son casque le premier soir ;
  2. « La version officieuse » : un TEASER, rien n'est dévoilé — c'est le jeu du
     18/10 : la version officieuse ne se lit qu'après une commande, sur l'écran de
     confirmation de l'app (components/ModaleWeekend.tsx, jusqu'au mardi 20/10) ;
  3. « Ce soir, on livre » : les logos des restaurants et leurs horaires RÉELS (lus en
     base, restaurant_hours, dimanche 18/10) — ce soir La Cabane, La Plage, Chez Bidule &
     Truc ; demain Les Siciliens et L'escale Créole (fermés le dimanche). Chez M&K, fermé à
     la main, n'y figure pas.

Gabarit repris de cinq-restos/pub_cinq_restos.py : bandeau du haut, filet or 8 px,
bande rouge charte avec badges + logo Taxi Food. Aucune image générée : tout le texte et
tous les logos viennent de fichiers réels.
"""
import os

CREME, ROUGE, OR, ENCRE = '#F6EFE2', '#E8342A', '#FFC72C', '#131313'
FILET, PH = 8, 930
RED = 1350 - PH - FILET


def base_css(fond_haut):
    return f'''*{{margin:0;padding:0;box-sizing:border-box;}}
body{{width:1080px;height:1350px;overflow:hidden;font-family:Archivo,"Helvetica Neue",Arial,sans-serif;-webkit-font-smoothing:antialiased;}}
.cv{{position:relative;width:1080px;height:1350px;background:{ROUGE};overflow:hidden;}}
.hd{{position:absolute;top:0;left:0;width:1080px;height:{PH}px;background:{fond_haut};}}
.fi{{position:absolute;top:{PH}px;left:0;width:1080px;height:{FILET}px;background:{OR};}}
.rb{{position:absolute;top:{PH+FILET}px;left:0;width:1080px;height:{RED}px;padding:30px 62px;
  display:flex;align-items:center;justify-content:space-between;gap:34px;}}
.gc{{display:flex;flex-direction:column;align-items:flex-start;flex:1 1 auto;}}
.su{{display:flex;align-items:center;gap:12px;}}
.su img{{width:36px;height:auto;display:block;}}
.su span{{font-size:20px;font-weight:700;letter-spacing:3.8px;color:{OR};text-transform:uppercase;}}
.ti{{margin-top:10px;font-size:60px;font-weight:900;line-height:0.98;color:#fff;letter-spacing:-1.5px;}}
.se{{margin-top:12px;font-size:23px;font-weight:400;line-height:1.28;color:rgba(255,255,255,0.92);}}
.ur{{margin-top:14px;font-size:17px;font-weight:600;color:rgba(255,255,255,0.72);}}
.dc{{display:flex;flex-direction:column;align-items:center;gap:14px;width:190px;flex:0 0 auto;}}
.dc .bd{{display:flex;flex-direction:column;gap:10px;width:190px;}}
.dc img{{width:190px;height:auto;display:block;}}
.dc .lg{{width:128px;filter:drop-shadow(0 10px 22px rgba(0,0,0,0.38));}}
.st{{position:absolute;top:40px;left:0;width:1080px;text-align:center;font-size:19px;font-weight:800;
  letter-spacing:4.2px;text-transform:uppercase;}}'''


def bande_rouge(titre, sous_titre):
    return f'''<div class="fi"></div>
  <div class="rb">
    <div class="gc">
      <div class="su"><img src="src/taxifood-transparent.png" alt=""><span>Taxi Food · Nosy Be</span></div>
      <div class="ti">{titre}</div>
      <div class="se">{sous_titre}</div>
      <div class="ur">taxifoodnosybe.distripro207.com</div>
    </div>
    <div class="dc"><div class="bd"><img src="src/appstore.png" alt="App Store"><img src="src/googleplay.png" alt="Google Play"></div>
      <img class="lg" src="src/taxifood-transparent.png" alt="Taxi Food"></div>
  </div>'''


CONTROLES = '''<script>
window.addEventListener('load', () => setTimeout(() => {
  const r = e => e.getBoundingClientRect();
  const out = [];
  let deb = 0;
  document.querySelectorAll('.cv *').forEach(e => { const b = r(e); if (!b.width) return;
    if (b.left < -.5 || b.right > 1080.5 || b.top < -.5 || b.bottom > 1350.5) deb++; });
  out.push('debord_cadre ' + deb);
  // le contenu du haut ne descend pas sous le filet (12 px d'air minimum)
  let hors = 0; document.querySelectorAll('.hd > *').forEach(e => { if (r(e).bottom > PH - 12) hors++; });
  out.push('haut_deborde ' + hors);
  const rb = r(document.querySelector('.rb')), gc = r(document.querySelector('.gc')), dc = r(document.querySelector('.dc'));
  out.push('air_rouge_haut ' + Math.round(Math.min(gc.top, dc.top) - rb.top) + ' bas ' + Math.round(rb.bottom - Math.max(gc.bottom, dc.bottom)));
  out.push('colonnes_se_touchent ' + (gc.right > dc.left - 10 ? 'OUI' : 'non'));
  // les blocs du haut ne se chevauchent pas
  const bs = [...document.querySelectorAll('.bloc')].map(r); let chev = 0;
  for (let i=0;i<bs.length;i++) for (let j=i+1;j<bs.length;j++) { const a=bs[i], b=bs[j];
    if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) chev++; }
  out.push('chevauchements ' + chev);
  out.push('police ' + (document.fonts.check('900 60px Archivo') ? 'Archivo' : 'REPLI'));
  document.body.insertAdjacentHTML('beforeend', '<pre id="m" style="display:none">' + out.join('\\n') + '</pre>');
}, 1500));
</script>'''.replace('PH', str(PH))


def page(css, corps):
    return f'''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
<style>{css}</style></head><body><div class="cv">{corps}</div>{CONTROLES}</body></html>'''


ROUGE_COMMUN = bande_rouge('Et nous,<br>on continue.', 'Ce soir, on livre à nouveau.<br>Tu commandes, on te livre là où tu es.')


# ── 1. La version officielle ───────────────────────────────────────────────────────
def officielle():
    css = base_css(CREME) + f'''
.st{{color:rgba(19,19,19,0.52);}}
.tag{{position:absolute;top:96px;left:0;width:1080px;display:flex;justify-content:center;}}
.tag span{{background:{ROUGE};color:#fff;font-size:24px;font-weight:900;letter-spacing:3px;text-transform:uppercase;
  padding:12px 28px 13px;border-radius:40px;box-shadow:0 8px 20px rgba(232,52,42,0.28);}}
.bloc{{position:absolute;left:84px;width:912px;background:#fff;border-radius:26px;padding:34px 40px 36px;
  box-shadow:0 14px 34px rgba(0,0,0,0.10);border-left:10px solid {OR};}}
.bloc .n{{font-size:20px;font-weight:900;letter-spacing:3px;color:{ROUGE};text-transform:uppercase;}}
.bloc h2{{margin-top:8px;font-size:42px;font-weight:900;line-height:1.04;color:{ENCRE};letter-spacing:-0.8px;}}
.bloc p{{margin-top:14px;font-size:25px;font-weight:400;line-height:1.36;color:#3a3633;}}
.bloc p b{{font-weight:800;color:{ENCRE};}}
.teaser{{background:transparent;box-shadow:none;border-left:none;padding:0;text-align:center;font-size:24px;
  font-weight:500;color:rgba(19,19,19,0.72);}}
.teaser b{{font-weight:900;color:{ROUGE};}}'''
    corps = f'''<div class="hd">
    <div class="st">Pourquoi on était fermés samedi et dimanche midi</div>
    <div class="tag"><span>La version officielle</span></div>
    <div class="bloc" style="top:188px;">
      <div class="n">Raison n° 1</div>
      <h2>On branchait Orange&nbsp;Money dans l'appli.</h2>
      <p>Grâce à un nouveau partenariat avec Orange, tu paieras <b>bientôt directement dans l'appli</b>&nbsp;: plus besoin d'en sortir, ni d'envoyer une capture d'écran. Pendant l'installation, aucune vraie commande ne devait se mélanger aux commandes de test.</p>
    </div>
    <div class="bloc" style="top:552px;">
      <div class="n">Raison n° 2</div>
      <h2>Notre livreur n'a jamais remis son casque.</h2>
      <p>Vous avez été tellement nombreux le premier soir… On en recrute un autre, <b>plus endurant</b>.</p>
    </div>
    <div class="teaser bloc" style="top:858px;">La version officieuse&nbsp;? <b>Passe ta commande</b>, elle s'affiche juste après 🤫</div>
  </div>
  {ROUGE_COMMUN}'''
    return page(css, corps)


# ── 2. La version officieuse ───────────────────────────────────────────────────────
def officieuse():
    css = base_css(ENCRE) + f'''
.st{{color:rgba(255,255,255,0.5);}}
.tag{{position:absolute;top:96px;left:0;width:1080px;display:flex;justify-content:center;}}
.tag span{{background:transparent;color:{OR};font-size:24px;font-weight:900;letter-spacing:3px;text-transform:uppercase;
  padding:10px 26px 11px;border-radius:40px;box-shadow:inset 0 0 0 3px {OR};}}
.fantome{{position:absolute;top:166px;left:0;width:1080px;text-align:center;font-size:150px;line-height:1;
  filter:drop-shadow(0 0 40px rgba(255,255,255,0.22));}}
.bloc{{position:absolute;left:96px;width:888px;text-align:center;}}
.bloc h2{{font-size:66px;font-weight:900;line-height:1;color:#fff;letter-spacing:-1.6px;}}
.bloc p{{margin-top:22px;font-size:27px;font-weight:400;line-height:1.4;color:rgba(255,255,255,0.86);}}
.bloc p.fin{{margin-top:0;font-size:24px;color:rgba(255,255,255,0.66);font-style:italic;}}
.tampon{{position:absolute;left:0;width:1080px;display:flex;justify-content:center;}}
.tampon span{{transform:rotate(-6deg);font-size:34px;font-weight:900;letter-spacing:5px;text-transform:uppercase;color:{OR};
  padding:12px 30px 13px;border:5px solid {OR};border-radius:10px;}}'''
    corps = f'''<div class="hd">
    <div class="st">Pourquoi on était fermés samedi et dimanche midi</div>
    <div class="tag"><span>La version officieuse</span></div>
    <div class="fantome">👻</div>
    <div class="bloc" style="top:352px;">
      <h2>Celle-là,<br>elle se mérite.</h2>
      <p>Pour la découvrir, passe ta commande dans l'appli&nbsp;: elle s'affiche juste après. Un indice&nbsp;? Il y a des fantômes.</p>
    </div>
    <div class="tampon" style="top:700px;"><span>Top secret</span></div>
    <div class="bloc" style="top:810px;">
      <p class="fin">Le jeu dure jusqu'à mardi soir.</p>
    </div>
  </div>
  {bande_rouge('Commande,<br>et tu sauras.', 'La version officieuse s’affiche<br>juste après ta commande.')}'''
    return page(css, corps)


# ── 3. Ce soir, on livre ───────────────────────────────────────────────────────────
# Horaires lus en base le 18/10 (restaurant_hours, dimanche = 0, lundi = 1).
CE_SOIR = [
    ('src/logo-cabane.jpg', 1.07, 'La Cabane', '16 h – 22 h'),
    ('src/logo-laplage.png', 1.0, 'La Plage', '18 h – 22 h'),
    ('src/logo-bidule.jpg', 1.0, 'Chez Bidule &amp; Truc', '19 h – 21 h 45'),
]
DEMAIN = [
    ('src/logo-siciliens.png', 1.0, 'Les Siciliens', 'dès 9 h 30'),
    ('src/logo-escale.png', 0.80, "L'escale Créole", 'dès 11 h 30'),
]


def ce_soir():
    css = base_css(CREME) + f'''
.st{{color:rgba(19,19,19,0.52);}}
.ti2{{position:absolute;top:84px;left:0;width:1080px;text-align:center;font-size:76px;font-weight:900;
  letter-spacing:-2px;color:{ENCRE};line-height:1;}}
.ti2 em{{font-style:normal;color:{ROUGE};}}
.rang{{position:absolute;left:0;width:1080px;display:flex;justify-content:center;}}
.bloc{{display:flex;flex-direction:column;align-items:center;width:330px;}}
.pa{{border-radius:50%;overflow:hidden;background:#FBF2E2;box-shadow:0 0 0 3px rgba(19,19,19,0.55),0 12px 26px rgba(0,0,0,0.20);}}
.pa img{{width:100%;height:100%;object-fit:cover;display:block;}}
.nm{{margin-top:16px;font-weight:800;color:{ENCRE};letter-spacing:-0.2px;white-space:nowrap;}}
.hr{{margin-top:10px;font-weight:900;color:#fff;background:{ROUGE};border-radius:30px;white-space:nowrap;}}
.g .pa{{width:220px;height:220px;}} .g .nm{{font-size:27px;}} .g .hr{{font-size:26px;padding:9px 22px 10px;}}
.p .pa{{width:132px;height:132px;}} .p .nm{{font-size:22px;margin-top:12px;}}
.p .hr{{font-size:20px;padding:7px 18px 8px;background:{ENCRE};}}
.sep{{position:absolute;top:648px;left:0;width:1080px;display:flex;align-items:center;justify-content:center;gap:18px;}}
.sep i{{display:block;width:150px;height:2px;background:rgba(19,19,19,0.18);}}
.sep span{{font-size:19px;font-weight:800;letter-spacing:4px;text-transform:uppercase;color:rgba(19,19,19,0.55);}}'''

    def b(logo, z, nom, h, cls):
        return f'''<div class="bloc {cls}"><div class="pa"><img src="{logo}" style="transform:scale({z});" alt="{nom}"></div>
      <div class="nm">{nom}</div><div class="hr">{h}</div></div>'''

    corps = f'''<div class="hd">
    <div class="st">Dimanche 18 octobre</div>
    <div class="ti2">Ce soir, <em>on livre.</em></div>
    <div class="rang" style="top:212px;">{''.join(b(*m, 'g') for m in CE_SOIR)}</div>
    <div class="sep"><i></i><span>Et demain lundi</span><i></i></div>
    <div class="rang" style="top:694px;">{''.join(b(*m, 'p') for m in DEMAIN)}</div>
  </div>
  {bande_rouge('On est<br>de retour.', 'Aucun minimum de commande.<br>Livraison dès 2&nbsp;000 Ar.')}'''
    return page(css, corps)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    for nom, f in (('officielle', officielle), ('officieuse', officieuse), ('ce-soir', ce_soir)):
        open(f'{nom}.html', 'w', encoding='utf-8').write(f())
        print(f'{nom}.html ecrit')
