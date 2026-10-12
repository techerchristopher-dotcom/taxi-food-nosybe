import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from './Icon';
import { colors, fonts } from '../theme/tokens';
import { RoleMessagerie } from '../data/messagerie';

/**
 * Le bouton 💬 qui ouvre la conversation d'une commande, avec la pastille des non-lus.
 * Le libellé est fourni par l'écran (traduit côté client, français côté pro).
 */
export function BoutonMessagerie({
  orderId,
  role,
  nonLus = 0,
  label,
}: {
  orderId: string;
  role: RoleMessagerie;
  nonLus?: number;
  label: string;
}) {
  const router = useRouter();
  const alerte = nonLus > 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/messages/[id]', params: { id: orderId, role } })}
      style={({ pressed }) => [styles.btn, alerte && styles.btnAlerte, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={alerte ? `${label} (${nonLus})` : label}
    >
      <Icon name="chat" size={20} color={alerte ? colors.white : colors.primary} />
      <Text style={[styles.label, alerte && { color: colors.white }]} numberOfLines={1}>
        {label}
      </Text>
      {alerte ? (
        <View style={styles.pastille}>
          <Text style={styles.pastilleTxt}>{nonLus > 9 ? '9+' : nonLus}</Text>
        </View>
      ) : (
        <Icon name="chevron_right" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  btnAlerte: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  pastille: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTxt: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
});
