import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Avatar, Card, Divider, InfoBanner, SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, formatAr, radius, spacing } from '../theme/tokens';
import { formatAddressLine, PaymentMethod, paymentShort } from '../data/types';
import { createOrder, listAddresses } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { lineUnitPrice, useCart } from '../store/cart';
import { useCheckout } from '../store/checkout';
import { useSession } from '../store/session';
import { useAuthIntent } from '../store/authIntent';

const METHODS: { key: PaymentMethod; icon: string; iconColor: string; subKey: string }[] = [
  { key: 'cb', icon: 'credit_card', iconColor: colors.textDark, subKey: 'checkout.cbSub' },
  { key: 'especes', icon: 'payments', iconColor: colors.textDark, subKey: 'checkout.especesSub' },
  { key: 'orange_money', icon: 'smartphone', iconColor: colors.secondary, subKey: 'checkout.orangeSub' },
];

/**
 * GARDE DU TUNNEL DE COMMANDE, second verrou.
 *
 * `app/address.tsx` porte le verrou principal et prétendait couvrir « tout chemin vers le
 * paiement, lien profond compris ». C'était faux : le schéma `taxifood` est déclaré et
 * expo-router expose chaque fichier de route, donc `taxifood:///checkout` ouvrait le
 * récapitulatif, le choix du paiement et le bouton « Valider » à quelqu'un sans compte.
 * Le dégât restait contenu (`useCheckout` vit en mémoire : `addressId` vaut null au
 * démarrage à froid, et `validate()` s'arrêtait sur « adresse manquante »), mais le message
 * parlait d'adresse là où il fallait proposer un compte.
 *
 * Deux cas, deux sorties :
 *  - pas de compte → connexion, avec `/address` en retour (l'écran qui vient juste avant) ;
 *  - compte mais aucune adresse choisie → `/address`, qui est précisément l'étape sautée.
 *
 * Composant séparé, comme dans `address.tsx` : les hooks du récapitulatif — dont
 * `useLoad(listAddresses)` — n'ont pas à s'exécuter pour quelqu'un qu'on redirige.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const addressId = useCheckout((s) => s.addressId);

  useEffect(() => {
    if (!session) {
      useAuthIntent.getState().set('/address');
      router.replace('/login');
      return;
    }
    if (!addressId) router.replace('/address');
  }, [session, addressId, router]);

  // Le temps de la bascule : fond neutre, pas de spinner — il laisserait croire à un
  // chargement alors qu'on quitte l'écran.
  if (!session || !addressId) return <View style={styles.container} />;
  return <CheckoutForm />;
}

/** Écran 07 — Validation de la commande (récap + choix du paiement). */
function CheckoutForm() {
  const router = useRouter();
  const { t } = useTranslation();

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
      setError(t('checkout.needAddress'));
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
          options: l.options.map((o) => ({ optionId: o.optionId, quantity: o.quantity })),
        })),
      });
      clear();
      // On transmet le total et le numéro renvoyés par la RPC (source autoritative,
      // déjà recalculée côté serveur) : la confirmation affiche le bon montant tout de
      // suite, sans dépendre du refetch (évite le « 0 Ar » transitoire).
      router.replace({
        pathname: '/confirmation',
        params: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: String(order.total),
          payment: paymentMethod,
        },
      });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? '';
      setError(
        /position gps|localisation/i.test(msg) ? t('checkout.needGps') : t('checkout.failed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title={t('checkout.title')} />

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.restoRow}>
            <Avatar initials={restaurantInitials || '--'} size={36} r={10} />
            <Text style={styles.restoName}>{restaurantName}</Text>
          </View>
          <Divider style={{ marginVertical: 14 }} />
          {lines.map((l) => (
            <View key={l.key} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {l.quantity} × {l.product.name}
                </Text>
                {l.options.length > 0 ? (
                  <Text style={styles.itemOptions}>{l.options.map((o) => o.name).join(', ')}</Text>
                ) : null}
              </View>
              <Text style={styles.itemPrice}>{formatAr(lineUnitPrice(l) * l.quantity)}</Text>
            </View>
          ))}
        </Card>

        <Card style={styles.addrCard}>
          <Icon name="location_on" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            {address ? (
              <>
                <Text style={styles.addrLabel}>{formatAddressLine(address.zone, address.label)}</Text>
                <Text style={styles.addrDetail}>
                  {address.landmark} · {address.phone}
                </Text>
              </>
            ) : (
              <Text style={styles.addrLabel}>{t('checkout.noAddress')}</Text>
            )}
          </View>
          <Pressable onPress={() => router.push('/address')}>
            <Text style={styles.modify}>{t('common.modify')}</Text>
          </Pressable>
        </Card>

        <SectionLabel style={{ marginTop: 20, marginBottom: 10 }}>{t('checkout.paymentSection')}</SectionLabel>
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
                  <Text style={styles.payTitle}>{t(`payment.${m.key}`)}</Text>
                  <Text style={styles.paySub}>{t(m.subKey)}</Text>
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
          <InfoBanner>{t('checkout.noCharge')}</InfoBanner>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BottomBar>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('checkout.totalToPay', { method: paymentShort(paymentMethod) })}</Text>
          <Text style={styles.totalValue}>{formatAr(total)}</Text>
        </View>
        <Button label={t('checkout.validate')} icon="check_circle" onPress={validate} loading={submitting} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  restoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restoName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  itemName: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  itemOptions: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
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
