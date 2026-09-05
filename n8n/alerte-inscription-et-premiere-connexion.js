/**
 * Taxi Food — inscription, premiere connexion, et mail de bienvenue.
 *
 * Trois messages sortent d'ici, selon l'evenement recu :
 *
 *  - « inscription »        -> alerte au porteur du projet. Pour un client,
 *    c'est lui qui vient de creer son compte ; pour un restaurateur, c'est
 *    NOUS. L'alerte ne prouve donc rien sur le patron, seulement sur nous.
 *
 *  - « premiere_connexion » -> DEUX messages d'un coup :
 *      1. l'alerte au porteur du projet — « il est entre, tu peux enchainer » ;
 *      2. le mail de bienvenue AU PATRON, qui l'emmene installer Telegram.
 *
 * ⚠️ Ce noeud renvoie plusieurs items quand il y a plusieurs destinataires.
 * n8n execute alors le noeud e-mail une fois par item — c'est ce qui evite une
 * branche parallele et un second noeud a maintenir. Le champ `destinataire`
 * porte l'adresse ; le noeud e-mail doit donc avoir toEmail = {{$json.destinataire}}
 * et NON une adresse en dur, sinon tout part au meme endroit.
 *
 * ⚠️ Le bouton Telegram pointe sur /telegram/ du site, PAS sur un magasin
 * precis : un e-mail n'execute pas de JavaScript et ne peut pas savoir si le
 * lecteur est sur iPhone ou Android. La detection se fait apres le clic.
 */
const c = $json.body ?? $json;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

const SITE  = 'https://taxifoodnosybe.distripro207.com';
const ICONE = SITE + '/assets/icon-192.png';
const DEPOT   = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/marketing/guide';
const LOGO_TG = DEPOT + '/telegram-logo.png';
const CAPTURE = DEPOT + '/telegram-commande.jpg';
const ADMIN = 'techerchristopher@gmail.com';

const premiere = c.evenement === 'premiere_connexion';
const resto    = c.type === 'restaurateur';
const nom      = c.nom || '(nom non renseigné)';
const tel      = c.telephone || '';
const waNum    = tel.replace(/[^0-9]/g, '');   // WhatsApp veut le numero nu.

const h = Number(c.delai_heures);
const delai = !isFinite(h) ? ''
  : h < 1  ? 'moins d’une heure après la création de son compte'
  : h < 48 ? `${String(h).replace('.', ',')} h après la création de son compte`
  :          `${Math.round(h / 24)} jours après la création de son compte`;

const ligne = (l, v) => `
  <tr><td style="padding:6px 14px 6px 0;font:400 13px Arial,sans-serif;color:#8A827A;white-space:nowrap">${l}</td>
      <td style="padding:6px 0;font:600 15px Arial,sans-serif;color:#1A1A1A">${v}</td></tr>`;

/* Enveloppe commune : la charte tient dans le mot-symbole rouge, qui reste
   lisible meme quand le client de messagerie bloque les images. */
const page = (contenu) => `<!doctype html><html lang="fr"><body style="margin:0;padding:22px 12px;background:#F5F2EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#fff;border-radius:20px;padding:26px">
${contenu}
</table></td></tr></table></body></html>`;

/* ------------------------------------------------ 1. alerte au porteur */
const emoji = premiere ? '✅' : (resto ? '🍽️' : '🙋');

const titreAlerte = premiere
  ? `${esc(nom)} s’est connecté${c.restaurant ? '<br><span style="color:#8A827A">' + esc(c.restaurant) + '</span>' : ''}`
  : (resto ? `Nouveau restaurateur${c.restaurant ? ' — ' + esc(c.restaurant) : ''}` : 'Nouveau client');

const suite = premiere ? `
  <tr><td style="padding-top:20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF3F2;border-radius:14px">
      <tr><td style="padding:16px 18px;font:400 14px/1.55 Arial,sans-serif;color:#1A1A1A">
        <strong style="font-weight:700">Le mail de bienvenue vient de partir chez lui.</strong>
        Envoie-lui un WhatsApp pour confirmer, puis passe régler Telegram sur son téléphone.
      </td></tr>
    </table>
  </td></tr>` : '';

const alerte = page(`
  <tr><td style="font:800 19px/1 Arial,sans-serif;color:#DF3228">TAXI FOOD</td></tr>
  <tr><td style="padding-top:18px;font-size:40px;line-height:1">${emoji}</td></tr>
  <tr><td style="padding-top:10px;font:700 23px/1.25 Arial,sans-serif;color:#1A1A1A">${titreAlerte}</td></tr>
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
  </td></tr>`);

const sorties = [{
  json: {
    destinataire: ADMIN,
    // ⚠️ PAS d'echappement HTML ici : une ligne d'objet est du texte brut.
    // « Chez Bidul & Truc » y devenait « Chez Bidul &amp; Truc », lisible tel
    // quel dans la boite de reception.
    objet: premiere
      ? `✅ ${c.restaurant ? c.restaurant + ' ' : ''}s’est connecté — ${nom}`
      : `${emoji} ${resto ? 'Restaurateur' : 'Client'} — ${nom} (${c.email})`,
    html: alerte,
  },
}];

/* ---------------------------------------- 2. bienvenue au restaurateur */
// Uniquement a la premiere connexion d'un restaurateur, et seulement s'il a
// une adresse : un compte cree par telephone n'en a pas.
if (premiere && resto && c.email) {
  const prenom = String(nom).trim().split(/\s+/)[0];
  const bonjour = prenom && prenom !== '(nom' ? `Bonjour ${esc(prenom)},` : 'Bonjour,';

  const bienvenue = page(`
  <tr><td style="font:800 19px/1 Arial,sans-serif;color:#DF3228">TAXI FOOD</td></tr>
  <tr><td align="center" style="padding-top:22px">
    <img src="${ICONE}" width="76" height="76" alt=""
         style="display:block;border:0;border-radius:19px">
  </td></tr>
  <tr><td align="center" style="padding-top:18px;font:700 25px/1.25 Arial,sans-serif;color:#1A1A1A">
    Bienvenue${c.restaurant ? ',<br>' + esc(c.restaurant) : ''} 🎉
  </td></tr>
  <tr><td style="padding-top:16px;font:400 15px/1.6 Arial,sans-serif;color:#5A544E">
    ${bonjour} votre espace est ouvert, vous venez de vous y connecter.
    Votre restaurant est en ligne sur Taxi&nbsp;Food.
  </td></tr>

  <!-- Bloc Telegram : logo, puis a quoi ca sert, puis la preuve en image. -->
  <tr><td style="padding-top:26px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDF3F2;border-radius:16px">
      <tr><td style="padding:20px 20px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="48" style="padding-right:12px">
              <img src="${LOGO_TG}" width="44" height="44" alt="Telegram"
                   style="display:block;border:0">
            </td>
            <td style="font:700 18px/1.3 Arial,sans-serif;color:#1A1A1A">
              Il reste une chose :<br>installer Telegram
            </td>
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding:14px 20px 20px;font:400 15px/1.6 Arial,sans-serif;color:#1A1A1A">
        C'est une application de messagerie gratuite, comme WhatsApp.
        <strong style="font-weight:700">Chaque commande y arrive avec la photo du
        plat, ce que le client a choisi, le montant et son numéro</strong> — et
        deux boutons : <strong style="font-weight:700">J'accepte</strong> ou
        <strong style="font-weight:700">Je refuse</strong>. Un seul appui, et
        vous lancez votre chef. Rien d'autre à ouvrir.
      </td></tr>
    </table>
  </td></tr>

  <tr><td align="center" style="padding-top:22px;font:600 13px Arial,sans-serif;color:#8A827A;letter-spacing:.04em">
    VOILÀ CE QUE VOUS RECEVREZ
  </td></tr>
  <tr><td align="center" style="padding-top:12px">
    <img src="${CAPTURE}" width="440" alt="Une commande reçue sur Telegram, avec les boutons J'accepte et Je refuse"
         style="display:block;border:0;width:440px;max-width:100%;height:auto;border-radius:14px">
  </td></tr>

  <tr><td align="center" style="padding-top:26px">
    <a href="${SITE}/telegram/"
       style="display:inline-block;background:#DF3228;color:#fff;text-decoration:none;font:700 17px Arial,sans-serif;padding:16px 34px;border-radius:999px">
      Installer Telegram
    </a>
  </td></tr>
  <tr><td align="center" style="padding-top:10px;font:400 13px Arial,sans-serif;color:#8A827A">
    Gratuit. Le lien ouvre directement votre magasin d'applications.
  </td></tr>

  <tr><td style="padding-top:26px;border-top:1px solid #E9E5E0;font:400 13px/1.6 Arial,sans-serif;color:#8A827A">
    Une fois Telegram installé, ne cherchez pas plus loin : on règle le reste
    ensemble quand on se voit, ça prend trente secondes. À très vite !
  </td></tr>`);

  sorties.push({
    json: {
      destinataire: c.email,
      objet: c.restaurant
        ? `Bienvenue sur Taxi Food, ${c.restaurant} 🎉`
        : 'Bienvenue sur Taxi Food 🎉',
      html: bienvenue,
    },
  });
}

return sorties;
