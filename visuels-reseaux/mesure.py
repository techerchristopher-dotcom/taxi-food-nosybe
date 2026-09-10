import re, os, base64, json, sys, asyncio
from playwright.async_api import async_playwright
D = os.path.dirname(os.path.abspath(__file__))
# Les images se cherchent d'abord dans le dossier de travail (les det-<slug>.png),
# puis dans assets/ (logo Taxi Food, badges, QR, logos restaurants).
CHEMINS = ['.', os.path.join(D, 'assets'), D]

def standalone(path):
    s = open(path).read()
    s = re.sub(r'<script src="\./support\.js"></script>', '', s)
    s = re.sub(r'<x-dc>\s*<helmet>(.*?)</helmet>', r'\1', s, flags=re.S)
    s = s.replace('</x-dc>', '')
    s = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>', '', s)
    def inline(m):
        f = m.group(1)
        if f.startswith('data:') or f.startswith('http'): return m.group(0)
        p = next((os.path.join(d, os.path.basename(f)) for d in CHEMINS
                  if os.path.exists(os.path.join(d, os.path.basename(f)))), None)
        if p is None: print('MANQUE', f, 'dans', path); return m.group(0)
        ext = os.path.splitext(p)[1].lower().lstrip('.')
        mt = {'jpg':'jpeg','jpeg':'jpeg','png':'png','svg':'svg+xml'}.get(ext, ext)
        b = base64.b64encode(open(p,'rb').read()).decode()
        return f'src="data:image/{mt};base64,{b}"'
    return re.sub(r'src="([^"]+)"', inline, s)

async def main(fichiers):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1080,'height':1920})
        await pg.route('**://fonts.googleapis.com/**', lambda r: r.abort())
        await pg.route('**://fonts.gstatic.com/**', lambda r: r.abort())
        out = {}
        for f in fichiers:
            nom = f.replace('.dc.html','')
            html = standalone(f)
            sa = os.path.join(os.getcwd(), f'sa-{nom}.html')
            open(sa,'w').write(html)
            await pg.goto('file://'+sa, wait_until='load')
            await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => {
              const q = s => document.querySelector(s);
              const promo = [...document.querySelectorAll('div')].find(d => d.textContent.trim().startsWith('1re commande') && d.style.borderRadius);
              const imgs = [...document.querySelectorAll('img')];
              const gp = imgs.find(i => (i.alt||'').includes('Google Play'));
              const as = imgs.find(i => (i.alt||'').includes('App Store'));
              const qr = imgs.find(i => (i.alt||'').includes('Scannez'));
              const url = [...document.querySelectorAll('span')].find(s => s.textContent.includes('distripro207'));
              const bx = e => e ? [Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().bottom)] : null;
              return {promo: bx(promo), gp: bx(gp), as: bx(as), qr: bx(qr), url: bx(url)};
            }""")
            out[nom] = r
        await b.close()
        for k, v in out.items():
            pb = v['promo'][1] if v['promo'] else None
            gb = v['gp'][1] if v['gp'] else None
            print(f"{k:14s} promo_bas={pb}  gp_bas={gb}  ecart={None if (pb is None or gb is None) else pb-gb}  qr_haut={v['qr'][0] if v['qr'] else None}  url_bas={v['url'][1] if v['url'] else None}")

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
