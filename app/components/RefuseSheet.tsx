import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { REFUSAL_REASONS } from '../data/types';

/**
 * Feuille de refus d'une commande : choix rapide d'un motif prédéfini + précision libre
 * optionnelle. Un motif (ou une précision) est obligatoire. Le motif final envoyé à
 * `set_order_status` combine le libellé choisi et la précision.
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
  onConfirm: (reason: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string | null>(null);
  const [precision, setPrecision] = useState('');

  const trimmed = precision.trim();
  const canConfirm = Boolean(selected || trimmed);

  function confirm() {
    const reason = selected ? (trimmed ? `${selected} — ${trimmed}` : selected) : trimmed;
    if (!reason) return;
    onConfirm(reason);
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
        <Text style={styles.title}>Refuser la commande{orderNumber ? ` #${orderNumber}` : ''}</Text>
        <Text style={styles.sub}>Choisis un motif — le client le verra sur son suivi.</Text>

        <View style={styles.chips}>
          {REFUSAL_REASONS.map((r) => {
            const active = selected === r;
            return (
              <Pressable
                key={r}
                onPress={() => setSelected(active ? null : r)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Précision (facultatif)"
          placeholderTextColor={colors.textFaint}
          value={precision}
          onChangeText={setPrecision}
          multiline
          editable={!submitting}
        />

        <View style={styles.actions}>
          <Button
            label="Annuler"
            variant="outline"
            onPress={() => {
              reset();
              onCancel();
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Confirmer le refus"
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
  input: {
    marginTop: 14,
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
