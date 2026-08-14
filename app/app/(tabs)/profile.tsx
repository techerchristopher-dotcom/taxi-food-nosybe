import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { Card, SectionLabel } from '../../components/primitives';
import { colors, fonts, radius, shadow, spacing } from '../../theme/tokens';
import { listAddresses } from '../../data/api';
import { useLoad } from '../../lib/useLoad';
import { useSession } from '../../store/session';

/** Écran 11 — Profil. */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const [notif, setNotif] = useState(true);
  const { data: addresses } = useLoad(() => listAddresses(), []);

  const name = session?.fullName ?? 'Client';
  const email = session?.email ?? '';
  const phone = session?.phone ?? '—';
  const initials = session?.initials ?? '··';

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
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
            <Text style={styles.email}>{email}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={[styles.line, styles.lineBorder]}>
            <Icon name="smartphone" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lineLabel}>Téléphone</Text>
              <Text style={styles.lineValue}>{phone}</Text>
            </View>
            <Text style={styles.action}>Modifier</Text>
          </View>
          <View style={styles.line}>
            <Icon name="mail" size={22} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.lineLabel}>Compte Google</Text>
              <Text style={styles.lineValue}>{email}</Text>
            </View>
          </View>
        </Card>

        <View style={styles.sectionHead}>
          <SectionLabel>Adresses enregistrées</SectionLabel>
          <Text style={styles.action}>Ajouter</Text>
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
              <Icon name="more_horiz" size={20} color={colors.textFaint} />
            </Card>
          ))}
          {(addresses ?? []).length === 0 ? (
            <Text style={styles.noAddr}>Aucune adresse enregistrée pour l'instant.</Text>
          ) : null}
        </View>

        <Card style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <View style={[styles.line, styles.lineBorder]}>
            <Icon name="notifications" size={22} color={colors.textDark} />
            <Text style={styles.settingLabel}>Notifications de commande</Text>
            <Switch
              value={notif}
              onValueChange={setNotif}
              trackColor={{ true: colors.primary, false: colors.borderStrong }}
              thumbColor={colors.white}
            />
          </View>
          <Pressable style={styles.line}>
            <Icon name="help" size={22} color={colors.textDark} />
            <Text style={styles.settingLabel}>Aide & contact</Text>
            <Icon name="chevron_right" size={20} color={colors.textFaint} />
          </Pressable>
        </Card>

        <Pressable style={styles.partner} onPress={() => router.push('/role-select')}>
          <Icon name="storefront" size={22} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerLabel}>Espace partenaire</Text>
            <Text style={styles.partnerSub}>Restaurant ou livreur ? Gérer / demander l'accès.</Text>
          </View>
          <Icon name="chevron_right" size={20} color={colors.textFaint} />
        </Pressable>

        <Pressable style={styles.logout} onPress={handleSignOut}>
          <Icon name="logout" size={20} color={colors.primary} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
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
