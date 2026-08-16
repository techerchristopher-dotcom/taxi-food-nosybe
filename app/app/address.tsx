import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { Icon } from '../components/Icon';
import { SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { createAddress, listAddresses } from '../data/api';
import { useLoad } from '../lib/useLoad';
import { useCheckout } from '../store/checkout';
import { useSession } from '../store/session';

/**
 * Écran 06 — Adresse de livraison. La POSITION GPS est l'action principale : sans elle,
 * pas de livraison (pas d'adressage postal à Nosy Be). Le quartier est déduit
 * automatiquement de la position (repli « Nosy Be » si indisponible). Un seul champ libre
 * facultatif pour les précisions au livreur.
 */
export default function AddressScreen() {
  const router = useRouter();
  const selectedId = useCheckout((s) => s.addressId);
  const setAddress = useCheckout((s) => s.setAddress);
  const profilePhone = useSession((s) => s.session?.phone ?? '');

  const { data: saved } = useLoad(() => listAddresses(), []);

  const [phone, setPhone] = useState(() => profilePhone || '+261 ');
  const [note, setNote] = useState(''); // champ libre facultatif (précisions livreur)
  const [autoZone, setAutoZone] = useState('Nosy Be'); // déduit du GPS
  const [save, setSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Position GPS — OBLIGATOIRE pour valider.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; capturedAt: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [newMode, setNewMode] = useState(false);

  // Pulsation du bouton « Partager ma position » tant qu'aucune position n'est captée,
  // pour signaler au client qu'il doit appuyer dessus.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (coords || gpsStatus === 'loading') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.45, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [coords, gpsStatus, pulse]);

  async function captureLocation() {
    setNewMode(true);
    setGpsStatus('loading');
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCoords(null);
        setGpsStatus('error');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;
      setCoords({ latitude, longitude, capturedAt: new Date(pos.timestamp).toISOString() });
      setGpsStatus('ok');
      // Quartier déduit automatiquement (reverse geocoding — natif uniquement).
      if (Platform.OS !== 'web') {
        try {
          const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
          const z = g?.district || g?.subregion || g?.city || g?.region;
          if (z) setAutoZone(z);
        } catch {
          /* repli : on garde « Nosy Be » */
        }
      }
    } catch {
      setCoords(null);
      setGpsStatus('error');
    }
  }

  // Présélectionne l'adresse par défaut une fois chargées (sauf en mode nouvelle adresse).
  useEffect(() => {
    if (!newMode && !selectedId && saved && saved.length > 0) {
      const def = saved.find((a) => a.isDefault) ?? saved[0];
      setAddress(def.id);
    }
  }, [saved, selectedId, newMode, setAddress]);

  const selectedSaved = newMode ? null : saved?.find((a) => a.id === selectedId) ?? null;
  const savedHasGps = selectedSaved ? selectedSaved.latitude != null && selectedSaved.longitude != null : false;
  const newFormReady = !!coords && phone.trim().length >= 6;
  const canContinue = selectedSaved ? savedHasGps : newFormReady;

  async function confirm() {
    setError(null);
    if (!canContinue) return;
    if (selectedSaved) {
      setAddress(selectedSaved.id);
      router.push('/checkout');
      return;
    }
    setSaving(true);
    try {
      const addr = await createAddress({
        label: autoZone,
        zone: autoZone,
        landmark: note.trim(), // précisions → visibles par le livreur
        phone: phone.trim(),
        instructions: note.trim() || undefined,
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
        {/* ===== POSITION GPS — action principale ===== */}
        {!coords ? (
          <Animated.View
            style={{
              opacity: pulse,
              transform: [{ scale: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [0.985, 1] }) }],
            }}
          >
            <Pressable
              style={[styles.gpsHero, gpsStatus === 'error' && styles.gpsHeroError]}
              onPress={captureLocation}
              disabled={gpsStatus === 'loading'}
            >
              {gpsStatus === 'loading' ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Icon name="my_location" size={30} color={colors.white} />
                  <Text style={styles.gpsHeroTitle}>Partager ma position</Text>
                  <Text style={styles.gpsHeroSub}>
                    Obligatoire pour être livré — le livreur vous trouve grâce à votre position
                    (pas d'adressage postal à Nosy Be).
                  </Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.gpsOk}>
            <View style={styles.gpsOkTop}>
              <Icon name="check_circle" size={26} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsOkTitle}>Position enregistrée</Text>
                <Text style={styles.gpsOkZone}>{autoZone} · {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
              </View>
            </View>
            <Pressable onPress={captureLocation} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Text style={styles.gpsLink}>Actualiser ma position</Text>
            </Pressable>
          </View>
        )}

        {gpsStatus === 'error' ? (
          <View style={styles.gpsErrorBox}>
            <Text style={styles.gpsErrorText}>
              Localisation refusée ou indisponible. Active-la pour continuer.
            </Text>
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
              <Pressable onPress={captureLocation} hitSlop={6}><Text style={styles.gpsLink}>Réessayer</Text></Pressable>
              <Pressable onPress={() => { try { void Linking.openSettings(); } catch { /* web */ } }} hitSlop={6}>
                <Text style={styles.gpsLink}>Ouvrir les réglages</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ===== Champs secondaires ===== */}
        <View style={styles.fields}>
          <Field label="Téléphone de contact">
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t); setNewMode(true); }}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </Field>

          <Field label="Précisions pour le livreur (facultatif)">
            <TextInput
              value={note}
              onChangeText={(t) => { setNote(t); setNewMode(true); }}
              placeholder="Ex. prendre les escaliers · appart 5, code portail 12345 · maison bleue"
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
        </View>

        {/* ===== Adresses enregistrées (réutiliser) ===== */}
        {saved && saved.length > 0 ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.hr} />
              <SectionLabel>Ou réutiliser une adresse</SectionLabel>
              <View style={styles.hr} />
            </View>
            <View style={{ gap: 10 }}>
              {saved.map((a) => {
                const active = !newMode && a.id === selectedId;
                const noGps = a.latitude == null;
                return (
                  <Pressable
                    key={a.id}
                    onPress={() => { if (!noGps) { setNewMode(false); setAddress(a.id); } }}
                    style={[styles.addrCard, { borderColor: active ? colors.primary : colors.border, opacity: noGps ? 0.6 : 1 }]}
                  >
                    <Icon name={a.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addrLabel}>{a.zone}{a.landmark ? ` — ${a.landmark}` : ''}</Text>
                      <Text style={styles.addrDetail}>{a.phone}</Text>
                      {noGps ? <Text style={styles.addrNoGps}>⚠ Sans position GPS — non utilisable</Text> : null}
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
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <BottomBar>
        {!canContinue ? (
          <Text style={styles.blockMsg}>
            {selectedSaved
              ? "Cette adresse n'a pas de position GPS — partage ta position ci-dessus."
              : 'Partage ta position GPS ci-dessus pour continuer.'}
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
  gpsHero: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 8,
  },
  gpsHeroError: { backgroundColor: colors.dangerText },
  gpsHeroTitle: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.white, marginTop: 4 },
  gpsHeroSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.92)', textAlign: 'center' },
  gpsOk: {
    backgroundColor: colors.successBg,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.success,
    padding: 18,
    gap: 12,
  },
  gpsOkTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  gpsOkTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.successDark },
  gpsOkZone: { fontFamily: fonts.regular, fontSize: 12, color: colors.textDark, marginTop: 2 },
  gpsErrorBox: { marginTop: 12 },
  gpsErrorText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.dangerText },
  gpsLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  fields: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14, marginTop: 16 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
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
  textarea: { minHeight: 64, paddingTop: 12, textAlignVertical: 'top' },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { width: 44, height: 26, borderRadius: radius.pill, justifyContent: 'center', paddingHorizontal: 3 },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.white },
  saveText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  hr: { flex: 1, height: 1, backgroundColor: colors.photoGrayB },
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
  addrNoGps: { fontFamily: fonts.semibold, fontSize: 11, color: colors.warnTextAlt, marginTop: 4 },
  blockMsg: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textMuted, marginBottom: 10, textAlign: 'center' },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
});
