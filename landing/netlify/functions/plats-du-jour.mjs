/**
 * /plats-du-jour — les plats du jour de TOUS les restaurants, sur la vitrine.
 *
 * Trois adresses, une par langue :
 *   /plats-du-jour           (fr)
 *   /en/dishes-of-the-day    (en)
 *   /it/piatti-del-giorno    (it)
 *
 * ── Pourquoi une fonction et pas une page statique ────────────────────────────
 * Comme pour /p/ /r/ /j/ /s/ : le contenu change tous les jours, et il doit être
 * DANS LE HTML LIVRÉ. Un robot d'aperçu (WhatsApp, Facebook) n'exécute aucun
 * JavaScript, et Google n'indexe un contenu rendu côté navigateur qu'au second
 * passage, quand il le fait. Une page qui irait chercher les plats depuis le
 * navigateur ne serait donc ni partageable ni référencée — c'est-à-dire
 * exactement les deux raisons d'avoir cette page.
 *
 * ⚠️ MÊME SOURCE QUE L'APPLICATION : la RPC `plats_du_jour_publics()`. Le filtre
 * (à l'affiche, disponible, non épuisé, restaurant `visible`) et l'ordre
 * (ouverts d'abord, puis l'ordre du catalogue, puis le rang du plat) sont en
 * base. Réécrire l'un ou l'autre ici, c'est reproduire la divergence de l'ordre
 * du catalogue, où l'app et la vitrine ne montraient plus la même chose.
 *
 * ⚠️ UN RESTAURANT FERMÉ RESTE À L'AFFICHE, grisé, avec son heure d'ouverture.
 * En milieu d'après-midi trois restaurants sur quatre sont fermés : sans cela la
 * page est vide, et une page vide ne se partage pas. Décision du porteur du
 * projet, 2026-09-25.
 *
 * ⚠️ Cette fonction ne part QUE si la vitrine est déployée DEPUIS `landing/`
 * (voir CLAUDE.md). Déployée depuis la racine, elle n'est pas embarquée et les
 * trois adresses répondent 404.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SITE = 'https://taxifoodnosybe.distripro207.com';
/** L'APPLICATION WEB — on commande là, sans rien installer. */
const APP = 'https://taxifood.distripro207.com';
const OG_DEFAUT = `${SITE}/og/taxi-food-nosy-be.jpg`;

const OBJET = '/storage/v1/object/public/';
const RENDU = '/storage/v1/render/image/public/';

/**
 * Image de partage : JPEG 1200×630 servi par NOTRE domaine.
 * Même chaîne que `partage.mjs` — Supabase d'abord (lui seul décode le HEIC
 * déposé depuis un iPhone), Netlify ensuite (lui seul rend du JPEG léger).
 * ⚠️ Exige `[images] remote_images` dans netlify.toml.
 */
function apercuImage(url) {
  const u = String(url ?? '');
  const i = u.indexOf(OBJET);
  if (i < 0) return u || OG_DEFAUT;
  const source = `${u.slice(0, i)}${RENDU}${u.slice(i + OBJET.length)}`
    + '?width=1200&height=630&resize=cover&quality=80';
  return `${SITE}/.netlify/images?url=${encodeURIComponent(source)}&w=1200&h=630&fit=cover&fm=jpg&q=75`;
}

/**
 * Vignette carrée légère.
 *
 * ⚠️ Sans elle, la page servirait les PNG D'ORIGINE : jusqu'à 1,9 Mo par plat.
 * Le même plat passe à quelques dizaines de kilo-octets. Sur la liaison de
 * Nosy Be, c'est la différence entre une page et un écran gris.
 */
function vignette(url, largeur) {
  const u = String(url ?? '');
  const i = u.indexOf(OBJET);
  if (i < 0) return u;
  const w = largeur * 2; // densité écran
  return `${u.slice(0, i)}${RENDU}${u.slice(i + OBJET.length)}`
    + `?width=${w}&height=${w}&resize=cover&quality=60`;
}

/**
 * Empreinte des plats à l'affiche, posée dans l'adresse de partage (`?v=`).
 *
 * ⚠️ MÊME CALCUL, AU CARACTÈRE PRÈS, que `empreintePlats` dans
 * landing/netlify/functions/partage.mjs et app/lib/partage.ts — FNV-1a 32 bits en base 36,
 * sur les identifiants TRIÉS. Les trois doivent donner la MÊME chaîne pour la même journée :
 * sinon le bouton de cette page et celui de l'application désignent deux adresses, et
 * Facebook met en cache deux aperçus au lieu d'un.
 *
 * ⚠️ POURQUOI ELLE EXISTE. Facebook met en cache PAR ADRESSE. Le lien `/jour` ne change
 * jamais alors que son contenu change chaque jour : sans empreinte, il republierait
 * éternellement les plats du premier partage.
 */
function empreintePlats(ids) {
  let h = 0x811c9dc5;
  for (const c of [...ids].sort().join(',')) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const echapper = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** 12 000 → « 12 000 Ar ». Même présentation que l'application. */
const formatAr = (n) =>
  typeof n === 'number' ? `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} Ar` : '';

/** '18:00' → « 18h », '11:30' → « 11h30 ». Même règle que `formatTime` dans l'app. */
function heure(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':');
  return m && m !== '00' ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

const LANGUES = {
  fr: {
    code: 'fr', ogLocale: 'fr_FR', chemin: '/plats-du-jour',
    docTitre: 'Plats du jour à Nosy Be — tous les restaurants | Taxi Food',
    meta: 'Tous les plats du jour des restaurants de Nosy Be réunis sur une page : photo, prix et restaurant. Commandez en ligne, livraison à Hell-Ville, Ambatoloaka et alentours.',
    h1: 'Les plats du jour à Nosy Be',
    intro: 'Ce que les restaurants de l’île mettent en avant aujourd’hui — mis à jour en continu. Les restaurants ouverts d’abord ; les autres restent affichés, avec leur heure d’ouverture.',
    ouvert: 'Ouvert', ferme: 'Fermé',
    ouvreA: 'Ouvre à {h}', ouvreDemain: 'Ouvre demain à {h}',
    porc: 'Contient du porc',
    commander: 'Commander chez {r}', commanderChez: 'Commander {r}',
    voirCarte: 'Voir la carte',
    compte_un: '1 plat du jour', compte_n: '{n} plats du jour',
    videTitre: 'Aucun plat du jour aujourd’hui',
    vide: 'Les restaurants n’ont rien mis à l’affiche pour le moment. Leur carte, elle, est toujours là.',
    videCta: 'Voir les restaurants',
    retour: 'Découvrir Taxi Food',
    pied: 'Livraison de repas à Nosy Be',
    partagerLabel: 'Partager cette page :',
    partagerWhatsapp: 'WhatsApp', partagerFacebook: 'Facebook',
    partagerCopier: 'Copier le lien', partagerCopie: 'Lien copié',
    partagerTexte: '🔥 Les plats du jour à Nosy Be, tous restaurants confondus',
  },
  en: {
    code: 'en', ogLocale: 'en_US', chemin: '/en/dishes-of-the-day',
    docTitre: 'Dishes of the day in Nosy Be — every restaurant | Taxi Food',
    meta: 'Every restaurant’s dish of the day in Nosy Be on one page: photo, price and restaurant. Order online, delivery in Hell-Ville, Ambatoloaka and around.',
    h1: 'Dishes of the day in Nosy Be',
    intro: 'What the island’s restaurants are featuring today — kept up to date. Open restaurants first; the others stay on the page, with their opening time.',
    ouvert: 'Open', ferme: 'Closed',
    ouvreA: 'Opens at {h}', ouvreDemain: 'Opens tomorrow at {h}',
    porc: 'Contains pork',
    commander: 'Order from {r}', commanderChez: 'Order from {r}',
    voirCarte: 'See the menu',
    compte_un: '1 dish of the day', compte_n: '{n} dishes of the day',
    videTitre: 'No dish of the day today',
    vide: 'No restaurant is featuring anything right now. Their menus are still there.',
    videCta: 'See the restaurants',
    retour: 'Discover Taxi Food',
    pied: 'Meal delivery in Nosy Be',
    partagerLabel: 'Share this page:',
    partagerWhatsapp: 'WhatsApp', partagerFacebook: 'Facebook',
    partagerCopier: 'Copy link', partagerCopie: 'Link copied',
    partagerTexte: '🔥 Dishes of the day in Nosy Be, from every restaurant',
  },
  it: {
    code: 'it', ogLocale: 'it_IT', chemin: '/it/piatti-del-giorno',
    docTitre: 'Piatti del giorno a Nosy Be — tutti i ristoranti | Taxi Food',
    meta: 'Tutti i piatti del giorno dei ristoranti di Nosy Be in una pagina: foto, prezzo e ristorante. Ordina online, consegna a Hell-Ville, Ambatoloaka e dintorni.',
    h1: 'I piatti del giorno a Nosy Be',
    intro: 'Ciò che i ristoranti dell’isola propongono oggi — sempre aggiornato. Prima i ristoranti aperti; gli altri restano in pagina, con il loro orario di apertura.',
    ouvert: 'Aperto', ferme: 'Chiuso',
    ouvreA: 'Apre alle {h}', ouvreDemain: 'Apre domani alle {h}',
    porc: 'Contiene maiale',
    commander: 'Ordina da {r}', commanderChez: 'Ordina da {r}',
    voirCarte: 'Vedi il menu',
    compte_un: '1 piatto del giorno', compte_n: '{n} piatti del giorno',
    videTitre: 'Nessun piatto del giorno oggi',
    vide: 'Al momento nessun ristorante propone un piatto del giorno. I loro menu sono sempre lì.',
    videCta: 'Vedi i ristoranti',
    retour: 'Scopri Taxi Food',
    pied: 'Consegna di pasti a Nosy Be',
    partagerLabel: 'Condividi questa pagina:',
    partagerWhatsapp: 'WhatsApp', partagerFacebook: 'Facebook',
    partagerCopier: 'Copia il link', partagerCopie: 'Link copiato',
    partagerTexte: '🔥 I piatti del giorno a Nosy Be, di tutti i ristoranti',
  },
};

/**
 * « Ouvre à 18h », « Ouvre demain à 9h », ou « Fermé ».
 *
 * ⚠️ Au-delà de demain on ne nomme pas le jour — il faudrait traduire sept noms
 * de jours pour un cas qui n'arrive qu'au lendemain d'un jour de fermeture.
 * ⚠️ `ouvre_a` est null quand le restaurateur a fermé À LA MAIN : ses horaires
 * ne le rouvriront pas tout seuls, et annoncer une heure serait un mensonge.
 * Même règle, au mot près, que `libelleOuverture()` dans l'application.
 */
function etatOuverture(l, plat) {
  if (plat.ouvert) return l.ouvert;
  if (!plat.ouvre_a) return l.ferme;
  if (plat.ouvre_dans_jours === 0) return l.ouvreA.replace('{h}', heure(plat.ouvre_a));
  if (plat.ouvre_dans_jours === 1) return l.ouvreDemain.replace('{h}', heure(plat.ouvre_a));
  return l.ferme;
}

async function lirePlats() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/plats_du_jour_publics`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!r.ok) throw new Error(`supabase rpc plats_du_jour_publics ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

function page(l, plats) {
  const canonique = `${SITE}${l.chemin}`;
  const compte = plats.length === 1 ? l.compte_un : l.compte_n.replace('{n}', String(plats.length));

  // Regroupement par restaurant SANS toucher à l'ordre : la Map conserve
  // l'ordre d'insertion, donc l'ordre rendu par la base (ouverts d'abord).
  const parResto = new Map();
  for (const p of plats) {
    if (!parResto.has(p.restaurant_id)) parResto.set(p.restaurant_id, { tete: p, plats: [] });
    parResto.get(p.restaurant_id).plats.push(p);
  }
  const groupes = [...parResto.values()];

  const image = apercuImage(plats.find((p) => p.photo_url)?.photo_url ?? '');

  /* ── Partager cette page ────────────────────────────────────────────────────
     ⚠️ LE LIEN PARTAGÉ N'EST PAS CELUI DE CETTE PAGE, et c'est délibéré. Facebook
     n'affiche QUE les balises Open Graph de l'adresse qu'on lui donne : il faut donc
     lui donner `/jour`, la page de partage qui assemble une vraie affiche (photos des
     plats, prix, restaurants). Cette page-ci, elle, est faite pour être LUE et
     indexée — son `og:image` n'est qu'une photo de plat.
     ⚠️ L'empreinte `?v=` porte les plats du jour : les plats changent, l'adresse change,
     et Facebook est obligé de relire au lieu de resservir ceux de la veille.
     ⚠️ `utm_source` sur WhatsApp et sur le lien copié, JAMAIS sur Facebook — qui
     remplace le lien par `og:url` et perdrait le marquage en fabriquant une adresse de
     plus à mettre en cache. Même règle que `avecSource()` dans l'application. */
  const lienPartage = plats.length
    ? `${SITE}/jour?v=${empreintePlats(plats.map((p) => p.product_id))}`
    : `${SITE}/jour`;
  const partage = plats.length
    ? `<div class="partage">
    <span class="plabel">${echapper(l.partagerLabel)}</span>
    <a class="pbtn" rel="nofollow" target="_blank" href="https://wa.me/?text=${
      encodeURIComponent(`${l.partagerTexte}\n${lienPartage}&utm_source=whatsapp&utm_medium=partage`)
    }">${echapper(l.partagerWhatsapp)}</a>
    <a class="pbtn" rel="nofollow" target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=${
      encodeURIComponent(lienPartage)
    }">${echapper(l.partagerFacebook)}</a>
    <button class="pbtn" type="button" id="copier"
      data-lien="${echapper(`${lienPartage}&utm_source=lien&utm_medium=partage`)}"
      data-ok="${echapper(l.partagerCopie)}">${echapper(l.partagerCopier)}</button>
  </div>`
    : '';

  // Données structurées : une liste de plats, chacun avec son prix et son
  // restaurant. Le site publie déjà du JSON-LD (Organization, WebSite,
  // LocalBusiness, FAQPage) — on reste dans la même forme.
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: l.h1,
    description: l.meta,
    numberOfItems: plats.length,
    itemListElement: plats.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'MenuItem',
        name: p.nom,
        ...(p.description ? { description: p.description } : {}),
        ...(p.photo_url ? { image: vignette(p.photo_url, 400) } : {}),
        url: `${APP}/product/${p.product_id}`,
        offers: {
          '@type': 'Offer',
          price: p.prix,
          priceCurrency: 'MGA',
          availability: p.ouvert
            ? 'https://schema.org/InStock'
            : 'https://schema.org/PreOrder',
          seller: { '@type': 'Restaurant', name: p.restaurant_nom },
        },
      },
    })),
  };

  const corps = groupes.length
    ? groupes.map((g) => {
        const r = g.tete;
        const ferme = !r.ouvert;
        const nomBouton = /^chez\s/i.test(r.restaurant_nom)
          ? l.commanderChez.replace('{r}', r.restaurant_nom)
          : l.commander.replace('{r}', r.restaurant_nom);
        const sous = [r.restaurant_cuisine, r.restaurant_zone].filter(Boolean).join(' · ');
        return `<section class="groupe${ferme ? ' ferme' : ''}">
  <header class="resto">
    ${r.restaurant_logo
      ? `<img class="logo" src="${echapper(vignette(r.restaurant_logo, 44))}" alt="" width="44" height="44" loading="lazy" decoding="async">`
      : `<span class="logo vide" aria-hidden="true">${echapper(r.restaurant_nom.split(/\s+/).slice(0, 2).map((m) => m[0]).join('').toUpperCase())}</span>`}
    <span class="ident">
      <h2>${echapper(r.restaurant_nom)}</h2>
      ${sous ? `<span class="zone">${echapper(sous)}</span>` : ''}
    </span>
    <span class="etat ${ferme ? 'off' : 'on'}">${echapper(etatOuverture(l, r))}</span>
  </header>
  <ul class="plats">
    ${g.plats.map((p) => `<li><a class="plat" href="${APP}/product/${echapper(p.product_id)}">
      ${p.photo_url
        ? `<img src="${echapper(vignette(p.photo_url, 96))}" alt="${echapper(p.nom)}" width="96" height="96" loading="lazy" decoding="async">`
        : '<span class="sansphoto" aria-hidden="true"></span>'}
      <span class="txt">
        <span class="nom">${echapper(p.nom)}</span>
        ${p.description ? `<span class="desc">${echapper(p.description)}</span>` : ''}
        <span class="bas"><span class="px">${echapper(formatAr(p.prix))}</span>${
          (p.diet_tags || []).includes('porc') ? `<span class="porc">${echapper(l.porc)}</span>` : ''
        }</span>
      </span>
    </a></li>`).join('')}
  </ul>
  <a class="cmd" href="${APP}/restaurant/${echapper(r.restaurant_id)}">${echapper(ferme ? l.voirCarte : nomBouton)}</a>
</section>`;
      }).join('')
    : `<div class="vide"><h2>${echapper(l.videTitre)}</h2><p>${echapper(l.vide)}</p>
  <a class="cmd seul" href="${APP}/">${echapper(l.videCta)}</a></div>`;

  return `<!doctype html>
<html lang="${l.code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(l.docTitre)}</title>
<meta name="description" content="${echapper(l.meta)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#E8342A">
<link rel="canonical" href="${canonique}">
${Object.values(LANGUES).map((x) => `<link rel="alternate" hreflang="${x.code}" href="${SITE}${x.chemin}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${SITE}${LANGUES.fr.chemin}">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Taxi Food Nosy Be">
<meta property="og:locale" content="${l.ogLocale}">
<meta property="og:url" content="${canonique}">
<meta property="og:title" content="${echapper(l.h1)}">
<meta property="og:description" content="${echapper(l.meta)}">
<meta property="og:image" content="${echapper(image)}">
<meta property="og:image:secure_url" content="${echapper(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${echapper(l.h1)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${echapper(l.h1)}">
<meta name="twitter:description" content="${echapper(l.meta)}">
<meta name="twitter:image" content="${echapper(image)}">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; font-family:Archivo,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#F5F2EF; color:#1A1A1A; display:flex; justify-content:center; }
  main { width:100%; max-width:720px; padding:26px 16px 44px; }
  .haut { display:flex; align-items:center; gap:10px; margin-bottom:18px; }
  .haut img { width:36px; height:36px; border-radius:11px; }
  .haut a { color:#6B6662; text-decoration:none; font-size:13px; font-weight:600; }
  h1 { font-size:27px; line-height:1.18; letter-spacing:-.02em; margin:0 0 8px; }
  .intro { color:#5C554E; line-height:1.55; margin:0 0 6px; font-size:15px; }
  .compte { font:600 11px/1 "JetBrains Mono",monospace; letter-spacing:.16em; text-transform:uppercase;
            color:#8A827A; margin:0 0 22px; }
  .langues { display:flex; gap:8px; margin:0 0 22px; }
  .langues a { border:1px solid #E3DDD6; background:#fff; border-radius:999px; padding:5px 12px;
               font-size:12.5px; font-weight:600; color:#4A4744; text-decoration:none; }
  .langues a[aria-current] { background:#1A1A1A; color:#fff; border-color:#1A1A1A; }

  /* Partage : une ligne de boutons, qui passe a la ligne toute seule a 375 px.
     Cibles a 40 px de haut — une pastille de 28 px se rate au pouce. */
  .partage { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 22px; }
  .plabel { font-size:12.5px; font-weight:600; color:#6B6662; }
  .pbtn { display:inline-flex; align-items:center; height:40px; padding:0 14px; border-radius:999px;
          border:1px solid #E3DDD6; background:#fff; color:#1A1A1A; text-decoration:none;
          font:600 13px/1 Archivo,-apple-system,sans-serif; cursor:pointer; }

  section.groupe { background:#fff; border:1px solid #E9E5E0; border-radius:20px; padding:16px;
                   margin:0 0 16px; }
  /* ⚠️ Le restaurant fermé n'est pas RETIRÉ, il est grisé : sans lui la page est
     vide en milieu d'après-midi. Il garde sa photo — c'est elle qui donne envie
     de revenir — et son heure d'ouverture dit quand. */
  section.groupe.ferme { opacity:.62; }
  header.resto { display:flex; align-items:center; gap:11px; margin-bottom:13px; }
  .logo { width:44px; height:44px; border-radius:13px; object-fit:cover; background:#EAE5E0; flex:none; }
  .logo.vide { display:flex; align-items:center; justify-content:center; background:#1A1A1A; color:#FFC72C;
               font:800 15px/1 Archivo,sans-serif; }
  .ident { flex:1; min-width:0; }
  .ident h2 { font-size:18px; margin:0; letter-spacing:-.01em; }
  .zone { display:block; font-size:12px; color:#8A827A; margin-top:2px; }
  .etat { flex:none; border-radius:999px; padding:5px 11px; font-size:11.5px; font-weight:700; white-space:nowrap; }
  .etat.on { background:#E7F6EC; color:#157F3C; }
  .etat.off { background:#F1EDE8; color:#4A4744; }

  ul.plats { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:9px; }
  a.plat { display:flex; align-items:center; gap:12px; background:#FAF8F6; border-radius:15px;
           padding:9px; color:inherit; text-decoration:none; }
  a.plat img, .sansphoto { width:82px; height:82px; border-radius:12px; object-fit:cover;
                           background:#EAE5E0; flex:none; display:block; }
  .txt { min-width:0; display:flex; flex-direction:column; gap:3px; }
  .nom { font-weight:700; font-size:15px; line-height:1.25; }
  .desc { font-size:12.5px; color:#6B6662; line-height:1.4;
          display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .bas { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .px { font-weight:700; color:#C42419; font-size:14px; }
  .porc { background:#FFF3E2; color:#8A5A12; border-radius:999px; padding:2px 8px; font-size:10.5px; font-weight:700; }

  a.cmd { display:block; text-align:center; margin-top:14px; background:#E8342A; color:#fff;
          text-decoration:none; font-weight:700; font-size:15px; padding:14px; border-radius:999px; }
  section.groupe.ferme a.cmd { background:#1A1A1A; }
  a.cmd.seul { max-width:320px; margin:18px auto 0; }
  .vide { background:#fff; border:1px solid #E9E5E0; border-radius:20px; padding:30px 20px; text-align:center; }
  .vide h2 { font-size:18px; margin:0 0 8px; }
  .vide p { color:#5C554E; margin:0; line-height:1.55; }
  footer { margin-top:28px; text-align:center; font-size:12.5px; color:#8A827A; }
  footer a { color:#8A827A; }
  @media (max-width:420px) {
    a.plat img, .sansphoto { width:72px; height:72px; }
    h1 { font-size:24px; }
  }
</style>
<script src="/js/mesure.js"></script>
<script src="/js/bulle-whatsapp.js" defer></script>
</head>
<body>
<main>
  <div class="haut">
    <img src="/assets/icon-512.png" alt="Taxi Food" width="36" height="36">
    <a href="${l.code === 'fr' ? '/' : `/${l.code}/`}">${echapper(l.retour)}</a>
  </div>
  <h1>${echapper(l.h1)}</h1>
  <p class="intro">${echapper(l.intro)}</p>
  <p class="compte">${echapper(compte)}</p>
  <nav class="langues" aria-label="Langues">
    ${Object.values(LANGUES).map((x) =>
      `<a href="${x.chemin}" hreflang="${x.code}" lang="${x.code}"${x.code === l.code ? ' aria-current="page"' : ''}>${x.code.toUpperCase()}</a>`
    ).join('')}
  </nav>
  ${partage}
  ${corps}
  <footer>${echapper(l.pied)} · <a href="${l.code === 'fr' ? '/' : `/${l.code}/`}">taxifoodnosybe.distripro207.com</a></footer>
</main>
<script>
  // « Copier le lien » — et l'ecran DIT que c'est copie. Sans confirmation, le bouton
  // parait mort et on retape dessus (defaut deja signale le 2026-09-16 sur la feuille
  // de partage de l'application).
  (function () {
    var b = document.getElementById('copier');
    if (!b) return;
    var initial = b.textContent;
    b.addEventListener('click', function () {
      var lien = b.getAttribute('data-lien');
      var fini = function () {
        b.textContent = b.getAttribute('data-ok');
        setTimeout(function () { b.textContent = initial; }, 2000);
      };
      // ⚠️ navigator.clipboard n'existe qu'en HTTPS et peut echouer sans rien dire :
      // on garde le repli par champ cache, sinon le bouton ne fait rien sur les
      // navigateurs anciens des telephones d'ici.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(lien).then(fini, secours);
      } else { secours(); }
      function secours() {
        var z = document.createElement('textarea');
        z.value = lien; z.setAttribute('readonly', ''); z.style.position = 'absolute'; z.style.left = '-9999px';
        document.body.appendChild(z); z.select();
        try { document.execCommand('copy'); fini(); } catch (e) { /* rien a dire de plus */ }
        z.remove();
      }
    });
  })();
</script>
</body>
</html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  const chemin = url.pathname.replace(/\/+$/, '') || '/';
  const l = Object.values(LANGUES).find((x) => x.chemin === chemin) ?? LANGUES.fr;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // ⚠️ Les deux variables n'existent qu'en contexte PRODUCTION sur ce site :
    // un déploiement brouillon rend donc la page vide, pas une erreur. Elle
    // reste lisible et mène au catalogue.
    console.error('[plats-du-jour] SUPABASE_URL / SUPABASE_ANON_KEY absents des variables Netlify');
    return new Response(page(l, []), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, max-age=0' },
    });
  }

  let plats = [];
  try {
    plats = await lirePlats();
  } catch (e) {
    // Une panne de lecture ne doit pas rendre un 500 : Facebook casserait la
    // carte de la publication et Google retirerait la page. On sert l'état vide,
    // sans cache, pour que la page se rétablisse toute seule.
    console.error('[plats-du-jour] lecture impossible', e);
    return new Response(page(l, []), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, max-age=0' },
    });
  }

  return new Response(page(l, plats), {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // ⚠️ CACHE COURT, et c'est le point délicat : l'état « ouvert / Ouvre à
      // 16h » change à l'heure près. Une page gardée une heure annoncerait un
      // restaurant fermé alors qu'il sert. Deux minutes au bord, revalidation
      // en arrière-plan ensuite — le robot d'aperçu, lui, ne revient jamais
      // assez vite pour le voir.
      'cache-control': 'public, max-age=0, must-revalidate',
      'netlify-cdn-cache-control': 'public, s-maxage=120, stale-while-revalidate=600',
    },
  });
};

export const config = {
  path: [
    '/plats-du-jour',
    '/plats-du-jour/',
    '/en/dishes-of-the-day',
    '/en/dishes-of-the-day/',
    '/it/piatti-del-giorno',
    '/it/piatti-del-giorno/',
  ],
};
