/**
 * Paiement carte — couche données.
 *
 * Trois choses, et rien d'autre :
 *   1. lire les réglages publics (`payment_config`) : taux, devise, interrupteur ;
 *   2. demander un `client_secret` à l'Edge Function `creer-paiement` ;
 *   3. surveiller `orders.payment_status` jusqu'à ce que le WEBHOOK ait tranché.
 *
 * ⚠️ RÈGLE CARDINALE DE TOUT CE CHANTIER : l'application ne décide JAMAIS qu'une
 * commande est payée. `presentPaymentSheet()` qui réussit veut seulement dire
 * « le client a confirmé sur son appareil ». Stripe peut encore refuser, la
 * banque peut encore rejeter, et un client malveillant peut toujours mentir sur
 * ce que son téléphone raconte. Seul `stripe-webhook`, qui vérifie la signature
 * Stripe côté serveur, écrit `payment_intents.status` — d'où le trigger déduit
 * `orders.payment_status`. L'app ne fait que LIRE ce verdict.
 *
 * ⚠️ AUCUN MONTANT N'EST ENVOYÉ AU SERVEUR. `creer-paiement` ne lit que
 * `{ order_id, idempotency_key }` et relit `orders.total` en base. Les montants
 * calculés ici ne servent qu'à AFFICHER un aperçu avant la commande ; le montant
 * qui sera réellement débité est celui que l'Edge Function renvoie.
 */
import { supabase } from '../lib/supabase';
import { StatutPaiement } from './types';

export type { StatutPaiement };

export type ConfigPaiement = {
  /** Combien d'ariary pour 1 euro. Vient de `payment_config`, jamais d'une constante. */
  fxArParEur: number;
  /** Devise de prélèvement, en minuscules (ex. `eur`). */
  devise: string;
  /** Interrupteur général. Faux = la carte ne doit même pas être proposée. */
  carteActive: boolean;
  /** Minimum accepté par Stripe, en unité mineure (50 centimes pour l'euro). */
  montantMinimumMinor: number;
};

/**
 * Réglage de repli quand la base est injoignable : carte ÉTEINTE.
 * Le sens de l'échec est choisi : mieux vaut proposer les espèces à quelqu'un
 * qui aurait pu payer par carte que d'ouvrir un tunnel de paiement qu'on est
 * incapable de configurer.
 */
export const CONFIG_PAIEMENT_ETEINTE: ConfigPaiement = {
  fxArParEur: 0,
  devise: 'eur',
  carteActive: false,
  montantMinimumMinor: 50,
};

/**
 * Réglages publics du paiement. Lisibles sans compte : la policy
 * `payment_config_select` l'autorise, et un GRANT PAR COLONNE cache `maj_par`.
 */
export async function lireConfigPaiement(): Promise<ConfigPaiement> {
  const { data, error } = await supabase
    .from('payment_config')
    .select('fx_ar_per_eur, devise_paiement, carte_active, montant_minimum_minor')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return CONFIG_PAIEMENT_ETEINTE;
  const row = data as {
    fx_ar_per_eur: number | string;
    devise_paiement: string | null;
    carte_active: boolean | null;
    montant_minimum_minor: number | null;
  };
  return {
    fxArParEur: Number(row.fx_ar_per_eur) || 0,
    devise: (row.devise_paiement ?? 'eur').toLowerCase(),
    carteActive: row.carte_active === true,
    montantMinimumMinor: row.montant_minimum_minor ?? 50,
  };
}

/**
 * Ariary → unité mineure de la devise (centimes d'euro).
 *
 * ⚠️ APERÇU UNIQUEMENT. La vérité est la fonction SQL `montant_eur_centimes`,
 * seul endroit du projet où l'ariary devient de l'euro. On en recopie ici la
 * règle — arrondi AU SUPÉRIEUR, jamais au plus proche — pour que le chiffre
 * annoncé sur l'écran de validation soit exactement celui que le serveur
 * calculera ensuite. Un `Math.round` afficherait 1,00 € là où le serveur
 * facturerait 1,01 €, et un client qui voit deux chiffres différents conteste.
 *
 * ⚠️ L'ORDRE DES OPÉRATIONS FAIT PARTIE DE LA RÈGLE, pas seulement l'arrondi.
 * Le SQL fait `ceil(total * 100 / taux)` : il multiplie AVANT de diviser, en
 * `numeric` exact. Écrire `(total / taux) * 100` divise d'abord, en flottant
 * binaire, et le résidu de cette division remonte au-dessus de l'entier juste
 * avant que `ceil` ne passe — qui rend alors un centime de trop. Ce n'est pas
 * théorique : sur 1 à 2 000 000 Ar au taux de 4 700, l'ancienne écriture
 * divergeait du SQL sur 2 295 montants (5 123 Ar → 110 c annoncés contre 109 c
 * débités ; 19 317 Ar → 412 contre 411). Le catalogue actuel n'a que des prix
 * ronds — 219 produits, tous multiples de 100 — donc rien ne se voyait ; le
 * premier prix en 500 Ar, ou la première remise en pourcentage sur le
 * sous-total, l'aurait réveillé sur l'écran de validation.
 * En multipliant d'abord (`totalAr * 100` est exact pour un entier), il ne reste
 * qu'une division, et les deux calculs coïncident sur toute la plage testée.
 */
export function apercuMontantMineur(totalAr: number, fxArParEur: number): number | null {
  if (!Number.isFinite(totalAr) || totalAr <= 0) return null;
  if (!Number.isFinite(fxArParEur) || fxArParEur <= 0) return null;
  return Math.ceil((totalAr * 100) / fxArParEur);
}

/** « 1207 » + « eur » → « 12,07 € ». Le séparateur suit la langue de l'app. */
export function formatMontantMineur(centimes: number, devise: string, langue?: string): string {
  const valeur = centimes / 100;
  try {
    return new Intl.NumberFormat(langue || 'fr-FR', {
      style: 'currency',
      currency: (devise || 'eur').toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valeur);
  } catch {
    // Intl absent ou devise inconnue : on n'a pas le droit de casser un écran de
    // paiement pour un problème de formatage.
    return `${valeur.toFixed(2)} ${(devise || 'eur').toUpperCase()}`;
  }
}

/**
 * « 4700 » → « 4 700 » (même espacement que `formatAr`).
 *
 * ⚠️ Les décimales sont conservées. `payment_config.fx_ar_per_eur` est un
 * `numeric(10,2)` : un taux de 4 750,50 s'affichait « 4 751 » avec un
 * `Math.round`, et le client ne pouvait plus retrouver le montant annoncé à
 * partir du taux annoncé. Le seul intérêt d'afficher le taux est justement
 * qu'il réconcilie les deux chiffres — un taux arrondi ne réconcilie rien.
 */
export function formatTaux(fxArParEur: number): string {
  if (!Number.isFinite(fxArParEur)) return '—';
  const entier = Math.trunc(fxArParEur);
  const centiemes = Math.round(Math.abs(fxArParEur - entier) * 100);
  const groupe = String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return centiemes === 0 ? groupe : `${groupe},${String(centiemes).padStart(2, '0')}`;
}

/**
 * Motifs d'échec renvoyés par `creer-paiement`. Chaîne fermée : chaque motif a
 * un message d'écran qui dit QUOI FAIRE, pas seulement que ça a raté.
 */
export type MotifEchecPreparation =
  | 'authentification_requise'
  | 'commande_introuvable'
  | 'methode_non_carte'
  | 'deja_payee'
  | 'paiement_non_configure'
  | 'carte_inactive'
  | 'commande_non_payable'
  | 'montant_invalide'
  | 'stripe_indisponible'
  | 'reseau'
  | 'inconnu';

export class ErreurPreparationPaiement extends Error {
  motif: MotifEchecPreparation;
  /** Message écrit par le serveur, montrable tel quel quand on n'a rien de mieux. */
  detailServeur?: string;
  constructor(motif: MotifEchecPreparation, detailServeur?: string) {
    super(motif);
    this.name = 'ErreurPreparationPaiement';
    this.motif = motif;
    this.detailServeur = detailServeur;
  }
}

export type PreparationPaiement = {
  /** Secret de confirmation de CE PaymentIntent. Jamais stocké, jamais journalisé. */
  clientSecret: string;
  /** Clé publiable Stripe, servie par le Vault via l'Edge Function. */
  publishableKey: string | null;
  /** Montant EXACT qui sera débité, en unité mineure. Calculé en base. */
  montantMineur: number;
  /** Taux effectivement appliqué à ce paiement. */
  fxRate: number;
};

const MOTIFS_CONNUS = new Set<string>([
  'authentification_requise',
  'commande_introuvable',
  'methode_non_carte',
  'deja_payee',
  'paiement_non_configure',
  'carte_inactive',
  'commande_non_payable',
  'montant_invalide',
  'stripe_indisponible',
]);

/**
 * Demande à `creer-paiement` de préparer le paiement d'une commande DÉJÀ créée.
 *
 * `cleIdempotence` est stable pour une commande donnée : deux appuis sur
 * « Payer », ou une reprise après coupure réseau, doivent reprendre le même
 * paiement. Elle ne sert qu'à la traçabilité côté Stripe — l'idempotence réelle
 * est tenue par l'index unique partiel de la base, pas par cette clé.
 */
export async function preparerPaiementCarte(
  orderId: string,
  cleIdempotence: string,
): Promise<PreparationPaiement> {
  let data: unknown;
  let error: unknown;
  try {
    const r = await supabase.functions.invoke('creer-paiement', {
      body: { order_id: orderId, idempotency_key: cleIdempotence },
    });
    data = r.data;
    error = r.error;
  } catch {
    throw new ErreurPreparationPaiement('reseau');
  }

  if (error) {
    // supabase-js emballe les réponses non-2xx : le corps JSON n'est lisible
    // que dans `error.context`. Sans ça, on perdrait le motif précis et on
    // afficherait « erreur inconnue » sur un cas parfaitement identifié.
    const contexte = (error as { context?: Response }).context;
    let corps: { erreur?: string; message?: string } | null = null;
    try {
      corps = contexte ? await contexte.clone().json() : null;
    } catch {
      corps = null;
    }
    const brut = corps?.erreur ?? '';
    const motif = (MOTIFS_CONNUS.has(brut) ? brut : 'inconnu') as MotifEchecPreparation;
    throw new ErreurPreparationPaiement(
      contexte ? motif : 'reseau',
      corps?.message,
    );
  }

  const r = data as {
    client_secret?: string | null;
    publishable_key?: string | null;
    montant_eur_centimes?: number;
    fx_rate?: number;
  } | null;

  if (!r?.client_secret) {
    // Réponse 200 sans secret : Stripe a répondu, mais on n'a rien à confirmer.
    // Mieux vaut le dire que d'ouvrir un formulaire de paiement inerte.
    throw new ErreurPreparationPaiement('inconnu');
  }

  return {
    clientSecret: r.client_secret,
    publishableKey: r.publishable_key ?? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null,
    montantMineur: r.montant_eur_centimes ?? 0,
    fxRate: Number(r.fx_rate ?? 0),
  };
}

/**
 * Lit le verdict du webhook sur une commande.
 *
 * `payment_status` est DÉDUIT de `payment_intents` par un trigger : personne
 * — ni le front, ni une RPC, ni une Edge Function — ne l'écrit directement.
 * C'est ce qui en fait une source fiable pour l'écran de suivi.
 */
export async function lireStatutPaiement(orderId: string): Promise<StatutPaiement | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  return ((data as { payment_status?: StatutPaiement }).payment_status ?? null) as StatutPaiement | null;
}

/**
 * Attend que le webhook ait tranché, par interrogation régulière.
 *
 * Pourquoi pas le temps réel Supabase : AUCUNE table de ce projet n'est publiée
 * dans `supabase_realtime` (vérifié en base). L'écran de suivi interroge déjà
 * toutes les 15 s ; on reste sur le même mécanisme plutôt que d'introduire une
 * seconde façon de faire qui exigerait une migration de publication.
 *
 * Le webhook Stripe arrive d'ordinaire en 1 à 3 secondes ; on interroge vite au
 * début, puis on s'espace. Renvoie `null` au bout du délai — ce qui n'est PAS un
 * échec de paiement, seulement une absence de réponse : l'écran doit alors
 * proposer d'attendre, pas annoncer un refus.
 */
export async function attendreVerdictPaiement(
  orderId: string,
  options: { timeoutMs?: number; annule?: () => boolean } = {},
): Promise<StatutPaiement | null> {
  const debut = Date.now();
  const timeout = options.timeoutMs ?? 25000;
  let attente = 1200;
  while (Date.now() - debut < timeout) {
    if (options.annule?.()) return null;
    const statut = await lireStatutPaiement(orderId);
    if (statut === 'paye' || statut === 'echoue' || statut === 'rembourse') return statut;
    await new Promise((r) => setTimeout(r, attente));
    attente = Math.min(attente + 600, 4000);
  }
  return null;
}

/**
 * Repasse une commande carte en espèces, SANS la recréer.
 *
 * Cas d'usage : la banque refuse, ou le client renonce à payer en ligne. Recréer
 * la commande ferait perdre le numéro TF-xx déjà annoncé au restaurant, et
 * consommerait une seconde fois le code promo. La bascule est faite par la RPC
 * `basculer_en_especes` (SECURITY DEFINER), qui vérifie que la commande est bien
 * celle du client et qu'aucun paiement n'a abouti.
 */
export async function basculerEnEspeces(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('basculer_en_especes', { p_order_id: orderId });
  if (error) throw error;
}
