import i18n from 'i18next';
import { REFUSAL_CODES, type Order } from '../data/types';

/**
 * Motif de refus tel que le CLIENT doit le lire, dans la langue de l'app.
 *
 * - Refus avec code (2026-10-05) : libellé traduit (`refusal.codes.*`) + précision libre du
 *   restaurant, jamais traduite. Pour « autre », la précision seule si elle existe.
 * - Refus ancien, annulation admin : `cancellation_reason` tel qu'il est en base.
 *
 * Même règle que `motifRefus()` de `supabase/functions/notify-order` (notification push).
 */
export function motifRefusAffiche(
  order: Pick<Order, 'cancellationReason' | 'cancellationCode' | 'cancellationDetail'>,
): string | null {
  const code = order.cancellationCode;
  if (!code || !(REFUSAL_CODES as readonly string[]).includes(code)) {
    return order.cancellationReason ?? null;
  }
  const detail = order.cancellationDetail?.trim();
  const label = i18n.t(`refusal.codes.${code}`);
  if (code === 'autre') return detail || label;
  return detail ? i18n.t('refusal.withDetail', { label, detail }) : label;
}
