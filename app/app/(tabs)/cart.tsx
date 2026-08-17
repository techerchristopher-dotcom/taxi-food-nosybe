import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { Avatar, Card, Divider } from '../../components/primitives';
import { ProductThumb } from '../../components/ProductThumb';
import { QtyStepper } from '../../components/QtyStepper';
import { Button } from '../../components/Button';
import { BottomBar } from '../../components/BottomBar';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../../theme/tokens';
import { lineUnitPrice, RestaurantContext, useCart } from '../../store/cart';
import { useLoad } from '../../lib/useLoad';
import { getCartSuggestions, Suggestion } from '../../data/suggestions';
import { Product } from '../../data/types';

/** Écran 05 — Panier (et 05b — état vide). */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useCart((s) => s.lines);
  const restaurantId = useCart((s) => s.restaurantId);
  const restaurantName = useCart((s) => s.restaurantName);
  const restaurantInitials = useCart((s) => s.restaurantInitials);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const add = useCart((s) => s.add);
  const deliveryFeeValue = useCart((s) => s.deliveryFeeValue);
  const subtotal = useCart((s) => s.subtotal());
  const deliveryFee = useCart((s) => s.deliveryFee());
  const total = useCart((s) => s.total());

  // Suggestions d'upsell (« faire gonfler le panier ») du restaurant courant.
  // Les ids en panier servent d'exclusion ET de bascule boisson → dessert : ajouter
  // une boisson change la clé de dépendance, donc la section se recharge et propose
  // alors un dessert.
  const cartProductIds = lines.map((l) => l.product.id);
  const { data: suggestions } = useLoad(
    () => getCartSuggestions(restaurantId ?? '', cartProductIds),
    [restaurantId, cartProductIds.join(',')],
  );

  // Ajout rapide : on mirroir l'ajout sans option de l'écran restaurant. Un produit
  // à options passe par sa fiche (comme le [+] du menu) ; boissons/desserts n'en ont
  // normalement pas → ajout direct au panier du même restaurant (aucun conflit possible).
  function addSuggestion(s: Suggestion) {
    if (!restaurantId) return;
    if (s.hasOptions) {
      router.push(`/product/${s.id}`);
      return;
    }
    const product: Product = {
      id: s.id,
      restaurantId,
      categoryId: '',
      name: s.name,
      description: '',
      price: s.price,
      isAvailable: true,
      photoUrl: s.photoUrl,
      hasOptions: false,
    };
    const ctx: RestaurantContext = {
      id: restaurantId,
      name: restaurantName,
      initials: restaurantInitials,
      deliveryFee: deliveryFeeValue,
    };
    add(product, ctx);
  }

  const suggestHeading =
    suggestions?.mode === 'drink'
      ? 'Ajoute une boisson 🥤'
      : suggestions?.mode === 'dessert'
        ? 'Complète avec un dessert'
        : 'Tu aimeras aussi';

  if (lines.length === 0) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
          <Text style={styles.headerTitle}>Mon panier</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Icon name="shopping_bag" size={44} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptyText}>
            Parcourez les restaurants de Nosy Be et ajoutez vos plats préférés.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.emptyBtnText}>Voir les restaurants</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <Text style={styles.headerTitle}>Mon panier</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {/* Bandeau restaurant */}
        {restaurantId ? (
          <View style={styles.restoBanner}>
            <Avatar initials={restaurantInitials} size={36} r={10} />
            <View style={{ flex: 1 }}>
              <Text style={styles.restoName}>{restaurantName}</Text>
              <Text style={styles.restoHint}>Un panier = un seul restaurant</Text>
            </View>
            <Icon name="chevron_right" size={20} color={colors.textFaint} />
          </View>
        ) : null}

        {/* Lignes */}
        <View style={{ gap: 10, marginTop: 14 }}>
          {lines.map((l) => (
            <Card key={l.key} style={styles.lineCard}>
              <ProductThumb uri={l.product.photoUrl} size={64} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineName}>{l.product.name}</Text>
                  <Pressable onPress={() => remove(l.key)} hitSlop={8}>
                    <Icon name="delete" size={20} color={colors.textFaint} />
                  </Pressable>
                </View>
                {l.options.length > 0 ? (
                  <Text style={styles.lineComment}>{l.options.map((o) => o.name).join(', ')}</Text>
                ) : null}
                <View style={styles.lineFoot}>
                  <QtyStepper
                    value={l.quantity}
                    onDec={() => setQuantity(l.key, l.quantity - 1)}
                    onInc={() => setQuantity(l.key, l.quantity + 1)}
                    size="sm"
                  />
                  <Text style={styles.linePrice}>{formatAr(lineUnitPrice(l) * l.quantity)}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {/* Suggestions d'upsell — boissons, sinon dessert, sinon autres produits */}
        {suggestions && suggestions.items.length > 0 ? (
          <View style={styles.suggestWrap}>
            <Text style={styles.suggestTitle}>{suggestHeading}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            >
              {suggestions.items.map((s) => (
                <View key={s.id} style={styles.suggestCard}>
                  <View>
                    <ProductThumb uri={s.photoUrl} size={116} radius={radius.tile} />
                    <Pressable onPress={() => addSuggestion(s)} style={styles.suggestAdd} hitSlop={6}>
                      <Icon name="add" size={20} color={colors.white} />
                    </Pressable>
                  </View>
                  <Text style={styles.suggestName} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Text style={styles.suggestPrice}>{formatAr(s.price)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Récapitulatif */}
        <Card style={{ marginTop: 18 }}>
          <View style={styles.sumRow}>
            <Text style={styles.sumLabel}>Sous-total</Text>
            <Text style={styles.sumValue}>{formatAr(subtotal)}</Text>
          </View>
          <View style={[styles.sumRow, { marginTop: 10 }]}>
            <Text style={styles.sumLabel}>Frais de livraison</Text>
            <Text style={styles.sumValue}>{formatAr(deliveryFee)}</Text>
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatAr(total)}</Text>
          </View>
        </Card>
      </ScrollView>

      <BottomBar>
        <Button label="Commander" iconRight="arrow_forward" onPress={() => router.push('/address')} />
      </BottomBar>
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
  headerTitle: { fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.4, color: colors.ink },
  restoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  restoName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  restoHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  lineCard: { padding: 12, flexDirection: 'row', gap: 12 },
  lineHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lineName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  lineComment: { fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 2 },
  lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  linePrice: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  suggestWrap: { marginTop: 18 },
  suggestTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 12 },
  suggestCard: {
    width: 132,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 8,
    ...shadow.card,
  },
  suggestAdd: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.button,
  },
  suggestName: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: colors.ink,
    marginTop: 8,
    minHeight: 34,
  },
  suggestPrice: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary, marginTop: 2 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between' },
  sumLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.textDark },
  sumValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  totalValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
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
});
