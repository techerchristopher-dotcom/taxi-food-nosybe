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
import { TextField } from '../components/TextField';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';
import { AuthError, isValidEmail, MIN_PASSWORD_LENGTH } from '../lib/auth';

/**
 * Écran « Créer un compte ».
 *
 * Jusqu'ici l'app n'avait pas d'inscription distincte : Google et le SMS créaient le
 * compte au passage, et un compte créé par SMS restait sans nom. Ici le nom est demandé
 * dès la création et part dans `options.data.full_name`, que le trigger `handle_new_user`
 * recopie dans `profiles`.
 */
export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const signUpWithEmail = useSession((s) => s.signUpWithEmail);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const nameOk = fullName.trim().length >= 2;
  const passwordOk = password.length >= MIN_PASSWORD_LENGTH;
  const valid = nameOk && isValidEmail(email) && passwordOk;

  async function handleSignUp() {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    try {
      const { needsConfirmation } = await signUpWithEmail(fullName, email, password);
      // Confirmation d'e-mail active côté Supabase : le compte existe mais la session
      // n'arrive qu'après le clic sur le lien reçu. On le dit au lieu de rester figé.
      if (needsConfirmation) setSentTo(email.trim().toLowerCase());
      else router.replace('/');
    } catch (e: unknown) {
      setError(t(`authError.${e instanceof AuthError ? e.code : 'unknown'}`));
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <View style={[styles.iconTile, { backgroundColor: colors.warnBg }]}>
          <Icon name="mark_email_read" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { textAlign: 'center' }]}>{t('authEmail.checkInboxTitle')}</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {t('authEmail.checkInboxBody', { email: sentTo })}
        </Text>
        <Button
          label={t('authEmail.backToSignIn')}
          onPress={() => router.replace('/login-email')}
          style={{ marginTop: 28 }}
        />
      </View>
    );
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
            <Icon name="person_add" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('authEmail.signUpTitle')}</Text>
          <Text style={styles.subtitle}>{t('authEmail.signUpSubtitle')}</Text>

          <TextField
            label={t('authEmail.nameLabel')}
            icon="person"
            value={fullName}
            onChangeText={setFullName}
            placeholder={t('authEmail.namePlaceholder')}
            autoCapitalize="words"
            autoComplete="name"
            autoFocus
          />
          <TextField
            label={t('authEmail.emailLabel')}
            icon="alternate_email"
            value={email}
            onChangeText={setEmail}
            placeholder="prenom@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
          />
          <TextField
            label={t('authEmail.passwordLabel')}
            icon="lock"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="new-password"
            secure
          />
          <Text style={[styles.rule, passwordOk && { color: colors.secondary }]}>
            {t('authEmail.passwordRule', { min: MIN_PASSWORD_LENGTH })}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flex: 1, minHeight: 24 }} />

          <Button
            label={t('authEmail.signUp')}
            onPress={handleSignUp}
            loading={loading}
            disabled={!valid || loading}
          />
          <Pressable onPress={() => router.replace('/login-email')} hitSlop={8} style={styles.footer}>
            <Text style={styles.footerText}>
              {t('authEmail.haveAccount')}{' '}
              <Text style={styles.footerStrong}>{t('authEmail.signIn')}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
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
  title: {
    fontFamily: fonts.bold,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: 18,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textDark,
    marginTop: 10,
  },
  rule: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 8 },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dangerText,
    marginTop: 14,
  },
  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  footerStrong: { fontFamily: fonts.bold, color: colors.primary },
});
