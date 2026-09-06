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
 * ⚠️ AUCUN CHEMIN DE SORTIE MUET. Le 2026-09-06, un paiement a échoué sans
 * laisser la moindre trace : ni motif en base, ni message juste à l'écran. La
 * clé du Vault était la version MASQUÉE du tableau de bord Stripe (`rk_live_`
 * suivi de 99 caractères « • »), et `fetch` refuse un en-tête qui n'est pas de
 * l'ASCII imprimable. L'exception remontait au runtime Edge, qui répond
 * « Internal Server Error » en texte brut et SANS les en-têtes CORS — donc, sur
 * le web, un « Connexion perdue » reproché au réseau du client. Pendant ce
 * temps la ligne `payment_intents` restait `en_attente`, `erreur` à NULL : elle
 * verrouillait la commande via l'index unique partiel, le restaurant n'était
 * jamais prévenu (garde « cb non payée »), et le livreur ne pouvait pas la
 * clore. Trois règles en découlent, à ne jamais retirer :
 *   1. la clé est VALIDÉE avant de servir d'en-tête (`CLE_STRIPE_VALIDE`) ;
 *   2. tout le corps du handler est sous `try/catch` : une exception marque la
 *      ligne `echoue` avec son motif — état terminal, donc la commande est
 *      LIBÉRÉE pour une vraie nouvelle tentative — et répond du JSON via
 *      `json()`, en-têtes CORS compris ;
 *   3. chaque écriture en base est relue (`error`), y compris la dernière : une
 *      ligne sans son `pi_...` est introuvable par le webhook.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

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

/**
 * ⚠️ LA GARDE QUI MANQUAIT LE 2026-09-06.
 *
 * Une clé Stripe est un identifiant ASCII : un préfixe, puis des lettres et des
 * chiffres. Rien d'autre. Ce qui était dans le Vault ce jour-là — la version
 * masquée affichée par le tableau de bord Stripe, `rk_live_` suivi de puces
 * « • » — passe tous les contrôles d'existence (elle n'est ni nulle ni vide) et
 * casse au seul endroit où personne ne regardait : `new Headers()`, qui n'admet
 * que des octets ASCII imprimables et lève un `TypeError`.
 *
 * On refuse donc AVANT de construire la requête, et on le dit : « paiement mal
 * configuré » est une réponse, un `TypeError` non attrapé n'en est pas une.
 */
const CLE_STRIPE_VALIDE = /^(sk|rk)_(live|test)_[A-Za-z0-9]+$/;

/** Au-delà, on tronque : `payment_intents.erreur` sert à comprendre, pas à archiver. */
const MAX_ERREUR = 300;

/**
 * Champs qu'on ne garde JAMAIS dans `payment_intents.raw_event`.
 *
 * ⚠️ POURQUOI CETTE LISTE EST ICI ALORS QU'ELLE EXISTE DÉJÀ DANS
 * `stripe-webhook`. Les deux fonctions écrivent la MÊME colonne, lue par les
 * MÊMES gens : la policy `payment_intents_select` -> `peut_voir_paiements_commande`
 * l'ouvre au client, à l'admin ET au personnel du restaurant. Le webhook
 * nettoyait, celle-ci se contentait de retirer `client_secret` — donc la
 * protection tombait dès que l'archive passait par ce fichier-ci.
 *
 * Le cas n'est pas théorique : sur le chemin `relecture_stripe` (le client
 * rouvre l'écran de paiement après un refus de sa banque), le PaymentIntent
 * relu porte `last_payment_error.payment_method`, c'est-à-dire les
 * `billing_details` du client (nom, e-mail, téléphone, adresse complète) et sa
 * `card` (4 derniers chiffres, réseau, expiration, pays). Un employé de
 * restaurant pouvait les lire pour toutes les commandes de son établissement.
 *
 * Ce qui reste — id, statut, montants, devise, `last_payment_error.code` et son
 * message — suffit à l'enquête, qui est le seul usage de `raw_event`.
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

/**
 * Récursif, parce que ces champs sont IMBRIQUÉS : `last_payment_error.payment_method`,
 * `charges.data[]`. Les retirer seulement à la racine ne retirait rien du tout.
 */
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

/**
 * `TypeError: headers is not a valid ByteString` → `{ type: 'TypeError', message: '…' }`.
 * Le TYPE compte autant que le message : c'est lui qui distingue une panne
 * réseau (`TypeError` de `fetch`) d'une réponse illisible (`SyntaxError`).
 */
function decrire(e: unknown): { type: string; message: string } {
  if (e instanceof Error) {
    return { type: e.name || 'Error', message: (e.message || '').slice(0, MAX_ERREUR) };
  }
  return { type: typeof e, message: String(e).slice(0, MAX_ERREUR) };
}

/**
 * Échec identifié, avec sa réponse client déjà rédigée.
 *
 * Pourquoi une exception plutôt qu'un `return` : ces échecs surviennent APRÈS
 * l'insertion de la ligne `payment_intents`. Les remonter au `catch` unique
 * garantit qu'aucun ne peut oublier de marquer la ligne — c'est exactement
 * l'oubli qui a produit la panne muette.
 */
class EchecPaiement extends Error {
  constructor(
    /** Code court et STABLE, écrit tel quel dans `payment_intents.erreur`. */
    public code: string,
    public statutHttp: number,
    public corps: Record<string, unknown>,
    /** Ce qu'on veut retrouver dans `raw_event` le jour de l'enquête. */
    public diagnostic: Record<string, unknown> = {},
    /**
     * Faux quand un PaymentIntent VIVANT existe déjà chez Stripe pour cette
     * ligne. Marquer `echoue` la sortirait de l'index unique partiel : la
     * tentative suivante créerait une SECONDE ligne, avec une nouvelle clé
     * d'idempotence, donc un second PaymentIntent chez Stripe. En la laissant
     * `en_attente`, la reprise repasse par la branche `23505`, rejoue la même
     * clé, et Stripe rend le même PaymentIntent.
     */
    public marquerLaLigne = true,
  ) {
    super(code);
    this.name = 'EchecPaiement';
  }
}

/**
 * Marque une tentative comme échouée, avec son motif.
 *
 * ⚠️ `echoue` ET PAS `en_attente`. C'est un état terminal : l'index unique
 * partiel `payment_intents_un_actif_par_commande` l'ignore, donc la commande
 * est libérée et la tentative suivante en est une vraie, au lieu de ressusciter
 * le cadavre à chaque appui sur « Réessayer ».
 *
 * Ne lève jamais : on est déjà en train de traiter un échec, une seconde
 * exception ici ferait perdre la première.
 */
async function marquerEchec(
  admin: SupabaseClient | null,
  ligneId: string | null,
  code: string,
  detail: string,
  diagnostic: Record<string, unknown>,
): Promise<void> {
  await ecrireMotif(admin, ligneId, code, detail, diagnostic, true);
}

/** Le motif, sans toucher au statut : voir `EchecPaiement.marquerLaLigne`. */
async function noterMotif(
  admin: SupabaseClient | null,
  ligneId: string | null,
  code: string,
  detail: string,
  diagnostic: Record<string, unknown>,
): Promise<void> {
  await ecrireMotif(admin, ligneId, code, detail, diagnostic, false);
}

async function ecrireMotif(
  admin: SupabaseClient | null,
  ligneId: string | null,
  code: string,
  detail: string,
  diagnostic: Record<string, unknown>,
  terminer: boolean,
): Promise<void> {
  if (!admin || !ligneId) return;
  try {
    const { error } = await admin
      .from('payment_intents')
      .update({
        ...(terminer ? { status: 'echoue' } : {}),
        erreur: `${code}${detail ? ` | ${detail}` : ''}`.slice(0, MAX_ERREUR),
        // ⚠️ On garde l'enveloppe de diagnostic MÊME sur échec. `raw_event` ne
        // servait qu'aux succès ; c'est sur les échecs qu'on en a besoin. Le
        // `Request-Id` de Stripe est le seul identifiant qui permette à leur
        // support de retrouver l'appel.
        raw_event: { _diagnostic: { code, detail, ...diagnostic, marque_le: new Date().toISOString() } },
      })
      .eq('id', ligneId);
    if (error) console.error('creer-paiement: marquage du motif impossible', ligneId, error);
  } catch (e) {
    console.error('creer-paiement: marquage du motif impossible', ligneId, decrire(e));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  // Déclarés HORS du `try` : le `catch` doit pouvoir marquer la ligne et dire
  // où on en était. Sans ça, il ne saurait rien de l'échec qu'il rattrape.
  let admin: SupabaseClient | null = null;
  let ligneId: string | null = null;
  let orderId = '';
  let etape = 'demarrage';

  try {
    admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ---------------------------------------------------------------- 1. QUI APPELLE
    // `verify_jwt` a déjà écarté les requêtes sans jeton, mais il accepte la clé
    // `anon` (qui est un JWT de rôle `anon`, pas un utilisateur). On exige un
    // utilisateur réel : sans lui, il n'y a personne à qui rattacher un paiement.
    etape = 'authentification';
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
    etape = 'lecture_entree';
    let corps: { order_id?: unknown; idempotency_key?: unknown };
    try {
      corps = await req.json();
    } catch {
      return json(400, { erreur: 'corps_invalide' });
    }

    orderId = typeof corps.order_id === 'string' ? corps.order_id.trim() : '';
    const cleClient = typeof corps.idempotency_key === 'string' ? corps.idempotency_key.trim() : '';
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return json(400, { erreur: 'order_id_invalide' });
    }

    // ------------------------------------------------------------- 3. LA COMMANDE
    // `service_role` contourne la RLS : c'est le filtre `user_id` ci-dessous qui
    // fait l'autorisation, explicitement, plutôt qu'un effet de bord de policy.
    etape = 'lecture_commande';
    const { data: commande, error: orderError } = await admin
      .from('orders')
      .select('id, order_number, user_id, total, payment_method, payment_status, status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      console.error('creer-paiement: lecture commande impossible', orderId, orderError);
      return json(500, { erreur: 'lecture_commande', code: 'lecture_commande' });
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
    etape = 'lecture_config_stripe';
    const { data: cfgData, error: cfgError } = await admin.rpc('stripe_config');
    const cfg = cfgData as StripeConfig | null;

    if (cfgError || !cfg?.configure || !cfg.secret_key) {
      // Cas normal tant que le porteur du projet n'a pas déposé `stripe_secret_key`
      // dans le Vault. On le dit, on ne plante pas : l'app doit pouvoir proposer
      // les espèces sans voir une erreur technique.
      console.error('creer-paiement: stripe_config indisponible ou incomplète', cfgError);
      return json(503, {
        erreur: 'paiement_non_configure',
        sous_motif: 'secret_absent',
        message: 'Le paiement par carte n\'est pas encore disponible.',
      });
    }

    // ⚠️ LA CLÉ EST VALIDÉE AVANT DE DEVENIR UN EN-TÊTE. Voir `CLE_STRIPE_VALIDE`.
    // On journalise ce qui permet de diagnostiquer — la longueur et la position
    // du premier caractère fautif — et JAMAIS la clé, même tronquée : ses huit
    // premiers caractères suffisent à identifier le compte.
    if (!CLE_STRIPE_VALIDE.test(cfg.secret_key)) {
      const position = cfg.secret_key.split('').findIndex((c) => c < '\x21' || c > '\x7e');
      console.error('creer-paiement: CLÉ STRIPE ILLISIBLE dans le Vault', {
        longueur: cfg.secret_key.length,
        premier_caractere_non_ascii: position, // -1 = tous ASCII, le format seul est mauvais
        indice: 'clé masquée copiée du tableau de bord ? attendu sk_live_… ou rk_live_…',
      });
      return json(503, {
        erreur: 'paiement_non_configure',
        sous_motif: 'cle_stripe_illisible',
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
    etape = 'conversion_montant';
    const { data: montant, error: montantError } = await admin.rpc('montant_eur_centimes', {
      p_total_ar: order.total,
    });
    if (montantError || typeof montant !== 'number') {
      // `montant_eur_centimes` lève une exception explicite (montant trop faible,
      // total nul) : son message est écrit pour être montré tel quel.
      console.error('creer-paiement: conversion impossible', orderId, montantError);
      return json(422, {
        erreur: 'montant_invalide',
        message: montantError?.message ?? 'Montant impossible à convertir.',
      });
    }

    // ⚠️ L'ERREUR DE CETTE LECTURE SE LIT. Elle ne se lisait pas : quand elle
    // échouait, `fxRate` valait 0, l'insert violait `check (fx_rate > 0)`, le
    // code d'erreur n'était pas `23505` — donc pas de reprise — et la réponse
    // était un `creation_paiement` générique, sans ligne ni motif nulle part.
    etape = 'lecture_payment_config';
    const { data: config, error: configError } = await admin
      .from('payment_config')
      .select('fx_ar_per_eur, devise_paiement')
      .eq('id', 1)
      .single();
    const fxRate = Number(config?.fx_ar_per_eur ?? 0);
    if (configError || !Number.isFinite(fxRate) || fxRate <= 0) {
      console.error('creer-paiement: payment_config illisible', orderId, configError, { fxRate });
      return json(503, {
        erreur: 'paiement_non_configure',
        sous_motif: 'taux_illisible',
        message: 'Le paiement par carte n\'est pas encore disponible.',
      });
    }
    const devise = (config?.devise_paiement ?? cfg.devise ?? 'eur').toLowerCase();

    // ------------------------------------------------ 6. LA LIGNE AVANT STRIPE
    // On écrit D'ABORD, on appelle Stripe ENSUITE : c'est l'index unique partiel
    // qui arbitre entre deux appels concurrents, pas ce code.
    etape = 'creation_ligne';
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
        const { data: existante, error: repriseError } = await admin
          .from('payment_intents')
          .select('id, provider_intent_id, status, amount_minor, currency, amount_ar, fx_rate, idempotency_key')
          .eq('order_id', order.id)
          .in('status', ['en_attente', 'requiert_action', 'autorise'])
          .maybeSingle();
        // ⚠️ Cette erreur-là se lit aussi. Elle ne se lisait pas, et le seul
        // symptôme d'une reprise ratée était un `insert_23505` — c'est-à-dire
        // le code de l'insertion, qui accusait l'index alors que la panne était
        // dans la relecture. Un `23505` sans ligne reprise ne devrait jamais
        // arriver (l'index et ce filtre portent sur les mêmes trois statuts) :
        // le jour où ça arrive, on veut savoir laquelle des deux a menti.
        if (repriseError) {
          console.error('creer-paiement: reprise de la ligne existante impossible', orderId, repriseError);
        }
        ligne = existante as IntentRow | null;
      }
      if (!ligne) {
        console.error('creer-paiement: insertion payment_intents impossible', orderId, insertError);
        return json(500, {
          erreur: 'creation_paiement',
          code: `insert_${insertError.code ?? 'inconnu'}`,
        });
      }
    } else {
      ligne = inseree as IntentRow;
    }

    // À partir d'ici une ligne existe : tout échec doit s'y inscrire. C'est le
    // rôle du `catch` unique, qui lit cette variable.
    ligneId = ligne.id;

    // ------------------------------------------------------------- 7. STRIPE
    const enTetes = {
      Authorization: `Bearer ${cfg.secret_key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    let intent: Record<string, unknown> | null = null;

    // Si la ligne reprise porte déjà un `pi_...`, on relit le PaymentIntent plutôt
    // que d'en recréer un : c'est le cas du client qui rouvre l'écran de paiement.
    if (ligne.provider_intent_id) {
      etape = 'relecture_stripe';
      // ⚠️ Une relecture ratée n'est PAS un échec de paiement : on retombe sur la
      // création, que la clé d'idempotence rendra équivalente à une reprise.
      // C'est la seule raison pour laquelle ce bloc ne lève rien — partout
      // ailleurs, un appel Stripe qui échoue devient un `EchecPaiement`.
      try {
        const relecture = await fetch(`${STRIPE_API}/payment_intents/${ligne.provider_intent_id}`, {
          headers: { Authorization: enTetes.Authorization },
        });
        if (relecture.ok) intent = await relecture.json();
        else {
          console.error(
            'creer-paiement: relecture PaymentIntent échouée',
            relecture.status,
            (await relecture.text().catch(() => '')).slice(0, 300),
          );
        }
      } catch (e) {
        console.error('creer-paiement: relecture PaymentIntent injoignable', ligne.provider_intent_id, decrire(e));
      }
    }

    if (!intent) {
      etape = 'creation_stripe';
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
      // `stripe-webhook` s'en sert désormais tout seul, sans intervention.
      form.set('metadata[order_id]', order.id);
      form.set('metadata[order_number]', order.order_number ?? '');
      form.set('metadata[amount_ar]', String(ligne.amount_ar));
      form.set('metadata[fx_rate]', String(ligne.fx_rate));
      form.set('metadata[payment_intent_row]', ligne.id);
      if (cleClient) form.set('metadata[client_idempotency_key]', cleClient);

      let reponse: Response;
      try {
        reponse = await fetch(`${STRIPE_API}/payment_intents`, {
          method: 'POST',
          headers: {
            ...enTetes,
            // La clé générée EN BASE, pas celle du client : elle est attachée à la
            // ligne, donc rejouée à l'identique par toute reprise.
            'Idempotency-Key': ligne.idempotency_key,
          },
          body: form.toString(),
        });
      } catch (e) {
        // Stripe injoignable, DNS, TLS, ou requête que `fetch` refuse d'émettre.
        // Distinguer ce cas d'un refus de Stripe change la conduite à tenir :
        // ici, rien n'est parti, donc rien n'a pu être débité.
        const d = decrire(e);
        throw new EchecPaiement(
          'stripe_injoignable',
          502,
          {
            erreur: 'stripe_indisponible',
            message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
          },
          { type: d.type, message: d.message },
        );
      }

      // Le `Request-Id` est le SEUL identifiant qui permette au support Stripe de
      // retrouver l'appel : on le garde des deux côtés, succès comme échec.
      const requestId = reponse.headers.get('Request-Id');

      if (!reponse.ok) {
        const detail = await reponse.text().catch(() => '');
        // Jamais la clé ni le corps complet dans les logs : seulement le motif.
        console.error('creer-paiement: création PaymentIntent refusée', {
          order: orderId,
          statut: reponse.status,
          request_id: requestId,
          detail: detail.slice(0, 500),
        });
        // La tentative est marquée échouée par le `catch`, ce qui LIBÈRE la
        // commande (l'index unique partiel ignore les états terminaux) : le
        // client peut réessayer.
        throw new EchecPaiement(
          `stripe_${reponse.status}`,
          502,
          {
            erreur: 'stripe_indisponible',
            message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
          },
          { http_status: reponse.status, request_id: requestId, detail: detail.slice(0, 500) },
        );
      }

      try {
        intent = await reponse.json();
      } catch (e) {
        // 200 avec un corps illisible : une page d'erreur de proxy, une réponse
        // tronquée. Le PaymentIntent peut exister chez Stripe — d'où le
        // `request_id` archivé, qui permet de le retrouver.
        const d = decrire(e);
        throw new EchecPaiement(
          'reponse_illisible',
          502,
          {
            erreur: 'stripe_indisponible',
            message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
          },
          { request_id: requestId, type: d.type, message: d.message },
        );
      }
    }

    const pi = intent as { id?: string; client_secret?: string; status?: string };

    if (!pi?.id || typeof pi.id !== 'string') {
      // Stripe a répondu 200 sans identifiant : on ne saurait plus jamais relier
      // ce paiement à cette commande. Mieux vaut échouer bruyamment.
      throw new EchecPaiement(
        'reponse_sans_id',
        502,
        {
          erreur: 'stripe_indisponible',
          message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
        },
        {},
      );
    }

    // ⚠️ NI LE SECRET, NI LES COORDONNÉES BANCAIRES NE VONT EN BASE.
    // `payment_intents` est lisible par le client, l'admin ET le personnel du
    // restaurant (policy `payment_intents_select`) : y déposer le secret de
    // confirmation donnerait au restaurant de quoi confirmer le paiement d'un
    // client, et y déposer le PaymentIntent brut lui donnerait en plus le nom,
    // l'e-mail, le téléphone, l'adresse et la carte de ce client — c'est ce que
    // porte `last_payment_error.payment_method` sur le chemin de relecture.
    // `nettoyerPourArchive` retire les deux, récursivement. Même liste et même
    // raison que dans `stripe-webhook`, qui écrit la même colonne.
    const intentSansSecret = nettoyerPourArchive(intent) as Record<string, unknown>;

    // ⚠️ CETTE ÉCRITURE N'A PAS LE DROIT D'ÉCHOUER EN SILENCE. Sans son `pi_...`,
    // la ligne est invisible pour le webhook, qui cherche par `provider_intent_id` :
    // le client paierait pour de bon et la commande resterait « non payée ».
    // On réessaie une fois, puis on refuse de rendre le `client_secret` — le
    // PaymentIntent reste inerte tant que personne ne le confirme, et la
    // tentative suivante rejoue la même clé d'idempotence, donc le même
    // PaymentIntent, et retentera cette écriture.
    etape = 'archivage_intent';
    const majIntent = {
      provider_intent_id: pi.id,
      status: statutDepuisStripe(pi.status ?? ''),
      raw_event: intentSansSecret,
    };
    let { error: majError } = await admin.from('payment_intents').update(majIntent).eq('id', ligne.id);
    if (majError) {
      console.error('creer-paiement: 1re écriture du pi_ échouée, on réessaie', ligne.id, majError);
      ({ error: majError } = await admin.from('payment_intents').update(majIntent).eq('id', ligne.id));
    }
    if (majError) {
      console.error('creer-paiement: PAYMENT INTENT ORPHELIN', {
        order: orderId,
        ligne: ligne.id,
        intent: pi.id,
        erreur: majError,
      });
      throw new EchecPaiement(
        'archivage_impossible',
        503,
        {
          erreur: 'erreur_serveur',
          message: 'Le paiement n\'a pas pu être préparé. Réessaie dans un instant.',
        },
        { intent: pi.id, message: majError.message },
        false,
      );
    }

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
  } catch (e) {
    // ------------------------------------------------------- LE FILET DE SÉCURITÉ
    // Rien ne sort d'ici sans laisser de trace : ni dans les journaux, ni en base,
    // ni pour le client. C'est tout l'objet du chantier du 2026-09-06.
    if (e instanceof EchecPaiement) {
      if (e.marquerLaLigne) {
        await marquerEchec(admin, ligneId, e.code, String(e.diagnostic.message ?? ''), e.diagnostic);
      } else {
        // La ligne reste vivante (voir `marquerLaLigne`) mais elle doit dire
        // pourquoi : on écrit le motif SANS toucher au statut.
        await noterMotif(admin, ligneId, e.code, String(e.diagnostic.message ?? ''), e.diagnostic);
      }
      // `reference` = l'id de la ligne. Affichée à l'écran, elle permet au client
      // de la citer et au porteur du projet de retrouver la tentative sans
      // aucun journal : `select * from payment_intents where id = '…'`.
      return json(e.statutHttp, { ...e.corps, code: e.code, reference: ligneId });
    }

    const d = decrire(e);
    const code = `exception:${d.type}`;
    console.error('creer-paiement: EXCEPTION NON PRÉVUE', {
      etape,
      order: orderId,
      ligne: ligneId,
      type: d.type,
      message: d.message,
      stack: e instanceof Error ? (e.stack ?? '').slice(0, 800) : undefined,
    });
    await marquerEchec(admin, ligneId, code, d.message, { etape, type: d.type });
    // ⚠️ VIA `json()`, DONC AVEC LES EN-TÊTES CORS. C'est ce détail qui faisait
    // afficher « Connexion perdue » au client sur le web : sans CORS, le
    // navigateur bloque la réponse et supabase-js ne rend qu'une erreur réseau.
    return json(500, {
      erreur: 'erreur_serveur',
      code,
      etape,
      reference: ligneId,
      message: 'Le paiement par carte est indisponible en ce moment. Rien n\'a été débité.',
    });
  }
});
