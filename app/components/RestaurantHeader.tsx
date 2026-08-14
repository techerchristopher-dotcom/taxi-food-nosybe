import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { useSession } from '../store/session';

/**
 * En-tête sombre de l'espace restaurant : nom du restaurant + titre d'écran, et un bouton
 * pour revenir à l'écran de sélection de rôle (changer de mode / se déconnecter).
 */
export function RestaurantHeader({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const restaurantName = useSession((s) => s.session?.restaurantName ?? 'Mon restaurant');
  const setMode = useSession((s) => s.setMode);

  async function switchRole() {
    await setMode(null);
    router.replace('/role-select');
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.resto}>{restaurantName}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
      <Pressable onPress={switchRole} hitSlop={8} style={styles.switch}>
        <Icon name="swap_horiz" size={20} color={colors.white} />
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
  resto: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  title: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5, color: colors.white, marginTop: 4 },
  switch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
