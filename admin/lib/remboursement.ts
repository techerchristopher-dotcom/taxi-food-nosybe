/**
 * L'arithmétique d'un remboursement — la seule partie de l'écran qui engage de
 * l'argent, donc la seule qui doit pouvoir s'éprouver sans monter React.
 *
 * ⚠️ Ces règles ne sont pas inventées ici : elles recopient ce que la base impose
 * déjà (`verifier_plafond_remboursement()` et `demander_remboursement()`). Le
 * but n'est pas de contrôler à sa place — elle reste la barrière — mais de ne
 * jamais afficher un montant qu'elle refuserait.
 */

export type PaiementCapture = {
  id: string;
  amount_minor: number;
  amount_ar: number;
  fx_rate: number;
};

export type RemboursementLigne = {
  payment_intent_id: string;
  status: string;
  amount_minor: number;
  /**
   * Le `re_...` rendu par Stripe. C'est LA marque que l'appel est parti : tant
   * qu'il est nul, l'argent n'a pas bougé. Facultatif ici parce que
   * l'arithmétique du solde n'en a pas besoin — `envoiBloque()`, si.
   */
  provider_refund_id?: string | null;
  created_at?: string;
};

/** Ce que la base autorise encore sur un paiement donné. */
export type Solde = {
  rendu: number;        // remboursements `effectue`
  enVol: number;        // remboursements `demande`, pas encore tranchés
  reste: number;        // ce qu'on peut encore demander
  enCours: boolean;     // une demande occupe la place : la base en refusera une seconde
};

export function soldeDe(intent: PaiementCapture, refunds: RemboursementLigne[]): Solde {
  const miens = refunds.filter((r) => r.payment_intent_id === intent.id);
  const somme = (s: string) =>
    miens.filter((r) => r.status === s).reduce((t, r) => t + r.amount_minor, 0);
  // `echoue` et `sans_objet` ne consomment rien : la base ne les compte pas non
  // plus dans son plafond. Un échec veut dire « le client n'a rien reçu », il
  // doit rester remboursable.
  const rendu = somme('effectue');
  const enVol = somme('demande');
  return {
    rendu,
    enVol,
    reste: intent.amount_minor - rendu - enVol,
    enCours: miens.some((r) => r.status === 'demande'),
  };
}

/**
 * L'équivalent ariary de ce qui va être rendu — recopié à l'identique de
 * `demander_remboursement()`. Sur un remboursement total on reprend l'ariary du
 * paiement au lieu de le recalculer : `montant_eur_centimes` arrondit au
 * supérieur, donc le chemin retour (341 × 4700 / 100 = 16 027) ne retombe pas
 * sur les 16 000 Ar d'origine. Un écran qui annoncerait 16 027 mentirait.
 */
export function arRendu(intent: PaiementCapture, montantMinor: number): number {
  if (montantMinor === intent.amount_minor) return intent.amount_ar;
  return Math.max(Math.round((montantMinor * Number(intent.fx_rate)) / 100), 1);
}

/**
 * Une demande partie chez Stripe, ou une demande qui n'est jamais partie ?
 *
 * ⚠️ CETTE DISTINCTION EST LA DIFFÉRENCE ENTRE ATTENDRE ET AGIR, et l'écran ne
 * la faisait pas : toute demande en `demande` s'affichait « en attente du
 * verdict de Stripe », y compris celle dont l'appel n'a jamais quitté la base.
 * Le soir du 6 septembre, TF-96 était exactement dans ce cas depuis une heure.
 *
 * Ce qui peut bloquer un envoi, sans que personne ne le sache : Stripe
 * injoignable, la fonction Edge en erreur, le secret du Vault absent, une
 * requête `pg_net` perdue. Dans tous ces cas la base garde la demande en vol —
 * c'est voulu, la marquer `echoue` dirait à tort que la banque a refusé — mais
 * rien ne la relance : ce projet n'a pas d'ordonnanceur (pg_cron n'y est pas
 * installé). La relance est donc un geste humain, et il faut d'abord voir quoi
 * relancer.
 *
 * Le critère est le `re_...` : Stripe le rend au premier appel réussi, et
 * `enregistrer_envoi_remboursement()` l'écrit avant que la fonction ne réponde.
 * Nul = l'argent n'a pas bougé.
 *
 * Le délai de grâce évite d'alarmer sur la seconde qui suit une annulation,
 * pendant laquelle l'aller-retour est parfaitement normal.
 */
export function envoiBloque(
  refund: RemboursementLigne,
  maintenant: number = Date.now(),
  graceMs = 120_000,
): boolean {
  if (refund.status !== 'demande') return false;
  if (refund.provider_refund_id) return false;
  if (!refund.created_at) return true;
  return maintenant - new Date(refund.created_at).getTime() > graceMs;
}

/** « 3,41 » ou « 3.41 » → 341 centimes. NaN si la saisie n'est pas un montant. */
export function enCentimes(saisie: string): number {
  const v = Number.parseFloat(saisie.replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(v) ? Math.round(v * 100) : Number.NaN;
}

