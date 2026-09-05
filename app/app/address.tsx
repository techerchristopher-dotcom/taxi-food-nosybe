import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { MapPreview } from '../components/MapPreview';
import { SectionLabel } from '../components/primitives';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { BottomBar } from '../components/BottomBar';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { createAddress, listAddresses } from '../data/api';
import { formatAddressLine } from '../data/types';
import { useLoad } from '../lib/useLoad';
import { useCheckout } from '../store/checkout';
import { useSession } from '../store/session';
import { useAuthIntent } from '../store/authIntent';

/**
 * Écran 06 — Adresse de livraison. La POSITION GPS est l'action principale : sans elle,
 * pas de livraison (pas d'adressage postal à Nosy Be). Le quartier est déduit
 * automatiquement de la position (repli « Nosy Be » si indisponible). Un seul champ libre
 * facultatif pour les précisions au livreur.
 */
/**
 * Ligne d'adresse la plus PRÉCISE que sait donner le géocodage inverse : numéro + rue,
 * sinon le nom du lieu/POI, complété du quartier s'il n'y figure pas déjà.
 * On n'utilise jamais `region` (« Province d'Antsiranana ») : trop large pour livrer.
 */
function preciseLine(g?: Location.LocationGeocodedAddress): string {
  if (!g) return '';
  const streetPart = [g.streetNumber, g.street].filter(Boolean).join(' ').trim();
  const head = streetPart || g.name?.trim() || '';
  const area = (g.district || g.subregion || g.city || '').trim();
  if (!head) return area;
  if (area && !head.toLowerCase().includes(area.toLowerCase())) return `${head}, ${area}`;
  return head;
}

/**
 * GARDE UNIQUE DU TUNNEL DE COMMANDE.
 *
 * Ni le bouton « Commander » du panier ni `/checkout` n'en ont : un seul verrou, ici.
 * `/address` est la première étape liée au compte (adresses enregistrées, création
 * d'adresse, téléphone du profil) et tout chemin vers le paiement y passe — bouton du
 * panier, lien « Modifier » de `/checkout`, lien profond, notification.
 *
 * Navigation IMPÉRATIVE et non `<Redirect>` : il faut la garantie que l'intention est
 * posée AVANT la navigation. Avec `<Redirect>`, l'effet de l'enfant part avant celui du
 * parent, et l'ordre devient une question à laquelle on ne veut pas avoir à répondre.
 *
 * ⚠️ `replace` et non `push` : l'écran d'adresse quitte la pile, donc le retour depuis la
 * connexion ramène au panier. Avec `push`, ce retour repasserait par `/address`, qui
 * redirigerait aussitôt vers `/login` — boucle.
 *
 * Découpage en deux composants (et non un `if` en tête de l'existant) : les quinze hooks
 * du formulaire — dont `useLoad(listAddresses)` et l'animation de pulsation — ne doivent
 * pas s'exécuter pour quelqu'un qui va être redirigé.
 */
export default function AddressScreen() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const clearIntent = useAuthIntent((s) => s.clear);

  useEffect(() => {
    if (session) {
      // Arrivé à destination : une intention ne sert qu'une fois. `app/index.tsx` l'a
      // normalement déjà consommée en nous envoyant ici ; ce second effacement couvre les
      // entrées qui ne passent pas par l'aiguillage (lien profond, lien « Modifier » de
      // `/checkout`) et ne coûte rien quand il n'y a rien à effacer.
      clearIntent();
      return;
    }
    useAuthIntent.getState().set('/address');
    router.replace('/login');
  }, [session, router, clearIntent]);

  // Le temps de la bascule (une frame) : fond neutre, pas de spinner — un spinner
  // laisserait croire à un chargement alors qu'on quitte l'écran.
  if (!session) return <View style={styles.container} />;
  return <AddressForm />;
}

/** Écran 06 — Adresse de livraison (formulaire, réservé aux comptes connectés). */
function AddressForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const selectedId = useCheckout((s) => s.addressId);
  const setAddress = useCheckout((s) => s.setAddress);
  const profilePhone = useSession((s) => s.session?.phone ?? '');

  const { data: saved } = useLoad(() => listAddresses(), []);

  const [phone, setPhone] = useState(() => profilePhone || '+261 ');
  const [note, setNote] = useState(''); // champ libre facultatif (précisions livreur)
  const [autoZone, setAutoZone] = useState('Nosy Be'); // quartier, déduit du GPS
  // Adresse précise (rue / repère). Pré-remplie par le géocodage inverse mais TOUJOURS
  // éditable : le géocodage est souvent approximatif à Nosy Be, le client corrige.
  const [street, setStreet] = useState('');
  const [streetTouched, setStreetTouched] = useState(false);
  const [save, setSave] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Position GPS — OBLIGATOIRE pour valider.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; capturedAt: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  // Cause de l'echec, pour dire au client quoi faire plutot qu'un message fourre-tout.
  const [gpsCause, setGpsCause] = useState<EchecPosition | null>(null);
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


/**
 * Position sur le WEB — pourquoi on n'utilise pas `expo-location` ici.
 *
 * Deux défauts rendaient la localisation inutilisable dans un navigateur, et les
 * deux se présentaient de la même façon : le bouton tournait indéfiniment.
 *
 * 1. `getCurrentPositionAsync` n'expose AUCUN délai maximum. Sur le web il tombe
 *    sur `navigator.geolocation.getCurrentPosition`, qui, sans `timeout`, peut
 *    attendre pour toujours — cas courant sur un ordinateur de bureau sans GPS,
 *    où le navigateur interroge un service de géolocalisation qui ne répond pas.
 * 2. `Accuracy.High` demande `enableHighAccuracy`, qui sur un ordinateur force le
 *    navigateur à chercher une précision qu'il ne peut pas atteindre. On demande
 *    donc la précision réseau, largement suffisante pour livrer.
 *
 * On distingue aussi les trois causes d'échec : refus, délai dépassé, position
 * indisponible. Un message unique « refusée ou indisponible » envoyait le client
 * vérifier ses permissions alors que le problème était souvent le délai.
 */
type EchecPosition = 'refus' | 'delai' | 'indisponible';

function positionWeb(): Promise<{ latitude: number; longitude: number; timestamp: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject('indisponible' as EchecPosition);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, timestamp: pos.timestamp }),
      (err) => {
        // 1 = refus, 2 = position indisponible, 3 = delai depasse
        reject((err.code === 1 ? 'refus' : err.code === 3 ? 'delai' : 'indisponible') as EchecPosition);
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
    );
  });
}

  async function captureLocation() {
    setNewMode(true);
    setGpsStatus('loading');
    setError(null);
    setGpsCause(null);
    try {
      let latitude: number;
      let longitude: number;
      let horodatage: number;

      if (Platform.OS === 'web') {
        // Pas de demande de permission séparée : c'est l'appel lui-même qui fait
        // apparaître la demande du navigateur. Passer par
        // `requestForegroundPermissionsAsync` d'abord renvoyait « granted » sans
        // rien demander, puis l'appel échouait — d'où un refus invisible.
        const p = await positionWeb();
        latitude = p.latitude;
        longitude = p.longitude;
        horodatage = p.timestamp;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCoords(null);
          setGpsCause('refus');
          setGpsStatus('error');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
        horodatage = pos.timestamp;
      }

      setCoords({ latitude, longitude, capturedAt: new Date(horodatage).toISOString() });
      setGpsStatus('ok');
      // Quartier + rue déduits automatiquement (reverse geocoding — natif uniquement).
      if (Platform.OS !== 'web') {
        try {
          const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
          // `region` est volontairement exclu : à Nosy Be il vaut « Province d'Antsiranana »,
          // une zone administrative inutilisable pour un livreur — c'était le bug signalé.
          const z = g?.district || g?.subregion || g?.city;
          if (z) setAutoZone(z);
          // Ne jamais écraser ce que le client a déjà tapé.
          if (!streetTouched) {
            const s = preciseLine(g);
            if (s) setStreet(s);
          }
        } catch {
          /* repli : on garde « Nosy Be » et le champ rue vide, à saisir à la main */
        }
      }
    } catch (e) {
      setCoords(null);
      setGpsCause(
        e === 'refus' || e === 'delai' || e === 'indisponible' ? (e as EchecPosition) : null,
      );
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
  // L'adresse précise est exigée : c'est elle que lit le livreur, la position GPS seule
  // ne suffisait pas à écrire une ligne d'adresse lisible.
  const newFormReady = !!coords && phone.trim().length >= 6 && street.trim().length >= 3;
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
        // `label` = l'adresse précise, `zone` = le quartier. Les deux valaient auparavant
        // la même zone administrative, d'où le « Province d'Antsiranana — Province
        // d'Antsiranana » affiché à la validation de commande.
        label: street.trim() || autoZone,
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
      setError(t('address.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Header title={t('address.title')} />

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
                  <Text style={styles.gpsHeroTitle}>{t('address.shareTitle')}</Text>
                  <Text style={styles.gpsHeroSub}>{t('address.shareSub')}</Text>
                </>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.gpsOk}>
            <View style={styles.gpsOkTop}>
              <Icon name="check_circle" size={26} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsOkTitle}>{t('address.captured')}</Text>
                <Text style={styles.gpsOkZone}>{autoZone} · {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
              </View>
            </View>
            <MapPreview latitude={coords.latitude} longitude={coords.longitude} label={autoZone} />
            <Text style={styles.mapHint}>{t('address.mapHint')}</Text>
            <Pressable onPress={captureLocation} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
              <Text style={styles.gpsLink}>{t('address.refresh')}</Text>
            </Pressable>
          </View>
        )}

        {gpsStatus === 'error' ? (
          <View style={styles.gpsErrorBox}>
            <Text style={styles.gpsErrorText}>
              {gpsCause === 'refus'
                ? t('address.gpsDenied')
                : gpsCause === 'delai'
                  ? t('address.gpsTimeout')
                  : gpsCause === 'indisponible'
                    ? t('address.gpsUnavailable')
                    : t('address.gpsError')}
            </Text>
            {/* ⚠️ Sur le web, `Linking.openSettings()` ne fait RIEN — il n'existe que
                sur mobile, et son echec etait avale en silence : un bouton mort, ce
                qui est pire que pas de bouton du tout. Un navigateur ne laisse
                d'ailleurs aucune page ouvrir ses reglages de permission, par
                conception. On donne donc le chemin exact a la place.
                Et quand la permission a ete REFUSEE, « Réessayer » seul ne sert a
                rien : le navigateur ne redemande plus, il faut d'abord debloquer. */}
            {Platform.OS === 'web' && gpsCause === 'refus' ? (
              <Text style={styles.mapHint}>{t('address.gpsWebHowTo')}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 18, marginTop: 6 }}>
              <Pressable onPress={captureLocation} hitSlop={6}><Text style={styles.gpsLink}>{t('common.retry')}</Text></Pressable>
              {Platform.OS !== 'web' ? (
                <Pressable onPress={() => { void Linking.openSettings(); }} hitSlop={6}>
                  <Text style={styles.gpsLink}>{t('common.openSettings')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ===== Champs secondaires ===== */}
        <View style={styles.fields}>
          {/* Adresse précise — pré-remplie par le GPS, mais toujours modifiable :
              le géocodage inverse est approximatif à Nosy Be. */}
          <Field label={t('address.streetLabel')}>
            <TextInput
              value={street}
              onChangeText={(t) => { setStreet(t); setStreetTouched(true); setNewMode(true); }}
              placeholder={t('address.streetPlaceholder')}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
            />
            <Text style={styles.fieldHint}>{t('address.streetHint')}</Text>
          </Field>

          <Field label={t('address.phoneLabel')}>
            <TextInput
              value={phone}
              onChangeText={(t) => { setPhone(t); setNewMode(true); }}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </Field>

          <Field label={t('address.noteLabel')}>
            <TextInput
              value={note}
              onChangeText={(t) => { setNote(t); setNewMode(true); }}
              placeholder={t('address.notePlaceholder')}
              placeholderTextColor={colors.textFaint}
              multiline
              style={[styles.input, styles.textarea]}
            />
          </Field>

          <Pressable style={styles.saveRow} onPress={() => setSave((v) => !v)}>
            <View style={[styles.toggle, { backgroundColor: save ? colors.primary : colors.borderStrong, alignItems: save ? 'flex-end' : 'flex-start' }]}>
              <View style={styles.knob} />
            </View>
            <Text style={styles.saveText}>{t('address.saveAddress')}</Text>
          </Pressable>
        </View>

        {/* ===== Adresses enregistrées (réutiliser) ===== */}
        {saved && saved.length > 0 ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.hr} />
              <SectionLabel>{t('address.reuse')}</SectionLabel>
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
                      <Text style={styles.addrLabel}>{formatAddressLine(a.zone, a.label)}</Text>
                      <Text style={styles.addrDetail}>{a.phone}</Text>
                      {noGps ? <Text style={styles.addrNoGps}>{t('address.noGps')}</Text> : null}
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
              ? t('address.blockSavedNoGps')
              : !coords
                ? t('address.blockNoGps')
                : street.trim().length < 3
                  ? t('address.blockNoStreet')
                  : t('address.blockNoPhone')}
          </Text>
        ) : null}
        <Button label={t('address.confirm')} onPress={confirm} loading={saving} disabled={!canContinue} />
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
  mapHint: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.textMuted, marginTop: -2 },
  fields: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 14, marginTop: 16 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  fieldHint: { fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: colors.textMuted },
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
