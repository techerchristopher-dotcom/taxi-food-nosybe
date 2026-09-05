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
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SITE = 'https://taxifood.rentanoo.com';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function page(emoji, titre, corps, couleur = '#157F3C') {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
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
<a class="b" href="${SITE}/">Taxi Food</a>
</div></body></html>`;
}

export default async (request) => {
  const url = new URL(request.url);
  // /a/<id>/<token> = accepter · /r-refus/<id>/<token> = refuser
  const m = url.pathname.match(/^\/(a|r-refus)\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/?$/i);
  if (!m) {
    return new Response(page('🤔', 'Lien incomplet',
      'Ce lien ne mène nulle part. Ouvre la commande depuis l’application.', '#8A827A'),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  const [, quoi, orderId, token] = m;
  const action = quoi === 'a' ? 'accepter' : 'refuser';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[repondre-commande] variables Supabase absentes');
    return new Response(page('⚠️', 'Indisponible',
      'Réessaie dans un instant, ou accepte la commande depuis l’application.', '#8A827A'),
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/repondre_commande_par_jeton`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_order_id: orderId, p_token: token, p_action: action,
        // Un refus depuis un lien ne peut pas demander un motif libre : on en
        // pose un explicite, verifiable dans le journal.
        p_motif: action === 'refuser' ? 'Refusée par le restaurant depuis Telegram' : null,
      }),
    });
    const d = await r.json();

    if (d?.ok) {
      return new Response(
        action === 'accepter'
          ? page('✅', `Commande ${esc(d.numero)} acceptée`,
              'C’est noté. Le client vient d’être prévenu, et la commande est visible dans ton espace.')
          : page('❌', `Commande ${esc(d.numero)} refusée`,
              'Le client vient d’être prévenu. Il n’a rien à payer.', '#DF3228'),
        { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }

    if (d?.raison === 'deja traitee') {
      // Cas le plus frequent en vrai : deja repondu depuis l'application.
      // Ce n'est pas une erreur, et le dire ainsi evite une inquietude inutile.
      return new Response(page('👍', 'Déjà traitée',
        `Cette commande est déjà en « ${esc(d.statut)} ». Rien de plus à faire.`, '#8A827A'),
        { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }

    return new Response(page('🤔', 'Lien inutilisable',
      'Ce lien n’est plus valable. Ouvre la commande depuis l’application.', '#8A827A'),
      { status: 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('[repondre-commande]', e);
    return new Response(page('⚠️', 'Indisponible',
      'Réessaie dans un instant, ou accepte la commande depuis l’application.', '#8A827A'),
      { status: 500, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
};

export const config = { path: ['/a/:id/:token', '/r-refus/:id/:token'] };
