import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';

/** Connexion par numéro de téléphone (OTP SMS). Nécessite le provider phone dans Supabase. */
export default function LoginPhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signInWithPhone = useSession((s) => s.signInWithPhone);
  const verifyPhoneOtp = useSession((s) => s.verifyPhoneOtp);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanPhone = phone.replace(/\D/g, '');
  const fullPhone = '+261' + cleanPhone;
  const phoneValid = cleanPhone.length >= 9;
  const otpValid = otp.replace(/\D/g, '').length === 6;

  async function handleSendOtp() {
    if (!phoneValid) return;
    setError(null);
    setLoading(true);
    try {
      await signInWithPhone(fullPhone);
      setStep('otp');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossible d\'envoyer le code. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!otpValid) return;
    setError(null);
    setLoading(true);
    try {
      const session = await verifyPhoneOtp(fullPhone, otp.trim());
      if (session) router.replace('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Code incorrect. Réessayez.');
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
              <Text style={styles.title}>Votre numéro{'\n'}de téléphone</Text>
              <Text style={styles.subtitle}>
                Nous enverrons un code de confirmation par SMS.
              </Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Numéro malgache</Text>
                <View style={[styles.field, phoneValid && { borderColor: colors.primary }]}>
                  <Text style={styles.prefix}>+261</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="32 45 678 90"
                    placeholderTextColor={colors.textFaint}
                    style={styles.input}
                    autoFocus
                    maxLength={14}
                  />
                  {phoneValid ? <Icon name="check_circle" size={20} color={colors.success} /> : null}
                </View>
                <Text style={styles.hint}>Format Telma, Orange ou Airtel.</Text>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ flex: 1 }} />
              <Button label={loading ? 'Envoi en cours…' : 'Envoyer le code'} onPress={handleSendOtp} disabled={!phoneValid || loading} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Code de{'\n'}confirmation</Text>
              <Text style={styles.subtitle}>
                Code envoyé par SMS au {fullPhone}. Entrez les 6 chiffres reçus.
              </Text>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Code SMS</Text>
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
                <Text style={styles.link}>Changer de numéro</Text>
              </Pressable>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={{ flex: 1 }} />
              <Button label={loading ? 'Vérification…' : 'Confirmer'} onPress={handleVerify} disabled={!otpValid || loading} />
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
  prefix: { fontFamily: fonts.semibold, fontSize: 15, color: colors.textDark, paddingRight: 10, borderRightWidth: 1, borderRightColor: colors.borderStrong },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: 0.6, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, marginTop: 14, textAlign: 'center' },
});
