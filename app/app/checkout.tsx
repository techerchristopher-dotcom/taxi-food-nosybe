import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Avatar, Card, Divider, InfoBanner, SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, formatAr, radius, spacing } from '../theme/tokens';
import { PaymentMethod, paymentShort } from '../data/types';
import { createOrder, listAddresses } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';

const METHODS: { key: PaymentMethod; icon: string; iconColor: string; title: string; sub: string }[] = [
  { key: 'cb', icon: 'credit_card', iconColor: colors.textDark, title: 'Carte bancaire', sub: 'Terminal du livreur' },
  { key: 'especes', icon: 'payments', iconColor: colors.textDark, title: 'Espèces', sub: "Prévoir l'appoint si possible" },
  { key: 'orange_money', icon: 'smartphone', iconColor: colors.secondary, title: 'Orange Money', sub: 'Transfert au livreur' },
];

/** Écran 07 — Validation de la commande (récap + choix du paiement). */
export default function CheckoutScreen() {
  const router = useRouter();

  const lines = useCart((s) => s.lines);
  const restaurantId = useCart((s) => s.restaurantId);
  const restaurantName = useCart((s) => s.restaurantName);
  const restaurantInitials = useCart((s) => s.restaurantInitials);
  const total = useCart((s) => s.total());
  const clear = useCart((s) => s.clear);

  const addressId = useCheckout((s) => s.addressId);
  const paymentMethod = useCheckout((s) => s.paymentMethod);
  const setPayment = useCheckout((s) => s.setPayment);

  const { data: addresses } = useLoad(() => listAddresses(), []);
  const address = addresses?.find((a) => a.id === addressId) ?? null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validate() {
    if (!restaurantId || !addressId) {
      setError('Choisis une adresse de livraison avant de valider.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const order = await createOrder({
        restaurantId,
        addressId,
        paymentMethod,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          comment: l.comment,
        })),
      });
      clear();
      router.replace(`/confirmation?orderId=${order.id}`);
    } catch {
      setError("La commande n'a pas pu être créée. Réessaie.");
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title="Valider ma commande" />

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.restoRow}>
            <Avatar initials={restaurantInitials || '--'} size={36} r={10} />
            <Text style={styles.restoName}>{restaurantName}</Text>
          </View>
          <Divider style={{ marginVertical: 14 }} />
          {lines.map((l) => (
            <View key={l.product.id} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {l.quantity} × {l.product.name}
              </Text>
              <Text style={styles.itemPrice}>{formatAr(l.product.price * l.quantity)}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.addrCard}>
          <Icon name="location_on" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            {address ? (
              <>
                <Text style={styles.addrLabel}>
                  {address.zone} — {address.label.split('—').pop()?.trim()}
                </Text>
                <Text style={styles.addrDetail}>
                  {address.landmark} · {address.phone}
                </Text>
              </>
            ) : (
              <Text style={styles.addrLabel}>Aucune adresse sélectionnée</Text>
            )}
          </View>
          <Pressable onPress={() => router.push('/address')}>
            <Text style={styles.modify}>Modifier</Text>
          </Pressable>
        </Card>

        <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>Mode de paiement</SectionLabel>
        <View style={{ gap: 10 }}>
          {METHODS.map((m) => {
            const active = m.key === paymentMethod;
            return (
              <Pressable
                key={m.key}
                onPress={() => setPayment(m.key)}
                style={[styles.payRow, { borderColor: active ? colors.primary : colors.border }]}
              >
                <Icon name={m.icon} size={24} color={m.iconColor} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payTitle}>{m.title}</Text>
                  <Text style={styles.paySub}>{m.sub}</Text>
                </View>
                <Icon
                  name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                  size={22}
                  color={active ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 14 }}>
          <InfoBanner>Paiement à la livraison — aucun débit maintenant.</InfoBanner>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BottomBar>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total à payer ({paymentShort(paymentMethod)})</Text>
          <Text style={styles.totalValue}>{formatAr(total)}</Text>
        </View>
        <Button label="Valider la commande" icon="check_circle" onPress={validate} loading={submitting} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  restoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restoName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  itemPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  addrCard: { marginTop: 12, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  addrDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
  modify: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  payRow: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  paySub: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  totalLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
});
