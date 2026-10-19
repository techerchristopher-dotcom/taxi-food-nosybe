/**
 * /pro/<slug> — la page préparée pour UN restaurant que l'on démarche (2026-10-19).
 *
 * Le lien part dans le premier message WhatsApp (compétence
 * « prospection-whatsapp-restaurants ») et doit donner envie de prendre rendez-vous.
 * Trois arguments, choisis par le porteur du projet : visibilité sur nos réseaux
 * (exemples à l'appui), chiffre d'affaires en plus sans charges en plus, un nouveau
 * canal de vente. Et des CHIFFRES RÉELS, lus en base à chaque affichage, pour montrer
 * que ça tourne déjà (`pro_stats()` : agrégés, jamais le chiffre d'un restaurant).
 *
 * ⚠️ Aucun taux de commission ici : il se négocie restaurant par restaurant.
 *
 * Tout passe par des RPC anon de la base, qui font foi :
 *   pro_page(slug)                       le contenu (null → page inconnue)
 *   pro_compter_ouverture(slug)          une ouverture (1re → Telegram du porteur)
 *   pro_reserver(slug, debut, nom, tel)  un rendez-vous (→ Telegram)
 *   pro_etre_rappele(slug, nom, tel)     « rappelez-moi » (→ Telegram)
 *
 * Rendu côté serveur, formulaires HTML sans JavaScript : la page marche dans le
 * navigateur intégré de WhatsApp, sur un vieux téléphone, sur la liaison de Nosy Be.
 * POST → redirection 303 vers la même page (?ok= ou ?erreur=) : un rechargement ne
 * renvoie jamais le formulaire.
 *
 * Les robots d'aperçu (WhatsApp, Facebook…) et ?apercu=1 (l'admin qui regarde) ne
 * comptent pas comme une ouverture.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE = 'https://taxifoodnosybe.distripro207.com';
const WHATSAPP = '261361574521';
const STOCKAGE = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/';

// Visuels déjà publiés sur nos réseaux (bucket produits/visuels-reseaux). Choisis le
// 2026-10-19 : ni Chez Bidule & Truc (masqué), ni le Nandipo (en stand-by).
const EXEMPLES = [
  { f: 'produits/visuels-reseaux/2026-10-14-escale-annonce.jpg', l: 'Annonce de l’arrivée de L’escale Créole' },
  { f: 'produits/visuels-reseaux/2026-10-15-duo-cabane-escale.jpg', l: 'Les plats du soir, deux restaurants' },
  { f: 'produits/visuels-reseaux/2026-10-15-promo-tacos-poulet.jpg', l: 'Promotion de la semaine de La Cabane' },
  { f: 'produits/visuels-reseaux/2026-10-19-commande-programmee.jpg', l: 'Nouveauté : commander à l’avance' },
];

const ROBOTS = /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|whatsapp|telegram|twitter|slack|discord|preview|embedly|skype|linkedin|pinterest|curl|wget|python|node-fetch|axios|headless|lighthouse/i;

const echapper = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Image du stockage passée par le CDN Netlify (poids réduit, notre domaine). */
const img = (url, w) => {
  const u = String(url ?? '');
  if (!u) return '';
  const abs = u.startsWith('http') ? u : STOCKAGE + u;
  return `/.netlify/images?url=${encodeURIComponent(abs)}&w=${w}&q=72&fm=webp`;
};

const TZ = 'Indian/Antananarivo';
const fmtJour = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtCle = new Intl.DateTimeFormat('fr-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const heure = (d) => fmtHeure.format(d).replace(':', 'h');
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const milliers = (n) => Number(n).toLocaleString('fr-FR').replace(/[  ]/g, ' ');

function millions(n) {
  const v = Number(n) / 1e6;
  return v >= 1 ? `${v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M` : milliers(n);
}

async function rpc(nom, corps) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!r.ok) throw new Error(`${nom} ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const ERREURS = {
  nom: 'Indiquez votre nom (2 lettres au moins).',
  telephone: 'Le numéro de téléphone ne semble pas complet.',
  creneau_pris: 'Ce créneau vient d’être pris. Choisissez-en un autre.',
  creneau: 'Choisissez un créneau.',
  deja_rdv: 'Un rendez-vous est déjà pris pour votre restaurant.',
  trop: 'Trop de demandes aujourd’hui. Écrivez-nous sur WhatsApp.',
  inconnu: 'Cette page n’existe plus.',
  technique: 'Un souci technique nous a empêché d’enregistrer. Écrivez-nous sur WhatsApp, on s’en occupe.',
};

function creneauxParJour(liste) {
  const jours = new Map();
  for (const iso of liste) {
    const d = new Date(iso);
    const cle = fmtCle.format(d);
    if (!jours.has(cle)) jours.set(cle, { titre: capital(fmtJour.format(d)), heures: [] });
    jours.get(cle).heures.push({ iso, h: heure(d) });
  }
  return [...jours.values()].slice(0, 5);
}

function page(slug, d, etat) {
  const nom = d.nom;
  const n = echapper(nom);
  const s = d.stats ?? {};
  const depuis = s.depuis ? new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'long' }).format(new Date(s.depuis)) : null;
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Bonjour Christopher, je viens de voir la page Taxi Food pour ${nom}.`)}`;
  const titre = `Taxi Food × ${nom}`;
  const desc = `Une proposition préparée pour ${nom} : de la visibilité, un nouveau canal de vente, du chiffre d’affaires en plus sans charges en plus.`;
  const rdv = d.rdv ? new Date(d.rdv.debut) : null;

  const chiffres = [
    s.commandes_livrees ? { v: milliers(s.commandes_livrees), l: `commandes livrées${depuis ? ` depuis le ${depuis}` : ''}` } : null,
    s.ventes_plats ? { v: `${millions(s.ventes_plats)} Ar`, l: 'de plats vendus pour nos restaurants' } : null,
    s.note ? { v: `${String(s.note).replace('.', ',')}/5`, l: `note moyenne des clients (${s.nb_avis} avis)` } : null,
    s.livrees_30j ? { v: milliers(s.livrees_30j), l: 'commandes ces 30 derniers jours' } : null,
  ].filter(Boolean);

  const bandeau = etat.ok === 'rdv' && rdv
    ? `<div class="ok">✅ C’est noté : rendez-vous le <b>${echapper(fmtJour.format(rdv))} à ${heure(rdv)}</b>. Christopher passe vous voir. À très vite !</div>`
    : etat.ok === 'rappel' ? '<div class="ok">✅ C’est noté : Christopher vous rappelle très vite.</div>'
    : etat.erreur ? `<div class="err">${echapper(ERREURS[etat.erreur] ?? ERREURS.technique)}</div>` : '';

  const jours = creneauxParJour(d.creneaux ?? []);
  const formRdv = rdv
    ? `<p class="confirme">📅 Rendez-vous confirmé : <b>${echapper(fmtJour.format(rdv))} à ${heure(rdv)}</b>.<br>Un empêchement ? <a href="${wa}">Prévenez-nous sur WhatsApp</a>.</p>`
    : jours.length === 0
    ? `<p>Pas de créneau libre en ce moment : <a href="${wa}">écrivez-nous sur WhatsApp</a>, on trouve une heure.</p>`
    : `<form method="post" class="form">
        <input type="hidden" name="action" value="rdv">
        ${jours.map((j) => `<fieldset><legend>${echapper(j.titre)}</legend><div class="heures">${j.heures.map((h) =>
          `<label class="h"><input type="radio" name="debut" value="${echapper(h.iso)}" required><span>${h.h}</span></label>`).join('')}</div></fieldset>`).join('')}
        <label class="champ">Votre nom<input name="nom" autocomplete="name" required minlength="2" maxlength="80"></label>
        <label class="champ">Votre téléphone (WhatsApp)<input name="telephone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="034 00 000 00" maxlength="30"></label>
        <label class="champ">Un mot pour Christopher (facultatif)<textarea name="message" rows="2" maxlength="500"></textarea></label>
        <button class="cta" type="submit">Réserver ce créneau</button>
        <p class="petit">20 minutes, chez vous, sans engagement.</p>
      </form>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Taxi Food">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${echapper(titre)}">
<meta property="og:description" content="${echapper(desc)}">
<meta property="og:image" content="${SITE}/og/taxi-food-restaurateurs.jpg">
<meta property="og:url" content="${SITE}/pro/${echapper(slug)}">
<link rel="icon" href="/assets/favicon-32.png">
<style>
  :root { color-scheme: light; --rouge:#E8342A; --or:#FFC72C; --encre:#1A1A1A; --gris:#5C554E; --fond:#FFF8F0; --carte:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--fond); color:var(--encre); }
  main { max-width:560px; margin:0 auto; padding:0 16px 48px; }
  header { display:flex; align-items:center; gap:10px; padding:14px 0; }
  header img { width:36px; height:36px; border-radius:10px; }
  header span { font-weight:700; }
  header small { margin-left:auto; color:var(--gris); font-size:12px; text-align:right; }
  .hero { background:var(--rouge); color:#fff; border-radius:22px; padding:24px 20px; border-bottom:6px solid var(--or); }
  .hero .sur { color:var(--or); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; margin:0 0 8px; }
  .hero h1 { font-size:27px; line-height:1.15; margin:0 0 10px; }
  .hero p { margin:0 0 18px; line-height:1.45; opacity:.95; }
  a.cta, button.cta { display:block; width:100%; text-align:center; background:var(--or); color:var(--encre); border:0; text-decoration:none;
    font-weight:800; font-size:17px; padding:15px; border-radius:999px; cursor:pointer; font-family:inherit; }
  a.cta2 { display:block; text-align:center; margin-top:10px; color:#fff; border:2px solid rgba(255,255,255,.7); text-decoration:none;
    font-weight:700; padding:12px; border-radius:999px; }
  h2 { font-size:20px; margin:32px 0 12px; }
  .stats { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:16px; }
  .stat { background:var(--carte); border-radius:16px; padding:14px; border:1px solid #F0E6DA; }
  .stat b { display:block; font-size:24px; color:var(--rouge); line-height:1.1; }
  .stat span { font-size:13px; color:var(--gris); }
  .args { display:flex; flex-direction:column; gap:10px; }
  .arg { background:var(--carte); border-radius:16px; padding:16px; border:1px solid #F0E6DA; }
  .arg h3 { margin:0 0 6px; font-size:17px; }
  .arg p { margin:0; color:var(--gris); line-height:1.45; font-size:15px; }
  .visuels { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .visuels figure { margin:0; }
  .visuels img { width:100%; aspect-ratio:4/5; object-fit:cover; border-radius:12px; display:block; background:#F0E6DA; }
  .visuels figcaption { font-size:12px; color:var(--gris); margin-top:4px; line-height:1.3; }
  .partenaires { display:flex; flex-direction:column; gap:8px; }
  .p { display:flex; align-items:center; gap:12px; background:var(--carte); border-radius:14px; padding:10px 12px; border:1px solid #F0E6DA; }
  .p img, .p .ini { width:44px; height:44px; border-radius:50%; object-fit:cover; background:#F0E6DA; flex:none; }
  .p .ini { display:flex; align-items:center; justify-content:center; font-weight:800; color:var(--rouge); }
  .p .nm { font-weight:700; }
  .p .cu { font-size:13px; color:var(--gris); }
  .p .nt { margin-left:auto; font-weight:700; white-space:nowrap; font-size:14px; }
  blockquote { margin:0 0 10px; background:var(--carte); border-left:4px solid var(--or); border-radius:12px; padding:12px 14px; }
  blockquote p { margin:0 0 6px; line-height:1.45; }
  blockquote cite { font-style:normal; font-size:13px; color:var(--gris); }
  ol.etapes { padding:0; margin:0; list-style:none; counter-reset:e; display:flex; flex-direction:column; gap:10px; }
  ol.etapes li { counter-increment:e; display:flex; gap:12px; align-items:flex-start; line-height:1.45; }
  ol.etapes li::before { content:counter(e); flex:none; width:28px; height:28px; border-radius:50%; background:var(--rouge); color:#fff;
    font-weight:800; display:flex; align-items:center; justify-content:center; }
  #rdv { background:var(--carte); border-radius:20px; padding:18px 16px; border:2px solid var(--rouge); margin-top:32px; }
  #rdv h2 { margin-top:0; }
  fieldset { border:0; padding:0; margin:0 0 12px; }
  legend { font-weight:700; margin-bottom:6px; font-size:15px; }
  .heures { display:flex; flex-wrap:wrap; gap:8px; }
  .h input { position:absolute; opacity:0; pointer-events:none; }
  .h span { display:inline-block; min-width:68px; text-align:center; padding:10px 8px; border-radius:10px; border:1.5px solid #E2D6C8; font-weight:600; cursor:pointer; }
  .h input:checked + span { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  .h input:focus-visible + span { outline:3px solid var(--or); }
  .champ { display:block; font-size:14px; font-weight:600; margin:12px 0 0; }
  .champ input, .champ textarea { display:block; width:100%; margin-top:6px; font-size:16px; padding:12px; border-radius:12px; border:1.5px solid #E2D6C8; font-family:inherit; background:#fff; }
  .form .cta { margin-top:16px; background:var(--rouge); color:#fff; }
  .petit { font-size:13px; color:var(--gris); text-align:center; margin:8px 0 0; }
  details { margin-top:16px; }
  summary { cursor:pointer; font-weight:600; color:var(--rouge); }
  .ok, .err { border-radius:14px; padding:14px; margin:14px 0 0; line-height:1.45; }
  .ok { background:#E7F6EC; color:#145A2E; }
  .err { background:#FDECEA; color:#8A1C14; }
  .confirme { line-height:1.5; }
  .fondateur { display:flex; gap:14px; align-items:center; margin-top:32px; }
  .fondateur img { width:72px; height:72px; border-radius:50%; object-fit:cover; flex:none; }
  .fondateur p { margin:0; color:var(--gris); line-height:1.45; font-size:15px; }
  footer { margin-top:28px; text-align:center; font-size:13px; color:var(--gris); }
  footer a { color:var(--rouge); }
</style>
</head>
<body>
<main>
  <header>
    <img src="/assets/logo-96.webp" alt="" width="36" height="36">
    <span>Taxi Food</span>
    <small>Proposition pour<br><b>${n}</b></small>
  </header>

  ${bandeau}

  <section class="hero">
    <p class="sur">Préparé pour ${n}</p>
    <h1>${n}, vos plats livrés partout à Nosy Be.</h1>
    <p>Taxi Food, c’est l’application de livraison de repas de l’île. On s’occupe des commandes, des livreurs et de la publicité. Vous, vous cuisinez.</p>
    <a class="cta" href="#rdv">${rdv ? 'Voir mon rendez-vous' : 'Choisir un créneau (20 min)'}</a>
    <a class="cta2" href="${wa}">Écrire à Christopher sur WhatsApp</a>
  </section>

  ${chiffres.length ? `<h2>Ça tourne déjà</h2>
  <div class="stats">${chiffres.map((c) => `<div class="stat"><b>${echapper(c.v)}</b><span>${echapper(c.l)}</span></div>`).join('')}</div>` : ''}

  <h2>Ce que Taxi Food vous apporte</h2>
  <div class="args">
    <div class="arg"><h3>📣 De la visibilité sur nos réseaux</h3>
      <p>On réalise les visuels de vos plats et on les publie sur notre page Facebook et dans les groupes de Nosy Be. À votre arrivée, vous êtes mis en avant dans l’application avec le badge « Nouveau », et nos clients sont prévenus par notification.</p></div>
    <div class="arg"><h3>💰 Du chiffre d’affaires en plus, sans charges en plus</h3>
      <p>Pas de livreur à embaucher, pas de scooter, pas de matériel à acheter. Vous préparez, notre livreur récupère et livre. Vous êtes payé par Orange Money, avec le détail de chaque commande.</p></div>
    <div class="arg"><h3>🛵 Un nouveau canal de vente</h3>
      <p>Les touristes dans leur location, les résidents qui ne se déplacent pas le soir : des clients qui ne seraient pas venus chez vous. Ils commandent dans l’application ou sur le site, et paient à la livraison, par carte ou Orange Money.</p></div>
  </div>

  <h2>Ce qu’on publie déjà pour nos restaurants</h2>
  <div class="visuels">${EXEMPLES.map((e) => `<figure><img src="${img(e.f, 480)}" alt="${echapper(e.l)}" loading="lazy" width="480" height="600"><figcaption>${echapper(e.l)}</figcaption></figure>`).join('')}</div>

  ${Array.isArray(d.partenaires) && d.partenaires.length ? `<h2>Ils sont déjà sur Taxi Food</h2>
  <div class="partenaires">${d.partenaires.map((p) => `<div class="p">${p.logo
    ? `<img src="${img(p.logo, 96)}" alt="" loading="lazy" width="44" height="44">`
    : `<span class="ini">${echapper(String(p.nom).replace(/^(le|la|les|l’|l'|chez)\s*/i, '').charAt(0).toUpperCase())}</span>`}
    <div><div class="nm">${echapper(p.nom)}</div>${p.cuisine ? `<div class="cu">${echapper(p.cuisine)}</div>` : ''}</div>
    ${p.note ? `<span class="nt">★ ${String(p.note).replace('.', ',')}</span>` : ''}</div>`).join('')}</div>` : ''}

  ${Array.isArray(d.avis) && d.avis.length ? `<h2>Ce que disent leurs clients</h2>
  ${d.avis.map((a) => `<blockquote><p>« ${echapper(a.texte)} »</p><cite>${echapper(a.prenom ?? 'Un client')} · ${echapper(a.restaurant)} · ★ ${String(Number(a.note)).replace('.', ',')}</cite></blockquote>`).join('')}` : ''}

  <h2>Comment ça se passe</h2>
  <ol class="etapes">
    <li><span>On se rencontre 20 minutes chez vous, au moment qui vous arrange.</span></li>
    <li><span>On met votre carte en ligne avec vos photos. On s’en charge.</span></li>
    <li><span>Les commandes arrivent sur votre téléphone (Telegram et application). Vous acceptez d’un appui.</span></li>
    <li><span>Notre livreur récupère la commande et la livre. Vous êtes payé par Orange Money.</span></li>
  </ol>

  <section id="rdv">
    <h2>${rdv ? 'Votre rendez-vous' : 'Choisissez un créneau'}</h2>
    ${rdv ? '' : '<p class="petit" style="text-align:left;margin:0 0 12px">Christopher passe vous voir au restaurant. Heure de Nosy Be.</p>'}
    ${formRdv}
    ${rdv ? '' : `<details>
      <summary>Aucun créneau ne vous convient ? Être rappelé</summary>
      <form method="post" class="form">
        <input type="hidden" name="action" value="rappel">
        <label class="champ">Votre nom<input name="nom" autocomplete="name" required minlength="2" maxlength="80"></label>
        <label class="champ">Votre téléphone<input name="telephone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30"></label>
        <label class="champ">Quand vous joindre ? (facultatif)<textarea name="message" rows="2" maxlength="500"></textarea></label>
        <button class="cta" type="submit">Me rappeler</button>
      </form>
    </details>`}
  </section>

  <div class="fondateur">
    <img src="/img/fondateur/christopher-192.webp" alt="Christopher" width="72" height="72" loading="lazy">
    <p><b>Christopher</b>, fondateur de Taxi Food. « J’ai créé Taxi Food pour que les bons restaurants de Nosy Be soient livrés partout sur l’île. Je serais ravi d’y ajouter ${n}. »</p>
  </div>

  <footer>
    <a href="${wa}">WhatsApp +261 36 15 74 521</a> · <a href="${SITE}/restaurants-partenaires/">taxifoodnosybe.distripro207.com</a>
  </footer>
</main>
</body>
</html>`;
}

const html = (corps, statut = 200) => new Response(corps, {
  status: statut,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
});

export default async (req, context) => {
  const slug = String(context.params?.slug ?? '').toLowerCase();
  const url = new URL(req.url);
  const ici = `${SITE}/pro/${slug}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 60 || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Response.redirect(`${SITE}/restaurants-partenaires/`, 302);
  }

  if (req.method === 'POST') {
    let code = 'technique';
    let ok = null;
    try {
      const f = new URLSearchParams(await req.text());
      const action = f.get('action');
      const nom = f.get('nom') ?? '';
      const telephone = f.get('telephone') ?? '';
      const message = f.get('message') ?? '';
      let r;
      if (action === 'rdv') {
        const debut = f.get('debut');
        if (!debut || Number.isNaN(Date.parse(debut))) r = { ok: false, erreur: 'creneau' };
        else r = await rpc('pro_reserver', { p_slug: slug, p_debut: debut, p_nom: nom, p_telephone: telephone, p_message: message || null });
        if (r?.ok) ok = 'rdv';
      } else if (action === 'rappel') {
        r = await rpc('pro_etre_rappele', { p_slug: slug, p_nom: nom, p_telephone: telephone, p_message: message || null });
        if (r?.ok) ok = 'rappel';
      }
      code = r?.erreur ?? code;
    } catch (e) {
      console.error('[pro] POST', e);
    }
    const cible = ok ? `${ici}?ok=${ok}#rdv` : `${ici}?erreur=${encodeURIComponent(code)}#rdv`;
    return new Response(null, { status: 303, headers: { Location: cible, 'cache-control': 'no-store' } });
  }

  try {
    const d = await rpc('pro_page', { p_slug: slug });
    if (!d) return Response.redirect(`${SITE}/restaurants-partenaires/`, 302);
    const ua = req.headers.get('user-agent') ?? '';
    const premiereVue = !url.searchParams.has('ok') && !url.searchParams.has('erreur');
    if (premiereVue && !url.searchParams.has('apercu') && ua && !ROBOTS.test(ua)) {
      try { await rpc('pro_compter_ouverture', { p_slug: slug }); } catch (e) { console.error('[pro] ouverture', e); }
    }
    return html(page(slug, d, { ok: url.searchParams.get('ok'), erreur: url.searchParams.get('erreur') }));
  } catch (e) {
    console.error('[pro]', e);
    return Response.redirect(`${SITE}/restaurants-partenaires/`, 302);
  }
};

export const config = { path: ['/pro/:slug'] };
