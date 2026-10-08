# -*- coding: utf-8 -*-
"""Posts « Pas de tacos ce soir… mais des burgers ! » (2026-10-08).

La Cabane, seule a faire des tacos, est fermee exceptionnellement ce soir.
Un post par restaurant qui sert des burgers CE SOIR, avec son vrai burger
(photo du catalogue, bucket `produits/`) et son vrai logo. Aucun texte ni
logo dessine par un modele : tout est pose ici en HTML.

Prix et horaires relus en base le 2026-10-08 (products, restaurant_hours,
jeudi). Ne rien changer a la main sans relire la base.

Rendu + controles :  python3 burgers_ce_soir.py   (depuis ce dossier)
"""
import asyncio, importlib.util, os, sys

D = os.path.dirname(os.path.abspath(__file__))
R = os.path.dirname(D)
sys.path.insert(0, R)
os.chdir(D)
from mesure import standalone
sp = importlib.util.spec_from_file_location('g', os.path.join(R, 'gabarit.py'))
g = importlib.util.module_from_spec(sp); sp.loader.exec_module(g)

W, H = 1080, 1350          # 4:5, fil Facebook / Instagram
MARGE = 72
PHOTO_Y, PHOTO_H = 380, 680
BANDE_Y = 1030             # le bandeau du bas recouvre le bas de la photo

POSTS = [
    dict(slug='siciliens', resto='Les Siciliens', logo='logo-siciliens.png',
         photo='sic-big.png', pos='50% 46%', plat='Big Cheeseburger',
         prix='32 000 Ar', horaire='Ce soir 18h – 20h50'),
    dict(slug='bidule', resto='Chez Bidule &amp; Truc', logo='logo-bidul.jpeg',
         photo='bid-patron.png', pos='50% 46%', plat='Le Patron',
         prix='29 000 Ar', horaire='Ce soir 19h – 21h45'),
    dict(slug='nandipo', resto='Le Nandipo', logo='logo-nandipo.png',
         photo='nan-hamburger.jpg', pos='50% 36%', plat='Hamburger',
         prix='28 000 Ar', horaire='Ce soir jusqu’à 21h45'),
]


def post(p):
    return g.HEAD + f'''<div id="cadre" style="position: relative; width: {W}px; height: {H}px;
     background: {g.ENCRE}; overflow: hidden;">

  <img src="{p['photo']}" alt="" style="position: absolute; left: 0; top: {PHOTO_Y}px; width: {W}px;
       height: {PHOTO_H}px; object-fit: cover; object-position: {p['pos']}; display: block;">
  <div style="position: absolute; left: 0; top: {PHOTO_Y}px; width: {W}px; height: 170px;
       background: linear-gradient(to bottom, {g.ENCRE} 0%, rgba(19,19,19,0) 100%);"></div>
  <div style="position: absolute; left: 0; top: {BANDE_Y - 150}px; width: {W}px; height: 150px;
       background: linear-gradient(to top, {g.ENCRE} 0%, rgba(19,19,19,0) 100%);"></div>

  <div id="haut" style="position: absolute; left: {MARGE}px; top: 74px; width: {W - 2*MARGE}px;">
    <div style="font-size: 26px; font-weight: 800; letter-spacing: 4px; color: {g.OR};
         text-transform: uppercase; white-space: nowrap;">Ce soir à Nosy Be</div>
    <div id="t1" class="ligne" style="margin-top: 18px; font-size: 86px; font-weight: 900; line-height: 1.0;
         letter-spacing: -2.4px; color: #FFFFFF; white-space: nowrap;">Pas de tacos ce soir…</div>
    <div id="t2" class="ligne" style="font-size: 86px; font-weight: 900; line-height: 1.0;
         letter-spacing: -2.4px; color: #FFFFFF; white-space: nowrap;">mais des <span style="color: {g.OR};">burgers&nbsp;!</span></div>
    <div id="st" class="ligne" style="margin-top: 20px; font-size: 30px; font-weight: 500;
         color: rgba(255,255,255,0.80); white-space: nowrap;">La Cabane est fermée exceptionnellement ce soir.</div>
  </div>

  <div id="bas" style="position: absolute; left: 0; top: {BANDE_Y}px; width: {W}px; height: {H - BANDE_Y}px;
       background: {g.ENCRE};">
    <div style="position: absolute; left: {MARGE}px; top: 0; display: flex; align-items: center; gap: 30px;">
      <div style="width: 170px; height: 170px; border-radius: 50%; background: #FFFFFF; overflow: hidden;
           flex: 0 0 auto; box-shadow: 0 10px 26px rgba(0,0,0,0.5);">
        <img src="{p['logo']}" alt="Logo {p['resto']}" style="width: 170px; height: 170px; object-fit: cover; display: block;">
      </div>
      <div id="infos" style="display: flex; flex-direction: column; align-items: flex-start;">
        <div class="ligne" style="font-size: 54px; font-weight: 900; color: #FFFFFF; letter-spacing: -1px;
             white-space: nowrap; line-height: 1.05;">{p['plat']}</div>
        <div style="margin-top: 12px; display: flex; align-items: center; gap: 16px;">
          <span style="background: {g.OR}; color: {g.ENCRE}; font-size: 32px; font-weight: 900;
                border-radius: 10px; padding: 6px 16px; white-space: nowrap;">{p['prix']}</span>
          <span class="ligne" style="font-size: 30px; font-weight: 700; color: #FFFFFF; white-space: nowrap;">{p['resto']}</span>
        </div>
        <div class="ligne" style="margin-top: 12px; font-size: 26px; font-weight: 500;
             color: rgba(255,255,255,0.72); white-space: nowrap;">{p['horaire']}</div>
      </div>
    </div>

    <div id="pied" style="position: absolute; left: {MARGE}px; right: {MARGE}px; bottom: 48px;
         display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center; gap: 16px;">
        <img src="taxifood.png" alt="Taxi Food" style="height: 64px; width: auto; border-radius: 14px; display: block;">
        <span style="font-size: 22px; font-weight: 800; letter-spacing: 3px; color: {g.OR};
              text-transform: uppercase; white-space: nowrap;">Commande sur Taxi Food</span>
      </div>
      {g._stores_tiktok(0.86)}
    </div>
  </div>
''' + g.FOOT


# Archivo, la police de la charte, embarquee : sans elle le navigateur retombe
# sur Helvetica (les Google Fonts sont coupees au rendu).
FONTES = os.path.join(R, '..', 'app', 'node_modules', '@expo-google-fonts', 'archivo')
CHROMIUM = os.environ.get('TF_CHROMIUM') or next(
    (os.path.join(r, f) for r, _, fs in os.walk(os.path.expanduser('~/Library/Caches/ms-playwright'))
     for f in fs if f == 'chrome-headless-shell' or f == 'headless_shell'), None)


def avec_fontes(html):
    import base64
    css = ''
    for poids, nom in ((500, 'Medium'), (700, 'Bold'), (800, 'ExtraBold'), (900, 'Black')):
        f = os.path.join(FONTES, f'{poids}{nom}', f'Archivo_{poids}{nom}.ttf')
        b = base64.b64encode(open(f, 'rb').read()).decode()
        css += f"@font-face{{font-family:Archivo;font-weight:{poids};src:url(data:font/ttf;base64,{b});}}"
    return html.replace('<style>', '<style>' + css, 1)


async def rendre():
    from playwright.async_api import async_playwright
    tout_ok = True
    async with async_playwright() as pw:
        b = await pw.chromium.launch(executable_path=CHROMIUM)
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        await pg.route('**://fonts.g**', lambda r: r.abort())
        for p in POSTS:
            dc = f"post-{p['slug']}.dc.html"
            open(dc, 'w').write(post(p))
            open(f"sa-{p['slug']}.html", 'w').write(avec_fontes(standalone(dc)))
            await pg.goto(f"file://{os.path.abspath('sa-' + p['slug'] + '.html')}", wait_until='load')
            await pg.evaluate('document.fonts.ready')
            await pg.wait_for_timeout(400)
            v = await pg.evaluate(f"""() => {{
              const r = e => e.getBoundingClientRect();
              let deb = [];
              // Le contenu seulement : les fonds (photo, degrades, bandeau) debordent expres.
              for (const e of document.querySelectorAll('#haut, #haut *, #bas *')) {{
                const b = r(e); if (b.width < 1) continue;
                if (b.left < {MARGE - 2} || b.right > {W - MARGE + 2} || b.bottom > {H}) deb.push(e.textContent.trim().slice(0,30) || e.tagName);
              }}
              const lignes = [...document.querySelectorAll('.ligne')].filter(e => e.scrollWidth > e.clientWidth + 1 || r(e).height > parseFloat(getComputedStyle(e).fontSize) * 1.5).map(e => e.textContent.trim());
              return {{deb, lignes, hautBas: Math.round(r(document.getElementById('haut')).bottom),
                       infosBas: Math.round(r(document.getElementById('infos')).bottom),
                       piedHaut: Math.round(r(document.getElementById('pied')).top),
                       w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight}};
            }}""")
            sortie = f"POST-burgers-ce-soir-{p['slug']}.png"
            await pg.screenshot(path=sortie, clip={'x': 0, 'y': 0, 'width': W, 'height': H})
            c1 = not v['deb']
            c2 = not v['lignes']
            c3 = v['hautBas'] <= PHOTO_Y + 40          # le titre ne descend pas sur le burger
            c4 = v['piedHaut'] - v['infosBas'] >= 20    # air entre infos et pied
            c5 = v['w'] == W and v['h'] == H
            ok = c1 and c2 and c3 and c4 and c5
            tout_ok &= ok
            print(sortie)
            print(f"  1 marges      {'ok' if c1 else 'NON ' + str(v['deb'])}")
            print(f"  2 une ligne   {'ok' if c2 else 'NON ' + str(v['lignes'])}")
            print(f"  3 titre       bas {v['hautBas']} <= {PHOTO_Y + 40}  {'ok' if c3 else 'NON'}")
            print(f"  4 air pied    {v['piedHaut'] - v['infosBas']} px  {'ok' if c4 else 'NON'}")
            print(f"  5 cadre       {v['w']} x {v['h']}  {'ok' if c5 else 'NON'}")
            print(f"  ->  {'CONFORME' if ok else 'A CORRIGER'}")
        await b.close()
    return tout_ok


if __name__ == '__main__':
    sys.exit(0 if asyncio.run(rendre()) else 1)
