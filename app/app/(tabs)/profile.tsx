import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/Icon';
import { Card, SectionLabel } from '../../components/primitives';
import { colors, fonts, radius, shadow, spacing } from '../../theme/tokens';
import { listAddresses } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';
import { LANGUAGES, LanguageCode, setLanguage } from '../../lib/i18n';

/** Écran 11 — Profil. */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const deleteAccount = useSession((s) => s.deleteAccount);
  const [notif, setNotif] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const { data: addresses } = useLoad(() => listAddresses(), []);

  const name = session?.fullName ?? t('profile.defaultName');
  const email = session?.email ?? '';
  const phone = session?.phone ?? '—';
  const initials = session?.initials ?? '··';

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  // Double confirmation : c'est irréversible et Apple exige que ce soit clair. Le second
  // écran nomme ce qui disparaît, pour que personne ne le déclenche en croyant se
  // déconnecter.
  function handleDelete() {
    Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              router.replace('/login');
            } catch (e: unknown) {
              Alert.alert(
                t('profile.deleteFailedTitle'),
                e instanceof Error ? e.message : t('profile.deleteFailed'),
              );
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.email}>{email || phone}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[styles.line, email ? styles.lineBorder : null]}>
            <Icon name="smartphone" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lineLabel}>{t('profile.phone')}</Text>
              <Text style={styles.lineValue}>{phone}</Text>
            </View>
            {/* `/phone` est l'écran de saisie de la première connexion, mais il fonctionne
                tel quel en modification : il a son propre bouton retour et renvoie sur les
                onglets une fois enregistré. Sans ce `Pressable`, « Modifier » n'était qu'un
                texte rouge qui ne faisait rien. */}
            <Pressable onPress={() => router.push('/phone')} hitSlop={8}>
              <Text style={styles.action}>{t('common.modify')}</Text>
            </Pressable>
          </View>
          {email ? (
            <View style={styles.line}>
              <Icon name="mail" size={22} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lineLabel}>{t('profile.emailAccount')}</Text>
                <Text style={styles.lineValue}>{email}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Pas d'action « Ajouter » ni de menu « … » ici : les deux existaient sous forme de
            simple texte, sans `Pressable` ni gestionnaire — des commandes mortes. Une adresse
            s'ajoute dans le tunnel de commande (écran `/address`), qui est le seul endroit où
            elle a un sens : la capture GPS y est exigée et la validation enchaîne sur le
            paiement. Un relecteur Apple appuie sur tout ce qui ressemble à un bouton
            (règle 2.1), et un client aussi. */}
        <View style={styles.sectionHead}>
          <SectionLabel>{t('profile.addresses')}</SectionLabel>
        </View>
        <View style={{ gap: 10 }}>
          {(addresses ?? []).map((a) => (
            <Card key={a.id} style={styles.addrCard}>
              <Icon name={a.icon} size={22} color={a.isDefault ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.addrLabel}>{a.label}</Text>
                <Text style={styles.addrDetail}>
                  {a.zone}, {a.landmark}
                </Text>
              </View>
            </Card>
          ))}
          {(addresses ?? []).length === 0 ? (
            <Text style={styles.noAddr}>{t('profile.noAddress')}</Text>
          ) : null}
        </View>

        <Card style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <View style={[styles.line, styles.lineBorder]}>
            <Icon name="notifications" size={22} color={colors.textDark} />
            <Text style={styles.settingLabel}>{t('profile.notifications')}</Text>
            <Switch
              value={notif}
              onValueChange={setNotif}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.white}
            />
          </View>
          <Pressable style={styles.line}>
            <Icon name="help" size={22} color={colors.textDark} />
            <Text style={styles.settingLabel}>{t('profile.help')}</Text>
            <Icon name="chevron_right" size={20} color={colors.textFaint} />
          </Pressable>
        </Card>

        <View style={styles.sectionHead}>
          <SectionLabel>{t('profile.language')}</SectionLabel>
        </View>
        <View style={styles.langRow}>
          {LANGUAGES.map((l) => {
            const active = i18n.language === l.code;
            return (
              <Pressable
                key={l.code}
                style={[styles.langChip, active && styles.langChipActive]}
                onPress={() => void setLanguage(l.code as LanguageCode)}
              >
                <Text style={styles.langFlag}>{l.flag}</Text>
                <Text style={[styles.langLabel, active && styles.langLabelActive]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.partner} onPress={() => router.push('/role-select')}>
          <Icon name="storefront" size={22} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerLabel}>{t('profile.partnerLabel')}</Text>
            <Text style={styles.partnerSub}>{t('profile.partnerSub')}</Text>
          </View>
          <Icon name="chevron_right" size={20} color={colors.textFaint} />
        </Pressable>

        <Pressable style={styles.logout} onPress={handleSignOut}>
          <Icon name="logout" size={20} color={colors.primary} />
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </Pressable>

        {/* Suppression de compte — exigée par Apple (règle 5.1.1(v)) : elle doit être
            accessible DEPUIS l'app, pas par un formulaire ou un e-mail. Volontairement
            discrète et en dernier, sous la déconnexion, pour ne pas se toucher par
            mégarde ; la confirmation fait le reste. */}
        <Pressable style={styles.deleteAccount} onPress={handleDelete} disabled={deleting}>
          <Text style={styles.deleteAccountText}>
            {deleting ? t('profile.deleting') : t('profile.deleteAccount')}
          </Text>
        </Pressable>

        <Text style={styles.version}>TAXI FOOD · v1.0 MVP · NOSY BE</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.screen,
    paddingBottom: 26,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.primary },
  name: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.4, color: colors.white },
  email: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  lineBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  lineLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  lineValue: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 5 },
  action: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  addrCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14 },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  addrDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
  noAddr: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
  settingLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  logout: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.dangerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  deleteAccount: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  deleteAccountText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  partner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 20,
  },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  langChipActive: { borderColor: colors.primary, backgroundColor: colors.dangerBg },
  langFlag: { fontSize: 22 },
  langLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  langLabelActive: { fontFamily: fonts.bold, color: colors.primary },
  partnerLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  partnerSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  version: {
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 14,
  },
});
