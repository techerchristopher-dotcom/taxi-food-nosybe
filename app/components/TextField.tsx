import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';

/**
 * Champ de saisie des écrans d'authentification (nom, e-mail, mot de passe).
 *
 * Reprend exactement la boîte 56 px des autres écrans (`PhoneField`, saisie du code SMS)
 * pour que les formulaires e-mail ne détonnent pas dans le parcours existant.
 * `secure` ajoute l'œil afficher/masquer — sans lui, un mot de passe saisi sur un
 * téléphone en plein soleil se tape à l'aveugle.
 */
export function TextField({
  label,
  icon,
  secure,
  ...input
}: {
  label: string;
  icon?: string;
  secure?: boolean;
} & TextInputProps) {
  const [revealed, setRevealed] = useState(false);
  const filled = Boolean(input.value);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, filled && { borderColor: colors.primary }]}>
        {icon ? <Icon name={icon} size={20} color={colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          secureTextEntry={secure && !revealed}
          {...input}
        />
        {secure ? (
          <Pressable onPress={() => setRevealed((v) => !v)} hitSlop={10}>
            <Icon
              name={revealed ? 'visibility_off' : 'visibility'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 18, gap: 6 },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  field: {
    height: 56,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
