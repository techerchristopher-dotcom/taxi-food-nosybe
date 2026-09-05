/**
 * Pages de partage : /p/<id> (un produit) et /r/<id> (un restaurant).
 *
 * ── Pourquoi une fonction et pas une page statique ────────────────────────────
 * L'aperçu affiché par WhatsApp, Messenger ou Facebook est construit par un
 * ROBOT qui télécharge la page et lit ses balises `og:`. Ce robot n'exécute
 * AUCUN JavaScript. Une page qui irait chercher le produit dans Supabase côté
 * navigateur afficherait donc, pour le robot, une page vide : lien nu, sans
 * photo ni nom. Les balises doivent être présentes dans le HTML livré — d'où
 * cette fonction, qui interroge Supabase côté serveur.
 *
 * ── Ce que voit chaque visiteur ───────────────────────────────────────────────
 * - App installée → le lien n'arrive jamais ici : iOS et Android l'ouvrent
 *   directement dans l'app (Universal Links / App Links).
 * - Pas d'app → cette page, avec la photo et le prix, puis un bouton qui envoie
 *   vers l'App Store ou le Play Store selon le téléphone.
 * - Robot d'aperçu → les balises `og:`, et rien d'autre à faire.
 *
 * ⚠️ Après installation, l'app s'ouvre sur l'ACCUEIL, pas sur le produit
 * partagé. Ni iOS ni Android ne transmettent le lien d'origine à une app
 * fraîchement installée (« deferred deep linking ») ; l'obtenir demande un
 * service tiers payant. Limite assumée, à rouvrir si l'usage le réclame.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SITE = 'https://taxifood.rentanoo.com';
const APP_STORE = 'https://apps.apple.com/app/id6802418114';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.chris97416.taxifoodnosybe';
const OG_DEFAUT = `${SITE}/og/taxi-food-nosy-be.jpg`;

const echapper = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 12 000 → « 12 000 Ar ». Même présentation que `formatAr` dans l'app. */
const formatAr = (n) =>
  typeof n === 'number' ? `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} Ar` : '';

async function supabase(chemin) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j[0] ?? null : j;
}

function page({ titre, description, image, lien, prix }) {
  const t = echapper(titre);
  const d = echapper(description);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} — Taxi Food</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${echapper(lien)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Taxi Food">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${echapper(image)}">
<meta property="og:url" content="${echapper(lien)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${echapper(image)}">
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#FFF8F0; color:#1A1A1A; display:flex; justify-content:center; }
  main { width:100%; max-width:520px; padding:24px 20px 40px; }
  .visuel { width:100%; aspect-ratio:16/10; object-fit:cover; border-radius:20px; background:#F0E6DA; display:block; }
  h1 { font-size:26px; line-height:1.2; margin:20px 0 6px; }
  .prix { font-size:22px; font-weight:700; color:#E8590C; margin:0 0 12px; }
  p { color:#5C554E; line-height:1.5; margin:0 0 24px; }
  a.cta { display:block; text-align:center; background:#E8590C; color:#fff; text-decoration:none;
          font-weight:600; font-size:17px; padding:16px; border-radius:999px; }
  a.sec { display:block; text-align:center; color:#5C554E; text-decoration:none; font-size:14px; margin-top:16px; }
  footer { margin-top:32px; font-size:12px; color:#8A827A; text-align:center; }
</style>
</head>
<body>
<main>
  <img class="visuel" src="${echapper(image)}" alt="${t}">
  <h1>${t}</h1>
  ${prix ? `<p class="prix">${echapper(prix)}</p>` : ''}
  <p>${d}</p>
  <a class="cta" id="cta" href="${APP_STORE}">Ouvrir dans Taxi&nbsp;Food</a>
  <a class="sec" href="${SITE}/">Découvrir Taxi Food</a>
  <footer>Livraison de repas à Nosy Be</footer>
</main>
<script>
  // Le bouton mène au store du téléphone qui consulte la page. Quelqu'un qui a
  // déjà l'app n'arrive jamais ici : le lien s'ouvre dans l'app en amont.
  if (/android/i.test(navigator.userAgent)) {
    document.getElementById('cta').href = ${JSON.stringify(PLAY_STORE)};
  }
</script>
</body>
</html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(p|r)\/([0-9a-f-]{36})\/?$/i);

  // Identifiant absent ou mal formé : on renvoie sur l'accueil du site plutôt
  // que d'afficher une erreur — un lien tronqué dans une conversation reste
  // ainsi utile.
  if (!m) return Response.redirect(`${SITE}/`, 302);
  const [, genre, id] = m;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[partage] SUPABASE_URL / SUPABASE_ANON_KEY absents des variables Netlify');
    return Response.redirect(`${SITE}/`, 302);
  }

  try {
    let vue;
    if (genre === 'p') {
      const p = await supabase(
        `products?id=eq.${id}&is_available=eq.true&select=id,name,description,price,photo_url,restaurants(name)`);
      if (!p) return Response.redirect(`${SITE}/`, 302);
      const resto = p.restaurants?.name;
      vue = {
        titre: p.name,
        prix: formatAr(p.price),
        description: p.description || (resto ? `À commander chez ${resto} sur Taxi Food.` : 'À commander sur Taxi Food.'),
        image: p.photo_url || OG_DEFAUT,
        lien: `${SITE}/p/${id}`,
      };
    } else {
      // ⚠️ `restaurants` n'a PAS de colonne `description` (vérifié en base le
      // 2026-09-05) : la demander renvoie un 400 PostgREST, et la page tombe
      // silencieusement sur l'accueil. Le descriptif se compose à partir du type
      // de cuisine et de la zone livrée.
      const r = await supabase(
        `restaurants?id=eq.${id}&select=id,name,cuisine_type,zone_served,delivery_fee,cover_url,logo_url`);
      if (!r) return Response.redirect(`${SITE}/`, 302);
      const ou = r.zone_served ? ` — livré à ${r.zone_served}` : ' à Nosy Be';
      vue = {
        titre: r.name,
        prix: typeof r.delivery_fee === 'number' ? `Livraison ${formatAr(r.delivery_fee)}` : '',
        description: `${r.cuisine_type ? r.cuisine_type + '. ' : ''}Commandez${ou} avec Taxi Food.`,
        image: r.cover_url || r.logo_url || OG_DEFAUT,
        lien: `${SITE}/r/${id}`,
      };
    }
    return new Response(page(vue), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Court : un prix ou une photo qui change doit se voir vite dans les
        // aperçus, mais on évite de retaper Supabase à chaque robot.
        'cache-control': 'public, max-age=300, s-maxage=300',
      },
    });
  } catch (e) {
    console.error('[partage]', e);
    return Response.redirect(`${SITE}/`, 302);
  }
};

export const config = { path: ['/p/:id', '/r/:id'] };
