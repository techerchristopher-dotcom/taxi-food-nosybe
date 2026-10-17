/**
 * paiement-orange-money — paiement Orange Money WebPay d'une commande déjà créée.
 *
 * Trois actions :
 *   - `creer`    (client connecté)  : ouvre un paiement chez Orange, rend la page de paiement ;
 *   - `verifier` (client connecté)  : redemande à Orange où en est le paiement ;
 *   - `balayer`  (pg_cron, en-tête x-hook-secret) : vérifie les paiements restés en
 *     attente, puis annule les commandes en ligne jamais payées (om_expirer_commandes).
 *
 * ⚠️ AUCUN MONTANT N'EST ACCEPTÉ DU CLIENT. Le montant est relu dans `orders.total`.
 * ⚠️ L'APP NE DÉCIDE JAMAIS QU'UNE COMMANDE EST PAYÉE. Le statut vient TOUJOURS
 *    de l'API « transactionstatus » d'Orange, interrogée ici, jamais d'un retour
 *    de navigateur. Le trigger `maj_payment_status_commande` en déduit
 *    `orders.payment_status`, qui réveille l'annonce au restaurant.
 * ⚠️ L'IDEMPOTENCE EST TENUE PAR LA BASE : l'index unique partiel
 *    `payment_intents_un_actif_par_commande` interdit deux paiements vivants.
 * ⚠️ LE `notif_token` NE QUITTE JAMAIS LE SERVEUR (table payment_intents_om_jetons).
 *
 * `verify_jwt = false` (supabase/config.toml) : la tâche planifiée n'a pas de
 * jeton utilisateur ; pour `creer` et `verifier`, la fonction exige elle-même un
 * VRAI utilisateur (la clé anon est un JWT valide et ne prouve rien).
 * Référence de l'API : docs/PAIEMENT-ORANGE-MONEY.md.
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.orange.com';
const SITE = 'https://taxifoodnosybe.distripro207.com';
const FONCTIONS = 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1';
const VALIDITE_MIN = 10; // durée de vie d'un lien de paiement chez Orange

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (statut: number, corps: unknown) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

type Config = {
  merchant_key: string | null;
  auth_header: string | null;
  hook_secret: string | null;
  environnement: 'dev' | 'mg';
  active: boolean;
  montant_test_max: number;
  configure: boolean;
};

type Intent = {
  id: string;
  order_id: string;
  status: string;
  amount_minor: number;
  om_reference: string | null;
  provider_intent_id: string | null;
  payment_url: string | null;
  expire_le: string | null;
  created_at: string;
};

function egalConstant(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

async function lireConfig(admin: SupabaseClient): Promise<Config> {
  const { data, error } = await admin.rpc('orange_money_config');
  if (error || !data) throw new Error('config_illisible');
  return data as Config;
}

// Jeton OAuth Orange : 1 h de validité. Gardé en mémoire de l'isolat, renouvelé
// une minute avant l'échéance.
let jetonCache: { valeur: string; expire: number } | null = null;
async function jetonOrange(cfg: Config): Promise<string> {
  if (jetonCache && jetonCache.expire > Date.now() + 60_000) return jetonCache.valeur;
  const r = await fetch(`${API}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${cfg.auth_header}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`oauth_${r.status}`);
  const d = await r.json();
  if (!d?.access_token) throw new Error('oauth_sans_jeton');
  jetonCache = { valeur: d.access_token, expire: Date.now() + Number(d.expires_in ?? 3600) * 1000 };
  return d.access_token;
}

const base = (cfg: Config) => `${API}/orange-money-webpay/${cfg.environnement === 'mg' ? 'mg' : 'dev'}/v1`;
const devise = (cfg: Config) => (cfg.environnement === 'mg' ? 'MGA' : 'OUV');

/**
 * Demande à Orange l'état d'une tentative et l'écrit en base. Ne fait JAMAIS
 * reculer un paiement capturé : chaque écriture est conditionnée à
 * `status = 'en_attente'`.
 */
async function verifierIntent(admin: SupabaseClient, cfg: Config, it: Intent): Promise<string> {
  if (it.status !== 'en_attente') return it.status;
  if (!it.provider_intent_id || !it.om_reference) {
    // Jamais parvenue jusqu'à Orange (échec à la création) : rien à demander.
    if (Date.now() - new Date(it.created_at).getTime() > 5 * 60_000) {
      await admin.from('payment_intents')
        .update({ status: 'echoue', erreur: 'creation_orange_inaboutie' })
        .eq('id', it.id).eq('status', 'en_attente');
      return 'echoue';
    }
    return 'en_attente';
  }
  const jeton = await jetonOrange(cfg);
  const r = await fetch(`${base(cfg)}/transactionstatus`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: it.om_reference, amount: it.amount_minor, pay_token: it.provider_intent_id }),
  });
  const brut = await r.text();
  let d: { status?: string; txnid?: string } = {};
  try { d = JSON.parse(brut); } catch { /* corps non JSON : traité comme inconnu */ }
  const st = String(d.status ?? '').toUpperCase();
  const evenement = { source: 'transactionstatus', http: r.status, reponse: d, le: new Date().toISOString() };

  if (st === 'SUCCESS') {
    await admin.from('payment_intents')
      .update({ status: 'capture', captured_at: new Date().toISOString(), erreur: null,
                raw_event: { ...evenement, txnid: d.txnid ?? null } })
      .eq('id', it.id).eq('status', 'en_attente');
    return 'capture';
  }
  if (st === 'FAILED' || st === 'EXPIRED') {
    await admin.from('payment_intents')
      .update({ status: 'echoue', erreur: st === 'EXPIRED' ? 'expire' : 'refuse_par_orange', raw_event: evenement })
      .eq('id', it.id).eq('status', 'en_attente');
    return 'echoue';
  }
  // INITIATED : le client n'a rien validé. Passé la validité du lien (+ marge),
  // le paiement ne peut plus aboutir : on libère la commande pour un nouvel essai.
  const expire = it.expire_le ? new Date(it.expire_le).getTime() : 0;
  if (st === 'INITIATED' && expire && Date.now() > expire + 3 * 60_000) {
    await admin.from('payment_intents')
      .update({ status: 'annule', erreur: 'lien_expire_sans_paiement', raw_event: evenement })
      .eq('id', it.id).eq('status', 'en_attente');
    return 'annule';
  }
  // PENDING, INITIATED encore valide, ou réponse illisible : on attend.
  return 'en_attente';
}

async function utilisateur(admin: SupabaseClient, req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error ? null : data?.user ?? null;
}

async function lireCommande(admin: SupabaseClient, orderId: string) {
  const { data } = await admin
    .from('orders')
    .select('id, order_number, user_id, total, payment_method, payment_status, status, om_en_ligne')
    .eq('id', orderId)
    .maybeSingle();
  return data as null | {
    id: string; order_number: string | null; user_id: string | null; total: number;
    payment_method: string; payment_status: string; status: string; om_en_ligne: boolean;
  };
}

async function intentsVivants(admin: SupabaseClient, orderId: string): Promise<Intent[]> {
  const { data } = await admin
    .from('payment_intents')
    .select('id, order_id, status, amount_minor, om_reference, provider_intent_id, payment_url, expire_le, created_at')
    .eq('order_id', orderId).eq('provider', 'orange_money').eq('status', 'en_attente');
  return (data ?? []) as Intent[];
}

// ------------------------------------------------------------------- CRÉER
async function creer(admin: SupabaseClient, cfg: Config, userId: string, orderId: string, web: boolean) {
  if (!cfg.configure) return json(503, { erreur: 'paiement_non_configure' });
  if (!cfg.active) return json(403, { erreur: 'orange_money_inactif' });

  const cmd = await lireCommande(admin, orderId);
  if (!cmd || cmd.user_id !== userId) return json(404, { erreur: 'commande_introuvable' });
  if (cmd.payment_method !== 'orange_money' || !cmd.om_en_ligne) return json(409, { erreur: 'methode_non_orange_money' });
  if (cmd.payment_status === 'paye') return json(409, { erreur: 'deja_payee' });
  if (cmd.status !== 'recue') return json(409, { erreur: 'commande_non_payable' });
  if (!(cmd.total > 0)) return json(409, { erreur: 'montant_invalide' });

  // Un paiement encore vivant ? On le revérifie ; s'il est toujours valable, on
  // rend le MÊME lien (double appui, retour en arrière, coupure réseau).
  for (const it of await intentsVivants(admin, orderId)) {
    const etat = await verifierIntent(admin, cfg, it);
    if (etat === 'capture') return json(409, { erreur: 'deja_payee' });
    const encoreValide = it.expire_le && new Date(it.expire_le).getTime() > Date.now() + 60_000;
    if (etat === 'en_attente' && encoreValide && it.payment_url) {
      return json(200, {
        payment_url: it.payment_url, expire_le: it.expire_le, montant: it.amount_minor,
        devise: devise(cfg), reference: it.id, reprise: true,
      });
    }
    if (etat === 'en_attente') {
      // Lien périmé mais Orange dit encore « en cours » : on ne crée pas de second
      // paiement par-dessus un premier qui pourrait encore aboutir.
      return json(409, { erreur: 'paiement_en_cours', reference: it.id });
    }
  }

  // Montant : le total exact en production ; plafonné en bac à sable (consigne Orange).
  const montant = cfg.environnement === 'mg' ? cmd.total : Math.min(cmd.total, cfg.montant_test_max);
  const suffixe = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const reference = `TXF-${(cmd.order_number ?? 'TF').replace(/[^A-Za-z0-9-]/g, '')}-${suffixe}`.slice(0, 30);

  const { data: ligne, error: errIns } = await admin
    .from('payment_intents')
    .insert({
      order_id: orderId, user_id: userId, provider: 'orange_money', status: 'en_attente',
      amount_minor: montant, currency: devise(cfg).toLowerCase(), amount_ar: cmd.total, fx_rate: 1,
      om_reference: reference,
    })
    .select('id')
    .single();
  if (errIns || !ligne) {
    // 23505 = un autre appel vient d'ouvrir un paiement : on rend le sien.
    if ((errIns as { code?: string } | null)?.code === '23505') {
      const [it] = await intentsVivants(admin, orderId);
      if (it?.payment_url) {
        return json(200, { payment_url: it.payment_url, expire_le: it.expire_le, montant: it.amount_minor,
                           devise: devise(cfg), reference: it.id, reprise: true });
      }
      return json(409, { erreur: 'paiement_en_cours' });
    }
    console.error('paiement-orange-money: insertion refusee', errIns);
    return json(500, { erreur: 'erreur_serveur' });
  }

  const retour = `${SITE}/om/${orderId}${web ? '?w=1' : ''}`;
  try {
    const jeton = await jetonOrange(cfg);
    const r = await fetch(`${base(cfg)}/webpayment`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_key: cfg.merchant_key,
        currency: devise(cfg),
        order_id: reference,
        amount: montant,
        return_url: retour,
        cancel_url: retour,
        notif_url: `${FONCTIONS}/om-notification?i=${ligne.id}`,
        lang: 'fr',
        reference: 'Taxi Food',
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.payment_url || !d?.pay_token || !d?.notif_token) {
      await admin.from('payment_intents')
        .update({ status: 'echoue', erreur: `webpayment_${r.status}`, raw_event: { reponse: d } })
        .eq('id', ligne.id);
      console.error('paiement-orange-money: webpayment refuse', r.status, JSON.stringify(d).slice(0, 300));
      return json(502, { erreur: 'orange_indisponible', reference: ligne.id });
    }
    const expire = new Date(Date.now() + VALIDITE_MIN * 60_000).toISOString();
    await admin.from('payment_intents_om_jetons').insert({ payment_intent_id: ligne.id, notif_token: d.notif_token });
    await admin.from('payment_intents')
      .update({ provider_intent_id: d.pay_token, payment_url: d.payment_url, expire_le: expire })
      .eq('id', ligne.id);
    return json(200, { payment_url: d.payment_url, expire_le: expire, montant, devise: devise(cfg), reference: ligne.id });
  } catch (e) {
    await admin.from('payment_intents')
      .update({ status: 'echoue', erreur: `exception_${String(e).slice(0, 80)}` })
      .eq('id', ligne.id).eq('status', 'en_attente');
    console.error('paiement-orange-money: exception', e);
    return json(502, { erreur: 'orange_indisponible', reference: ligne.id });
  }
}

// ---------------------------------------------------------------- VÉRIFIER
async function verifier(admin: SupabaseClient, cfg: Config, userId: string, orderId: string) {
  const cmd = await lireCommande(admin, orderId);
  if (!cmd || cmd.user_id !== userId) return json(404, { erreur: 'commande_introuvable' });
  if (cfg.configure) {
    for (const it of await intentsVivants(admin, orderId)) {
      try { await verifierIntent(admin, cfg, it); } catch (e) { console.error('verifier', e); }
    }
  }
  const relu = await lireCommande(admin, orderId);
  return json(200, { payment_status: relu?.payment_status ?? null, statut_commande: relu?.status ?? null });
}

// ----------------------------------------------------------------- BALAYER
async function balayer(admin: SupabaseClient, cfg: Config) {
  let verifies = 0;
  if (cfg.configure) {
    const { data } = await admin
      .from('payment_intents')
      .select('id, order_id, status, amount_minor, om_reference, provider_intent_id, payment_url, expire_le, created_at')
      .eq('provider', 'orange_money').eq('status', 'en_attente')
      .lt('created_at', new Date(Date.now() - 2 * 60_000).toISOString())
      .limit(30);
    for (const it of (data ?? []) as Intent[]) {
      try { await verifierIntent(admin, cfg, it); verifies++; } catch (e) { console.error('balayer', it.id, e); }
    }
  }
  const { data: annulees } = await admin.rpc('om_expirer_commandes');
  return json(200, { verifies, annulees: annulees ?? 0 });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let corps: { action?: unknown; order_id?: unknown; web?: unknown };
    try { corps = await req.json(); } catch { return json(400, { erreur: 'corps_invalide' }); }
    const action = String(corps.action ?? 'creer');
    const cfg = await lireConfig(admin);

    if (action === 'balayer') {
      const fourni = req.headers.get('x-hook-secret') ?? '';
      if (!cfg.hook_secret || !fourni || !egalConstant(fourni, cfg.hook_secret)) return json(403, { erreur: 'interdit' });
      return await balayer(admin, cfg);
    }

    const user = await utilisateur(admin, req);
    if (!user) return json(401, { erreur: 'authentification_requise' });
    const orderId = typeof corps.order_id === 'string' ? corps.order_id.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) return json(400, { erreur: 'order_id_invalide' });

    if (action === 'creer') return await creer(admin, cfg, user.id, orderId, corps.web === true);
    if (action === 'verifier') return await verifier(admin, cfg, user.id, orderId);
    return json(400, { erreur: 'action_inconnue' });
  } catch (e) {
    console.error('paiement-orange-money: erreur', e);
    return json(500, { erreur: 'erreur_serveur' });
  }
});
