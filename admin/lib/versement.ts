/**
 * Versements aux restaurants : ce que l'écran lit en base, et les quelques
 * règles d'affichage qui ne doivent pas mentir.
 *
 * ⚠️ Le MONTANT d'un versement ne se calcule pas ici. Il vient de la base,
 * `admin_commandes_a_reverser` (une ligne par commande), la même fonction que
 * `admin_enregistrer_versement` somme pour enregistrer. L'écran affiche ce
 * que la base retient ; il ne recompose rien de son côté.
 *
 * ⚠️ « Envoyé » n'est affiché QUE pour `telegram_statut = 'envoye'`, que seule
 * la fonction Edge écrit, après un `ok: true` de Telegram avec un numéro de
 * message. Tout le reste est dit tel quel : en attente, échec, sans canal.
 */

/** Une commande retenue par un versement, telle que la base la calcule. */
export type CommandeReversee = {
  order_id: string;
  order_number: string | null;
  livree_le: string;
  /** plats + emballage */
  montant: number;
  plats: number;
  emballage: number;
  commission: number;
  /** part offerte par le restaurant (code offert) */
  offert: number;
  net: number;
  /**
   * Cette commande est-elle DÉJÀ rattachée à un reversement ? Lu dans
   * `settlement_orders`, dont la clé primaire est `order_id` : la base rend
   * impossible qu'une commande appartienne à deux reversements. Une commande
   * déjà rattachée reste AFFICHÉE — elle a bien été livrée sur la période —
   * mais elle ne compte plus dans ce qui reste à payer.
   */
  deja_reverse: boolean;
  settlement_id: string | null;
  /** Date du versement qui l'a payée (`paid_at`). */
  reverse_le: string | null;
  reference_versement: string | null;
};

/** Ce qu'un rattachement apprend au rapport sur une commande de la période. */
export type Rattachement = {
  order_id: string;
  order_number: string | null;
  restaurant_id: string;
  settlement_id: string;
  reverse_le: string;
  reference_versement: string | null;
  net: number;
};

/** « Reversé le 20/09 · réf. PP2309 », ou sans la référence quand elle manque. */
export function libelleReverse(c: { reverse_le: string | null; reference_versement: string | null }): string {
  const quand = c.reverse_le
    ? new Date(c.reverse_le).toLocaleDateString('fr-FR', { timeZone: 'Indian/Antananarivo', day: '2-digit', month: '2-digit' })
    : '—';
  return c.reference_versement ? `Reversé le ${quand} · réf. ${c.reference_versement}` : `Reversé le ${quand}`;
}

/** Les deux totaux d'une liste de commandes : ce qui est payé, ce qui reste dû. */
export function totauxListe(commandes: CommandeReversee[]): {
  dejaReverse: number; nbDeja: number; aReverser: number; nbAReverser: number;
} {
  let dejaReverse = 0; let nbDeja = 0; let aReverser = 0; let nbAReverser = 0;
  for (const c of commandes) {
    if (c.deja_reverse) { dejaReverse += c.net; nbDeja += 1; } else { aReverser += c.net; nbAReverser += 1; }
  }
  return { dejaReverse, nbDeja, aReverser, nbAReverser };
}

export type StatutTelegram = 'non_prevu' | 'en_attente' | 'en_cours' | 'envoye' | 'echec' | 'sans_canal';

export type Versement = {
  id: string;
  restaurant_id: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  paid_amount: number | null;
  paid_at: string;
  reference_versement: string | null;
  nb_commandes: number | null;
  numeros_commandes: string[] | null;
  telegram_statut: StatutTelegram;
  telegram_erreur: string | null;
  telegram_envoye_at: string | null;
  telegram_tente_at: string | null;
  telegram_tentatives: number;
};

export const COLONNES_VERSEMENT =
  'id, restaurant_id, period_start, period_end, amount_due, paid_amount, paid_at, reference_versement, '
  + 'nb_commandes, numeros_commandes, telegram_statut, telegram_erreur, telegram_envoye_at, telegram_tente_at, telegram_tentatives';

export const LIBELLE_TELEGRAM: Record<StatutTelegram, string> = {
  non_prevu: 'Aucun message (ancien reversement)',
  en_attente: 'Message pas encore envoyé',
  en_cours: 'Envoi en cours…',
  envoye: 'Message envoyé',
  echec: 'Message NON envoyé',
  sans_canal: 'Pas de groupe Telegram',
};

/** Classe de pastille (voir globals.css) : vert seulement pour « envoyé ». */
export const PASTILLE_TELEGRAM: Record<StatutTelegram, string> = {
  non_prevu: 'sans_objet',
  en_attente: 'demande',
  en_cours: 'demande',
  envoye: 'effectue',
  echec: 'echoue',
  sans_canal: 'sans_objet',
};

/**
 * Le bouton « Renvoyer le message » : après un échec, un envoi jamais parti,
 * un envoi resté « en cours » plus de deux minutes (la base refuse avant), ou
 * un restaurant qui a reçu un groupe depuis. Jamais après un envoi confirmé.
 */
export function peutRenvoyer(v: Versement, maintenant = Date.now()): boolean {
  if (v.telegram_statut === 'echec' || v.telegram_statut === 'en_attente' || v.telegram_statut === 'sans_canal') return true;
  if (v.telegram_statut === 'en_cours') {
    const t = v.telegram_tente_at ? new Date(v.telegram_tente_at).getTime() : 0;
    return maintenant - t > 2 * 60 * 1000;
  }
  return false;
}

/** Deux périodes (dates YYYY-MM-DD, bornes incluses) se recouvrent-elles ? */
export function chevauche(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2;
}

/** « 15/09 → 21/09 », ou une seule date si la période tient en un jour. */
export function libellePeriode(debut: string, fin: string): string {
  const court = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return debut === fin ? `${court(debut)}/${debut.slice(0, 4)}` : `${court(debut)} → ${court(fin)}/${fin.slice(0, 4)}`;
}

/** Date et heure à Nosy Be, quel que soit le fuseau du téléphone. */
export function dateHeureNosyBe(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Indian/Antananarivo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export function dateNosyBe(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Indian/Antananarivo' });
}

/** Référence acceptable côté écran — la base applique la même règle (4 à 64 caractères). */
export function referenceValide(ref: string): boolean {
  const r = ref.trim().replace(/\s+/g, ' ');
  return r.length >= 4 && r.length <= 64;
}

/** Le corps d'erreur d'une fonction Edge n'est pas dans `error.message`. */
export async function lireErreurFonction(e: unknown): Promise<{ statut?: string; erreur: string }> {
  const reponse = (e as { context?: Response })?.context;
  if (reponse && typeof reponse.text === 'function') {
    try {
      const t = await reponse.text();
      try {
        const j = JSON.parse(t) as { statut?: string; erreur?: string };
        return { statut: j.statut, erreur: j.erreur ?? t };
      } catch {
        return { erreur: t };
      }
    } catch { /* message générique ci-dessous */ }
  }
  return { erreur: (e as Error)?.message ?? 'appel impossible' };
}

/**
 * La fiche complète d'une commande, dépliée depuis le détail d'un versement.
 * Lecture seule, par les politiques `*_select_admin using (is_admin())` déjà en
 * place sur `orders`, `order_items`, `order_item_options`, `addresses`,
 * `profiles` et `admin_actions` : aucune fonction ni droit nouveau en base.
 *
 * ⚠️ `unit_price` contient DÉJÀ le prix des options (vérifié en base le
 * 2026-09-22 : Σ quantité × unit_price = subtotal sur les 20 commandes, y
 * compris les 3 à option payante). Ne pas rajouter `price_delta_snapshot`.
 *
 * ⚠️ Heures : la base n'enregistre que la création, la récupération par le
 * livreur et la livraison. « Acceptée » et « en préparation » n'ont aucune
 * colonne ; seuls les changements faits DEPUIS L'ADMIN sont horodatés
 * (`admin_actions`, action `statut_commande`).
 */
export const COLONNES_FICHE =
  'id, order_number, status, created_at, picked_up_at, delivered_at, subtotal, packaging_fee, delivery_fee, '
  + 'promo_code, promo_discount, promo_porte_sur, remise_charge_restaurant, total, payment_method, payment_status, '
  + 'commission_rate, courier_id, '
  + 'profiles ( full_name, phone ), addresses ( label, zone, landmark, phone, instructions ), '
  + 'order_items ( id, product_name_snapshot, quantity, unit_price, comment, '
  + 'order_item_options ( option_name_snapshot, price_delta_snapshot, quantity ) )';

type UnOuListe<T> = T | T[] | null;

export type CommandeFiche = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  subtotal: number;
  packaging_fee: number | null;
  delivery_fee: number;
  promo_code: string | null;
  promo_discount: number | null;
  promo_porte_sur: string | null;
  remise_charge_restaurant: number | null;
  total: number;
  payment_method: string;
  payment_status: string | null;
  /** Fraction 0..1 figée à la livraison ; null si jamais figée. */
  commission_rate: number | null;
  courier_id: string | null;
  profiles: UnOuListe<{ full_name: string | null; phone: string | null }>;
  addresses: UnOuListe<{ label: string | null; zone: string | null; landmark: string | null; phone: string | null; instructions: string | null }>;
  order_items: {
    id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
    comment: string | null;
    order_item_options: { option_name_snapshot: string; price_delta_snapshot: number; quantity: number }[] | null;
  }[] | null;
};

export type ChangementAdmin = { avant: string | null; apres: string | null; created_at: string };

export type FicheLue = {
  commande: CommandeFiche;
  livreur: { full_name: string | null; phone: string | null } | null;
  /** null : journal illisible (on n'affiche alors aucun changement). */
  changementsAdmin: ChangementAdmin[] | null;
};
