import { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';
import { Card, Divider } from './primitives';
import { colors, fonts, formatAr, radius } from '../theme/tokens';
import { Order, paymentLabel } from '../data/types';

/**
 * Carte commande côté restaurant : détail complet (articles, options, total, paiement,
 * position GPS du client). Réutilisée par « Commandes en cours » (avec des actions dans
 * `footer`) et par l'« Historique » (lecture seule, `footer` absent).
 */
export function RestaurantOrderCard({ order, footer }: { order: Order; footer?: ReactNode }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.number}>#{order.orderNumber}</Text>
          <Text style={styles.time}>{order.createdLabel}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      <Divider style={{ marginVertical: 12 }} />

      {order.items.map((it, i) => (
        <View key={i} style={styles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>
              {it.quantity} × {it.name}
            </Text>
            {it.options && it.options.length > 0 ? (
              <Text style={styles.itemOptions}>{it.options.map((o) => o.name).join(', ')}</Text>
            ) : null}
          </View>
          <Text style={styles.itemPrice}>{formatAr(it.unitPrice * it.quantity)}</Text>
        </View>
      ))}

      <View style={[styles.itemRow, { marginTop: 2 }]}>
        <Text style={styles.subLabel}>Frais de livraison</Text>
        <Text style={styles.subValue}>{formatAr(order.deliveryFee)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total · {paymentLabel(order.paymentMethod)}</Text>
        <Text style={styles.totalValue}>{formatAr(order.total)}</Text>
      </View>

      {/* Position du client : bloc GPS + contact. Pas d'adressage postal à Nosy Be. */}
      <View style={styles.addrBlock}>
        <View style={styles.addrRow}>
          <Icon name="location_on" size={18} color={colors.primary} />
          <Text style={styles.addrText}>
            {order.addressLabel}
            {order.addressDetail ? ` — ${order.addressDetail}` : ''}
          </Text>
        </View>
        <View style={styles.addrActions}>
          {order.mapsUrl ? (
            <Pressable style={styles.chip} onPress={() => Linking.openURL(order.mapsUrl!)}>
              <Icon name="map" size={16} color={colors.ink} />
              <Text style={styles.chipText}>Itinéraire</Text>
            </Pressable>
          ) : (
            <Text style={styles.noGps}>Position GPS manquante</Text>
          )}
          {order.clientPhone ? (
            <Pressable style={styles.chip} onPress={() => Linking.openURL(`tel:${order.clientPhone}`)}>
              <Icon name="call" size={16} color={colors.ink} />
              <Text style={styles.chipText}>{order.clientPhone}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {order.status === 'annulee' && order.cancellationReason ? (
        <View style={styles.reason}>
          <Icon name="info" size={16} color={colors.dangerText} />
          <Text style={styles.reasonText}>Refusée : {order.cancellationReason}</Text>
        </View>
      ) : null}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  number: { fontFamily: fonts.monoBold, fontSize: 16, color: colors.ink },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 3 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  itemName: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDark },
  itemOptions: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
  itemPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  subLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  subValue: { fontFamily: fonts.regular, fontSize: 12, color: colors.textDark },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  totalLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
  addrBlock: { marginTop: 12, gap: 8 },
  addrRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  addrText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textDark },
  addrActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  noGps: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText },
  reason: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    borderRadius: radius.tile,
    backgroundColor: colors.dangerBg,
  },
  reasonText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText },
  footer: { marginTop: 14, gap: 10 },
});
