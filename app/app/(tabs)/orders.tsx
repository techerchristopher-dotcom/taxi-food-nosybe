import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Avatar, Card, SectionLabel } from '../../components/primitives';
import { StatusBadge } from '../../components/StatusBadge';
import { colors, fonts, formatAr, radius, spacing } from '../../theme/tokens';
import { Order, Product, SelectedOption } from '../../data/types';
import { listOrders } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { useCart } from '../../store/cart';
import { useSession } from '../../store/session';
import { signInFor } from '../../store/authIntent';

/** Écran 10 — Historique des commandes (10b — état vide, 10c — visiteur non connecté). */
export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  // Pas de session = pas de commandes à lire. `listOrders()` ne lèverait pas (la RLS filtre
  // sur `auth.uid()` et renvoie une liste vide), mais on évite la requête à chaque focus
  // d'onglet — et surtout on distingue « aucune commande » de « pas connecté ».
  const { data: orders, loading } = useLoad(
    () => (session ? listOrders() : Promise.resolve<Order[]>([])),
    [session?.userId ?? ''],
  );
  const clear = useCart((s) => s.clear);
  const add = useCart((s) => s.add);

  const all = orders ?? [];
  const active = all.filter((o) => o.status !== 'livree' && o.status !== 'annulee');
  const past = all.filter((o) => o.status === 'livree' || o.status === 'annulee');

  function reorder(order: Order) {
    clear();
    const ctx = {
      id: order.restaurantId,
      name: order.restaurantName,
      initials: order.restaurantInitials,
      deliveryFee: order.deliveryFee,
    };
    order.items.forEach((it) => {
      const opts = it.options ?? [];
      const optionsTotal = opts.reduce((n, o) => n + o.priceDelta * o.quantity, 0);
      const product: Product = {
        id: it.productId,
        restaurantId: order.restaurantId,
        categoryId: '',
        name: it.name,
        description: '',
        price: it.unitPrice - optionsTotal, // prix de base reconstitué (unitPrice = base + options)
        isAvailable: true,
      };
      const selected: SelectedOption[] = opts
        .filter((o) => o.optionId)
        .map((o) => ({ optionId: o.optionId as string, groupId: '', name: o.name, priceDelta: o.priceDelta, quantity: o.quantity }));
      add(product, ctx, it.quantity, selected);
    });
    router.push('/(tabs)/cart');
  }

  const itemsSummary = (o: Order) =>
    o.items
      .map((it) => {
        const opts = (it.options ?? []).map((o) => o.name).join(', ');
        return `${it.quantity} × ${it.name}${opts ? ` (${opts})` : ''}`;
      })
      .join(' · ');

  /**
   * Visiteur non connecté. Distinct de l'état « aucune commande » : lui dire « aucune
   * commande » serait faux, il en a peut-être — sur un compte auquel il n'est pas connecté.
   * Le texte dit à quoi sert le compte, pas « connecte-toi ».
   */
  if (!session) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>{t('orders.title')}</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="receipt_long" size={44} color={colors.secondary} />
          </View>
          <Text style={styles.emptyTitle}>{t('orders.guestTitle')}</Text>
          <Text style={styles.emptyText}>{t('orders.guestText')}</Text>
          <Pressable style={styles.emptyBtn} onPress={() => signInFor(router, '/(tabs)/orders')}>
            <Text style={styles.emptyBtnText}>{t('orders.guestAction')}</Text>
          </Pressable>
          {/* La moitié du message qu'Apple attend : nommer ce qui NE demande pas de compte. */}
          <Text style={styles.guestHint}>{t('orders.guestHint')}</Text>
        </View>
      </View>
    );
  }

  if (loading && !orders) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>{t('orders.title')}</Text>
        </View>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (all.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>{t('orders.title')}</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="receipt_long" size={44} color={colors.secondary} />
          </View>
          <Text style={styles.emptyTitle}>{t('orders.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('orders.emptyText')}</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyBtnText}>{t('orders.emptyAction')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>{t('orders.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {active.map((o) => (
          <Card key={o.id} style={[styles.card, styles.activeCard]}>
            <OrderHead o={o} />
            <Text style={styles.summary}>{itemsSummary(o)}</Text>
            <View style={styles.foot}>
              <Text style={styles.total}>{formatAr(o.total)}</Text>
              <Pressable style={styles.trackBtn} onPress={() => router.push(`/order/${o.id}`)}>
                <Icon name="local_shipping" size={17} color={colors.accent} />
                <Text style={styles.trackText}>{t('orders.track')}</Text>
              </Pressable>
            </View>
          </Card>
        ))}

        {past.length > 0 ? (
          <>
            <SectionLabel style={{ marginTop: active.length ? 20 : 0, marginBottom: 10 }}>
              {t('orders.previously')}
            </SectionLabel>
            <View style={{ gap: 10 }}>
              {past.map((o) => (
                <Card key={o.id} style={styles.card}>
                  <OrderHead o={o} muted />
                  <Text style={styles.summary}>{itemsSummary(o)}</Text>
                  <View style={styles.foot}>
                    <Text style={styles.total}>{formatAr(o.total)}</Text>
                    <Pressable style={styles.reorderBtn} onPress={() => reorder(o)}>
                      <Icon name="replay" size={17} color={colors.white} />
                      <Text style={styles.reorderText}>{t('orders.reorder')}</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function OrderHead({ o, muted }: { o: Order; muted?: boolean }) {
  return (
    <View style={styles.head}>
      <View style={styles.headLeft}>
        <Avatar
          initials={o.restaurantInitials}
          size={36}
          r={10}
          bg={muted ? colors.fieldBg : colors.warnBg}
          color={muted ? colors.textDark : colors.primary}
        />
        <View>
          <Text style={styles.restoName}>{o.restaurantName}</Text>
          <Text style={styles.meta}>
            {o.createdLabel} · #{o.orderNumber}
          </Text>
        </View>
      </View>
      <StatusBadge status={o.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screen,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 16 },
  activeCard: { borderWidth: 1.5, borderColor: colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restoName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  summary: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 10 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  total: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  trackBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  reorderBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reorderText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.iconTile,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginTop: 20 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textMuted, textAlign: 'center', marginTop: 8 },
  emptyBtn: {
    marginTop: 22,
    height: 50,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  guestHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 16,
  },
});
