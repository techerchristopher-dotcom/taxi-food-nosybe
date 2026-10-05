import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { REFUSAL_CODES, REFUSAL_PRECISION_MAX, type RefusalCode } from '../data/types';

/**
 * Feuille de refus d'une commande : un motif prédéfini en un tap (obligatoire) + une
 * précision libre facultative (obligatoire pour « Autre raison »). On envoie le CODE et la
 * précision à `set_order_status` : c'est la base qui compose le texte lu par le client
 * (`cancellation_reason`) — l'écran n'est jamais l'autorité. Mêmes codes que la page
 * Telegram `/r-refus/…` (2026-10-05).
 */
export function RefuseSheet({
  visible,
  orderNumber,
  submitting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  orderNumber?: string;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (refus: { code: RefusalCode; precision: string | null }) => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RefusalCode | null>(null);
  const [precision, setPrecision] = useState('');

  // Chaque ouverture repart à zéro : le motif de la commande précédente ne doit pas
  // rester coché pour la suivante.
  useEffect(() => {
    if (visible) {
      setSelected(null);
      setPrecision('');
    }
  }, [visible]);

  const trimmed = precision.trim();
  const precisionManquante = selected === 'autre' && !trimmed;
  const canConfirm = Boolean(selected) && !precisionManquante;

  function confirm() {
    if (!selected || precisionManquante) return;
    onConfirm({ code: selected, precision: trimmed || null });
  }

  function reset() {
    setSelected(null);
    setPrecision('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!submitting) {
            reset();
            onCancel();
          }
        }}
      />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>
          {t('refusal.sheetTitle')}
          {orderNumber ? ` #${orderNumber}` : ''}
        </Text>
        <Text style={styles.sub}>{t('refusal.sheetSub')}</Text>

        <View style={styles.chips}>
          {REFUSAL_CODES.map((code) => {
            const active = selected === code;
            return (
              <Pressable
                key={code}
                onPress={() => setSelected(active ? null : code)}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {t(`refusal.chips.${code}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* La phrase exacte que lira le client, pour que le restaurant sache ce qu'il envoie. */}
        {selected && selected !== 'autre' ? (
          <Text style={styles.apercu}>« {t(`refusal.codes.${selected}`)} »</Text>
        ) : null}

        <Text style={styles.label}>{t('refusal.precisionLabel')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('refusal.precisionPlaceholder')}
          placeholderTextColor={colors.textFaint}
          value={precision}
          onChangeText={setPrecision}
          maxLength={REFUSAL_PRECISION_MAX}
          multiline
          editable={!submitting}
        />
        {precisionManquante ? <Text style={styles.hint}>{t('refusal.precisionRequired')}</Text> : null}

        <View style={styles.actions}>
          <Button
            label={t('refusal.cancel')}
            variant="outline"
            onPress={() => {
              reset();
              onCancel();
            }}
            style={{ flex: 1 }}
          />
          <Button
            label={t('refusal.confirm')}
            onPress={confirm}
            loading={submitting}
            disabled={!canConfirm}
            style={{ flex: 1.4 }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: spacing.screen,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: 14 },
  title: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.ink, letterSpacing: -0.4 },
  sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.dangerBg },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDark },
  chipTextActive: { color: colors.dangerText },
  apercu: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 10, fontStyle: 'italic' },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textDark, marginTop: 14 },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.dangerText, marginTop: 6 },
  input: {
    marginTop: 6,
    minHeight: 48,
    borderRadius: radius.tile,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
});
