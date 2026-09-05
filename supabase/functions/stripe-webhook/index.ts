/**
 * stripe-webhook — la seule source de vérité sur « cette commande est payée ».
 *
 * Stripe appelle cette fonction quand l'état d'un paiement change. Rien d'autre
 * ne marque une commande payée : ni l'app, ni `creer-paiement`. Stripe le dit
 * explicitement — le client peut fermer l'app avant le rappel, et un client
 * malveillant peut fabriquer la réponse qu'il veut.
 *
 * ⚠️ LA VÉRIFICATION DE SIGNATURE EST TOUTE LA SÉCURITÉ DE CE FICHIER.
 * `verify_jwt` est désactivé — il le doit, l'appelant est Stripe et n'a pas de
 * jeton Supabase — donc l'URL est publiquement appelable. Sans la signature,
 * marquer n'importe quelle commande payée tient dans un `curl` d'une ligne :
 *   curl -d '{"type":"payment_intent.succeeded",...}' <url>
 * C'est la seule barrière. Elle est vérifiée AVANT toute lecture du contenu.
 *
 * ⚠️ LE CORPS EST LU EN BRUT (`req.text()`), JAMAIS REPARSÉ AVANT VÉRIFICATION.
 * La signature porte sur les octets reçus : un `JSON.parse` suivi d'un
 * `JSON.stringify` réordonne les clés et change les espaces — le HMAC ne
 * correspond plus, et on rejetterait des événements légitimes.
 *
 * ⚠️ ANTI-REJEU. L'horodatage `t=` de la signature est refusé au-delà de 5 min
 * (même tolérance que `send-otp-whatsapp`). Sans elle, un événement capturé une
 * fois — signature valide comprise — serait rejouable indéfiniment.
 *
 * IDEMPOTENCE : Stripe rejoue tout événement non-2xx, et ne garantit pas l'ordre
 * d'arrivée. Les transitions sont donc classées par RANG (voir `RANG`) et une
 * transition ne s'applique que si elle fait AVANCER l'état. Rejouer dix fois
 * `payment_intent.succeeded` ne fait rien de plus que la première fois, et un
 * `payment_failed` arrivé en retard ne peut pas dépayer une commande encaissée.
 *
 * `orders.payment_status` n'est jamais écrit ici : il est déduit de
 * `payment_intents` par le trigger `payment_intents_maj_commande`.
 *
 * Secret de signature dans le Vault (`stripe_webhook_secret`), lu par
 * `stripe_config()` réservée à `service_role`. Tant qu'il n'y est pas, la
 * fonction répond proprement « webhook non configuré » — elle ne plante jamais.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Au-delà, on refuse : un événement rejoué bien plus tard n'a rien de légitime. */
const MAX_SKEW_SECONDS = 5 * 60;

type StripeConfig = {
  secret_key: string | null;
  webhook_secret: string | null;
  publishable_key: string | null;
  devise: string | null;
  carte_active: boolean | null;
  configure: boolean;
};

/**
 * L'ordre dans lequel un paiement peut AVANCER. Une transition n'est appliquée
 * que si son rang est strictement supérieur au rang courant.
 *
 * Pourquoi un rang plutôt qu'un simple `update` : les webhooks Stripe arrivent
 * dans le désordre et sont rejoués. Un `payment_failed` d'une tentative 3-D
 * Secure abandonnée peut atterrir APRÈS le `succeeded` de la carte suivante sur
 * le même intent ; sans rang, il repasserait la commande à « échouée » alors
 * que l'argent est encaissé.
 *
 * `capture` (4) domine `echoue`/`annule` (3) : l'argent réellement pris prime
 * sur toute tentative ratée. `rembourse` (5) domine tout : c'est le seul état
 * qui vient après un encaissement.
 */
const RANG: Record<string, number> = {
  en_attente: 0,
  requiert_action: 1,
  autorise: 2,
  echoue: 3,
  annule: 3,
  capture: 4,
  rembourse: 5,
};

/** Comparaison à temps constant : un `===` fuiterait la signature octet par octet. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type VerdictSignature = { ok: true } | { ok: false; code: number; motif: string };

/**
 * Vérifie l'en-tête `Stripe-Signature`, de la forme `t=1699999999,v1=abc...,v1=def...`
 * (plusieurs `v1` pendant une rotation de secret : il suffit qu'un corresponde).
 *
 * Le HMAC-SHA256 porte sur `{t}.{corps brut}`, avec pour clé le secret ENTIER,
 * préfixe `whsec_` compris — c'est ce que fait la bibliothèque officielle.
 */
async function verifierSignature(
  entete: string | null,
  corps: string,
  secret: string,
): Promise<VerdictSignature> {
  if (!entete) return { ok: false, code: 400, motif: 'signature_absente' };

  let horodatage = '';
  const signatures: string[] = [];
  for (const morceau of entete.split(',')) {
    const [cle, valeur] = morceau.trim().split('=');
    if (cle === 't') horodatage = valeur ?? '';
    else if (cle === 'v1' && valeur) signatures.push(valeur);
  }
  if (!horodatage || signatures.length === 0) {
    return { ok: false, code: 400, motif: 'signature_malformee' };
  }

  // Anti-rejeu AVANT le calcul HMAC : inutile de travailler sur un événement
  // déjà périmé, et l'écart est la seule chose qu'une capture réseau ne peut
  // pas falsifier sans invalider la signature.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(horodatage));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) {
    return { ok: false, code: 401, motif: 'horodatage_hors_tolerance' };
  }

  const cle = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(`${horodatage}.${corps}`));
  const attendue = toHex(mac);

  if (!signatures.some((candidate) => timingSafeEqual(candidate, attendue))) {
    return { ok: false, code: 401, motif: 'signature_invalide' };
  }
  return { ok: true };
}


/**
 * Champs qu'on ne garde JAMAIS dans `payment_intents.raw_event`.
 *
 * ⚠️ POURQUOI CE NETTOYAGE EXISTE. `raw_event` est lisible par le client, par
 * l'admin ET PAR LE PERSONNEL DU RESTAURANT (policy `payment_intents_select`
 * -> `peut_voir_paiements_commande`). `creer-paiement` retire deja
 * `client_secret` avant d'archiver le PaymentIntent, pour exactement cette
 * raison. Archiver l'evenement Stripe brut le remettait — et y ajoutait les
 * coordonnees bancaires : un evenement `charge.refunded` porte
 * `billing_details` (nom, e-mail, telephone, adresse du client) et
 * `payment_method_details.card` (4 derniers chiffres, reseau, expiration).
 * Un employe de restaurant pouvait les lire pour toutes les commandes de son
 * etablissement. On archive donc l'evenement AMPUTE de ces champs : ce qui
 * reste (id, type, montants, statut, motif d'echec) suffit a l'enquete.
 *
 * Le nettoyage est RECURSIF : ces champs sont imbriques (`charges.data[]`,
 * `last_payment_error.payment_method`), jamais seulement a la racine.
 */
const CHAMPS_A_RETIRER = new Set([
  'client_secret',
  'billing_details',
  'payment_method_details',
  'card',
  'receipt_email',
  'customer_email',
  'payment_method_options',
]);

function nettoyerPourArchive(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(nettoyerPourArchive);
  if (valeur && typeof valeur === 'object') {
    const sortie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur as Record<string, unknown>)) {
      if (CHAMPS_A_RETIRER.has(cle)) continue;
      sortie[cle] = nettoyerPourArchive(v);
    }
    return sortie;
  }
  return valeur;
}

/** Toujours 200 quand l'événement est reçu et compris : sinon Stripe rejoue en boucle. */
function ok(detail: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ recu: true, ...detail }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ⚠️ Le corps brut, avant tout parsing. Voir l'en-tête de fichier.
  const corps = await req.text();

  const { data: cfgData, error: cfgError } = await admin.rpc('stripe_config');
  const cfg = cfgData as StripeConfig | null;
  if (cfgError || !cfg?.webhook_secret) {
    // Tant que `stripe_webhook_secret` n'est pas dans le Vault : refus net et
    // explicite. Surtout pas un 200, qui ferait croire à Stripe que l'événement
    // a été traité et le supprimerait de la file de reprise.
    console.error('stripe_webhook_secret absent du Vault', cfgError);
    return new Response('webhook non configure', { status: 503 });
  }

  const verdict = await verifierSignature(
    req.headers.get('Stripe-Signature'),
    corps,
    cfg.webhook_secret,
  );
  if (!verdict.ok) {
    console.error('signature Stripe refusée', verdict.motif);
    return new Response(verdict.motif, { status: verdict.code });
  }

  let evenement: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evenement = JSON.parse(corps);
  } catch {
    return new Response('corps illisible', { status: 400 });
  }

  const type = evenement.type ?? '';
  const objet = evenement.data?.object ?? {};

  // Sur quel PaymentIntent porte l'événement. Pour un `charge.*`, c'est le champ
  // `payment_intent` de la charge ou du litige ; pour un `payment_intent.*`,
  // c'est l'objet lui-même.
  const intentId = type.startsWith('payment_intent.')
    ? (objet.id as string | undefined)
    : (objet.payment_intent as string | undefined);

  let nouveauStatut: string | null = null;
  let erreur: string | null = null;

  switch (type) {
    case 'payment_intent.succeeded':
      nouveauStatut = 'capture';
      break;
    case 'payment_intent.payment_failed':
      nouveauStatut = 'echoue';
      erreur =
        ((objet.last_payment_error as Record<string, unknown> | undefined)?.message as string) ??
        'paiement refusé';
      break;
    case 'payment_intent.canceled':
      nouveauStatut = 'annule';
      break;
    case 'payment_intent.requires_action':
      nouveauStatut = 'requiert_action';
      break;
    case 'payment_intent.amount_capturable_updated':
      nouveauStatut = 'autorise';
      break;
    case 'payment_intent.processing':
      nouveauStatut = 'en_attente';
      break;
    case 'charge.refunded':
      // Un remboursement fait depuis le tableau de bord Stripe n'a aucun autre
      // chemin pour revenir en base : sans cet événement, la commande resterait
      // marquée payée alors que l'argent est rendu.
      nouveauStatut = 'rembourse';
      break;
    case 'charge.dispute.created':
      // Un litige ne change pas l'état du paiement (l'argent est toujours pris),
      // mais il coûte 20 € et il faut le voir tout de suite. On le journalise et
      // on l'archive dans `raw_event`, sans toucher au statut.
      console.error('LITIGE STRIPE ouvert', {
        intent: intentId,
        montant: objet.amount,
        motif: objet.reason,
      });
      break;
    default:
      // Un type inconnu se répond 200 : un non-2xx ferait rejouer Stripe en
      // boucle sur un événement qu'on ne traitera jamais.
      return ok({ ignore: type });
  }

  if (!intentId) return ok({ ignore: type, motif: 'aucun_payment_intent' });

  const { data: ligneData, error: lectureError } = await admin
    .from('payment_intents')
    .select('id, status, amount_minor, order_id')
    .eq('provider_intent_id', intentId)
    .maybeSingle();

  if (lectureError) {
    // Une vraie panne de lecture : on répond 500 pour que Stripe rejoue.
    console.error('lecture payment_intents impossible', lectureError);
    return new Response('erreur base', { status: 500 });
  }

  const ligne = ligneData as
    | { id: string; status: string; amount_minor: number; order_id: string }
    | null;

  if (!ligne) {
    // Paiement inconnu de nous : PaymentIntent créé hors de l'app, ou événement
    // d'un autre projet branché sur le même compte. 200 pour ne pas boucler.
    console.error('PaymentIntent inconnu en base', intentId, type);
    return ok({ ignore: type, motif: 'intent_inconnu' });
  }

  // Contrôle comptable : si Stripe a encaissé un montant différent de celui
  // qu'on a calculé, ce n'est pas une raison de refuser l'encaissement — mais
  // ça doit se voir dans les logs le jour du rapprochement.
  const encaisse = (objet.amount_received ?? objet.amount) as number | undefined;
  if (nouveauStatut === 'capture' && typeof encaisse === 'number' && encaisse !== ligne.amount_minor) {
    console.error('ÉCART DE MONTANT', {
      intent: intentId,
      attendu: ligne.amount_minor,
      recu: encaisse,
    });
  }

  // ⚠️ Jamais l'evenement brut : voir `nettoyerPourArchive`. Le secret de
  // confirmation et les coordonnees bancaires ne descendent pas en base.
  const archive = {
    ...(nettoyerPourArchive(evenement) as Record<string, unknown>),
    _recu_le: new Date().toISOString(),
  };

  if (nouveauStatut === null) {
    // Litige : on archive l'événement sans toucher au statut.
    await admin.from('payment_intents').update({ raw_event: archive }).eq('id', ligne.id);
    return ok({ traite: type, statut: ligne.status });
  }

  // ⚠️ L'IDEMPOTENCE EST ICI. Un rejeu, ou un événement arrivé dans le désordre,
  // ne fait pas reculer l'état — et ne redéclenche donc pas le trigger qui
  // recalcule `orders.payment_status`.
  if ((RANG[nouveauStatut] ?? 0) <= (RANG[ligne.status] ?? 0)) {
    await admin.from('payment_intents').update({ raw_event: archive }).eq('id', ligne.id);
    return ok({ traite: type, statut: ligne.status, applique: false });
  }

  const maj: Record<string, unknown> = { status: nouveauStatut, raw_event: archive };
  if (erreur) maj.erreur = erreur;
  if (nouveauStatut === 'capture') maj.captured_at = new Date().toISOString();

  const { error: majError } = await admin
    .from('payment_intents')
    .update(maj)
    .eq('id', ligne.id);

  if (majError) {
    console.error('mise à jour payment_intents impossible', majError);
    return new Response('erreur base', { status: 500 });
  }

  return ok({ traite: type, statut: nouveauStatut, applique: true });
});
