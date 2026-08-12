import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';
import { OrderStatus, statusLabel } from '../data/types';

/**
 * Pastille de statut de commande.
 * En cours (reçue → en livraison) = pastille chaude ; Livrée = encre + accent jaune ;
 * Annulée = rouge. Repris de l'écran Historique de la maquette.
 */
export function StatusBadge({ status }: { status: OrderStatus }) {
  const delivered = status === 'livree';
  const cancelled = status === 'annulee';

  const bg = delivered ? colors.ink : cancelled ? colors.dangerBg : colors.warnBg;
  const fg = delivered ? colors.accent : cancelled ? colors.dangerText : colors.warnTextAlt;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.semibold, fontSize: 11 },
});
