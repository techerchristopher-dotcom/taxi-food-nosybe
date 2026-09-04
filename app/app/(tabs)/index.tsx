import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../../components/Icon';
import { FeaturedRestaurantCard, RestaurantRow } from '../../components/RestaurantCard';
import { colors, fonts, radius, spacing } from '../../theme/tokens';
import { useLoad } from '../../lib/useLoad';
import { listAddresses, listRestaurants } from '../../data/api';
import { Address, FOOD_TYPE_ICON, FOOD_TYPE_ORDER, formatAddressLine } from '../../data/types';
import { useSession } from '../../store/session';
import { signInFor } from '../../store/authIntent';

/** Sentinelle du filtre « tout » — jamais affichée telle quelle (le libellé est traduit). */
const TOUT = '__all__';

/**
 * Minuscules sans accent : « Américain » doit se trouver en tapant « americain », et
 * « CRÊPE » en tapant « crepe ». Personne ne pose les accents sur un clavier de téléphone.
 */
function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Écran 02 — Accueil : restaurants de Nosy Be. */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>(TOUT);
  const [query, setQuery] = useState('');

  const session = useSession((s) => s.session);

  const { data: restaurants, loading } = useLoad(() => listRestaurants(), []);
  // Le catalogue est public : `listRestaurants()` n'a besoin d'aucun compte. Les adresses,
  // si — inutile d'interroger la base à chaque focus d'onglet pour un visiteur, la RLS
  // renverrait de toute façon une liste vide.
  const { data: addresses } = useLoad(
    () => (session ? listAddresses() : Promise.resolve<Address[]>([])),
    [session?.userId ?? ''],
  );

  const defaultAddress = addresses?.find((a) => a.isDefault) ?? addresses?.[0] ?? null;

  // Filtres dynamiques : union des types de plats réellement proposés par les restaurants.
  const filters = useMemo(() => {
    const set = new Set<string>();
    (restaurants ?? []).forEach((r) => r.foodTypes.forEach((t) => set.add(t)));
    const types = [...set].sort((a, b) => {
      const ia = FOOD_TYPE_ORDER.indexOf(a);
      const ib = FOOD_TYPE_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    });
    return [TOUT, ...types];
  }, [restaurants]);

  // Filtre par type de plat PUIS recherche libre. Tout se fait en mémoire : les
  // restaurants sont déjà tous chargés, la recherche ne coûte aucune requête.
  const list = useMemo(() => {
    const base =
      filter === TOUT
        ? (restaurants ?? [])
        : (restaurants ?? []).filter((r) => r.foodTypes.includes(filter));
    const q = sansAccent(query.trim());
    if (!q) return base;
    // On cherche dans ce que le client a sous les yeux ou en tête : le nom du resto, sa
    // cuisine, sa zone, et les plats qu'il propose (« pizza », « tacos »…).
    return base.filter((r) =>
      sansAccent(
        [r.name, r.cuisineType, r.zone, ...r.foodTypes, ...(r.categoryTags ?? []).map((c) => c.name)]
          .filter(Boolean)
          .join(' '),
      ).includes(q),
    );
  }, [filter, query, restaurants]);

  // Compté sur la liste AFFICHÉE : annoncer « 12 restaurants ouverts » au-dessus d'un
  // unique résultat de recherche n'aurait aucun sens.
  const openCount = list.filter((r) => r.isOpen).length;
  const searching = query.trim().length > 0;
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
            <Text style={styles.deliverTo}>{t('home.deliverTo')}</Text>
            <View style={styles.addressRow}>
              <Icon name="location_on" size={20} color={colors.accent} />
              {/* Visiteur : ni « Choisir une adresse » (il n'a rien à choisir) ni chevron
                  (il n'y a rien à dérouler) — on annonce la zone desservie. La ligne n'est
                  volontairement pas rendue cliquable : elle ne l'est pas non plus pour un
                  compte connecté, et un nom de lieu qui ouvre une connexion est une
                  surprise désagréable. La porte de l'accueil est le bandeau ci-dessous. */}
              <Text style={styles.addressText} numberOfLines={1}>
                {defaultAddress
                  ? formatAddressLine(defaultAddress.zone, defaultAddress.label)
                  : session
                    ? t('home.chooseAddress')
                    : t('home.guestZone')}
              </Text>
              {session ? <Icon name="expand_more" size={18} color={colors.white} /> : null}
            </View>
          </View>
          <Image source={require('../../assets/icon-tile.png')} style={styles.headerLogo} />
        </View>
        {/* Recherche RÉELLE.
            Ce bloc a longtemps été un `<View>` contenant un `<Text>` : la pastille blanche,
            la loupe et le texte d'invite d'un champ de saisie — sans le champ. Une
            affordance morte est un motif de rejet Apple (règle 2.1), et depuis que l'app
            s'ouvre sur le catalogue, c'est la PREMIÈRE chose que touche un relecteur. */}
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('home.search')}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel={t('home.search')}
          />
          {searching ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('home.searchClear')}
            >
              <Icon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* La porte d'entrée vers le compte, sur l'écran d'accueil. Elle dit ce que le
            compte apporte ET ce qu'il ne conditionne pas — c'est cette seconde moitié
            qu'Apple cherchait : la navigation est libre, le compte sert à livrer. */}
        {!session ? (
          <Pressable style={styles.guestBanner} onPress={() => signInFor(router, '/(tabs)')}>
            <Icon name="local_shipping" size={20} color={colors.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBannerText}>{t('home.guestBanner')}</Text>
              <Text style={styles.guestBannerCta}>{t('home.guestBannerCta')}</Text>
            </View>
            <Icon name="chevron_right" size={20} color={colors.textFaint} />
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          {filters.map((f) => {
            const active = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
              >
                <Text style={[styles.chipText, { color: active ? colors.white : colors.textDark }]}>
                  {f === TOUT ? t('home.filterAll') : `${FOOD_TYPE_ICON[f] ? `${FOOD_TYPE_ICON[f]} ` : ''}${f}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && !restaurants ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            <Text style={styles.count}>{t('home.openCount', { count: openCount })}</Text>

            <View style={{ gap: 12 }}>
              {featured ? (
                <FeaturedRestaurantCard
                  r={featured}
                  onPress={() => router.push(`/restaurant/${featured.id}`)}
                />
              ) : null}
              {rows.map((r) => (
                <RestaurantRow
                  key={r.id}
                  r={r}
                  onPress={() => router.push(`/restaurant/${r.id}`)}
                />
              ))}
              {list.length === 0 ? (
                <Text style={styles.emptyFilter}>
                  {searching ? t('home.emptySearch', { query: query.trim() }) : t('home.emptyFilter')}
                </Text>
              ) : null}
            </View>
          </>
        )}
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
  // `paddingVertical: 0` : sans lui, Android ajoute sa propre marge interne au TextInput
  // et le texte se décale vers le bas dans la pastille.
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 0,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBannerText: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.textDark },
  guestBannerCta: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary, marginTop: 3 },
  filtersScroll: { marginBottom: 16, marginHorizontal: -spacing.screen },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.screen },
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
  loading: { paddingVertical: 60, alignItems: 'center' },
  emptyFilter: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingVertical: 30 },
});
