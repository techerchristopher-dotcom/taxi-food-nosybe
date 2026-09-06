/** Formatage Ariary (ex. 25 000 Ar) — espace fine comme séparateur de milliers. */
export function formatAr(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  return `${v.toLocaleString('fr-FR').replace(/ /g, ' ')} Ar`;
}

export const STATUS_LABEL: Record<string, string> = {
  recue: 'Reçue',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export const PAYMENT_LABEL: Record<string, string> = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  cb: 'Carte',
};

/** Minutes écoulées depuis un ISO. */
export function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

/** Heure locale courte « 18h44 ». */
export function timeLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Date du jour au format YYYY-MM-DD dans le fuseau de Nosy Be (UTC+3). */
export function todayNosyBe(): string {
  const now = new Date();
  const nosy = new Date(now.getTime() + (now.getTimezoneOffset() + 180) * 60000);
  return nosy.toISOString().slice(0, 10);
}

/** Statut du PAIEMENT d'une commande (à ne pas confondre avec son statut de préparation). */
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  non_requis: 'Sans paiement en ligne',
  en_attente: 'Paiement en attente',
  paye: 'Payée',
  echoue: 'Paiement échoué',
  rembourse: 'Remboursée',
};

export const REFUND_STATUS_LABEL: Record<string, string> = {
  demande: 'Demandé',
  effectue: 'Effectué',
  echoue: 'Échoué',
  sans_objet: 'Sans objet',
};

/**
 * Montant en centimes → « 3,41 € ».
 *
 * Les prix du catalogue sont en ariary, mais Stripe ne connaît que l'euro : un
 * remboursement se raisonne, se saisit et se contrôle dans la devise réellement
 * débitée. Convertir pour l'affichage ferait apparaître un montant que la banque
 * du client n'a jamais vu.
 */
export function formatEur(centimes: number | null | undefined, devise = 'eur'): string {
  const v = Number(centimes ?? 0) / 100;
  try {
    return v.toLocaleString('fr-FR', { style: 'currency', currency: devise.toUpperCase() });
  } catch {
    // Devise inconnue d'Intl : mieux vaut un montant brut qu'une exception.
    return `${v.toFixed(2)} ${devise.toUpperCase()}`;
  }
}

/** PostgREST renvoie un embed to-one comme objet, mais son typage suppose un tableau. */
export function un<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
