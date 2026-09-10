import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors, fonts, radius } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { supabase } from '../../lib/supabase';
import { MIN_PASSWORD_LENGTH, updatePassword } from '../../lib/auth';

/**
 * Retour des liens d'authentification envoyés par e-mail.
 *
 * ⚠️ CETTE ROUTE MANQUAIT, et c'est le seul défaut : `lib/auth.ts` construit
 * `redirectTo = makeRedirectUri({ scheme: 'taxifood', path: 'auth/callback' })`, qui vaut
 * `https://<origine>/auth/callback` sur le web et `taxifood://auth/callback` en natif. Ce
 * `redirectTo` est passé à `signUp({ emailRedirectTo })` ET à `resetPasswordForEmail`.
 * Aucun fichier ne répondait à ce chemin : le lien de validation d'e-mail et le lien de
 * réinitialisation tombaient tous les deux sur l'écran « Unmatched Route » du routeur —
 * constaté en test terrain le 2026-09-10. La règle Netlify `/* /index.html 200` faisait
 * bien son travail (l'app se chargeait) ; c'est le routeur qui n'avait rien à afficher.
 *
 * Le flux OAuth Google, lui, n'était pas touché : sur le web il passe explicitement par
 * `redirectTo: window.location.origin` (racine), et en natif `openAuthSessionAsync`
 * intercepte le deep link avant qu'il n'atteigne le routeur. C'est ce qui a masqué le trou
 * si longtemps — le seul parcours testé était celui qui contournait la route absente.
 *
 * DEUX CAS arrivent ici, et il faut les distinguer :
 *
 *   - CONFIRMATION d'inscription → la session est établie, on aiguille sur `/`.
 *   - RÉCUPÉRATION de mot de passe (`type=recovery`) → la session est établie AUSSI, mais
 *     renvoyer la personne dans l'app la laisserait sans jamais pouvoir changer son mot de
 *     passe : aucun écran ne le proposait nulle part. On le demande donc ici.
 */
export default function AuthCallback() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    code?: string;
    type?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const completeFromUrl = useSession((s) => s.completeFromUrl);
  const refresh = useSession((s) => s.refresh);

  const [etat, setEtat] = useState<'attente' | 'motDePasse' | 'echec'>('attente');
  const [motif, setMotif] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [enregistre, setEnregistre] = useState(false);
  // ⚠️ Verrou de lancement unique. `useLocalSearchParams` renvoie un nouvel objet à chaque
  // rendu : sans ce garde, l'effet rejouerait l'échange du code à chaque passage, et le
  // second échange échoue toujours (un code PKCE est à usage unique).
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current) return;
    lance.current = true;

    void (async () => {
      // Supabase renvoie ses refus dans l'URL, pas dans le corps : lien déjà utilisé,
      // lien périmé, adresse déjà confirmée. Les afficher tels quels vaut mieux qu'un
      // « une erreur est survenue » qui n'aide personne à savoir s'il faut recommencer.
      if (params.error || params.error_code) {
        setMotif(params.error_description || params.error || null);
        setEtat('echec');
        return;
      }

      // Sur le web, supabase-js échange le `code` tout seul (`detectSessionInUrl`), de
      // façon asynchrone, au chargement du client. On le laisse donc faire AVANT de tenter
      // quoi que ce soit : un échange concurrent perdrait la course et consommerait le code
      // pour rien. En natif `detectSessionInUrl` vaut false et personne n'échange — c'est à
      // nous.
      const session = await attendreSession(Platform.OS === 'web' ? 2500 : 0);

      if (!session) {
        try {
          if (Platform.OS === 'web') {
            if (params.code) {
              const { error } = await supabase.auth.exchangeCodeForSession(String(params.code));
              if (error) throw error;
            }
          } else {
            await completeFromUrl(`taxifood://auth/callback?${paramsEnQuery(params)}`);
          }
        } catch {
          /* on retombe sur la dernière attente ci-dessous : c'est elle qui tranche */
        }
      }

      const finale = (await attendreSession(5000)) ?? null;
      if (!finale) {
        setEtat('echec');
        return;
      }

      await refresh();

      if (params.type === 'recovery') {
        setEtat('motDePasse');
        return;
      }
      // L'aiguillage (`app/index.tsx`) décide de la suite : nom, téléphone, ou l'app.
      router.replace('/');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePassword() {
    if (password.length < MIN_PASSWORD_LENGTH || enregistre) return;
    setEnregistre(true);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch {
      setMotif(null);
      setEtat('echec');
    } finally {
      setEnregistre(false);
    }
  }

  if (etat === 'attente') {
    return (
      <View style={[styles.container, styles.centre]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.attente}>{t('authCallback.working')}</Text>
      </View>
    );
  }

  if (etat === 'motDePasse') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contenu}>
        <View style={styles.tuile}>
          <Icon name="lock" size={28} color={colors.primary} />
        </View>
        <Text style={styles.titre}>{t('authCallback.newPasswordTitle')}</Text>
        <Text style={styles.sous}>{t('authCallback.newPasswordSubtitle')}</Text>
        <TextField
          label={t('authEmail.passwordLabel')}
          icon="lock"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          autoCapitalize="none"
          autoComplete="new-password"
          secure
          autoFocus
        />
        <Text style={[styles.regle, password.length >= MIN_PASSWORD_LENGTH && { color: colors.secondary }]}>
          {t('authEmail.passwordRule', { min: MIN_PASSWORD_LENGTH })}
        </Text>
        <Button
          label={t('authCallback.savePassword')}
          onPress={handlePassword}
          loading={enregistre}
          disabled={password.length < MIN_PASSWORD_LENGTH || enregistre}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contenu}>
      <View style={[styles.tuile, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBg }]}>
        <Icon name="link_off" size={28} color={colors.dangerText} />
      </View>
      <Text style={styles.titre}>{t('authCallback.failedTitle')}</Text>
      <Text style={styles.sous}>{motif || t('authCallback.failedBody')}</Text>
      <Button label={t('authCallback.backToSignIn')} onPress={() => router.replace('/login-email')} />
      <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={8} style={{ marginTop: 16 }}>
        <Text style={styles.lien}>{t('authCallback.browse')}</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Attend qu'une session apparaisse, jusqu'à `msMax`. Renvoie null au-delà.
 *
 * On interroge plutôt qu'on n'écoute : `onAuthStateChange` peut avoir déjà émis son
 * `SIGNED_IN` avant le montage de cet écran, et on attendrait alors un événement qui ne
 * reviendra jamais. `getSession()` lit un état, pas un événement — il ne se rate pas.
 */
async function attendreSession(msMax: number) {
  const fin = Date.now() + msMax;
  for (;;) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    if (Date.now() >= fin) return null;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Reconstruit la query d'origine pour la repasser au parseur de `lib/auth`. */
function paramsEnQuery(p: Record<string, unknown>): string {
  return Object.entries(p)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
  contenu: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 },
  attente: { fontFamily: fonts.regular, fontSize: 14, color: colors.textDark, marginTop: 16 },
  tuile: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  titre: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, marginBottom: 8 },
  sous: { fontFamily: fonts.regular, fontSize: 14, color: colors.textDark, marginBottom: 24, lineHeight: 20 },
  regle: { fontFamily: fonts.regular, fontSize: 12, color: colors.textDark, marginBottom: 20 },
  lien: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary, textAlign: 'center' },
});
