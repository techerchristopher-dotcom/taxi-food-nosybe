/**
 * L'arithmétique du reversement aux restaurants — la seule partie du rapport
 * qui décide d'un virement, donc la seule qui doit pouvoir s'éprouver sans
 * monter React (même parti pris que `remboursement.ts`).
 *
 * ⚠️ Ces formules ne sont pas inventées ici : elles recopient ce que la base
 * calcule déjà. Le dû au restaurant est celui de `record_settlement()` ; la
 * commande fige à sa création sa commission et la part de remise que le
 * restaurant offre de sa poche (`create_order`, colonne
 * `remise_charge_restaurant`). Si l'une change en base, celle-ci doit suivre —
 * sinon « Marquer reversé » proposerait un montant que la base n'enregistre pas.
 *
 * Le piège qui a motivé ce fichier (2026-09-15) : le rapport ignorait
 * `remise_charge_restaurant`. Avec un code offert « repas », « Marquer reversé »
 * aurait proposé de verser au restaurant le repas que ce restaurant venait
 * d'offrir — et l'écart affiché serait resté à 0, parce que l'oubli était le
 * même des deux côtés du compte.
 */

export type CommandeLivree = {
  /** Pour nommer la commande dans une alerte ; absent, l'alerte reste lisible. */
  order_number?: string | null;
  /**
   * Identifiant de la commande. Il sert à savoir si elle est DÉJÀ rattachée à
   * un reversement (`settlement_orders`) : le rapport cesse alors de proposer
   * de la payer. Absent des jeux d'essai, d'où l'optionnel.
   */
  id?: string;
  restaurant_id: string;
  subtotal: number;
  packaging_fee: number | null;
  delivery_fee: number;
  /** Code appliqué, tel que `create_order` l'a figé (`code_normalise`). */
  promo_code: string | null;
  promo_discount: number | null;
  promo_porte_sur: string | null;
  remise_charge_restaurant: number | null;
  total: number;
  commission_amount: number | null;
  /** Taux figé avec la commission : c'est lui, pas le taux actuel, qui l'a produite. */
  commission_rate: number | string | null;
};

/**
 * Ce que le code promo dit de lui-même, lu dans `promo_codes`. Aucune fonction
 * de la base ne modifie ces deux colonnes après la création d'un code (seul
 * `actif` bouge) : c'est une source indépendante des montants figés sur la
 * commande, donc capable de les contredire.
 */
export type RegleDuCode = { pris_en_charge_par: string; porte_sur: string };
export type ReglesDesCodes = ReadonlyMap<string, RegleDuCode>;

export type Ventilation = {
  emballage: number;
  commission: number;
  /** Remise sur la livraison. Toujours payée par Taxi Food : la base l'impose. */
  remiseLivraison: number;
  /** Part de la remise offerte par le restaurant (code offert « repas »). */
  offertRestaurant: number;
  /** Ce qui reste de la remise sur les plats : celle-là, Taxi Food la paie. */
  remisePlatsTaxiFood: number;
  /** Ce que la base doit au restaurant pour cette commande. */
  du: number;
  /** Ce qui reste à Taxi Food, calculé par SES propres termes, jamais par différence. */
  marge: number;
  /** Ce qui cloche sur cette commande, en clair. Vide = rien à signaler. */
  anomalies: string[];
  /** Au moins une anomalie : le reversement ne doit pas partir les yeux fermés. */
  incoherente: boolean;
};

/**
 * `round((base) * taux)` de Postgres, sans l'erreur des flottants : 0,05 n'a pas
 * d'écriture binaire exacte, et un `617,4999…` arrondi à 617 là où la base écrit
 * 618 lèverait une fausse alerte de commission. Le taux est ramené en
 * dix-millièmes (précision des taux saisis) et l'arrondi se fait en entiers ;
 * au-delà de cette précision, on retombe sur l'arrondi flottant.
 */
export function arrondiCommission(base: number, taux: number): number {
  const dixMillemes = Math.round(taux * 10000);
  if (Math.abs(dixMillemes / 10000 - taux) > 1e-9) return Math.round(base * taux);
  const brut = base * dixMillemes;
  // Postgres arrondit le demi en s'éloignant de zéro, y compris sous zéro.
  return Math.sign(brut) * Math.floor((Math.abs(brut) + 5000) / 10000);
}

/**
 * Les règles de commission que la base a réellement figées, de la plus ancienne
 * à l'actuelle (migrations du 2026-09-05, du 2026-09-09 et du 2026-09-14) : plats
 * seuls, puis plats + emballage, puis plats + emballage moins la part offerte,
 * plancher à 0. Les anciennes restent admises : TF-161 et TF-162 portent encore
 * la première, et les rejeter lèverait une alerte sur des commandes justes.
 */
function commissionsAdmises(c: CommandeLivree, taux: number, offertRestaurant: number): number[] {
  const emballage = c.packaging_fee ?? 0;
  return [
    arrondiCommission(c.subtotal, taux),
    arrondiCommission(c.subtotal + emballage, taux),
    Math.max(arrondiCommission(c.subtotal + emballage - offertRestaurant, taux), 0),
  ];
}

export function ventiler(c: CommandeLivree, tauxRestaurant: number, regles: ReglesDesCodes): Ventilation {
  const emballage = c.packaging_fee ?? 0;
  const remise = c.promo_discount ?? 0;
  const offertRestaurant = c.remise_charge_restaurant ?? 0;

  // Une remise ne se soustrait pas au même endroit selon ce qu'elle couvre :
  // sur la livraison, elle ampute la livraison encaissée ; sur les plats, elle
  // est payée soit par le restaurant (sa part est figée sur la commande), soit
  // par Taxi Food pour le reste.
  const remiseLivraison = c.promo_porte_sur === 'livraison' ? remise : 0;
  const remisePlatsTaxiFood = remise - remiseLivraison - offertRestaurant;

  // La commission MÉMORISÉE prime : c'est le montant convenu le jour de la
  // commande. Le calcul de secours est celui de `record_settlement` à l'octet
  // près — taux ACTUEL du restaurant, sur plats + emballage moins la part
  // offerte, plancher à 0. Aucune commande livrée n'en a besoin aujourd'hui.
  const commission = c.commission_amount
    ?? Math.max(arrondiCommission(c.subtotal + emballage - offertRestaurant, tauxRestaurant), 0);

  // Le client n'a pas payé la part offerte par le restaurant : il n'y a rien à
  // lui reverser pour elle.
  const du = c.subtotal + emballage - commission - offertRestaurant;

  // La part offerte par le restaurant ne touche PAS cette marge : seule la
  // remise que Taxi Food finance en sort.
  const marge = commission + c.delivery_fee - remiseLivraison - remisePlatsTaxiFood;

  // Contrôles par commande. `remise_charge_restaurant` et `commission_amount`
  // entrent à la fois dans le dû et dans la marge : faussés, ils déplacent de
  // l'argent entre les deux sans que l'écart global ne bouge (voir
  // `ecartCaisse`). On les confronte donc à ce qui ne dépend pas d'eux : la
  // règle du code dans `promo_codes`, et les formules de commission de la base.
  const anomalies: string[] = [];

  // Remise positive sans code : `create_order` ne pose jamais l'une sans l'autre.
  if (remise > 0 && !c.promo_code) {
    anomalies.push(`remise de ${remise} Ar sans code promo`);
  }
  if (c.promo_code) {
    const regle = regles.get(c.promo_code);
    if (!regle) {
      anomalies.push(`code ${c.promo_code} introuvable : impossible de savoir qui paie la remise`);
    } else {
      // `create_order` : la part du restaurant vaut toute la remise si le code
      // est à sa charge, zéro sinon. Pas d'entre-deux.
      const attendu = regle.pris_en_charge_par === 'restaurant' ? remise : 0;
      if (offertRestaurant !== attendu) {
        anomalies.push(
          `part offerte par le restaurant ${offertRestaurant} Ar, alors que le code ${c.promo_code} `
          + `(payé par ${regle.pris_en_charge_par === 'restaurant' ? 'le restaurant' : 'Taxi Food'}) en donne ${attendu}`,
        );
      }
      if (c.promo_porte_sur !== regle.porte_sur) {
        anomalies.push(`remise enregistrée sur « ${c.promo_porte_sur ?? '—'} », le code ${c.promo_code} porte sur « ${regle.porte_sur} »`);
      }
    }
  }
  // Ces deux-là valent aussi sans code : une part offerte sortie de nulle part.
  if (remisePlatsTaxiFood < 0) {
    anomalies.push(`part offerte par le restaurant (${offertRestaurant} Ar) supérieure à la remise sur les plats`);
  }
  if (du < 0) {
    anomalies.push(`dû négatif (${du} Ar)`);
  }
  // Commission figée confrontée au taux figé avec elle. Sans l'un des deux, la
  // base elle-même retombe sur le calcul de secours : rien à confronter.
  const tauxFige = c.commission_rate === null ? NaN : Number(c.commission_rate);
  if (c.commission_amount !== null && Number.isFinite(tauxFige)
      && !commissionsAdmises(c, tauxFige, offertRestaurant).includes(c.commission_amount)) {
    anomalies.push(`commission ${c.commission_amount} Ar : ne correspond à aucune règle de la base au taux ${tauxFige}`);
  }

  return {
    emballage,
    commission,
    remiseLivraison,
    offertRestaurant,
    remisePlatsTaxiFood,
    du,
    marge,
    anomalies,
    incoherente: anomalies.length > 0,
  };
}

/** Ce que le contrôle d'écart lit dans les totaux du rapport. */
export type TotauxCaisse = {
  encaisse: number;
  /** Dû aux restaurants, formule de `record_settlement`. */
  net: number;
  commission: number;
  deliveryBrut: number;
  remiseLivraison: number;
  /** Remises sur les plats payées par TAXI FOOD — la part du restaurant n'y est pas. */
  remisePlats: number;
};

/** Les totaux d'un restaurant, ou de toute la période. */
export type Cumul = TotauxCaisse & {
  count: number;
  caPlats: number;
  emballages: number;
  offertRestaurant: number;
  /** Livraison réellement encaissée : brute moins les remises portant dessus. */
  deliveryFees: number;
  /** Commandes dont la ventilation est douteuse (voir `Ventilation.anomalies`). */
  incoherentes: number;
  /** Une ligne par commande douteuse, numéro en tête : ce qu'il faut aller vérifier. */
  aVerifier: string[];
};

export const CUMUL_VIDE: Cumul = {
  count: 0, encaisse: 0, caPlats: 0, emballages: 0, commission: 0, offertRestaurant: 0, net: 0,
  deliveryBrut: 0, deliveryFees: 0, remiseLivraison: 0, remisePlats: 0, incoherentes: 0, aVerifier: [],
};

/** Ajoute une commande livrée à un cumul. Seul chemin d'une commande vers le rapport. */
export function cumulerCommande(t: Cumul, c: CommandeLivree, tauxRestaurant: number, regles: ReglesDesCodes): Cumul {
  const v = ventiler(c, tauxRestaurant, regles);
  return {
    count: t.count + 1,
    encaisse: t.encaisse + c.total,
    caPlats: t.caPlats + c.subtotal,
    emballages: t.emballages + v.emballage,
    commission: t.commission + v.commission,
    offertRestaurant: t.offertRestaurant + v.offertRestaurant,
    net: t.net + v.du,
    deliveryBrut: t.deliveryBrut + c.delivery_fee,
    deliveryFees: t.deliveryFees + c.delivery_fee - v.remiseLivraison,
    remiseLivraison: t.remiseLivraison + v.remiseLivraison,
    remisePlats: t.remisePlats + v.remisePlatsTaxiFood,
    incoherentes: t.incoherentes + (v.incoherente ? 1 : 0),
    aVerifier: v.incoherente
      ? [...t.aVerifier, `${c.order_number ?? 'Commande sans numéro'} : ${v.anomalies.join(' ; ')}`]
      : t.aVerifier,
  };
}

export function additionnerCumuls(a: Cumul, b: Cumul): Cumul {
  return {
    count: a.count + b.count,
    encaisse: a.encaisse + b.encaisse,
    caPlats: a.caPlats + b.caPlats,
    emballages: a.emballages + b.emballages,
    commission: a.commission + b.commission,
    offertRestaurant: a.offertRestaurant + b.offertRestaurant,
    net: a.net + b.net,
    deliveryBrut: a.deliveryBrut + b.deliveryBrut,
    deliveryFees: a.deliveryFees + b.deliveryFees,
    remiseLivraison: a.remiseLivraison + b.remiseLivraison,
    remisePlats: a.remisePlats + b.remisePlats,
    incoherentes: a.incoherentes + b.incoherentes,
    aVerifier: [...a.aVerifier, ...b.aVerifier],
  };
}

/** Ta marge : commission + livraison facturée − remises que Taxi Food finance. */
export function margeTaxiFood(t: TotauxCaisse): number {
  return t.commission + t.deliveryBrut - t.remiseLivraison - t.remisePlats;
}

/**
 * Encaissé − reversé − marge. Doit valoir 0.
 *
 * Pourquoi ce n'est pas une tautologie : la marge n'est jamais calculée comme
 * « encaissé − reversé ». Développé, l'écart vaut
 *     Σ total − Σ (plats + emballage + livraison − remise)
 * où `total` est lu tel que la base l'a facturé, et le reste recomposé à partir
 * des lignes. Il se déclenche si une commande porte un total qui ne retombe pas
 * sur ses composantes (frais ajoutés au total que ce rapport ne connaît pas,
 * retouche manuelle du total, des plats, de l'emballage, de la livraison ou de
 * la remise).
 *
 * Ce qu'il NE PEUT PAS voir, par construction : `remise_charge_restaurant` et
 * `commission_amount` s'annulent dans ce développement. Faussés en base, ils
 * font proposer un mauvais dû — au rapport comme à `record_settlement` — avec un
 * écart à 0. Ces deux champs sont contrôlés ailleurs, commande par commande,
 * contre des sources qui ne dépendent pas d'eux (`ventiler`, liste `anomalies`).
 * Restent hors d'atteinte : une commission retouchée qui tomberait pile sur une
 * ancienne règle, et un code dont on aurait changé le payeur à la main en SQL.
 */
export function ecartCaisse(t: TotauxCaisse): number {
  return t.encaisse - t.net - margeTaxiFood(t);
}

/**
 * Bornes d'une période en heure de Nosy Be (UTC+3, sans heure d'été), fin
 * EXCLUE. `record_settlement` compare des dates entières : « au 14 » veut dire
 * jusqu'au 15 à 00:00, microsecondes comprises — un `<= 23:59:59.999` en
 * laissait tomber.
 */
export function bornesPeriode(debut: string, fin: string): { debut: string; finExclue: string } {
  const [a, m, j] = fin.split('-').map(Number);
  const lendemain = new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
  return { debut: `${debut}T00:00:00+03:00`, finExclue: `${lendemain}T00:00:00+03:00` };
}
