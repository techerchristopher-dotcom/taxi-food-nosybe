# -*- coding: utf-8 -*-
"""L'annonce de L'escale Creole — variante « restaurant deja disponible ».

MISE EN PAGE : celle du Nandipo, a l'identique (`nandipo/pub_nandipo.py`), elle-meme
reprise de La Plage et des Siciliens. Scene de 1080 x 748 au-dessus du filet or et
de la bande rouge, signature « NOUVEAU SUR TAXI FOOD », pastille de REMISE (pas de
QR), les deux badges de stores puis le logo Taxi Food dont le bas tombe sur le bas
du bloc promo. `pub()` est recopiee sans changement de mesure.

CE QUI CHANGE PAR RAPPORT AU NANDIPO

1. LE LOGO. Celui de la base (`restaurants.logo_url`, `produits/escale-creole/divers/
   logo.png`) est un CARRE creme 1080 px : l'ile de La Reunion remplie du drapeau,
   puis « L'escale Creole / Cuisine reunionnaise ». Il est pose dans un disque creme
   (`logo_rond()`, contenu reduit a 92 % pour que le nom ne touche pas le bord) et
   cale au centre standard des autres restaurants, meme diametre LOGO_D.

2. DEUX SERVICES PAR JOUR, FERME LE DIMANCHE (`restaurant_hours`, relu le
   2026-10-14) : lun.-sam. 11 h 30 - 13 h 45 et 18 h - 21 h 45.

3. LA STORY (1080 x 1920). La charte (« Le format story ») veut que la bande rouge
   soit le CALQUE EXACT de celle du carre et que seule la photo grandisse ; elle
   veut aussi que le contenu reste au-dessus de 1670 px (Instagram et TikTok
   recouvrent le bas). La bande rouge garde donc ses 594 px de contenu, posee de
   1084 a 1678 px, et le rouge continue en dessous sur 242 px SANS RIEN porter :
   l'image deborde jusqu'aux bords, le contenu jamais. La scene passe a 1080 x 1076
   (une rangee de deux plats de plus au-dessus de la mosaique du carre).

LES DONNEES VIENNENT DE LA BASE, relues le 2026-10-14 sur `128e68ab` : `cuisine_type`
(« Cuisine creole reunionnaise »), `zone_served` (Ambatoloaka), `restaurant_hours`,
et la fourchette de prix des plats `is_available`, non archives, categorie active,
hors boissons : 2 000 Ar (sambos zebu ou poulet) a 38 000 Ar (rougail saucisses,
saucisse frite). AUCUN COMPTE DE PLATS sur le visuel. Livraison « des 2 000 Ar » :
barème commun en base (2 000 Ar jusqu'a 3 km).
"""
import os, importlib.util

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(D), 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

OR, ROUGE, ENCRE = g.OR, g.ROUGE, g.ENCRE
PAD_H, PAD_V, FILET, DECAL, COL_W = g.PAD_H, g.PAD_V, g.FILET, g.DECAL, g.COL_W
LOGO_D = g.LOGO_D

# Geometrie de `visuels/logo-escale-rond.png` (construit par `escale_scene_mosaique.
# logo_rond()`) : un disque creme qui remplit tout le fichier de 1000 x 1000, centre
# au milieu. Pas de cornes ici : le disque EST le fichier.
LOGO_DISQUE = 1.0
LOGO_CX, LOGO_CY = 0.5, 0.5


def logo_pose(ph):
    """(gauche, haut, cote) du fichier du logo pour que son DISQUE vaille LOGO_D
    et soit centre la ou le gabarit centre le disque des autres restaurants :
    en (PAD_H + LOGO_D/2, ph - round(LOGO_D * 0.52) + LOGO_D/2)."""
    cote = round(LOGO_D / LOGO_DISQUE)
    cx = PAD_H + LOGO_D / 2
    cy = ph - round(LOGO_D * 0.52) + LOGO_D / 2
    return round(cx - LOGO_CX * cote), round(cy - LOGO_CY * cote), cote


def _col_stores_puis_logo(h_col, ecart=18):
    """Les deux badges, puis le logo Taxi Food dessous, le tout cale en bas.
    `flex-end` et non `space-between` : avec deux groupes espaces le vide se
    logerait au milieu et le logo ne fermerait plus la colonne."""
    W = COL_W
    return f'''<div style="display: flex; flex-direction: column; align-items: center; height: {h_col}px; justify-content: flex-end; gap: {ecart}px; width: {W}px; flex: 0 0 auto;">
      <div style="display: flex; flex-direction: column; gap: 11px; width: {W}px;">
        <img src="appstore.png" alt="Télécharger dans l'App Store" style="width: {W}px; height: auto; display: block;">
        <img src="googleplay.png" alt="Disponible sur Google Play" style="width: {W}px; height: auto; display: block;">
      </div>
      <img src="taxifood-transparent.png" alt="Taxi Food" style="width: {W}px; height: auto; display: block; filter: drop-shadow(0 10px 22px rgba(0,0,0,0.38));">
    </div>'''


def pub(scene, titre, secondaire, lieu, logo, h=1350, red=594, titre_px=68,
        badge=(235, 772, 488), sec_px=25, h_col=505, code='TAXIFOOD50'):
    ph = h - red - FILET
    bd, bx, by = badge
    lg, lh, lc = logo_pose(ph)
    return g.HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; overflow: hidden; background: #1A1A1A;">
    <img src="{scene}" alt="{titre}" style="width: 1080px; height: {ph}px; object-fit: cover; object-position: center 50%; display: block;">
  </div>

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>

{g._badge_code('remise', code, bd, bx, by)}

  <div style="position: absolute; top: {lh}px; left: {lg}px; z-index: 10; width: {lc}px; height: {lc}px;">
    <img src="{logo}" alt="Logo" style="width: {lc}px; height: {lc}px; display: block; filter: drop-shadow(0 14px 36px rgba(0,0,0,0.45));">
  </div>

  <div style="position: absolute; top: {ph+FILET}px; left: 0; width: 1080px; height: {red}px; box-sizing: border-box; padding: {PAD_V}px {PAD_H}px; display: flex; align-items: flex-start; justify-content: space-between; gap: 34px;">
    <div style="margin-top: {DECAL}px; display: flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="taxifood-transparent.png" alt="Taxi Food" style="width: 36px; height: auto; display: block;">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: 3.8px; color: {OR}; text-transform: uppercase;">Nouveau sur Taxi&nbsp;Food</span>
      </div>
      <div style="margin-top: 10px; font-size: {titre_px}px; font-weight: 900; line-height: 0.98; color: #FFFFFF; letter-spacing: -1.5px;">{titre}</div>
      <div style="margin-top: 12px; font-size: {sec_px}px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.92);">{secondaire}</div>
      <div style="margin-top: 10px; font-size: 20px; font-weight: 500; color: rgba(255,255,255,0.88);">{lieu}</div>
      <div style="margin-top: 18px;">{g._promo(1.0)}</div>
      <span style="margin-top: 14px; font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.72);">taxifoodnosybe.distripro207.com</span>
    </div>
    {_col_stores_puis_logo(h_col)}
  </div>
</div>
''' + g.FOOT


ESCALE = dict(
    scene='scene.png',
    # PASSIF. Taxi Food livre, pas le restaurant.
    titre='L&rsquo;escale&nbsp;Cr&eacute;ole,<br>livr&eacute; chez toi.',
    secondaire=('Cuisine cr&eacute;ole r&eacute;unionnaise &middot; Ambatoloaka<br>'
                'Sa carte &middot; de 2&nbsp;000 &agrave; 38&nbsp;000&nbsp;Ar &middot; livraison d&egrave;s 2&nbsp;000&nbsp;Ar'),
    lieu='Lun. &ndash; sam. &middot; 11 h 30 &ndash; 13 h 45 et 18 h &ndash; 21 h 45 &middot; ferm&eacute; le dimanche',
    logo='logo-escale-rond.png',
)
