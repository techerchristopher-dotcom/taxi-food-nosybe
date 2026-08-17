import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { PhoneField } from '../components/PhoneField';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';
import { PhoneAlreadyUsedError } from '../lib/auth';
import { Country, DEFAULT_COUNTRY, isValidNumber, toE164 } from '../data/countries';

/** Écran 01b — Saisie du numéro de téléphone (1re connexion, une seule fois). */
export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const setPhone = useSession((s) => s.setPhone);
  const [digits, setDigits] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Longueur attendue selon le pays choisi (voir `data/countries.ts`).
  const valid = isValidNumber(country, digits);

  async function handleContinue() {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      // Stocké en E.164 : même format que le numéro d'authentification, donc comparable.
      await setPhone(toE164(country, digits));
      router.replace('/(tabs)');
    } catch (e: unknown) {
      // Le numéro est unique en base : s'il est déjà pris, on le dit au lieu de laisser
      // l'écran figé sur une erreur silencieuse.
      setError(e instanceof PhoneAlreadyUsedError ? t('phone.alreadyUsed') : t('phone.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 16, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Icon name="arrow_back" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.iconTile}>
            <Icon name="smartphone" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('phone.askTitle')}</Text>
          <Text style={styles.subtitle}>{t('phone.askSubtitle')}</Text>

          <PhoneField
            label={t('phone.askLabel')}
            country={country}
            onCountryChange={setCountry}
            value={digits}
            onChangeText={setDigits}
            autoFocus
          />

          {session ? (
            <View style={styles.connectedBox}>
              <Icon name="info" size={20} color={colors.secondary} />
              <Text style={styles.connectedText}>
                {t('phone.connectedAs')} <Text style={styles.strong}>{session.fullName}</Text> ·{' '}
                {session.email}
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flex: 1 }} />
          <Button label={t('phone.continue')} onPress={handleContinue} disabled={!valid || busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.warnBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.ink, marginTop: 18 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textDark, marginTop: 10 },
  connectedBox: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.warnBg,
    alignItems: 'flex-start',
  },
  connectedText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.warnText },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
  strong: { fontFamily: fonts.bold },
});
