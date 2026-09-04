import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { OpenBadge, RestaurantLogo } from '../../components/primitives';
import { ProductRow } from '../../components/ProductRow';
import { ProductThumb } from '../../components/ProductThumb';
import { ConflictSheet } from '../../components/ConflictSheet';
import { colors, fonts, formatAr, radius, shadow, spacing } from '../../theme/tokens';
import { imageUrl, Product, Restaurant, todayHoursLabel } from '../../data/types';

/** Doit rester aligné sur `styles.banner.height`. */
const BANNER_HEIGHT = 200;
import { getMenu, getRestaurant } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { lineKey, RestaurantContext, useCart } from '../../store/cart';

/** Écran 03 — Menu du restaurant (catégories + produits + panier flottant). */
export default function RestaurantMenuScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useTranslation();

  const { data: restaurant, loading } = useLoad(() => getRestaurant(id!), [id]);
  const { data: menu } = useLoad(() => getMenu(id!), [id]);
  const categories = menu?.categories ?? [];
  const productsByCat = menu?.products ?? [];
  const featured = menu?.featured ?? [];

  const cartLines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQuantity = useCart((s) => s.setQuantity);
  const replaceWith = useCart((s) => s.replaceWith);
  const canAdd = useCart((s) => s.canAdd);
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const total = useCart((s) => s.total());
  const cartRestaurantName = useCart((s) => s.restaurantName);

  const [activeCat, setActiveCat] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState<Product | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  if (loading && !restaurant) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!restaurant) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>{t('restaurant.notFound')}</Text>
      </View>
    );
  }

  const ctx: RestaurantContext = {
    id: restaurant.id,
    name: restaurant.name,
    initials: restaurant.initials,
    logoUrl: restaurant.logoUrl,
    deliveryFee: restaurant.deliveryFee,
  };

  // Le stepper rapide du menu agit sur la ligne « ajout rapide » (sans commentaire).
  const qtyOf = (productId: string) =>
    cartLines.find((l) => l.key === lineKey(productId))?.quantity ?? 0;

  function tryAdd(product: Product) {
    if (canAdd(product)) add(product, ctx);
    else setPending(product);
  }

  const activeCategory = categories.find((c) => c.id === activeCat) ?? categories[0];
  const visibleProducts = productsByCat.filter((p) => p.categoryId === activeCategory?.id);

  return (
    <View style={styles.container}>
      <View style={[styles.banner, { paddingTop: insets.top + 12 }]}>
        {restaurant.coverUrl ? (
          <Image
            // Bannière de 200 pt : on demande cette taille-là, pas le fichier d'origine.
            source={{ uri: imageUrl(restaurant.coverUrl, width, BANNER_HEIGHT) }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={220}
            style={StyleSheet.absoluteFill}
            onError={({ error }) => console.warn('[resto] échec bannière', restaurant.coverUrl, error)}
          />
        ) : null}
        {/* Pas de cœur « favori » ici : il donnait le retour visuel d'un bouton et ne
            faisait rien — les favoris ne sont pas au programme du MVP. Un `Pressable` sans
            gestionnaire est un motif de rejet Apple (règle 2.1), et cet écran est celui que
            le rejet du 2026-08-23 désigne nommément (« viewing the menu »). Même arbitrage
            que pour « Ajouter » et « … » du Profil : tant que l'action n'existe pas, le
            bouton non plus. */}
        <View style={styles.bannerActions}>
          <Pressable onPress={() => router.back()} style={styles.roundBtn} hitSlop={8}>
            <Icon name="arrow_back" size={22} color={colors.ink} />
          </Pressable>
        </View>
        {!restaurant.coverUrl ? <Text style={styles.bannerHint}>{t('restaurant.coverHint')}</Text> : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.sheet}
        contentContainerStyle={{ paddingBottom: count > 0 ? 120 : 40 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        <RestaurantHeader r={restaurant} />

        {/* Mise en avant du restaurant : plats du jour, pizza de la semaine…
            Un plat de la carte permanente mis en avant apparaît ici ET dans sa
            catégorie — c'est un coup de projecteur, pas un déplacement. */}
        {featured.length ? (
          <View style={styles.featuredWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: spacing.screen }}
            >
              {featured.map((p) => {
                const epuise = !p.isAvailable || p.stockQuantity === 0;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => router.push(`/product/${p.id}`)}
                    disabled={epuise}
                    style={[styles.featuredCard, epuise && styles.featuredCardOff]}
                  >
                    <ProductThumb uri={p.photoUrl} size={148} radius={radius.tile} muted={epuise} />
                    <View style={{ paddingTop: 8, gap: 2 }}>
                      {p.featuredLabel ? (
                        <Text style={styles.featuredLabel}>{p.featuredLabel.toUpperCase()}</Text>
                      ) : null}
                      <Text style={styles.featuredName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <Text style={styles.featuredPrice}>{formatAr(p.price)}</Text>
                      {epuise ? (
                        <Text style={styles.featuredSoldOut}>{t('restaurantCard.unavailable')}</Text>
                      ) : p.stockQuantity != null ? (
                        <Text style={styles.featuredStock}>
                          {p.stockQuantity} restant{p.stockQuantity > 1 ? 's' : ''}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View />
        )}

        <View style={styles.catBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {categories.map((c) => {
              const active = c.id === activeCategory?.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setActiveCat(c.id)}
                  style={[styles.catChip, active ? styles.catChipActive : styles.catChipIdle]}
                >
                  <Text style={[styles.catText, { color: active ? colors.white : colors.textDark }]}>
                    {c.icon ? `${c.icon} ${c.name}` : c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: spacing.screen, paddingTop: 16 }}>
          <Text style={styles.catTitle}>
            {activeCategory?.icon ? `${activeCategory.icon} ` : ''}{activeCategory?.name}{' '}
            <Text style={styles.catCount}>{t('restaurant.productCount', { count: visibleProducts.length })}</Text>
          </Text>
          <View style={{ gap: 10 }}>
            {visibleProducts.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                qty={qtyOf(p.id)}
                onOpen={() => router.push(`/product/${p.id}`)}
                onInc={() => (p.hasOptions ? router.push(`/product/${p.id}`) : tryAdd(p))}
                onDec={() => setQuantity(lineKey(p.id), qtyOf(p.id) - 1)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {count > 0 ? (
        <Pressable
          style={[styles.floatingCart, { bottom: Math.max(insets.bottom, 16) + 10 }]}
          onPress={() => router.push('/(tabs)/cart')}
        >
          <View style={styles.floatingLeft}>
            <Icon name="shopping_bag" size={22} color={colors.accent} />
            <Text style={styles.floatingText}>{t('restaurant.viewCart', { count })}</Text>
          </View>
          <View style={styles.floatingTotal}>
            <Text style={styles.floatingTotalText}>{formatAr(total)}</Text>
          </View>
        </Pressable>
      ) : null}

      <ConflictSheet
        visible={pending !== null}
        currentName={cartRestaurantName}
        newName={restaurant.name}
        onKeep={() => setPending(null)}
        onClear={() => {
          if (pending) replaceWith(pending, ctx);
          setPending(null);
        }}
      />
    </View>
  );
}

function RestaurantHeader({ r }: { r: Restaurant }) {
  const { t } = useTranslation();
  return (
    <View style={styles.rHeader}>
      <View style={styles.rHeadTop}>
        <RestaurantLogo uri={r.logoUrl} initials={r.initials} size={52} r={14} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rName}>{r.name}</Text>
          <Text style={styles.rSub}>
            {r.cuisineType} — {r.zone}
          </Text>
        </View>
        <OpenBadge open={r.isOpen} />
      </View>
      <View style={styles.rMeta}>
        {/* Masqué tant que les horaires du jour ne sont pas renseignés : voir `todayHoursLabel`. */}
        {todayHoursLabel(r.todayHours) ? (
          <View style={styles.rMetaItem}>
            <Icon name="schedule" size={16} color={colors.secondary} />
            <Text style={styles.rMetaText}>{todayHoursLabel(r.todayHours)}</Text>
          </View>
        ) : null}
        <View style={styles.rMetaItem}>
          <Icon name="two_wheeler" size={16} color={colors.secondary} />
          <Text style={styles.rMetaText}>{formatAr(r.deliveryFee)}</Text>
        </View>
        <View style={styles.rMetaItem}>
          <Icon name="shopping_basket" size={16} color={colors.secondary} />
          <Text style={styles.rMetaText}>{t('restaurant.minOrder', { amount: formatAr(r.minOrder) })}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  notFound: { fontFamily: fonts.semibold, color: colors.textMuted },
  banner: {
    height: 200,
    backgroundColor: colors.photoWarmB,
    paddingHorizontal: spacing.screen,
    justifyContent: 'flex-start',
  },
  bannerActions: { flexDirection: 'row', justifyContent: 'space-between' },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  bannerHint: {
    position: 'absolute',
    left: spacing.screen,
    bottom: 10,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.photoWarmText,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    marginTop: -26,
  },
  rHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
    paddingBottom: 16,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
  },
  rHeadTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rName: { fontFamily: fonts.bold, fontSize: 21, letterSpacing: -0.4, color: colors.ink },
  rSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 3 },
  rMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    flexWrap: 'wrap',
  },
  rMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rMetaText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDark },
  catBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screen,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featuredWrap: { backgroundColor: colors.bg, paddingTop: 14, paddingBottom: 16 },
  featuredCard: { width: 148 },
  featuredCardOff: { opacity: 0.55 },
  featuredLabel: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.8, color: colors.primary },
  featuredName: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  featuredPrice: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDark },
  featuredStock: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.textMuted },
  featuredSoldOut: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.dangerText },
  catChip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  catChipActive: { backgroundColor: colors.ink },
  catChipIdle: { backgroundColor: colors.fieldBg },
  catText: { fontFamily: fonts.semibold, fontSize: 12 },
  catTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 12 },
  catCount: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  floatingCart: {
    position: 'absolute',
    left: spacing.screen,
    right: spacing.screen,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    ...shadow.floating,
  },
  floatingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  floatingText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  floatingTotal: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTotalText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
});
