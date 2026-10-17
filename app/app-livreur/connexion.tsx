import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';
import { appleSignInAvailable, AuthError, googleNativeAvailable, isValidEmail, sendPasswordReset } from '../lib/auth';

const MESSAGES: Record<string, string> = {
  invalidCredentials: 'E-mail ou mot de passe incorrect.',
  emailNotConfirmed: 'Confirme d’abord ton adresse e-mail (lien reçu par e-mail).',
  rateLimit: 'Trop d’essais. Réessaie dans quelques minutes.',
  network: 'Pas de réseau. Réessaie.',
};

/**
 * Connexion à l'app livreur. Un livreur a déjà un compte (il l'a créé dans l'app client
 * ou l'admin l'a créé pour lui) : ici on se CONNECTE seulement, on ne crée pas de compte.
 *
 * Google natif exige un identifiant OAuth Android propre à ce package (empreinte SHA-1) :
 * tant qu'il n'est pas déclaré dans Google Cloud, le bouton échoue avec un message clair
 * et renvoie vers l'e-mail. « Mot de passe oublié » marche aussi pour un compte Google :
 * il lui ajoute un mot de passe.
 */
export default function Connexion() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const signInWithEmail = useSession((s) => s.signInWithEmail);
  const signInWithGoogleNative = useSession((s) => s.signInWithGoogleNative);
  const signInWithApple = useSession((s) => s.signInWithApple);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [chargement, setChargement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    void appleSignInAvailable().then(setApple).catch(() => setApple(false));
  }, []);

  async function apres(fn: () => Promise<unknown>, cle: string) {
    setErreur(null);
    setNotice(null);
    setChargement(cle);
    try {
      const s = await fn();
      if (s) router.replace('/');
    } catch (e) {
      if (cle === 'google') {
        const code = String((e as { code?: string | number })?.code ?? '');
        const msg = String((e as { message?: string })?.message ?? '');
        setErreur(
          code === '10' || /DEVELOPER_ERROR/i.test(msg)
            ? 'La connexion Google n’est pas encore activée pour l’app livreur. Connecte-toi avec ton e-mail (« Mot de passe oublié » pour en créer un).'
            : 'Connexion Google impossible. Réessaie, ou utilise ton e-mail.',
        );
      } else if (e instanceof AuthError) {
        setErreur(MESSAGES[e.code] ?? 'Connexion impossible. Réessaie.');
      } else {
        setErreur('Connexion impossible. Réessaie.');
      }
    } finally {
      setChargement(null);
    }
  }

  async function oubli() {
    if (!isValidEmail(email)) {
      setErreur('Écris d’abord ton adresse e-mail au-dessus.');
      return;
    }
    setErreur(null);
    setChargement('oubli');
    try {
      await sendPasswordReset(email);
      setNotice(
        'E-mail envoyé. Ouvre le lien sur ce téléphone : l’app Taxi Food s’ouvre et te demande ton nouveau mot de passe. Reviens ensuite ici.',
      );
    } catch {
      setErreur('Envoi impossible. Réessaie dans un instant.');
    } finally {
      setChargement(null);
    }
  }

  const valide = isValidEmail(email) && password.length >= 6;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../assets/livreur/icon.png')} style={styles.logo} />
        <Text style={styles.titre}>Taxi Food Livreur</Text>
        <Text style={styles.sousTitre}>Connecte-toi avec le compte validé comme livreur par Taxi Food.</Text>

        {googleNativeAvailable() ? (
          <Button
            label="Continuer avec Google"
            icon="account_circle"
            variant="dark"
            onPress={() => apres(signInWithGoogleNative, 'google')}
            loading={chargement === 'google'}
            disabled={!!chargement}
            style={{ marginTop: 26 }}
          />
        ) : null}
        {apple ? (
          <Button
            label="Continuer avec Apple"
            icon="phone_iphone"
            variant="dark"
            onPress={() => apres(signInWithApple, 'apple')}
            loading={chargement === 'apple'}
            disabled={!!chargement}
            style={{ marginTop: 10 }}
          />
        ) : null}

        <View style={styles.separateur}>
          <View style={styles.trait} />
          <Text style={styles.ou}>ou avec ton e-mail</Text>
          <View style={styles.trait} />
        </View>

        <TextField
          label="E-mail"
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
          label="Mot de passe"
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          autoCapitalize="none"
          autoComplete="current-password"
          secure
        />
        <Pressable onPress={chargement ? undefined : oubli} hitSlop={8} style={{ marginTop: 14 }}>
          <Text style={styles.lien}>Mot de passe oublié ? (ou compte Google sans mot de passe)</Text>
        </Pressable>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <View style={{ flex: 1, minHeight: 20 }} />
        <Button
          label="Se connecter"
          onPress={() => apres(() => signInWithEmail(email, password), 'email')}
          loading={chargement === 'email'}
          disabled={!valide || !!chargement}
          style={{ marginTop: 20 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  logo: { width: 84, height: 84, borderRadius: 22, alignSelf: 'center' },
  titre: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.ink, textAlign: 'center', marginTop: 16 },
  sousTitre: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  separateur: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 4 },
  trait: { flex: 1, height: 1, backgroundColor: colors.border },
  ou: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  lien: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  notice: {
    marginTop: 14,
    padding: 12,
    borderRadius: radius.tile,
    backgroundColor: colors.successBg,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    color: colors.successDark,
  },
  erreur: { marginTop: 14, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.dangerText },
});
