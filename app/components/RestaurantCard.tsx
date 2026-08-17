import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { OpenBadge, RestaurantLogo } from './primitives';
import { colors, fonts, radius, shadow } from '../theme/tokens';
import { CategoryTag, Restaurant, formatTime } from '../data/types';
import { formatAr } from '../theme/tokens';

/** Ligne « meta » : délai estimé + frais de livraison. */
function Meta({ eta, fee }: { eta: string; fee: number }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaItem}>
        <Icon name="schedule" size={15} color={colors.secondary} />
        <Text style={styles.metaText}>{eta}</Text>
      </View>
      <View style={styles.metaItem}>
        <Icon name="two_wheeler" size={15} color={colors.secondary} />
        <Text style={styles.metaText}>{formatAr(fee)}</Text>
      </View>
    </View>
  );
}

/** Tags des catégories actives du restaurant : emoji + nom (ex. « 🍕 Pizza »). */
function CategoryTags({ tags }: { tags: CategoryTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View style={styles.typesRow}>
      {tags.map((t) => (
        <View key={t.name} style={[styles.typeBadge, styles.typeBadgeOff]}>
          <Text style={styles.typeBadgeText}>{t.icon ? `${t.icon} ${t.name}` : t.name}</Text>
        </View>
      ))}
    </View>
  );
}

/** Carte vedette avec bandeau (1er restaurant de la liste), badges Ouvert/Populaire. */
export function FeaturedRestaurantCard({
  r,
  onPress,
}: {
  r: Restaurant;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={styles.featured}>
      <View style={styles.banner}>
        <OpenBadge open={r.isOpen} />
        {r.popular ? (
          <View style={styles.popular}>
            <Text style={styles.popularText}>{t('restaurantCard.popular')}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.featuredBody}>
        <RestaurantLogo uri={r.logoUrl} initials={r.initials} size={44} r={12} bg={colors.white} color={colors.primary} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name}>{r.name}</Text>
          <Text style={styles.sub}>
            {r.cuisineType} — {r.zone}
          </Text>
          <CategoryTags tags={r.categoryTags} />
          <Meta eta={r.etaLabel} fee={r.deliveryFee} />
        </View>
      </View>
    </Pressable>
  );
}

/** Carte compacte (ligne) : vignette + infos. Grisée si fermé. */
export function RestaurantRow({
  r,
  onPress,
}: {
  r: Restaurant;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={[styles.row, !r.isOpen && { opacity: 0.55 }]}>
      <RestaurantLogo uri={r.logoUrl} initials={r.initials} size={64} r={radius.tile} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName}>{r.name}</Text>
          <OpenBadge open={r.isOpen} />
        </View>
        <Text style={styles.sub}>
          {r.cuisineType} — {r.zone}
        </Text>
        <CategoryTags tags={r.categoryTags} />
        {r.isOpen ? (
          <Meta eta={r.etaLabel} fee={r.deliveryFee} />
        ) : (
          <Text style={styles.closedText}>
            {r.opensAt
              ? t('restaurantCard.opensAt', { time: formatTime(r.opensAt) })
              : t('restaurantCard.closed')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  featured: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...shadow.card,
  },
  banner: {
    height: 104,
    backgroundColor: colors.photoWarmB,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 10,
  },
  popular: {
    height: 24,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularText: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  featuredBody: { flexDirection: 'row', gap: 12, padding: 14, paddingTop: 12, alignItems: 'flex-start' },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    ...shadow.card,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  rowName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, flexShrink: 1 },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  typesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  typeBadge: { height: 22, paddingHorizontal: 9, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  typeBadgeOn: { backgroundColor: colors.primary },
  typeBadgeOff: { backgroundColor: colors.fieldBg },
  typeBadgeText: { fontFamily: fonts.semibold, fontSize: 10, color: colors.textDark },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textDark },
  closedText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted, marginTop: 7 },
});
