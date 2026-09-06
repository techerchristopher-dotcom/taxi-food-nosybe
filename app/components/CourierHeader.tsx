import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { useSession } from '../store/session';
import { retourOnglets } from '../lib/nav';

/**
 * En-tête sombre de l'espace livreur. Jumeau de `RestaurantHeader` : même badge d'espace
 * pro, même bouton nommé pour passer côté client — les deux espaces professionnels doivent
 * se comporter pareil, sinon la règle n'en est plus une.
 */
export function CourierHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const firstName = useSession((s) => s.session?.fullName?.split(' ')[0] ?? 'Livreur');
  const setMode = useSession((s) => s.setMode);

  // Voir le commentaire de `RestaurantHeader` : ce bouton POSE le mode client au lieu de
  // l'effacer, et il dit ce qu'il fait.
  async function voirAppClient() {
    await setMode('client');
    retourOnglets(router, '/(tabs)');
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.badge}>
          <Icon name="two_wheeler" size={13} color={colors.white} />
          <Text style={styles.badgeText}>Espace livreur</Text>
        </View>
        <Text style={styles.who} numberOfLines={1}>
          {firstName}
        </Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={voirAppClient}
        hitSlop={8}
        style={styles.switch}
        accessibilityRole="button"
        accessibilityLabel="Voir l'application client"
      >
        <Icon name="swap_horiz" size={18} color={colors.white} />
        <Text style={styles.switchText}>App client</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.screen,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.white,
  },
  who: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 7 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5, color: colors.white, marginTop: 2 },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  switchText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
});
