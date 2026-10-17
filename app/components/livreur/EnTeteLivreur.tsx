import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../Icon';
import { colors, fonts, radius, spacing } from '../../theme/tokens';
import { useSession } from '../../store/session';

/**
 * En-tête de l'app Taxi Food Livreur. Même allure que `CourierHeader` (espace livreur de
 * l'app client), mais SANS le bouton « App client » : ici il n'y a qu'un espace.
 */
export function EnTeteLivreur({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const prenom = useSession((s) => s.session?.fullName?.split(' ')[0] ?? 'Livreur');
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.badge}>
        <Icon name="two_wheeler" size={13} color={colors.white} />
        <Text style={styles.badgeText}>Taxi Food Livreur</Text>
      </View>
      <Text style={styles.who} numberOfLines={1}>
        {prenom}
      </Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.ink, paddingHorizontal: spacing.screen, paddingBottom: 18 },
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
  badgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.white },
  who: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 7 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5, color: colors.white, marginTop: 2 },
});
