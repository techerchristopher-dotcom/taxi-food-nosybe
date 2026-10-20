# -*- coding: utf-8 -*-
"""La scene d'annonce de L'escale Creole : une mosaique de SES photos de carte.

Meme geometrie que l'annonce du Nandipo (`nandipo/nandipo_scene_mosaique.py`) pour
le carre 1080 x 1350 : scene de 1080 x 748, filets or de 2 px, jamais sur le bord
exterieur.

    gauche 698 : HEROS 698x448  |  bas-gauche 348x298 + bas-milieu 348x298
    droite 380 : droite-haut 380x230 | droite-mil 380x230 | FOND 380x284 (pastille)

QUELLES PHOTOS — uniquement des plats COMMANDABLES et photographies, relus en base
le 2026-10-14 (restaurant 128e68ab, `products.is_available`, non archives, categorie
active, hors Bieres/Softs, `in_menu = true`) :

    pj-rougail-saucisses        Rougail saucisses              38 000 Ar  porc  -> heros
    ab-sambos-zebu              Sambos zebu ou poulet           2 000 Ar
    pj-bol-renverse             Bol renverse poulet ou zebu    32 000 Ar
    pj-emince-zebu-oignons      Emince de zebu aux oignons     35 000 Ar
    pj-emince-poulet-brede      Emince de poulet au brede ch.  35 000 Ar
  (story seulement, rangee du haut)
    ab-demi-lune-poulet         Demi-lune poulet                3 000 Ar
    ab-assiette-crudite         Assiette de crudite             7 000 Ar
  (L'emince de zebu au gingembre a ete essaye a cette place : a cote de l'emince
  aux oignons, c'etait deux fois la meme assiette. Les crudites changent la couleur.)

  EXCLUS : les quatre « plats du jour » sans categorie (Massale cabri, Roti porc a la
  creole, Poisson frit entier, Saute porc aux gros piments) : `in_menu = false` ET
  `is_featured = false` — ils ne sont visibles nulle part pour un client, donc pas
  commandables aujourd'hui. Riz frit, beignets, soupe chinoise : `is_available = false`.
  Saucisse frite : photo prise au telephone, d'une autre facture que la serie studio.

LES PHOTOS SONT CARREES (800 ou 1024 px), plat au premier plan, drapeau de La
Reunion tendu derriere. Dans une cellule allongee on n'en garde qu'une BANDE pleine
largeur, et la bande est choisie PAR LA MESURE : centree sur l'assiette (masque
« clair et desature », la faience et le riz ; le drapeau est sature, il n'y entre
pas), bornee au cadre.

LE FOND DE LA CELLULE RESERVEE. La pastille de remise a besoin d'une cellule sans
assiette. Chez le Nandipo c'etait du bois agrandi ; ici c'est le DRAPEAU DE SES PROPRES
PHOTOS — la toile tendue derriere l'emince de poulet au brede (haut de la photo, au-
dessus de l'assiette, pointe du triangle rouge et rayons jaunes). Rien n'est dessine :
c'est un morceau de photo, legerement adouci. Le controle verifie qu'aucun pixel
d'assiette n'y entre.
"""
import os
import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, 'visuels')

L = 1080
OR = (255, 199, 44)
FILET = 2

# --- geometrie du CARRE (scene 1080 x 748), identique au Nandipo -----------------
H = 748
GL = 698; GR = L - GL - FILET          # 698 + 2 + 380
HH = 448; HB = H - HH - FILET          # 448 + 2 + 298
PL = (GL - FILET) // 2                 # 348
HD = 230

# --- STORY : meme mosaique, plus une rangee de 326 px au-dessus (scene 1080 x 1076).
#     Les 250 premiers px d'une story sont recouverts par l'interface : cette rangee
#     n'est que de l'image qui deborde, aucun contenu n'y vit.
H_STORY = 1076
RANGEE = H_STORY - H - FILET           # 326
DEMI = (L - FILET) // 2                # 539


def cellules(dy=0):
    """(nom, fichier, x, y, larg, haut) de la mosaique carree, decalee de dy."""
    return [
        ('heros',       'pj-rougail-saucisses.jpg',   0,          dy,              GL,              HH),
        ('bas-gauche',  'ab-sambos-zebu.jpg',         0,          dy + HH + FILET, PL,              HB),
        ('bas-milieu',  'pj-bol-renverse.jpg',        PL + FILET, dy + HH + FILET, GL - PL - FILET, HB),
        ('droite-haut', 'pj-emince-zebu-oignons.jpg', GL + FILET, dy,              GR,              HD),
        ('droite-mil',  'pj-emince-poulet-brede.jpg', GL + FILET, dy + HD + FILET, GR,              HD),
    ]


def cellules_story():
    return [
        ('haut-gauche', 'ab-demi-lune-poulet.jpg',      0,            0, DEMI,             RANGEE),
        ('haut-droite', 'ab-assiette-crudite.jpg', DEMI + FILET, 0, L - DEMI - FILET, RANGEE),
    ] + cellules(RANGEE + FILET)


def fond(dy=0):
    """La cellule reservee a la pastille (bas-droite)."""
    return dict(x0=GL + FILET, x1=L, y0=dy + 2 * (HD + FILET), y1=dy + H)


# Le morceau de drapeau : (fichier, x0, y0, largeur), fraction du cote de la photo.
FOND_SRC = ('pj-emince-poulet-brede.jpg', 0.205, 0.0, 0.58)


def masque_assiette(a):
    """Faience et riz : clair et desature. a = tableau float 0..1."""
    mx = a.max(2); mn = a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return ndimage.binary_opening((mx > 0.55) & (S < 0.28), np.ones((5, 5)))


def bande(fichier, larg, haut):
    """Bande pleine largeur au rapport de la cellule, centree sur l'assiette."""
    im = Image.open(os.path.join(SRC, fichier)).convert('RGB')
    W, Hs = im.size
    m = masque_assiette(np.asarray(im).astype(np.float32) / 255)
    lab, n = ndimage.label(m)
    tailles = ndimage.sum(m, lab, range(1, n + 1))
    plus = np.argmax(tailles) + 1
    ys, xs = np.nonzero(lab == plus)
    cy = (ys.min() + ys.max()) / 2                 # centre de la boite de l'assiette
    h = round(W * haut / larg)
    y0 = int(min(max(cy - h / 2, 0), Hs - h))
    return im.crop((0, y0, W, y0 + h)).resize((larg, haut), Image.LANCZOS), y0, h


def morceau_de_drapeau(larg, haut):
    f, fx, fy, fw = FOND_SRC
    im = Image.open(os.path.join(SRC, f)).convert('RGB')
    W = im.size[0]
    x0, y0, w = round(fx * W), round(fy * W), round(fw * W)
    h = round(w * haut / larg)
    c = im.crop((x0, y0, x0 + w, y0 + h))
    m = masque_assiette(np.asarray(c).astype(np.float32) / 255)
    assert m.sum() == 0, 'une assiette entre dans le morceau de drapeau (%d px)' % m.sum()
    return c.resize((larg, haut), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))


def construire(story=False, sortie=None):
    sortie = sortie or ('scene-story.png' if story else 'scene.png')
    hh = H_STORY if story else H
    dy = RANGEE + FILET if story else 0
    scene = Image.new('RGB', (L, hh), OR)
    for nom, f, x, y, w, h in (cellules_story() if story else cellules()):
        c, y0, hs = bande(f, w, h)
        scene.paste(c, (x, y))
        print('  %-12s %-30s bande y %4d..%4d' % (nom, f, y0, y0 + hs))
    F = fond(dy)
    scene.paste(morceau_de_drapeau(F['x1'] - F['x0'], F['y1'] - F['y0']), (F['x0'], F['y0']))
    scene.save(os.path.join(D, sortie))
    a = np.asarray(scene).astype(float) / 255
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    print('%s %dx%d   luminance moyenne %.3f   part < 0,12 : %.0f %%'
          % (sortie, *scene.size, lum.mean(), 100 * (lum < 0.12).mean()))
    return scene


# --- le logo : fichier de la base (`restaurants.logo_url`, carre creme 1080 px) pose
#     dans un DISQUE creme de 1000 px a fond transparent. Le contenu (ile + nom) est
#     reduit a 92 % pour que le nom ne touche pas le bord du disque.
def logo_rond(sortie='logo-escale-rond.png', cote=1000, echelle=0.92):
    src = Image.open(os.path.join(SRC, 'logo-escale-base.png')).convert('RGB')
    creme = src.getpixel((8, 8))
    t = round(cote * echelle)
    contenu = src.resize((t, t), Image.LANCZOS)
    plein = Image.new('RGB', (cote, cote), creme)
    plein.paste(contenu, ((cote - t) // 2, (cote - t) // 2))
    k = 4
    masque = Image.new('L', (cote * k, cote * k), 0)
    ImageDraw.Draw(masque).ellipse((0, 0, cote * k - 1, cote * k - 1), fill=255)
    masque = masque.resize((cote, cote), Image.LANCZOS)
    plein.putalpha(masque)
    plein.save(os.path.join(SRC, sortie))
    print('%s %dx%d, creme %s' % (sortie, cote, cote, creme))


if __name__ == '__main__':
    logo_rond()
    construire(False)
    construire(True)
