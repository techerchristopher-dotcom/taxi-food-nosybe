# -*- coding: utf-8 -*-
"""Decoupe la carte verticale en calques transparents, pour le montage.

Pourquoi des calques et pas une image : au montage la carte n'apparait pas d'un
bloc. La bande monte, la pastille se pose, le badge tombe. Trois gestes, donc
trois images — mais toutes issues du MEME html que la carte fixe, sinon la
video et la publication ne disent plus la meme chose au pixel pres.

Chaque calque fait 1080 x 1920 avec fond transparent. Dans Remotion ils se
posent tous en (0,0) : aucun calcul de decalage, donc aucune derive possible.

  L01 bande · L02 pastille resto · L03 titre · L04 description · L05 prix
  L06 ligne resto · L07 disque or · L08 « -50 % » · L09 pastille du code
  L10 bloc noir · L11 stores · L12 url

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

# Chaque element animable porte un ROLE, grave une fois dans le DOM. Les roles
# du premier niveau se deduisent du style ; ceux du badge et de la colonne se
# deduisent du rang, parce que ce sont des suites ordonnees que le gabarit ecrit
# toujours dans le meme ordre.
#
# La visibilite est HERITEE : masquer la colonne puis rendre le titre visible
# donne bien le titre seul, sans son contexte. C'est ce qui permet de sortir le
# « -50 % » sans son disque, et le disque sans son « -50 % ».
ROLES_BADGE   = ['badge-commande', 'badge-remise', 'badge-livraison', 'badge-code']
ROLES_COLONNE = ['eyebrow', 'titre', 'desc', 'prix', 'lieu', 'promo', 'liens']
ROLES_LIENS   = ['stores', 'url']


def _js():
    """Masquage par role, avec les vraies mesures du gabarit."""
    return f"""(garder) => {{
  const box = document.querySelector('x-dc > div') || document.body.querySelector('div');
  const vieux = document.getElementById('_bande'); if (vieux) vieux.remove();

  if (!box.dataset.etiquete) {{
    // Le role est calcule UNE fois. Toucher a e.style reserialise l'attribut
    // et convertit #FFFFFF en rgb(255, 255, 255) : au deuxieme appel la
    // pastille devenait un badge, et sans la moindre erreur.
    const haut = e => {{
      const s = e.getAttribute('style') || '';
      const blanc = s.includes('#FFFFFF') || s.includes('rgb(255, 255, 255)');
      if (s.includes('border-radius: 50%') && blanc) return 'pastille';
      if (s.includes('border-radius: 50%')) return 'badge';
      if (s.includes('flex-direction: column')) return 'colonne';
      if (s.includes('height: {g.FILET}px')) return 'filet';
      return 'fond';
    }};
    const suite = (parent, noms) =>
      [...parent.children].forEach((e, i) => {{ if (noms[i]) e.dataset.role = noms[i]; }});

    [...box.children].forEach(e => {{ e.dataset.role = haut(e); }});
    const badge   = [...box.children].find(e => e.dataset.role === 'badge');
    const colonne = [...box.children].find(e => e.dataset.role === 'colonne');
    if (badge)   suite(badge,   {ROLES_BADGE});
    if (colonne) suite(colonne, {ROLES_COLONNE});
    const liens = colonne && [...colonne.children].find(e => e.dataset.role === 'liens');
    if (liens)  suite(liens, {ROLES_LIENS});
    box.dataset.etiquete = '1';
  }}

  const tous = [...box.querySelectorAll('[data-role]')];
  tous.forEach(e => {{
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
  return tous.map(e => e.dataset.role);
}}"""


# Douze calques, douze gestes. L'ordre du plan n'est pas l'ordre de la page :
# le titre arrive avant le badge, parce qu'on dit ce que c'est avant de dire
# combien on enleve.
PLAN = [
    ('L01-bande',    ['filet']),
    ('L02-pastille', ['pastille']),
    ('L03-titre',    ['eyebrow', 'titre']),
    ('L04-desc',     ['desc']),
    ('L05-prix',     ['prix']),
    ('L06-lieu',     ['lieu']),
    # le disque et son contexte, SANS le nombre ni le code : ils atterrissent
    # dans une phrase deja posee (« 1re commande ... sur la livraison »)
    ('L07-disque',   ['badge', 'badge-commande', 'badge-livraison']),
    ('L08-remise',   ['badge-remise']),
    ('L09-code',     ['badge-code']),
    ('L10-promo',    ['promo']),
    ('L11-stores',   ['stores']),
    ('L12-url',      ['url']),
]


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

    plan = PLAN

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
