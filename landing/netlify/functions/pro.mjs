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
// Le WhatsApp du porteur du projet, celui qui est ouvert dans son WhatsApp Web (2026-10-19).
const WHATSAPP = '261373437912';
const WHATSAPP_AFFICHE = '+261 37 34 379 12';
// « Voir Taxi Food sur Facebook et sur le web » (demande du porteur du projet, 19/10) :
// la Page Facebook et l'APPLICATION web (le vrai catalogue, sans rien installer).
const FACEBOOK = 'https://www.facebook.com/profile.php?id=61594104278047';
const APP_WEB = 'https://taxifood.distripro207.com';
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
const fmtSemaine = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short' });
const fmtNum = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' });
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
    if (!jours.has(cle)) jours.set(cle, { titre: capital(fmtJour.format(d)), jour: capital(fmtSemaine.format(d)).replace('.', ''), num: fmtNum.format(d), heures: [] });
    jours.get(cle).heures.push({ iso, h: heure(d) });
  }
  return [...jours.values()].slice(0, 8);
}

// ── Le carrousel « ça tourne déjà » ────────────────────────────────────────────
// Modèle : le carrousel « Bilan des 28 premiers jours » publié le 2026-10-09 (10 cartes
// 1080×1350, rouge / noir / crème, filet or, grand chiffre en Archivo noir, pied
// « taxifoodnosybe.distripro207.com » + points). Ici en HTML, nourri par pro_bilan() :
// toujours à jour, rien à régénérer. Demande du porteur du projet (2026-10-19) :
// « trop de texte, pas assez de visuel sur les stats ».
const virgule = (x) => String(x).replace('.', ',');
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric', month: 'long' });


/** Le grand chiffre d'une carte : plus il a de caractères, plus il est petit (« 192 » tient). */
function G(couleur, valeur) {
  const v = String(valeur);
  const taille = v.length <= 2 ? 34 : v.length === 3 ? 26 : 21;
  return `<p class="g ${couleur}" style="font-size:${taille * 3}px;font-size:${taille}cqw">${v}</p>`;
}

function carte({ fond, num, total, sur, corps }) {
  return `<article class="c c-${fond}">
    <div class="c-tete"><img src="/assets/logo-96.webp" alt="" width="22" height="22"><span>TAXI FOOD</span><b>${String(num).padStart(2, '0')}/${String(total).padStart(2, '0')}</b></div>
    <div class="c-corps">${sur ? `<p class="c-sur">${sur}</p>` : ''}${corps}</div>
    <div class="c-pied"><span>taxifoodnosybe.distripro207.com</span><i>${Array.from({ length: total }, (_, k) => `<u${k + 1 === num ? ' class="on"' : ''}></u>`).join('')}</i></div>
  </article>`;
}

function carrousel(b) {
  if (!b || !b.livraisons) return '';
  const cartes = [];
  const sem = (b.semaines ?? []).slice(-5);
  const maxSem = Math.max(1, ...sem.map((s) => s.c));
  const top = b.top ?? [];
  const maxTop = Math.max(1, ...top.map((t) => Number(t.q)));
  const logos = (b.logos ?? []).map((u) => `<img src="${img(u, 120)}" alt="" width="60" height="60">`).join('');
  const premiere = sem[0]?.c;
  const derniere = sem[sem.length - 1];
  const fois = premiere && derniere && sem.length > 1 ? virgule((derniere.c / premiere).toFixed(1)) : null;

  cartes.push({ fond: 'rouge', sur: '', corps: `
    <p class="c-sur">BILAN DES ${b.jours} PREMIERS JOURS</p>
    ${G('blanc', b.jours)}
    <p class="t">jours de Taxi Food.</p>
    <p class="s">Du ${fmtLong.format(new Date(b.depuis))} à aujourd’hui, à Nosy Be.</p>
    <p class="defile">FAIS DÉFILER →</p>` });

  cartes.push({ fond: 'noir', sur: 'LIVRAISONS DEPUIS LE 10 SEPTEMBRE', corps: `
    <div class="ligne">${G('or', b.livraisons)}<p class="t">livraisons en ${b.jours} jours</p></div>
    <div class="barres">${sem.map((s, k) => `<div class="b"><em>${s.c}</em><span style="height:${Math.round(12 + 70 * s.c / maxSem)}%"${k === sem.length - 1 ? ' class="rouge"' : ''}></span><small>Semaine ${s.n}<br>${fmtCourt.format(new Date(s.du))}</small></div>`).join('')}</div>
    ${fois ? `<p class="t2">La semaine ${derniere.n} a fait ${fois} fois la semaine 1.</p>` : ''}` });

  if (b.km_total) cartes.push({ fond: 'creme', sur: 'À MOTO', corps: `
    <p class="t rouge-t">Plus de</p>
    <div class="ligne">${G('rouge-t', milliers(b.km_total))}<p class="t">km</p></div>
    <p class="s">parcourus du restaurant jusqu’à la porte du client.</p>
    <div class="route"><span>📍</span><i></i><img src="/assets/logo-96.webp" alt="" width="26" height="26"><i></i><span>🏠</span></div>
    <div class="pastilles"><div><b>${virgule(b.km_moyen)} km</b>par livraison en moyenne</div></div>` });

  if (b.delai_median) cartes.push({ fond: 'rouge', sur: 'DÉLAI DE LIVRAISON', corps: `
    <div class="ligne">${G('blanc', b.delai_median)}<p class="t">min</p></div>
    <p class="s">de la commande à la porte du client. Une commande sur deux arrive plus vite.</p>
    <div class="pastilles">${b.pct_moins_1h ? `<div><b>${b.pct_moins_1h} %</b>livrées en moins d’1 heure</div>` : ''}${b.trajet_median ? `<div><b>${b.trajet_median} min</b>de trajet à moto</div>` : ''}</div>` });

  cartes.push({ fond: 'creme', sur: 'NOS RESTAURANTS', corps: `
    <div class="ligne">${G('rouge-t', b.restaurants)}<p class="t">restaurants</p></div>
    <p class="s">Ils étaient 2 au lancement. Le vôtre peut être le prochain.</p>
    <div class="logos">${logos}</div>` });

  if (top.length) cartes.push({ fond: 'noir', sur: 'CE QUI SE COMMANDE', corps: `
    <div class="ligne">${G('or', b.articles)}<p class="t">articles livrés</p></div>
    <p class="s">${b.plats_differents} plats différents.</p>
    <div class="top">${top.map((t) => `<div><span>${echapper(t.nom)}</span><i style="width:${Math.round(25 + 60 * Number(t.q) / maxTop)}%"></i><b>${t.q}</b></div>`).join('')}</div>` });

  if (b.paye_clients) cartes.push({ fond: 'rouge', sur: 'COMMANDES LIVRÉES', corps: `
    ${G('blanc', virgule((b.paye_clients / 1e6).toFixed(1)))}
    <p class="t">millions d’Ar</p>
    <p class="s">payés par les clients en ${b.jours} jours.</p>
    <div class="pastilles"><div><b>${milliers(b.panier_moyen)} Ar</b>le panier moyen</div></div>` });

  if (b.revient_restaurants) cartes.push({ fond: 'creme', sur: 'POUR LES RESTAURANTS', corps: `
    ${G('rouge-t', virgule((b.revient_restaurants / 1e6).toFixed(1)))}
    <p class="t">millions d’Ar</p>
    <p class="s">reviennent aux restaurants de Nosy Be, en ${b.jours} jours.</p>
    <div class="logos petits">${logos}</div>` });

  if (b.note) cartes.push({ fond: 'noir', sur: 'CE QU’EN DISENT LES CLIENTS', corps: `
    <div class="ligne">${G('or', virgule(b.note))}<p class="t">/ 5</p></div>
    <p class="etoiles">★★★★★ <small>sur ${b.nb_avis} avis</small></p>
    <div class="notes">${[['Cuisine', b.note_cuisine], ['Préparation', b.note_preparation], ['Livraison', b.note_livraison]].filter((x) => x[1])
      .map(([l, v]) => `<div><span>${l}</span><i style="width:${Math.round(Number(v) / 5 * 100)}%"></i><b>${virgule(v)}</b></div>`).join('')}</div>
    <div class="pastilles"><div><b>${b.clients} clients ont commandé.</b>${b.clients_revenus} sont déjà revenus.</div></div>` });

  return `<div class="carrousel" tabindex="0" aria-label="Bilan de Taxi Food, à faire défiler">${cartes.map((c, k) => carte({ ...c, num: k + 1, total: cartes.length })).join('')}</div>`;
}

function page(slug, d, etat) {
  const nom = d.nom;
  const n = echapper(nom);
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Bonjour Christopher, je viens de voir la page Taxi Food pour ${nom}.`)}`;
  const titre = `Taxi Food × ${nom}`;
  const desc = `Une proposition préparée pour ${nom} : de la visibilité, un nouveau canal de vente, du chiffre d’affaires en plus sans charges en plus.`;
  const rdv = d.rdv ? new Date(d.rdv.debut) : null;

  const bandeau = etat.ok === 'rdv' && rdv
    ? `<div class="ok">✅ C’est noté : rendez-vous le <b>${echapper(fmtJour.format(rdv))} à ${heure(rdv)}</b>. Christopher passe vous voir.</div>`
    : etat.ok === 'rappel' ? '<div class="ok">✅ C’est noté : Christopher vous rappelle très vite.</div>'
    : etat.erreur ? `<div class="err">${echapper(ERREURS[etat.erreur] ?? ERREURS.technique)}</div>` : '';

  const jours = creneauxParJour(d.creneaux ?? []);
  const formRdv = rdv
    ? `<p class="confirme">📅 Rendez-vous confirmé : <b>${echapper(fmtJour.format(rdv))} à ${heure(rdv)}</b>.<br>Un empêchement ? <a href="${wa}">Prévenez-nous sur WhatsApp</a>.</p>`
    : jours.length === 0
    ? `<p>Pas de créneau libre en ce moment : <a href="${wa}">écrivez-nous sur WhatsApp</a>.</p>`
    : `<form method="post" class="form">
        <input type="hidden" name="action" value="rdv">
        ${/* D'abord le jour, puis ses heures (demande du porteur du projet, 19/10). Sans JavaScript :
             radios de jour cachés + sélecteur de frère « ~ », pour le navigateur intégré de WhatsApp. */ ''}
        ${jours.map((j, k) => `<input class="choix-jour" type="radio" name="jour" id="j${k}">`).join('')}
        <p class="etape-rdv">1. Le jour</p>
        <div class="jours">${jours.map((j, k) => `<label for="j${k}" class="jr"><small>${echapper(j.jour)}</small><b>${echapper(j.num)}</b></label>`).join('')}</div>
        <p class="etape-rdv">2. L’heure</p>
        <div class="panneaux">
          <p class="aide">Choisissez d’abord un jour.</p>
          ${jours.map((j, k) => `<div class="heures p${k}">${j.heures.map((h) =>
            `<label class="h"><input type="radio" name="debut" value="${echapper(h.iso)}" required><span>${h.h}</span></label>`).join('')}</div>`).join('')}
        </div>
        <label class="champ">Votre nom<input name="nom" autocomplete="name" required minlength="2" maxlength="80"></label>
        <label class="champ">Votre téléphone<input name="telephone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="034 00 000 00" maxlength="30"></label>
        <button class="cta rouge" type="submit">Réserver ce créneau</button>
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800;900&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; --rouge:#E8342A; --or:#FFC72C; --noir:#161616; --creme:#F7EEDD; --encre:#1A1A1A; --gris:#5C554E; --fond:#FFF8F0; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:Archivo,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--fond); color:var(--encre); }
  main { max-width:560px; margin:0 auto; padding:0 16px 48px; overflow-x:hidden; }
  header { display:flex; align-items:center; gap:10px; padding:14px 0; }
  header img { width:36px; height:36px; border-radius:10px; }
  header span { font-weight:800; }
  header small { margin-left:auto; color:var(--gris); font-size:12px; text-align:right; }
  .hero { background:var(--rouge); color:#fff; border-radius:22px; padding:22px 20px; border-bottom:6px solid var(--or); }
  .hero .sur { color:var(--or); font-size:12px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; margin:0 0 8px; }
  .hero h1 { font-size:30px; line-height:1.08; margin:0 0 18px; font-weight:900; }
  a.cta, button.cta { display:block; width:100%; text-align:center; background:var(--or); color:var(--encre); border:0; text-decoration:none;
    font-weight:800; font-size:17px; padding:15px; border-radius:999px; cursor:pointer; font-family:inherit; }
  button.cta.rouge { background:var(--rouge); color:#fff; margin-top:16px; }
  a.cta2 { display:block; text-align:center; margin-top:10px; color:#fff; border:2px solid rgba(255,255,255,.7); text-decoration:none; font-weight:700; padding:12px; border-radius:999px; }
  h2 { font-size:22px; font-weight:900; margin:30px 0 12px; }

  /* Carrousel : une carte = une carte du bilan publié (4:5). */
  .carrousel { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; margin:0 -16px; padding:0 16px 8px; scrollbar-width:none; }
  .carrousel::-webkit-scrollbar { display:none; }
  .c { flex:0 0 min(84vw, 360px); aspect-ratio:4/5; scroll-snap-align:center; border-radius:18px; overflow:hidden; display:flex; flex-direction:column;
       container-type:inline-size; }
  .c-rouge { background:var(--rouge); color:#fff; } .c-noir { background:var(--noir); color:#fff; } .c-creme { background:var(--creme); color:var(--encre); }
  .c-tete { display:flex; align-items:center; gap:7px; padding:12px 16px 10px; border-bottom:2px solid var(--or); font-size:11px; font-weight:800; letter-spacing:.12em; }
  .c-tete img { border-radius:5px; } .c-tete b { margin-left:auto; font-weight:700; }
  .c-corps { flex:1; padding:14px 16px 0; display:flex; flex-direction:column; min-height:0; }
  .c-sur { font-size:11px; font-weight:800; letter-spacing:.12em; margin:0 0 4px; }
  .c-rouge .c-sur, .c-noir .c-sur { color:var(--or); } .c-creme .c-sur { color:var(--encre); }
  .g { font-size:96px; font-size:34cqw; font-weight:900; line-height:.85; letter-spacing:-.04em; margin:0; }
  .g.or { color:var(--or); } .g.blanc { color:#fff; } .rouge-t { color:var(--rouge); }
  .t { font-size:24px; font-size:7.6cqw; font-weight:900; line-height:1.05; margin:6px 0 0; }
  .t2 { font-size:15px; font-size:4.6cqw; font-weight:800; margin:10px 0 0; }
  .s { font-size:14px; font-size:4.2cqw; line-height:1.3; margin:10px 0 0; opacity:.92; }
  .ligne { display:flex; align-items:flex-end; gap:4px 10px; flex-wrap:wrap; } .ligne .t { margin:0 0 .2em; }
  .defile { margin-top:auto; margin-bottom:6px; color:var(--or); font-size:12px; font-weight:800; letter-spacing:.12em; }
  .barres { display:flex; gap:8px; align-items:flex-end; flex:1; min-height:110px; margin-top:12px; background:#232323; border-radius:12px; padding:10px 10px 8px; }
  .barres .b { flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:4px; }
  .barres em { font-style:normal; font-weight:900; font-size:15px; }
  .barres span { width:100%; background:var(--or); border-radius:6px 6px 2px 2px; display:block; }
  .barres span.rouge { background:var(--rouge); }
  .barres small { font-size:9px; text-align:center; line-height:1.15; opacity:.85; }
  .pastilles { display:flex; gap:8px; margin-top:auto; margin-bottom:10px; }
  .pastilles div { flex:1; background:var(--noir); color:#fff; border-radius:12px; padding:9px 10px; font-size:11px; line-height:1.25; }
  .c-noir .pastilles div { background:#2A2A2A; }
  .pastilles b { display:block; color:var(--or); font-size:19px; font-size:5.6cqw; font-weight:900; margin-bottom:2px; }
  .route { display:flex; align-items:center; gap:6px; margin:16px 0 8px; font-size:22px; }
  .route i { flex:1; border-top:3px dotted var(--encre); } .route img { border-radius:6px; }
  .logos { display:flex; flex-wrap:wrap; gap:10px; margin-top:auto; margin-bottom:12px; justify-content:center; }
  .logos img { width:60px; height:60px; border-radius:50%; object-fit:cover; background:#fff; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,.15); }
  .logos.petits img { width:44px; height:44px; }
  .top { display:flex; flex-direction:column; gap:7px; margin-top:auto; margin-bottom:12px; }
  .top div { display:flex; align-items:center; gap:8px; font-size:12px; }
  .top span { flex:0 0 38%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .top i { height:13px; background:var(--or); border-radius:4px; display:block; }
  .top b { color:var(--or); }
  .etoiles { color:var(--or); font-size:22px; margin:8px 0 0; letter-spacing:2px; } .etoiles small { color:#fff; font-size:12px; letter-spacing:0; }
  .notes { display:flex; flex-direction:column; gap:6px; margin-top:12px; }
  .notes div { display:flex; align-items:center; gap:8px; font-size:12px; }
  .notes span { flex:0 0 30%; } .notes i { height:7px; background:var(--or); border-radius:4px; display:block; max-width:52%; } .notes b { color:var(--or); margin-left:auto; }
  .c-pied { display:flex; align-items:center; padding:8px 16px 12px; font-size:10px; opacity:.85; }
  .c-pied i { margin-left:auto; display:flex; gap:3px; } .c-pied u { width:4px; height:4px; border-radius:50%; background:currentColor; opacity:.35; display:block; }
  .c-pied u.on { opacity:1; background:var(--or); width:10px; border-radius:3px; }

  .args { display:grid; grid-template-columns:1fr; gap:8px; }
  .arg { display:flex; gap:12px; align-items:center; background:#fff; border-radius:14px; padding:12px 14px; border:1px solid #F0E6DA; }
  .arg span { font-size:26px; } .arg b { display:block; font-size:16px; } .arg small { color:var(--gris); font-size:13px; }
  .visuels { display:flex; gap:10px; overflow-x:auto; scroll-snap-type:x mandatory; margin:0 -16px; padding:0 16px 6px; scrollbar-width:none; }
  .visuels::-webkit-scrollbar { display:none; }
  .visuels img { flex:0 0 auto; width:min(70vw, 300px); height:auto; aspect-ratio:4/5; object-fit:cover; border-radius:14px; scroll-snap-align:center; background:#F0E6DA; }
  .liens { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
  a.lien { display:flex; align-items:center; justify-content:center; gap:8px; text-decoration:none; font-weight:800; font-size:14px;
           padding:13px 10px; border-radius:999px; text-align:center; line-height:1.15; }
  a.lien.fb { background:#1877F2; color:#fff; }
  a.lien.web { background:var(--noir); color:#fff; }
  ol.etapes { padding:0; margin:0; list-style:none; display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  ol.etapes li { background:#fff; border-radius:14px; padding:12px; border:1px solid #F0E6DA; font-size:14px; line-height:1.3; font-weight:600; }
  ol.etapes li span { display:block; font-size:24px; margin-bottom:4px; }
  #rdv { background:#fff; border-radius:20px; padding:18px 16px; border:2px solid var(--rouge); margin-top:30px; }
  #rdv h2 { margin-top:0; }
  .choix-jour { position:absolute; opacity:0; pointer-events:none; }
  .etape-rdv { font-weight:800; font-size:14px; margin:14px 0 8px; color:var(--gris); text-transform:uppercase; letter-spacing:.06em; }
  .jours { display:flex; gap:8px; overflow-x:auto; margin:0 -16px; padding:0 16px 4px; scrollbar-width:none; }
  .jours::-webkit-scrollbar { display:none; }
  .jr { flex:0 0 auto; min-width:70px; text-align:center; padding:10px 8px; border-radius:12px; border:1.5px solid #E2D6C8; cursor:pointer; }
  .jr small { display:block; font-size:12px; color:var(--gris); font-weight:700; }
  .jr b { display:block; font-size:16px; }
  .panneaux .heures { display:none; }
  .panneaux .aide { color:var(--gris); font-size:14px; margin:0; }
  .choix-jour:checked ~ .panneaux .aide { display:none; }
  #j0:checked ~ .panneaux .p0 { display:flex; }
  #j0:checked ~ .jours .jr[for="j0"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j0:checked ~ .jours .jr[for="j0"] small { color:#fff; }
  #j1:checked ~ .panneaux .p1 { display:flex; }
  #j1:checked ~ .jours .jr[for="j1"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j1:checked ~ .jours .jr[for="j1"] small { color:#fff; }
  #j2:checked ~ .panneaux .p2 { display:flex; }
  #j2:checked ~ .jours .jr[for="j2"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j2:checked ~ .jours .jr[for="j2"] small { color:#fff; }
  #j3:checked ~ .panneaux .p3 { display:flex; }
  #j3:checked ~ .jours .jr[for="j3"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j3:checked ~ .jours .jr[for="j3"] small { color:#fff; }
  #j4:checked ~ .panneaux .p4 { display:flex; }
  #j4:checked ~ .jours .jr[for="j4"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j4:checked ~ .jours .jr[for="j4"] small { color:#fff; }
  #j5:checked ~ .panneaux .p5 { display:flex; }
  #j5:checked ~ .jours .jr[for="j5"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j5:checked ~ .jours .jr[for="j5"] small { color:#fff; }
  #j6:checked ~ .panneaux .p6 { display:flex; }
  #j6:checked ~ .jours .jr[for="j6"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j6:checked ~ .jours .jr[for="j6"] small { color:#fff; }
  #j7:checked ~ .panneaux .p7 { display:flex; }
  #j7:checked ~ .jours .jr[for="j7"] { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  #j7:checked ~ .jours .jr[for="j7"] small { color:#fff; }
  .choix-jour:focus-visible ~ .jours { outline:3px solid var(--or); }
  fieldset { border:0; padding:0; margin:0 0 12px; }
  legend { font-weight:800; margin-bottom:6px; font-size:15px; }
  .heures { display:flex; flex-wrap:wrap; gap:8px; }
  .h input { position:absolute; opacity:0; pointer-events:none; }
  .h span { display:inline-block; min-width:68px; text-align:center; padding:10px 8px; border-radius:10px; border:1.5px solid #E2D6C8; font-weight:700; cursor:pointer; }
  .h input:checked + span { background:var(--rouge); border-color:var(--rouge); color:#fff; }
  .h input:focus-visible + span { outline:3px solid var(--or); }
  .champ { display:block; font-size:14px; font-weight:700; margin:12px 0 0; }
  .champ input, .champ textarea { display:block; width:100%; margin-top:6px; font-size:16px; padding:12px; border-radius:12px; border:1.5px solid #E2D6C8; font-family:inherit; background:#fff; }
  .petit { font-size:13px; color:var(--gris); text-align:center; margin:8px 0 0; }
  details { margin-top:16px; } summary { cursor:pointer; font-weight:700; color:var(--rouge); }
  .ok, .err { border-radius:14px; padding:14px; margin:0 0 14px; line-height:1.45; }
  .ok { background:#E7F6EC; color:#145A2E; } .err { background:#FDECEA; color:#8A1C14; }
  .fondateur { display:flex; gap:14px; align-items:center; margin-top:28px; }
  .fondateur img { width:64px; height:64px; border-radius:50%; object-fit:cover; flex:none; }
  .fondateur p { margin:0; color:var(--gris); line-height:1.4; font-size:15px; }
  footer { margin-top:24px; text-align:center; font-size:13px; color:var(--gris); }
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
    <a class="cta" href="#rdv">${rdv ? 'Voir mon rendez-vous' : 'Choisir un créneau (20 min)'}</a>
    <a class="cta2" href="${wa}">Écrire sur WhatsApp</a>
  </section>

  <h2>Ça tourne déjà</h2>
  ${carrousel(d.bilan)}

  <h2>Ce que vous y gagnez</h2>
  <div class="args">
    <div class="arg"><span>📣</span><div><b>De la visibilité</b><small>Vos plats sur nos réseaux et dans l’application.</small></div></div>
    <div class="arg"><span>💰</span><div><b>Du chiffre en plus, pas de charges en plus</b><small>Pas de livreur, pas de scooter, pas d’abonnement.</small></div></div>
    <div class="arg"><span>🛵</span><div><b>Un nouveau canal de vente</b><small>Touristes, résidents, commandes du soir.</small></div></div>
  </div>

  <h2>Ce qu’on publie pour nos restaurants</h2>
  <div class="visuels">${EXEMPLES.map((e) => `<img src="${img(e.f, 600)}" alt="${echapper(e.l)}" width="600" height="750" decoding="async">`).join('')}</div>
  <div class="liens">
    <a class="lien fb" href="${FACEBOOK}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.5 1.6-1.5h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3z"/></svg>Voir notre page Facebook</a>
    <a class="lien web" href="${APP_WEB}" target="_blank" rel="noopener"><span aria-hidden="true">🛵</span>Voir l’application</a>
  </div>

  <h2>Comment ça se passe</h2>
  <ol class="etapes">
    <li><span>🤝</span>On se voit 20 min chez vous</li>
    <li><span>📸</span>On met votre carte en ligne</li>
    <li><span>📲</span>Vous acceptez les commandes d’un appui</li>
    <li><span>🛵</span>On livre, vous êtes payé (Orange Money)</li>
  </ol>

  <section id="rdv">
    <h2>${rdv ? 'Votre rendez-vous' : 'Choisissez un créneau'}</h2>
    ${formRdv}
    ${rdv ? '' : `<details>
      <summary>Aucun créneau ne vous va ? Être rappelé</summary>
      <form method="post" class="form">
        <input type="hidden" name="action" value="rappel">
        <label class="champ">Votre nom<input name="nom" autocomplete="name" required minlength="2" maxlength="80"></label>
        <label class="champ">Votre téléphone<input name="telephone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30"></label>
        <label class="champ">Quand vous joindre ? (facultatif)<textarea name="message" rows="2" maxlength="500"></textarea></label>
        <button class="cta rouge" type="submit">Me rappeler</button>
      </form>
    </details>`}
  </section>

  <div class="fondateur">
    <img src="/img/fondateur/christopher-192.webp" alt="Christopher" width="64" height="64">
    <p><b>Christopher</b>, fondateur de Taxi Food.<br>« Je serais ravi d’ajouter ${n} sur Taxi Food. »</p>
  </div>

  <footer><a href="${wa}">WhatsApp ${WHATSAPP_AFFICHE}</a></footer>
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
