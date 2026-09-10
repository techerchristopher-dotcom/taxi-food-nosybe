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
SERIE_PIZZA  = dict(larg=760, haut=1000, cx=DEBORD_CX, bas=DEBORD_BAS)
# La Cabane : des plats HORIZONTAUX (1,6 a 1,95:1). Le QR occupe tout ce qui est
# a droite de x=828 sous y=608, la pastille tout ce qui est a gauche de x=242
# entre y=478 et 658. Une pizza ronde se faufile entre les deux parce qu'elle est
# etroite en bas ; un panini, non. C'est la HAUTEUR qui commande donc ici, et la
# largeur ne mord jamais. Cherche par balayage, pas estime.
SERIE_CABANE = dict(larg=820, haut=520, cx=640, bas=600)


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

def _bandeau(photo, alt, ph, cadrage, degrade_h):
    """Le haut du visuel. Soit une photo pleine, soit le fond studio nu quand
    le plat est detoure et posé par-dessus (variante debord)."""
    if photo is None:
        return (f'<div style="position: absolute; top: 0; left: 0; width: 1080px; '
                f'height: {ph}px; background: {FOND_STUDIO};"></div>')
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
           cadrage=46, h=1080, h_col=COL_H, plat=None):
    """Le gabarit. Seuls les textes, la photo et le logo changent."""
    k = 1.0
    f = lambda v: round(v*k)
    red = f(RED_H); ph = h - red - FILET; logo_d = f(LOGO_D)
    return HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  {_bandeau(photo, alt, ph, cadrage, f(180))}

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>
{_debord(plat)}

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
