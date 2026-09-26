# -*- coding: utf-8 -*-
"""L'annonce « toutes les maisons » : les quatre partenaires, M&K en nouveau.

MEME ARCHITECTURE QUE L'ANNONCE D'UN RESTAURANT — bandeau haut 748, filet or 8,
bande rouge 594 — mais le bandeau ne porte pas des photos : il porte les quatre
pastilles sur un fond creme.

POURQUOI CREME ET NON ROUGE. Les quatre pastilles sont mesurees : La Cabane et
Chez M&K ont un fond noir, Chez Bidul un fond blanc, La Plage un fond blanc.
Sur le rouge charte, les deux noires tiennent (4,7:1) mais les deux blanches
ne se detachent plus du tout — le blanc du logo et le rouge de la charte sont
deux aplats francs qui se touchent sans bord. Sur creme #F6EFE2, les deux
noires montent a 17,2:1 (Cabane) et 6,3:1 (M&K).

LES DEUX BLANCHES, ELLES, NE TIENNENT PAS DAVANTAGE SUR LE CREME : mesure au
rendu, La Plage tombe a 1,14:1 et Chez Bidul a 2,04:1. Le pari « leur propre
filet suffira » etait faux. Chaque pastille recoit donc LE MEME CERNE encre, 3 px.
L'OPACITE EST CALCULEE, PAS CHOISIE : sur creme, un melange encre/creme doit
descendre a ~137 en sRGB pour atteindre 3:1, soit 246 - 227a = 137, a = 0,48.
Retenu 0,55, qui donne 3,8:1 mesure. A 0,26 — la premiere valeur, prise a
l'oeil — le cerne plafonnait a 2,02:1 et ne faisait pas un bord.

LA GRILLE EST EN 210 ET NON EN 240, ET C'EST UN CALCUL QUI L'IMPOSE. Avec des
pastilles de 240, un nom et une zone sur deux lignes, il faut cy2 >= cy1 + 342
pour que la zone de la rangee 1 ne touche pas la pastille de la rangee 2 —
alors que le bandeau de 748 impose cy2 <= 506 et cy1 >= 222. Le systeme n'a pas
de solution. A 210 et sur UNE seule ligne « nom - zone », il en a une, avec
40 px de marge basse.

L'ORDRE EST CELUI DU CATALOGUE (`rang_catalogue` : 10, 20, 60, 80), pas un
ordre esthetique. M&K, dernier arrive, tombe donc en bas a droite — la ou le
regard finit. Le badge NOUVEAU s'y pose.
"""
import os, importlib.util

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
OR, ROUGE, ENCRE = g.OR, g.ROUGE, g.ENCRE
PAD_H, PAD_V, FILET, DECAL = g.PAD_H, g.PAD_V, g.FILET, g.DECAL

import pub_laplage as PL
_col_stores_puis_logo = PL._col_stores_puis_logo

CREME = '#F6EFE2'
PH    = 748
D_PAST = 210
CERNE = 3                   # cerne encre commun aux quatre
COL_X = (301, 779)          # centres des deux colonnes, dans le padding de 62
ROW_Y = (205, 555)          # centres des deux rangees

# Lu en base le 22/09/2026 : nom et zone_served, ordonnes par rang_catalogue.
MAISONS = [
    ('p-cabane.png',  'La Cabane',          'Ambatoloaka',   False),
    ('p-bidul.png',   'Chez Bidul &amp; Truc', 'Dar es Salam',  False),
    ('p-laplage.png', 'La Plage',           'Hell-Ville',    False),
    ('logo-mk.png',   'Chez M&amp;K',          'Djabala Honko', True),
]


def _pastille(f, nom, zone, neuf, cx, cy):
    d = D_PAST
    x, y = cx - d//2, cy - d//2
    badge = ''
    if neuf:
        # Le badge chevauche la pastille par le bas-droit, tourne de -7 deg
        # comme la pastille promo de la charte. Il ne couvre jamais le nom :
        # il est CONTENU dans la hauteur du disque.
        badge = (f'<div style="position:absolute; left:{cx+d//2-100}px; top:{cy+d//2-44}px; '
                 f'z-index:6; background:{OR}; color:{ENCRE}; font-size:21px; font-weight:900; '
                 f'letter-spacing:2.2px; padding:8px 16px 9px; border-radius:24px; '
                 f'transform:rotate(-7deg); box-shadow:0 8px 20px rgba(0,0,0,0.28), '
                 f'inset 0 0 0 3px rgba(19,19,19,0.92);">NOUVEAU</div>')
    return (f'<img src="{f}" alt="{nom}" style="position:absolute; left:{x}px; top:{y}px; '
            f'width:{d}px; height:{d}px; display:block; border-radius:50%; '
            f'box-shadow:0 0 0 {CERNE}px rgba(19,19,19,0.55), 0 12px 26px rgba(0,0,0,0.20);">'
            + badge +
            f'<div class="nm" style="position:absolute; left:{cx-239}px; top:{cy+d//2+20}px; '
            f'width:478px; text-align:center; font-size:24px; font-weight:800; '
            f'color:{ENCRE}; letter-spacing:-0.2px;">{nom}'
            f'<span style="font-weight:500; color:rgba(19,19,19,0.56);"> &middot; {zone}</span></div>')


# DECAL 92 et non 102 : ici aucune pastille de restaurant ne mord la bande
# rouge, donc rien n'oblige a descendre le bloc — mais le laisser a 18 laissait
# 150 px de rouge vide en bas. 18 + 150/2 = 93, arrondi a 92, recentre le bloc
# dans la bande. h_col suit : 381 + 74 = 455, pour que les deux colonnes se
# ferment toujours sur la meme horizontale.
def pub(titre, secondaire, surtitre, h=1350, red=594, titre_px=64, sec_px=25, h_col=455,
        code='TAXIFOOD50'):
    ph = h - red - FILET
    cases = ''.join(_pastille(f, n, z, neuf, COL_X[i % 2], ROW_Y[i // 2])
                    for i, (f, n, z, neuf) in enumerate(MAISONS))
    return g.HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; background: {CREME}; overflow: hidden;">
    <div style="position:absolute; top:40px; left:0; width:1080px; text-align:center;
         font-size:19px; font-weight:800; letter-spacing:4.2px; text-transform:uppercase;
         color:rgba(19,19,19,0.52);">Les restos qui bossent avec nous</div>
    {cases}
  </div>

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>

  <div style="position: absolute; top: {ph+FILET}px; left: 0; width: 1080px; height: {red}px; box-sizing: border-box; padding: {PAD_V}px {PAD_H}px; display: flex; align-items: flex-start; justify-content: space-between; gap: 34px;">
    <div style="margin-top: 92px; display: flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="taxifood-transparent.png" alt="Taxi Food" style="width: 36px; height: auto; display: block;">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: 3.8px; color: {OR}; text-transform: uppercase;">{surtitre}</span>
      </div>
      <div style="margin-top: 10px; font-size: {titre_px}px; font-weight: 900; line-height: 0.98; color: #FFFFFF; letter-spacing: -1.5px;">{titre}</div>
      <div style="margin-top: 12px; font-size: {sec_px}px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.92);">{secondaire}</div>
      <div style="margin-top: 18px;">{g._promo(1.0)}</div>
      <span style="margin-top: 14px; font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.72);">taxifoodnosybe.distripro207.com</span>
    </div>
    {_col_stores_puis_logo(h_col)}
  </div>
</div>
''' + g.FOOT


# LE COEUR EST JAUNE, ET C'EST MESURE. Les trois coeurs ont ete rendus sur la
# bande rouge puis comptes pixel a pixel : du coeur ROUGE, 4,1 % seulement se
# distinguent du #E8342A de la charte — il disparait dans le fond (1,75:1).
# L'orange n'est guere mieux (1,93:1). Le JAUNE ressort a 58,4 % de sa boite,
# et sa couleur mesuree est #FDC72F : a deux points pres l'or de la charte
# #FFC72C. C'est donc le seul coeur qui se voie, et il tombe juste sur la
# palette maison.
PARTENAIRES = dict(
    surtitre='Nouveau partenaire',
    titre='Chez&nbsp;M&amp;K rejoint<br>Taxi&nbsp;Food&nbsp;<span class="coeur">\U0001F49B</span>',
    secondaire=('Le chinois de Djabala Honko rejoint La&nbsp;Cabane, Chez&nbsp;Bidul&nbsp;&amp;&nbsp;Truc<br>'
                'et La&nbsp;Plage. Quatre restos, une seule appli, un seul livreur.'),
)
