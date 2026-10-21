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
 *
 * ⚠️ ACCEPTER = VÉRIFIER (2026-10-20, après TF-442 : acceptée en 51 s, annulée 4 min après
 * faute de nuggets — le client est parti). Le GET /a/… n'accepte plus rien : il affiche la
 * LISTE DES PLATS, chacun à cocher « Je l'ai » ou « Il manque ». Seul le POST agit :
 *   - tout est là            → repondre_commande_par_jeton('accepter') ;
 *   - un ou plusieurs manquent → signaler_manquants_par_jeton : le client est prévenu et
 *     choisit (retirer le plat ou annuler), le plat passe en rupture jusqu'au lendemain ;
 *   - tout manque            → on renvoie vers le refus (motif « rupture »).
 * Après acceptation, le même lien sert à signaler un plat manquant. Pendant l'attente du
 * client, il montre son numéro et deux boutons pour répondre à sa place après l'avoir appelé.
 * Un robot d'aperçu de lien qui ouvre l'URL ne peut donc plus accepter une commande.
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
  // Prenotazione (2026-10-17) : la preparazione automatica aspetta l'ora di avvio.
  accepteePrenotazione: (ora) => `Fatto. Il cliente è stato appena avvisato. È una PRENOTAZIONE: l’ordine passa in preparazione da solo verso le ${ora}, non prima. Poi dovrai solo segnarlo come pronto.`,
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
  // Verifica prima di accettare (2026-10-20)
  verifTitre: (n) => `Ordine ${n}: avete tutto?`,
  verifSous: 'Controllate ogni piatto con la cucina prima di accettare.',
  jeLai: 'Ce l’ho',
  manque: 'Manca',
  verifValider: 'Confermare',
  verifNote: 'Tutto « Ce l’ho » → l’ordine è accettato. Un piatto « Manca » → il cliente sceglie: toglierlo o annullare.',
  erreurVerif: 'Indicate per ogni piatto « Ce l’ho » o « Manca ».',
  toutManque: 'Mancano tutti i piatti: rifiutate l’ordine (motivo « piatti non disponibili »).',
  refuserLien: 'Rifiutare l’ordine',
  manqueTitre: (n) => `Manca un piatto nell’ordine ${n}?`,
  manqueSous: 'Selezionate i piatti che non avete più. Il cliente sceglierà: toglierli o annullare.',
  manqueValider: 'Avvisare il cliente',
  erreurManque: 'Selezionate almeno un piatto.',
  dejaAcceptee: 'Ordine già accettato.',
  rienAFaire: 'Va tutto bene? Chiudete semplicemente questa pagina.',
  previentTitre: (n) => `Cliente avvisato — ${n}`,
  previentCorps: (m) => `Il cliente sceglie nell’app: togliere « ${m} » o annullare. Il piatto è segnato esaurito fino a domani mattina.`,
  attenteTitre: (n) => `${n}: in attesa del cliente`,
  attenteCorps: (m) => `Manca: ${m}. Il cliente è stato avvisato e sceglie nell’app.`,
  appeler: 'Chiamare il cliente',
  pourLui: 'Lo avete sentito al telefono? Indicate la sua scelta:',
  retirer: 'Togliere il piatto e preparare il resto',
  annuler: 'Annullare l’ordine',
  payeeEnLigne: 'Ordine già pagato online: per ora si può solo annullare (rimborso totale).',
  retireTitre: (n) => `Ordine ${n} modificato`,
  retireCorps: 'Il piatto mancante è stato tolto. Il cliente è stato avvisato. Preparate il resto.',
  annuleTitre: (n) => `Ordine ${n} annullato`,
  annuleCorps: 'Il cliente è stato avvisato. Non deve pagare nulla.',
  erreurGenerique: 'Impossibile salvare. Riprovate o rispondete dall’app.',
  statuts: { confirmee: 'confermato', en_preparation: 'in preparazione', en_livraison: 'in consegna',
             livree: 'consegnato', annulee: 'annullato' },
};

// Textes français des écrans de vérification / plat manquant (2026-10-20). Même jeu de
// clés que IT ci-dessus : `tx(langue)` choisit.
const FR = {
  verifTitre: (n) => `Commande ${n} : vous avez tout ?`,
  verifSous: 'Vérifiez chaque plat avec la cuisine avant d’accepter.',
  jeLai: 'Je l’ai',
  manque: 'Il manque',
  verifValider: 'Valider',
  verifNote: 'Tout « Je l’ai » → la commande est acceptée. Un plat « Il manque » → le client choisit : le retirer ou annuler.',
  erreurVerif: 'Indiquez pour chaque plat « Je l’ai » ou « Il manque ».',
  toutManque: 'Tous les plats manquent : refusez la commande (motif « plats plus disponibles »).',
  refuserLien: 'Refuser la commande',
  manqueTitre: (n) => `Il manque un plat dans la commande ${n} ?`,
  manqueSous: 'Cochez les plats que vous n’avez plus. Le client choisira : les retirer ou annuler.',
  manqueValider: 'Prévenir le client',
  erreurManque: 'Cochez au moins un plat.',
  dejaAcceptee: 'Commande déjà acceptée.',
  rienAFaire: 'Tout va bien ? Fermez simplement cette page.',
  previentTitre: (n) => `Client prévenu — ${n}`,
  previentCorps: (m) => `Le client choisit dans l’appli : retirer « ${m} » ou annuler. Le plat est mis en rupture jusqu’à demain matin.`,
  attenteTitre: (n) => `${n} : en attente du client`,
  attenteCorps: (m) => `Il manque : ${m}. Le client a été prévenu et choisit dans l’appli.`,
  appeler: 'Appeler le client',
  pourLui: 'Vous l’avez eu au téléphone ? Indiquez son choix :',
  retirer: 'Retirer le plat et préparer le reste',
  annuler: 'Annuler la commande',
  payeeEnLigne: 'Commande déjà payée en ligne : pour l’instant, on ne peut que l’annuler (remboursement intégral).',
  retireTitre: (n) => `Commande ${n} modifiée`,
  retireCorps: 'Le plat manquant est retiré. Le client est prévenu. Préparez le reste.',
  annuleTitre: (n) => `Commande ${n} annulée`,
  annuleCorps: 'Le client est prévenu. Il n’a rien à payer.',
  erreurGenerique: 'Impossible d’enregistrer. Réessayez ou répondez depuis l’application.',
};
const tx = (langue) => (langue === 'it' ? IT : FR);

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
function formulaireRefus({ numero, langue, erreur = null, code = null, precision = '', lienModifier = null }) {
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
${lienModifier ? `<p class="x"><a href="${lienModifier}">${esc(it
  ? 'Manca solo un piatto? Modificate l’ordine invece di rifiutarlo →'
  : 'Il ne manque qu’un plat ? Modifiez la commande au lieu de la refuser →')}</a></p>` : ''}
</form></body></html>`;
}

const STYLE_FORM = `
 body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#F5F2EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:16px}
 .c{background:#fff;border-radius:24px;padding:26px 18px;max-width:460px;width:100%;
    box-shadow:0 4px 24px rgba(26,26,26,.08)}
 h1{font-size:21px;margin:0;color:#1A1A1A;text-align:center;line-height:1.3}
 .s{color:#4A4744;line-height:1.5;margin:8px 0 16px;text-align:center}
 .l{border:2px solid #E5DFD9;border-radius:16px;padding:12px 12px 10px;margin:0 0 10px}
 .t{font-size:16px;font-weight:700;color:#1A1A1A;line-height:1.35}
 .p{font-size:14px;color:#B3261E;font-weight:600;margin-top:2px}
 .ch{display:flex;gap:8px;margin-top:10px}
 .ch label{flex:1;cursor:pointer}
 .ch input,.m input{position:absolute;opacity:0;pointer-events:none}
 .ch span{display:block;text-align:center;border:2px solid #E5DFD9;border-radius:999px;padding:10px 6px;
          font-size:15px;font-weight:700;color:#4A4744}
 .ch input.ok:checked+span{border-color:#157F3C;background:#E7F4EC;color:#157F3C}
 .ch input.ko:checked+span{border-color:#DF3228;background:#FDECEA;color:#B3261E}
 .ch input:focus-visible+span,.m input:focus-visible+span{outline:3px solid #1A1A1A;outline-offset:2px}
 .m{display:block;margin:0 0 10px;cursor:pointer}
 .m span{display:block;border:2px solid #E5DFD9;border-radius:16px;padding:14px 16px;font-size:16px;color:#1A1A1A}
 .m input:checked+span{border-color:#DF3228;background:#FDECEA;font-weight:700}
 .err{background:#FDECEA;color:#9B1C14;border-radius:12px;padding:10px 14px;margin:0 0 14px;font-weight:600}
 .n{color:#8A827A;font-size:13px;line-height:1.45;text-align:center;margin:12px 0 0}
 button{display:block;width:100%;margin-top:14px;background:#157F3C;color:#fff;border:0;font:inherit;
        font-size:17px;font-weight:700;padding:16px;border-radius:999px;cursor:pointer}
 button.r{background:#DF3228} button.g{background:#fff;color:#1A1A1A;border:2px solid #E5DFD9}
 a.b{display:block;text-align:center;margin-top:14px;background:#1A1A1A;color:#fff;text-decoration:none;
     font-weight:700;padding:14px;border-radius:999px}
 a.x{display:block;text-align:center;color:#B3261E;font-weight:700;margin-top:12px}
`;

function enTete(titre, langue) {
  return `<!doctype html><html lang="${langue === 'it' ? 'it' : 'fr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(titre)} — Taxi Food</title><style>${STYLE_FORM}</style></head><body>`;
}

const lignePrecision = (l) => (l.precision ? `<div class="p">✎ ${esc(l.precision)}</div>` : '');

/** Commande « reçue » : chaque plat à cocher « Je l'ai » / « Il manque » avant d'accepter. */
function formulaireVerif({ d, erreur = null, choix = {} }) {
  const t = tx(d.langue);
  const titre = t.verifTitre(d.numero);
  const lignes = (d.lignes ?? []).map((l) => `<div class="l"><div class="t">${esc(l.texte)}</div>${lignePrecision(l)}
<div class="ch"><label><input class="ok" type="radio" name="l_${esc(l.id)}" value="ok"${choix[l.id] === 'ok' ? ' checked' : ''} required><span>✅ ${esc(t.jeLai)}</span></label>
<label><input class="ko" type="radio" name="l_${esc(l.id)}" value="manque"${choix[l.id] === 'manque' ? ' checked' : ''}><span>❌ ${esc(t.manque)}</span></label></div></div>`).join('');
  return `${enTete(titre, d.langue)}<form class="c" method="post">
<input type="hidden" name="action" value="verifier">
<h1>${esc(titre)}</h1><p class="s">${esc(t.verifSous)}</p>
${erreur ? `<p class="err">${erreur}</p>` : ''}
${lignes}
<button type="submit">${esc(t.verifValider)}</button>
<p class="n">${esc(t.verifNote)}</p>
</form></body></html>`;
}

/** Commande déjà acceptée : signaler un plat qu'on n'a plus. */
function formulaireManquants({ d, erreur = null }) {
  const t = tx(d.langue);
  const titre = t.manqueTitre(d.numero);
  const lignes = (d.lignes ?? []).map((l) => `<label class="m"><input type="checkbox" name="m" value="${esc(l.id)}"><span>${esc(l.texte)}${
    l.precision ? ` <small>✎ ${esc(l.precision)}</small>` : ''}</span></label>`).join('');
  return `${enTete(titre, d.langue)}<form class="c" method="post">
<input type="hidden" name="action" value="manquants">
<p class="s">✅ ${esc(t.dejaAcceptee)}</p>
<h1>${esc(titre)}</h1><p class="s">${esc(t.manqueSous)}</p>
${erreur ? `<p class="err">${esc(erreur)}</p>` : ''}
${lignes}
<button class="r" type="submit">${esc(t.manqueValider)}</button>
<p class="n">${esc(t.rienAFaire)}</p>
</form></body></html>`;
}

/** On attend le choix du client : son numéro, et répondre à sa place après l'appel. */
function pageAttente(d, juste = null) {
  const t = tx(d.langue);
  const titre = juste ? `✅ ${juste.titre}` : `⏳ ${t.attenteTitre(d.numero)}`;
  const manquants = (d.lignes ?? []).filter((l) => l.manquant).map((l) => l.texte).join(', ');
  const tel = d.telephone ? String(d.telephone).replace(/[^0-9+]/g, '') : '';
  return `${enTete(titre, d.langue)}<div class="c">
<h1>${esc(titre)}</h1><p class="s">${esc(juste ? juste.corps : t.attenteCorps(manquants))}</p>
${tel ? `<a class="b" href="tel:${esc(tel)}">📞 ${esc(t.appeler)} — ${esc(d.telephone)}</a>` : ''}
<p class="s" style="margin-top:20px">${esc(t.pourLui)}</p>
${d.payee_en_ligne ? `<p class="n">${esc(t.payeeEnLigne)}</p>` : `<form method="post"><input type="hidden" name="action" value="retirer"><button type="submit">✂️ ${esc(t.retirer)}</button></form>`}
<form method="post"><input type="hidden" name="action" value="annuler"><button class="r" type="submit">${esc(t.annuler)}</button></form>
</div></body></html>`;
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
  const STATUTS_FR = { recue: 'reçue', confirmee: 'acceptée', en_preparation: 'en préparation',
    en_livraison: 'en livraison', livree: 'livrée', annulee: 'annulée' };
  // Recuperee par le livreur : le restaurant ne peut plus l'annuler lui-meme — on lui dit
  // a qui s'adresser au lieu de « rien de plus a faire » (TF-439, 18/10).
  const suite = d.recuperee
    ? 'Le livreur l’a déjà récupérée : pour l’annuler, appelle Taxi Food au +261 36 15 74 521.'
    : 'Rien de plus à faire.';
  return rendre(page('👍', 'Déjà traitée',
    `Cette commande est déjà « ${esc(STATUTS_FR[d.statut] || d.statut)} ». ${suite}`, '#8A827A',
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
        // Refus possible tant que le livreur n'a pas recupere la commande (2026-10-19).
        if (!(d.annulable ?? d.statut === 'recue')) return pageDejaTraitee(d);
        // Plusieurs plats : proposer de modifier plutôt que tout refuser (2026-10-20).
        const lienModifier = (d.lignes?.length ?? 0) > 1 && !d.attente_modif ? `/a/${orderId}/${token}` : null;
        return rendre(formulaireRefus({ numero: d.numero, langue: d.langue, lienModifier }));
      }

      const form = new URLSearchParams(await request.text());
      const code = String(form.get('code') ?? '').trim();
      const precision = String(form.get('precision') ?? '').slice(0, PRECISION_MAX);
      if (!CODES.has(code) || (code === 'autre' && !precision.trim())) {
        // Rien n'est ecrit : on relit la commande pour reafficher le formulaire, dans sa langue.
        const d = await rpc('consulter_commande_par_jeton', { p_order_id: orderId, p_token: token });
        if (!d?.ok) return pageInutilisable();
        // Refus possible tant que le livreur n'a pas recupere la commande (2026-10-19).
        if (!(d.annulable ?? d.statut === 'recue')) return pageDejaTraitee(d);
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

    // --- /a/ : vérifier puis accepter, signaler un plat manquant, répondre pour le client ---
    const c = await rpc('consulter_commande_par_jeton', { p_order_id: orderId, p_token: token });
    if (!c?.ok) return pageInutilisable();
    const t = tx(c.langue);

    async function signaler(ids) {
      const r = await rpc('signaler_manquants_par_jeton', { p_order_id: orderId, p_token: token, p_items: ids });
      if (r?.ok) {
        // Relire : la page d'attente montre le numéro du client et les deux réponses possibles.
        const apres = await rpc('consulter_commande_par_jeton', { p_order_id: orderId, p_token: token });
        const juste = { titre: t.previentTitre(r.numero ?? c.numero), corps: t.previentCorps(r.manquants ?? '') };
        if (apres?.ok && apres.attente_modif) return rendre(pageAttente(apres, juste));
        return rendre(page('✅', esc(juste.titre), esc(juste.corps), '#157F3C', null, c.langue));
      }
      if (r?.raison === 'modif:tout_manque') {
        return rendre(formulaireVerif({ d: c, erreur: `${esc(t.toutManque)} <a class="x" href="/r-refus/${orderId}/${token}">${esc(t.refuserLien)} →</a>` }), 422);
      }
      if (r?.raison === 'modif:trop_tard') return pageDejaTraitee(c);
      return rendre(page('⚠️', c.numero ?? '', esc(t.erreurGenerique), '#8A827A', null, c.langue), 500);
    }

    if (request.method !== 'POST') {
      if (c.attente_modif && c.annulable) return rendre(pageAttente(c));
      if (c.statut === 'recue') return rendre(formulaireVerif({ d: c }));
      if (c.annulable && (c.lignes?.length ?? 0) > 1) return rendre(formulaireManquants({ d: c }));
      return pageDejaTraitee(c);
    }

    const form = new URLSearchParams(await request.text());
    const action = String(form.get('action') ?? '');

    // Répondre à la place du client (après l'avoir eu au téléphone).
    if (action === 'retirer' || action === 'annuler') {
      const r = await rpc('resoudre_manquants_par_jeton', { p_order_id: orderId, p_token: token, p_choix: action });
      if (r?.ok && action === 'retirer') return rendre(page('✂️', t.retireTitre(esc(r.numero)), esc(t.retireCorps), '#157F3C',
        { libelle: c.langue === 'it' ? IT.voir(r.numero) : `Voir la commande ${r.numero ?? ''}`.trim(), href: `${APP}/pro` }, c.langue));
      if (r?.ok) return rendre(page('❌', t.annuleTitre(esc(r.numero)), esc(t.annuleCorps), '#DF3228',
        { libelle: c.langue === 'it' ? IT.historique : 'Voir mon historique', href: `${APP}/history` }, c.langue));
      if (r?.raison === 'modif:rien_en_attente' || r?.raison === 'modif:trop_tard') return pageDejaTraitee(c);
      return rendre(page('⚠️', c.numero ?? '', esc(t.erreurGenerique), '#8A827A', null, c.langue), 500);
    }

    // Signaler des plats manquants sur une commande déjà acceptée.
    if (action === 'manquants') {
      const ids = form.getAll('m').map(String).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
      if (!ids.length) return rendre(formulaireManquants({ d: c, erreur: t.erreurManque }), 422);
      return signaler(ids);
    }

    // Vérification avant d'accepter.
    if (action !== 'verifier') return pageInutilisable();
    if (c.attente_modif) return rendre(pageAttente(c));
    if (c.statut !== 'recue') return pageDejaTraitee(c);
    const choix = {};
    for (const l of c.lignes ?? []) choix[l.id] = String(form.get(`l_${l.id}`) ?? '');
    const lignes = c.lignes ?? [];
    if (lignes.some((l) => choix[l.id] !== 'ok' && choix[l.id] !== 'manque')) {
      return rendre(formulaireVerif({ d: c, erreur: esc(t.erreurVerif), choix }), 422);
    }
    const manquants = lignes.filter((l) => choix[l.id] === 'manque').map((l) => l.id);
    if (manquants.length === lignes.length) {
      return rendre(formulaireVerif({ d: c, choix,
        erreur: `${esc(t.toutManque)} <a class="x" href="/r-refus/${orderId}/${token}">${esc(t.refuserLien)} →</a>` }), 422);
    }
    if (manquants.length) return signaler(manquants);

    const d = await rpc('repondre_commande_par_jeton', {
      p_order_id: orderId, p_token: token, p_action: 'accepter', p_motif: null,
    });

    if (d?.raison === 'attente_client') return rendre(pageAttente(c));

    if (d?.ok && d?.langue === 'it') {
      return rendre(page('✅', IT.acceptee(esc(d.numero)),
        d.lancement_prevu ? IT.accepteePrenotazione(esc(d.lancement_prevu))
          : d.preparation_auto === true ? IT.accepteeAuto : IT.accepteeManuel,
        '#157F3C', { libelle: IT.voir(d.numero), href: `${APP}/pro` }, 'it'));
    }

    if (d?.ok) {
      return rendre(page('✅', `Commande ${esc(d.numero)} acceptée`,
        // `preparation_auto` (2026-09-22) : la base passe seule la commande en
        // preparation 30 a 60 s apres l'acceptation. Absent (ancienne RPC) =
        // ancien texte, jamais une promesse fausse.
        // Réservation (2026-10-17) : `lancement_prevu` = heure de lancement à venir ;
        // la préparation automatique l'attend, « moins d'une minute » serait faux.
        d.lancement_prevu
          ? `C’est noté. Le client vient d’être prévenu. C’est une RÉSERVATION : la commande passe en préparation toute seule vers ${esc(String(d.lancement_prevu).replace(':', 'h'))}, pas avant. Il te restera ensuite à la marquer prête.`
          : d.preparation_auto === true
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
