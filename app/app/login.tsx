import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { colors, fonts, radius, shadow } from '../theme/tokens';
import { useSession } from '../store/session';
import { appleSignInAvailable, facebookConfigured, googleConfigured, OAuthProvider } from '../lib/auth';
import { Icon } from '../components/Icon';

// Nécessaire pour finaliser le retour du navigateur d'authentification.
WebBrowser.maybeCompleteAuthSession();

/** Écran 01 — Connexion (bouton unique « Continuer avec Google »). */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const signInWithOAuth = useSession((s) => s.signInWithOAuth);
  const signInWithApple = useSession((s) => s.signInWithApple);
  const completeFromUrl = useSession((s) => s.completeFromUrl);
  // Quel bouton social est en cours (pour n'afficher le spinner que sur celui-là).
  const [pending, setPending] = useState<OAuthProvider | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sign in with Apple n'existe que sur iOS 13+. Le test est asynchrone, donc le bouton
  // n'apparaît qu'une fois la réponse connue — jamais en clignotant.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Filet de sécurité : si l'app est rouverte via le deep link OAuth (cold start),
  // on finalise la session à partir de l'URL entrante.
  const incomingUrl = Linking.useURL();
  useEffect(() => {
    // Sur web, supabase-js (detectSessionInUrl) échange déjà le code du retour OAuth :
    // ne pas le refaire ici (double échange → erreur).
    if (Platform.OS === 'web') return;
    if (!incomingUrl || !/[?#].*(code|access_token)=/.test(incomingUrl)) return;
    void (async () => {
      try {
        const session = await completeFromUrl(incomingUrl);
        // L'aiguillage (index) décide : téléphone, sélection de rôle, ou app.
        if (session) router.replace('/');
      } catch {
        setError(t('login.failed'));
      } finally {
        setPending(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingUrl]);

  async function handleOAuth(provider: OAuthProvider) {
    // Garde de configuration : sans identifiants côté Supabase, le flux s'ouvre sur une
    // page d'erreur du fournisseur. Mieux vaut le dire tout de suite.
    const configured = provider === 'google' ? googleConfigured() : facebookConfigured();
    if (!configured) {
      setError(t(provider === 'google' ? 'login.googleNotConfigured' : 'login.facebookNotConfigured'));
      return;
    }
    setError(null);
    setPending(provider);
    try {
      const session = await signInWithOAuth(provider);
      if (session) {
        // L'aiguillage (index) décide : nom, téléphone, sélection de rôle, ou app.
        router.replace('/');
      } else {
        // Annulé par l'utilisateur (fenêtre fermée).
        setPending(null);
      }
    } catch {
      setError(t('login.failed'));
      setPending(null);
    }
  }

  async function handleApple() {
    setError(null);
    setPending('apple');
    try {
      const session = await signInWithApple();
      if (session) {
        // L'aiguillage (index) décide : nom, téléphone, sélection de rôle, ou app.
        router.replace('/');
      } else {
        // Annulé par l'utilisateur (fenêtre fermée).
        setPending(null);
      }
    } catch {
      setError(t('login.failed'));
      setPending(null);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.secondary, colors.accent]}
        locations={[0, 0.58, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top }]}
      />
      <View style={styles.body}>
        <Image source={require('../assets/icon-tile.png')} style={styles.logo} />
        <Text style={styles.wordmark}>TAXI FOOD</Text>
        <Text style={styles.tagline}>{t('login.tagline')}</Text>
        <Text style={styles.pitch}>{t('login.pitch')}</Text>

        <View style={{ flex: 1 }} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Sign in with Apple — exigé par la règle 4.8 dès lors qu'on propose Google ou
            Facebook. Placé en premier, comme le demandent les recommandations d'Apple.
            Bouton NATIF : son libellé, sa langue et son apparence sont imposés par Apple,
            on ne les redessine pas. Absent hors iOS, où le service n'existe pas. */}
        {appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.pill}
            style={styles.appleBtn}
            onPress={() => {
              if (!pending) void handleApple();
            }}
          />
        ) : null}

        <Pressable
          onPress={pending ? undefined : () => handleOAuth('google')}
          style={({ pressed }) => [styles.socialBtn, appleAvailable && { marginTop: 10 }, pressed && { opacity: 0.9 }]}
        >
          {pending === 'google' ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <GoogleG />
              <Text style={styles.socialText}>{t('login.google')}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={pending ? undefined : () => handleOAuth('facebook')}
          style={({ pressed }) => [styles.socialBtn, styles.fbBtn, { marginTop: 10 }, pressed && { opacity: 0.9 }]}
        >
          {pending === 'facebook' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <FacebookF />
              <Text style={[styles.socialText, { color: colors.white }]}>{t('login.facebook')}</Text>
            </>
          )}
        </Pressable>

        <View style={styles.row}>
          <Pressable
            onPress={() => router.push('/login-phone')}
            style={({ pressed }) => [styles.socialBtn, styles.half, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.phoneIcon}>
              <Icon name="smartphone" size={18} color={colors.white} />
            </View>
            <Text style={styles.socialTextSmall}>{t('login.phoneShort')}</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/login-email')}
            style={({ pressed }) => [styles.socialBtn, styles.half, pressed && { opacity: 0.9 }]}
          >
            <View style={[styles.phoneIcon, { backgroundColor: colors.ink }]}>
              <Icon name="mail" size={18} color={colors.white} />
            </View>
            <Text style={styles.socialTextSmall}>{t('login.emailShort')}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/signup')} hitSlop={8} style={{ marginTop: 18 }}>
          <Text style={styles.signupLine}>
            {t('login.noAccount')} <Text style={styles.signupStrong}>{t('login.createAccount')}</Text>
          </Text>
        </Pressable>

        <Text style={styles.terms}>{t('login.terms')}</Text>
      </View>
    </View>
  );
}

function FacebookF() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path fill="#FFFFFF" d="M13.5 3H10.5C8.015 3 6 5.015 6 7.5V10.5H3V14H6V21H9.5V14H12.5L13 10.5H9.5V7.5C9.5 6.948 9.948 6.5 10.5 6.5H13.5V3Z" />
    </Svg>
  );
}

/** Logo Google officiel (SVG vectoriel — chemins issus des guidelines Google). */
function GoogleG() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 200 },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 40,
    marginTop: -72,
  },
  logo: { width: 120, height: 120, borderRadius: radius.iconTile, ...shadow.button },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: 40,
    letterSpacing: -1.2,
    color: colors.ink,
    marginTop: 22,
  },
  tagline: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.primary,
    marginTop: 8,
  },
  pitch: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textDark,
    textAlign: 'center',
    marginTop: 26,
    maxWidth: 270,
  },
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dangerText,
    textAlign: 'center',
    marginBottom: 14,
    maxWidth: 300,
  },
  // Hauteur alignée sur les autres boutons ; l'apparence interne appartient à Apple.
  appleBtn: { width: '100%', height: 56 },
  socialBtn: {
    width: '100%',
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...shadow.card,
  },
  socialText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  socialTextSmall: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  row: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 10 },
  half: { flex: 1, gap: 8, paddingHorizontal: 4 },
  signupLine: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDark },
  signupStrong: { fontFamily: fonts.bold, color: colors.primary },
  fbBtn: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  phoneIcon: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  terms: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 260,
  },
});
