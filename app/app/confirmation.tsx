import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../theme/tokens';
import { paymentLabel, PaymentMethod } from '../data/types';
import { getOrderById } from '../data/api';
import { useLoad } from '../lib/useLoad';

/** Écran 08 — Confirmation de commande. */
export default function ConfirmationScreen() {
  // orderId sert au suivi et au refetch ; total/orderNumber/payment viennent de la RPC
  // (source autoritative) pour un affichage immédiat sans attendre le refetch.
  const params = useLocalSearchParams<{
    orderId: string;
    orderNumber?: string;
    total?: string;
    payment?: PaymentMethod;
  }>();
  const orderId = params.orderId;
  const passedTotal = params.total ? Number(params.total) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: order } = useLoad(() => getOrderById(orderId!), [orderId]);

  const displayTotal = order?.total ?? passedTotal ?? 0;
  const displayNumber = order?.orderNumber ?? params.orderNumber ?? 'TF-••••';
  const displayPayment = order?.paymentMethod ?? params.payment ?? 'especes';

  return (
    <LinearGradient
      colors={[colors.primary, colors.secondary, colors.accent]}
      locations={[0, 0.62, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={styles.container}
    >
      <View style={{ flex: 1, paddingTop: insets.top, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        <View style={styles.checkOuter}>
          <View style={styles.checkInner}>
            <Icon name="check" size={44} color={colors.success} />
          </View>
        </View>
        <Text style={styles.title}>Commande{'\n'}envoyée !</Text>
        <Text style={styles.subtitle}>
          {order?.restaurantName ?? 'Le restaurant'} a reçu votre commande. Vous serez notifié à chaque étape.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.cardLabel}>Commande</Text>
            <Text style={styles.orderNumber}>#{displayNumber}</Text>
          </View>
          <View style={styles.cardDivider} />
          <Detail label="Montant" value={formatAr(displayTotal)} valueColor={colors.primary} />
          <Detail
            label="Paiement"
            value={`${paymentLabel(displayPayment)} — à la livraison`}
          />
          {order?.etaLabel ? <Detail label="Livraison estimée" value={order.etaLabel} /> : null}
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
        <ActionButton
          dark
          icon="local_shipping"
          label="Suivre ma commande"
          // On navigue avec l'orderId reçu en param (toujours défini), pas `order?.id`
          // qui est null tant que le refetch n'a pas répondu → évitait « introuvable ».
          onPress={() => orderId && router.replace(`/order/${orderId}`)}
        />
        <ActionButton label="Retour à l'accueil" onPress={() => router.replace('/(tabs)')} />
      </View>
    </LinearGradient>
  );
}

function Detail({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={[styles.cardRow, { marginTop: 10 }]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor, fontFamily: fonts.bold } : null]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  dark,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  dark?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        dark ? styles.actionDark : styles.actionGlass,
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.actionInner}>
        {icon ? <Icon name={icon} size={20} color={colors.accent} /> : null}
        <Text style={styles.actionLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  checkOuter: {
    width: 104,
    height: 104,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: colors.white,
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 280,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 18,
    marginTop: 26,
    ...shadow.floating,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  orderNumber: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.ink },
  cardDivider: { height: 1, backgroundColor: colors.divider, marginVertical: 14 },
  detailLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  detailValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  actions: { paddingHorizontal: 24, gap: 10 },
  actionBtn: { height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  actionDark: { backgroundColor: colors.ink },
  actionGlass: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  actionInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
});
