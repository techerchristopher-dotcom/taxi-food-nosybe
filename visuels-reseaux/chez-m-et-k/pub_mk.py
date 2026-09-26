# -*- coding: utf-8 -*-
"""L'annonce de Chez M&K. Meme gabarit que La Plage, trois ecarts mesures.

1. LA PASTILLE DU RESTAURANT EST POSEE A NU, pas dans un rond blanc.
   La Plage avait un logo rectangulaire qu'il fallait contenir. Le sceau de
   M&K EST deja un disque fini, avec son filet or et son second filet : le
   poser dans un rond blanc ajouterait un troisieme cercle et un cadre que la
   marque n'a pas. Meme regle que pour le logo Taxi Food de la colonne droite :
   ombre portee `drop-shadow`, qui suit la forme, et rien d'autre.

2. LA PASTILLE PROMO EST DANS LA PLAQUE, PAS SUR UNE PHOTO. Les 28 photos ont
   ete testees (`mk_lit_pastille.py`) : la meilleure laissait -42,5 px d'air,
   soit une assiette mordue de 42 px. La mosaique reserve donc une plaque de
   braise 380 x 312, et la pastille y passe de 235 a 240 px avec 22 px d'air.

3. L'ANNONCE A DEUX ETATS, ET C'EST LA BASE QUI TRANCHE.
   `listing_status` de Chez M&K vaut `coming_soon` au 22/09/2026 : l'appli
   REFUSE la commande. Un visuel qui dit « livre chez toi » promet donc une
   livraison que l'appli n'accepte pas — la regle 3 de la charte l'interdit
   dans les deux sens. Tant que le statut n'est pas `visible`, c'est
   `dispo=False` qui sort. Un mot suffit a basculer.
"""
import os
import importlib.util

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

OR, ROUGE, ENCRE = g.OR, g.ROUGE, g.ENCRE
PAD_H, PAD_V, FILET, DECAL, COL_W = g.PAD_H, g.PAD_V, g.FILET, g.DECAL, g.COL_W
LOGO_D = g.LOGO_D

import pub_laplage as PL
_col_stores_puis_logo = PL._col_stores_puis_logo


def pub(scene, titre, secondaire, lieu, logo, surtitre, badge, h=1350, red=594,
        titre_px=68, sec_px=25, h_col=505, code='TAXIFOOD50'):
    ph = h - red - FILET
    bd, bx, by = badge
    return g.HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; overflow: hidden; background: #0A0705;">
    <img src="{scene}" alt="{titre}" style="width: 1080px; height: {ph}px; object-fit: cover; object-position: center 50%; display: block;">
  </div>

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>

{g._badge_code('remise', code, bd, bx, by)}

  <img src="{logo}" alt="Logo" style="position: absolute; top: {ph - round(LOGO_D*0.52)}px; left: {PAD_H}px; z-index: 10; width: {LOGO_D}px; height: {LOGO_D}px; display: block; filter: drop-shadow(0 14px 32px rgba(0,0,0,0.55));">

  <div style="position: absolute; top: {ph+FILET}px; left: 0; width: 1080px; height: {red}px; box-sizing: border-box; padding: {PAD_V}px {PAD_H}px; display: flex; align-items: flex-start; justify-content: space-between; gap: 34px;">
    <div style="margin-top: {DECAL}px; display: flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="taxifood-transparent.png" alt="Taxi Food" style="width: 36px; height: auto; display: block;">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: 3.8px; color: {OR}; text-transform: uppercase;">{surtitre}</span>
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


# Aucun compte de plats grave sur le visuel : `is_available` bouge tous les
# jours. La fourchette, elle, tient — et elle EXCLUT la fondue terre et mer a
# 100 000 Ar, qui est en categorie « Sur commande » : l'annoncer dans une
# fourchette de carte la ferait passer pour commandable comme le reste.
_COMMUN = dict(
    scene='scene-mk.png',
    logo='logo-mk.png',
    secondaire=('Bols renvers&eacute;s, ti pan &agrave; la plancha, nems et van tan, ribs laqu&eacute;s.<br>'
                'Sa carte enti&egrave;re &middot; de 15 000 &agrave; 70 000 Ar'),
    lieu='Chez M&amp;K &middot; Djabala Honko &middot; 9 h &ndash; 22 h, 7 jours sur 7',
)
MK_BIENTOT   = dict(_COMMUN, surtitre='Bient&ocirc;t sur Taxi&nbsp;Food',
                    titre='Chez&nbsp;M&amp;K<br>arrive chez toi.')
MK_DISPONIBLE = dict(_COMMUN, surtitre='Nouveau sur Taxi&nbsp;Food',
                     titre='Chez&nbsp;M&amp;K<br>livre chez toi.')
