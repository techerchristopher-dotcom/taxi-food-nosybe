import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, fonts, radius, shadow } from '../theme/tokens';
import { useSession } from '../store/session';
import { googleConfigured } from '../lib/auth';

// Nécessaire pour finaliser le retour du navigateur d'authentification.
WebBrowser.maybeCompleteAuthSession();

/** Écran 01 — Connexion (bouton unique « Continuer avec Google »). */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const signInWithGoogle = useSession((s) => s.signInWithGoogle);
  const completeFromUrl = useSession((s) => s.completeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError('Connexion impossible pour le moment. Réessayez.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingUrl]);

  async function handleGoogle() {
    if (!googleConfigured()) {
      setError(
        "Connexion Google pas encore configurée (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID absent " +
          'de app/.env, et provider Google à activer côté Supabase).',
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const session = await signInWithGoogle();
      if (session) {
        // L'aiguillage (index) décide : téléphone, sélection de rôle, ou app.
        router.replace('/');
      } else {
        // Annulé par l'utilisateur (fenêtre fermée).
        setLoading(false);
      }
    } catch {
      setError('Connexion impossible pour le moment. Réessayez.');
      setLoading(false);
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
        <Text style={styles.tagline}>NOSY BE DELIVERY</Text>
        <Text style={styles.pitch}>
          Pizzas, tacos, burgers — livrés chaud à Hell-Ville et dans tout Nosy Be.
        </Text>

        <View style={{ flex: 1 }} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={loading ? undefined : handleGoogle}
          style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.9 }]}
        >
          {loading ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <>
              <GoogleG />
              <Text style={styles.googleText}>Continuer avec Google</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.terms}>
          En continuant, vous acceptez les conditions d'utilisation de Taxi Food.
        </Text>
      </View>
    </View>
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
  googleBtn: {
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
  googleText: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
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
