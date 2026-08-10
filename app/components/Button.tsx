import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, radius, shadow } from '../theme/tokens';

type Variant = 'primary' | 'outline' | 'dark';

/**
 * Bouton pilule pleine largeur, comme dans la maquette (h=56, radius=999).
 * variant primary = rouge, dark = encre, outline = blanc bordé.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const isPrimary = variant === 'primary';
  const isDark = variant === 'dark';
  const bg = isPrimary ? colors.primary : isDark ? colors.ink : colors.white;
  const fg = variant === 'outline' ? colors.ink : colors.white;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        variant === 'outline' && styles.outline,
        isPrimary && shadow.button,
        (disabled || loading) && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.88 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
          {iconRight ? <Icon name={iconRight} size={20} color={fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 15 },
});
