/**
 * Taxi Food — e-mail du code offert (workflow « Taxi Food — code offert »).
 *
 * Recoit la charge du trigger Postgres `notifier_code_offert` (insertion d'une
 * ligne `promo_envois` canal email) et prepare UN e-mail au client : objet,
 * texte brut et HTML.
 *
 * Deux offres, et elles ne se payent pas au meme endroit :
 *  - « repas »     -> plats + supplements (+ emballage si inclus), hors boissons
 *    sauf si incluses, jusqu'au plafond. PAYE PAR LE RESTAURANT : c'est donc lui
 *    qui « offre » dans l'objet.
 *  - « livraison » -> la livraison seule, payee par Taxi Food.
 *
 * ⚠️ On ne dit JAMAIS « envoye » ni « recu » cote admin : n8n ne renvoie rien a
 * la base. promo_envois.statut reste « demande ». Ce noeud ne fait qu'ecrire.
 *
 * ⚠️ Le code est ecrit en TEXTE, en gros, jamais en image : beaucoup de
 * messageries bloquent les images, et le client doit pouvoir le recopier.
 *
 * ⚠️ Pas d'echappement HTML dans l'objet ni dans le texte brut : ce sont des
 * textes, « Chez Bidul & Truc » deviendrait « Chez Bidul &amp; Truc ».
 *
 * Le webhook est authentifie (Header Auth sur x-taxifood-secret) : une requete
 * sans le bon en-tete est refusee par n8n avant d'arriver ici.
 */
const c = $json.body ?? $json;

const cli  = c.client || {};
const code = c.code   || {};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

// Espace fine insecable -> espace simple : certaines messageries affichent un
// carre a la place du separateur de milliers.
const ar = (n) => Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/\s/g, ' ') + ' Ar';

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
              'août', 'septembre', 'octobre', 'novembre', 'décembre'];
// Date lue a l'heure de Nosy Be (UTC+3, sans heure d'ete). Calcul a la main
// plutot que Intl : le runtime de n8n n'embarque pas toujours les fuseaux.
const dateFr = (iso) => {
  const t = Date.parse(iso);
  if (!isFinite(t)) return '';
  const d = new Date(t + 3 * 3600 * 1000);
  return `${d.getUTCDate() === 1 ? '1er' : d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const LIEN      = c.lien || 'https://taxifoodnosybe.distripro207.com';
const livraison = code.offre === 'livraison' || code.livraison_offerte === true;
const resto     = String(code.restaurant || '').trim();
// Le restaurant n'« offre » que ce qu'il paye. Une livraison est payee par
// Taxi Food : lui attribuer le cadeau serait faux, et le patron le lirait.
const donateur  = code.offert_par === 'restaurant' && resto ? resto : 'Taxi Food';
const emballage = code.inclut_emballage === true;
const boissons  = code.inclut_boissons === true;
const plafond   = Number(code.plafond) > 0 ? Number(code.plafond) : null;
// Meme regle que l'admin (admin/lib/codeOffert.ts, dernierJourValable) : on
// annonce le dernier jour ENTIER, la veille de expire_le. Le code expire a
// l'heure de sa creation ; « jusqu'au 15 » promettrait une soiree ou la caisse
// le refuse. L'e-mail et le WhatsApp doivent annoncer la meme date.
const tExpire   = Date.parse(code.expire_le);
const expire    = isFinite(tExpire) ? dateFr(new Date(tExpire - 86400000).toISOString()) : '';
const prenom    = String(cli.prenom || '').trim();

const quoi   = livraison ? 'ta prochaine livraison' : 'ton prochain repas';
const titre  = `${donateur} t’offre ${quoi}`;
// « Chez Bidul & Truc » porte deja son « chez » : sans ce cas, l'e-mail
// ecrirait « chez Chez Bidul & Truc ».
const chez   = !resto ? ''
             : /^chez\s/i.test(resto) ? ' ' + resto.replace(/^chez/i, 'chez')
             : ` chez ${resto}`;

/* ------------------------------------------------ ce qui est offert / pas */
const offert = livraison
  ? ['La livraison']
  : ['Les plats', 'Les suppléments', ...(emballage ? ['L’emballage'] : []), ...(boissons ? ['Les boissons'] : [])];
const aPayer = livraison
  ? ['Les plats et les suppléments', 'L’emballage', 'Les boissons']
  : ['La livraison', ...(emballage ? [] : ['L’emballage']), ...(boissons ? [] : ['Les boissons'])];

// Exemple chiffre : une pizza a 25 000, son carton a 2 000, la livraison a
// 10 000. Calcule, pas ecrit en dur : un plafond bas ou un emballage exclu
// changent la reponse, et un exemple faux serait refuse a la caisse.
const PIZZA = 25000, CARTON = 2000, LIVR = 10000;
let exemple;
if (livraison) {
  exemple = `Exemple : une pizza à ${ar(PIZZA)} et son carton à ${ar(CARTON)}. La livraison à ${ar(LIVR)} est offerte. Tu paies ${ar(PIZZA + CARTON)}.`;
} else {
  const base   = PIZZA + (emballage ? CARTON : 0);
  const remise = plafond ? Math.min(base, plafond) : base;
  const paye   = PIZZA + CARTON + LIVR - remise;
  exemple = remise === PIZZA + CARTON
    ? `Exemple : une pizza à ${ar(PIZZA)} et son carton à ${ar(CARTON)} sont offerts. Tu paies la livraison : ${ar(LIVR)}.`
    : remise === PIZZA && !emballage
      ? `Exemple : une pizza à ${ar(PIZZA)} est offerte. Tu paies le carton, ${ar(CARTON)}, et la livraison, ${ar(LIVR)}.`
      : `Exemple : une pizza à ${ar(PIZZA)} et son carton à ${ar(CARTON)}. On t’offre ${ar(remise)}. Tu paies ${ar(paye)}, livraison comprise.`;
}
const plafondTexte = !livraison && plafond ? `Offert jusqu’à ${ar(plafond)}.` : '';

const ligne1 = livraison ? `Ta livraison offerte${chez}` : `Ton repas offert${chez}`;
const validite = `Valable une fois${expire ? `, jusqu’au ${expire}` : ''}, avec ton compte${resto ? `, pour une commande${chez}` : ''}.`;

/* --------------------------------------------------------------- HTML */
const liste = (items, couleur) => items.map((x) => `
      <tr><td width="18" valign="top" style="padding:3px 0;font:700 15px/1.5 Arial,sans-serif;color:${couleur}">•</td>
          <td style="padding:3px 0;font:400 15px/1.5 Arial,sans-serif;color:#1A1A1A">${esc(x)}</td></tr>`).join('');

const colonne = (etiquette, items, couleur) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td colspan="2" style="padding:0 0 6px;font:700 11px/1 Arial,sans-serif;letter-spacing:.1em;color:#8A827A;text-transform:uppercase">${etiquette}</td></tr>
      ${liste(items, couleur)}
    </table>`;

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#F5F2EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:22px">
  <tr><td style="padding:26px 26px 0">
    <div style="font:800 21px/1 Arial,sans-serif;color:#DF3228;letter-spacing:-.02em">TAXI FOOD</div>
    <div style="font:400 12px/1.4 Arial,sans-serif;color:#8A827A;padding-top:4px">Livraison de repas à Nosy Be</div>
  </td></tr>

  <tr><td style="padding:26px 26px 0;font:700 25px/1.25 Arial,sans-serif;color:#1A1A1A">${esc(titre)}</td></tr>
  <tr><td style="padding:10px 26px 0;font:400 15px/1.6 Arial,sans-serif;color:#4A4744">
    ${prenom ? `Bonjour ${esc(prenom)},<br>` : ''}Merci pour ta confiance.
  </td></tr>

  <!-- Le code, en trois temps : pour qui et quoi / le code / quand le taper. -->
  <tr><td style="padding:22px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF3F2;border-radius:16px">
      <tr><td align="center" style="padding:20px 18px 0;font:700 16px/1.4 Arial,sans-serif;color:#1A1A1A">${esc(ligne1)}</td></tr>
      <tr><td align="center" style="padding:12px 18px 0;font:400 15px/1.4 Arial,sans-serif;color:#4A4744">Tape le code</td></tr>
      <tr><td align="center" style="padding:8px 18px 0">
        <div style="display:inline-block;border:2px dashed #DF3228;border-radius:12px;padding:10px 18px;background:#ffffff;font:800 30px/1.1 'Courier New',Courier,monospace;letter-spacing:.08em;color:#DF3228">${esc(code.code)}</div>
      </td></tr>
      <tr><td align="center" style="padding:10px 18px 20px;font:400 15px/1.4 Arial,sans-serif;color:#4A4744">au moment de payer</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 26px 0">
    ${colonne('Offert', offert, '#DF3228')}
  </td></tr>
  <tr><td style="padding:16px 26px 0">
    ${colonne('À ta charge', aPayer, '#8A827A')}
  </td></tr>
  <tr><td style="padding:14px 26px 0;font:400 14px/1.55 Arial,sans-serif;color:#4A4744">
    ${esc(exemple)}${plafondTexte ? `<br>${esc(plafondTexte)}` : ''}
  </td></tr>

  <tr><td style="padding:18px 26px 0;font:700 14px/1.55 Arial,sans-serif;color:#1A1A1A">${esc(validite)}</td></tr>

  <tr><td align="center" style="padding:24px 26px 0">
    <a href="${esc(LIEN)}" style="display:inline-block;background:#DF3228;color:#ffffff;text-decoration:none;font:700 16px Arial,sans-serif;padding:15px 34px;border-radius:999px">Commander</a>
  </td></tr>

  <tr><td style="padding:24px 26px 26px">
    <div style="border-top:1px solid #E9E5E0;padding-top:16px;font:400 12px/1.5 Arial,sans-serif;color:#8A827A">
      Tu reçois ce message suite à ta commande. Réponds STOP pour ne plus recevoir nos offres.
    </div>
  </td></tr>
</table>
<div style="height:24px"></div>
</td></tr></table></body></html>`;

/* --------------------------------------------------------- texte brut */
const texte = [
  titre,
  '',
  `${prenom ? `Bonjour ${prenom},\n` : ''}Merci pour ta confiance.`,
  '',
  ligne1,
  `Tape le code ${code.code || ''}`,
  'au moment de payer',
  '',
  'Offert : ' + offert.join(', ').toLowerCase() + '.',
  'À ta charge : ' + aPayer.join(', ').toLowerCase() + '.',
  exemple,
  ...(plafondTexte ? [plafondTexte] : []),
  '',
  validite,
  '',
  `Commander : ${LIEN}`,
  '',
  'Tu reçois ce message suite à ta commande. Réponds STOP pour ne plus recevoir nos offres.',
].join('\n');

// Sans adresse ou sans code, on ne part pas : un e-mail sans code serait une
// promesse que le client ne peut pas utiliser.
const email = String(cli.email || '').trim();
return [{
  json: {
    envoyer_email: Boolean(email && code.code),
    destinataire: email,
    objet: titre,
    texte,
    html,
    envoi_id: c.envoi_id || null,
    code: code.code || null,
  },
}];
