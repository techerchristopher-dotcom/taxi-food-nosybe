import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, fonts } from '../theme/tokens';
import { useSession } from '../store/session';

/**
 * Saisie du nom, une seule fois, pour les comptes qui n'en ont pas.
 *
 * Google et l'inscription par e-mail fournissent déjà le nom ; l'inscription par SMS non.
 * Sans cet écran, ces comptes restent affichés « Client » partout, y compris sur la
 * commande que voient le restaurant et le livreur.
 *
 * Pas de bouton retour : on ne peut pas sauter l'étape (l'aiguillage y ramènerait aussitôt).
 */
export default function NameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const setFullName = useSession((s) => s.setFullName);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2;

  async function handleContinue() {
    if (!valid || busy) return;
    setError(null);
    setBusy(true);
    try {
      await setFullName(name);
      // L'aiguillage enchaîne : téléphone si manquant, sinon l'app.
      router.replace('/');
    } catch {
      setError(t('authEmail.nameSaveFailed'));
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
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.iconTile}>
            <Icon name="badge" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>{t('authEmail.askNameTitle')}</Text>
          <Text style={styles.subtitle}>{t('authEmail.askNameSubtitle')}</Text>

          <TextField
            label={t('authEmail.nameLabel')}
            icon="person"
            value={name}
            onChangeText={setName}
            placeholder={t('authEmail.namePlaceholder')}
            autoCapitalize="words"
            autoComplete="name"
            autoFocus
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ flex: 1, minHeight: 24 }} />
          <Button label={t('phone.continue')} onPress={handleContinue} disabled={!valid || busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, paddingHorizontal: 20 },
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
  error: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.dangerText,
    marginTop: 14,
  },
});
