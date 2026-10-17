/**
 * om-notification — reçoit la notification de paiement d'Orange Money WebPay.
 *
 * Orange POSTe `{ status, notif_token, txnid }` sur l'adresse donnée à la
 * création du paiement : `…/om-notification?i=<payment_intents.id>`.
 *
 * ⚠️ DEUX BARRIÈRES, ET LA SECONDE EST LA VRAIE :
 *   1. le `notif_token` doit être celui qu'Orange nous a rendu à la création
 *      (comparaison à temps constant ; il ne quitte jamais le serveur) ;
 *   2. même authentifiée, la notification NE DÉCIDE RIEN : on redemande l'état à
 *      l'API « transactionstatus » d'Orange, et c'est sa réponse qui est écrite.
 *   Une notification forgée ne peut donc pas marquer une commande payée.
 *
 * Répond toujours vite (Orange n'a pas besoin de notre verdict) ; toute écriture
 * est conditionnée à `status = 'en_attente'` : rejouer la notification est sans effet.
 *
 * ⚠️ Volontairement NON factorisée avec `paiement-orange-money` (même règle que
 * notify-order / envoyer-annonce) : déployer l'une ne doit pas casser l'autre.
 * Toute correction de l'appel « transactionstatus » se porte dans LES DEUX.
 * `verify_jwt = false` : l'appelant est Orange.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.orange.com';

const repondre = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

function egalConstant(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return repondre(405, { erreur: 'methode_non_autorisee' });
  try {
    const intentId = new URL(req.url).searchParams.get('i') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(intentId)) return repondre(400, { erreur: 'reference_invalide' });

    let corps: { status?: unknown; notif_token?: unknown; txnid?: unknown } = {};
    try { corps = await req.json(); } catch { return repondre(400, { erreur: 'corps_invalide' }); }
    const notif = typeof corps.notif_token === 'string' ? corps.notif_token : '';

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: jeton } = await admin.from('payment_intents_om_jetons')
      .select('notif_token').eq('payment_intent_id', intentId).maybeSingle();
    if (!jeton?.notif_token || !notif || !egalConstant(notif, jeton.notif_token)) {
      console.warn('om-notification: jeton refuse', intentId);
      return repondre(403, { erreur: 'interdit' });
    }

    const { data: it } = await admin.from('payment_intents')
      .select('id, status, amount_minor, om_reference, provider_intent_id')
      .eq('id', intentId).eq('provider', 'orange_money').maybeSingle();
    if (!it) return repondre(404, { erreur: 'paiement_introuvable' });
    if (it.status !== 'en_attente') return repondre(200, { ok: true, deja: it.status });

    const { data: cfg } = await admin.rpc('orange_money_config');
    const c = cfg as { auth_header: string | null; environnement: string; configure: boolean } | null;
    if (!c?.configure) return repondre(503, { erreur: 'paiement_non_configure' });

    const tok = await fetch(`${API}/oauth/v3/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${c.auth_header}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: 'grant_type=client_credentials',
    }).then((r) => r.json());
    if (!tok?.access_token) return repondre(502, { erreur: 'oauth' });

    const env = c.environnement === 'mg' ? 'mg' : 'dev';
    const r = await fetch(`${API}/orange-money-webpay/${env}/v1/transactionstatus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.access_token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: it.om_reference, amount: it.amount_minor, pay_token: it.provider_intent_id }),
    });
    const d = await r.json().catch(() => ({})) as { status?: string; txnid?: string };
    const st = String(d.status ?? '').toUpperCase();
    const evenement = {
      source: 'notification', notification: { status: corps.status ?? null, txnid: corps.txnid ?? null },
      verification: { http: r.status, reponse: d }, le: new Date().toISOString(),
    };

    if (st === 'SUCCESS') {
      await admin.from('payment_intents')
        .update({ status: 'capture', captured_at: new Date().toISOString(), erreur: null, raw_event: evenement })
        .eq('id', intentId).eq('status', 'en_attente');
    } else if (st === 'FAILED' || st === 'EXPIRED') {
      await admin.from('payment_intents')
        .update({ status: 'echoue', erreur: st === 'EXPIRED' ? 'expire' : 'refuse_par_orange', raw_event: evenement })
        .eq('id', intentId).eq('status', 'en_attente');
    } else {
      // Notification reçue mais Orange ne confirme pas encore : on note, le
      // balayage reprendra.
      await admin.from('payment_intents').update({ raw_event: evenement })
        .eq('id', intentId).eq('status', 'en_attente');
    }
    return repondre(200, { ok: true, statut: st || 'inconnu' });
  } catch (e) {
    console.error('om-notification: erreur', e);
    return repondre(500, { erreur: 'erreur_serveur' });
  }
});
