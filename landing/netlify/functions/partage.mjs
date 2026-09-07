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

const SITE = 'https://taxifoodnosybe.distripro207.com';
const APP_STORE = 'https://apps.apple.com/app/id6802418114';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.chris97416.taxifoodnosybe';

// L'APPLICATION WEB — a ne pas confondre avec SITE, qui est la vitrine.
// C'est elle qui permet de commander SANS RIEN INSTALLER, sur n'importe quel
// appareil. C'est donc la vraie destination d'un lien partage.
const APP = 'https://taxifood.distripro207.com';

// ⚠️ TANT QUE GOOGLE N'A PAS VALIDE, LA FICHE PLAY N'EXISTE PAS.
// Verifie le 2026-09-07 : l'URL ci-dessus repond **404 « We're sorry, the
// requested URL was not found »**. Le bouton y envoyait pourtant tout visiteur
// Android — c'est-a-dire la majorite des telephones a Nosy Be. Un client qui
// recoit un plat par WhatsApp, clique, et tombe sur une page Google morte est
// un client perdu, et personne ne le sait.
// Passer a `true` LE JOUR de la publication, pas avant.
const PLAY_PUBLIE = false;
const OG_DEFAUT = `${SITE}/og/taxi-food-nosy-be.jpg`;

/**
 * Image d'apercu, redimensionnee pour les robots de WhatsApp et Facebook.
 *
 * ⚠️ CONSTATE LE 2026-09-07 : l'apercu WhatsApp n'affichait AUCUNE image. La
 * cause n'etait pas la balise mais le POIDS — `og:image` pointait sur le fichier
 * d'origine, un PNG de **1,38 Mo**. Au-dela de quelques centaines de kilo-octets
 * le robot abandonne l'image sans rien dire, et le partage perd exactement ce
 * qui le rend efficace : la photo du plat.
 *
 * 600x315 est le format minimal que Facebook documente pour un grand apercu.
 * Le transformateur Supabase rend alors ~270 Ko en PNG, et ~30 Ko en WebP pour
 * les robots qui l'acceptent.
 *
 * ⚠️ `quality` n'a AUCUN effet sur un PNG, et `format=jpeg` n'existe pas cote
 * Supabase (verifie : 400). C'est donc la TAILLE qui fait tout le travail — ne
 * pas la remonter en croyant gagner en nettete.
 *
 * ⚠️ Ne reecrit que les URL du stockage Supabase : l'image par defaut vit sur le
 * site et n'a pas de transformateur.
 */
const OBJET = '/storage/v1/object/public/';
function apercuImage(url) {
  const u = String(url ?? '');
  const i = u.indexOf(OBJET);
  if (i < 0) return u;
  return `${u.slice(0, i)}/storage/v1/render/image/public/${u.slice(i + OBJET.length)}`
    + '?width=600&height=315&resize=cover&quality=70';
}

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


/**
 * Renvoi vers l'accueil, JAMAIS mis en cache.
 *
 * ⚠️ `Response.redirect()` ne pose aucun en-tête de cache, et les navigateurs
 * mémorisent alors la redirection : quelqu'un qui ouvre un lien pendant une
 * panne momentanée de cette fonction reste renvoyé sur l'accueil ensuite, même
 * une fois la panne réparée — et un rechargement ordinaire n'y change rien.
 * Constaté en vrai le 2026-09-05, sur le premier lien partagé.
 */
function versAccueil() {
  return new Response(null, {
    status: 302,
    headers: { location: `${SITE}/`, 'cache-control': 'no-store, max-age=0' },
  });
}

function page({ titre, description, image, lien, prix, commander }) {
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
<meta property="og:image" content="${echapper(apercuImage(image))}">
<meta property="og:image:secure_url" content="${echapper(apercuImage(image))}">
<meta property="og:image:width" content="600">
<meta property="og:image:height" content="315">
<meta property="og:image:alt" content="${t}">
<meta property="og:url" content="${echapper(lien)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${echapper(apercuImage(image))}">
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
  /* ⚠️ Le telechargement est un CHOIX, pas une note de bas de page. Il etait
     rendu comme un lien gris de 14 px sous le bouton rouge : personne ne le
     lisait comme une action. Meme forme, meme hauteur, meme graisse que le
     bouton principal — seule la couleur dit lequel est le chemin conseille. */
  a.cta2 { display:block; text-align:center; margin-top:12px; background:#fff; color:#DF3228;
           border:2px solid #DF3228; text-decoration:none; font-weight:600; font-size:17px;
           padding:14px; border-radius:999px; }
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
  <a class="cta" href="${echapper(commander)}">Commander maintenant</a>
  <a class="cta2" id="app" href="${APP_STORE}" hidden>Télécharger l’application</a>
  <a class="sec" href="${SITE}/">Découvrir Taxi Food</a>
  <footer>Livraison de repas à Nosy Be</footer>
</main>
<script>
  // ⚠️ LE BOUTON PRINCIPAL NE MENE PLUS A UN STORE.
  // Il menait a l'App Store par defaut, bascule sur Google Play si le navigateur
  // etait Android. Deux consequences, les deux mauvaises : sur ORDINATEUR on
  // atterrissait sur une fiche « Only for iPhone », impossible a installer ; sur
  // ANDROID, sur une page Google Play qui n'existe pas encore (404).
  // Le lien partage sert a FAIRE COMMANDER, pas a faire installer. L'application
  // web fonctionne sur tous les appareils, sans rien installer : c'est elle la
  // destination. Le telechargement devient un choix secondaire, et n'est propose
  // QUE la ou le magasin a vraiment l'application.
  (function () {
    var ua = navigator.userAgent || '';
    var android = /android/i.test(ua);
    // iPad recent se declare « Macintosh » : le nombre de points de contact
    // le distingue d'un vrai Mac. Piege deja rencontre sur /telegram/.
    var ios = /iPhone|iPod/i.test(ua)
      || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var lien = document.getElementById('app');
    if (android) {
      if (${JSON.stringify(PLAY_PUBLIE)}) { lien.href = ${JSON.stringify(PLAY_STORE)}; lien.hidden = false; }
    } else if (ios) {
      lien.hidden = false;
    }
  })();
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
  if (!m) return versAccueil();
  const [, genre, id] = m;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[partage] SUPABASE_URL / SUPABASE_ANON_KEY absents des variables Netlify');
    return versAccueil();
  }

  try {
    let vue;
    if (genre === 'p') {
      const p = await supabase(
        `products?id=eq.${id}&is_available=eq.true&select=id,name,description,price,photo_url,restaurants(name)`);
      if (!p) return versAccueil();
      const resto = p.restaurants?.name;
      vue = {
        titre: p.name,
        prix: formatAr(p.price),
        description: p.description || (resto ? `À commander chez ${resto} sur Taxi Food.` : 'À commander sur Taxi Food.'),
        image: p.photo_url || OG_DEFAUT,
        lien: `${SITE}/p/${id}`,
        commander: `${APP}/product/${id}`,
      };
    } else {
      // ⚠️ `restaurants` n'a PAS de colonne `description` (vérifié en base le
      // 2026-09-05) : la demander renvoie un 400 PostgREST, et la page tombe
      // silencieusement sur l'accueil. Le descriptif se compose à partir du type
      // de cuisine et de la zone livrée.
      const r = await supabase(
        `restaurants?id=eq.${id}&select=id,name,cuisine_type,zone_served,delivery_fee,cover_url,logo_url`);
      if (!r) return versAccueil();
      const ou = r.zone_served ? ` — livré à ${r.zone_served}` : ' à Nosy Be';
      vue = {
        titre: r.name,
        prix: typeof r.delivery_fee === 'number' ? `Livraison ${formatAr(r.delivery_fee)}` : '',
        description: `${r.cuisine_type ? r.cuisine_type + '. ' : ''}Commandez${ou} avec Taxi Food.`,
        image: r.cover_url || r.logo_url || OG_DEFAUT,
        lien: `${SITE}/r/${id}`,
        commander: `${APP}/restaurant/${id}`,
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
    return versAccueil();
  }
};

export const config = { path: ['/p/:id', '/r/:id'] };
