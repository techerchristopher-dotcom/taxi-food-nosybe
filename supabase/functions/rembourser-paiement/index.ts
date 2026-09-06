/**
 * rembourser-paiement — rend au client l'argent d'une commande carte annulée.
 *
 * LE CAS QUI A DÉCLENCHÉ CE FICHIER, le 6 septembre 2026 :
 *   08:09:23  TF-96 créée, 16 000 Ar, mode carte
 *   08:10:09  capture chez Stripe : 3,41 € débités
 *   08:12:06  le restaurant refuse depuis Telegram
 * Le client avait payé, ne serait pas livré, et l'argent n'est jamais revenu.
 * Le socle en base (`20260906084514`) enregistre depuis lors la demande de
 * remboursement toute seule ; c'est cette fonction qui la fait partir.
 *
 * Appelée par la BASE, via `declencher_remboursement()` → pg_net, et
 * accessoirement à la main par un administrateur. Jamais par l'app.
 *
 * ⚠️ ELLE N'ACCEPTE AUCUN MONTANT — c'est le point le plus important du fichier,
 * et c'est le même invariant que `creer-paiement`. L'entrée utile est un
 * identifiant de demande ; le montant, la devise et le PaymentIntent sont RELUS
 * en base, dans la ligne `payment_refunds` que seule la base a écrite. Le corps
 * de la requête peut porter `amount_minor` et `currency` (le trigger les envoie),
 * mais ils ne servent qu'à VÉRIFIER : s'ils ne correspondent pas à la ligne, on
 * refuse au lieu de suivre l'appelant. Un remboursement fait sortir de l'argent :
 * il n'y a aucune raison qu'un chiffre venu du réseau puisse décider combien.
 *
 * ⚠️ LE MONTANT EST CELUI DES EUROS RÉELLEMENT DÉBITÉS, jamais une reconversion
 * de l'ariary au taux du jour. `payment_intents.fx_rate` est copié à la création
 * de la tentative précisément pour refaire le calcul d'hier à l'identique. Sur
 * TF-96 : 16 000 Ar au taux figé de 4 700 valent 341 centimes ; reconvertis au
 * marché (~5 008) ils en vaudraient 320 — 21 centimes de moins que ce que la
 * banque du client a prélevé, c'est-à-dire le motif de contestation bancaire
 * parfait, et une contestation coûte 20 € (66 fois le montant en jeu).
 *
 * ⚠️ UN PAIEMENT NON CAPTURÉ NE SE REMBOURSE PAS, IL S'ANNULE. La fonction relit
 * l'état RÉEL chez Stripe avant d'agir : `succeeded` → `POST /v1/refunds` ;
 * `requires_*` / `processing` → `POST /v1/payment_intents/{id}/cancel`, qui est
 * gratuit ; `canceled` → rien à faire du tout. Se tromper de sens ne débite
 * personne (les deux appels échouent proprement), mais ne rien appeler laisse
 * l'autorisation vivre sur la carte du client jusqu'à son expiration.
 *
 * ⚠️ LA CLÉ D'IDEMPOTENCE ENVOYÉE À STRIPE EST CELLE DE `payment_refunds`,
 * JAMAIS CELLE DE `payment_intents` : rejouer la clé du paiement ferait renvoyer
 * à Stripe la réponse mémorisée du PaymentIntent au lieu de créer un
 * remboursement. Et comme Stripe purge ses clés au bout de 24 h, elle ne protège
 * pas d'un rejeu à J+2 : la barrière qui tient dans le temps est en base
 * (`enregistrer_envoi_remboursement` refuse d'attacher un second `re_...`).
 *
 * QUI A LE DROIT D'APPELER — deux portes, jamais une troisième :
 *   1. la base, par le secret partagé `x-hook-secret` (Vault) ;
 *   2. un administrateur authentifié (`user_roles.role = 'admin'`, `active`).
 * Ni un client, ni un restaurateur, ni un livreur. `verify_jwt = false` parce que
 * l'appelant nº 1 n'a pas de jeton utilisateur ; c'est donc la fonction qui
 * vérifie, elle-même, à chaque appel.
 *
 * ⚠️ AUCUN CHEMIN DE SORTIE MUET. Leçon du 6 septembre : une clé Stripe illisible
 * (la version masquée du tableau de bord, `rk_live_` suivi de puces « • ») avait
 * fait échouer `creer-paiement` en « Internal Server Error » texte brut, sans
 * CORS et sans rien écrire en base. Trois règles reprises telles quelles ici :
 * la clé est validée AVANT de servir d'en-tête, tout le corps est sous un
 * `try/catch` unique, et chaque sortie passe par `json()` — code stable, cause
 * écrite en base quand une ligne existe.
 *
 * ⚠️ UN ENVOI RATÉ NE MARQUE JAMAIS LA DEMANDE `echoue`. `echoue` veut dire « la
 * banque a refusé le crédit, le client n'a rien » ; « notre appel n'est pas
 * parti » est autre chose. La ligne reste en `demande`, avec son motif, et
 * `relancer_remboursements_en_attente()` la rejouera. La marquer terminale la
 * sortirait de l'index unique partiel `payment_refunds_une_demande_en_vol` :
 * la relance créerait alors une SECONDE demande, donc un second remboursement.
 *
 * Le verdict définitif, lui, vient du webhook Stripe (`refund.updated` /
 * `refund.failed`) : la réponse de Stripe à `POST /v1/refunds` vaut « demande
 * acceptée », jamais « argent arrivé ». Le client voit le crédit sous 5 à 10
 * jours ouvrés — ou voit le débit disparaître de son relevé, si Stripe traite la
 * demande en *reversal*.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

const STRIPE_API = 'https://api.stripe.com/v1';

/** L'espace admin est une app web : sans ces en-têtes, l'appel ne part même pas. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-hook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Voir l'en-tête : une clé Stripe est de l'ASCII, un préfixe et des alphanumériques. */
const CLE_STRIPE_VALIDE = /^(sk|rk)_(live|test)_[A-Za-z0-9]+$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `payment_refunds.erreur` sert à comprendre, pas à archiver. */
const MAX_ERREUR = 300;

/**
 * États Stripe d'un PaymentIntent sur lesquels il n'y a rien à rembourser parce
 * que rien n'a encore été pris — mais où il reste une autorisation à relâcher.
 */
const ANNULABLES = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'requires_capture',
  'processing',
]);

type StripeConfig = {
  secret_key: string | null;
  configure: boolean;
};

type Refund = {
  id: string;
  payment_intent_id: string;
  order_id: string;
  status: string;
  provider_refund_id: string | null;
  amount_minor: number;
  currency: string;
  idempotency_key: string;
  motif: string;
};

type Intent = {
  id: string;
  provider_intent_id: string | null;
  status: string;
  amount_minor: number;
  currency: string;
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Comparaison à temps constant.
 *
 * Comparer deux secrets avec `!==` s'arrête au premier octet différent : le
 * temps de réponse renseigne alors, octet par octet, sur la valeur attendue.
 * Le coût de s'en protéger est de trois lignes ; celui de ne pas le faire est
 * un secret devinable par quelqu'un qui peut répéter la requête.
 */
function egalConstant(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decrire(e: unknown): { type: string; message: string } {
  if (e instanceof Error) {
    return { type: e.name || 'Error', message: (e.message || '').slice(0, MAX_ERREUR) };
  }
  return { type: typeof e, message: String(e).slice(0, MAX_ERREUR) };
}

/**
 * Écrit le motif sur la demande SANS toucher à son statut : elle reste en vol.
 * Ne lève jamais — on est déjà en train de traiter un échec, une seconde
 * exception ici ferait perdre la première.
 */
async function noterEchec(
  admin: SupabaseClient | null,
  refundId: string | null,
  code: string,
  detail: string,
  diagnostic: Record<string, unknown>,
): Promise<void> {
  if (!admin || !refundId) return;
  try {
    const { error } = await admin.rpc('echec_envoi_remboursement', {
      p_refund_id: refundId,
      p_erreur: `${code}${detail ? ` | ${detail}` : ''}`.slice(0, MAX_ERREUR),
      p_raw_event: { _diagnostic: { code, detail, ...diagnostic, marque_le: new Date().toISOString() } },
    });
    if (error) console.error('rembourser-paiement: motif non écrit', refundId, error);
  } catch (e) {
    console.error('rembourser-paiement: motif non écrit', refundId, decrire(e));
  }
}

/**
 * Échec identifié, avec sa réponse déjà rédigée.
 * Comme dans `creer-paiement` : une exception plutôt qu'un `return`, pour qu'un
 * point unique — le `catch` du handler — garantisse que le motif est écrit.
 */
class EchecRemboursement extends Error {
  constructor(
    /** Code court et STABLE, écrit tel quel dans `payment_refunds.erreur`. */
    public code: string,
    public statutHttp: number,
    public corps: Record<string, unknown>,
    public diagnostic: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'EchecRemboursement';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  // Hors du `try` : le `catch` doit pouvoir écrire le motif et dire où on en était.
  let admin: SupabaseClient | null = null;
  let refundId: string | null = null;
  let etape = 'demarrage';

  try {
    admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ------------------------------------------------------------ 1. QUI APPELLE
    // Deux portes, et le refus est le même dans les deux cas : un appelant qui
    // n'a pas le droit ne doit pas apprendre laquelle il a manquée.
    etape = 'autorisation';
    let appelant: string;
    const hook = req.headers.get('x-hook-secret');

    if (hook) {
      const { data: attendu, error: secretError } = await admin.rpc('remboursement_hook_secret');
      if (secretError || !attendu) {
        // Le Vault est vide : la base ne pourrait de toute façon rien émettre.
        console.error('rembourser-paiement: remboursement_hook_secret introuvable', secretError);
        return json(500, {
          erreur: 'remboursement_non_configure',
          code: 'secret_absent',
          message: 'Le remboursement automatique n\'est pas configuré.',
        });
      }
      if (!egalConstant(hook, String(attendu))) return json(403, { erreur: 'autorisation_refusee', code: 'secret_invalide' });
      appelant = 'base';
    } else {
      // ⚠️ `verify_jwt = false` : personne n'a filtré le jeton avant nous, et la
      // clé `anon` du projet EST un JWT valide. On exige donc un vrai
      // utilisateur, puis on lit son rôle. Un client ou un restaurateur
      // authentifié s'arrête ici.
      const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (!jwt) return json(403, { erreur: 'autorisation_refusee', code: 'sans_autorisation' });

      const { data: auth, error: authError } = await admin.auth.getUser(jwt);
      const user = auth?.user;
      if (authError || !user) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_invalide' });

      // Lecture explicite plutôt que `rpc('is_admin')` : `is_admin()` s'appuie sur
      // `auth.uid()`, qui est NULL sous la clé service_role — elle répondrait
      // toujours faux, et le jour où on l'appellerait autrement, toujours vrai.
      const { data: role, error: roleError } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .eq('status', 'active')
        .maybeSingle();
      if (roleError) {
        console.error('rembourser-paiement: lecture user_roles impossible', roleError);
        return json(500, { erreur: 'erreur_serveur', code: 'lecture_role' });
      }
      if (!role) return json(403, { erreur: 'autorisation_refusee', code: 'reserve_aux_admins' });
      appelant = `admin:${user.id}`;
    }

    // -------------------------------------------------------------- 2. L'ENTRÉE
    etape = 'lecture_entree';
    let corps: Record<string, unknown>;
    try {
      corps = (await req.json()) as Record<string, unknown>;
    } catch {
      return json(400, { erreur: 'corps_invalide', code: 'corps_invalide' });
    }

    const demande = typeof corps.refund_id === 'string' ? corps.refund_id.trim() : '';
    const commande = typeof corps.order_id === 'string' ? corps.order_id.trim() : '';
    if (!UUID.test(demande) && !UUID.test(commande)) {
      return json(400, {
        erreur: 'identifiant_manquant',
        code: 'identifiant_manquant',
        message: 'Fournis refund_id (ou à défaut order_id).',
      });
    }

    // ------------------------------------------------------- 3. LA DEMANDE EN BASE
    // C'est ELLE qui porte le montant, la devise et la clé d'idempotence. Rien de
    // ce qui suit ne vient du réseau.
    etape = 'lecture_demande';
    let ligne: Refund | null = null;

    if (UUID.test(demande)) {
      const { data, error } = await admin
        .from('payment_refunds')
        .select('id, payment_intent_id, order_id, status, provider_refund_id, amount_minor, currency, idempotency_key, motif')
        .eq('id', demande)
        .maybeSingle();
      if (error) {
        console.error('rembourser-paiement: lecture payment_refunds impossible', demande, error);
        return json(500, { erreur: 'erreur_serveur', code: 'lecture_demande' });
      }
      ligne = data as Refund | null;
    } else {
      // Repli admin : on RETROUVE la demande en vol de cette commande, on n'en
      // crée jamais. Créer une demande est le métier de la base
      // (`admin_demander_remboursement`), qui tient le plafond, le verrou de
      // ligne et le journal `admin_actions`.
      const { data, error } = await admin
        .from('payment_refunds')
        .select('id, payment_intent_id, order_id, status, provider_refund_id, amount_minor, currency, idempotency_key, motif')
        .eq('order_id', commande)
        .eq('status', 'demande');
      if (error) {
        console.error('rembourser-paiement: lecture payment_refunds impossible', commande, error);
        return json(500, { erreur: 'erreur_serveur', code: 'lecture_demande' });
      }
      const lignes = (data ?? []) as Refund[];
      if (lignes.length > 1) {
        // Ne devrait pas arriver (une demande en vol par paiement), mais deviner
        // laquelle rembourser serait pire que refuser.
        return json(409, {
          erreur: 'plusieurs_demandes',
          code: 'plusieurs_demandes',
          message: 'Plusieurs demandes en vol sur cette commande : à traiter une par une par refund_id.',
        });
      }
      ligne = lignes[0] ?? null;
    }

    if (!ligne) {
      return json(404, {
        erreur: 'demande_introuvable',
        code: 'demande_introuvable',
        message: 'Aucune demande de remboursement à traiter.',
      });
    }
    refundId = ligne.id;

    // Rejeu : pg_net réémet, un administrateur double-clique, la relance repasse.
    // Une demande déjà tranchée — ou qui porte déjà son `re_...` — se répond sans
    // toucher à Stripe. C'est la première des trois barrières anti-double-envoi.
    if (ligne.status !== 'demande' || ligne.provider_refund_id) {
      return json(200, {
        ok: true,
        code: 'deja_traite',
        refund_id: ligne.id,
        statut: ligne.status,
        provider_refund_id: ligne.provider_refund_id,
        message: 'Cette demande a déjà été envoyée à Stripe.',
      });
    }

    // ------------------------------------------------ 4. CE QUE L'APPELANT PRÉTEND
    // Le trigger envoie `amount_minor` et `currency` : ils doivent correspondre à
    // la ligne, sinon c'est que l'appel ne parle pas de la même chose que la base.
    // ⚠️ CE CONTRÔLE EST AVANT TOUT APPEL À STRIPE, et il n'y a délibérément
    // aucun chemin où une valeur du corps l'emporterait sur la base.
    etape = 'coherence_entree';
    if (corps.amount_minor !== undefined && Number(corps.amount_minor) !== ligne.amount_minor) {
      throw new EchecRemboursement(
        'montant_incoherent',
        409,
        {
          erreur: 'montant_incoherent',
          message: 'Le montant demandé ne correspond pas à la demande enregistrée.',
          attendu: ligne.amount_minor,
        },
        { recu: corps.amount_minor, attendu: ligne.amount_minor },
      );
    }
    if (corps.currency !== undefined && String(corps.currency).toLowerCase() !== ligne.currency) {
      throw new EchecRemboursement(
        'devise_incoherente',
        409,
        { erreur: 'devise_incoherente', message: 'Devise incohérente avec la demande enregistrée.' },
        { recu: corps.currency, attendu: ligne.currency },
      );
    }

    // --------------------------------------------------------- 5. LE PAIEMENT
    etape = 'lecture_paiement';
    const { data: intentData, error: intentError } = await admin
      .from('payment_intents')
      .select('id, provider_intent_id, status, amount_minor, currency')
      .eq('id', ligne.payment_intent_id)
      .maybeSingle();
    if (intentError) {
      console.error('rembourser-paiement: lecture payment_intents impossible', ligne.payment_intent_id, intentError);
      return json(500, { erreur: 'erreur_serveur', code: 'lecture_paiement' });
    }
    const intent = intentData as Intent | null;
    if (!intent) {
      throw new EchecRemboursement(
        'paiement_introuvable',
        409,
        { erreur: 'paiement_introuvable', message: 'Le paiement de cette demande est introuvable.' },
      );
    }
    if (!intent.provider_intent_id) {
      // Le cas existe : TF-94 porte une tentative sans `pi_...` (la clé Stripe
      // était illisible, l'appel n'est jamais parti). Il n'y a rien à rembourser
      // chez Stripe, et rien à deviner : la demande reste en vol, à instruire.
      throw new EchecRemboursement(
        'paiement_sans_reference',
        422,
        {
          erreur: 'paiement_sans_reference',
          message: 'Ce paiement n\'a aucune référence Stripe : rien à rembourser automatiquement.',
        },
      );
    }

    // ---------------------------------------------- 6. LE CANAL EST-IL UTILISABLE
    etape = 'lecture_config_stripe';
    const { data: cfgData, error: cfgError } = await admin.rpc('stripe_config');
    const cfg = cfgData as StripeConfig | null;
    if (cfgError || !cfg?.configure || !cfg.secret_key) {
      console.error('rembourser-paiement: stripe_config indisponible', cfgError);
      throw new EchecRemboursement(
        'stripe_non_configure',
        503,
        { erreur: 'remboursement_non_configure', message: 'Le remboursement n\'est pas configuré.' },
        { sous_motif: 'secret_absent' },
      );
    }
    // ⚠️ VALIDÉE AVANT DE DEVENIR UN EN-TÊTE. On journalise de quoi diagnostiquer
    // — la longueur, la position du premier caractère fautif — et JAMAIS la clé :
    // ses huit premiers caractères suffisent à identifier le compte.
    if (!CLE_STRIPE_VALIDE.test(cfg.secret_key)) {
      const position = cfg.secret_key.split('').findIndex((c) => c < '\x21' || c > '\x7e');
      console.error('rembourser-paiement: CLÉ STRIPE ILLISIBLE dans le Vault', {
        longueur: cfg.secret_key.length,
        premier_caractere_non_ascii: position,
        indice: 'clé masquée copiée du tableau de bord ? attendu sk_live_… ou rk_live_…',
      });
      throw new EchecRemboursement(
        'cle_stripe_illisible',
        503,
        { erreur: 'remboursement_non_configure', message: 'Le remboursement n\'est pas configuré.' },
        { sous_motif: 'cle_stripe_illisible' },
      );
    }
    const enTeteStripe = { Authorization: `Bearer ${cfg.secret_key}` };

    // ⚠️ `carte_active` n'est PAS testé ici, et c'est volontaire : couper le canal
    // d'encaissement ne doit jamais empêcher de rendre l'argent déjà pris. C'est
    // même le moment où on en a le plus besoin.

    // -------------------------------------- 7. L'ÉTAT RÉEL DU PAIEMENT CHEZ STRIPE
    // La base dit ce qu'elle a compris des webhooks reçus ; Stripe dit ce qui est.
    // Sur un geste qui sort de l'argent, on demande à Stripe. C'est aussi cette
    // lecture qui donne `amount_refunded` — combien a DÉJÀ été rendu — la seule
    // valeur que notre base ne peut pas connaître si un remboursement a été fait
    // à la main depuis le tableau de bord.
    etape = 'relecture_stripe';
    let piStripe: Record<string, unknown>;
    try {
      const r = await fetch(
        `${STRIPE_API}/payment_intents/${encodeURIComponent(intent.provider_intent_id)}?expand[]=latest_charge`,
        { headers: enTeteStripe },
      );
      const brut = await r.text();
      if (!r.ok) {
        throw new EchecRemboursement(
          `stripe_lecture_${r.status}`,
          502,
          { erreur: 'stripe_indisponible', message: 'Le paiement n\'a pas pu être relu chez Stripe.' },
          { http_status: r.status, request_id: r.headers.get('Request-Id'), detail: brut.slice(0, 500) },
        );
      }
      piStripe = JSON.parse(brut) as Record<string, unknown>;
    } catch (e) {
      if (e instanceof EchecRemboursement) throw e;
      const d = decrire(e);
      throw new EchecRemboursement(
        'stripe_injoignable',
        502,
        { erreur: 'stripe_indisponible', message: 'Stripe est injoignable. La demande reste en attente.' },
        { type: d.type, message: d.message },
      );
    }

    const statutStripe = String(piStripe.status ?? '');
    const charge = (piStripe.latest_charge ?? null) as Record<string, unknown> | null;
    const capture = Number(charge?.amount_captured ?? piStripe.amount_received ?? 0);
    const dejaRendu = Number(charge?.amount_refunded ?? 0);

    if (String(piStripe.currency ?? '').toLowerCase() !== ligne.currency) {
      throw new EchecRemboursement(
        'devise_stripe_incoherente',
        409,
        { erreur: 'devise_incoherente', message: 'La devise du paiement ne correspond pas à la demande.' },
        { stripe: piStripe.currency, base: ligne.currency },
      );
    }

    // --------------------------------------------- 8a. RIEN N'A ÉTÉ PRIS : ON ANNULE
    if (statutStripe !== 'succeeded') {
      if (ANNULABLES.has(statutStripe)) {
        etape = 'annulation_stripe';
        const r = await fetch(
          `${STRIPE_API}/payment_intents/${encodeURIComponent(intent.provider_intent_id)}/cancel`,
          {
            method: 'POST',
            headers: {
              ...enTeteStripe,
              'Content-Type': 'application/x-www-form-urlencoded',
              // Même clé que le remboursement qu'on n'aura pas fait : c'est la
              // clé DE LA DEMANDE, et il n'y a qu'un seul geste par demande.
              'Idempotency-Key': ligne.idempotency_key,
            },
            body: new URLSearchParams({ cancellation_reason: 'requested_by_customer' }).toString(),
          },
        );
        const brut = await r.text();
        if (!r.ok) {
          throw new EchecRemboursement(
            `stripe_annulation_${r.status}`,
            502,
            { erreur: 'stripe_indisponible', message: 'L\'annulation du paiement a échoué chez Stripe.' },
            { http_status: r.status, request_id: r.headers.get('Request-Id'), detail: brut.slice(0, 500) },
          );
        }
        console.log('rembourser-paiement: PaymentIntent annulé (jamais capturé)', {
          refund: ligne.id, intent: intent.provider_intent_id, appelant,
        });
      }

      // `canceled` (déjà annulé, comme après un repli espèces) ou annulation qu'on
      // vient de faire : dans les deux cas rien n'a été débité, donc rien n'est
      // rendu. `sans_objet` existe pour ne pas mentir en disant `effectue` (qui
      // ferait entrer un montant dans le rapport) ni `echoue` (qui veut dire « le
      // client n'a rien reçu et il faut le rembourser autrement »).
      etape = 'verdict_sans_objet';
      const { error: verdictError } = await admin.rpc('enregistrer_verdict_remboursement', {
        p_refund_id: ligne.id,
        p_provider_refund_id: null,
        p_statut: 'sans_objet',
        p_erreur: `paiement jamais capture (stripe: ${statutStripe}) : annule, rien a rendre`,
        p_raw_event: { _stripe: { id: piStripe.id, status: statutStripe, amount: piStripe.amount } },
      });
      if (verdictError) {
        console.error('rembourser-paiement: verdict sans_objet non écrit', ligne.id, verdictError);
        throw new EchecRemboursement(
          'verdict_non_ecrit',
          500,
          { erreur: 'erreur_serveur', message: 'Le paiement a été annulé mais la demande n\'a pas pu être close.' },
          { message: verdictError.message },
        );
      }
      return json(200, {
        ok: true,
        code: 'sans_objet',
        refund_id: ligne.id,
        statut: 'sans_objet',
        statut_stripe: statutStripe,
        message: 'Ce paiement n\'a jamais été encaissé : rien n\'a été débité, rien n\'est rendu.',
      });
    }

    // ------------------------------------- 8b. SUR-REMBOURSEMENT : LA TROISIÈME BARRIÈRE
    // La base tient déjà un plafond (trigger `payment_refunds_plafond`) sur ce
    // qu'ELLE connaît. Ici on ajoute ce qu'elle ne peut pas connaître : un
    // remboursement fait à la main depuis le tableau de bord Stripe. Stripe
    // refuserait de toute façon (« trying to refund more money than is left on a
    // charge »), mais un refus explicite laisse une phrase lisible en base au
    // lieu d'une erreur d'API.
    etape = 'plafond_stripe';
    if (capture <= 0 || ligne.amount_minor + dejaRendu > capture) {
      throw new EchecRemboursement(
        'sur_remboursement',
        409,
        {
          erreur: 'sur_remboursement',
          message: 'Ce montant dépasse ce qui reste à rembourser sur ce paiement.',
          capture,
          deja_rembourse: dejaRendu,
          demande: ligne.amount_minor,
        },
        { capture, deja_rembourse: dejaRendu, demande: ligne.amount_minor },
      );
    }

    // ---------------------------------------------------- 9. LE REMBOURSEMENT
    etape = 'remboursement_stripe';
    const form = new URLSearchParams();
    form.set('payment_intent', intent.provider_intent_id);
    // ⚠️ `ligne.amount_minor`, relu en base. Jamais un chiffre du corps de la
    // requête, jamais un recalcul depuis l'ariary.
    form.set('amount', String(ligne.amount_minor));
    // ⚠️ JAMAIS `fraudulent` : Stripe ajoute alors la carte et l'e-mail du client
    // à ses listes de blocage Radar. Un refus du restaurant n'est pas une fraude.
    form.set('reason', 'requested_by_customer');
    // Le filet de rattrapage, comme sur le PaymentIntent : sans elles, un `re_...`
    // orphelin ne se rattache à rien lors d'une enquête.
    form.set('metadata[refund_id]', ligne.id);
    form.set('metadata[order_id]', ligne.order_id);
    form.set('metadata[payment_intent_row]', ligne.payment_intent_id);
    form.set('metadata[motif]', ligne.motif.slice(0, 200));

    let reponse: Response;
    try {
      reponse = await fetch(`${STRIPE_API}/refunds`, {
        method: 'POST',
        headers: {
          ...enTeteStripe,
          'Content-Type': 'application/x-www-form-urlencoded',
          // ⚠️ CELLE DE LA DEMANDE. Voir l'en-tête du fichier.
          'Idempotency-Key': ligne.idempotency_key,
        },
        body: form.toString(),
      });
    } catch (e) {
      const d = decrire(e);
      throw new EchecRemboursement(
        'stripe_injoignable',
        502,
        { erreur: 'stripe_indisponible', message: 'Stripe est injoignable. La demande reste en attente.' },
        { type: d.type, message: d.message },
      );
    }

    const requestId = reponse.headers.get('Request-Id');
    const rejoue = reponse.headers.get('Idempotent-Replayed');
    const brut = await reponse.text();

    if (!reponse.ok) {
      console.error('rembourser-paiement: remboursement refusé par Stripe', {
        refund: ligne.id,
        statut: reponse.status,
        request_id: requestId,
        detail: brut.slice(0, 500),
      });
      throw new EchecRemboursement(
        `stripe_refus_${reponse.status}`,
        502,
        { erreur: 'stripe_refus', message: 'Stripe a refusé le remboursement. La demande reste en attente.' },
        { http_status: reponse.status, request_id: requestId, detail: brut.slice(0, 500) },
      );
    }

    let refundStripe: Record<string, unknown>;
    try {
      refundStripe = JSON.parse(brut) as Record<string, unknown>;
    } catch (e) {
      // 200 au corps illisible : le remboursement peut exister chez Stripe. On
      // garde le `Request-Id`, seul identifiant qui permette à leur support de
      // retrouver l'appel — et la demande reste en vol, donc rejouable avec la
      // même clé d'idempotence, qui rendra le même objet.
      const d = decrire(e);
      throw new EchecRemboursement(
        'reponse_illisible',
        502,
        { erreur: 'stripe_indisponible', message: 'Réponse Stripe illisible. La demande reste en attente.' },
        { request_id: requestId, type: d.type, message: d.message },
      );
    }

    const reId = typeof refundStripe.id === 'string' ? refundStripe.id : '';
    if (!reId) {
      throw new EchecRemboursement(
        'reponse_sans_id',
        502,
        { erreur: 'stripe_indisponible', message: 'Réponse Stripe sans identifiant. La demande reste en attente.' },
        { request_id: requestId },
      );
    }
    const statutRefund = String(refundStripe.status ?? '');

    // ----------------------------------------- 10. ON ÉCRIT AVANT DE RÉPONDRE
    // ⚠️ Cette écriture n'a pas le droit d'échouer en silence : sans son `re_...`,
    // la ligne est invisible pour le webhook, qui cherche par `provider_refund_id`.
    // L'argent partirait sans que rien ne le dise en base — exactement le bug
    // qu'on est en train de fermer, à l'envers.
    etape = 'archivage_refund';
    const { error: envoiError } = await admin.rpc('enregistrer_envoi_remboursement', {
      p_refund_id: ligne.id,
      p_provider_refund_id: reId,
      p_statut_stripe: statutRefund,
      p_raw_event: refundStripe,
    });
    if (envoiError) {
      // La porte SQL refuse d'attacher un second `re_...` : si on passe ici, un
      // appel concurrent a gagné la course. Stripe, lui, a rendu le MÊME objet
      // (même clé d'idempotence) : il n'y a pas eu deux remboursements.
      console.error('rembourser-paiement: envoi non archivé (course ou rejeu)', {
        refund: ligne.id, refund_stripe: reId, rejoue, erreur: envoiError,
      });
      return json(200, {
        ok: true,
        code: 'deja_traite',
        refund_id: ligne.id,
        provider_refund_id: reId,
        idempotent_rejoue: rejoue === 'true',
        message: 'Un envoi était déjà enregistré pour cette demande.',
      });
    }

    // Stripe répond `pending` dans le cas général : la demande est acceptée, pas
    // encore honorée. On ne clôt donc QUE sur un verdict explicite ; le reste
    // attend le webhook (`refund.updated` / `refund.failed`).
    let statutFinal = 'demande';
    if (statutRefund === 'succeeded' || statutRefund === 'failed' || statutRefund === 'canceled') {
      etape = 'verdict_immediat';
      statutFinal = statutRefund === 'succeeded' ? 'effectue' : 'echoue';
      const { error: verdictError } = await admin.rpc('enregistrer_verdict_remboursement', {
        p_refund_id: ligne.id,
        p_provider_refund_id: reId,
        p_statut: statutFinal,
        p_erreur: statutRefund === 'succeeded'
          ? null
          : `stripe: ${statutRefund}${refundStripe.failure_reason ? ` (${refundStripe.failure_reason})` : ''}`,
        p_raw_event: refundStripe,
      });
      if (verdictError) {
        // Le `re_...` est enregistré, donc le webhook retrouvera la ligne et
        // tranchera. On le signale sans transformer ça en échec de remboursement.
        console.error('rembourser-paiement: verdict immédiat non écrit', ligne.id, verdictError);
        statutFinal = 'demande';
      }
    }

    console.log('rembourser-paiement: remboursement envoyé', {
      refund: ligne.id,
      refund_stripe: reId,
      montant: ligne.amount_minor,
      devise: ligne.currency,
      statut_stripe: statutRefund,
      idempotent_rejoue: rejoue === 'true',
      request_id: requestId,
      appelant,
    });

    return json(200, {
      ok: true,
      code: 'envoye',
      refund_id: ligne.id,
      provider_refund_id: reId,
      montant_minor: ligne.amount_minor,
      devise: ligne.currency,
      statut: statutFinal,
      statut_stripe: statutRefund,
      idempotent_rejoue: rejoue === 'true',
    });
  } catch (e) {
    // ------------------------------------------------------- LE FILET DE SÉCURITÉ
    // Rien ne sort d'ici sans trace : ni dans les journaux, ni en base, ni pour
    // l'appelant. Et jamais un « Internal Server Error » en texte brut.
    if (e instanceof EchecRemboursement) {
      await noterEchec(admin, refundId, e.code, String(e.diagnostic.message ?? e.diagnostic.detail ?? ''), e.diagnostic);
      return json(e.statutHttp, { ...e.corps, code: e.code, refund_id: refundId, etape });
    }

    const d = decrire(e);
    const code = `exception:${d.type}`;
    console.error('rembourser-paiement: EXCEPTION NON PRÉVUE', {
      etape,
      refund: refundId,
      type: d.type,
      message: d.message,
      stack: e instanceof Error ? (e.stack ?? '').slice(0, 800) : undefined,
    });
    await noterEchec(admin, refundId, code, d.message, { etape, type: d.type });
    return json(500, {
      erreur: 'erreur_serveur',
      code,
      etape,
      refund_id: refundId,
      message: 'Le remboursement n\'a pas pu être envoyé. La demande reste en attente.',
    });
  }
});
