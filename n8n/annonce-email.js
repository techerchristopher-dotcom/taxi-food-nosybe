/**
 * Taxi Food — e-mail d'ANNONCE (workflow « Taxi Food — annonce par e-mail »).
 *
 * Recoit UNE charge par destinataire, envoyee par la fonction Edge
 * `envoyer-annonce` (elle seule lit les adresses e-mail), et prepare UN e-mail :
 * objet, texte brut et HTML.
 *
 * ⚠️ WORKFLOW DEDIE, JAMAIS T7uX. Les e-mails de commande passent par
 * T7uXG7Lwwjro6Ds8. Le modifier — ou seulement le desactiver puis le reactiver,
 * ce qu'un `PUT` oblige a faire pour reenregistrer son webhook — perd les
 * notifications emises pendant la coupure. Une annonce ne vaut pas ce risque.
 * Meme raisonnement que le workflow « code offert ».
 *
 * ⚠️ MEME CREDENTIAL SMTP, MEME EXPEDITEUR que T7uX
 * (`Taxi Food <christopher@distripro207.com>`, credential `r44dcVHPrXmkP8KY`).
 * Ce n'est pas un detail de confort : cette adresse est celle declaree chez
 * Apple pour le relais prive `@privaterelay.appleid.com`. Un autre expediteur
 * verrait ses messages JETES EN SILENCE pour ces comptes-la.
 *
 * ⚠️ LE PIED DE PAGE N'EST PAS DECORATIF. Il porte le lien de desinscription, et
 * il dit ce que la desinscription ne coupe PAS : les e-mails de commande. Sans
 * cette phrase, une personne qui se desinscrit croit ne plus rien recevoir du
 * tout, et decouvre le contraire a sa commande suivante.
 *
 * ⚠️ On n'envoie JAMAIS un e-mail d'annonce sans `desinscription`. La charge
 * arrive avec le lien deja construit ; s'il manque, le noeud « Lien de
 * desinscription present ? » coupe la branche et rien ne part.
 *
 * ⚠️ Pas d'echappement HTML dans l'objet ni dans le texte brut : ce sont des
 * textes. « Chez Bidul & Truc » y deviendrait « Chez Bidul &amp; Truc », lisible
 * tel quel dans la boite de reception (piege deja paye sur l'alerte
 * d'inscription).
 *
 * Couleurs et gabarit repris de l'e-mail de commande (T7uX) pour que les deux
 * se ressemblent : fond #F5F2EF, carte blanche 22 px, rouge #DF3228.
 */
const c = $json.body ?? $json;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

const SITE = 'https://taxifoodnosybe.distripro207.com';
const APP  = 'https://taxifood.distripro207.com';

const destinataire = String(c.destinataire || '').trim();
const titre        = String(c.titre || '').trim();
const corps        = String(c.corps || '').trim();
const desinscrire  = String(c.desinscription || '').trim();
const test         = c.test === true;

// Le bouton mene LA OU L'ANNONCE PARLE. `route` vaut '/' (l'accueil) ou
// '/restaurant/<uuid>' : les deux sont des Universal Links, donc l'app s'ouvre
// si elle est installee, et le site de commande sinon. Rien a detecter.
const route = String(c.route || '/').trim() || '/';
const lien  = APP + (route.startsWith('/') ? route : '/' + route);

// Objet : le titre de l'annonce, tel qu'il a ete ecrit. Y ajouter « Taxi Food »
// serait redondant, l'expediteur le dit deja.
const objet = (test ? '[TEST] ' : '') + (titre || 'Taxi Food');

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#F5F2EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:22px">
  <tr><td style="padding:26px 26px 0">
    <div style="font:800 21px/1 Arial,sans-serif;color:#DF3228;letter-spacing:-.02em">TAXI FOOD</div>
    <div style="font:400 12px/1.4 Arial,sans-serif;color:#8A827A;padding-top:4px">Livraison de repas à Nosy Be</div>
  </td></tr>

  ${test ? `<tr><td style="padding:18px 26px 0">
    <div style="background:#FFF3E6;border-radius:12px;padding:10px 14px;font:700 13px Arial,sans-serif;color:#8A5A12">
      Ceci est un test. Personne d’autre ne l’a reçu.
    </div>
  </td></tr>` : ''}

  <tr><td align="center" style="padding:30px 26px 0;font-size:46px;line-height:1">📣</td></tr>
  <tr><td align="center" style="padding:12px 26px 0;font:700 25px/1.25 Arial,sans-serif;color:#1A1A1A">${esc(titre)}</td></tr>
  <tr><td align="center" style="padding:10px 26px 0;font:400 15px/1.6 Arial,sans-serif;color:#4A4744">${esc(corps)}</td></tr>

  <tr><td align="center" style="padding:28px 26px 0">
    <a href="${esc(lien)}" style="display:inline-block;background:#DF3228;color:#ffffff;text-decoration:none;font:700 16px Arial,sans-serif;padding:15px 30px;border-radius:999px">Voir dans Taxi Food</a>
  </td></tr>

  <tr><td style="padding:28px 26px 26px">
    <div style="border-top:1px solid #E9E5E0;padding-top:16px;font:400 12px/1.6 Arial,sans-serif;color:#8A827A">
      Tu reçois cet e-mail parce que tu as un compte Taxi Food.<br>
      <a href="${esc(desinscrire)}" style="color:#8A827A">Ne plus recevoir les annonces Taxi Food</a> —
      les e-mails liés à tes commandes, eux, continueront de t’arriver.
    </div>
  </td></tr>
</table>
<div style="height:24px"></div>
</td></tr></table></body></html>`;

// Version texte : certaines messageries n'affichent que celle-la, et un e-mail
// sans partie texte est note comme indesirable par la plupart des filtres.
const texte = [
  test ? '[TEST] Ceci est un test. Personne d’autre ne l’a reçu.' : '',
  titre,
  '',
  corps,
  '',
  `Voir dans Taxi Food : ${lien}`,
  '',
  '—',
  'Tu reçois cet e-mail parce que tu as un compte Taxi Food.',
  `Ne plus recevoir les annonces Taxi Food : ${desinscrire}`,
  'Les e-mails liés à tes commandes, eux, continueront de t’arriver.',
  SITE,
].filter((l, i) => !(i === 0 && l === '')).join('\n');

return [{
  json: {
    email_destinataire: destinataire,
    email_objet: objet,
    email_html: html,
    email_texte: texte,
    // Lu par le noeud « Lien de desinscription present ? » : pas de lien, pas
    // d'e-mail. Un e-mail commercial sans porte de sortie n'a pas le droit de
    // partir, et ce serait le signe que la chaine des jetons est cassee.
    envoyable: destinataire.includes('@') && desinscrire.startsWith('http'),
    annonce_id: c.annonce_id ?? null,
  },
}];
