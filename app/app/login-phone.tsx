import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { PhoneField } from '../components/PhoneField';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';
import { Country, DEFAULT_COUNTRY, isValidNumber, toE164 } from '../data/countries';

/**
 * Connexion par numéro de téléphone. Nécessite le provider phone dans Supabase.
 *
 * Le code de vérification arrive par **WhatsApp** (Send SMS Hook → Edge Function
 * `send-otp-whatsapp`) : le numéro saisi doit donc avoir WhatsApp, ce que le sous-titre
 * de l'écran annonce.
 */
export default function LoginPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const signInWithPhone = useSession((s) => s.signInWithPhone);
  const verifyPhoneOtp = useSession((s) => s.verifyPhoneOtp);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Format E.164 + validation dépendants du pays choisi (pas de règle malgache figée).
  const fullPhone = toE164(country, phone);
  const phoneValid = isValidNumber(country, phone);
  const otpValid = otp.replace(/\D/g, '').length === 6;

  async function handleSendOtp() {
    if (!phoneValid) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPhone(fullPhone);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('phone.sendFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!otpValid) return;
    setError(null);
    setLoading(true);
    try {
      // La session renvoyée est LUE CÔTÉ SERVEUR (profiles + rôles) juste après la
      // validation de l'OTP. Si le profil porte déjà un numéro, le compte existe :
      // on entre directement dans l'app, sans repasser par la création de profil.
      // Sinon `/` aiguille vers la suite de l'inscription.
      const session = await verifyPhoneOtp(fullPhone, otp.trim());
      if (session) router.replace(session.phone ? '/(tabs)' : '/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('phone.otpFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

          {step === 'phone' ? (
            <>
              <Text style={styles.title}>{t('phone.loginTitle')}</Text>
              <Text style={styles.subtitle}>{t('phone.loginSubtitle')}</Text>
              {/* Indicatif sélectionnable — Madagascar par défaut, ouvert aux clients
                  étrangers (La Réunion en tête). */}
              <PhoneField
                label={t('phone.fieldLabel')}
                country={country}
                onCountryChange={setCountry}
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ flex: 1 }} />
              <Button label={loading ? t('phone.sending') : t('phone.sendCode')} onPress={handleSendOtp} disabled={!phoneValid || loading} />
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('phone.otpTitle')}</Text>
              <Text style={styles.subtitle}>{t('phone.otpSubtitle', { phone: fullPhone })}</Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>{t('phone.otpLabel')}</Text>
                <View style={[styles.field, otpValid && { borderColor: colors.primary }]}>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    placeholder="123456"
                    placeholderTextColor={colors.textFaint}
                    style={[styles.input, { letterSpacing: 8, textAlign: 'center' }]}
                    autoFocus
                    maxLength={6}
                  />
                </View>
              </View>
              <Pressable onPress={() => { setStep('phone'); setError(null); setOtp(''); }} hitSlop={8} style={{ marginTop: 12 }}>
                <Text style={styles.link}>{t('phone.changeNumber')}</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ flex: 1 }} />
              <Button label={loading ? t('phone.verifying') : t('phone.confirm')} onPress={handleVerify} disabled={!otpValid || loading} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: { paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  iconTile: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: colors.warnBg,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 30, letterSpacing: -0.5, color: colors.ink, marginTop: 18 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textDark, marginTop: 10 },
  fieldBlock: { marginTop: 26, gap: 6 },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  field: {
    height: 56, borderRadius: radius.input, borderWidth: 1.5, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: 0.6, color: colors.ink },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
});
