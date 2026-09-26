# -*- coding: utf-8 -*-
"""Le visuel d'annonce de La Plage — variante « restaurant deja disponible ».

Trois ecarts avec pub_milkshake.pub(), et un seul motif : La Plage EST
commandable (`listing_status = visible`, relu en base le 2026-09-17), la
milkshake ne l'etait pas.

1. La signature dit NOUVEAU SUR TAXI FOOD, pas « bientot ». La charte
   l'impose dans les deux sens : on ne montre pas comme disponible ce qui ne
   l'est pas, et on ne dit pas « bientot » ce qui est deja la.
2. La pastille porte LA REMISE, pas l'annonce. C'est la pastille standard de la
   charte, `_badge_code(variante='remise')` : le −50 % en heros, le code en
   pilule encre. Le « BIENTOT / 38 PLATS » n'avait de sens que sur un
   restaurant a venir.
3. Le QR est retire. Il servait a amener quelqu'un sur le site depuis un flyer
   ou un ecran d'ordinateur ; sur ce visuel il prenait 190 x 190 px pour un
   geste que personne ne fait en scrollant.
4. A sa place, LE LOGO TAXI FOOD passe sous les deux badges de stores. Les
   badges remontent donc de la hauteur du logo plus l'ecart, soit 214 px, et
   c'est desormais LE BAS DU LOGO qui tombe sur le bas du bloc promo. La regle
   de charte — les deux colonnes finissent sur la meme ligne horizontale — est
   conservee, seul l'element sur lequel on la mesure change.

   Le logo apparait alors deux fois : 36 px dans la signature, ou la charte
   l'impose, et 190 px au bas de la colonne. Les deux ne disent pas la meme
   chose — le petit signe la ligne « NOUVEAU SUR TAXI FOOD », le grand ferme la
   colonne du geste « installer l'appli ».

Le reste ne bouge pas : filet or, bande rouge, pastille du restaurant, bloc
promo trois lignes, adresse du site.
"""
import os
import importlib.util

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

OR, ROUGE, ENCRE = g.OR, g.ROUGE, g.ENCRE
PAD_H, PAD_V, FILET, DECAL, COL_W = g.PAD_H, g.PAD_V, g.FILET, g.DECAL, g.COL_W
LOGO_D = g.LOGO_D


def _col_stores_puis_logo(h_col, ecart=18):
    """La colonne droite : les deux badges, puis le logo Taxi Food dessous.

    `justify-content: flex-end` et non `space-between` : avec deux groupes
    espaces, le vide se logerait AU MILIEU de la colonne et le logo ne
    toucherait plus le bas. Ici les deux groupes forment un bloc cale en bas,
    donc le bas de la colonne vaut le bas du logo — et c'est ce que le controle
    d'ecart verifie.

    LE LOGO EST LE FICHIER OFFICIEL DETOURE, POSE A NU SUR LE ROUGE.
    `logo-taxi-food-transparent_2.png` (bucket `logo`, 392 x 403) : la
    transparence ne porte que sur les coins arrondis, le reste est l'icone.
    Pas de cadre blanc, pas de pastille, et PAS D'ARRONDI EN CSS — les coins
    sont deja dans le fichier, avec leur anticrenelage, exactement la regle que
    la charte pose pour les badges des stores.

    Une pastille blanche avait ete essayee et refusee : elle montait le
    contraste de 2,06 a 4,36 : 1 mais ajoutait un cadre que la marque n'a pas.
    La separation vient donc d'une OMBRE PORTEE `drop-shadow`, qui suit la forme
    du logo au lieu de dessiner une boite autour."""
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
    return g.HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; overflow: hidden; background: #F4EDE4;">
    <img src="{scene}" alt="{titre}" style="width: 1080px; height: {ph}px; object-fit: cover; object-position: center 50%; display: block;">
  </div>

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>

{g._badge_code('remise', code, bd, bx, by)}

  <div style="position: absolute; top: {ph - round(LOGO_D*0.52)}px; left: {PAD_H}px; z-index: 10; width: {LOGO_D}px; height: {LOGO_D}px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 14px 36px rgba(0,0,0,0.45); overflow: hidden;">
    <img src="{logo}" alt="Logo" style="width: {LOGO_D}px; height: {LOGO_D}px; object-fit: cover; display: block;">
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


LAPLAGE = dict(
    scene='scene.png',
    # « se fait livrer » disait que c'est LA PLAGE qui recoit une livraison —
    # l'inverse du sens voulu. La charte le cadre : le restaurant est le sujet,
    # et on annonce qu'il LIVRE. « La Plage livre chez toi » met le restaurant
    # en sujet, l'action au present, et le client en destination.
    titre='La&nbsp;Plage<br>livre chez toi.',
    # Aucun compte de plats : `is_available` bouge tous les jours (35 sur 38 ce
    # matin), un chiffre grave sur un visuel devient faux sans prevenir. La
    # fourchette de prix, elle, tient. Et on ne nomme que du disponible : la
    # soupe chinoise et le mi xao sont coupes en base aujourd'hui.
    secondaire=('Grillades au feu de bois, poissons, romazava, poulet citronn&eacute;.<br>'
                'Sa carte enti&egrave;re &middot; de 6 000 &agrave; 35 000 Ar'),
    lieu='La Plage &middot; Hell-Ville &middot; 10 h &ndash; 15 h et 18 h &ndash; 22 h, ferm&eacute; le lundi',
    logo='laplage-logo.jpeg',
)
