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
