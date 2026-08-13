import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
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

  // Position GPS — OBLIGATOIRE pour valider (pas d'adressage postal à Nosy Be).
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; capturedAt: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  // Mode « nouvelle adresse » (vs. une adresse enregistrée sélectionnée).
  const [newMode, setNewMode] = useState(false);

  async function captureLocation() {
    setNewMode(true); // capter une position, c'est saisir une nouvelle adresse
    setGpsStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCoords(null);
        setGpsStatus('error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        capturedAt: new Date(pos.timestamp).toISOString(),
      });
      setGpsStatus('ok');
    } catch {
      setCoords(null);
      setGpsStatus('error');
    }
  }

  // Présélectionne l'adresse par défaut une fois les adresses chargées (sauf en mode nouvelle adresse).
  useEffect(() => {
    if (!newMode && !selectedId && saved && saved.length > 0) {
      const def = saved.find((a) => a.isDefault) ?? saved[0];
      setAddress(def.id);
    }
  }, [saved, selectedId, newMode, setAddress]);

  // Adresse enregistrée sélectionnée (null si on saisit une nouvelle).
  const selectedSaved = newMode ? null : saved?.find((a) => a.id === selectedId) ?? null;
  const savedHasGps = selectedSaved
    ? selectedSaved.latitude != null && selectedSaved.longitude != null
    : false;
  const newFormReady = !!coords && landmark.trim().length > 0 && phone.trim().length >= 6;
  // GPS OBLIGATOIRE : on ne peut continuer qu'avec une position (adresse enregistrée géolocalisée
  // ou nouvelle adresse dont la position a été captée).
  const canContinue = selectedSaved ? savedHasGps : newFormReady;

  async function confirm() {
    setError(null);
    if (!canContinue) return;
    // Adresse enregistrée (avec GPS) → on l'utilise telle quelle.
    if (selectedSaved) {
      setAddress(selectedSaved.id);
      router.push('/checkout');
      return;
    }
    // Nouvelle adresse — position GPS garantie par canContinue.
    setSaving(true);
    try {
      const addr = await createAddress({
        label: landmark.trim(),
        zone,
        landmark: landmark.trim(),
        phone: phone.trim(),
        instructions: instructions.trim() || undefined,
        isDefault: save,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        capturedAt: coords?.capturedAt ?? null,
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
                    onPress={() => {
                      setNewMode(false);
                      setAddress(a.id);
                    }}
                    style={[styles.addrCard, { borderColor: active ? colors.primary : colors.border }]}
                  >
                    <Icon name={a.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>{a.label}</Text>
                      <Text style={styles.addrDetail}>
                        {a.zone} · {a.phone}
                      </Text>
                      {a.latitude == null ? (
                        <Text style={styles.addrNoGps}>⚠ Sans position GPS — non utilisable pour livrer</Text>
                      ) : null}
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
                setNewMode(true);
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
                setNewMode(true);
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

          <Field label="Position GPS (obligatoire)">
            <Pressable
              style={[styles.gpsBtn, coords ? styles.gpsBtnOk : null]}
              onPress={captureLocation}
              disabled={gpsStatus === 'loading'}
            >
              {gpsStatus === 'loading' ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Icon
                    name={coords ? 'check_circle' : 'my_location'}
                    size={20}
                    color={coords ? colors.success : colors.primary}
                  />
                  <Text style={[styles.gpsBtnText, coords && { color: colors.successDark }]}>
                    {coords ? 'Position enregistrée' : 'Utiliser ma position actuelle'}
                  </Text>
                </>
              )}
            </Pressable>

            {coords ? (
              <>
                <Text style={styles.gpsCoords}>
                  ✓ {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </Text>
                <Pressable onPress={captureLocation} hitSlop={6}>
                  <Text style={styles.gpsLink}>Mettre à jour ma position</Text>
                </Pressable>
              </>
            ) : gpsStatus === 'error' ? (
              <View style={{ gap: 6 }}>
                <Text style={styles.gpsError}>
                  Localisation refusée ou indisponible. Active-la pour continuer — le livreur en a besoin
                  pour te trouver (pas d'adressage postal à Nosy Be).
                </Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Pressable onPress={captureLocation} hitSlop={6}>
                    <Text style={styles.gpsLink}>Réessayer</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      try {
                        void Linking.openSettings();
                      } catch {
                        /* non supporté (ex. web) */
                      }
                    }}
                    hitSlop={6}
                  >
                    <Text style={styles.gpsLink}>Ouvrir les réglages</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.gpsHint}>
                Nous avons besoin de ta position pour que le livreur te trouve — il n'y a pas
                d'adressage postal à Nosy Be.
              </Text>
            )}
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
        {!canContinue ? (
          <Text style={styles.blockMsg}>
            {selectedSaved
              ? "Cette adresse enregistrée n'a pas de position GPS — capte ta position ci-dessus pour continuer."
              : 'Capte ta position GPS ci-dessus pour continuer.'}
          </Text>
        ) : null}
        <Button label="Confirmer l'adresse" onPress={confirm} loading={saving} disabled={!canContinue} />
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
  gpsBtn: {
    minHeight: 50,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  gpsBtnOk: { borderColor: colors.success, borderStyle: 'solid', backgroundColor: colors.successBg },
  gpsBtnText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.primary },
  gpsCoords: { fontFamily: fonts.mono, fontSize: 12, color: colors.successDark, marginTop: 2 },
  gpsHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 2 },
  gpsError: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.dangerText },
  gpsLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  addrNoGps: { fontFamily: fonts.semibold, fontSize: 11, color: colors.warnTextAlt, marginTop: 4 },
  blockMsg: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginBottom: 10, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
});
