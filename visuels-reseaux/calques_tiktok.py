# -*- coding: utf-8 -*-
"""Decoupe la carte verticale en calques transparents, pour le montage.

Pourquoi des calques et pas une image : au montage la carte n'apparait pas d'un
bloc. La bande monte, la pastille se pose, le badge tombe. Trois gestes, donc
trois images — mais toutes issues du MEME html que la carte fixe, sinon la
video et la publication ne disent plus la meme chose au pixel pres.

Chaque calque fait 1080 x 1920 avec fond transparent. Dans Remotion ils se
posent tous en (0,0) : aucun calcul de decalage, donc aucune derive possible.

  L1-bande.png     le rouge sous le filet or
  L2-texte.png     la colonne : titre, prix, lieu, promo, stores, url
  L3-pastille.png  le disque du restaurant, a cheval sur le filet
  L4-badge.png     la pastille -50 %

Le plat et le fond ne sont dans aucun calque : ils viennent du clip.
"""
import asyncio, importlib.util, json, os, sys

D = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, D)
TRAVAIL = os.path.abspath(os.environ.get('TF_TRAVAIL', D))
os.chdir(TRAVAIL)
from mesure import standalone

spec = importlib.util.spec_from_file_location('g', os.path.join(D, 'gabarit.py'))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

# Les enfants du conteneur sont designes par ce qu'ils SONT, pas par leur rang :
# avec plat=None il n'y a pas d'image de plat, tous les index glissent d'un cran,
# et on exporte le mauvais calque sans la moindre erreur.
def _js():
    """Masquage par role, avec les vraies mesures du gabarit."""
    return f"""(garder) => {{
  const box = document.querySelector('x-dc > div') || document.body.querySelector('div');
  const vieux = document.getElementById('_bande'); if (vieux) vieux.remove();
  // Le role est calcule UNE fois et grave dans l'element. Toucher a e.style
  // reserialise l'attribut et convertit #FFFFFF en rgb(255, 255, 255) : au
  // deuxieme appel la pastille devenait un badge, et sans la moindre erreur.
  const role = e => {{
    const s = e.getAttribute('style') || '';
    const blanc = s.includes('#FFFFFF') || s.includes('rgb(255, 255, 255)');
    if (s.includes('border-radius: 50%') && blanc) return 'pastille';
    if (s.includes('border-radius: 50%')) return 'badge';
    if (s.includes('flex-direction: column')) return 'colonne';
    if (s.includes('height: {g.FILET}px')) return 'filet';
    return 'fond';
  }};
  const vus = [];
  [...box.children].forEach(e => {{
    if (!e.dataset.role) e.dataset.role = role(e);
    vus.push(e.dataset.role);
    e.style.visibility = garder.includes(e.dataset.role) ? 'visible' : 'hidden';
  }});
  // Le rouge est le fond du CONTENEUR, pas un enfant : il couvrirait la scene.
  box.style.background = 'transparent';
  if (garder.includes('filet')) {{
    const d = document.createElement('div');
    d.id = '_bande';
    d.style.cssText = 'position:absolute; left:0; top:{g.TT_SCENE_H + g.FILET}px;'
                    + 'width:{g.TT_W}px; height:{g.TT_H - g.TT_SCENE_H - g.FILET}px;'
                    + 'background:{g.ROUGE}; z-index:0;';
    box.insertBefore(d, box.firstChild);
  }}
  return vus;
}}"""


async def calques(slug, titre, secondaire, prix, lieu, logo):
    from playwright.async_api import async_playwright
    # Meme html que la carte fixe, mais SANS le plat : il vient du clip.
    open(f'calq-{slug}.dc.html', 'w').write(
        g.visuel_tiktok(titre=titre, secondaire=secondaire, prix=prix,
                        ligne_lieu=lieu, logo=logo, plat=None,
                        fond=g.FONDS[g.SERIE_TIKTOK['fond']],
                        badge=g.SERIE_TIKTOK['badge']))
    open(f'sa-calq-{slug}.html', 'w').write(standalone(f'calq-{slug}.dc.html'))
    js = _js()

    # Quatre calques, quatre gestes. La bande et le texte sont separes : une
    # bande qui monte avec son texte deja dessus arrive d'un bloc, et on ne lit
    # plus rien. Le texte suit, une fois la bande posee.
    plan = [('L1-bande',    ['filet']),
            ('L2-texte',    ['colonne']),
            ('L3-pastille', ['pastille']),
            ('L4-badge',    ['badge'])]

    async with async_playwright() as pw:
        b = await pw.chromium.launch()
        pg = await b.new_page(viewport={'width': g.TT_W, 'height': g.TT_H},
                              device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        await pg.goto(f'file://{os.path.abspath(f"sa-calq-{slug}.html")}', wait_until='load')
        await pg.wait_for_timeout(500)
        await pg.add_style_tag(content='html,body{background:transparent !important;}')
        for nom, garder in plan:
            vus = await pg.evaluate(js, garder)
            manquants = [r for r in garder if r not in vus]
            if manquants:
                raise SystemExit(f'{nom} : role(s) introuvable(s) {manquants} — vu {vus}')
            await pg.screenshot(path=f'{nom}-{slug}.png', omit_background=True,
                                clip={'x': 0, 'y': 0, 'width': g.TT_W, 'height': g.TT_H})
            print(f'  {nom}-{slug}.png   roles {vus} -> gardes {garder}')
        await b.close()

    # Le geometrie que Remotion doit connaitre, ecrite ici pour ne pas etre
    # retapee a la main de l'autre cote.
    geo = dict(w=g.TT_W, h=g.TT_H, scene=g.TT_SCENE_H, filet=g.FILET,
               bande_h=g.TT_H - g.TT_SCENE_H, safe=g.TT_SAFE)
    json.dump(geo, open(f'geo-{slug}.json', 'w'), indent=2)
    print(f'  geo-{slug}.json  {geo}')


ORIENTAL = dict(slug='oriental', titre='Oriental',
                secondaire='Merguez, viande hachée, poivron, œuf', prix='31 000 Ar',
                lieu='Chez Bidul &amp; Truc · au feu de bois · le soir, 7 j/7',
                logo='bidul.jpg')

if __name__ == '__main__':
    asyncio.run(calques(**ORIENTAL))
