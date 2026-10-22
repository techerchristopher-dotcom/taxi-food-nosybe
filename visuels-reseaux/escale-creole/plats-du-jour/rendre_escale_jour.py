# -*- coding: utf-8 -*-
"""VARIANTE « PLATS DU JOUR » (tableau du 2026-10-22) de ../rendre_escale_annonce.py, memes controles.
Signature « Plats du jour » au lieu de « Nouveau sur Taxi Food » ; fourchette = plats a l'affiche.

Rend l'annonce de L'escale Creole et la verifie. Controles chiffres, aucun a l'oeil.

Usage, depuis ce dossier :
    ARCHIVO_VARIABLE=/chemin/Archivo[wdth,wght].ttf python3 rendre_escale_annonce.py           # carre 1080x1350
    ARCHIVO_VARIABLE=/chemin/Archivo[wdth,wght].ttf python3 rendre_escale_annonce.py --story   # 1080x1920

Copie de `nandipo/rendre_nandipo_annonce.py`, memes controles : ecart promo / logo
Taxi Food = 0, secondaire sur 2 lignes, titre et secondaire dans leur colonne, air
pastille -> 1re assiette >= 20 px, pastille dans sa cellule, aucun debord, QR absent,
titre PASSIF, fourchette de prix == base, disque du logo au centre standard (<= 1 px),
air logo -> signature >= 20 px, aucune assiette centree sous le logo. En story, un
controle de plus : tout le contenu au-dessus de 1670 px.

POLICE : voir l'en-tete du script du Nandipo (ARCHIVO_VARIABLE, deux plages 100-500
et 700-900 pour reproduire la resolution du Mac d'origine).
"""
import asyncio, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
sys.path.insert(0, os.path.dirname(D))
sys.path.insert(0, os.path.dirname(os.path.dirname(D)))   # mesure.py vit dans visuels-reseaux/
import pub_escale_jour as P
import mesure
from mesure import standalone
from scene_jour import cellules, cellules_story
from escale_scene_mosaique import fond, RANGEE, FILET as FILET_SCENE

mesure.CHEMINS.extend([os.path.join(os.path.dirname(D), 'visuels'), D])   # logo-escale-rond.png, scene.png

AIR_MINI = 20.0
# La fourchette ECRITE sur le visuel. Elle doit valoir celle de la base :
#   select min(price), max(price) from products p join categories c ...
#   where p.is_available and not p.is_archived and c.is_active and not c.est_boisson
#   (restaurant 128e68ab, relu 2026-10-14)
PRIX_BASE = (32000, 40000)   # plats a l'affiche le 2026-10-22 (bol renverse .. pave de vivaneau)
# Story : la charte veut tout le contenu au-dessus de 1670 px.
BAS_UTILE_STORY = 1670


def faces_archivo():
    f = os.environ.get('ARCHIVO_VARIABLE')
    if not f or not os.path.exists(f):
        return ''
    u = 'file://' + os.path.abspath(f)
    return ('<style>@font-face{font-family:Archivo;src:url("%s") format("truetype");font-weight:100 500;}'
            '@font-face{font-family:Archivo;src:url("%s") format("truetype");font-weight:700 900;}</style>' % (u, u))


def masque_assiettes(scene, larg, haut):
    """Ou sont les assiettes dans la scene finale — par la COULEUR, comme la
    charte l'exige : la faience est claire et desaturee, le bois est sombre et
    brun, la nourriture est saturee. (Une carte de texture declarerait tout le
    cadre « occupe » : le grain du bois a un ecart-type local de 13.)"""
    im = Image.open(scene).convert('RGB').resize((larg, haut), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255
    mx = a.max(2); mn = a.min(2)
    S = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return ndimage.binary_opening((mx > 0.55) & (S < 0.28), np.ones((5, 5)))


def air_badge(masque, cx, cy, r):
    ys, xs = np.nonzero(masque)
    if not len(xs):
        return 999.0
    return float(np.hypot(xs - cx, ys - cy).min() - r)


def centres_sous_le_logo(masque, cx, cy, r):
    """Pour chaque cellule de la mosaique : le centre de gravite de ses pixels
    d'assiette, et sa distance au centre du disque du logo. Rend la plus petite
    marge (distance - rayon) et le nom de la cellule concernee."""
    pire = (999.0, '-')
    for nom, f, x, y, w, hh in CELLS:
        m = masque[y:y + hh, x:x + w]
        ys, xs = np.nonzero(m)
        if len(xs) < 500:
            continue
        gx, gy = x + xs.mean(), y + ys.mean()
        marge = float(np.hypot(gx - cx, gy - cy) - r)
        if marge < pire[0]:
            pire = (marge, nom)
    return pire


async def rendre(fichier=None, story=False):
    global CELLS
    fichier = fichier or ('PUB-escale-plats-du-jour-story.png' if story else 'PUB-escale-plats-du-jour.png')
    CELLS = cellules_story() if story else cellules()
    from playwright.async_api import async_playwright
    cfg = dict(P.ESCALE)
    if story:
        cfg['scene'] = 'scene-jour-story.png'
        h, red = 1920, 836                       # 594 de contenu + 242 de rouge nu
    else:
        h, red = 1350, 594
    ph = h - red - P.FILET                       # 748 (carre) / 1076 (story)
    BOIS = fond(RANGEE + FILET_SCENE if story else 0)
    bd = 235
    bx = BOIS['x0'] + (BOIS['x1'] - BOIS['x0'] - bd) // 2
    by = BOIS['y0'] + (BOIS['y1'] - BOIS['y0'] - bd) // 2
    scene_png = os.path.join(D, cfg['scene'])

    open('pub.dc.html', 'w').write(P.pub(h=h, red=red, badge=(bd, bx, by), h_col=505, **cfg))
    html = standalone('pub.dc.html')
    faces = faces_archivo()
    if faces:
        html = html.replace('</head>', faces + '</head>', 1)
    open('sa-pub.html', 'w').write(html)

    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel='chrome')
        pg = await b.new_page(viewport={'width': 1080, 'height': h}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto('file://' + os.path.abspath('sa-pub.html'), wait_until='load')
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(600)
        v = await pg.evaluate("""() => {
          const q = s => [...document.querySelectorAll(s)];
          const c = q('div').filter(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
          const pr = c.sort((a,b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
          const gp = q('img').find(i => (i.alt||'').includes('Google Play'));
          const tf = q('img').filter(i => (i.alt||'') === 'Taxi Food').sort((a,b) => b.width - a.width)[0];
          const lg = q('img').find(i => (i.alt||'') === 'Logo');
          const qr = q('img').find(i => (i.alt||'').includes('Scannez'));
          const ti = q('div').find(d => d.style.lineHeight === '0.98');
          const se = q('div').find(d => d.style.lineHeight === '1.26');
          const sg = q('span').find(s => s.textContent.includes('Plats du jour'));
          const B = e => Math.round(e.getBoundingClientRect().bottom);
          const R = e => { const r = e.getBoundingClientRect();
                           return [r.left, r.top, r.right, r.bottom]; };
          const Rr = e => R(e).map(Math.round);
          return {promo: B(pr), gp: B(gp), tf: B(tf), tf_w: Math.round(tf.getBoundingClientRect().width),
                  qr: qr ? 'PRESENT' : 'absent', titre: ti.textContent, titre_r: Rr(ti),
                  sec_h: Math.round(se.getBoundingClientRect().height), sec: Rr(se),
                  bas_contenu: Math.round(Math.max(...q('img,span,div').filter(e => {
                      const r = e.getBoundingClientRect(); return r.top >= 1080 && r.height > 0 && r.height < 600; })
                      .map(e => e.getBoundingClientRect().bottom))),
                  logo: R(lg), sign: R(sg),
                  police: [...document.fonts].map(f => f.family + ' ' + f.weight + ' ' + f.status),
                  texte: document.body.innerText, corps: Rr(document.body)};
        }""")
        await pg.screenshot(path=fichier, clip={'x': 0, 'y': 0, 'width': 1080, 'height': h})
        await b.close()

    ecart = v['promo'] - v['tf']
    lignes = round(v['sec_h'] / (25 * 1.26))
    masque = masque_assiettes(scene_png, 1080, ph)
    air = air_badge(masque, bx + bd / 2, by + bd / 2, bd / 2)
    deborde = v['corps'][2] > 1080 or v['corps'][3] > h
    marge = round(bd * 0.057)                    # boite de la rotation de -7 deg
    dans_bois = (bx - marge >= BOIS['x0'] and bx + bd + marge <= BOIS['x1']
                 and by - marge >= BOIS['y0'] and by + bd + marge <= BOIS['y1'])
    bord_droit = 1080 - 62 - 190 - 34
    sec_ok = v['sec'][2] <= bord_droit + 1 and v['titre_r'][2] <= bord_droit + 1

    # Le DISQUE du logo (pas le fichier, dont les cornes depassent) : meme centre
    # que celui des autres restaurants, (PAD_H + LOGO_D/2, ph - 0,52 LOGO_D + LOGO_D/2).
    lx0, ly0, lx1, ly1 = v['logo']
    cote = lx1 - lx0
    dcx, dcy = lx0 + P.LOGO_CX * cote, ly0 + P.LOGO_CY * cote
    ddiam = P.LOGO_DISQUE * cote
    ccx = P.PAD_H + P.LOGO_D / 2
    ccy = ph - round(P.LOGO_D * 0.52) + P.LOGO_D / 2
    decal_logo = float(np.hypot(dcx - ccx, dcy - ccy))
    air_logo_sign = v['sign'][1] - (ly0 + 0.999 * cote)
    marge_assiette, cellule = centres_sous_le_logo(masque, dcx, dcy, ddiam / 2)

    # LA FAUTE A NE PAS REFAIRE : le restaurant ne livre pas, Taxi Food livre.
    actif = re.search(r'\blivr(e|ent)\b', v['titre'], re.I) is not None
    passif = re.search(r'\blivr[ée]s?\b', v['titre'], re.I) is not None

    # Les prix ecrits viennent-ils de la base ?
    m = re.search(r'de\s+([\d\s  ]+?)\s*à\s*([\d\s  ]+?)\s*Ar', v['texte'])
    lus = tuple(int(re.sub(r'\D', '', x)) for x in m.groups()) if m else (0, 0)

    bas_ok = (not story) or v['bas_contenu'] <= BAS_UTILE_STORY
    ok = (bas_ok and ecart == 0 and lignes == 2 and air >= AIR_MINI and not deborde
          and dans_bois and sec_ok and v['qr'] == 'absent'
          and not actif and passif and lus == PRIX_BASE
          and decal_logo <= 1.0 and air_logo_sign >= AIR_MINI and marge_assiette > 0)
    print(fichier)
    print('  police                      : %s' % (', '.join(v['police']) or 'systeme (Archivo installee)'))
    print('  titre                       : %s' % v['titre'].replace('\n', ' / '))
    print('  tournure                    : %s   (actif interdit : %s)'
          % ('PASSIVE' if passif and not actif else 'ACTIVE — A CORRIGER', 'oui' if actif else 'non'))
    print('  fourchette de prix          : %s   (base : %s)' % (lus, PRIX_BASE))
    print('  pastille (remise)           : d=%d en (%d, %d), dans la cellule de bois : %s'
          % (bd, bx, by, 'oui' if dans_bois else 'NON'))
    print('  QR code                     : %s      (attendu absent)' % v['qr'])
    print('  logo Taxi Food              : %d px de large, bas a %d px' % (v['tf_w'], v['tf']))
    print('  ecart promo / logo Taxi Food: %+d px      (attendu 0)' % ecart)
    print('  secondaire                  : %d lignes   (attendu 2), bord droit %d (max %d)'
          % (lignes, v['sec'][2], bord_droit))
    print('  titre, bord droit           : %d px      (max %d)' % (v['titre_r'][2], bord_droit))
    if story:
        print('  bas du contenu (story)      : %d px      (max %d)' % (v['bas_contenu'], BAS_UTILE_STORY))
    print('  disque du logo Escale       : d=%.0f en (%.1f, %.1f), decalage au centre standard %.2f px (max 1)'
          % (ddiam, dcx, dcy, decal_logo))
    print('  air logo -> signature       : %6.1f px   (mini %.0f)' % (air_logo_sign, AIR_MINI))
    print('  assiette sous le logo       : centre le plus proche a %+.1f px du disque (%s) — doit etre > 0'
          % (marge_assiette, cellule))
    print("  air pastille -> 1re assiette: %6.1f px   (mini %.0f)" % (air, AIR_MINI))
    print('  debord du cadre             : %s' % ('OUI' if deborde else 'non'))
    print('  ->  %s' % ('CONFORME' if ok else 'A CORRIGER'))
    return ok


if __name__ == '__main__':
    story = '--story' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--story']
    sys.exit(0 if asyncio.run(rendre(*args, story=story)) else 1)
