"""Finition de l'export web DistriPro : page d'accueil, manifeste, icônes, Frity, redirections."""
import json, os, re, shutil, sys

dist = sys.argv[1]
ici = os.path.dirname(os.path.abspath(__file__))

# 1. Rien de Taxi Food ne doit partir sur ce domaine
for f in ['confidentialite.html', 'support.html', 'favicon.ico']:
    p = os.path.join(dist, f)
    if os.path.exists(p): os.remove(p)
shutil.rmtree(os.path.join(dist, '.well-known'), ignore_errors=True)  # liens universels Taxi Food

# 2. index.html : titre, description, couleurs, manifeste ; sans la mesure Umami de Taxi Food
p = os.path.join(dist, 'index.html')
h = open(p, encoding='utf-8').read()
h = re.sub(r'<!--.*?-->', '', h, count=1, flags=re.S)  # le long commentaire d'en-tête
h = re.sub(r'<script>\s*\(function \(\) \{\s*// Identifiant du site Umami.*?</script>\s*(<script[^>]*umami[^>]*></script>)?', '', h, flags=re.S)
assert 'umami' not in h.lower() or 'cloud.umami' not in h, 'mesure Umami Taxi Food encore présente'
h = h.replace('<title>Taxi Food</title>', '''<title>DistriPro — emballages, frites et légumes pour les pros de Nosy Be</title>
    <meta name="description" content="Commandez vos emballages alimentaires, frites fraîches Frity et légumes, livrés à Nosy Be. Paiement à la livraison." />
    <meta name="theme-color" content="#1A3B31" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="DistriPro" />
    <meta property="og:title" content="DistriPro — achat pro à Nosy Be" />
    <meta property="og:description" content="Emballages, frites fraîches Frity et légumes, livrés à Nosy Be." />''')
h = h.replace('#E8342A', '#1A3B31')
h = re.sub(r'(<div id="tf-boot-logo">)[^<]*(</div>)', r'\1D\2', h)
h = re.sub(r'(<div id="tf-boot-nom">)[^<]*(</div>)', r'\1DISTRIPRO\2', h)
open(p, 'w', encoding='utf-8').write(h)
assert 'Taxi Food' not in h, 'il reste « Taxi Food » dans index.html'

# 3. Manifeste PWA + icônes
json.dump({
  "name": "DistriPro — achat pro Nosy Be",
  "short_name": "DistriPro",
  "description": "Emballages, frites fraîches et légumes, livrés à Nosy Be.",
  "start_url": "/", "scope": "/", "display": "standalone", "orientation": "portrait",
  "background_color": "#FAFAF9", "theme_color": "#1A3B31", "lang": "fr",
  "icons": [
    {"src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}, open(os.path.join(dist, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
shutil.copytree(os.path.join(ici, 'icons'), os.path.join(dist, 'icons'), dirs_exist_ok=True)
shutil.copy(os.path.join(ici, 'favicon.png'), os.path.join(dist, 'favicon.png'))

# 4. La page Frity, servie en /frity/ (chemins relatifs : elle marche telle quelle)
shutil.copytree(os.path.join(ici, 'frity'), os.path.join(dist, 'frity'), dirs_exist_ok=True)

# 5. Redirections : /frity sans barre → /frity/ ; tout le reste → l'app (page unique)
open(os.path.join(dist, '_redirects'), 'w').write(
  "/frity    /frity/    301\n"
  "/frity/*  /frity/:splat  200\n"
  "/*        /index.html  200\n")
open(os.path.join(dist, '_headers'), 'w').write(
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n"
  "/manifest.webmanifest\n  Content-Type: application/manifest+json\n")
open(os.path.join(dist, 'robots.txt'), 'w').write("User-agent: *\nAllow: /\nSitemap: https://distripro207.com/sitemap.xml\n")
open(os.path.join(dist, 'sitemap.xml'), 'w').write(
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  '  <url><loc>https://distripro207.com/</loc><changefreq>daily</changefreq></url>\n'
  '  <url><loc>https://distripro207.com/frity/</loc><changefreq>monthly</changefreq></url>\n</urlset>\n')
print('export DistriPro fini :', dist)
