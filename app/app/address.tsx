import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Card, SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { nosyBeZones } from '../data/types';
import { createAddress, listAddresses } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { useCheckout } from '../store/checkout';

/** Écran 06 — Adresse de livraison (choix d'une adresse enregistrée ou saisie). */
export default function AddressScreen() {
  const router = useRouter();
  const selectedId = useCheckout((s) => s.addressId);
  const setAddress = useCheckout((s) => s.setAddress);

  const { data: saved } = useLoad(() => listAddresses(), []);

  const [zone, setZone] = useState(nosyBeZones[3]); // Madirokely
  const [zoneOpen, setZoneOpen] = useState(false);
  const [landmark, setLandmark] = useState('');
  const [phone, setPhone] = useState('+261 ');
  const [instructions, setInstructions] = useState('');
  const [save, setSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Présélectionne l'adresse par défaut une fois les adresses chargées.
  useEffect(() => {
    if (!selectedId && saved && saved.length > 0) {
      const def = saved.find((a) => a.isDefault) ?? saved[0];
      setAddress(def.id);
    }
  }, [saved, selectedId, setAddress]);

  async function confirm() {
    setError(null);
    // Une adresse enregistrée est sélectionnée → on l'utilise telle quelle.
    if (selectedId && saved?.some((a) => a.id === selectedId)) {
      router.push('/checkout');
      return;
    }
    // Sinon, on crée la nouvelle adresse saisie.
    if (!landmark.trim() || phone.trim().length < 6) {
      setError('Renseigne au moins un point de repère et un téléphone.');
      return;
    }
    setSaving(true);
    try {
      const addr = await createAddress({
        label: landmark.trim(),
        zone,
        landmark: landmark.trim(),
        phone: phone.trim(),
        instructions: instructions.trim() || undefined,
        isDefault: save,
      });
      setAddress(addr.id);
      router.push('/checkout');
    } catch {
      setError("Impossible d'enregistrer l'adresse. Réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title="Adresse de livraison" />

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {saved && saved.length > 0 ? (
          <>
            <SectionLabel style={{ marginBottom: 10 }}>Mes adresses</SectionLabel>
            <View style={{ gap: 10 }}>
              {saved.map((a) => {
                const active = a.id === selectedId;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => setAddress(a.id)}
                    style={[styles.addrCard, { borderColor: active ? colors.primary : colors.border }]}
                  >
                    <Icon name={a.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>{a.label}</Text>
                      <Text style={styles.addrDetail}>
                        {a.zone} · {a.phone}
                      </Text>
                    </View>
                    <Icon
                      name={active ? 'radio_button_checked' : 'radio_button_unchecked'}
                      size={22}
                      color={active ? colors.primary : colors.borderStrong}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.hr} />
              <SectionLabel>Nouvelle adresse</SectionLabel>
              <View style={styles.hr} />
            </View>
          </>
        ) : (
          <SectionLabel style={{ marginBottom: 10 }}>Où livrer ?</SectionLabel>
        )}

        <Card style={{ gap: 14 }}>
          <Field label="Quartier / zone">
            <Pressable
              style={styles.select}
              onPress={() => {
                setZoneOpen((v) => !v);
                setAddress('');
              }}
            >
              <Text style={styles.selectText}>{zone}</Text>
              <Icon name="expand_more" size={20} color={colors.textMuted} />
            </Pressable>
            {zoneOpen ? (
              <View style={styles.dropdown}>
                {nosyBeZones.map((z) => (
                  <Pressable
                    key={z}
                    style={styles.dropItem}
                    onPress={() => {
                      setZone(z);
                      setZoneOpen(false);
                    }}
                  >
                    <Text style={[styles.dropText, z === zone && { color: colors.primary, fontFamily: fonts.semibold }]}>
                      {z}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Field>

          <Field label="Point de repère">
            <TextInput
              value={landmark}
              onChangeText={(t) => {
                setLandmark(t);
                setAddress('');
              }}
              placeholder="Ex. hôtel, boutique, école…"
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
          </Field>

          <Field label="Téléphone de contact">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </Field>

          <Field label="Instructions pour le livreur">
            <TextInput
              value={instructions}
              onChangeText={setInstructions}
              placeholder="« Maison bleue à côté du terrain de foot, portail vert »"
              placeholderTextColor={colors.textFaint}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </Field>

          <Pressable style={styles.saveRow} onPress={() => setSave((v) => !v)}>
            <View style={[styles.toggle, { backgroundColor: save ? colors.primary : colors.borderStrong, alignItems: save ? 'flex-end' : 'flex-start' }]}>
              <View style={styles.knob} />
            </View>
            <Text style={styles.saveText}>Enregistrer cette adresse</Text>
          </Pressable>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BottomBar>
        <Button label="Confirmer l'adresse" onPress={confirm} loading={saving} />
      </BottomBar>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  addrCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  addrDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  hr: { flex: 1, height: 1, backgroundColor: colors.photoGrayB },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  select: {
    height: 50,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  selectText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
  dropdown: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    overflow: 'hidden',
  },
  dropItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dropText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textDark },
  input: {
    minHeight: 50,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  textarea: { minHeight: 60, paddingTop: 12, textAlignVertical: 'top' },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { width: 44, height: 26, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 3 },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.white },
  saveText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
});
