
/**
 * Taxi Food — mise en forme des notifications de commande.
 *
 * Recoit la charge du trigger Postgres `notify_order_status` et prepare
 * l'e-mail au CLIENT (tous les statuts) et le message Telegram au RESTAURANT
 * (nouvelle commande et annulation seulement).
 *
 * ⚠️ Tout est en TABLEAUX et en styles en ligne : les clients de messagerie
 * ignorent les feuilles de style, et beaucoup cassent flexbox et grid. Un
 * e-mail se construit comme en 2005, ou il s'affiche de travers chez Outlook.
 *
 * ⚠️ Les images viennent deja redimensionnees par la base (`render/image`).
 * Les visuels d'origine font jusqu'a 2 Mo : la plupart des messageries
 * abandonneraient le chargement et laisseraient un cadre vide.
 */
const c = $json.body ?? $json;

const cmd   = c.commande          || {};
const cli   = c.client            || {};
const resto = c.restaurant        || {};
const adr   = c.livraison_adresse || {};
const items = Array.isArray(c.articles) ? c.articles : [];
// Emballages regroupes par libelle (« Consigne bouteille », « Boite a pizza »…),
// avec le nombre d'unites : c'est le restaurant qui encaisse la consigne et devra
// la rendre. Absent des anciennes charges -> on retombe sur la ligne « Emballage ».
const embs = Array.isArray(c.emballages) ? c.emballages : [];

const SITE  = 'https://taxifood.rentanoo.com';

const ar = (n) => (typeof n === 'number' ? n : 0).toLocaleString('fr-FR').replace(/ | /g, ' ') + ' Ar';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (x) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]));

// L'etape « recuperee » n'a pas de statut propre : la commande reste
// `en_livraison` du debut a la fin, seul picked_up_at se remplit.
const cle = c.recuperee ? 'recuperee'
          : (c.evenement === 'nouvelle' ? 'recue' : (cmd.statut || 'recue'));

const T = {
  recue:          { emo: '📝', objet: `Commande ${cmd.numero} bien reçue`,
                    titre: 'On a bien reçu ta commande',
                    corps: `${resto.nom || 'Le restaurant'} vient de la recevoir. On te prévient dès qu’elle est acceptée.` },
  confirmee:      { emo: '👍', objet: `${resto.nom} a accepté ta commande ${cmd.numero}`,
                    titre: 'Ta commande est acceptée',
                    corps: `${resto.nom} prépare ta commande. On te tient au courant à chaque étape.` },
  en_preparation: { emo: '👨‍🍳', objet: `Ta commande ${cmd.numero} est en cuisine`,
                    titre: 'C’est en cuisine',
                    corps: `${resto.nom} a commencé la préparation. Plus très long.` },
  en_livraison:   { emo: '🛍️', objet: `Ta commande ${cmd.numero} est prête`,
                    titre: 'Ta commande est prête',
                    corps: 'Elle attend un livreur. Tu seras prévenu dès qu’il part avec.' },
  recuperee:      { emo: '🛵', objet: `Ton livreur est parti avec la commande ${cmd.numero}`,
                    titre: 'Le livreur est en route',
                    corps: 'Il a récupéré ta commande et se dirige vers toi. Garde ton téléphone à portée.' },
  livree:         { emo: '🎉', objet: `Bon appétit — commande ${cmd.numero} livrée`,
                    titre: 'Livrée. Bon appétit !',
                    corps: `Merci d’avoir commandé chez ${resto.nom} avec Taxi Food. À très vite.` },
  annulee:        { emo: '❌', objet: `Commande ${cmd.numero} annulée`,
                    titre: 'Ta commande a été annulée',
                    corps: cmd.motif_annulation
                      ? `Motif : ${cmd.motif_annulation}. Tu n’as rien à payer.`
                      : 'Tu n’as rien à payer. N’hésite pas à réessayer plus tard.' },
};
const t = T[cle] || T.recue;

// Une ligne par plat, avec sa photo. Un cadre gris tient la place quand le plat
// n'a pas de visuel : mieux qu'une image cassee.
const optionsDe = (a) =>
  (Array.isArray(a.options) ? a.options : []).map((o) => o.nom).join(', ');

const lignes = items.map((a) => {
  const opt = optionsDe(a);
  return `
  <tr>
    <td width="56" style="padding:8px 12px 8px 0;vertical-align:top">
      ${a.photo
        ? `<img src="${esc(a.photo)}" width="56" height="56" alt="" style="width:56px;height:56px;border-radius:12px;object-fit:cover;display:block;background:#EFEBE6">`
        : `<div style="width:56px;height:56px;border-radius:12px;background:#EFEBE6"></div>`}
    </td>
    <td style="padding:8px 0;vertical-align:top;font:400 15px Arial,sans-serif;color:#1A1A1A">
      ${a.quantite} × ${esc(a.nom)}
      ${opt ? `<div style="font:400 13px/1.45 Arial,sans-serif;color:#6B6662;padding-top:3px">${esc(opt)}</div>` : ''}
      ${a.commentaire ? `<div style="font:italic 13px/1.45 Arial,sans-serif;color:#8A827A;padding-top:2px">« ${esc(a.commentaire)} »</div>` : ''}
    </td>
    <td align="right" style="padding:8px 0;vertical-align:top;font:400 15px Arial,sans-serif;color:#1A1A1A;white-space:nowrap">
      ${ar(a.prix * a.quantite)}
    </td>
  </tr>`;
}).join('');

const total = (l, v, gras) => `
  <tr><td colspan="2" style="padding:4px 0;font:${gras ? 700 : 400} 15px Arial,sans-serif;color:${gras ? '#1A1A1A' : '#6B6662'}">${l}</td>
      <td align="right" style="padding:4px 0;font:${gras ? 700 : 400} 15px Arial,sans-serif;color:${gras ? '#DF3228' : '#6B6662'};white-space:nowrap">${v}</td></tr>`;

const suivi = cmd.lien_suivi || (SITE + '/o/' + (cmd.id || ''));

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#F5F2EF">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border-radius:22px">
  <tr><td style="padding:26px 26px 0">
    <div style="font:800 21px/1 Arial,sans-serif;color:#DF3228;letter-spacing:-.02em">TAXI FOOD</div>
    <div style="font:400 12px/1.4 Arial,sans-serif;color:#8A827A;padding-top:4px">Livraison de repas à Nosy Be</div>
  </td></tr>

  <tr><td align="center" style="padding:26px 26px 0;font-size:46px;line-height:1">${t.emo}</td></tr>
  <tr><td align="center" style="padding:12px 26px 0;font:700 25px/1.25 Arial,sans-serif;color:#1A1A1A">${esc(t.titre)}</td></tr>
  <tr><td align="center" style="padding:10px 26px 0;font:400 15px/1.6 Arial,sans-serif;color:#4A4744">${esc(t.corps)}</td></tr>

  ${resto.logo ? `
  <tr><td align="center" style="padding:20px 26px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#F7F4F1;border-radius:999px"><tr>
      <td style="padding:7px 16px 7px 7px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="34"><img src="${esc(resto.logo)}" width="34" height="34" alt="" style="width:34px;height:34px;border-radius:999px;object-fit:cover;display:block;background:#EFEBE6"></td>
          <td style="padding-left:10px;font:700 14px Arial,sans-serif;color:#1A1A1A">${esc(resto.nom || '')}</td>
        </tr></table>
      </td>
    </tr></table>
  </td></tr>` : ''}

  <tr><td style="padding:24px 26px 0;font:500 11px/1 Arial,sans-serif;color:#8A827A;letter-spacing:.14em">COMMANDE ${esc(cmd.numero || '')}</td></tr>
  <tr><td style="padding:8px 26px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${lignes}
      <tr><td colspan="3" style="border-top:1px solid #E9E5E0;padding-top:10px"></td></tr>
      ${embs.length
        ? embs.map((e) => total(`${esc(e.libelle)} · ${e.unites} × ${ar(e.unitaire)}`, ar(e.montant))).join('')
        : (cmd.emballage ? total('Emballage', ar(cmd.emballage)) : '')}
      ${total('Livraison', ar(cmd.livraison))}
      ${total('Total', ar(cmd.total), true)}
    </table>
  </td></tr>

  <tr><td align="center" style="padding:26px 26px 0">
    <a href="${esc(suivi)}" style="display:inline-block;background:#DF3228;color:#ffffff;text-decoration:none;font:700 16px Arial,sans-serif;padding:15px 30px;border-radius:999px">Suivre ma commande</a>
  </td></tr>

  ${resto.telephone ? `<tr><td align="center" style="padding:18px 26px 0;font:400 13px Arial,sans-serif;color:#6B6662">Une question ? Appelle ${esc(resto.nom)} au <a href="tel:${esc(resto.telephone)}" style="color:#DF3228;text-decoration:none">${esc(resto.telephone)}</a>.</td></tr>` : ''}

  <tr><td style="padding:24px 26px 26px">
    <div style="border-top:1px solid #E9E5E0;padding-top:16px;font:400 12px/1.5 Arial,sans-serif;color:#8A827A">
      Tu reçois cet e-mail parce que tu as passé une commande sur Taxi Food.
    </div>
  </td></tr>
</table>
<div style="height:24px"></div>
</td></tr></table></body></html>`;

// La position ne sert PAS au restaurant : c'est le livreur qui se deplace.
// Elle reste dans la charge utile pour l'ecran de pilotage et l'app livreur.

const detail = items.map((a) => {
  const opt = optionsDe(a);
  return `• ${a.quantite} × ${a.nom}` + (opt ? `\n   ↳ ${opt}` : '')
       + (a.commentaire ? `\n   ✎ ${a.commentaire}` : '');
}).join('\n');

// ⚠️ Montant HORS livraison : c'est ce que le restaurant encaisse. Afficher le
// total ferait croire a une recette plus elevee que la reelle — la livraison ne
// lui revient pas.
// Langue du RESTAURANT (colonne restaurants.langue, transmise par notify_order_status).
// 'fr' par defaut ; 'it' pour Les Siciliens (2026-10-02). Le texte francais ci-dessous
// est IDENTIQUE a l'ancien : les autres restaurants ne voient aucune difference.
const langue = resto.langue === 'it' ? 'it' : 'fr';
const PAIEMENT_IT = { cb: 'carta', especes: 'contanti', orange_money: 'Orange Money' };

// 2026-10-22 : le texte de la NOUVELLE commande est composé par la base
// (`texte_telegram_commande`, une seule source pour le restaurant et la copie admin) :
// suppléments payants en tête, montant, commission, net à reverser, paiement en clair.
// Ancien texte gardé en REPLI si le champ manque (charge ancienne, mise en forme en échec).
const texteBase = (c.evenement === 'nouvelle' && cle !== 'annulee' && typeof c.telegram_texte === 'string' && c.telegram_texte)
  ? c.telegram_texte : null;
const telegramAncien = langue === 'it'
  ? (cle === 'annulee'
    ? `❌ Ordine ${cmd.numero} ANNULLATO\n${cmd.motif_annulation ? 'Motivo: ' + cmd.motif_annulation : ''}`
    : `🛵 NUOVO ORDINE ${cmd.numero}\n\n`
      + detail
      + (embs.length ? '\n' + embs.map((e) => `\n📦 ${e.libelle} — ${e.unites} × ${ar(e.unitaire)} = ${ar(e.montant)}`).join('') : '')
      + `\n\n💰 ${ar(cmd.sous_total)} (consegna esclusa) · ${PAIEMENT_IT[cmd.paiement] || cmd.paiement}`
      + `\n👤 ${cli.nom || '—'}${cli.telephone ? '\n📞 ' + cli.telephone : ''}`
      + (adr.precisions ? `\n🏠 ${adr.precisions}` : ''))
  : (cle === 'annulee'
    ? `❌ Commande ${cmd.numero} ANNULÉE\n${cmd.motif_annulation ? 'Motif : ' + cmd.motif_annulation : ''}`
    : `🛵 NOUVELLE COMMANDE ${cmd.numero}\n\n`
      + detail
      + (embs.length ? '\n' + embs.map((e) => `\n📦 ${e.libelle} — ${e.unites} × ${ar(e.unitaire)} = ${ar(e.montant)}`).join('') : '')
      + `\n\n💰 ${ar(cmd.sous_total)} (hors livraison) · ${cmd.paiement}`
      + `\n👤 ${cli.nom || '—'}${cli.telephone ? '\n📞 ' + cli.telephone : ''}`
      + (adr.precisions ? `\n🏠 ${adr.precisions}` : ''));
const telegram = texteBase || telegramAncien;

// Telegram coupe une légende de photo au-delà de 1024 caractères : au-delà, message sans photo.
const photoTete = (items.find((a) => a.photo) || {}).photo || '';
const photoPossible = Boolean(photoTete) && telegram.length <= 1000;

return [{
  json: {
    cle,
    envoyer_email: Boolean(cli.email),
    email_destinataire: cli.email || '',
    email_objet: `${t.emo} ${t.objet}`,
    email_html: html,
    envoyer_telegram: Boolean(resto.telegram_chat_id) && (c.evenement === 'nouvelle' || cle === 'annulee'),
    telegram_chat_id: resto.telegram_chat_id || '',
    telegram_texte: telegram,
    btn_accepter: langue === 'it' ? '✅ Accetto' : "✅ J'accepte",
    btn_refuser: langue === 'it' ? '❌ Rifiuto' : '❌ Je refuse',
    // Telegram n'accepte pas de boutons sur un album : on envoie donc UNE
    // photo, celle du premier plat, avec le recapitulatif en legende et les
    // boutons attaches. Deux messages separes (album puis texte) auraient
    // fait sonner le telephone deux fois par commande.
    photo_tete: photoTete,
    avec_photo: photoPossible,
    lien_accepter: cmd.lien_accepter || '',
    lien_refuser: cmd.lien_refuser || '',
    numero: cmd.numero,
    restaurant: resto.nom,
  },
}];
