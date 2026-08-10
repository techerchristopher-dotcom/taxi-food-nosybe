import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, radius, shadow } from '../theme/tokens';

/** Carte blanche arrondie avec ombre douce (le conteneur de base de la maquette). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Petit intitulé de section en majuscules espacées. */
export function SectionLabel({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[styles.sectionLabel, style]}>{children}</Text>;
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

/** Encart d'information chaud (fond crème orangé + icône). */
export function InfoBanner({ children, icon = 'info' }: { children: ReactNode; icon?: string }) {
  return (
    <View style={styles.info}>
      <Icon name={icon} size={20} color={colors.secondary} />
      <Text style={styles.infoText}>{children}</Text>
    </View>
  );
}

/** Pastille carrée avec initiales (logo restaurant de substitution). */
export function Avatar({
  initials,
  size = 44,
  bg = colors.warnBg,
  color = colors.primary,
  r = radius.tile,
}: {
  initials: string;
  size?: number;
  bg?: string;
  color?: string;
  r?: number;
}) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: r, backgroundColor: bg }]}>
      <Text style={{ fontFamily: fonts.extrabold, fontSize: size * 0.34, color }}>{initials}</Text>
    </View>
  );
}

/** Pastille « Ouvert » / « Fermé » à point coloré. */
export function OpenBadge({ open }: { open: boolean }) {
  return (
    <View style={[styles.openBadge, { backgroundColor: open ? colors.successBg : colors.divider }]}>
      <View style={[styles.dot, { backgroundColor: open ? colors.success : colors.textFaint }]} />
      <Text style={[styles.openText, { color: open ? colors.successDark : colors.textMuted }]}>
        {open ? 'Ouvert' : 'Fermé'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    ...shadow.card,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  divider: { height: 1, backgroundColor: colors.divider },
  info: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.warnBg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 18, color: colors.warnText },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
  openText: { fontFamily: fonts.semibold, fontSize: 11 },
});
