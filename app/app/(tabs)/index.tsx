import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { FeaturedRestaurantCard, RestaurantRow } from '../../components/RestaurantCard';
import { colors, fonts, radius, spacing } from '../../theme/tokens';
import { mockAddresses, restaurants } from '../../data/mock';

const FILTERS = ['Tout', 'Pizza', 'Tacos', 'Burgers'] as const;

/** Écran 02 — Accueil : restaurants de Nosy Be. */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('Tout');

  const defaultAddress = mockAddresses.find((a) => a.isDefault) ?? mockAddresses[0];

  const list = useMemo(() => {
    if (filter === 'Tout') return restaurants;
    return restaurants.filter((r) => r.cuisineType.toLowerCase().includes(filter.toLowerCase().replace('s', '')));
  }, [filter]);

  const openCount = restaurants.filter((r) => r.isOpen).length;
  const [featured, ...rows] = list;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deliverTo}>Livrer à</Text>
            <View style={styles.addressRow}>
              <Icon name="location_on" size={20} color={colors.accent} />
              <Text style={styles.addressText} numberOfLines={1}>
                {defaultAddress.zone} — {defaultAddress.label.split('—').pop()?.trim()}
              </Text>
              <Icon name="expand_more" size={18} color={colors.white} />
            </View>
          </View>
          <Image source={require('../../assets/icon-tile.png')} style={styles.headerLogo} />
        </View>
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <Text style={styles.searchText}>Chercher un resto ou un plat…</Text>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filters}>
          {FILTERS.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              >
                <Text style={[styles.chipText, { color: active ? colors.white : colors.textDark }]}>{f}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.count}>
          {openCount} restaurant{openCount > 1 ? 's' : ''} ouvert{openCount > 1 ? 's' : ''}
        </Text>

        <View style={{ gap: 12 }}>
          {featured ? (
            <FeaturedRestaurantCard r={featured} onPress={() => router.push(`/restaurant/${featured.id}`)} />
          ) : null}
          {rows.map((r) => (
            <RestaurantRow key={r.id} r={r} onPress={() => router.push(`/restaurant/${r.id}`)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 18,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  deliverTo: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.75)',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  addressText: { fontFamily: fonts.bold, fontSize: 16, color: colors.white, flexShrink: 1 },
  headerLogo: { width: 38, height: 38, borderRadius: 12 },
  search: {
    marginTop: 16,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
  },
  searchText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: colors.ink },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontFamily: fonts.semibold, fontSize: 12 },
  count: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 10,
  },
});
