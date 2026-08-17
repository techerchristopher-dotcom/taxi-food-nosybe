import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { colors, fonts, radius } from '../theme/tokens';
import { COUNTRIES, Country, isValidNumber } from '../data/countries';

/**
 * Champ « numéro de téléphone » avec sélecteur d'indicatif.
 *
 * Partagé par l'écran de connexion SMS et l'écran de saisie du numéro après connexion
 * Google : les deux affichaient un `+261` figé, ce qui interdisait l'inscription aux
 * clients non malgaches (La Réunion en premier lieu).
 *
 * Le placeholder et la règle de validation suivent le pays choisi — voir `data/countries.ts`.
 */
export function PhoneField({
  label,
  country,
  onCountryChange,
  value,
  onChangeText,
  hint,
  autoFocus,
}: {
  label: string;
  country: Country;
  onCountryChange: (c: Country) => void;
  value: string;
  onChangeText: (v: string) => void;
  hint?: string;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const valid = isValidNumber(country, value);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, valid && { borderColor: colors.primary }]}>
        <Pressable onPress={() => setOpen(true)} style={styles.prefixBtn} hitSlop={6}>
          <Text style={styles.prefixFlag}>{country.flag}</Text>
          <Text style={styles.prefixDial}>{country.dial}</Text>
          <Icon name="expand_more" size={18} color={colors.textMuted} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          placeholder={country.example}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoFocus={autoFocus}
          maxLength={18}
        />
        {valid ? <Icon name="check_circle" size={20} color={colors.success} /> : null}
      </View>
      <Text style={styles.hint}>
        {hint ??
          (country.code === 'MG'
            ? t('phone.hintMg')
            : t('phone.hintOther', { country: country.name }))}
      </Text>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>{t('phone.countryLabel')}</Text>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            {COUNTRIES.map((c) => {
              const active = c.code === country.code;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    onCountryChange(c);
                    setOpen(false);
                  }}
                  style={[styles.row, active && styles.rowActive]}
                >
                  <Text style={styles.rowFlag}>{c.flag}</Text>
                  <Text style={styles.rowName}>{c.name}</Text>
                  <Text style={styles.rowDial}>{c.dial}</Text>
                  {active ? <Icon name="check" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 26, gap: 6 },
  label: {
    fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6,
    textTransform: 'uppercase', color: colors.textMuted,
  },
  field: {
    height: 56, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, gap: 10,
  },
  prefixBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingRight: 10, borderRightWidth: 1, borderRightColor: colors.borderStrong,
  },
  prefixFlag: { fontSize: 18 },
  prefixDial: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textDark },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: 0.6, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
    paddingHorizontal: 20, paddingTop: 10,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: 14,
  },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, marginBottom: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.input,
  },
  rowActive: { backgroundColor: colors.fieldBg },
  rowFlag: { fontSize: 22 },
  rowName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rowDial: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textMuted },
});
