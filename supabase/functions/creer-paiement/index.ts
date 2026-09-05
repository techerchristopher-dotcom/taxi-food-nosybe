/**
 * creer-paiement — prépare le paiement carte d'une commande déjà créée.
 *
 * Appelée par l'app (mobile ET web) juste après `create_order`, elle rend le
 * `client_secret` dont le PaymentSheet (natif) ou le Payment Element (web) a besoin.
 *
 * ⚠️ LE POINT LE PLUS IMPORTANT DE CE FICHIER : ELLE N'ACCEPTE AUCUN MONTANT.
 * L'entrée est `{ order_id, idempotency_key }`, rien d'autre. Le montant est RELU
 * dans `orders.total` puis converti par la fonction SQL `montant_eur_centimes`.
 * Si cette fonction acceptait un montant venu du client, tout le calcul serveur
 * (prix, frais d'emballage, livraison, code promo) deviendrait décoratif : il
 * suffirait d'un `curl` avec `amount: 1` pour manger chez Angelo à un centime.
 * Tout champ supplémentaire présent dans le corps est ignoré, jamais lu.
 *
 * ⚠️ LE TAUX DE CHANGE NE SE CALCULE PAS ICI. `montant_eur_centimes` est le seul
 * endroit du projet où l'ariary devient de l'euro (parti pris n°2 de la migration
 * `socle_paiement_carte`). Recalculer en TypeScript créerait une seconde vérité,
 * qui divergerait le jour où le taux change.
 *
 * ⚠️ L'IDEMPOTENCE EST TENUE PAR LA BASE, PAS PAR CE CODE. On INSÈRE la ligne
 * `payment_intents` AVANT d'appeler Stripe : l'index unique partiel
 * `payment_intents_un_actif_par_commande` fait échouer le second appel concurrent
 * (double tap, retry réseau) avec un `23505`. On relit alors la ligne existante et
 * on rejoue SA clé `idempotency_key` vers Stripe, qui rend le même PaymentIntent
 * au lieu d'en créer un second. Un `select` suivi d'un `insert` laisserait passer
 * les deux appels et débiterait le client deux fois.
 *
 * `idempotency_key` reçue du client : conservée dans les métadonnées Stripe pour
 * la traçabilité (relier un appel de l'app à un PaymentIntent lors d'une enquête).
 * Ce n'est PAS elle qui est envoyée en en-tête `Idempotency-Key` — c'est celle
 * générée en base, la seule qui survit à un redémarrage de l'app.
 *
 * `verify_jwt = true` : l'appelant est un utilisateur connecté. ⚠️ Cela ne suffit
 * pas — la clé `anon` du projet est elle aussi un JWT valide et franchit cette
 * barrière. La fonction revérifie donc qu'il y a un VRAI utilisateur derrière.
 *
 * Secrets Stripe dans le Vault, lus par `stripe_config()` réservée à `service_role`.
 * Tant que `stripe_secret_key` n'y est pas, la fonction répond proprement
 * « paiement non configuré » — elle ne plante jamais.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API = 'https://api.stripe.com/v1';

/**
 * L'app est aussi exportée en web (taxifood.distripro207.com) : sans ces en-têtes,
 * le navigateur refuse l'appel avant même qu'il parte.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type StripeConfig = {
  secret_key: string | null;
  webhook_secret: string | null;
  publishable_key: string | null;
  devise: string | null;
  carte_active: boolean | null;
  configure: boolean;
};

type Order = {
  id: string;
  order_number: string | null;
  user_id: string;
  total: number;
  payment_method: string | null;
  payment_status: string;
  status: string;
};

type IntentRow = {
  id: string;
  provider_intent_id: string | null;
  status: string;
  amount_minor: number;
  currency: string;
  amount_ar: number;
  fx_rate: string | number;
  idempotency_key: string;
};

/** Statuts de commande sur lesquels il n'y a plus rien à encaisser. */
const STATUTS_NON_PAYABLES = new Set(['annulee', 'refusee', 'livree']);

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Le vocabulaire Stripe traduit vers `payment_intent_status`. */
function statutDepuisStripe(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'processing':
      return 'en_attente';
    case 'requires_action':
      return 'requiert_action';
    case 'requires_capture':
      return 'autorise';
    case 'succeeded':
      return 'capture';
    case 'canceled':
      return 'annule';
    default:
      return 'en_attente';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ---------------------------------------------------------------- 1. QUI APPELLE
  // `verify_jwt` a déjà écarté les requêtes sans jeton, mais il accepte la clé
  // `anon` (qui est un JWT de rôle `anon`, pas un utilisateur). On exige un
  // utilisateur réel : sans lui, il n'y a personne à qui rattacher un paiement.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) {
    return json(401, {
      erreur: 'authentification_requise',
      message: 'Connecte-toi pour payer par carte.',
    });
  }

  // ------------------------------------------------------------------ 2. L'ENTRÉE
  // Deux champs, et deux seulement. Tout le reste du corps est ignoré : c'est ce
  // qui rend impossible l'envoi d'un montant par le client.
  let corps: { order_id?: unknown; idempotency_key?: unknown };
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: 'corps_invalide' });
  }

  const orderId = typeof corps.order_id === 'string' ? corps.order_id.trim() : '';
  const cleClient = typeof corps.idempotency_key === 'string' ? corps.idempotency_key.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return json(400, { erreur: 'order_id_invalide' });
  }

  // ------------------------------------------------------------- 3. LA COMMANDE
  // `service_role` contourne la RLS : c'est le filtre `user_id` ci-dessous qui
  // fait l'autorisation, explicitement, plutôt qu'un effet de bord de policy.
  const { data: commande, error: orderError } = await admin
    .from('orders')
    .select('id, order_number, user_id, total, payment_method, payment_status, status')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) {
    console.error('lecture commande impossible', orderError);
    return json(500, { erreur: 'lecture_commande' });
  }

  const order = commande as Order | null;
  // Même réponse pour « n'existe pas » et « n'est pas à toi » : un code distinct
  // permettrait d'énumérer les commandes des autres.
  if (!order || order.user_id !== user.id) {
    return json(404, {
      erreur: 'commande_introuvable',
      message: 'Commande introuvable.',
    });
  }

  if (order.payment_method !== 'cb') {
    return json(409, {
      erreur: 'methode_non_carte',
      message: 'Cette commande n\'est pas réglée par carte.',
    });
  }

  if (order.payment_status === 'paye') {
    return json(409, {
      erreur: 'deja_payee',
      message: 'Cette commande est déjà payée.',
    });
  }

  // -------------------------------------------------- 4. LE CANAL EST-IL OUVERT
  const { data: cfgData, error: cfgError } = await admin.rpc('stripe_config');
  const cfg = cfgData as StripeConfig | null;

  if (cfgError || !cfg?.configure || !cfg.secret_key) {
    // Cas normal tant que le porteur du projet n'a pas déposé `stripe_secret_key`
    // dans le Vault. On le dit, on ne plante pas : l'app doit pouvoir proposer
    // les espèces sans voir une erreur technique.
    console.error('stripe_config indisponible ou incomplète', cfgError);
    return json(503, {
      erreur: 'paiement_non_configure',
      message: 'Le paiement par carte n\'est pas encore disponible.',
    });
  }

  if (!cfg.carte_active) {
    // Interrupteur général (`payment_config.carte_active`). Coupé, il doit
    // refuser AVANT tout appel à Stripe — c'est l'arrêt d'urgence.
    return json(503, {
      erreur: 'carte_inactive',
      message: 'Le paiement par carte n\'est pas encore disponible.',
    });
  }

  // Vérifié après le canal : un système de carte coupé se signale d'abord, quel
  // que soit l'état de la commande.
  if (STATUTS_NON_PAYABLES.has(order.status)) {
    return json(409, {
      erreur: 'commande_non_payable',
      message: 'Cette commande ne peut plus être payée.',
    });
  }

  // ------------------------------------------------------------- 5. LE MONTANT
  // ⚠️ Relu en base, converti en base. Aucun chiffre du client n'entre ici.
  const { data: montant, error: montantError } = await admin.rpc('montant_eur_centimes', {
    p_total_ar: order.total,
  });
  if (montantError || typeof montant !== 'number') {
    // `montant_eur_centimes` lève une exception explicite (montant trop faible,
    // total nul) : son message est écrit pour être montré tel quel.
    console.error('conversion impossible', montantError);
    return json(422, {
      erreur: 'montant_invalide',
      message: montantError?.message ?? 'Montant impossible à convertir.',
    });
  }

  const { data: config } = await admin
    .from('payment_config')
    .select('fx_ar_per_eur, devise_paiement')
    .eq('id', 1)
    .single();
  const fxRate = Number(config?.fx_ar_per_eur ?? 0);
  const devise = (config?.devise_paiement ?? cfg.devise ?? 'eur').toLowerCase();

  // ------------------------------------------------ 6. LA LIGNE AVANT STRIPE
  // On écrit D'ABORD, on appelle Stripe ENSUITE : c'est l'index unique partiel
  // qui arbitre entre deux appels concurrents, pas ce code.
  let ligne: IntentRow | null = null;
  const { data: inseree, error: insertError } = await admin
    .from('payment_intents')
    .insert({
      order_id: order.id,
      user_id: user.id,
      provider: 'stripe',
      amount_minor: montant,
      currency: devise,
      amount_ar: order.total,
      fx_rate: fxRate,
    })
    .select('id, provider_intent_id, status, amount_minor, currency, amount_ar, fx_rate, idempotency_key')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      // Un paiement est déjà vivant sur cette commande. On le REPREND — on n'en
      // crée surtout pas un second.
      const { data: existante } = await admin
        .from('payment_intents')
        .select('id, provider_intent_id, status, amount_minor, currency, amount_ar, fx_rate, idempotency_key')
        .eq('order_id', order.id)
        .in('status', ['en_attente', 'requiert_action', 'autorise'])
        .maybeSingle();
      ligne = existante as IntentRow | null;
    }
    if (!ligne) {
      console.error('insertion payment_intents impossible', insertError);
      return json(500, { erreur: 'creation_paiement' });
    }
  } else {
    ligne = inseree as IntentRow;
  }

  // ------------------------------------------------------------- 7. STRIPE
  const enTetes = {
    Authorization: `Bearer ${cfg.secret_key}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  let intent: Record<string, unknown> | null = null;

  // Si la ligne reprise porte déjà un `pi_...`, on relit le PaymentIntent plutôt
  // que d'en recréer un : c'est le cas du client qui rouvre l'écran de paiement.
  if (ligne.provider_intent_id) {
    const relecture = await fetch(`${STRIPE_API}/payment_intents/${ligne.provider_intent_id}`, {
      headers: { Authorization: enTetes.Authorization },
    });
    if (relecture.ok) intent = await relecture.json();
    else console.error('relecture PaymentIntent échouée', relecture.status, await relecture.text().catch(() => ''));
  }

  if (!intent) {
    const form = new URLSearchParams();
    // ⚠️ Le montant vient de `ligne.amount_minor`, calculé en base. Quand on
    // reprend une ligne existante on rejoue SON montant, pas le montant du jour :
    // un PaymentIntent déjà créé chez Stripe porte l'ancien.
    form.set('amount', String(ligne.amount_minor));
    form.set('currency', ligne.currency);
    // PaymentSheet et Payment Element choisissent eux-mêmes les moyens activés
    // sur le compte. Rien à lister ici, donc rien à maintenir.
    form.set('automatic_payment_methods[enabled]', 'true');
    form.set('description', `Taxi Food ${order.order_number ?? order.id}`);
    // ⚠️ LES MÉTADONNÉES SONT LE FILET DE RATTRAPAGE. Le jour où un webhook se
    // perd, c'est avec elles qu'on rapproche à la main un paiement Stripe d'une
    // commande — sans elles, un `pi_...` orphelin n'est rattachable à rien.
    form.set('metadata[order_id]', order.id);
    form.set('metadata[order_number]', order.order_number ?? '');
    form.set('metadata[amount_ar]', String(ligne.amount_ar));
    form.set('metadata[fx_rate]', String(ligne.fx_rate));
    form.set('metadata[payment_intent_row]', ligne.id);
    if (cleClient) form.set('metadata[client_idempotency_key]', cleClient);

    const reponse = await fetch(`${STRIPE_API}/payment_intents`, {
      method: 'POST',
      headers: {
        ...enTetes,
        // La clé générée EN BASE, pas celle du client : elle est attachée à la
        // ligne, donc rejouée à l'identique par toute reprise.
        'Idempotency-Key': ligne.idempotency_key,
      },
      body: form.toString(),
    });

    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => '');
      // Jamais la clé ni le corps complet dans les logs : seulement le motif.
      console.error('création PaymentIntent refusée', reponse.status, detail.slice(0, 500));
      // La tentative est marquée échouée, ce qui LIBÈRE la commande (l'index
      // unique partiel ignore les états terminaux) : le client peut réessayer.
      await admin
        .from('payment_intents')
        .update({ status: 'echoue', erreur: `stripe_${reponse.status}` })
        .eq('id', ligne.id);
      return json(502, {
        erreur: 'stripe_indisponible',
        message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
      });
    }

    intent = await reponse.json();
  }

  const pi = intent as { id: string; client_secret?: string; status: string; amount: number };

  // ⚠️ `client_secret` NE VA PAS EN BASE. `payment_intents` est lisible par le
  // client, l'admin ET le personnel du restaurant (policy `payment_intents_select`) :
  // y déposer le secret de confirmation donnerait au restaurant de quoi confirmer
  // le paiement d'un client. On archive le PaymentIntent amputé de ce seul champ.
  const { client_secret: _secret, ...intentSansSecret } = intent as Record<string, unknown>;

  await admin
    .from('payment_intents')
    .update({
      provider_intent_id: pi.id,
      status: statutDepuisStripe(pi.status),
      raw_event: intentSansSecret,
    })
    .eq('id', ligne.id);

  // ------------------------------------------------------------- 8. LA RÉPONSE
  // Quatre champs. Surtout pas la clé secrète, qui ne quitte jamais la fonction.
  // `client_secret` n'est pas un secret de compte : il n'autorise que la
  // confirmation de CE PaymentIntent, depuis l'appareil du client.
  //
  // ⚠️ LE MONTANT ET LE TAUX VIENNENT TOUS LES DEUX DE LA LIGNE, jamais l'un de
  // la ligne et l'autre de `payment_config`. Ils sont affichés côte à côte sur
  // l'écran de paiement (« 12,07 € · Taux appliqué : 1 EUR = 4 700 Ar ») : ce
  // sont les deux chiffres qui doivent se répondre, c'est tout l'intérêt de les
  // montrer. Renvoyer `fxRate` — le taux du moment — les désaccordait dès qu'un
  // admin passait `admin_set_fx_rate` pendant qu'un paiement était en cours :
  // la reprise (branche 23505, ligne déjà créée) rejoue le montant GELÉ, calculé
  // à l'ancien taux, et l'écran l'aurait annoncé sous le nouveau. Sur une
  // commande de 56 697 Ar après un passage de 4 700 à 5 200, le client aurait lu
  // « 12,07 € au taux de 1 EUR = 5 200 Ar » là où ce taux donne 10,90 € — un
  // écart de 1,17 € qu'il ne peut pas s'expliquer, et l'argument tout trouvé
  // d'une contestation bancaire. `fx_rate` est un `numeric` : PostgREST le rend
  // en chaîne, d'où le `Number`.
  return json(200, {
    client_secret: pi.client_secret ?? null,
    publishable_key: cfg.publishable_key,
    montant_eur_centimes: ligne.amount_minor,
    fx_rate: Number(ligne.fx_rate),
  });
});
