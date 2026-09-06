import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useAuthIntent } from '../store/authIntent';
import { retourOnglets } from '../lib/nav';
import { PhoneAlreadyUsedError } from '../lib/auth';
import { Country, DEFAULT_COUNTRY, depuisE164, isValidNumber, toE164 } from '../data/countries';
import { getRestaurant } from '../data/api';

/** Écran 01b — Saisie du numéro de téléphone (1re connexion, une seule fois). */
export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const setPhone = useSession((s) => s.setPhone);
  const intent = useAuthIntent((s) => s.intent);
  const [digits, setDigits] = useState('');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preRempli, setPreRempli] = useState(false);

  // Le personnel d'un restaurant est reconnaissable a ce seul champ.
  const estPersonnelResto = !!session?.restaurantId;

  // Longueur attendue selon le pays choisi (voir `data/countries.ts`).
  const valid = isValidNumber(country, digits);

  // ⚠️ Deux numeros differents cohabitent, et c'est la source de confusion que
  // ce pre-remplissage corrige. `restaurants.phone` est le numero de
  // L'ETABLISSEMENT — celui que les clients appellent. `profiles.phone`, saisi
  // ici, est celui de LA PERSONNE, que le livreur appelle en arrivant. Un
  // restaurateur qui vient de renseigner le premier croit legitimement que le
  // second est deja connu, et prend cet ecran pour un bug.
  //
  // On propose donc le numero du restaurant, MODIFIABLE : dans la plupart des
  // cas c'est le bon (c'est le meme telephone), et quand ce n'est pas le cas
  // l'encart le dit explicitement.
  useEffect(() => {
    const id = session?.restaurantId;
    // `digits` dans la condition et non dans les dependances : on ne pre-remplit
    // qu'un champ vierge, jamais par-dessus une saisie en cours.
    if (!id || digits) return;
    let vivant = true;
    getRestaurant(id)
      .then((resto) => {
        const decoupe = depuisE164(resto?.phone);
        if (!vivant || !decoupe) return;
        setCountry(decoupe.country);
        setDigits(decoupe.digits);
        setPreRempli(true);
      })
      // Un pre-remplissage qui echoue n'est pas une erreur : l'ecran reste
      // utilisable tel quel, il y a juste un geste de plus.
      .catch(() => {});
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.restaurantId]);

  async function handleContinue() {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      // Stocké en E.164 : même format que le numéro d'authentification, donc comparable.
      await setPhone(toE164(country, digits));
      // Repasser par l'aiguillage UNIQUEMENT s'il y a un retour à honorer : c'est lui qui
      // renvoie dans le tunnel de commande un compte neuf qui vient de se créer.
      // Sans intention on garde `/(tabs)` — cet écran sert aussi à MODIFIER son numéro
      // depuis le Profil, et un compte multi-rôle en mode « restaurant » serait sinon
      // éjecté vers son espace pro au lieu de revenir aux onglets client.
      //
      // `retourOnglets` et non `replace` : cet écran est EMPILÉ par-dessus les onglets, un
      // `replace` en poserait donc une seconde copie au lieu de revenir à la première
      // (voir `lib/nav.ts`).
      if (intent) router.replace('/');
      else retourOnglets(router, '/(tabs)');
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
          <Text style={styles.subtitle}>
            {estPersonnelResto ? t('phone.askSubtitlePro') : t('phone.askSubtitle')}
          </Text>

          <PhoneField
            label={t('phone.askLabel')}
            country={country}
            onCountryChange={setCountry}
            value={digits}
            onChangeText={(v) => {
              setDigits(v);
              // Des qu'il touche au champ, la valeur n'est plus celle qu'on a
              // proposee : l'encart d'explication n'a plus lieu d'etre.
              setPreRempli(false);
            }}
            autoFocus={!preRempli}
          />

          {preRempli ? (
            <View style={styles.prefillBox}>
              <Icon name="info" size={20} color={colors.secondary} />
              <Text style={styles.connectedText}>{t('phone.prefilledFromRestaurant')}</Text>
            </View>
          ) : null}

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
  prefillBox: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.warnBg,
    alignItems: 'flex-start',
  },
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
