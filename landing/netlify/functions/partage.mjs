/**
 * Pages de partage : /p/<id> (un produit), /r/<id> (un restaurant), /j/<id> (les
 * plats du jour d'un restaurant, en UNE publication — image `/j/<id>/apercu.jpg`),
 * /s/<id> (une SÉLECTION composée à la main, des plats de plusieurs
 * restaurants — image `/s/<id>/apercu.jpg`) et « /jour » (les plats du jour de
 * TOUTE L'ÎLE, sans identifiant — image `/jour/apercu.jpg`).
 *
 * ── /j/ et /s/ ne se ressemblent qu'en surface ────────────────────────────────
 * /j/ est la vitrine d'UN restaurant : tout y mène au même menu. /s/ mélange
 * volontairement plusieurs établissements, et le panier de l'application est
 * MONO-RESTAURANT : on ne peut pas composer une commande unique à partir de
 * deux d'entre eux. La page le montre donc dans sa structure même — les plats
 * sont groupés par restaurant, chaque groupe a son propre bouton de commande —
 * et le dit en toutes lettres avant le premier tap. Une page qui laisserait
 * croire au panier mélangé enverrait le client dans un mur au deuxième plat.
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

// ✅ FICHE PLAY EN LIGNE — verifie le 2026-09-09 : l'URL ci-dessus repond 200,
// titre « Taxi Food - Apps on Google Play ». Le drapeau est donc passe a `true`.
//
// Il avait ete pose a `false` le 2026-09-07, quand la fiche repondait encore 404 :
// le bouton envoyait alors tout visiteur Android — la majorite des telephones a
// Nosy Be — sur une page Google morte. La garde etait juste ce jour-la.
//
// ⚠️ LA LECON, elle, reste : ce drapeau ne se met pas a jour tout seul. Il a
// survecu deux jours a la publication, pendant lesquels aucun partage WhatsApp
// n'a propose l'app aux clients Android, sans que rien ne le signale. Avant de
// citer ce fichier comme source de verite sur l'etat des magasins, VERIFIER
// l'URL — un commentaire date n'est pas un fait present.
const PLAY_PUBLIE = true;
const OG_DEFAUT = `${SITE}/og/taxi-food-nosy-be.jpg`;

/**
 * Image d'apercu pour les robots de WhatsApp et Facebook.
 *
 * ⚠️ TROIS ESSAIS ONT ETE NECESSAIRES ; voici ce qui bloquait, pour ne pas le
 * re-tenter :
 *
 * 1. L'URL D'ORIGINE. `og:image` pointait sur le fichier du stockage, un PNG de
 *    **1,38 Mo**. Au-dela de quelques centaines de kilo-octets le robot abandonne
 *    l'image sans rien dire, et le partage perd la photo du plat.
 *
 * 2. LE TRANSFORMATEUR SUPABASE. Il descend le poids, mais garde le PNG :
 *    `quality` n'a AUCUN effet sur ce format et `format=jpeg` n'existe pas (400).
 *    A 600x315 on tombait a 274 Ko — et WhatsApp n'affichait toujours rien.
 *
 * 3. CE QUI MARCHE. Compare a un apercu qui fonctionne
 *    (ledimoredelsalento.rentanoo.com), trois differences ressortaient : format
 *    **JPEG**, poids moitie moindre, et image servie depuis **le meme domaine**
 *    que la page. Le Netlify Image CDN donne les trois d'un coup — 1200x630 en
 *    JPEG, 64 Ko, sur notre domaine.
 *
 * ⚠️ Exige `[images] remote_images` dans netlify.toml, sans quoi l'endpoint
 * refuse toute source externe. Retirer cette ligne casse tous les apercus.
 *
 * ⚠️ Ne transforme QUE les images du stockage Supabase : l'image par defaut est
 * deja un JPEG au bon format sur le site.
 */
const OBJET = '/storage/v1/object/public/';
const RENDU = '/storage/v1/render/image/public/';
function apercuImage(url) {
  const u = String(url ?? '');
  const i = u.indexOf(OBJET);
  if (i < 0) return u;

  // ⚠️ ON PASSE D'ABORD PAR LE TRANSFORMATEUR SUPABASE, et ce n'est pas une
  // precaution gratuite : Netlify ne sait PAS decoder le HEIC et repond 500
  // (verifie le 2026-09-07 sur la couverture de Chez Bidul & Truc, une photo
  // prise a l'iPhone et deposee telle quelle). Supabase, lui, le convertit.
  // La chaine Supabase -> Netlify couvre donc tous les formats deposes par un
  // restaurateur depuis son telephone, HEIC compris.
  const source = `${u.slice(0, i)}${RENDU}${u.slice(i + OBJET.length)}`
    + '?width=1200&height=630&resize=cover&quality=80';

  return `${SITE}/.netlify/images?url=${encodeURIComponent(source)}`
    + '&w=1200&h=630&fit=cover&fm=jpg&q=75';
}

/** Vignette carrée légère d'une photo du stockage (liste des plats du jour). */
function apercuVignette(url) {
  const u = String(url ?? '');
  const i = u.indexOf(OBJET);
  if (i < 0) return u;
  return `${u.slice(0, i)}${RENDU}${u.slice(i + OBJET.length)}?width=160&height=160&resize=cover`;
}

const echapper = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 12 000 → « 12 000 Ar ». Même présentation que `formatAr` dans l'app. */
const formatAr = (n) =>
  typeof n === 'number' ? `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} Ar` : '';

/**
 * Empreinte des plats à l'affiche, posée dans l'adresse (`?v=`).
 *
 * ⚠️ POURQUOI LE LIEN PORTE UNE EMPREINTE (`?v=`). Facebook met en cache, PAR
 * ADRESSE, ce qu'il a lu la première fois : titre, texte, image. Le lien des plats du
 * jour était toujours le même, `/j/<restaurant>` — le 2026-09-16, le partage publiait
 * donc les plats de la VEILLE, alors que la page servait bien les nouveaux. L'empreinte
 * est calculée sur les plats à l'affiche : les plats changent, l'adresse change, et
 * Facebook est obligé de relire la page.
 *
 * ⚠️ MÊME CALCUL, AU CARACTÈRE PRÈS, dans app/lib/partage.ts (`empreintePlats`), qui
 * construit le lien partagé. Si les deux divergent,
 * Facebook suit `og:url` : ça marche encore, mais au prix d'une double lecture.
 */
function empreintePlats(ids) {
  let h = 0x811c9dc5;
  for (const c of [...ids].sort().join(',')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * ── L'ÉTIQUETTE DU GROUPE FACEBOOK (`?g=`) ───────────────────────────────────
 *
 * Le lien publié dans un groupe porte le nom court de ce groupe :
 * `…/jour?g=boncoin`. C'est la seule façon de savoir lequel des vingt et quelques
 * groupes amène vraiment des clients — sans ça on publie à l'aveugle.
 *
 * ⚠️ FACEBOOK REMPLACE LE LIEN CLIQUÉ PAR `og:url`. C'est le piège central de tout
 * ce chantier : sans réinjection ici, la personne qui clique dans le groupe
 * « Le Bon coin » arrive sur `…/jour?v=…` tout court, l'étiquette est perdue en
 * route et la mesure vaut exactement zéro. `og:url` doit donc porter le `g` reçu,
 * À CÔTÉ de l'empreinte `?v=` (qui, elle, force Facebook à relire la page quand les
 * plats changent — voir `empreintePlats`). Les deux paramètres ne se remplacent pas :
 * `v` sert au cache, `g` sert à la mesure.
 *
 * ⚠️ LE `canonical`, LUI, RESTE PROPRE. Un canonical qui varierait par groupe
 * annoncerait vingt pages différentes à Google pour un seul contenu. D'où le
 * paramètre `canonique` de `page()` : `og:url` porte l'étiquette, `canonical` non.
 *
 * ⚠️ L'IMAGE NE PORTE PAS LE `g`, volontairement. Elle est rigoureusement la même
 * pour tous les groupes ; lui coller l'étiquette multiplierait les adresses d'une
 * image de 200 Ko à refabriquer (6 s à froid) sans rien apprendre à personne. Seule
 * l'empreinte `?v=` la distingue, et c'est suffisant.
 *
 * Étiquette acceptée : minuscules, chiffres et tirets, 24 caractères au plus. Tout
 * le reste est IGNORÉ (pas d'erreur, pas de 404) — un lien recopié de travers doit
 * continuer à ouvrir la page, il perd juste sa mesure.
 */
const ETIQUETTE_OK = /^[a-z0-9][a-z0-9-]{0,23}$/;
function etiquetteGroupe(url) {
  const g = (url.searchParams.get('g') || '').toLowerCase();
  return ETIQUETTE_OK.test(g) ? g : '';
}

/** Même requête, mais la liste entière (plats du jour). */
async function supabaseListe(chemin) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

async function supabase(chemin) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${chemin}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j[0] ?? null : j;
}

/**
 * Appel d'une fonction SQL (RPC), en POST.
 *
 * ⚠️ POURQUOI PAS UN GET SUR LA TABLE, comme les deux fonctions ci-dessus.
 * `selections` et `selection_items` n'ont AUCUNE politique de lecture pour la
 * clé anonyme — c'est voulu, pas un oubli : un GET direct listerait toutes les
 * sélections, y compris celles qui ne sont pas encore publiées. Tout passe donc
 * par `selection_publique`, qui applique elle-même les règles en base : elle ne
 * rend rien pour une sélection inconnue, désactivée ou expirée, et elle écarte
 * les plats devenus incommandables. Le nom, le prix et la photo sont lus à
 * CHAQUE ouverture — une page qui afficherait un prix figé la veille mentirait
 * au client, qui paierait la différence à la caisse.
 */
async function supabaseRpc(fonction, corps) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`supabase rpc ${fonction} ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
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

/**
 * Le gabarit est PARTAGÉ par /p/, /r/, /j/ et /s/.
 *
 * ⚠️ Les trois derniers paramètres (`note`, `groupes`, `ctaTexte`) n'existent
 * que pour /s/ et sont tous facultatifs : sans eux, la page rendue est celle
 * d'avant, à l'octet près. C'est la condition pour toucher à ce fichier sans
 * risquer de casser trois pages qui marchent — ne pas transformer un paramètre
 * facultatif en obligatoire.
 *
 * ⚠️ `canonique` est facultatif LUI AUSSI, et par défaut vaut `lien` : les quatre
 * pages à identifiant ne changent pas d'un octet. Il n'existe que parce que `/jour`
 * doit annoncer DEUX adresses différentes — `og:url` avec l'étiquette de groupe
 * (`?g=`, sinon Facebook la mange), `canonical` sans elle (sinon Google voit vingt
 * pages pour un seul contenu). Voir `etiquetteGroupe`.
 */
function page({ titre, description, image, lien, canonique, prix, commander, plats, note, groupes, ctaTexte }) {
  const t = echapper(titre);
  const d = echapper(description);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t} — Taxi Food</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${echapper(canonique || lien)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Taxi Food">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${echapper(apercuImage(image))}">
<meta property="og:image:secure_url" content="${echapper(apercuImage(image))}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
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

  /* ⚠️ ETAT « EN COURS ». L'application web pese plusieurs mega-octets : entre
     le tap et le premier ecran il s'ecoule des secondes, bien plus sur la
     liaison de Nosy Be. Sans retour immediat, le bouton parait mort et on
     retape dessus — ou on abandonne. */
  a.occupe { pointer-events:none; opacity:.85; }
  a.occupe .txt { visibility:hidden; }
  a.occupe::after {
    content:''; position:absolute; top:50%; left:50%;
    width:20px; height:20px; margin:-10px 0 0 -10px;
    border:2.5px solid currentColor; border-top-color:transparent;
    border-radius:50%; animation:tourne .7s linear infinite;
  }
  /* Les cartes de plat et les boutons « Commander chez … » mènent au MÊME
     endroit que le bouton principal, donc à la même attente : ils doivent eux
     aussi pouvoir tourner. Sans le position:relative ci-dessous, le rond du
     ::after se centrerait sur la page et pas sur l'élément tapé. */
  a.cta, a.cta2, a.plat, a.cmd { position:relative; }
  @keyframes tourne { to { transform:rotate(360deg); } }
  /* Une animation qui tourne en boucle est penible pour qui a demande moins de
     mouvement : on garde alors un mot, pas un rond. */
  @media (prefers-reduced-motion: reduce) {
    a.occupe::after { animation:none; border-top-color:currentColor; }
  }
  footer { margin-top:32px; font-size:12px; color:#8A827A; text-align:center; }
  /* Plats du jour : la liste des plats sous l'image assemblee. */
  ul.plats { list-style:none; padding:0; margin:0 0 24px; display:flex; flex-direction:column; gap:10px; }
  ul.plats li { display:flex; align-items:center; gap:12px; background:#fff; border-radius:14px; padding:8px 12px 8px 8px; }
  ul.plats img { width:56px; height:56px; border-radius:10px; object-fit:cover; background:#F0E6DA; flex:none; }
  ul.plats .nom { flex:1; font-weight:600; }
  ul.plats .px { color:#E8590C; font-weight:700; white-space:nowrap; }

  /* ── Sélection (/s/) : un bloc par restaurant ───────────────────────────────
     ⚠️ Liste à part (ul.choix) et non ul.plats. Ici la carte blanche est
     portée par le LIEN, pas par le li : si la carte restait sur le li, la
     zone tapable se réduirait au texte, et on raterait le plat une fois sur
     deux au pouce. Les quelques déclarations qui se répètent entre les deux
     listes sont le prix à payer pour que /j/ ne bouge pas d'un pixel. */
  .note { color:#5C554E; font-size:14px; line-height:1.5; margin:0 0 20px; }
  section.groupe { margin:0 0 24px; }
  section.groupe h2 { font-size:14px; text-transform:uppercase; letter-spacing:.04em;
                      color:#8A827A; margin:0 0 10px; }
  ul.choix { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
  a.plat { display:block; background:#fff; border-radius:14px; padding:8px 12px 8px 8px;
           color:inherit; text-decoration:none; }
  a.plat .txt { display:flex; align-items:center; gap:12px; }
  a.plat img { width:56px; height:56px; border-radius:10px; object-fit:cover; background:#F0E6DA; flex:none; }
  a.plat .nom { flex:1; font-weight:600; }
  a.plat .px { color:#E8590C; font-weight:700; white-space:nowrap; }
  a.cmd { display:block; text-align:center; margin-top:12px; background:#E8590C; color:#fff;
          text-decoration:none; font-weight:600; font-size:16px; padding:14px; border-radius:999px; }
</style>
<!-- Mesure d'audience (js/mesure.js) : c'est ICI qu'on apprend si ce qu'on publie
     est regarde. Meme fichier que la vitrine, donc memes regles de comptage. -->
<script src="/js/mesure.js"></script>
<script src="/js/bulle-whatsapp.js" defer></script>
</head>
<body>
<main>
  <img class="visuel" src="${echapper(image)}" alt="${t}">
  <h1>${t}</h1>
  ${prix ? `<p class="prix">${echapper(prix)}</p>` : ''}
  ${note ? `<p class="note">${echapper(note)}</p>` : ''}
  ${Array.isArray(groupes) && groupes.length
    ? groupes.map((g) => `<section class="groupe"><h2>${echapper(g.nom)}</h2><ul class="choix">${g.plats.map((x) => `<li><a class="plat" href="${echapper(x.lien)}"><span class="txt"><img src="${echapper(x.image)}" alt=""><span class="nom">${echapper(x.nom)}</span><span class="px">${echapper(x.prix)}</span></span></a></li>`).join('')}</ul><a class="cmd" href="${echapper(g.commander)}"><span class="txt">${echapper(g.bouton)}</span></a></section>`).join('')
    : Array.isArray(plats) && plats.length
    ? `<ul class="plats">${plats.map((x) => `<li><img src="${echapper(x.image)}" alt=""><span class="nom">${echapper(x.nom)}</span><span class="px">${echapper(x.prix)}</span></li>`).join('')}</ul>`
    : `<p>${d}</p>`}
  <a class="cta" href="${echapper(commander)}"><span class="txt">${echapper(ctaTexte || 'Commander maintenant')}</span></a>
  <a class="cta2" id="app" href="${APP_STORE}" hidden><span class="txt">Télécharger l’application</span></a>
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

    // Retour immediat au tap : le bouton tourne, et ne se laisse plus retaper.
    // Les cartes de plat (a.plat) et les boutons par restaurant (a.cmd) de la
    // page /s/ ouvrent la meme application web : meme attente, meme traitement.
    document.querySelectorAll('a.cta, a.cta2, a.plat, a.cmd').forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.add('occupe');
        // ⚠️ Filet de securite. Sur iOS, revenir en arriere restaure la page
        // TELLE QU'ELLE ETAIT (bfcache) : sans cela le bouton resterait fige a
        // tourner, et paraitrait casse pour de bon. On le libere aussi au retour.
        setTimeout(function () { b.classList.remove('occupe'); }, 12000);
      });
    });
    window.addEventListener('pageshow', function () {
      document.querySelectorAll('a.occupe').forEach(function (b) {
        b.classList.remove('occupe');
      });
    });
  })();
</script>
</body>
</html>`;
}

/**
 * Sélection inconnue, désactivée, expirée, ou dont il ne reste plus un seul
 * plat commandable : une VRAIE page, en 200.
 *
 * ⚠️ Ni redirection nue, ni 404, et ce n'est pas une préférence de style.
 * Une redirection dépose le client sur l'accueil sans lui dire d'où il vient ;
 * un 404 casse la carte de la publication si Facebook repasse. Ici la personne
 * lit ce qui s'est passé et repart avec deux portes : l'application web pour
 * commander tout de suite, le site pour découvrir.
 *
 * ⚠️ JAMAIS mis en cache. Une sélection se périme puis se remplace ; si la page
 * « plus disponible » restait en cache, ceux qui ont ouvert le lien pendant le
 * trou y resteraient coincés. Même leçon que `versAccueil` (panne du 2026-09-05).
 */
function pageIndisponible(id) {
  return new Response(page({
    titre: 'Cette sélection n’est plus disponible',
    prix: '',
    description: 'Les plats mis en avant ont changé. La carte, elle, est toujours là : '
      + 'les restaurants de Nosy Be vous attendent sur Taxi Food.',
    image: OG_DEFAUT,
    lien: `${SITE}/s/${id}`,
    commander: `${APP}/`,
    ctaTexte: 'Voir les restaurants',
  }), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

/**
 * ── /jour : LES PLATS DU JOUR DE TOUTE L'ÎLE ─────────────────────────────────
 *
 * La cinquième page de cette famille, et la seule qui ne porte AUCUN identifiant :
 * elle ne parle pas d'un restaurant ni d'une sélection, mais de ce que l'île entière
 * met à l'affiche aujourd'hui. D'où une adresse courte, tapable et dictable au
 * téléphone — `/jour` — plutôt qu'un `/j/` sans identifiant, qui n'aurait pas pu
 * cohabiter avec la route `/j/:id`.
 *
 * ⚠️ MÊME SOURCE QUE L'APPLICATION ET QUE `/plats-du-jour` : la RPC
 * `plats_du_jour_publics()`. Le filtre et l'ordre sont en base. Les réécrire ici
 * reproduirait la divergence app / vitrine déjà payée sur l'ordre du catalogue.
 *
 * ⚠️ L'EMPREINTE `?v=` EST VITALE. Le lien est toujours le même alors que son
 * contenu change chaque jour : sans elle, Facebook resservirait les plats de la
 * veille (piège du 2026-09-16 sur `/j/`). Elle est calculée sur les identifiants de
 * TOUS les plats à l'affiche — pas seulement les six de l'image — et posée sur
 * `og:url` ET sur l'image.
 */

/** « Ouvre à 18h », « Ouvre demain à 9h », « Fermé », ou rien si c'est ouvert.
 *  Même règle, au mot près, que `libelleOuverture()` dans l'app et `/plats-du-jour`. */
function etatOuverture(p) {
  if (p.ouvert) return '';
  // ⚠️ `ouvre_a` est null quand le restaurateur a fermé À LA MAIN : ses horaires ne le
  // rouvriront pas tout seuls, et annoncer une heure serait un mensonge.
  if (!p.ouvre_a) return 'Fermé';
  const [h, mn] = String(p.ouvre_a).split(':');
  const heure = mn && mn !== '00' ? `${Number(h)}h${mn}` : `${Number(h)}h`;
  if (p.ouvre_dans_jours === 0) return `Ouvre à ${heure}`;
  if (p.ouvre_dans_jours === 1) return `Ouvre demain à ${heure}`;
  return 'Fermé';
}

export default async (request) => {
  const url = new URL(request.url);

  // ── Les plats du jour de toute l'île ──────────────────────────────────────
  // Traité AVANT la reconnaissance des routes à identifiant : `/jour` n'en a pas.
  const chemin = url.pathname.replace(/\/+$/, '').toLowerCase();
  if (chemin === '/jour' || chemin === '/jour/apercu.jpg') {
    // Le groupe Facebook d'où vient le clic, s'il est marqué. Lu ICI pour être
    // réinjecté dans `og:url` plus bas — c'est tout l'objet de `etiquetteGroupe`.
    const g = etiquetteGroupe(url);
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[partage] SUPABASE_URL / SUPABASE_ANON_KEY absents des variables Netlify');
      return versAccueil();
    }
    try {
      if (chemin === '/jour/apercu.jpg') {
        // ⚠️ Ce `fetch` n'envoie NI apikey NI Authorization : `apercu-plats-du-jour-ile`
        // doit rester en `verify_jwt = false` dans supabase/config.toml. Sinon elle répond
        // 401, on tombe sur le repli ci-dessous, et l'aperçu ne disparaît pas — il devient
        // le logo générique. Panne invisible.
        const r = await fetch(`${SUPABASE_URL}/functions/v1/apercu-plats-du-jour-ile`);
        if (!r.ok) {
          return new Response(null, { status: 302, headers: { location: OG_DEFAUT, 'cache-control': 'no-store, max-age=0' } });
        }
        return new Response(await r.arrayBuffer(), {
          headers: {
            'content-type': 'image/jpeg',
            'cache-control': 'public, max-age=600, s-maxage=600',
            // L'app web vit sur un AUTRE domaine : sans cet en-tête, son bouton
            // « Enregistrer l'image » ne peut même pas lire le fichier.
            'access-control-allow-origin': '*',
            // ⚠️ SANS CET EN-TÊTE, NETLIFY NE GARDE RIEN pour une fonction : l'image serait
            // refabriquée à chaque appel (4 à 5 s) et le robot de Facebook renoncerait —
            // « Expiration curl », code 418, carte vide (payé le 2026-09-18). L'adresse
            // portant l'empreinte `?v=`, on peut garder longtemps sans mentir.
            'netlify-cdn-cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800, durable',
          },
        });
      }

      const plats = await supabaseRpc('plats_du_jour_publics', {});
      // Plus rien à l'affiche nulle part : la page vitrine, elle, sait dire « aucun plat
      // du jour aujourd'hui » et renvoyer au catalogue. Un lien mort, non.
      if (!plats.length) {
        return new Response(null, {
          status: 302,
          headers: { location: `${SITE}/plats-du-jour`, 'cache-control': 'no-store, max-age=0' },
        });
      }

      const v = empreintePlats(plats.map((p) => p.product_id));

      // Regroupement par restaurant SANS toucher à l'ordre de la base (ouverts d'abord) :
      // une Map conserve l'ordre d'insertion. Même structure que /s/, et pour la même
      // raison — le panier est MONO-RESTAURANT.
      const parResto = new Map();
      for (const p of plats) {
        if (!parResto.has(p.restaurant_id)) {
          const nom = p.restaurant_nom;
          const etat = etatOuverture(p);
          parResto.set(p.restaurant_id, {
            // L'état d'ouverture est DANS le titre du groupe : qui lit « La Cabane ·
            // Ouvre à 16h » ne tape pas sur un bouton de commande pour rien.
            nom: etat ? `${nom} · ${etat}` : nom,
            // ⚠️ FERMÉ : « Voir la carte », jamais « Commander ». Le bouton mène au même
            // endroit, mais promettre une commande à qui ne peut pas commander le renvoie
            // dans un mur. Même mot que la page `/plats-du-jour`, qui a tranché ce cas.
            bouton: !p.ouvert
              ? 'Voir la carte'
              : /^chez\s/i.test(nom) ? `Commander ${nom}` : `Commander chez ${nom}`,
            plats: [],
            commander: `${APP}/restaurant/${encodeURIComponent(p.restaurant_id)}`,
          });
        }
        parResto.get(p.restaurant_id).plats.push({
          nom: p.nom,
          prix: formatAr(p.prix),
          image: p.photo_url ? apercuVignette(p.photo_url) : OG_DEFAUT,
          lien: `${APP}/product/${encodeURIComponent(p.product_id)}`,
        });
      }
      const groupes = [...parResto.values()];

      // ⚠️ La description est LUE PAR FACEBOOK, qui la coupe court : au-delà de six noms on
      // abrège nous-mêmes, plutôt que de laisser la coupe tomber au milieu d'un plat.
      const noms = plats.map((x) => x.nom);
      const liste = noms.length > 6
        ? `${noms.slice(0, 6).join(', ')}…`
        : noms.length > 1
          ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
          : noms[0];

      return new Response(page({
        titre: 'Les plats du jour à Nosy Be',
        prix: '',
        description: `${liste} — à commander sur Taxi Food.`,
        // L'empreinte est AUSSI sur l'image : Facebook met les images en cache par
        // adresse, indépendamment de la page.
        image: `${SITE}/jour/apercu.jpg?v=${v}`,
        // ⚠️ `og:url` PORTE L'ÉTIQUETTE DU GROUPE. Facebook remplace le lien cliqué par
        // cette valeur : sans le `g` ici, le marquage disparaît de la publication et la
        // mesure par groupe ne sert plus à rien. L'empreinte `?v=` reste à côté, elle
        // n'a pas le même rôle (cache ↔ mesure).
        lien: `${SITE}/jour?v=${v}${g ? `&g=${g}` : ''}`,
        // …mais le canonical, lui, reste UNIQUE : une seule page pour Google.
        canonique: `${SITE}/jour?v=${v}`,
        // Le bouton principal ne mène PAS à un restaurant — il n'y en a pas un seul.
        // Il mène à la page qui les réunit tous, sur la vitrine.
        commander: `${SITE}/plats-du-jour`,
        ctaTexte: 'Voir tous les plats du jour',
        // Dit avant le premier tap, pas découvert au deuxième plat.
        note: groupes.length > 1
          ? 'Chaque commande se fait auprès d’un seul restaurant : pour des plats '
            + 'de deux établissements, il faut passer deux commandes.'
          : '',
        groupes,
      }), {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          // ⚠️ CACHE COURT : l'état « Ouvert / Ouvre à 16h » change à l'heure près, une page
          // gardée une heure mentirait. Le second en-tête est obligatoire — Netlify ignore
          // `cache-control` pour ses fonctions (voir plus bas).
          'cache-control': 'public, max-age=120, s-maxage=120',
          'netlify-cdn-cache-control': 'public, s-maxage=120, stale-while-revalidate=3600, durable',
        },
      });
    } catch (e) {
      console.error('[partage] /jour', e);
      return versAccueil();
    }
  }

  const m = url.pathname.match(/^\/(p|r|j|s)\/([0-9a-f-]{36})(\/apercu\.jpg)?\/?$/i);

  // Identifiant absent ou mal formé : on renvoie sur l'accueil du site plutôt
  // que d'afficher une erreur — un lien tronqué dans une conversation reste
  // ainsi utile.
  if (!m) return versAccueil();
  const [, genre, id, apercu] = m;
  // Seuls /j/ et /s/ fabriquent une image assemblée. Sans cette garde étendue à
  // « s », `/s/<id>/apercu.jpg` partirait en 302 vers l'accueil : `og:image`
  // serait une redirection, et l'aperçu WhatsApp disparaîtrait sans un mot.
  if (apercu && genre !== 'j' && genre !== 's') return versAccueil();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[partage] SUPABASE_URL / SUPABASE_ANON_KEY absents des variables Netlify');
    return versAccueil();
  }

  try {
    // ── Image assemblée des plats du jour ──────────────────────────────────────
    // Fabriquée par la fonction Edge Supabase `apercu-plats-du-jour`, et re-servie ICI :
    // un aperçu WhatsApp ne s'affiche de façon fiable qu'en JPEG servi par le même
    // domaine que la page (voir `apercuImage`).
    if (apercu) {
      // ⚠️ Ce `fetch` n'envoie NI apikey NI Authorization : la fonction Edge
      // appelée doit rester en `verify_jwt = false` dans supabase/config.toml.
      // Sinon elle répond 401, on tombe sur le repli ci-dessous, et l'aperçu ne
      // disparaît pas — il devient le logo générique. Panne invisible.
      const cible = genre === 's'
        ? `apercu-selection?s=${encodeURIComponent(id)}`
        : `apercu-plats-du-jour?r=${id}`;
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${cible}`);
      if (!r.ok) {
        return new Response(null, { status: 302, headers: { location: OG_DEFAUT, 'cache-control': 'no-store, max-age=0' } });
      }
      return new Response(await r.arrayBuffer(), {
        headers: {
          'content-type': 'image/jpeg',
          'cache-control': 'public, max-age=600, s-maxage=600',
          // ⚠️ L'app web vit sur un AUTRE domaine (taxifood.distripro207.com) : sans
          // cet en-tête, son bouton « Enregistrer l'image » ne peut même pas lire le
          // fichier (le navigateur bloque la lecture inter-domaines), et un
          // `<a download>` inter-domaines est de toute façon ignoré. L'image est
          // publique par nature — c'est elle qu'on colle sur Facebook.
          'access-control-allow-origin': '*',
          // Même raison que pour la page : sans cet en-tête, l'image était refabriquée
          // à chaque appel (4 à 5 s), et le robot de Facebook renonçait. L'adresse porte
          // l'empreinte `?v=` des plats à l'affiche : un changement de plat change
          // l'adresse, on peut donc garder longtemps.
          'netlify-cdn-cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800, durable',
        },
      });
    }

    let vue;
    if (genre === 'j') {
      // Plats du jour : les plats À L'AFFICHE et commandables, dans l'ordre de l'app.
      const [r, platsLus] = await Promise.all([
        // `hidden` = retiré du catalogue (Taxi Be, 2026-09-17) : ses anciens liens
        // retombent sur l'accueil, comme dans l'app et la vitrine.
        supabase(`restaurants?id=eq.${id}&listing_status=neq.hidden&select=id,name`),
        supabaseListe(`products?restaurant_id=eq.${id}&is_featured=eq.true&is_archived=eq.false&is_available=eq.true`
          + '&select=id,name,price,photo_url,stock_quantity&order=sort_order.asc,name.asc'),
      ]);
      if (!r) return versAccueil();
      // Un plat épuisé ne s'annonce pas — même règle que l'app (`stockQuantity !== 0`),
      // et c'est elle qui garde l'empreinte identique des deux côtés.
      const plats = platsLus.filter((x) => x.stock_quantity !== 0);
      // Plus aucun plat à l'affiche (le lien a été partagé hier) : la page du restaurant
      // reste utile, un lien mort non.
      if (!plats.length) {
        return new Response(null, { status: 302, headers: { location: `${SITE}/r/${id}`, 'cache-control': 'no-store, max-age=0' } });
      }
      const noms = plats.map((x) => x.name);
      const liste = noms.length > 1 ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}` : noms[0];
      vue = {
        titre: `Plats du jour ${/^chez\s/i.test(r.name) ? 'de' : 'chez'} ${r.name}`,
        prix: '',
        description: `${liste} — à commander sur Taxi Food.`,
        // L'empreinte est AUSSI sur l'image : Facebook met les images en cache par
        // adresse, indépendamment de la page.
        image: `${SITE}/j/${id}/apercu.jpg?v=${empreintePlats(plats.map((x) => x.id))}`,
        lien: `${SITE}/j/${id}?v=${empreintePlats(plats.map((x) => x.id))}`,
        commander: `${APP}/restaurant/${id}`,
        plats: plats.map((x) => ({
          nom: x.name,
          prix: formatAr(x.price),
          image: x.photo_url ? apercuVignette(x.photo_url) : OG_DEFAUT,
        })),
      };
    } else if (genre === 's') {
      // ── Sélection composée à la main ────────────────────────────────────────
      // Une seule requête : la fonction SQL rend déjà les lignes filtrées et
      // ordonnées. Zéro ligne veut dire quatre choses à la fois — sélection
      // inconnue, désactivée, expirée, ou vidée de ses plats commandables — et
      // toutes appellent la même réponse côté client.
      const lignes = await supabaseRpc('selection_publique', { p_id: id });
      if (!lignes.length) return pageIndisponible(id);

      // Le rang est l'ordre voulu par celui qui a composé la sélection. La
      // fonction SQL trie déjà, on re-trie ici pour que la page ne dépende pas
      // de cet ordre : un tri perdu se verrait, un tri doublé ne coûte rien.
      const ordonnees = [...lignes].sort((a, b) => (a.rang ?? 0) - (b.rang ?? 0));

      // Regroupement par restaurant SANS casser les rangs : un restaurant prend
      // la place de son premier plat, et ses plats gardent leur ordre. Une Map
      // conserve l'ordre d'insertion, c'est exactement ce qu'il faut ici.
      const parResto = new Map();
      for (const l of ordonnees) {
        const cle = l.restaurant_id ?? l.restaurant_nom ?? '';
        if (!parResto.has(cle)) {
          const nom = l.restaurant_nom ?? 'Taxi Food';
          parResto.set(cle, {
            nom,
            // « Commander chez Chez Bidul & Truc » : même règle que le titre des
            // plats du jour plus haut — un nom qui commence déjà par « Chez »
            // prend « de ». Un bouton qui bégaie se lit comme une faute.
            bouton: /^chez\s/i.test(nom) ? `Commander ${nom}` : `Commander chez ${nom}`,
            plats: [],
            // Le bouton du groupe mène au MENU du restaurant : c'est là qu'on
            // complète une commande, une fois le premier plat choisi.
            commander: l.restaurant_id ? `${APP}/restaurant/${encodeURIComponent(l.restaurant_id)}` : `${APP}/`,
          });
        }
        parResto.get(cle).plats.push({
          nom: l.nom,
          prix: formatAr(l.prix),
          image: l.photo_url ? apercuVignette(l.photo_url) : OG_DEFAUT,
          // L'application web : on commande sans rien installer. Même cible que
          // le bouton principal des autres pages de partage.
          lien: `${APP}/product/${encodeURIComponent(l.product_id)}`,
        });
      }
      const groupes = [...parResto.values()];

      const noms = ordonnees.map((x) => x.nom);
      const liste = noms.length > 1
        ? `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]}`
        : noms[0];
      vue = {
        titre: ordonnees[0].titre,
        prix: '',
        description: `${liste} — à commander sur Taxi Food.`,
        image: `${SITE}/s/${id}/apercu.jpg`,
        lien: `${SITE}/s/${id}`,
        // ⚠️ Pas de « Commander maintenant » global ici : il n'y a pas UN
        // restaurant à ouvrir. Le vrai bouton de commande est sous chaque
        // groupe ; celui-ci n'est qu'une sortie vers la carte complète.
        commander: `${APP}/`,
        ctaTexte: 'Voir tous les restaurants',
        // Dit avant le premier tap, pas découvert au deuxième plat.
        note: groupes.length > 1
          ? 'Chaque commande se fait auprès d’un seul restaurant : pour des plats '
            + 'de deux établissements, il faut passer deux commandes.'
          : '',
        groupes,
      };
    } else if (genre === 'p') {
      const p = await supabase(
        `products?id=eq.${id}&is_available=eq.true&select=id,name,description,price,photo_url,restaurants!inner(name,listing_status)`
        // Plat d'un restaurant retiré du catalogue : accueil (voir `j` plus haut).
        + '&restaurants.listing_status=neq.hidden');
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
        `restaurants?id=eq.${id}&listing_status=neq.hidden&select=id,name,cuisine_type,zone_served,delivery_fee,cover_url,logo_url`);
      if (!r) return versAccueil();
      const ou = r.zone_served ? ` — livré à ${r.zone_served}` : ' à Nosy Be';
      vue = {
        titre: r.name,
        // ⚠️ « À partir de » : la livraison se paie au kilomètre depuis le
        // 2026-09-24 (socle jusqu'à 3 km, puis 1 000 Ar/km). Un aperçu social
        // est mis en cache 300 s et partagé à des gens dont on ne connaît
        // évidemment pas l'adresse : il ne peut annoncer que le plancher.
        prix: typeof r.delivery_fee === 'number' ? `Livraison à partir de ${formatAr(r.delivery_fee)}` : '',
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
        // ⚠️ SANS CE SECOND EN-TÊTE, LE CDN NE GARDE RIEN. Netlify ignore
        // `cache-control` pour ses fonctions (il ne sert qu'au navigateur) : chaque
        // visite repassait donc par Supabase, 2,5 à 3 s. Le robot de Facebook, lui,
        // abandonne avant — constaté le 2026-09-18 dans son débogueur : « Expiration
        // curl », code 418, et une carte vide avec le seul nom de domaine à la place
        // des plats du jour. `durable` garde la page dans le cache partagé de Netlify,
        // `stale-while-revalidate` sert l'ancienne pendant qu'on rafraîchit.
        'netlify-cdn-cache-control': 'public, s-maxage=300, stale-while-revalidate=3600, durable',
      },
    });
  } catch (e) {
    console.error('[partage]', e);
    return versAccueil();
  }
};

// ⚠️ C'EST ICI que Netlify prend les routes, pas dans netlify.toml ni dans
// _redirects. Ajouter une règle ailleurs créerait une seconde source de vérité
// et masquerait la fonction. Oublier une ligne ici = 404 statique sur un lien
// déjà partagé.
export const config = {
  path: [
    '/p/:id', '/r/:id',
    '/j/:id', '/j/:id/apercu.jpg',
    '/s/:id', '/s/:id/apercu.jpg',
    // Toute l'île, sans identifiant (2026-09-25).
    '/jour', '/jour/apercu.jpg',
  ],
};
