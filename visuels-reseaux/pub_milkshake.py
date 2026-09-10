# -*- coding: utf-8 -*-
"""Le visuel pub « annonce » — une scene pleine largeur, la bande rouge de la charte.

Difference avec visuel() : pas de plat detoure pose sur le rouge, mais une SCENE
photographique qui occupe toute la largeur, et une pastille qui ne porte pas la
remise mais l'annonce. Le reste est identique — meme filet or, meme bande rouge,
meme colonne QR, meme bloc promo, meme regle de bas de page.

La pastille se pose dans le VIDE de la scene, mesure au prealable
(mesure_vide.py) : sur la scene milkshake, le triangle bas-droite est libre a
partir de x=580 sous y=640. On l'y met, elle bouche le trou au lieu de le subir.
"""
import importlib.util, os, sys

D = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

OR, ROUGE, ENCRE = g.OR, g.ROUGE, g.ENCRE
PAD_H, PAD_V, FILET, DECAL, COL_H = g.PAD_H, g.PAD_V, g.FILET, g.DECAL, g.COL_H
LOGO_D = g.LOGO_D


def badge_annonce(sur, gros, pilule, d=235, x=810, y=595, rot=-7):
    """Meme geometrie que _badge_code : cercle or, filet encre, rotation -7deg.
    Seul le contenu change — ici on annonce, on ne remise pas."""
    f = lambda v: round(v * d / 206)
    corps = (f'<div style="font-size: {f(13)}px; font-weight: 800; letter-spacing: {f(1.7)}px; '
             f'text-transform: uppercase; opacity: 0.72;">{sur}</div>'
             f'<div style="font-size: {f(40)}px; font-weight: 900; letter-spacing: {f(-1.2)}px; '
             f'line-height: 1; margin: {f(3)}px 0 {f(8)}px;">{gros}</div>'
             f'<div style="background: {ENCRE}; color: {OR}; font-size: {f(15)}px; font-weight: 900; '
             f'letter-spacing: {f(0.6)}px; padding: {f(5)}px {f(13)}px {f(6)}px; '
             f'border-radius: {f(20)}px; line-height: 1;">{pilule}</div>')
    return f'''  <div style="position: absolute; top: {y}px; left: {x}px; z-index: 12;
       width: {d}px; height: {d}px; border-radius: 50%; background: {OR};
       box-shadow: 0 {f(12)}px {f(30)}px rgba(0,0,0,0.30), inset 0 0 0 {f(4)}px rgba(19,19,19,0.92);
       transform: rotate({rot}deg); display: flex; flex-direction: column;
       align-items: center; justify-content: center; text-align: center;
       color: {ENCRE}; font-family: Archivo, sans-serif; box-sizing: border-box;
       padding: {f(17)}px;">{corps}</div>
'''


def pub(scene, titre, secondaire, lieu, logo, sur, gros, pilule,
        h=1350, red=500, titre_px=68, badge=(235, 810, 595), sec_px=25, h_col=COL_H):
    """h = hauteur totale, red = hauteur de la bande rouge.
    La photo prend tout le reste : ph = h - red - FILET.

    h_col force la hauteur de la colonne droite pour que le bas des badges
    tombe sur le bas du bloc promo. COL_H=401 vient du gabarit produit, ou la
    ligne secondaire tient sur UNE ligne ; ici elle en fait deux, le bloc promo
    descend d'autant, et la colonne doit suivre. Mesure, pas estime."""
    ph = h - red - FILET
    bd, bx, by = badge
    return g.HEAD + f'''<div style="position: relative; width: 1080px; height: {h}px; background: {ROUGE}; overflow: hidden;">

  <div style="position: absolute; top: 0; left: 0; width: 1080px; height: {ph}px; overflow: hidden; background: #F4EDE4;">
    <img src="{scene}" alt="{titre}" style="width: 1080px; height: {ph}px; object-fit: cover; object-position: center 50%; display: block;">
  </div>

  <div style="position: absolute; top: {ph}px; left: 0; width: 1080px; height: {FILET}px; background: {OR};"></div>

{badge_annonce(sur, gros, pilule, bd, bx, by)}

  <div style="position: absolute; top: {ph - round(LOGO_D*0.52)}px; left: {PAD_H}px; z-index: 10; width: {LOGO_D}px; height: {LOGO_D}px; border-radius: 50%; background: #FFFFFF; box-shadow: 0 14px 36px rgba(0,0,0,0.45); overflow: hidden;">
    <img src="{logo}" alt="Logo" style="width: {LOGO_D}px; height: {LOGO_D}px; object-fit: cover; display: block;">
  </div>

  <div style="position: absolute; top: {ph+FILET}px; left: 0; width: 1080px; height: {red}px; box-sizing: border-box; padding: {PAD_V}px {PAD_H}px; display: flex; align-items: flex-start; justify-content: space-between; gap: 34px;">
    <div style="margin-top: {DECAL}px; display: flex; flex-direction: column; align-items: flex-start; flex: 1 1 auto;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="taxifood.png" alt="Taxi Food" style="width: 36px; height: auto; display: block; border-radius: 8px;">
        <span style="font-size: 20px; font-weight: 700; letter-spacing: 3.8px; color: {OR}; text-transform: uppercase;">Bient&ocirc;t sur Taxi&nbsp;Food</span>
      </div>
      <div style="margin-top: 10px; font-size: {titre_px}px; font-weight: 900; line-height: 0.98; color: #FFFFFF; letter-spacing: -1.5px;">{titre}</div>
      <div style="margin-top: 12px; font-size: {sec_px}px; font-weight: 400; line-height: 1.26; color: rgba(255,255,255,0.92);">{secondaire}</div>
      <div style="margin-top: 10px; font-size: 20px; font-weight: 500; color: rgba(255,255,255,0.88);">{lieu}</div>
      <div style="margin-top: 18px;">{g._promo(1.0)}</div>
      <span style="margin-top: 14px; font-size: 17px; font-weight: 600; color: rgba(255,255,255,0.72);">taxifoodnosybe.distripro207.com</span>
    </div>
    {g._col(1.0, h_col)}
  </div>
</div>
''' + g.FOOT


MILKSHAKES = dict(
    scene='scene.png',
    titre='Les milkshakes<br>arrivent.',
    secondaire=('Fraise &middot; Vanille &middot; Chocolat &middot; Oreo<br>'
                'Twix &middot; Sp&eacute;culoos &middot; Kinder Bueno &middot; Snickers'),
    lieu='La Cabane &middot; Ambatoloaka, Nosy&nbsp;Be',
    logo='cabane.jpg',
    sur='Les milkshakes',
    gros='BIENT&Ocirc;T',
    pilule='8 PARFUMS',
)
