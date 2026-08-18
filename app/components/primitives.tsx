import { ReactNode, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius, shadow } from '../theme/tokens';
import { thumbnailUrl } from '../data/types';

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

/**
 * Logo de restaurant : affiche l'image `logo_url` (redimensionnée) si présente et chargeable,
 * sinon un repli propre = pastille d'initiales (jamais de case vide).
 */
export function RestaurantLogo({
  uri,
  initials,
  size = 44,
  r = radius.tile,
  bg = colors.warnBg,
  color = colors.primary,
}: {
  uri?: string | null;
  initials: string;
  size?: number;
  r?: number;
  bg?: string;
  color?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri: thumbnailUrl(uri, size) }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={220}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: r, backgroundColor: colors.fieldBg }}
      />
    );
  }
  return <Avatar initials={initials} size={size} r={r} bg={bg} color={color} />;
}

/** Pastille « Ouvert » / « Fermé » à point coloré. */
export function OpenBadge({ open }: { open: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.openBadge, { backgroundColor: open ? colors.successBg : colors.divider }]}>
      <View style={[styles.dot, { backgroundColor: open ? colors.success : colors.textFaint }]} />
      <Text style={[styles.openText, { color: open ? colors.successDark : colors.textMuted }]}>
        {open ? t('restaurantCard.open') : t('restaurantCard.closed')}
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
