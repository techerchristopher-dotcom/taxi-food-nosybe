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
import { AuthError, isValidEmail, sendPasswordReset } from '../lib/auth';

/**
 * Connexion par e-mail + mot de passe (compte déjà créé).
 *
 * La création de compte vit sur un écran séparé (`signup.tsx`) : mélanger les deux
 * obligeait à deviner l'intention de l'utilisateur, et c'est ce qui manquait à l'app.
 */
export default function LoginEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const signInWithEmail = useSession((s) => s.signInWithEmail);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = isValidEmail(email) && password.length > 0;

  async function handleSignIn() {
    if (!valid || loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      // L'aiguillage (index) décide de la suite : nom, téléphone, ou app.
      router.replace('/');
    } catch (e: unknown) {
      setError(t(`authError.${e instanceof AuthError ? e.code : 'unknown'}`));
    } finally {
      setLoading(false);
    }
  }

  /** Mot de passe oublié : Supabase envoie le lien de réinitialisation par e-mail. */
  async function handleReset() {
    if (!isValidEmail(email)) {
      setError(t('authEmail.resetNeedsEmail'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setNotice(t('authEmail.resetSent'));
    } catch (e: unknown) {
      setError(t(`authError.${e instanceof AuthError ? e.code : 'unknown'}`));
    } finally {
      setLoading(false);
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
            <Icon name="mail" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('authEmail.signInTitle')}</Text>
          <Text style={styles.subtitle}>{t('authEmail.signInSubtitle')}</Text>

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
            autoFocus
          />
          <TextField
            label={t('authEmail.passwordLabel')}
            icon="lock"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            autoCapitalize="none"
            autoComplete="current-password"
            secure
          />

          <Pressable onPress={loading ? undefined : handleReset} hitSlop={8} style={{ marginTop: 14 }}>
            <Text style={styles.link}>{t('authEmail.forgot')}</Text>
          </Pressable>

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flex: 1, minHeight: 24 }} />

          <Button
            label={t('authEmail.signIn')}
            onPress={handleSignIn}
            loading={loading}
            disabled={!valid || loading}
          />
          <Pressable onPress={() => router.replace('/signup')} hitSlop={8} style={styles.footer}>
            <Text style={styles.footerText}>
              {t('authEmail.noAccount')} <Text style={styles.footerStrong}>{t('authEmail.createOne')}</Text>
            </Text>
          </Pressable>
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
  link: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dangerText,
    marginTop: 14,
  },
  notice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.secondary,
    marginTop: 14,
  },
  footer: { marginTop: 16, alignItems: 'center' },
  footerText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  footerStrong: { fontFamily: fonts.bold, color: colors.primary },
});
