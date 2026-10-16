import type { Restaurant } from '../data/types';
import { FUSEAU_NOSY_BE } from './ouverture';

/**
 * Commande programmée, LE JOUR MÊME seulement (2026-10-16).
 *
 * Un restaurant fermé reste commandable s'il rouvre AUJOURD'HUI selon ses horaires :
 * le client choisit alors une heure de livraison au paiement, et la base transmet la
 * commande au restaurant à son ouverture (`commander_programme`, `creneaux_livraison`).
 *
 * L'écran n'est pas l'autorité : la base refuse tout créneau impossible. Ceci sert
 * seulement à ne pas griser un bouton qui marchera.
 */
export function reservableAujourdhui(
  r: Pick<Restaurant, 'isOpen' | 'listingStatus' | 'autoOpen' | 'opensInDays' | 'opensAt'> | null | undefined,
): boolean {
  return (
    !!r &&
    !r.isOpen &&
    r.listingStatus === 'visible' &&
    r.autoOpen &&
    r.opensInDays === 0 &&
    !!r.opensAt
  );
}

/** « 19h00 » (fr), « 19:00 » (en, it), toujours en heure de Nosy Be. */
export function heureNosyBe(iso: string | Date, langue: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  try {
    const parts = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: FUSEAU_NOSY_BE,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return langue.startsWith('fr') ? `${h}h${m}` : `${h}:${m}`;
  } catch {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return langue.startsWith('fr') ? `${h}h${m}` : `${h}:${m}`;
  }
}
