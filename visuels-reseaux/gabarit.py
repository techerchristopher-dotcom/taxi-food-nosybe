# -*- coding: utf-8 -*-
"""Gabarit unique Taxi Food. Toutes les mesures viennent du J1 valide."""
import io

HEAD = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&display=swap">
  <style>
    body { margin: 0; font-family: Archivo, "Helvetica Neue", Helvetica, Arial, sans-serif; }
    a { color: #FFC72C; } a:hover { color: #FF8A1E; }
  </style>
</helmet>
'''
FOOT = '</x-dc>\n</body>\n</html>'

# ---- constantes du gabarit, ne pas modifier sans refaire le J1 ----
ROUGE   = "#E8342A"
OR      = "#FFC72C"
ENCRE   = "#131313"
PHOTO_H = 572
FILET   = 8
RED_H   = 500
PAD_V   = 28
PAD_H   = 62
LOGO_D  = 180
DECAL   = 102          # decalage de la colonne gauche sous la pastille
COL_W   = 190          # QR et badges : meme largeur
COL_H   = 401          # hauteur colonne droite : bas des badges = bas du bloc promo
FONDS = {
 # Le fond studio sombre a ete concu pour les pizzas : une pizza est foncee et
 # texturee, elle se detache. Un tacos, un kebab, un panini sont BEIGES — sur du
 # gris fonce ils virent au terne. Le fond se choisit donc par serie.
 'studio': ("radial-gradient(ellipse 55% 68% at 50% 34%, #909090 0%, #6A6A6A 45%, "
            "#3A3A3A 72%, #0A0A0A 96%)"),
 'rouge':  ("radial-gradient(ellipse 62% 74% at 50% 30%, #F5493C 0%, #E8342A 46%, "
            "#B62119 100%)"),
 'creme':  ("radial-gradient(ellipse 60% 70% at 50% 30%, #FFFDFB 0%, #F4EDE4 44%, "
            "#DCCFBF 76%, #C6B4A0 100%)"),
 'ambre':  ("radial-gradient(ellipse 62% 74% at 50% 30%, #FFEFD4 0%, #F6D296 48%, "
            "#D9A254 100%)"),
}
FOND_STUDIO = ("radial-gradient(ellipse 55% 68% at 50% 34%, #909090 0%, #6A6A6A 45%, "
               "#3A3A3A 72%, #0A0A0A 96%)")

# ---- variante debord : placement de serie, identique pour tous les plats -----
# Tous les plats sortent a la MEME taille et a la MEME place. C'est ce qui fait
# qu'une serie se reconnait en defilant, et ca supprime le reglage au cas par cas.
# Les bornes viennent de deux inegalites de cercles (pastille a gauche, QR a
# droite) : au-dela de 790 px de diametre, aucune position ne laisse 20 px des
# deux cotes. 760 garde de la marge.
DEBORD_W   = 760      # largeur du plat, quelle que soit la photo source
DEBORD_CX  = 572      # centre horizontal : equilibre l'air pastille / l'air QR
DEBORD_BAS = 685      # bas du plat : 105 px de debord sur le rouge

# Une serie = une BOITE, pas une largeur. Imposer la largeur marche tant que les
# plats ont la meme forme (huit pizzas rondes), et casse des qu'ils ne l'ont plus :
# un panini de 1,95:1 sort du cadre, un milkshake de 0,50:1 fait 1 500 px de haut.
# Le plat s'inscrit donc dans une boite, cale en bas sur la ligne de fuite et
# centre. Pour une pizza carree la boite redonne exactement 760 px : la serie
# pizza est inchangee (verifie, ecart 0 px sur les huit).
# haut=1000 ne mord jamais sur une pizza : c'est la largeur qui commande, comme
# avant. Le mettre a 760 rabotait jusqu'a 12 px les pizzas un peu plus hautes que
# larges — mesure, donc corrige.
# Une pizza ronde de 760 px occupe deja le coin haut-gauche : a 206 px la pastille
# la chevauche de 8 a 20 px. Taille et position cherchees par balayage, pas
# estimees. Re-resolu sur les TREIZE pizzas (les cinq dernieres sont un peu plus
# hautes que larges, elles montent donc plus haut dans le coin) : 184 px en
# (10, 10), air minimale 21,1 px, la Vegetarienne etant la plus serree.
BADGE_PIZZA = dict(d=184, x=10, y=10)

SERIE_PIZZA  = dict(larg=760, haut=1000, cx=DEBORD_CX, bas=DEBORD_BAS, fond='studio',
                    badge='remise', badge_geo=BADGE_PIZZA)
# La Cabane : des plats HORIZONTAUX (1,6 a 1,95:1). Le QR occupe tout ce qui est
# a droite de x=828 sous y=608, la pastille tout ce qui est a gauche de x=242
# entre y=478 et 658. Une pizza ronde se faufile entre les deux parce qu'elle est
# etroite en bas ; un panini, non. C'est la HAUTEUR qui commande donc ici, et la
# largeur ne mord jamais. Cherche par balayage, pas estime.
SERIE_CABANE = dict(larg=820, haut=520, cx=640, bas=600, fond='creme', badge='remise')


def debord_boite(bbox, serie=None):
    """Ou poser le plat detoure. Aucun reglage par plat : la serie impose la place."""
    s = serie or SERIE_PIZZA
    w = bbox[2] - bbox[0]; h = bbox[3] - bbox[1]
    k = min(s['larg'] / w, s['haut'] / h)
    return {'left': round(s['cx'] - w*k/2, 1),
            'top': round(s['bas'] - h*k, 1),
            'width': round(w*k, 1)}


def debord_serie(bbox):
    """Compatibilite : la serie pizza."""
    return debord_boite(bbox, SERIE_PIZZA)


def debord(src_w, src_h, bbox, cadrage=46, ph=PHOTO_H, dx=0, dy=0):
    """Ou poser le plat detoure pour qu'il se superpose PILE sur la photo du fond.
    Meme cadrage que object-fit: cover / object-position: center {cadrage}%."""
    ech = max(1080/src_w, ph/src_h)
    ox = (1080 - src_w*ech)/2
    oy = (ph - src_h*ech) * (cadrage/100)
    x0, y0, x1, y1 = bbox
    return {'left': round(ox + x0*ech + dx, 1),
            'top':  round(oy + y0*ech + dy, 1),
            'width': round((x1-x0)*ech, 1)}


# ---- pastille code promo, dans la zone photo -------------------------------
# Mesure sur les huit plats de La Cabane : le plat ne descend jamais sous
# x = 238 dans la bande y 30-300, et il ne reste que 51 px a droite. La pastille
# va donc en HAUT A GAUCHE, et sa taille est bornee par cette mesure.
BADGE_D = 206          # La Cabane : plats horizontaux, 61 a 137 px d'air
BADGE_X = 26
BADGE_Y = 40


def _badge_code(variante='code', code='TAXIFOOD50', d=None, x=None, y=None):
    """La pastille qui met le code en avant. Deux variantes :
       'code'  -> le code est le heros, la remise est la mention
       'remise'-> -50 % est le heros, le code est la mention
    """
    if not variante:
        return ''
    d = d or BADGE_D; x = BADGE_X if x is None else x; y = BADGE_Y if y is None else y
    f = lambda v: round(v * d / 206)
    if variante == 'code':
        corps = (f'<div style="font-size: {f(13)}px; font-weight: 800; letter-spacing: {f(1.6)}px; '
                 f'text-transform: uppercase; opacity: 0.72;">Code promo</div>'
                 f'<div style="font-size: {f(25)}px; font-weight: 900; letter-spacing: {f(-0.4)}px; '
                 f'line-height: 1; margin: {f(5)}px 0 {f(6)}px;">{code}</div>'
                 f'<div style="background: {ENCRE}; color: {OR}; font-size: {f(14)}px; font-weight: 900; '
                 f'padding: {f(4)}px {f(11)}px {f(5)}px; border-radius: {f(20)}px; line-height: 1;">'
                 f'&minus;50 % livraison</div>')
    else:
        # Le code reste le geste a faire : sa pilule est dimensionnee pour rester
        # lisible sous le -50 %, pas reduite a une mention.
        corps = (f'<div style="font-size: {f(12)}px; font-weight: 800; letter-spacing: {f(1.5)}px; '
                 f'text-transform: uppercase; opacity: 0.72;">1re commande</div>'
                 f'<div style="font-size: {f(45)}px; font-weight: 900; letter-spacing: {f(-1.6)}px; '
                 f'line-height: 1; margin: {f(1)}px 0 0;">&minus;50 %</div>'
                 f'<div style="font-size: {f(11)}px; font-weight: 800; letter-spacing: {f(0.9)}px; '
                 f'text-transform: uppercase; margin-bottom: {f(7)}px;">sur la livraison</div>'
                 f'<div style="background: {ENCRE}; color: {OR}; font-size: {f(17)}px; font-weight: 900; '
                 f'letter-spacing: {f(0.2)}px; padding: {f(5)}px {f(12)}px {f(6)}px; '
                 f'border-radius: {f(20)}px; line-height: 1;">{code}</div>')
    return f'''  <div style="position: absolute; top: {y}px; left: {x}px; z-index: 12;
       width: {d}px; height: {d}px; border-radius: 50%; background: {OR};
       box-shadow: 0 {f(12)}px {f(30)}px rgba(0,0,0,0.30), inset 0 0 0 {f(4)}px rgba(19,19,19,0.92);
       transform: rotate(-7deg); display: flex; flex-direction: column;
       align-items: center; justify-content: center; text-align: center;
       color: {ENCRE}; font-family: Archivo, sans-serif; box-sizing: border-box;
       padding: {f(16)}px;">{corps}</div>
'''


def _col(k=1.0, h_col=None):
    """Colonne droite. h_col force la hauteur pour que le bas du badge Google Play
    tombe exactement sur le bas du bloc promo (regle de charte)."""
    f=lambda v: round(v*k); W=f(COL_W)
    haut = f'height: {round(h_col*k)}px; justify-content: space-between;' if h_col else 'gap: {}px;'.format(f(14))
    return f'''<div style="display: flex; flex-direction: column; align-items: center; {haut} width: {W}px; flex: 0 0 auto;">
      <div style="display: flex; flex-direction: column; align-items: center; gap: {f(14)}px;">
        <div style="width: {W}px; height: {W}px; background: #FFFFFF; border-radius: {f(15)}px; box-sizing: border-box; padding: {f(13)}px; box-shadow: 0 10px 26px rgba(0,0,0,0.26);">
          <img src="qr.png" alt="Scannez pour commander" style="width: 100%; height: 100%; display: block;">
        </div>
        <span style="font-size: {f(19)}px; font-weight: 800; color: #FFFFFF; letter-spacing: 0.2px;">Scannez. On livre.</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: {f(11)}px; width: {W}px;">
        <img src="appstore.png" alt="Télécharger dans l'App Store" style="width: {W}px; height: auto; display: block;">
        <img src="googleplay.png" alt="Disponible sur Google Play" style="width: {W}px; height: auto; display: block;">
      </div>
    </div>'''

def _promo(k=1.0):
    f=lambda v: round(v*k)
    return f'''<div style="display: inline-flex; flex-direction: column; background: {ENCRE}; border-radius: {f(12)}px; padding: {f(13)}px {f(23)}px {f(14)}px;">
        <span style="font-size: {f(22)}px; font-weight: 800; color: #FFFFFF;">1re commande : −50 % sur la livraison</span>
        <span style="margin-top: {f(5)}px; font-size: {f(20)}px; font-weight: 600; color: rgba(255,255,255,0.9);">Tape le code <span style="font-weight: 900; color: {OR};">TAXIFOOD50</span></span>
        <span style="margin-top: 3px; font-size: {f(16)}px; font-weight: 500; color: rgba(255,255,255,0.6);">au moment de payer</span>
      </div>'''

def _bandeau(photo, alt, ph, cadrage, degrade_h, fond=None):
    """Le haut du visuel. Soit une photo pleine, soit le fond studio nu quand
    le plat est detoure et posé par-dessus (variante debord)."""
    if photo is None:
        return (f'<div style="position: absolute; top: 0; left: 0; width: 1080px; '
                f'height: {ph}px; background: {fond or FOND_STUDIO};"></div>')
    return f'''<div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; overflow: hidden; background: {ENCRE};">
    <img src="{photo}" alt="{alt}" style="width: 1080px; height: {ph}px; object-fit: cover; object-position: center {cadrage}%; display: block;">
    <div style="position: absolute; left: 0; bottom: 0; width: 1080px; height: {degrade_h}px; background: linear-gradient(to bottom, rgba(19,19,19,0), rgba(19,19,19,0.5) 60%, rgba(19,19,19,0.88));"></div>
  </div>'''


def _debord(plat):
    """Le plat detoure, pose PAR-DESSUS le filet et le rouge. z-index 5 :
    au-dessus de la photo et du rouge, en dessous de la pastille du restaurant."""
    if not plat:
        return ''
    return (f'<img src="{plat["img"]}" alt="" style="position: absolute; z-index: 5; '
            f'left: {plat["left"]}px; top: {plat["top"]}px; width: {plat["width"]}px; '
            f'height: auto; display: block; '
            f'filter: drop-shadow(0 18px 34px rgba(0,0,0,0.55));">')


CODE_PILULE = ('<span style="background: {or_}; color: {encre}; font-weight: 900; '
               'padding: 5px 14px 6px; border-radius: 9px; letter-spacing: 0.3px;">{code}</span>')

def code_promo(code='TAXIFOOD50'):
    return CODE_PILULE.format(or_=OR, encre=ENCRE, code=code)

PIN = ('<svg width="42" height="42" viewBox="0 0 24 24" style="display:block;flex:0 0 auto;">'
       '<path d="M12 2.2c-3.9 0-7 3.1-7 7 0 5.3 7 12.8 7 12.8s7-7.5 7-12.8c0-3.9-3.1-7-7-7z" '
       f'fill="{OR}"/><circle cx="12" cy="9.1" r="2.7" fill="{ROUGE}"/></svg>')

# ---- mode d'emploi : mise en page derivee, memes regles de bas de page ------
ME_GAPS  = (40, 52, 48, 36, 42, 14)   # entre les six blocs de la colonne gauche
ME_LARG  = 1080 - PAD_H*2 - COL_W - 34

def _etape(n, texte, pin=False):
    icone = PIN if pin else ''
    return (f'<div style="display: flex; align-items: center; gap: 22px;">'
            f'<div style="flex: 0 0 auto; width: 62px; height: 62px; border-radius: 50%; background: {OR}; '
            f'display: flex; align-items: center; justify-content: center;">'
            f'<span style="font-size: 33px; font-weight: 900; color: {ENCRE};">{n}</span></div>'
            f'<span style="display: flex; align-items: center; gap: 13px; font-size: 31px; '
            f'font-weight: 500; color: #FFFFFF;">{texte}{icone}</span></div>')

def _fait(gros, petit):
    return (f'<div style="display: flex; flex-direction: column;">'
            f'<span style="font-size: 33px; font-weight: 900; color: {OR}; letter-spacing: -0.6px;">{gros}</span>'
            f'<span style="margin-top: 3px; font-size: 19px; font-weight: 500; color: rgba(255,255,255,0.88); '
            f'line-height: 1.25;">{petit}</span></div>')

def _rappel(texte):
    if not texte:
        return ''
    return (f'<div style="margin-bottom: 13px; display: flex; align-items: center; gap: 11px; '
            f'font-size: 25px; font-weight: 700; color: {OR};">'
            f'<svg width="26" height="26" viewBox="0 0 24 24" style="display:block;flex:0 0 auto;">'
            f'<path d="M12 3v14m0 0l-5.5-5.5M12 17l5.5-5.5" stroke="{OR}" stroke-width="2.6" '
            f'stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>'
            f'<span>{texte}</span></div>')


def mode_emploi(resto, sous_titre, logo, etapes, faits, bas_promo=1009,
                rappel=None, titre="Commander,<br>c'est quatre gestes."):
    """Le « comment ca marche ». Colonne droite identique aux visuels produit :
    meme QR, memes badges, meme regle — bas des badges = bas du bloc promo."""
    g = ME_GAPS
    return HEAD + f'''<div style="position: relative; width: 1080px; height: 1080px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: {PAD_V + 34}px; right: {PAD_H}px; display: flex; align-items: center; gap: 12px;">
    <img src="taxifood.png" alt="Taxi Food" style="width: 44px; height: auto; display: block; border-radius: 10px;">
    <span style="font-size: 24px; font-weight: 900; color: #FFFFFF; letter-spacing: 2.1px;">TAXI FOOD</span>
  </div>

  <div style="position: absolute; left: {PAD_H}px; top: {PAD_H}px; width: {ME_LARG}px; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <div style="width: 84px; height: 84px; border-radius: 50%; background: #FFFFFF; overflow: hidden; flex: 0 0 auto;">
        <img src="{logo}" alt="Logo {resto}" style="width: 84px; height: 84px; object-fit: cover; display: block;">
      </div>
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 20px; font-weight: 800; letter-spacing: 3.4px; color: {OR}; text-transform: uppercase;">{resto}</span>
        <span style="margin-top: 4px; font-size: 19px; font-weight: 500; color: rgba(255,255,255,0.82);">{sous_titre}</span>
      </div>
    </div>

    <div style="margin-top: {g[0]}px; font-size: 72px; font-weight: 900; line-height: 0.96; color: #FFFFFF; letter-spacing: -1.8px;">{titre}</div>

    <div style="margin-top: {g[1]}px; display: flex; flex-direction: column; gap: 24px;">
      {''.join(_etape(i+1, t, p) for i, (t, p) in enumerate(etapes))}
    </div>

    <div style="margin-top: {g[2]}px; width: {ME_LARG}px; height: 2px; background: rgba(255,255,255,0.28);"></div>

    <div style="margin-top: {g[3]}px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; width: {ME_LARG}px;">
      {''.join(_fait(a, b) for a, b in faits)}
    </div>

    <div style="margin-top: {g[4]}px;">{_rappel(rappel)}{_promo()}</div>
    <span style="margin-top: {g[5]}px; font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.72);">taxifoodnosybe.distripro207.com</span>
  </div>

  <div style="position: absolute; right: {PAD_H}px; top: {bas_promo - COL_H}px;">
    {_col(1.0, COL_H)}
  </div>
</div>
''' + FOOT


def visuel(photo, alt, titre, secondaire, prix, ligne_lieu, logo, titre_px=60,
           cadrage=46, h=1080, h_col=COL_H, plat=None, fond=None, badge=None, code='TAXIFOOD50', d=None, x=None, y=None):
    """Le gabarit. Seuls les textes, la photo et le logo changent."""
    k = 1.0
    f = lambda v: round(v*k)
    red = f(RED_H); ph = h - red - FILET; logo_d = f(LOGO_D)
    return HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  {_bandeau(photo, alt, ph, cadrage, f(180), fond)}

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>
{_debord(plat)}
{_badge_code(badge, code, d, x, y)}

  <div style="position: absolute; top: {ph - round(logo_d*0.52)}px; left: {PAD_H}px; z-index: 10; width: {logo_d}px; height: {logo_d}px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 14px 36px rgba(0,0,0,0.45); overflow: hidden;">
    <img src="{logo}" alt="Logo" style="width: {logo_d}px; height: {logo_d}px; object-fit: cover; display: block;">
  </div>

  <div style="position: absolute; top: {ph+FILET}px; left: 0; width: 1080px; height: {red}px; box-sizing: border-box; padding: {f(PAD_V)}px {PAD_H}px; display: flex; align-items: flex-start; justify-content: space-between; gap: {f(34)}px;">
    <div style="margin-top: {f(DECAL)}px; display: flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto;">
      <div style="display: flex; align-items: center; gap: {f(12)}px;">
        <img src="taxifood.png" alt="Taxi Food" style="width: {f(36)}px; height: auto; display: block; border-radius: {f(8)}px;">
        <span style="font-size: {f(20)}px; font-weight: 700; letter-spacing: 3.8px; color: {OR}; text-transform: uppercase;">Nouveau sur Taxi&nbsp;Food</span>
      </div>
      <div style="margin-top: {f(10)}px; font-size: {f(titre_px)}px; font-weight: 900; line-height: 0.98; color: #FFFFFF; letter-spacing: -1.5px;">{titre}</div>
      <div style="margin-top: {f(12)}px; font-size: {f(26)}px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.92);">{secondaire} · <span style="font-weight: 800; color: {OR};">{prix}</span></div>
      <div style="margin-top: {f(10)}px; font-size: {f(20)}px; font-weight: 500; color: rgba(255,255,255,0.88);">{ligne_lieu}</div>
      <div style="margin-top: {f(18)}px;">{_promo(k)}</div>
      <span style="margin-top: {f(14)}px; font-size: {f(17)}px; font-weight: 600; color: rgba(255,255,255,0.72);">taxifoodnosybe.distripro207.com</span>
    </div>
    {_col(k, h_col)}
  </div>
</div>
''' + FOOT


# ============================================================================
# SERIE_TIKTOK — le vertical 1080 x 1920. Troisieme serie, meme logique que les
# deux autres : une BOITE, pas une largeur.
#
# Ce qui la distingue, et pourquoi ce n'est pas un simple recadrage du carre :
#
# 1. L'interface de TikTok recouvre les bords. Zone reellement visible :
#    x 86..940, y 200..1586. Le bas, 334 px, porte la legende et le pseudo.
#    L'image deborde jusqu'aux bords, LE CONTENU JAMAIS.
# 2. Le QR est retire. Le spectateur tient deja le telephone : il ne peut pas
#    le scanner avec lui-meme. Sur le carre il sert (Facebook se lit aussi sur
#    un ordinateur, et le visuel sert de flyer) ; ici c'est un carre blanc qui
#    mange la place dont le prix a besoin.
# 3. La boite du plat est contrainte par le haut : sommet >= 200. Avec bas=900
#    la hauteur maximale est 700, donc la largeur aussi (une pizza est ronde).
# ============================================================================
TT_W, TT_H   = 1080, 1920
TT_SAFE      = dict(x0=86, x1=940, y0=200, y1=1586)
TT_SCENE_H   = 880            # bas de la scene
TT_PAD_L     = 86             # = bord gauche de la zone sure
TT_PAD_R     = 140            # colonne de boutons TikTok
TT_LOGO_D    = 190
# La rotation de -7 deg elargit la boite du badge : d*(cos7+sin7), soit ~5,7 % de d
# de debord de chaque cote. Mesure sur le rendu, pas deduit apres coup.
# d=310 : le badge est le geste commercial, il se lit avant le texte.
# y=925 le garde sous le plat (air mesuree) et au-dessus du bloc promo (1330).
TT_BADGE     = dict(d=310, x=TT_W - 140 - 310 - 18, y=925)

# haut=700 et pas 760 : l'en-tete de la serie le disait deja — « avec bas=900 la
# hauteur maximale est 700 ». Le code disait 760, et la 4 Fromages, un peu plus
# haute que large, posait son sommet a y=190, dix pixels sous la barre de
# recherche de TikTok. Le commentaire avait raison, pas le code.
SERIE_TIKTOK = dict(larg=700, haut=700, cx=540, bas=900, fond='studio',
                    badge='remise', badge_geo=TT_BADGE)


def _promo_tiktok(k=1.0):
    """Le bloc noir, version video. Il ne REPETE plus l'offre, il dit le geste.

    Sur le carre, badge et bloc disent tous deux « 1re commande, -50 %, code » :
    l'oeil prend tout d'un coup, la redondance ne coute rien. En video elle
    coute l'attention au moment precis ou il faut retenir une seule chose. Le
    badge dit QUOI, le bloc dit COMMENT. On ne touche pas a _promo() : les
    treize visuels carres deja publies ne bougent pas.
    """
    f = lambda v: round(v*k)
    return (f'<div style="display: inline-flex; flex-direction: column; background: {ENCRE}; '
            f'border-radius: {f(12)}px; padding: {f(14)}px {f(24)}px {f(15)}px;">'
            f'<span style="font-size: {f(24)}px; font-weight: 800; color: #FFFFFF;">'
            f'Tape le code <span style="font-weight: 900; color: {OR};">TAXIFOOD50</span></span>'
            f'<span style="margin-top: {f(4)}px; font-size: {f(18)}px; font-weight: 500; '
            f'color: rgba(255,255,255,0.62);">au moment de payer</span>'
            f'</div>')


def _stores_tiktok(k=1.0):
    """Les deux badges stores, cote a cote. Pas de QR : voir l'en-tete de la serie."""
    f = lambda v: round(v*k)
    return (f'<div style="display: flex; gap: {f(14)}px; align-items: center;">'
            f'<img src="appstore.png" alt="App Store" style="height: {f(58)}px; width: auto; display: block;">'
            f'<img src="googleplay.png" alt="Google Play" style="height: {f(58)}px; width: auto; display: block;">'
            f'</div>')


def visuel_tiktok(titre, secondaire, prix, ligne_lieu, logo, plat=None,
                  fond=None, badge='remise', code='TAXIFOOD50', titre_px=84,
                  eyebrow='Nouveau sur Taxi&nbsp;Food'):
    """Le visuel produit en 9:16. Memes tokens, memes regles, autre boite."""
    ph  = TT_SCENE_H
    red = TT_H - ph - FILET
    b   = TT_BADGE
    return HEAD + f'''<div style="position: relative; width: {TT_W}px; height: {TT_H}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: {TT_W}px; height: {ph}px; background: {fond or FONDS['studio']};"></div>

  <div style="position: absolute; top: {ph}px; left: 0; width: {TT_W}px; height: {FILET}px; background: {OR};"></div>
{_debord(plat)}
{_badge_code(badge, code, b['d'], b['x'], b['y'])}

  <div style="position: absolute; top: {ph - round(TT_LOGO_D*0.52)}px; left: {TT_PAD_L}px; z-index: 10;
       width: {TT_LOGO_D}px; height: {TT_LOGO_D}px; border-radius: 50%; background: #FFFFFF;
       box-shadow: 0 14px 36px rgba(0,0,0,0.45); overflow: hidden;">
    <img src="{logo}" alt="Logo" style="width: {TT_LOGO_D}px; height: {TT_LOGO_D}px; object-fit: cover; display: block;">
  </div>

  <!-- UNE SEULE colonne qui coule. Le bloc promo etait positionne a part, en
       absolu : des que la composition passait a deux lignes, la ligne du
       restaurant disparaissait dessous. Deux blocs poses independamment
       finissent toujours par se rencontrer. -->
  <div style="position: absolute; top: {ph+FILET+126}px; left: {TT_PAD_L}px; width: {TT_BADGE['x'] - TT_PAD_L - 30}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 46px; height: auto; display: block; border-radius: 10px;">
      <span style="font-size: 24px; font-weight: 700; letter-spacing: 3.2px; color: {OR}; text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
    </div>
    <div id="tt-titre" style="margin-top: 14px; font-size: {titre_px}px; font-weight: 900; line-height: 0.97; color: #FFFFFF; letter-spacing: -2.2px; white-space: nowrap;">{titre}</div>
    <div style="margin-top: 16px; font-size: 30px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.92);">{secondaire}</div>
    <div style="margin-top: 8px; font-size: 46px; font-weight: 900; color: {OR}; letter-spacing: -0.8px;">{prix}</div>
    <div style="margin-top: 12px; font-size: 26px; font-weight: 500; color: rgba(255,255,255,0.88);">{ligne_lieu}</div>
    <div style="margin-top: 28px; width: {TT_SAFE['x1'] - TT_PAD_L}px;">{_promo_tiktok(1.15)}</div>
    <!-- L'URL n'est pas une mention legale : sur TikTok aucun lien n'est cliquable,
         c'est la SEULE porte d'entree. On la trouve, on arrive sur le site, on
         telecharge de la. Elle se lit donc en blanc, pas en gris a 72 %. -->
    <div style="margin-top: 16px; display: flex; align-items: center; gap: 24px;">
      {_stores_tiktok(0.85)}
      <span style="font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.3px; white-space: nowrap;">taxifoodnosybe.distripro207.com</span>
    </div>
  </div>

  <!-- Le titre s'ajuste a la colonne, dans la PAGE. « 4 Fromages » a 84 px
       passait a deux lignes : coupe en « 4 / Fromages », et tout le bloc
       descendait de 82 px, jusqu'a 1602 — seize pixels sous la legende TikTok.
       La regle vit ici et pas dans les scripts : la carte et les douze calques
       sortent du meme html, ils ne peuvent donc pas tomber sur deux tailles
       differentes. Une regle appliquee a deux endroits finit par diverger. -->
  <script>(function () {{
    var e = document.getElementById('tt-titre');
    if (!e) return;
    var px = {titre_px}, mini = 54;
    while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
      px -= 2;
      e.style.fontSize = px + 'px';
      e.style.letterSpacing = (-2.2 * px / {titre_px}) + 'px';
    }}
  }})();</script>
''' + FOOT


# ============================================================================
# SERIE_TIKTOK_DECOR — la meme carte, posee sur un DECOR photographique.
#
# Sur la carte studio, la bande rouge occupe le bas : le plat est detoure sur un
# fond fabrique, il n'y a rien a montrer sous y=880. Sur un decor, si : la pizza
# est dans son carton, le carton sur le plan de travail, le four derriere. Poser
# la bande en bas masque le produit. On ne vend pas des fours ni des cartons,
# mais on ne vend pas non plus du rouge : la pizza doit rester entiere.
#
# La bande passe donc EN HAUT, et devient TRANSLUCIDE. Trois mesures, pas trois
# impressions, prises sur la Reine validee (reine-carton-four-2) :
#
#   1. le disque de la pizza occupe y 945..1600. Au-dessus, y 0..930, le decor
#      est flou : nettete 4 a 32 contre 570 sur la pizza. Il n'y a rien a y
#      perdre, c'est deja du bokeh.
#   2. rouge OPAQUE, blanc dessus (les 13 visuels carres publies) : 4,24:1.
#   3. rouge 78 % + voile noir 15 % sur ce decor : mediane 5,0:1, p95 4,5:1.
#
# Le bandeau translucide se lit donc MIEUX que le rouge plein — le decor qui
# transparait est plus sombre que le rouge, il ne l'eclaircit pas, il le fonce.
# Le voile noir n'est pas cosmetique : sans lui les flammes font tomber le pire
# pixel a 3,4:1, avec lui il remonte a 3,7:1 et la p95 passe la barre des 4,5.
#
# Le filet or reste FRANC et OPAQUE : c'est la signature de la serie, et c'est
# lui qui dit ou finit le message et ou commence le produit.
# ============================================================================
TT_DECOR_BAS   = 878          # bas du bandeau ; la croute la plus haute est a 945
TT_DECOR_ROUGE = 0.78         # opacite du rouge
TT_DECOR_VOILE = 0.15         # voile noir dessous, contre les flammes
TT_DECOR_COL_Y = 200          # sommet de la colonne = limite haute de la zone sure
TT_DECOR_BADGE = dict(d=310, x=TT_W - 140 - 310 - 18, y=228)


def _rgba(hexa, a):
    h = hexa.lstrip('#')
    return f'rgba({int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)}, {a})'


def visuel_tiktok_decor(titre, secondaire, prix, ligne_lieu, logo, decor,
                        produit_haut=945, badge='remise', code='TAXIFOOD50',
                        titre_px=84, eyebrow='Nouveau sur Taxi&nbsp;Food'):
    """La carte 9:16 posee sur une photo de decor. Memes tokens, meme colonne,
    bandeau en haut et translucide."""
    ph = TT_DECOR_BAS
    b  = TT_DECOR_BADGE
    chevauche = round(TT_LOGO_D*0.52)
    return HEAD + f'''<div style="position: relative; width: {TT_W}px; height: {TT_H}px; background: #000000; overflow: hidden;">

  <img src="{decor}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {TT_W}px; height: {TT_H}px; object-fit: cover; display: block;">

  <!-- Le bandeau : voile noir dessous, rouge dessus. Deux couches empilees dans
       une seule propriete, pour que l'ordre soit lisible et non reconstitue. -->
  <div id="tt-bande" style="position: absolute; z-index: 2; left: 0; top: 0; width: {TT_W}px; height: {ph}px;
       background: linear-gradient({_rgba(ROUGE, TT_DECOR_ROUGE)}, {_rgba(ROUGE, TT_DECOR_ROUGE)}),
                   linear-gradient(rgba(0,0,0,{TT_DECOR_VOILE}), rgba(0,0,0,{TT_DECOR_VOILE}));"></div>

  <div id="tt-filet" style="position: absolute; z-index: 3; top: {ph}px; left: 0; width: {TT_W}px; height: {FILET}px; background: {OR};"></div>

  <div style="position: relative; z-index: 4;">
{_badge_code(badge, code, b['d'], b['x'], b['y'])}
  </div>

  <div id="tt-pastille" style="position: absolute; z-index: 6; top: {ph - round(TT_LOGO_D*0.52)}px; left: {TT_PAD_L}px;
       width: {TT_LOGO_D}px; height: {TT_LOGO_D}px; border-radius: 50%; background: #FFFFFF;
       box-shadow: 0 14px 36px rgba(0,0,0,0.45); overflow: hidden;">
    <img src="{logo}" alt="Logo" style="width: {TT_LOGO_D}px; height: {TT_LOGO_D}px; object-fit: cover; display: block;">
  </div>

  <div id="tt-col" style="position: absolute; z-index: 5; top: {TT_DECOR_COL_Y}px; left: {TT_PAD_L}px; width: {b['x'] - TT_PAD_L - 30}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 46px; height: auto; display: block; border-radius: 10px;">
      <span style="font-size: 24px; font-weight: 700; letter-spacing: 3.2px; color: {OR}; text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
    </div>
    <div id="tt-titre" style="margin-top: 12px; font-size: {titre_px}px; font-weight: 900; line-height: 0.97; color: #FFFFFF; letter-spacing: -2.2px; white-space: nowrap;">{titre}</div>
    <div style="margin-top: 14px; font-size: 30px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.94);">{secondaire}</div>
    <div style="margin-top: 6px; font-size: 46px; font-weight: 900; color: {OR}; letter-spacing: -0.8px;">{prix}</div>
    <div id="tt-lieu" style="margin-top: 10px; font-size: 26px; font-weight: 500; color: rgba(255,255,255,0.90); white-space: nowrap;">{ligne_lieu}</div>
    <div style="margin-top: 22px; width: {TT_SAFE['x1'] - TT_PAD_L}px;">{_promo_tiktok(1.15)}</div>
    <div style="margin-top: 14px; display: flex; align-items: center; gap: 24px;">
      {_stores_tiktok(0.85)}
      <span style="font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.3px; white-space: nowrap;">taxifoodnosybe.distripro207.com</span>
    </div>
  </div>

  <script>(function () {{
    // Deux lignes peuvent deborder la colonne, pas une seule. « Chez Bidul &
    // Truc · au feu de bois · le soir, 7 j/7 » fait 50 signes : a 26 px il
    // passait a la ligne et poussait tout le bloc de 33 px vers le bas.
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1;
        e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    tenir('tt-titre', {titre_px}, 54, -2.2);
    tenir('tt-lieu', 26, 19, 0);

    // Le bandeau ne se DECIDE pas, il se DEDUIT. Sa hauteur etait fixee a 878 :
    // la colonne finissait a 725 et laissait 153 px de rouge vide, et un plat
    // au titre plus long l'aurait au contraire fait deborder. On mesure la
    // colonne une fois le texte ajuste, et on cale la bande dessus.
    //
    // Deux butees :
    //   - la pastille du restaurant est a cheval sur le filet et deborde de
    //     {chevauche} px vers le haut : le bandeau doit la loger sous la colonne.
    //   - le filet ne doit jamais atteindre le produit. Sur ce decor la croute
    //     la plus haute est a {produit_haut} : on s'arrete 40 px avant.
    var col = document.getElementById('tt-col');
    var bas = col.getBoundingClientRect().bottom;
    var ph  = Math.round(bas + {chevauche} + 26);
    ph = Math.max(ph, 560);
    ph = Math.min(ph, {produit_haut} - 40);
    document.getElementById('tt-bande').style.height = ph + 'px';
    document.getElementById('tt-filet').style.top = ph + 'px';
    document.getElementById('tt-pastille').style.top = (ph - {chevauche}) + 'px';
  }})();</script>
''' + FOOT


# ============================================================================
# SERIE_CARRE_DECOR — la meme carte decor, en 1080 x 1080 pour Facebook.
#
# Ce n'est pas le vertical recadre : le carre est PLUS SERRE, et c'est mesure.
# Sur reine-carton-four-carre, la pizza commence a y=522 — il reste 490 px de
# bandeau, contre 786 en 9:16. La colonne du vertical en demande 461 a elle
# seule, plus 99 pour la pastille a cheval sur le filet : 560, ca ne rentre pas.
#
# Trois consequences, toutes tirees de cette contrainte :
#
#   1. La pastille du restaurant ne chevauche plus le filet, elle passe dans
#      l'EN-TETE, a gauche de « Nouveau sur Taxi Food ». Elle y gagne d'ailleurs :
#      un disque a cheval sur une photo de carton se lit comme un autocollant
#      colle dessus, ce que le fond fabrique du carre studio ne produisait pas.
#   2. Le QR disparait, comme sur le vertical. Sur les treize carres studio il
#      se justifie — le visuel sert de flyer et Facebook se lit aussi sur un
#      ordinateur. Ici il faudrait 200 px de blanc plein milieu d'une photo :
#      il mange la place dont le prix a besoin et troue le decor. L'URL en
#      toutes lettres fait le meme travail sans percer l'image.
#   3. Les stores et l'URL passent a DROITE, sous le badge, pour raccourcir la
#      colonne de gauche d'une ligne entiere.
#
# Le reste ne change pas : rouge 78 %, voile noir 15 %, filet or franc, hauteur
# du bandeau deduite du contenu dans la page.
# ============================================================================
CA_W = CA_H    = 1080
CA_PAD         = 62
CA_COL_Y       = 40
CA_LOGO_D      = 108
CA_BADGE       = dict(d=250, x=1080 - 62 - 250, y=40)
CA_TITRE_PX    = 78
CA_DROITE_X    = 600          # l'URL fait ~300 px : 260 sous le badge ne suffisaient pas


def visuel_carre_decor(titre, secondaire, prix, ligne_lieu, logo, decor,
                       produit_haut=522, badge='remise', code='TAXIFOOD50',
                       titre_px=CA_TITRE_PX, eyebrow='Nouveau sur Taxi&nbsp;Food'):
    """La carte carree posee sur une photo de decor. 1080 x 1080, Facebook."""
    b = CA_BADGE
    return HEAD + f'''<div style="position: relative; width: {CA_W}px; height: {CA_H}px; background: #000000; overflow: hidden;">

  <img src="{decor}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {CA_W}px; height: {CA_H}px; object-fit: cover; display: block;">

  <div id="ca-bande" style="position: absolute; z-index: 2; left: 0; top: 0; width: {CA_W}px; height: 490px;
       background: linear-gradient({_rgba(ROUGE, TT_DECOR_ROUGE)}, {_rgba(ROUGE, TT_DECOR_ROUGE)}),
                   linear-gradient(rgba(0,0,0,{TT_DECOR_VOILE}), rgba(0,0,0,{TT_DECOR_VOILE}));"></div>

  <div id="ca-filet" style="position: absolute; z-index: 3; top: 490px; left: 0; width: {CA_W}px; height: {FILET}px; background: {OR};"></div>

  <div style="position: relative; z-index: 4;">
{_badge_code(badge, code, b['d'], b['x'], b['y'])}
  </div>

  <!-- colonne de droite : les stores et l'URL, sous le badge -->
  <div id="ca-droite" style="position: absolute; z-index: 5; top: {b['y'] + b['d'] + 34}px; left: {CA_DROITE_X}px;
       width: {CA_W - CA_PAD - CA_DROITE_X}px; align-items: flex-end; display: flex; flex-direction: column; align-items: flex-start;">
    {_stores_tiktok(0.78)}
    <span style="margin-top: 12px; font-size: 21px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.2px; white-space: nowrap;">taxifoodnosybe.distripro207.com</span>
  </div>

  <div id="ca-col" style="position: absolute; z-index: 5; top: {CA_COL_Y}px; left: {CA_PAD}px; width: {b['x'] - CA_PAD - 28}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 18px;">
      <div style="width: {CA_LOGO_D}px; height: {CA_LOGO_D}px; border-radius: 50%; background: #FFFFFF;
           box-shadow: 0 10px 26px rgba(0,0,0,0.42); overflow: hidden; flex: 0 0 auto;">
        <img src="{logo}" alt="Logo" style="width: {CA_LOGO_D}px; height: {CA_LOGO_D}px; object-fit: cover; display: block;">
      </div>
      <div style="display: flex; align-items: center; gap: 14px;">
        <img src="taxifood.png" alt="Taxi Food" style="width: 42px; height: auto; display: block; border-radius: 9px;">
        <span style="font-size: 22px; font-weight: 700; letter-spacing: 3px; color: {OR}; text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
      </div>
    </div>
    <div id="ca-titre" style="margin-top: 10px; font-size: {titre_px}px; font-weight: 900; line-height: 0.97; color: #FFFFFF; letter-spacing: -2.1px; white-space: nowrap;">{titre}</div>
    <div style="margin-top: 12px; font-size: 29px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.94);">{secondaire}</div>
    <div style="margin-top: 5px; font-size: 44px; font-weight: 900; color: {OR}; letter-spacing: -0.8px;">{prix}</div>
    <div id="ca-lieu" style="margin-top: 8px; font-size: 25px; font-weight: 500; color: rgba(255,255,255,0.90); white-space: nowrap;">{ligne_lieu}</div>
    <div style="margin-top: 20px;">{_promo_tiktok(1.08)}</div>
  </div>

  <script>(function () {{
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1;
        e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    tenir('ca-titre', {titre_px}, 52, -2.1);
    tenir('ca-lieu', 25, 18, 0);

    // Meme regle qu'en 9:16 : la bande se deduit du contenu. Ici les deux
    // colonnes comptent, et la butee du produit est a {produit_haut}.
    var g = document.getElementById('ca-col').getBoundingClientRect().bottom;
    var d = document.getElementById('ca-droite').getBoundingClientRect().bottom;
    var ph = Math.round(Math.max(g, d) + 24);
    ph = Math.max(ph, 340);
    ph = Math.min(ph, {produit_haut} - 24);
    document.getElementById('ca-bande').style.height = ph + 'px';
    document.getElementById('ca-filet').style.top = ph + 'px';
  }})();</script>
''' + FOOT


# ============================================================================
# PUB PHOTO — une photo de vie, le message pose DANS l'image, sans bandeau.
#
# Les deux series decor posent un bandeau rouge translucide parce que le sujet
# occupe tout le cadre et qu'il n'y a nulle part ou ecrire. Sur une photo de
# scene, il y a souvent une SURFACE VIDE, et ici c'en est une belle : le
# plafond, eclaire par le plafonnier, lisse et chaud.
#
# On a mesure avant de decider :
#   blanc pose directement sur ce plafond           6,37:1
#   plafond + rouge 72 % + voile 28 % (le mieux)    5,49:1
#   rouge opaque des treize carres publies          4,24:1
#
# Le bandeau ferait donc PERDRE du contraste, en plus de recouvrir la lueur de
# la lampe, qui est tout le sujet du soir. On ecrit donc a meme le plafond. La
# marque tient par le reste : l'or sur l'accent, les deux logos, la typo.
#
# La regle generale, celle qu'il faut retenir : le bandeau n'est pas la marque,
# c'est un OUTIL contre un fond illisible. Quand le fond se lit, on s'en passe.
# ============================================================================
PP_MARGE   = 90
PP_COL_Y   = 130
PP_LOGO_D  = 158        # pastille du restaurant
PP_APP_D   = 108        # icone Taxi Food


def visuel_photo_pub(photo, titre1, titre2, accent, sous_titre, logo,
                     larg=1350, haut=1800, eyebrow=None, titre_px=100,
                     bas_sujet=600):
    """Le message pose sur une zone vide de la photo.

    `bas_sujet` : la ligne sous laquelle le sujet commence. Le bloc de texte
    doit finir au-dessus, et le rendeur le verifie.
    """
    eye = (f'<div style="display: flex; align-items: center; gap: 14px; margin-bottom: 18px;">'
           f'<span style="font-size: 26px; font-weight: 700; letter-spacing: 4px; color: {OR}; '
           f'text-transform: uppercase; white-space: nowrap;">{eyebrow}</span></div>') if eyebrow else ''
    return HEAD + f'''<div style="position: relative; width: {larg}px; height: {haut}px; background: #000000; overflow: hidden;">

  <img src="{photo}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {larg}px; height: {haut}px; object-fit: cover; display: block;">

  <!-- Un voile tres leger, seulement sous le texte, et en degrade vers le bas :
       il assoit les lettres sans faire une boite. Mesure : il fait passer le
       pire pixel du bloc de 5,1 a 6,0 pour un cout visuel nul. -->
  <div style="position: absolute; z-index: 1; left: 0; top: 0; width: {larg}px; height: {bas_sujet + 60}px;
       background: linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.22) 55%, rgba(0,0,0,0) 100%);"></div>

  <div id="pp-col" style="position: absolute; z-index: 4; top: {PP_COL_Y}px; left: {PP_MARGE}px;
       width: {larg - 2*PP_MARGE}px; display: flex; flex-direction: column; align-items: flex-start;">
    {eye}
    <div id="pp-t1" style="font-size: {titre_px}px; font-weight: 900; line-height: 0.98; color: #FFFFFF;
         letter-spacing: -2.6px; white-space: nowrap;">{titre1}</div>
    <div id="pp-t2" style="font-size: {titre_px}px; font-weight: 900; line-height: 0.98; color: #FFFFFF;
         letter-spacing: -2.6px; white-space: nowrap;">{titre2} <span style="color: {OR};">{accent}</span></div>
    <div id="pp-st" style="margin-top: 26px; font-size: 34px; font-weight: 500; color: rgba(255,255,255,0.95);
         white-space: nowrap;">{sous_titre}</div>
    <div style="margin-top: 22px;">{_stores_tiktok(1.05)}</div>
  </div>

  <!-- Les deux logos en bas a droite : le restaurant, puis l'application. -->
  <div id="pp-logos" style="position: absolute; z-index: 4; right: {PP_MARGE}px; bottom: {PP_MARGE}px;
       display: flex; align-items: center; gap: 22px;">
    <div style="width: {PP_LOGO_D}px; height: {PP_LOGO_D}px; border-radius: 50%; background: #FFFFFF;
         box-shadow: 0 12px 30px rgba(0,0,0,0.55); overflow: hidden;">
      <img src="{logo}" alt="Logo restaurant" style="width: {PP_LOGO_D}px; height: {PP_LOGO_D}px; object-fit: cover; display: block;">
    </div>
    <img src="taxifood.png" alt="Taxi Food" style="width: {PP_APP_D}px; height: auto; display: block;
         border-radius: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.55);">
  </div>

  <script>(function () {{
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1;
        e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    // Les deux lignes du titre s'ajustent ENSEMBLE, sinon elles sortent a des
    // corps differents et le bloc se casse.
    var e1 = document.getElementById('pp-t1'), e2 = document.getElementById('pp-t2');
    var px = {titre_px}, lp = e1.parentElement.clientWidth;
    while (px > 56 && (e1.scrollWidth > lp || e2.scrollWidth > lp)) {{
      px -= 1;
      [e1, e2].forEach(function (e) {{
        e.style.fontSize = px + 'px';
        e.style.letterSpacing = (-2.6 * px / {titre_px}) + 'px';
      }});
    }}
    tenir('pp-st', 34, 24, 0);
  }})();</script>
''' + FOOT


# ============================================================================
# PUB PHOTO, DEUX ZONES — pour une photo produit sur fond de couleur claire.
#
# La variante precedente ecrit en blanc sur un plafond sombre. Sur le packshot
# orange de La Cabane, le blanc tombe a 2,6:1 : illisible. Le NOIR y donne
# 8,1:1 — et ce n'est pas un pis-aller, c'est leur charte : le logo La Cabane
# est un disque NOIR a lettrage orange. On ecrit donc en noir.
#
# La photo laisse deux zones vides, mesurees sur le fond (tolerance 26/255) :
#   y 0 a 450        : 100 % de fond libre, sur toute la largeur
#   y 1080 a 1800    : 100 % de fond libre sur la MOITIE GAUCHE
# Le burger et la main occupent le centre-droit. Le message se scinde donc en
# deux : l'accroche en haut, tout ce qui sert a commander en bas a gauche.
#
# Pas de bandeau : le fond est deja un aplat lisible. Le bandeau est un outil
# contre un fond illisible, pas une signature.
# ============================================================================
PD_MARGE   = 90
PD_LOGO_D  = 150
PD_APP_D   = 100


# Les deux couleurs sont RELEVEES sur le logo La Cabane, pas choisies :
# le lettrage orange y mesure #F76C07, le disque #090201. Un badge « fait
# maison » doit avoir l air d etre de la maison, pas d avoir ete pose dessus.
CABANE_OR   = '#F76C07'
CABANE_NOIR = '#0B0503'


def _badge_maison(d=176, x=0, y=0, rot=-8, or_=CABANE_OR, noir=CABANE_NOIR,
                  h1='Fait', h2='maison'):
    """Le tampon « fait maison ». Disque noir, lisere et lettrage orange —
    la construction du logo du restaurant, a une autre echelle."""
    f = lambda v: round(v * d / 176)
    return (f'<div style="position: absolute; z-index: 6; left: {x}px; top: {y}px; '
            f'width: {d}px; height: {d}px; border-radius: 50%; background: {noir}; '
            f'transform: rotate({rot}deg); box-shadow: 0 {f(10)}px {f(26)}px rgba(0,0,0,0.28); '
            f'display: flex; align-items: center; justify-content: center;">'
            f'<div style="width: {d - f(18)}px; height: {d - f(18)}px; border-radius: 50%; '
            f'border: {f(3)}px solid {or_}; display: flex; flex-direction: column; '
            f'align-items: center; justify-content: center; line-height: 0.92;">'
            f'<span style="font-size: {f(30)}px; font-weight: 900; color: {or_}; '
            f'text-transform: uppercase; letter-spacing: {f(1)}px;">{h1}</span>'
            f'<span style="font-size: {f(38)}px; font-weight: 900; color: {or_}; '
            f'text-transform: uppercase; letter-spacing: {f(-0.5)}px;">{h2}</span>'
            f'</div></div>')


def visuel_photo_deux_zones(photo, titre, secondaire, prix, ligne_lieu, logo,
                            larg=1350, haut=1800, eyebrow='Nouveau sur Taxi&nbsp;Food',
                            titre_px=104, encre='#141414', bas_y=1150,
                            code='TAXIFOOD50', badges=()):
    """Accroche en haut, bloc de commande en bas a gauche, texte en noir."""
    M = PD_MARGE
    return HEAD + f'''<div style="position: relative; width: {larg}px; height: {haut}px; background: #000000; overflow: hidden;">

  <img src="{photo}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {larg}px; height: {haut}px; object-fit: cover; display: block;">

{"".join(_badge_maison(**b) for b in badges)}
  <div id="pd-haut" style="position: absolute; z-index: 4; top: {M}px; left: {M}px; width: {larg - 2*M}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 14px;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 42px; height: auto; display: block; border-radius: 9px;">
      <span style="font-size: 25px; font-weight: 800; letter-spacing: 3.6px; color: {encre};
            text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
    </div>
    <div id="pd-titre" style="margin-top: 12px; font-size: {titre_px}px; font-weight: 900; line-height: 0.96;
         color: {encre}; letter-spacing: -3px; white-space: nowrap;">{titre}</div>
    <div id="pd-desc" style="margin-top: 14px; font-size: 32px; font-weight: 500; color: rgba(20,20,20,0.86);
         white-space: nowrap;">{secondaire}</div>
    <div style="margin-top: 10px; font-size: 56px; font-weight: 900; color: {encre}; letter-spacing: -1.4px;">{prix}</div>
  </div>

  <div id="pd-bas" style="position: absolute; z-index: 4; top: {bas_y}px; left: {M}px; width: {round(larg*0.44)}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div id="pd-lieu" style="font-size: 24px; font-weight: 600; color: rgba(20,20,20,0.88); white-space: nowrap;">{ligne_lieu}</div>
    <div style="margin-top: 18px;">{_promo_tiktok(1.0)}</div>
    <div style="margin-top: 18px;">{_stores_tiktok(0.80)}</div>
    <div id="pd-url" style="margin-top: 12px; font-size: 24px; font-weight: 800; color: {encre};
         letter-spacing: -0.2px; white-space: nowrap;">taxifoodnosybe.distripro207.com</div>
    <div id="pd-logos" style="margin-top: 26px; display: flex; align-items: center; gap: 20px;">
      <img src="{logo}" alt="Logo restaurant" style="width: {PD_LOGO_D}px; height: {PD_LOGO_D}px;
           object-fit: contain; display: block;">
      <img src="taxifood.png" alt="Taxi Food" style="width: {PD_APP_D}px; height: auto; display: block;
           border-radius: 22px; box-shadow: 0 10px 26px rgba(0,0,0,0.30);">
    </div>
  </div>

  <script>(function () {{
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1;
        e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    tenir('pd-titre', {titre_px}, 58, -3);
    tenir('pd-desc', 32, 22, 0);
    tenir('pd-lieu', 24, 17, 0);
    tenir('pd-url', 24, 17, 0);
  }})();</script>
''' + FOOT


# ============================================================================
# PUB PHOTO, BLOC HAUT — quand le produit tient tout le cadre.
#
# La variante « deux zones » supposait une colonne laterale libre. Des que le
# heros grossit — et il DOIT grossir, c est lui qu on vend — cette colonne
# disparait. Mesure sur le Tenders a 67 % de largeur : le bas-gauche tombe a
# 48 % de fond libre, l avant-bras le traverse. Le message n y tient plus.
#
# Ce qui reste propre, mesure par bandes de 120 px :
#   y 0 a 480    : 100 % libre sur TOUTE la largeur
#   y 1600-1760 a droite : 100 % libre
#
# Tout le message se serre donc dans la bande haute — accroche, prix, code,
# stores, URL : 423 px mesures, pour 470 disponibles. Les deux logos descendent
# dans le coin bas-droit. Le milieu du cadre appartient au produit, entier.
# ============================================================================
PH_MARGE = 90


def visuel_photo_bloc_haut(photo, titre, secondaire, prix, ligne_lieu, logo,
                           larg=1350, haut=1800, eyebrow='Nouveau sur Taxi&nbsp;Food',
                           titre_px=100, encre='#141414', badges=(), col_larg=0.68):
    """Tout le message en haut, les logos en bas a droite, le produit au milieu."""
    M = PH_MARGE
    return HEAD + f'''<div style="position: relative; width: {larg}px; height: {haut}px; background: #000000; overflow: hidden;">

  <img src="{photo}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {larg}px; height: {haut}px; object-fit: cover; display: block;">

{"".join(_badge_maison(**b) for b in badges)}

  <div id="ph-col" style="position: absolute; z-index: 4; top: {M}px; left: {M}px; width: {round(larg*col_larg)}px;
       display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 13px;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 40px; height: auto; display: block; border-radius: 9px;">
      <span style="font-size: 24px; font-weight: 800; letter-spacing: 3.4px; color: {encre};
            text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
    </div>
    <div id="ph-titre" style="margin-top: 8px; font-size: {titre_px}px; font-weight: 900; line-height: 0.95;
         color: {encre}; letter-spacing: -2.9px; white-space: nowrap;">{titre}</div>
    <div id="ph-desc" style="margin-top: 8px; font-size: 29px; font-weight: 500; color: rgba(20,20,20,0.86);
         white-space: nowrap;">{secondaire}</div>
    <div style="margin-top: 4px; display: flex; align-items: baseline; gap: 22px;">
      <span style="font-size: 54px; font-weight: 900; color: {encre}; letter-spacing: -1.4px;">{prix}</span>
      <span id="ph-lieu" style="font-size: 22px; font-weight: 700; color: rgba(20,20,20,0.80);
            white-space: nowrap;">{ligne_lieu}</span>
    </div>
    <div style="margin-top: 12px;">{_promo_tiktok(0.95)}</div>
    <div style="margin-top: 12px; display: flex; align-items: center; gap: 20px;">
      {_stores_tiktok(0.72)}
      <span id="ph-url" style="font-size: 22px; font-weight: 800; color: {encre};
            letter-spacing: -0.2px; white-space: nowrap;">taxifoodnosybe.distripro207.com</span>
    </div>
  </div>

  <div id="ph-logos" style="position: absolute; z-index: 4; right: {M}px; bottom: {M}px;
       display: flex; align-items: center; gap: 20px;">
    <img src="{logo}" alt="Logo restaurant" style="width: 138px; height: 138px; object-fit: contain; display: block;">
    <img src="taxifood.png" alt="Taxi Food" style="width: 96px; height: auto; display: block;
         border-radius: 21px; box-shadow: 0 10px 26px rgba(0,0,0,0.30);">
  </div>

  <script>(function () {{
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1; e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    tenir('ph-titre', {titre_px}, 54, -2.9);
    tenir('ph-desc', 29, 20, 0);
    tenir('ph-lieu', 22, 15, 0);
    tenir('ph-url', 22, 15, 0);
  }})();</script>
''' + FOOT


# =========================================================================
# PUB PHOTO CARTE — quand la photo est pleine bord a bord.
#
# Le plan editorial (une fille qui mord dans le Tenders) n a AUCUNE zone libre :
# mesure par bandes de 64 px sur 1024, le fond calme tombe a 25,8 % et les seuls
# carres a 100 % sont le coin haut-gauche et une languette de veste en bas a
# gauche. Aucun des deux ne tient le bloc de commande, et tout le reste est soit
# le burger, soit son visage, soit le tatouage qu on vient de poser.
#
# On ne recouvre donc rien : on AGRANDIT le cadre. La photo garde sa composition
# entiere, la bande porte le message. Bande ORANGE #F76C07 — celle du lettrage
# La Cabane, relevee sur leur logo, deja validee comme fond de la serie — et
# encre NOIRE : 8,1:1, contre 2,6:1 pour du blanc sur ce meme orange.
#
# Le recadrage est contraint par le BAS : le tatouage descend a 86,6 % de la
# hauteur source. Bande de 400 px => zone photo de 1400 px => le tatouage
# s arrete a 1212, soit 188 px au-dessus de la bande. Verifie sur le rendu.
# ============================================================================
BC_BANDE  = 400
BC_PAD_V  = 58
BC_PAD_H  = 66
BC_ORANGE = CABANE_OR
BC_ENCRE  = CABANE_NOIR


def visuel_photo_carte(photo, titre, secondaire, prix, ligne_lieu, logo,
                       larg=1350, haut=1800, bande=BC_BANDE,
                       eyebrow='Nouveau sur Taxi&nbsp;Food', titre_px=82,
                       fond=BC_ORANGE, encre=BC_ENCRE, col_g=0.65):
    """Photo pleine largeur en haut, carte de commande sur bande de marque en bas."""
    PV, PH = BC_PAD_V, BC_PAD_H
    ph_h = haut - bande
    corps = f'''<div style="position: relative; width: {larg}px; height: {haut}px; background: {fond}; overflow: hidden;">

  <img src="{photo}" alt="" style="position: absolute; z-index: 0; left: 0; top: 0;
       width: {larg}px; height: {ph_h}px; object-fit: cover; object-position: 50% 0%; display: block;">

  <div id="bc-bande" style="position: absolute; z-index: 2; left: 0; top: {ph_h}px;
       width: {larg}px; height: {bande}px; background: {fond}; display: flex;
       align-items: center; justify-content: space-between;
       padding: {PV}px {PH}px; box-sizing: border-box;">

  <div id="bc-col" style="z-index: 4;
       width: {round((larg - 2*PH) * col_g)}px; display: flex; flex-direction: column; align-items: flex-start;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 36px; height: auto; display: block; border-radius: 8px;">
      <span style="font-size: 22px; font-weight: 800; letter-spacing: 3.2px; color: {encre};
            text-transform: uppercase; white-space: nowrap;">{eyebrow}</span>
    </div>
    <div id="bc-titre" style="margin-top: 8px; font-size: {titre_px}px; font-weight: 900; line-height: 0.95;
         color: {encre}; letter-spacing: -2.6px; white-space: nowrap;">{titre}</div>
    <div id="bc-desc" style="margin-top: 8px; font-size: 26px; font-weight: 500; color: rgba(11,5,3,0.82);
         white-space: nowrap;">{secondaire}</div>
    <div style="margin-top: 10px; display: flex; align-items: baseline; gap: 20px;">
      <span style="font-size: 52px; font-weight: 900; color: {encre}; letter-spacing: -1.3px;">{prix}</span>
      <span id="bc-lieu" style="font-size: 21px; font-weight: 800; letter-spacing: 1.4px; color: rgba(11,5,3,0.78);
            text-transform: uppercase; white-space: nowrap;">{ligne_lieu}</span>
    </div>
  </div>

  <div id="bc-droite" style="z-index: 4;
       display: flex; flex-direction: column; align-items: flex-end;">
    <div>{_promo_tiktok(0.86)}</div>
    <div style="margin-top: 14px;">{_stores_tiktok(0.68)}</div>
    <div id="bc-url" style="margin-top: 10px; font-size: 21px; font-weight: 800; color: {encre};
         letter-spacing: -0.2px; white-space: nowrap;">taxifoodnosybe.distripro207.com</div>
    <div style="margin-top: 16px; display: flex; align-items: center; gap: 18px;">
      <img src="{logo}" alt="Logo restaurant" style="width: 88px; height: 88px; object-fit: contain; display: block;">
      <img src="taxifood.png" alt="Taxi Food" style="width: 72px; height: auto; display: block;
           border-radius: 16px; box-shadow: 0 8px 20px rgba(11,5,3,0.32);">
    </div>
  </div>

  </div>

  <script>(function () {{
    function tenir(id, px, mini, ls) {{
      var e = document.getElementById(id);
      if (!e) return;
      var p0 = px;
      while (px > mini && e.scrollWidth > e.parentElement.clientWidth) {{
        px -= 1; e.style.fontSize = px + 'px';
        if (ls) e.style.letterSpacing = (ls * px / p0) + 'px';
      }}
    }}
    tenir('bc-titre', {titre_px}, 46, -2.6);
    tenir('bc-desc', 26, 18, 0);
    tenir('bc-lieu', 21, 14, 0);
    tenir('bc-url', 21, 14, 0);
  }})();</script>
'''
    return HEAD + corps + FOOT
