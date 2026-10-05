/**
 * Acceptation / refus d'une commande depuis un lien — sans compte.
 *
 * Le restaurateur recoit une notification Telegram avec deux boutons. Il touche
 * « J'accepte », arrive ici, et la commande passe en « confirmee » dans
 * l'application, ce qui declenche tout le reste (notification au client,
 * disponibilite pour les livreurs).
 *
 * ⚠️ POURQUOI UN LIEN ET PAS UN COMPTE : aucun restaurateur n'a de compte
 * aujourd'hui, et leur en imposer un tuerait l'interet de Telegram, dont la
 * force est justement de ne rien demander a installer ni a configurer.
 *
 * ⚠️ L'AUTORISATION EST LE JETON. Il est imprevisible (uuid), propre a UNE
 * commande, et ne permet QUE d'accepter ou de refuser depuis l'etat « recue ».
 * Un lien transfere, rejoue, ou trouve apres coup ne fait donc rien du tout.
 *
 * ⚠️ On ne dit jamais qu'un jeton est faux plutot qu'un identifiant inconnu :
 * la page repond la meme chose dans les deux cas.
 *
 * ⚠️ REFUS EN DEUX TEMPS (2026-10-05). Avant, un simple GET sur /r-refus/… annulait la
 * commande, avec le motif fixe « Refusée par le restaurant depuis Telegram » : le client ne
 * savait pas pourquoi, et un robot d'apercu de lien qui ouvrait l'URL l'aurait annulee.
 * Desormais :
 *   GET  /r-refus/<id>/<jeton> → LECTURE SEULE (consulter_commande_par_jeton) + formulaire :
 *        un motif en un tap, une precision libre facultative (200 car.), « Confirmer ».
 *   POST /r-refus/<id>/<jeton> → le refus, avec p_code + p_precision. La base compose le
 *        texte lisible (orders.cancellation_reason) : l'ecran n'est jamais l'autorite.
 * L'acceptation (/a/…) reste en un seul GET, comme avant.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE = 'https://taxifoodnosybe.distripro207.com';

// ⚠️ NE PAS CONFONDRE LES DEUX ADRESSES.
//   SITE = le site vitrine, qui presente Taxi Food au public.
//   APP  = l'application, ou le restaurateur voit ses commandes.
// Le bouton de cette page renvoyait sur SITE : le restaurateur venait d'accepter
// une commande et atterrissait sur une page de presentation, sans sa commande
// nulle part. Il faut l'amener LA OU EST SON TRAVAIL.
//
// ⚠️ La racine de l'app suffit : `app/index.tsx` aiguille un compte a role
// restaurant ACTIF directement vers son espace « Commandes en cours ». Pointer
// vers un chemin interne du groupe `(restaurant)` serait plus fragile — ces
// groupes ne se retrouvent pas dans l'URL, et l'aiguillage vit dans le code.
const APP = 'https://taxifood.distripro207.com';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Langue du restaurant (restaurants.langue, renvoyee par repondre_commande_par_jeton
// APRES verification du jeton). 'it' pour Les Siciliens depuis le 2026-10-02. Les pages
// d'erreur qui precedent l'appel (lien incomplet, base injoignable) restent en francais :
// on ne sait pas encore a quel restaurant on parle.
const IT = {
  ouvrir: 'Apri il mio spazio',
  acceptee: (n) => `Ordine ${n} accettato`,
  accepteeAuto: 'Fatto. Il cliente è stato appena avvisato. L’ordine passa in preparazione da solo in meno di un minuto: dovrai solo segnarlo come pronto nel tuo spazio.',
  accepteeManuel: 'Fatto. Il cliente è stato appena avvisato. Apri il tuo spazio per metterlo in preparazione, poi segnarlo come pronto.',
  voir: (n) => `Vedi l’ordine ${n ?? ''}`.trim(),
  refusee: (n) => `Ordine ${n} rifiutato`,
  refuseeCorps: 'Il cliente è stato appena avvisato. Non deve pagare nulla.',
  historique: 'Vedi la cronologia',
  dejaTitre: 'Già gestito',
  deja: (s) => `Questo ordine è già « ${s} ». Non c’è altro da fare.`,
  refusTitre: (n) => `Rifiutare l’ordine ${n}?`,
  refusSous: 'Scegli il motivo: il cliente lo vedrà.',
  precision: 'Dettaglio per il cliente (facoltativo)',
  precisionEx: 'es.: pollo finito stasera',
  confirmer: 'Conferma il rifiuto',
  renoncer: 'Non voglio rifiutare: chiudi semplicemente questa pagina.',
  erreurMotif: 'Scegli un motivo.',
  erreurAutre: 'Con « Altro motivo », scrivi due parole per il cliente.',
  motifTransmis: 'Motivo inviato al cliente:',
  statuts: { confirmee: 'confermato', en_preparation: 'in preparazione', en_livraison: 'in consegna',
             livree: 'consegnato', annulee: 'annullato' },
};

// Motifs de refus : MEMES codes que la base (orders_cancellation_code_check,
// libelle_motif_refus). Le libelle affiche ici est la phrase que lira le client.
const MOTIFS = [
  { code: 'rupture', emoji: '🍗',
    fr: 'Un ou plusieurs plats ne sont plus disponibles', it: 'Uno o più piatti non sono più disponibili' },
  { code: 'trop_de_commandes', emoji: '🔥',
    fr: 'Trop de commandes en ce moment', it: 'Troppi ordini in questo momento' },
  { code: 'fermeture', emoji: '🔒',
    fr: 'Le restaurant ferme ou est fermé', it: 'Il ristorante sta chiudendo o è chiuso' },
  { code: 'livraison_impossible', emoji: '📍',
    fr: 'Adresse trop éloignée ou non desservie', it: 'Indirizzo troppo lontano o non servito' },
  { code: 'autre', emoji: '✏️',
    fr: 'Autre raison (à préciser ci-dessous)', it: 'Altro motivo (da specificare sotto)' },
];
const CODES = new Set(MOTIFS.map((m) => m.code));
const PRECISION_MAX = 200;

const HTML = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
               // La page porte le jeton dans son URL : pas de referer vers ailleurs.
               'referrer-policy': 'no-referrer' };

/** Formulaire de refus. Aucun JavaScript : boutons radio + textarea + un bouton. */
function formulaireRefus({ numero, langue, erreur = null, code = null, precision = '' }) {
  const it = langue === 'it';
  const titre = it ? IT.refusTitre(numero) : `Refuser la commande ${numero} ?`;
  const choix = MOTIFS.map((m) => `<label class="m"><input type="radio" name="code" value="${m.code}"${
    m.code === code ? ' checked' : ''} required><span>${m.emoji}&nbsp; ${esc(it ? m.it : m.fr)}</span></label>`).join('');
  return `<!doctype html><html lang="${it ? 'it' : 'fr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titre)} — Taxi Food</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#F5F2EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px}
 .c{background:#fff;border-radius:24px;padding:28px 20px;max-width:440px;width:100%;
    box-shadow:0 4px 24px rgba(26,26,26,.08)}
 h1{font-size:22px;margin:0;color:#1A1A1A;text-align:center}
 .s{color:#4A4744;line-height:1.5;margin:8px 0 18px;text-align:center}
 .m{display:block;margin:0 0 10px;cursor:pointer}
 .m input{position:absolute;opacity:0;pointer-events:none}
 .m span{display:block;border:2px solid #E5DFD9;border-radius:16px;padding:14px 16px;font-size:16px;
         color:#1A1A1A;line-height:1.35}
 .m input:checked+span{border-color:#DF3228;background:#FDECEA;font-weight:700}
 .m input:focus-visible+span{outline:3px solid #1A1A1A;outline-offset:2px}
 .l{display:block;font-weight:700;color:#1A1A1A;margin:16px 0 6px}
 textarea{box-sizing:border-box;width:100%;min-height:84px;border:2px solid #E5DFD9;border-radius:16px;
          padding:12px 14px;font:inherit;font-size:16px;resize:vertical}
 .n{color:#8A827A;font-size:13px;text-align:right;margin-top:4px}
 .err{background:#FDECEA;color:#9B1C14;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-weight:600}
 button{display:block;width:100%;margin-top:18px;background:#DF3228;color:#fff;border:0;font:inherit;
        font-size:17px;font-weight:700;padding:16px;border-radius:999px;cursor:pointer}
 .x{color:#8A827A;font-size:14px;text-align:center;margin:14px 0 0}
</style></head><body><form class="c" method="post">
<h1>${esc(titre)}</h1>
<p class="s">${esc(it ? IT.refusSous : 'Choisis la raison : le client la verra.')}</p>
${erreur ? `<p class="err">${esc(erreur)}</p>` : ''}
${choix}
<label class="l" for="p">${esc(it ? IT.precision : 'Précision pour le client (facultatif)')}</label>
<textarea id="p" name="precision" maxlength="${PRECISION_MAX}" placeholder="${esc(it ? IT.precisionEx : 'ex. : plus de poulet ce soir')}">${esc(precision)}</textarea>
<p class="n">${PRECISION_MAX} max.</p>
<button type="submit">${esc(it ? IT.confirmer : 'Confirmer le refus')}</button>
<p class="x">${esc(it ? IT.renoncer : 'Tu ne veux pas refuser ? Ferme simplement cette page.')}</p>
</form></body></html>`;
}

function page(emoji, titre, corps, couleur = '#157F3C', cta = null, langue = 'fr') {
  // Par defaut on renvoie vers l'app : quelle que soit la situation, ce que le
  // restaurateur veut faire ensuite se passe dans son espace, pas sur le site.
  // `/pro` et non `/` : la racine repasse par l'aiguillage de l'app, qui fait gagner le
  // mode memorise sur les roles. Un restaurateur passe cote client la veille atterrissait
  // dans l'app CLIENT en venant d'ici (constate le 2026-09-09). `/pro` pose le mode
  // restaurant puis entre dans l'espace.
  const lien = cta ?? { libelle: langue === 'it' ? IT.ouvrir : 'Ouvrir mon espace', href: `${APP}/pro` };
  return `<!doctype html><html lang="${langue === 'it' ? 'it' : 'fr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)} — Taxi Food</title>
<style>
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#F5F2EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:20px}
 .c{background:#fff;border-radius:24px;padding:34px 28px;max-width:420px;width:100%;text-align:center;
    box-shadow:0 4px 24px rgba(26,26,26,.08)}
 .e{font-size:54px;line-height:1}
 h1{font-size:23px;margin:16px 0 0;color:#1A1A1A}
 p{color:#4A4744;line-height:1.6;margin:12px 0 0}
 .b{display:inline-block;margin-top:22px;background:${couleur};color:#fff;text-decoration:none;
    font-weight:700;padding:14px 26px;border-radius:999px}
</style></head><body><div class="c">
<div class="e">${emoji}</div><h1>${esc(titre)}</h1><p>${corps}</p>
<a class="b" href="${lien.href}">${esc(lien.libelle)}</a>
</div></body></html>`;
}

async function rpc(nom, corps) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
               'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  return r.json();
}

const rendre = (html, status = 200) => new Response(html, { status, headers: HTML });

function pageDejaTraitee(d) {
  if (d?.langue === 'it') {
    return rendre(page('👍', IT.dejaTitre,
      IT.deja(esc(IT.statuts[d.statut] || d.statut)), '#8A827A', null, 'it'));
  }
  // Cas le plus frequent en vrai : deja repondu depuis l'application.
  // Ce n'est pas une erreur, et le dire ainsi evite une inquietude inutile.
  return rendre(page('👍', 'Déjà traitée',
    `Cette commande est déjà en « ${esc(d.statut)} ». Rien de plus à faire.`, '#8A827A',
    { libelle: 'Ouvrir mon espace', href: `${APP}/pro` }));
}

const pageInutilisable = () => rendre(page('🤔', 'Lien inutilisable',
  'Ce lien n’est plus valable. Ouvre la commande depuis l’application.', '#8A827A'), 400);

function pageRefusee(d) {
  const it = d?.langue === 'it';
  const motif = d?.motif
    ? `<br><br><strong>${esc(it ? IT.motifTransmis : 'Motif transmis au client :')}</strong><br>« ${esc(d.motif)} »`
    : '';
  return it
    ? rendre(page('❌', IT.refusee(esc(d.numero)), IT.refuseeCorps + motif, '#DF3228',
        { libelle: IT.historique, href: `${APP}/history` }, 'it'))
    : rendre(page('❌', `Commande ${esc(d.numero)} refusée`,
        'Le client vient d’être prévenu. Il n’a rien à payer.' + motif, '#DF3228',
        // Une commande refusee passe en « annulee » : elle est dans
        // l'Historique, pas dans les commandes en cours.
        { libelle: 'Voir mon historique', href: `${APP}/history` }));
}

export default async (request) => {
  const url = new URL(request.url);
  // /a/<id>/<token> = accepter · /r-refus/<id>/<token> = refuser
  const m = url.pathname.match(/^\/(a|r-refus)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/?$/i);
  if (!m) {
    return rendre(page('🤔', 'Lien incomplet',
      'Ce lien ne mène nulle part. Ouvre la commande depuis l’application.', '#8A827A'), 400);
  }
  const [, quoi, orderId, token] = m;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[repondre-commande] variables Supabase absentes');
    return rendre(page('⚠️', 'Indisponible',
      'Réessaie dans un instant, ou réponds à la commande depuis l’application.', '#8A827A'), 500);
  }

  try {
    // --- Refus : GET = formulaire (aucun effet), POST = refus ------------------------------
    if (quoi === 'r-refus') {
      if (request.method !== 'POST') {
        const d = await rpc('consulter_commande_par_jeton', { p_order_id: orderId, p_token: token });
        if (!d?.ok) return pageInutilisable();
        if (d.statut !== 'recue') return pageDejaTraitee(d);
        return rendre(formulaireRefus({ numero: d.numero, langue: d.langue }));
      }

      const form = new URLSearchParams(await request.text());
      const code = String(form.get('code') ?? '').trim();
      const precision = String(form.get('precision') ?? '').slice(0, PRECISION_MAX);
      if (!CODES.has(code) || (code === 'autre' && !precision.trim())) {
        // Rien n'est ecrit : on relit la commande pour reafficher le formulaire, dans sa langue.
        const d = await rpc('consulter_commande_par_jeton', { p_order_id: orderId, p_token: token });
        if (!d?.ok) return pageInutilisable();
        if (d.statut !== 'recue') return pageDejaTraitee(d);
        const it = d.langue === 'it';
        const erreur = !CODES.has(code)
          ? (it ? IT.erreurMotif : 'Choisis une raison.')
          : (it ? IT.erreurAutre : 'Avec « Autre raison », écris deux mots pour le client.');
        return rendre(formulaireRefus({ numero: d.numero, langue: d.langue, erreur,
          code: CODES.has(code) ? code : null, precision }), 422);
      }

      const d = await rpc('repondre_commande_par_jeton', {
        p_order_id: orderId, p_token: token, p_action: 'refuser',
        p_code: code, p_precision: precision || null,
      });
      if (d?.ok) return pageRefusee(d);
      if (d?.raison === 'deja traitee') return pageDejaTraitee(d);
      return pageInutilisable();
    }

    // --- Acceptation : inchangee (un GET accepte) -----------------------------------------
    const d = await rpc('repondre_commande_par_jeton', {
      p_order_id: orderId, p_token: token, p_action: 'accepter', p_motif: null,
    });

    if (d?.ok && d?.langue === 'it') {
      return rendre(page('✅', IT.acceptee(esc(d.numero)),
        d.preparation_auto === true ? IT.accepteeAuto : IT.accepteeManuel,
        '#157F3C', { libelle: IT.voir(d.numero), href: `${APP}/pro` }, 'it'));
    }

    if (d?.ok) {
      return rendre(page('✅', `Commande ${esc(d.numero)} acceptée`,
        // `preparation_auto` (2026-09-22) : la base passe seule la commande en
        // preparation 30 a 60 s apres l'acceptation. Absent (ancienne RPC) =
        // ancien texte, jamais une promesse fausse.
        d.preparation_auto === true
          ? 'C’est noté. Le client vient d’être prévenu. La commande passe en préparation toute seule dans moins d’une minute : il te restera seulement à la marquer prête dans ton espace.'
          : 'C’est noté. Le client vient d’être prévenu. Ouvre ton espace pour la passer en préparation, puis la marquer prête.',
        '#157F3C',
        { libelle: `Voir la commande ${d.numero ?? ''}`.trim(), href: `${APP}/pro` }));
    }

    if (d?.raison === 'deja traitee') return pageDejaTraitee(d);
    return pageInutilisable();
  } catch (e) {
    console.error('[repondre-commande]', e);
    return rendre(page('⚠️', 'Indisponible',
      'Réessaie dans un instant, ou réponds à la commande depuis l’application.', '#8A827A'), 500);
  }
};

export const config = { path: ['/a/:id/:token', '/r-refus/:id/:token'] };
