import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Card, Divider, SectionLabel } from '../../components/primitives';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import { paymentShort, statusStep } from '../../data/mock';
import { useOrders } from '../../store/orders';

/**
 * Écran 09 — Suivi de commande (timeline 5 statuts).
 * Les étapes sont cliquables pour illustrer la progression (démo, comme la maquette).
 * En production, l'étape courante sera pilotée par orders.status (back-office).
 */
const STEPS = [
  { icon: 'inbox', title: 'Commande reçue', sub: 'Transmise au restaurant', head: 'Le restaurant va confirmer dans un instant' },
  { icon: 'restaurant', title: 'Confirmée par le restaurant', sub: 'Préparation dans ~20 min', head: 'Préparation dans environ 20 minutes' },
  { icon: 'soup_kitchen', title: 'En préparation', sub: 'En cuisine', head: 'Votre commande est en préparation' },
  { icon: 'two_wheeler', title: 'En livraison', sub: 'Le livreur arrive · +261 33 12 345 67', head: 'Arrivée estimée bientôt' },
  { icon: 'check_circle', title: 'Livrée', sub: 'Paiement au livreur', head: 'Bon appétit ! Merci pour votre commande' },
] as const;

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const order = useOrders((s) => s.getById(id!));

  const [step, setStep] = useState(order ? statusStep(order.status) : 0);

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Commande introuvable.</Text>
      </View>
    );
  }

  const head = STEPS[step];

  return (
    <View style={styles.container}>
      {/* En-tête sombre */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Icon name="arrow_back" size={22} color={colors.white} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Commande #{order.orderNumber}</Text>
            <Text style={styles.headerSub}>
              {order.restaurantName} · {order.createdLabel}
            </Text>
          </View>
        </View>
        <View style={styles.statusBanner}>
          <Icon name={head.icon} size={26} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{head.title}</Text>
            <Text style={styles.statusSub}>{head.head}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Timeline */}
        <Card style={{ paddingBottom: 6 }}>
          {STEPS.map((s, i) => {
            const done = i <= step;
            const current = i === step;
            const isLast = i === STEPS.length - 1;
            const sub =
              i === 4 ? `Paiement en ${paymentShort(order.paymentMethod)} au livreur` : s.sub;
            return (
              <Pressable key={i} onPress={() => setStep(i)} style={styles.stepRow}>
                <View style={styles.stepMarker}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: done ? (current ? colors.primary : colors.success) : colors.photoGrayA,
                      },
                      current && styles.dotGlow,
                    ]}
                  >
                    {done ? <Icon name="check" size={16} color={colors.white} /> : null}
                  </View>
                  {!isLast ? (
                    <View style={[styles.line, { backgroundColor: i < step ? colors.success : colors.photoGrayA }]} />
                  ) : null}
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepSub}>{sub}</Text>
                </View>
              </Pressable>
            );
          })}
        </Card>

        {/* Récapitulatif */}
        <Card style={{ marginTop: 14 }}>
          <SectionLabel style={{ marginBottom: 12 }}>Récapitulatif</SectionLabel>
          {order.items.map((it) => (
            <View key={it.productId} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {it.quantity} × {it.name}
              </Text>
              <Text style={styles.itemPrice}>{formatAr(it.unitPrice * it.quantity)}</Text>
            </View>
          ))}
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>Frais de livraison</Text>
            <Text style={styles.itemPrice}>{formatAr(order.deliveryFee)}</Text>
          </View>
          <Divider style={{ marginVertical: 12 }} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total · {paymentShort(order.paymentMethod)}</Text>
            <Text style={styles.totalValue}>{formatAr(order.total)}</Text>
          </View>
          <View style={styles.addrRow}>
            <Icon name="location_on" size={20} color={colors.primary} />
            <Text style={styles.addrText}>
              {order.addressLabel} — {order.addressDetail}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.semibold, color: colors.textMuted },
  header: { backgroundColor: colors.ink, paddingHorizontal: spacing.screen, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.white },
  headerSub: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 5 },
  statusBanner: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  statusSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: 'rgba(255,255,255,0.65)', marginTop: 3 },
  stepRow: { flexDirection: 'row', gap: 14 },
  stepMarker: { alignItems: 'center' },
  dot: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dotGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.16,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    borderWidth: 5,
    borderColor: 'rgba(232,52,42,0.16)',
  },
  line: { width: 2, flex: 1, minHeight: 26, marginVertical: 2 },
  stepBody: { paddingBottom: 18, flex: 1 },
  stepTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  stepSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 3 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  itemPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.primary },
  addrRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignItems: 'flex-start',
  },
  addrText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textDark },
});
