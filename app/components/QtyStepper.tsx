import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Sélecteur de quantité pilule : [-] n [+].
 * Le [-] est neutre (fond crème), le [+] est rouge, comme dans la maquette.
 * `size` module les dimensions (menu = sm, fiche produit = lg).
 */
export function QtyStepper({
  value,
  onDec,
  onInc,
  size = 'md',
}: {
  value: number;
  onDec: () => void;
  onInc: () => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dims = {
    sm: { h: 32, btn: 26, ico: 16, font: 13, pad: 4, gap: 6 },
    md: { h: 38, btn: 30, ico: 18, font: 14, pad: 4, gap: 8 },
    lg: { h: 52, btn: 40, ico: 20, font: 18, pad: 6, gap: 8 },
  }[size];

  return (
    <View style={[styles.wrap, { height: dims.h, paddingHorizontal: dims.pad, gap: dims.gap }]}>
      <Pressable
        onPress={onDec}
        hitSlop={6}
        style={[styles.btn, { width: dims.btn, height: dims.btn, backgroundColor: colors.white }]}
      >
        <Icon name="remove" size={dims.ico} color={colors.textDark} />
      </Pressable>
      <Text style={[styles.value, { fontSize: dims.font }]}>{value}</Text>
      <Pressable
        onPress={onInc}
        hitSlop={6}
        style={[styles.btn, { width: dims.btn, height: dims.btn, backgroundColor: colors.primary }]}
      >
        <Icon name="add" size={dims.ico} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.fieldBg,
  },
  btn: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: fonts.bold, color: colors.ink, minWidth: 16, textAlign: 'center' },
});
