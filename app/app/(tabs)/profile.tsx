import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
import { ligneVersion } from '../../lib/version';
import { signInFor } from '../../store/authIntent';
import { SUPPORT_URL } from '../../lib/links';
import { LANGUAGES, LanguageCode, setLanguage } from '../../lib/i18n';

/**
 * Écran 11 — Profil : compte connecté, ou porte d'entrée pour un visiteur.
 *
 * Deux composants distincts, et non un écran unique en `session?.` : le profil connecté
 * a des replis (« Client », initiales « ·· », téléphone « — ») qui fabriqueraient une
 * fausse identité pour quelqu'un qui n'a pas de compte, et des actions qui n'ont aucun
 * sens sans compte (se déconnecter, supprimer son compte, modifier son numéro).
 */
export default function ProfileScreen() {
  const session = useSession((s) => s.session);
  return session ? <AccountProfile /> : <GuestProfile />;
}

/** Profil d'un compte connecté. */
function AccountProfile() {
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

  // L'app reste parcourable sans compte : après déconnexion on rend le CATALOGUE, pas un
  // écran de connexion dont on ne pourrait plus sortir. Sinon on recrée exactement le mur
  // qu'Apple reproche (règle 5.1.1(v)).
  async function handleSignOut() {
    await signOut();
    router.replace('/(tabs)');
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
              // Même raison que la déconnexion : le catalogue reste ouvert à tous.
              router.replace('/(tabs)');
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
          <HelpLine />
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

        <Text style={styles.version}>{ligneVersion()}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Profil d'un visiteur non connecté — la porte d'entrée principale vers le compte, celle
 * que cherche un relecteur Apple qui se demande « comment je crée un compte ? ».
 *
 * ⚠️ Aucune identité factice : pas d'initiales inventées, pas de « Client » en gros.
 * Ce que l'écran montre, c'est CE QUE LE COMPTE APPORTE, et les réglages qui n'en
 * dépendent pas (langue, aide) restent utilisables tels quels. Ni « Se déconnecter » ni
 * « Supprimer mon compte » : il n'y a rien à déconnecter ni à supprimer.
 */
function GuestProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

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
            <Icon name="person" size={30} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t('profile.guestTitle')}</Text>
            <Text style={styles.email}>{t('profile.guestSubtitle')}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: spacing.screen, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <Card style={{ padding: 18 }}>
          <Text style={styles.whyTitle}>{t('profile.whyTitle')}</Text>
          <Benefit icon="local_shipping" text={t('profile.whyTracking')} />
          <Benefit icon="location_on" text={t('profile.whyAddress')} />
          <Benefit icon="replay" text={t('profile.whyHistory')} />
          <Pressable style={styles.signInBtn} onPress={() => signInFor(router, '/(tabs)/profile')}>
            <Text style={styles.signInText}>{t('profile.guestAction')}</Text>
          </Pressable>
          {/* Dire explicitement où passe la frontière entre le libre et le compte. */}
          <Text style={styles.guestHint}>{t('profile.guestHint')}</Text>
        </Card>

        {/* Aide : aucun compte requis, bloc repris tel quel du profil connecté. */}
        <Card style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
          <HelpLine />
        </Card>

        {/* Langue : stockée localement (`lib/i18n.ts`), sans aucun lien avec le compte. */}
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

        {/* `/role-select` fait `if (!session) return <Redirect href="/" />` : y envoyer un
            visiteur le renverrait aussitôt. On passe donc par la connexion, avec la
            sélection de rôle comme destination de retour. */}
        <Pressable style={styles.partner} onPress={() => signInFor(router, '/role-select')}>
          <Icon name="storefront" size={22} color={colors.secondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.partnerLabel}>{t('profile.partnerLabel')}</Text>
            <Text style={styles.partnerSub}>{t('profile.partnerSub')}</Text>
          </View>
          <Icon name="chevron_right" size={20} color={colors.textFaint} />
        </Pressable>

        <Text style={styles.version}>{ligneVersion()}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Ligne « Aide & contact », partagée par les deux profils.
 *
 * La page d'assistance est EN LIGNE (c'est l'adresse déclarée dans la fiche App Store).
 * Cette ligne s'affichait pourtant avec son chevron et SANS gestionnaire : un bouton qui
 * ne fait rien, exactement le motif de rejet (règle 2.1) qui a déjà fait retirer
 * « Ajouter » et « … » de cet écran. Sur le profil VISITEUR, c'était même le seul contenu
 * à côté du bouton de connexion — donc la première chose que touche un relecteur venu
 * chercher le support et la création de compte.
 *
 * `open_in_new` et non `chevron_right` : la page s'ouvre dans le navigateur, pas dans
 * l'app. L'icône doit le dire avant le tap, pas après.
 */
function HelpLine() {
  const { t } = useTranslation();
  return (
    <Pressable
      style={styles.line}
      accessibilityRole="link"
      onPress={() => {
        // Un `openURL` peut être refusé (aucun navigateur, gestion d'URL désactivée) :
        // on ne laisse pas remonter un rejet non intercepté pour une page d'aide.
        Linking.openURL(SUPPORT_URL).catch((e) => console.warn('[profil] aide', e));
      }}
    >
      <Icon name="help" size={22} color={colors.textDark} />
      <Text style={styles.settingLabel}>{t('profile.help')}</Text>
      <Icon name="open_in_new" size={20} color={colors.textFaint} />
    </Pressable>
  );
}

/** Une ligne « ce que le compte apporte ». */
function Benefit({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.benefit}>
      <Icon name={icon} size={20} color={colors.primary} />
      <Text style={styles.benefitText}>{text}</Text>
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
  // ===== Profil visiteur =====
  whyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 14 },
  benefit: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  benefitText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDark },
  signInBtn: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  signInText: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  guestHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
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
