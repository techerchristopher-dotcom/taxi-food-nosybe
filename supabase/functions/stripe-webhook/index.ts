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
 * ⚠️ LE PIRE SCÉNARIO DE TOUT LE PROJET : l'argent encaissé chez Stripe pendant
 * que la base l'ignore. Trois garde-fous, ajoutés le 2026-09-06 :
 *   1. `try/catch` englobant : une exception répond 500 (donc Stripe REJOUE) au
 *      lieu de laisser le runtime rendre un « Internal Server Error » opaque, et
 *      elle s'inscrit dans `payment_intents.erreur` quand la ligne est connue ;
 *   2. les écritures d'archive sont relues : un 200 rendu sur une écriture ratée
 *      fait croire à Stripe que l'événement est traité, et il ne le rejoue plus ;
 *   3. RATTRAPAGE PAR LES MÉTADONNÉES : si `creer-paiement` n'a pas réussi à
 *      écrire son `pi_...`, la ligne est introuvable par `provider_intent_id`.
 *      On la retrouve alors par `metadata[payment_intent_row]` puis par
 *      `metadata[order_id]`, et on RECOLLE le `pi_...` au passage. Ces
 *      métadonnées étaient posées « pour un rapprochement à la main » ; elles
 *      servent maintenant toutes seules.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Au-delà, on refuse : un événement rejoué bien plus tard n'a rien de légitime. */
const MAX_SKEW_SECONDS = 5 * 60;

/**
 * Même raison que `CLE_STRIPE_VALIDE` dans `creer-paiement` : un secret copié
 * depuis le tableau de bord peut arriver masqué, ou entouré d'espaces. Ici il ne
 * part dans aucun en-tête, donc il ne fait rien planter — mais un secret
 * illisible ferait échouer TOUTES les signatures, soit un refus permanent
 * impossible à distinguer d'une attaque. Autant le dire.
 */
const SECRET_WEBHOOK_VALIDE = /^whsec_[A-Za-z0-9+/=_-]+$/;

/** Ce qui tient dans `payment_intents.erreur` : un motif, pas une archive. */
const MAX_ERREUR = 300;

type StripeConfig = {
  secret_key: string | null;
  webhook_secret: string | null;
  publishable_key: string | null;
  devise: string | null;
  carte_active: boolean | null;
  configure: boolean;
};

type LignePaiement = {
  id: string;
  status: string;
  amount_minor: number;
  order_id: string;
  provider_intent_id: string | null;
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

/** Le type de l'exception compte autant que son message. Voir `creer-paiement`. */
function decrire(e: unknown): { type: string; message: string } {
  if (e instanceof Error) {
    return { type: e.name || 'Error', message: (e.message || '').slice(0, MAX_ERREUR) };
  }
  return { type: typeof e, message: String(e).slice(0, MAX_ERREUR) };
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

/**
 * Refus. ⚠️ Toujours du JSON, avec un code STABLE. « erreur base » en texte brut
 * ne disait ni ce qui avait raté, ni s'il fallait s'en inquiéter — et un
 * « Internal Server Error » rendu par le runtime encore moins.
 */
function refus(status: number, code: string, detail: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ erreur: code, ...detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * L'identifiant de l'événement, lu d'un corps NON VÉRIFIÉ.
 *
 * ⚠️ À N'UTILISER QUE POUR JOURNALISER. Un corps dont la signature est refusée
 * n'est pas une donnée de confiance ; mais sans son `evt_...`, un refus de
 * signature est indistinguable du suivant dans les journaux — et c'est
 * précisément le cas où de l'argent peut être pris sans que la base le sache.
 */
function idEvenementNonVerifie(corps: string): string | null {
  try {
    const brut = JSON.parse(corps);
    return typeof brut?.id === 'string' ? brut.id.slice(0, 64) : null;
  } catch {
    return null;
  }
}

/** Un `uuid` de nos lignes, tel qu'il revient des métadonnées Stripe. */
function uuidValide(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
}

const COLONNES_LIGNE = 'id, status, amount_minor, order_id, provider_intent_id';

/**
 * Retrouve la tentative de paiement visée par l'événement.
 *
 * Trois chemins, du plus sûr au plus tolérant. Les deux derniers n'existent que
 * pour le scénario où `creer-paiement` a bien créé le PaymentIntent mais n'a pas
 * réussi à écrire son `pi_...` : sans eux, l'événement `succeeded` d'un paiement
 * RÉELLEMENT ENCAISSÉ repartirait en « intent inconnu », la commande resterait
 * non payée, et le restaurant ne serait jamais prévenu.
 *
 * ⚠️ Lève plutôt que de rendre `null` sur une erreur de lecture : « je n'ai pas
 * trouvé » et « je n'ai pas pu chercher » ne se répondent pas pareil — le second
 * doit faire rejouer Stripe.
 */
async function trouverLigne(
  admin: SupabaseClient,
  intentId: string,
  objet: Record<string, unknown>,
): Promise<{ ligne: LignePaiement; via: string } | null> {
  const parIntent = await admin
    .from('payment_intents')
    .select(COLONNES_LIGNE)
    .eq('provider_intent_id', intentId)
    .maybeSingle();
  if (parIntent.error) throw new Error(`lecture par provider_intent_id: ${parIntent.error.message}`);
  if (parIntent.data) return { ligne: parIntent.data as LignePaiement, via: 'provider_intent_id' };

  const meta = (objet.metadata ?? {}) as Record<string, unknown>;

  if (uuidValide(meta.payment_intent_row)) {
    const parLigne = await admin
      .from('payment_intents')
      .select(COLONNES_LIGNE)
      .eq('id', meta.payment_intent_row)
      .maybeSingle();
    if (parLigne.error) throw new Error(`lecture par metadata.payment_intent_row: ${parLigne.error.message}`);
    const l = parLigne.data as LignePaiement | null;
    // Une ligne déjà rattachée à un AUTRE PaymentIntent n'est pas la nôtre : on
    // ne recolle jamais par-dessus un rattachement existant.
    if (l && (l.provider_intent_id === null || l.provider_intent_id === intentId)) {
      return { ligne: l, via: 'metadata.payment_intent_row' };
    }
  }

  if (uuidValide(meta.order_id)) {
    const parCommande = await admin
      .from('payment_intents')
      .select(COLONNES_LIGNE)
      .eq('order_id', meta.order_id)
      .is('provider_intent_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (parCommande.error) throw new Error(`lecture par metadata.order_id: ${parCommande.error.message}`);
    if (parCommande.data) return { ligne: parCommande.data as LignePaiement, via: 'metadata.order_id' };
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return refus(405, 'methode_non_autorisee');
  }

  // Déclarés hors du `try` : le `catch` doit savoir où on en était et sur quelle
  // ligne écrire. Sans ça il ne saurait rien de l'échec qu'il rattrape.
  let admin: SupabaseClient | null = null;
  let ligneId: string | null = null;
  let etape = 'demarrage';
  let idEvenement: string | null = null;

  try {
    admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ⚠️ Le corps brut, avant tout parsing. Voir l'en-tête de fichier.
    etape = 'lecture_corps';
    const corps = await req.text();

    etape = 'lecture_config';
    const { data: cfgData, error: cfgError } = await admin.rpc('stripe_config');
    const cfg = cfgData as StripeConfig | null;
    if (cfgError || !cfg?.webhook_secret) {
      // Tant que `stripe_webhook_secret` n'est pas dans le Vault : refus net et
      // explicite. Surtout pas un 200, qui ferait croire à Stripe que l'événement
      // a été traité et le supprimerait de la file de reprise.
      console.error('stripe-webhook: stripe_webhook_secret absent du Vault', cfgError);
      return refus(503, 'webhook_non_configure', { sous_motif: 'secret_absent' });
    }

    if (!SECRET_WEBHOOK_VALIDE.test(cfg.webhook_secret)) {
      // Jamais le secret dans les journaux, même tronqué : seulement de quoi
      // comprendre qu'il a été mal copié.
      console.error('stripe-webhook: SECRET DE SIGNATURE ILLISIBLE dans le Vault', {
        longueur: cfg.webhook_secret.length,
        indice: 'attendu whsec_… — secret masqué, ou espaces collés au copier-coller ?',
      });
      return refus(503, 'webhook_non_configure', { sous_motif: 'secret_illisible' });
    }

    etape = 'verification_signature';
    const verdict = await verifierSignature(
      req.headers.get('Stripe-Signature'),
      corps,
      cfg.webhook_secret,
    );
    if (!verdict.ok) {
      // ⚠️ CE JOURNAL EST LA SEULE TRACE D'UN ÉVÉNEMENT REFUSÉ : il n'y a aucune
      // ligne à écrire, on ne sait même pas de quel paiement il parle. S'il se
      // répète, c'est soit une rotation de secret oubliée — et alors des
      // paiements RÉELS n'arrivent plus en base — soit quelqu'un qui essaie.
      console.error('stripe-webhook: ÉVÉNEMENT REFUSÉ', {
        motif: verdict.motif,
        evenement: idEvenementNonVerifie(corps),
      });
      return refus(verdict.code, verdict.motif);
    }

    etape = 'lecture_evenement';
    let evenement: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    try {
      evenement = JSON.parse(corps);
    } catch {
      return refus(400, 'corps_illisible');
    }

    idEvenement = typeof evenement.id === 'string' ? evenement.id : null;
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
        // ⚠️ Préfixé `refus_banque`. C'est ce qui distingue « la carte a été
        // refusée » de « notre code a planté » DANS LA MÊME COLONNE, sans avoir
        // à ouvrir `raw_event` — et les deux n'appellent pas la même conduite :
        // l'un se répond au client, l'autre se corrige chez nous.
        erreur = `refus_banque | ${
          ((objet.last_payment_error as Record<string, unknown> | undefined)?.message as string) ??
            'paiement refusé'
        }`.slice(0, MAX_ERREUR);
        break;
      case 'payment_intent.canceled':
        nouveauStatut = 'annule';
        // Sans ça, un intent annulé n'expliquait jamais pourquoi.
        // `cancellation_reason` vaut `abandoned` (expiré tout seul),
        // `requested_by_customer`, `duplicate`…
        erreur = `annule_stripe | ${String(objet.cancellation_reason ?? 'sans motif')}`.slice(0, MAX_ERREUR);
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
        console.error('stripe-webhook: LITIGE STRIPE ouvert', {
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

    etape = 'recherche_ligne';
    const trouvee = await trouverLigne(admin, intentId, objet);

    if (!trouvee) {
      // Paiement inconnu de nous : PaymentIntent créé hors de l'app, ou événement
      // d'un autre projet branché sur le même compte. 200 pour ne pas boucler.
      // ⚠️ Sur un `succeeded`, c'est GRAVE : de l'argent a été pris et aucune
      // commande ne le sait. Le rattrapage par métadonnées a déjà échoué, donc
      // seul un rapprochement manuel reste possible — d'où ce journal explicite.
      console.error('stripe-webhook: PaymentIntent inconnu en base', {
        intent: intentId,
        type,
        evenement: idEvenement,
        gravite: nouveauStatut === 'capture' ? 'ARGENT ENCAISSÉ SANS COMMANDE RATTACHÉE' : 'sans effet',
      });
      return ok({ ignore: type, motif: 'intent_inconnu' });
    }

    const ligne = trouvee.ligne;
    ligneId = ligne.id;

    // Rattrapage : la ligne a été retrouvée par ses métadonnées, donc elle ne
    // portait pas son `pi_...`. On le recolle, sinon chaque événement suivant
    // referait le détour — et le rapprochement comptable resterait impossible.
    if (ligne.provider_intent_id !== intentId) {
      console.error('stripe-webhook: RATTRAPAGE — ligne retrouvée sans son pi_', {
        via: trouvee.via,
        ligne: ligne.id,
        intent: intentId,
      });
      const { error: recollageError } = await admin
        .from('payment_intents')
        .update({ provider_intent_id: intentId })
        .eq('id', ligne.id)
        .is('provider_intent_id', null);
      if (recollageError) {
        console.error('stripe-webhook: recollage du pi_ impossible', ligne.id, recollageError);
      }
    }

    // Contrôle comptable : si Stripe a encaissé un montant différent de celui
    // qu'on a calculé, ce n'est pas une raison de refuser l'encaissement — mais
    // ça doit se voir dans les logs le jour du rapprochement.
    const encaisse = (objet.amount_received ?? objet.amount) as number | undefined;
    if (nouveauStatut === 'capture' && typeof encaisse === 'number' && encaisse !== ligne.amount_minor) {
      console.error('stripe-webhook: ÉCART DE MONTANT', {
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

    // ⚠️ UN 200 RENDU SUR UNE ÉCRITURE RATÉE EST PIRE QUE PAS DE 200 DU TOUT :
    // Stripe considère l'événement traité et ne le rejoue plus jamais. Chacune
    // des trois écritures ci-dessous est donc relue.
    etape = 'archivage';
    if (nouveauStatut === null) {
      // Litige : on archive l'événement sans toucher au statut.
      const { error } = await admin
        .from('payment_intents')
        .update({ raw_event: archive })
        .eq('id', ligne.id);
      if (error) {
        console.error('stripe-webhook: archivage litige impossible', ligne.id, error);
        return refus(500, 'ecriture_impossible', { etape });
      }
      return ok({ traite: type, statut: ligne.status });
    }

    // ⚠️ L'IDEMPOTENCE EST ICI. Un rejeu, ou un événement arrivé dans le désordre,
    // ne fait pas reculer l'état — et ne redéclenche donc pas le trigger qui
    // recalcule `orders.payment_status`.
    if ((RANG[nouveauStatut] ?? 0) <= (RANG[ligne.status] ?? 0)) {
      const { error } = await admin
        .from('payment_intents')
        .update({ raw_event: archive })
        .eq('id', ligne.id);
      if (error) {
        console.error('stripe-webhook: archivage rejeu impossible', ligne.id, error);
        return refus(500, 'ecriture_impossible', { etape });
      }
      return ok({ traite: type, statut: ligne.status, applique: false });
    }

    const maj: Record<string, unknown> = { status: nouveauStatut, raw_event: archive };
    if (erreur) maj.erreur = erreur;
    if (nouveauStatut === 'capture') maj.captured_at = new Date().toISOString();

    etape = 'application_statut';
    const { error: majError } = await admin
      .from('payment_intents')
      .update(maj)
      .eq('id', ligne.id);

    if (majError) {
      console.error('stripe-webhook: mise à jour payment_intents impossible', ligne.id, majError);
      return refus(500, 'ecriture_impossible', { etape });
    }

    return ok({ traite: type, statut: nouveauStatut, applique: true });
  } catch (e) {
    // ------------------------------------------------------- LE FILET DE SÉCURITÉ
    // 500 volontaire : Stripe rejoue, donc un incident passager se rattrape tout
    // seul. Et la raison est écrite quelque part, toujours.
    const d = decrire(e);
    console.error('stripe-webhook: EXCEPTION NON PRÉVUE', {
      etape,
      evenement: idEvenement,
      ligne: ligneId,
      type: d.type,
      message: d.message,
      stack: e instanceof Error ? (e.stack ?? '').slice(0, 800) : undefined,
    });

    // ⚠️ Le statut n'est PAS touché : une exception de notre côté ne dit rien de
    // l'état réel du paiement chez Stripe. On note seulement le motif, pour que
    // la question « pourquoi ? » ait une réponse en base.
    if (admin && ligneId) {
      try {
        await admin
          .from('payment_intents')
          .update({ erreur: `exception:${d.type} | ${d.message}`.slice(0, MAX_ERREUR) })
          .eq('id', ligneId);
      } catch (e2) {
        console.error('stripe-webhook: motif non enregistrable', ligneId, decrire(e2));
      }
    }

    return refus(500, 'erreur_serveur', { code: `exception:${d.type}`, etape });
  }
});
