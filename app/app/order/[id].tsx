import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { Card, Divider, SectionLabel } from '../../components/primitives';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import { Order, paymentShort, statusStep } from '../../data/types';
import { getOrderById } from '../../data/api';
import { useLoad } from '../../lib/useLoad';

/**
 * Écran 09 — Suivi de commande (timeline 5 statuts).
 * L'étape courante vient de `orders.status` en base ; l'écran se rafraîchit
 * périodiquement (le statut est avancé par le back-office / futur écran restaurant).
 */
const STEPS = [
  { icon: 'inbox', key: 'received' },
  { icon: 'restaurant', key: 'confirmed' },
  { icon: 'soup_kitchen', key: 'preparing' },
  { icon: 'two_wheeler', key: 'delivering' },
  { icon: 'check_circle', key: 'delivered' },
] as const;

const POLL_MS = 15000;

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { data: order, loading, reload } = useLoad(() => getOrderById(id!), [id]);

  // Rafraîchissement périodique du statut tant que l'écran est monté.
  useEffect(() => {
    const t = setInterval(reload, POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // On arrive souvent ici juste après la création : la commande peut n'être pas encore
  // lisible à la première requête. On réessaie brièvement avant de conclure « introuvable ».
  const MAX_RETRIES = 4;
  const [retries, setRetries] = useState(0);
  useEffect(() => setRetries(0), [id]);
  useEffect(() => {
    if (!loading && !order && retries < MAX_RETRIES) {
      const t = setTimeout(() => {
        setRetries((n) => n + 1);
        reload();
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [loading, order, retries, reload]);

  if (!order && (loading || retries < MAX_RETRIES)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('tracking.notFound')}</Text>
      </View>
    );
  }

  const cancelled = order.status === 'annulee';
  const step = statusStep(order.status);
  const head = STEPS[step];
  // Carte payee en ligne : l'ecran doit dire la verite meme quand le client
  // revient apres avoir perdu le reseau en plein paiement. `paymentStatus` est
  // ecrit par un trigger a partir du verdict du webhook Stripe : c'est la seule
  // source qui ne depend pas de ce que l'appareil du client a cru voir.
  const carte = order.paymentMethod === 'cb';
  const carteReglee = carte && order.paymentStatus === 'paye';

  // Sous-états de "en_livraison" : en attente d'un livreur vs récupérée, en route.
  const enLivraison = order.status === 'en_livraison';
  const bannerIcon = cancelled ? 'cancel' : enLivraison && !order.pickedUp ? 'schedule' : head.icon;
  const bannerTitle = cancelled
    ? t('tracking.refusedTitle')
    : enLivraison
      ? order.pickedUp
        ? t('tracking.onTheWay')
        : t('tracking.soonOnTheWay')
      : t(`tracking.steps.${head.key}Title`);
  // Le motif de refus est saisi par le restaurant : donnée métier, jamais traduite.
  const bannerSub = cancelled
    ? (order.cancellationReason ?? t('tracking.refusedDefault'))
    : enLivraison
      ? order.pickedUp
        ? order.courierName
          ? t('tracking.courierNamedPicked', { name: order.courierName })
          : t('tracking.courierPicked')
        : t('tracking.waitingCourier')
      : t(`tracking.steps.${head.key}Head`);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Icon name="arrow_back" size={22} color={colors.white} />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>{t('tracking.headerTitle', { number: order.orderNumber })}</Text>
            <Text style={styles.headerSub}>
              {order.restaurantName} · {order.createdLabel}
            </Text>
          </View>
        </View>
        <View style={styles.statusBanner}>
          <Icon name={bannerIcon} size={26} color={cancelled ? colors.primary : colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>{bannerTitle}</Text>
            <Text style={styles.statusSub}>{bannerSub}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {cancelled ? (
          <Card style={styles.cancelledCard}>
            <Icon name="cancel" size={22} color={colors.dangerText} />
            <Text style={styles.cancelledTitle}>{t('tracking.refusedCardTitle')}</Text>
            {order.cancellationReason ? (
              <Text style={styles.cancelledReason}>{t('tracking.refusedReason', { reason: order.cancellationReason })}</Text>
            ) : null}
            {/* « Aucun montant ne te sera debite » devient faux des qu'une
                carte a ete prelevee : dans ce cas c'est un remboursement. */}
            <Text style={styles.cancelledHint}>
              {t(carteReglee ? 'tracking.refusedHintCarte' : 'tracking.refusedHint')}
            </Text>
          </Card>
        ) : (
        <Card style={{ paddingBottom: 6 }}>
          {STEPS.map((s, i) => {
            const done = i <= step;
            const current = i === step;
            const isLast = i === STEPS.length - 1;
            const sub =
              i === 4
                ? carteReglee
                  ? t('tracking.payToCourierCarte')
                  : t('tracking.payToCourier', { method: paymentShort(order.paymentMethod) })
                : i === 3 && enLivraison
                  ? order.pickedUp
                    ? t('tracking.step4Picked')
                    : t('tracking.step4Waiting')
                  : t(`tracking.steps.${s.key}Sub`);
            return (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepMarker}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: done ? (current ? colors.primary : colors.success) : colors.photoGrayA },
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
                  <Text style={styles.stepTitle}>{t(`tracking.steps.${s.key}Title`)}</Text>
                  <Text style={styles.stepSub}>{sub}</Text>
                </View>
              </View>
            );
          })}
        </Card>
        )}

        <EtatPaiement order={order} onReprendre={() => router.push({
          pathname: '/paiement',
          params: { orderId: order.id, orderNumber: order.orderNumber, total: String(order.total) },
        })} />

        <Card style={{ marginTop: 14 }}>
          <SectionLabel style={{ marginBottom: 12 }}>{t('tracking.summary')}</SectionLabel>
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
          {order.packagingFee > 0 ? (
            <View style={styles.itemRow}>
              <Text style={styles.itemName}>Emballage</Text>
              <Text style={styles.itemPrice}>{formatAr(order.packagingFee)}</Text>
            </View>
          ) : null}
          <View style={styles.itemRow}>
            <Text style={styles.itemName}>{t('common.deliveryFee')}</Text>
            <Text style={styles.itemPrice}>{formatAr(order.deliveryFee)}</Text>
          </View>
          {/* La remise est lue sur la COMMANDE, pas recalculee : elle doit rester
              affichable a l'identique meme si le code a ete retire depuis. */}
          {order.promoDiscount > 0 ? (
            <View style={styles.itemRow}>
              <Text style={[styles.itemName, styles.remiseTexte]}>
                {t('promo.ligne', { code: order.promoCode ?? '' })}
              </Text>
              <Text style={[styles.itemPrice, styles.remiseTexte]}>
                −{formatAr(order.promoDiscount)}
              </Text>
            </View>
          ) : null}
          <Divider style={{ marginVertical: 12 }} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('tracking.totalWith', { method: paymentShort(order.paymentMethod) })}</Text>
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

/**
 * Etat du paiement carte, affiche UNIQUEMENT pour les commandes « cb ».
 *
 * C'est la reponse au scenario « reseau coupe pendant le paiement » : le client
 * rouvre l'app et doit lire ce qui s'est reellement passe, pas une supposition.
 * Rien ici n'est deduit du parcours precedent — tout vient de `payment_status`,
 * ecrit par un trigger a partir du verdict du webhook Stripe.
 */
function EtatPaiement({ order, onReprendre }: { order: Order; onReprendre: () => void }) {
  const { t } = useTranslation();
  if (order.paymentMethod !== 'cb') return null;

  // `non_requis` sur une commande carte = aucun paiement n'a jamais ete engage.
  // C'est le cas de l'abandon pur et simple : a traiter comme un echec, sinon
  // la commande resterait a payer sans que rien ne le dise.
  const aRegler = order.paymentStatus === 'echoue' || order.paymentStatus === 'non_requis';
  const terminee = order.status === 'livree' || order.status === 'annulee';

  const contenu =
    order.paymentStatus === 'paye'
      ? { icone: 'check_circle', couleur: colors.success, texte: t('tracking.payToCourierCarte') }
      : order.paymentStatus === 'rembourse'
        ? { icone: 'undo', couleur: colors.textMuted, texte: t('tracking.paiementRembourse') }
        : order.paymentStatus === 'en_attente'
          ? { icone: 'schedule', couleur: colors.secondary, texte: t('tracking.paiementEnAttente') }
          : { icone: 'error', couleur: colors.dangerText, texte: t('tracking.paiementEchoue') };

  return (
    <Card style={[styles.paiementCarte, { marginTop: 14 }]}>
      <View style={styles.paiementLigne}>
        <Icon name={contenu.icone} size={22} color={contenu.couleur} />
        <Text style={styles.paiementTexte}>{contenu.texte}</Text>
      </View>
      {(aRegler || order.paymentStatus === 'en_attente') && !terminee ? (
        <Button
          label={t('tracking.reprendrePaiement')}
          variant="outline"
          icon="credit_card"
          onPress={onReprendre}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  paiementCarte: { gap: 0 },
  paiementLigne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paiementTexte: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.ink },
  remiseTexte: { color: colors.primary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { fontFamily: fonts.semibold, color: colors.textMuted },
  cancelledCard: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  cancelledTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, textAlign: 'center', marginTop: 4 },
  cancelledReason: { fontFamily: fonts.medium, fontSize: 13, color: colors.dangerText, textAlign: 'center' },
  cancelledHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
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
    borderWidth: 5,
    borderColor: 'rgba(232,52,42,0.16)',
  },
  line: { width: 2, flex: 1, minHeight: 26, marginVertical: 2 },
  stepBody: { paddingBottom: 18, flex: 1 },
  stepTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  stepSub: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginTop: 3 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  itemName: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  itemOptions: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, color: colors.textMuted, marginTop: 2 },
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
