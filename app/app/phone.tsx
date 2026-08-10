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
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { colors, fonts, radius } from '../theme/tokens';
import { useSession } from '../store/session';

/** Écran 01b — Saisie du numéro de téléphone (1re connexion, une seule fois). */
export default function PhoneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const setPhone = useSession((s) => s.setPhone);
  const [digits, setDigits] = useState('');

  // Numéro malgache : 9 chiffres après +261. On valide sur la longueur.
  const clean = digits.replace(/\D/g, '');
  const valid = clean.length >= 9;

  async function handleContinue() {
    if (!valid) return;
    await setPhone('+261 ' + clean);
    router.replace('/(tabs)');
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
          <Text style={styles.title}>Votre numéro{'\n'}de téléphone</Text>
          <Text style={styles.subtitle}>
            Le livreur en a besoin pour vous joindre à l'arrivée. Demandé une seule fois.
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Téléphone</Text>
            <View style={[styles.field, valid && { borderColor: colors.primary }]}>
              <Text style={styles.prefix}>+261</Text>
              <TextInput
                value={digits}
                onChangeText={setDigits}
                keyboardType="phone-pad"
                placeholder="32 45 678 90"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                autoFocus
                maxLength={14}
              />
              {valid ? <Icon name="check_circle" size={20} color={colors.success} /> : null}
            </View>
            <Text style={styles.hint}>Format Telma, Orange ou Airtel.</Text>
          </View>

          {session ? (
            <View style={styles.connectedBox}>
              <Icon name="info" size={20} color={colors.secondary} />
              <Text style={styles.connectedText}>
                Connecté en tant que <Text style={styles.strong}>{session.fullName}</Text> ·{' '}
                {session.email}
              </Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />
          <Button label="Continuer" onPress={handleContinue} disabled={!valid} />
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
  fieldBlock: { marginTop: 26, gap: 6 },
  fieldLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  field: {
    height: 56,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  prefix: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textDark,
    paddingRight: 10,
    borderRightWidth: 1,
    borderRightColor: colors.borderStrong,
  },
  input: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, letterSpacing: 0.6, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
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
  strong: { fontFamily: fonts.bold },
});
