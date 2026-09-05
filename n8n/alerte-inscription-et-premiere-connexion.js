/**
 * Taxi Food — alerte inscription ET premiere connexion.
 *
 * Deux evenements arrivent sur ce webhook, et ils ne veulent pas dire la meme
 * chose :
 *
 *  - « inscription » — un compte vient d'etre cree. Pour un client, c'est lui
 *    qui vient de le faire. Pour un restaurateur, c'est NOUS : on cree les
 *    comptes partenaires a l'avance. L'alerte ne prouve donc rien sur le
 *    patron, seulement sur nous.
 *
 *  - « premiere_connexion » — le patron s'est servi pour la premiere fois des
 *    identifiants qu'on lui a envoyes. C'est le seul signal qui dise « il est
 *    entre », et c'est le moment d'enchainer sur Telegram.
 *
 * Sans cette distinction, on envoie des identifiants et on n'apprend plus rien :
 * impossible de savoir s'il a reussi, perdu le message, ou jamais essaye.
 */
const c = $json.body ?? $json;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

const premiere = c.evenement === 'premiere_connexion';
const resto    = c.type === 'restaurateur';
const nom      = c.nom || '(nom non renseigné)';
const tel      = c.telephone || '';
// WhatsApp veut le numero sans « + » ni espaces.
const waNum    = tel.replace(/[^0-9]/g, '');

// Combien de temps entre l'envoi des identifiants et son entree. Un delai qui
// s'allonge est le signe qu'il faut rappeler, pas attendre.
const h = Number(c.delai_heures);
const delai = !isFinite(h) ? ''
  : h < 1  ? 'moins d’une heure après la création de son compte'
  : h < 48 ? `${String(h).replace('.', ',')} h après la création de son compte`
  :          `${Math.round(h / 24)} jours après la création de son compte`;

const ligne = (l, v) => `
  <tr><td style="padding:6px 14px 6px 0;font:400 13px Arial,sans-serif;color:#8A827A;white-space:nowrap">${l}</td>
      <td style="padding:6px 0;font:600 15px Arial,sans-serif;color:#1A1A1A">${v}</td></tr>`;

const emoji = premiere ? '✅' : (resto ? '🍽️' : '🙋');

const titre = premiere
  ? `${esc(nom)} s’est connecté${c.restaurant ? '<br><span style="color:#8A827A">' + esc(c.restaurant) + '</span>' : ''}`
  : (resto ? `Nouveau restaurateur${c.restaurant ? ' — ' + esc(c.restaurant) : ''}` : 'Nouveau client');

// Ce qu'il reste a faire, ecrit noir sur blanc : l'alerte sert a declencher le
// geste suivant, pas seulement a informer.
const suite = premiere ? `
  <tr><td style="padding-top:20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:#FDF3F2;border-radius:14px">
      <tr><td style="padding:16px 18px;font:400 14px/1.55 Arial,sans-serif;color:#1A1A1A">
        <strong style="font-weight:700">Prochaine étape :</strong> lui faire installer Telegram,
        puis prendre son téléphone trente secondes pour appuyer sur DÉMARRER dans
        <span style="font-weight:600">@Taxifood_commandes_bot</span>.
      </td></tr>
    </table>
  </td></tr>` : '';

const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:22px 12px;background:#F5F2EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#fff;border-radius:20px;padding:26px">
  <tr><td style="font:800 19px/1 Arial,sans-serif;color:#DF3228">TAXI FOOD</td></tr>
  <tr><td style="padding-top:18px;font-size:40px;line-height:1">${emoji}</td></tr>
  <tr><td style="padding-top:10px;font:700 23px/1.25 Arial,sans-serif;color:#1A1A1A">${titre}</td></tr>
  <tr><td style="padding-top:16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      ${premiere ? '' : ligne('Nom', esc(nom))}
      ${ligne('E-mail', `<a href="mailto:${esc(c.email)}" style="color:#DF3228;text-decoration:none">${esc(c.email)}</a>`)}
      ${tel ? ligne('Téléphone', `<a href="tel:${esc(tel)}" style="color:#DF3228;text-decoration:none">${esc(tel)}</a>`)
            : ligne('Téléphone', '<span style="color:#8A827A;font-weight:400">pas encore connu</span>')}
      ${ligne(premiere ? 'Entré par' : 'Connexion', esc(c.fournisseur))}
      ${premiere ? '' : ligne('Rôles', esc(c.roles))}
    </table>
  </td></tr>
  ${suite}
  ${waNum ? `<tr><td style="padding-top:22px">
    <a href="https://wa.me/${waNum}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font:700 15px Arial,sans-serif;padding:13px 22px;border-radius:999px">Écrire sur WhatsApp</a>
  </td></tr>` : ''}
  <tr><td style="padding-top:22px;border-top:1px solid #E9E5E0;font:400 12px/1.5 Arial,sans-serif;color:#8A827A">
    ${premiere
      ? `Première connexion le ${esc(String(c.connecte_le || '').slice(0, 16).replace('T', ' à '))}${delai ? ', ' + esc(delai) : ''}.`
      : `Inscription du ${esc(String(c.inscrit_le || '').slice(0, 16).replace('T', ' à '))}.`}
  </td></tr>
</table></td></tr></table></body></html>`;

const objet = premiere
  ? `✅ ${c.restaurant ? esc(c.restaurant) + ' ' : ''}s’est connecté — ${nom}`
  : `${emoji} ${resto ? 'Restaurateur' : 'Client'} — ${nom} (${c.email})`;

return [{ json: { objet, html } }];
