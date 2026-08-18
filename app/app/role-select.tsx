import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { colors, fonts, radius, shadow, spacing, withAlpha } from '../theme/tokens';
import { useSession } from '../store/session';
import { AppRole } from '../data/types';

/**
 * Écran de sélection de rôle (multi-rôle). Affiché après connexion pour un compte qui a
 * (ou demande) un rôle pro. Le client s'active immédiatement ; restaurant/livreur passent
 * en `pending` jusqu'à validation manuelle de l'admin.
 */
export default function RoleSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const requestRole = useSession((s) => s.requestRole);
  const setMode = useSession((s) => s.setMode);
  const signOut = useSession((s) => s.signOut);

  const [busy, setBusy] = useState<AppRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;
  const statusOf = (role: AppRole) => session.roles.find((r) => r.role === role)?.status;
  const restaurantActive = statusOf('restaurant') === 'active' && !!session.restaurantId;

  async function run(role: AppRole, fn: () => Promise<void>) {
    setError(null);
    setBusy(role);
    try {
      await fn();
    } catch {
      setError(t('roleSelect.error'));
    } finally {
      setBusy(null);
    }
  }

  const chooseClient = () =>
    run('client', async () => {
      if (statusOf('client') !== 'active') await requestRole('client');
      await setMode('client');
      router.replace('/');
    });

  const enterRestaurant = () =>
    run('restaurant', async () => {
      await setMode('restaurant');
      router.replace('/(restaurant)');
    });

  const enterCourier = () =>
    run('livreur', async () => {
      await setMode('livreur');
      router.replace('/(livreur)');
    });

  const askRole = (role: AppRole) => run(role, async () => void (await requestRole(role)));

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hi}>{t('roleSelect.greeting', { name: session.fullName.split(' ')[0] })}</Text>
          <Text style={styles.title}>{t('roleSelect.title')}</Text>
        </View>
        <Pressable onPress={() => void signOut()} hitSlop={8} style={styles.logout}>
          <Icon name="logout" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.screen, paddingBottom: insets.bottom + 24, gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* CLIENT — toujours disponible */}
        <RoleCard
          icon="shopping_bag"
          tint={colors.primary}
          title={t('roleSelect.clientTitle')}
          subtitle={t('roleSelect.clientSubtitle')}
          actionLabel={t('roleSelect.clientAction')}
          loading={busy === 'client'}
          onPress={chooseClient}
        />

        {/* RESTAURANT — selon l'état du rôle */}
        <RoleCard
          icon="storefront"
          tint={colors.secondary}
          title={t('roleSelect.restaurantTitle')}
          subtitle={
            restaurantActive
              ? t('roleSelect.restaurantActive', { restaurant: session.restaurantName })
              : statusOf('restaurant') === 'pending'
                ? t('roleSelect.restaurantPending')
                : t('roleSelect.restaurantSubtitle')
          }
          actionLabel={
            restaurantActive
              ? t('roleSelect.restaurantEnterNamed', { restaurant: session.restaurantName })
              : statusOf('restaurant') === 'pending'
                ? t('roleSelect.restaurantWaiting')
                : t('roleSelect.restaurantAsk')
          }
          disabled={statusOf('restaurant') === 'pending'}
          pending={statusOf('restaurant') === 'pending'}
          loading={busy === 'restaurant'}
          onPress={restaurantActive ? enterRestaurant : () => askRole('restaurant')}
        />

        {/* LIVREUR — Phase 3, on peut demander l'accès mais l'espace n'existe pas encore */}
        <RoleCard
          icon="two_wheeler"
          tint={colors.ink}
          title={t('roleSelect.courierTitle')}
          subtitle={
            statusOf('livreur') === 'active'
              ? t('roleSelect.courierActive')
              : statusOf('livreur') === 'pending'
                ? t('roleSelect.courierPending')
                : t('roleSelect.courierSubtitle')
          }
          actionLabel={
            statusOf('livreur') === 'active'
              ? t('roleSelect.courierEnter')
              : statusOf('livreur') === 'pending'
                ? t('roleSelect.courierWaiting')
                : t('roleSelect.courierAsk')
          }
          disabled={statusOf('livreur') === 'pending'}
          pending={statusOf('livreur') === 'pending'}
          loading={busy === 'livreur'}
          onPress={statusOf('livreur') === 'active' ? enterCourier : () => askRole('livreur')}
        />
      </ScrollView>
    </View>
  );
}

function RoleCard({
  icon,
  tint,
  title,
  subtitle,
  actionLabel,
  onPress,
  loading,
  disabled,
  pending,
}: {
  icon: string;
  tint: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  pending?: boolean;
}) {
  // Une carte en attente de validation ne doit pas crier sa couleur : elle se met en
  // retrait pour que le regard aille sur les rôles réellement accessibles.
  const muted = !!disabled;

  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [styles.cardShell, pressed && !disabled && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
    >
      {/* Voile teinté de la couleur du rôle : c'est lui qui rend les trois cartes
          identifiables d'un coup d'œil, sans avoir à lire le texte. */}
      <LinearGradient
        colors={[withAlpha(tint, muted ? 0.05 : 0.16), withAlpha(tint, muted ? 0.01 : 0.03)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          {/* Halo : un second disque plus large et très transparent derrière la pastille,
              pour lui donner de l'air sans agrandir la carte. */}
          <View style={[styles.iconHalo, { backgroundColor: withAlpha(tint, muted ? 0.08 : 0.18) }]}>
            <View style={[styles.cardIcon, { backgroundColor: muted ? colors.textFaint : tint }]}>
              <LinearGradient
                colors={[withAlpha(colors.white, 0.28), withAlpha(colors.white, 0)]}
                style={StyleSheet.absoluteFill}
              />
              <Icon name={icon} size={28} color={colors.white} />
            </View>
          </View>

          <View style={styles.cardTexts}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSub}>{subtitle}</Text>
          </View>
        </View>

        {/* Action en pastille pleine largeur : lit comme un bouton, alors que le lien
            texte précédent se confondait avec la description. */}
        <View
          style={[
            styles.cardAction,
            { backgroundColor: pending ? colors.warnBg : withAlpha(tint, 0.12) },
          ]}
        >
          {pending ? <Icon name="schedule" size={16} color={colors.warnTextAlt} /> : null}
          <Text
            style={[
              styles.cardActionText,
              { color: pending ? colors.warnTextAlt : tint },
            ]}
            numberOfLines={1}
          >
            {loading ? '…' : actionLabel}
          </Text>
          {!pending && !disabled ? (
            <Icon name="arrow_forward" size={16} color={tint} />
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: spacing.screen, paddingBottom: 6 },
  hi: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  title: { fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: -0.6, color: colors.ink, marginTop: 4, maxWidth: 300 },
  logout: { padding: 8 },
  error: { fontFamily: fonts.medium, fontSize: 12, color: colors.dangerText, textAlign: 'center' },
  // La coquille porte le fond blanc, l'ombre et le rognage ; le dégradé teinté vit
  // dedans. Sans ce découpage, `overflow: hidden` et l'ombre se contrarient sur iOS.
  cardShell: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    ...shadow.card,
  },
  // Dimensions calées pour que les 3 cartes + l'en-tête tiennent sans défilement sur
  // iPhone SE (~600 pt utiles) : 3 × 164 + 2 × 14 d'écart + en-tête.
  card: { padding: 16, gap: 14 },
  cardTop: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  iconHalo: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardTexts: { flex: 1 },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 18, letterSpacing: -0.3, color: colors.ink },
  cardSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 4 },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
  },
  cardActionText: { fontFamily: fonts.bold, fontSize: 13, flexShrink: 1 },
});
