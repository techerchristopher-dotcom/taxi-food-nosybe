import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Vignette produit. La maquette utilise un aplat chaud rayé comme placeholder de photo
 * (aucune photo réelle en MVP). On reprend le ton chaud + un petit label mono optionnel.
 * `muted` = variante grisée pour un produit indisponible / restaurant fermé.
 */
export function ProductThumb({
  label,
  size = 64,
  radius: r = radius.tile,
  muted = false,
  style,
}: {
  label?: string;
  size?: number;
  radius?: number;
  muted?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: muted ? colors.photoGrayB : colors.photoWarmB,
        },
        style,
      ]}
    >
      {label ? (
        <Text style={[styles.label, muted && { color: colors.textFaint }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.photoWarmText,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
});
