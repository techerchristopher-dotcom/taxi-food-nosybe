/**
 * Désinscription des ANNONCES par e-mail — sans compte, sans mot de passe.
 *
 * ⚠️ CE QU'ELLE COUPE, ET CE QU'ELLE NE COUPE PAS. Elle ne porte QUE sur les
 * annonces (« Nouveau restaurant », « L'appli s'est mise à jour »). Les e-mails
 * liés à une commande — reçue, acceptée, livrée, remboursée — continuent
 * toujours : ce ne sont pas des messages commerciaux, ce sont la trace de ce que
 * la personne a acheté, et les couper serait un service dégradé, pas un service
 * respectueux. Chaque page le dit en toutes lettres, sinon la personne croit
 * avoir tout arrêté et s'inquiète à sa commande suivante.
 *
 * ⚠️ L'AUTORISATION EST LE JETON, et il n'est PAS l'identifiant du compte. Même
 * patron que `repondre-commande` : un uuid imprévisible, propre à UNE personne,
 * qui ne permet QUE de se désinscrire ou de se réabonner. Mettre `user_id` dans
 * l'URL laisserait n'importe qui désinscrire n'importe qui.
 *
 * ⚠️ LE CLIC DÉSINSCRIT TOUT DE SUITE. C'est la promesse du lien : un clic
 * suffit, pas de page intermédiaire, pas de formulaire. Le bouton « Me
 * réabonner » est là, juste dessous, pour rattraper un clic malheureux — ou un
 * robot d'antivirus qui aurait suivi le lien à la place de son destinataire.
 *
 * ⚠️ LA BASE NE DIT JAMAIS L'ADRESSE EN CLAIR : la RPC rend `ch•••@gmail.com`.
 * Assez pour se reconnaître, pas assez pour récolter un annuaire avec un jeton
 * trouvé quelque part.
 *
 * ⚠️ On ne distingue jamais « jeton faux » de « jeton inconnu » : même page.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const SITE = 'https://taxifoodnosybe.distripro207.com';

const LANGUES = ['fr', 'en', 'it'];

const T = {
  fr: {
    lang: 'fr',
    accueil: '/',
    titreOnglet: 'Annonces Taxi Food',
    partiTitre: 'C’est fait',
    partiCorps: 'Tu ne recevras plus les annonces Taxi Food par e-mail.',
    dejaTitre: 'C’était déjà fait',
    dejaCorps: 'Tu ne reçois plus les annonces Taxi Food par e-mail.',
    revenuTitre: 'Te revoilà',
    revenuCorps: 'Tu recevras de nouveau les annonces Taxi Food par e-mail.',
    encoreTitre: 'Tu es bien abonné',
    encoreCorps: 'Tu reçois les annonces Taxi Food par e-mail.',
    reserve:
      'Les e-mails liés à tes commandes — reçue, acceptée, livrée, remboursée — continueront de t’arriver. Ce n’est pas de la publicité, c’est le suivi de ce que tu commandes.',
    pourCompte: 'Pour le compte',
    seReabonner: 'Me réabonner aux annonces',
    seDesinscrire: 'Ne plus recevoir les annonces',
    versSite: 'Aller sur Taxi Food',
    inconnuTitre: 'Lien inutilisable',
    inconnuCorps:
      'Ce lien ne mène nulle part. Il a peut-être été recopié en partie. Ouvre le dernier e-mail Taxi Food que tu as reçu et clique le lien qu’il contient.',
    panneTitre: 'Indisponible',
    panneCorps: 'Réessaie dans un instant.',
  },
  en: {
    lang: 'en',
    accueil: '/en/',
    titreOnglet: 'Taxi Food announcements',
    partiTitre: 'Done',
    partiCorps: 'You will no longer receive Taxi Food announcements by email.',
    dejaTitre: 'Already done',
    dejaCorps: 'You no longer receive Taxi Food announcements by email.',
    revenuTitre: 'Welcome back',
    revenuCorps: 'You will receive Taxi Food announcements by email again.',
    encoreTitre: 'You are subscribed',
    encoreCorps: 'You receive Taxi Food announcements by email.',
    reserve:
      'Emails about your orders — received, accepted, delivered, refunded — will keep reaching you. That is not advertising, it is the tracking of what you ordered.',
    pourCompte: 'For the account',
    seReabonner: 'Subscribe again',
    seDesinscrire: 'Stop receiving announcements',
    versSite: 'Go to Taxi Food',
    inconnuTitre: 'This link does not work',
    inconnuCorps:
      'This link leads nowhere. It may have been copied only in part. Open the latest Taxi Food email you received and click the link inside it.',
    panneTitre: 'Unavailable',
    panneCorps: 'Please try again in a moment.',
  },
  it: {
    lang: 'it',
    accueil: '/it/',
    titreOnglet: 'Annunci Taxi Food',
    partiTitre: 'Fatto',
    partiCorps: 'Non riceverai più gli annunci Taxi Food via e-mail.',
    dejaTitre: 'Era già fatto',
    dejaCorps: 'Non ricevi più gli annunci Taxi Food via e-mail.',
    revenuTitre: 'Bentornato',
    revenuCorps: 'Riceverai di nuovo gli annunci Taxi Food via e-mail.',
    encoreTitre: 'Sei iscritto',
    encoreCorps: 'Ricevi gli annunci Taxi Food via e-mail.',
    reserve:
      'Le e-mail legate ai tuoi ordini — ricevuto, accettato, consegnato, rimborsato — continueranno ad arrivarti. Non è pubblicità, è il seguito di ciò che hai ordinato.',
    pourCompte: 'Per l’account',
    seReabonner: 'Iscrivermi di nuovo',
    seDesinscrire: 'Non ricevere più gli annunci',
    versSite: 'Vai su Taxi Food',
    inconnuTitre: 'Link inutilizzabile',
    inconnuCorps:
      'Questo link non porta da nessuna parte. Forse è stato copiato solo in parte. Apri l’ultima e-mail Taxi Food che hai ricevuto e clicca il link che contiene.',
    panneTitre: 'Non disponibile',
    panneCorps: 'Riprova tra un istante.',
  },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * La langue : le paramètre `?l=` d'abord (c'est un choix explicite, fait sur
 * cette page), l'en-tête du navigateur ensuite, le français pour finir.
 * ⚠️ L'e-mail, lui, est écrit dans UNE langue par une personne : le lien qu'il
 * porte ne présume donc rien, et les trois langues restent à un clic.
 */
function langueDe(url, request) {
  const choisie = (url.searchParams.get('l') || '').toLowerCase();
  if (LANGUES.includes(choisie)) return T[choisie];
  const entete = (request.headers.get('accept-language') || '').toLowerCase();
  for (const code of entete.split(',').map((p) => p.trim().slice(0, 2))) {
    if (LANGUES.includes(code)) return T[code];
  }
  return T.fr;
}

function page(t, { emoji, titre, corps, email, jeton, actif, statut = 200 }) {
  // Le bouton principal est TOUJOURS celui qui rattrape : après une
  // désinscription on propose de revenir, après un réabonnement on propose de
  // repartir. La personne n'est jamais enfermée dans son dernier clic.
  const action = actif ? 'desinscrire' : 'reabonner';
  const libelle = actif ? t.seDesinscrire : t.seReabonner;
  const geste = jeton
    ? `<form method="post" action="/d/${esc(jeton)}?l=${t.lang}">
         <input type="hidden" name="action" value="${action}">
         <button class="b" type="submit">${esc(libelle)}</button>
       </form>`
    : '';

  const autres = LANGUES.filter((l) => l !== t.lang)
    .map((l) => jeton
      ? `<a href="/d/${esc(jeton)}?l=${l}&amp;vue=1">${l.toUpperCase()}</a>`
      : `<a href="${T[l].accueil}">${l.toUpperCase()}</a>`)
    .join(' · ');

  return new Response(
    `<!doctype html><html lang="${t.lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(t.titreOnglet)} — Taxi Food</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#F5F2EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px}
 .c{background:#fff;border-radius:24px;padding:32px 26px;max-width:460px;width:100%;text-align:center;
    box-shadow:0 4px 24px rgba(26,26,26,.08)}
 .m{font:800 18px/1 Arial,sans-serif;color:#DF3228;letter-spacing:-.02em}
 .e{font-size:50px;line-height:1;margin-top:22px}
 h1{font-size:22px;margin:14px 0 0;color:#1A1A1A}
 p{color:#4A4744;line-height:1.6;margin:12px 0 0;font-size:15px}
 .r{margin-top:18px;background:#F7F4F1;border-radius:14px;padding:14px 16px;color:#6B6662;font-size:13.5px;line-height:1.55;text-align:left}
 .a{margin-top:16px;color:#8A827A;font-size:13px}
 .b{display:inline-block;margin-top:22px;background:#DF3228;color:#fff;border:0;cursor:pointer;
    text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px;font-family:inherit}
 .s{display:inline-block;margin-top:14px;color:#8A827A;text-decoration:none;font-size:14px}
 .l{margin-top:22px;padding-top:16px;border-top:1px solid #E9E5E0;color:#8A827A;font-size:12px}
 .l a{color:#8A827A}
</style></head><body><div class="c">
<div class="m">TAXI FOOD</div>
<div class="e">${emoji}</div>
<h1>${esc(titre)}</h1>
<p>${esc(corps)}</p>
${email ? `<div class="a">${esc(t.pourCompte)} ${esc(email)}</div>` : ''}
<div class="r">${esc(t.reserve)}</div>
${geste}
<div><a class="s" href="${SITE}${t.accueil}">${esc(t.versSite)}</a></div>
<div class="l">${autres}</div>
</div></body></html>`,
    {
      status: statut,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // ⚠️ Jamais de cache : la page dit un ÉTAT, et cet état vient de changer.
        'cache-control': 'no-store',
      },
    },
  );
}

async function appeler(jeton, action) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/annonce_desinscription_par_jeton`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_jeton: jeton, p_action: action }),
  });
  return await r.json();
}

export default async (request) => {
  const url = new URL(request.url);
  const t = langueDe(url, request);

  const m = url.pathname.match(/^\/d\/([0-9a-f-]{36})\/?$/i);
  if (!m) {
    return page(t, { emoji: '🤔', titre: t.inconnuTitre, corps: t.inconnuCorps, statut: 400 });
  }
  const jeton = m[1];

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[desinscription] variables Supabase absentes');
    return page(t, { emoji: '⚠️', titre: t.panneTitre, corps: t.panneCorps, statut: 500 });
  }

  // Ce que ce passage doit faire.
  //  - POST : le geste explicite d'un bouton (se réabonner, ou se redésinscrire).
  //  - GET avec `vue=1` : un simple changement de langue, on ne retouche à rien.
  //  - GET nu : le clic depuis l'e-mail — il désinscrit, c'est sa promesse.
  let action = 'etat';
  if (request.method === 'POST') {
    try {
      const form = await request.formData();
      const demande = String(form.get('action') || '');
      action = demande === 'reabonner' || demande === 'desinscrire' ? demande : 'etat';
    } catch {
      action = 'etat';
    }
  } else if (url.searchParams.get('vue') !== '1') {
    action = 'desinscrire';
  }

  let d;
  try {
    d = await appeler(jeton, action);
  } catch (e) {
    console.error('[desinscription]', e);
    return page(t, { emoji: '⚠️', titre: t.panneTitre, corps: t.panneCorps, statut: 500 });
  }

  if (!d?.ok) {
    return page(t, { emoji: '🤔', titre: t.inconnuTitre, corps: t.inconnuCorps, statut: 400 });
  }

  const actif = d.actif === true;
  // ⚠️ Le titre dit ce qui vient de se PASSER, pas seulement l'état : « c'est
  // fait » quand le clic a changé quelque chose, « c'était déjà fait » quand il
  // n'a rien changé. C'est la base qui le dit (`change`), pas une déduction
  // d'ici : un second clic, ou un robot d'antivirus qui suit le lien avant son
  // destinataire, afficherait sinon « c'est fait » sur une action déjà faite —
  // et la personne se demanderait si la première avait raté.
  const change = d.change === true;
  const titre = actif
    ? (change ? t.revenuTitre : t.encoreTitre)
    : (change ? t.partiTitre : t.dejaTitre);
  const corps = actif
    ? (change ? t.revenuCorps : t.encoreCorps)
    : (change ? t.partiCorps : t.dejaCorps);

  return page(t, {
    emoji: actif ? '📣' : '👋',
    titre,
    corps,
    email: d.email ?? null,
    jeton,
    actif,
  });
};

export const config = { path: '/d/:jeton' };
