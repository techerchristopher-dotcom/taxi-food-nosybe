import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { colors, fonts, radius, shadow, spacing, withAlpha } from '../theme/tokens';
import { useSession } from '../store/session';
import { AppRole, imageUrl } from '../data/types';

/**
 * Visuels des rôles (Supabase Storage, bucket `produits`).
 *
 * Le restaurant n'en a pas : il garde sa pastille d'icône, au même gabarit que la photo
 * du livreur pour que les deux cartes en retrait restent alignées.
 */
const ROLE_PHOTOS = {
  client:
    'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/role-screen/client-couple.png',
  livreur:
    'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/role-screen/livreur-scooter.png',
} as const;

/**
 * Gabarits des visuels. Les photos sont en portrait 4:5 : le panneau garde ce rapport et
 * occupe toute la hauteur de la carte, plutôt qu'un bandeau large qui couperait les
 * personnages. Hauteurs choisies pour que les trois cartes tiennent sans défilement sur
 * un iPhone SE (~600 pt utiles) : 188 + 119 + 119 + écarts + en-tête.
 */
const MEDIA = {
  featured: { width: 128, height: 160 },
  compact: { width: 76, height: 95 },
} as const;

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

  // `return null` produisait un écran ENTIÈREMENT BLANC, sans barre d'onglets ni retour —
  // et il était atteignable : le bouton « Se déconnecter » ci-dessous ne navigue nulle
  // part, la session passait à null et l'écran se vidait. On repasse par l'aiguillage, qui
  // dépose sur le catalogue en l'absence de compte.
  if (!session) return <Redirect href="/" />;
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

        {/* CLIENT — toujours disponible, et mis en avant : c'est l'usage principal */}
        <RoleCard
          featured
          photo={ROLE_PHOTOS.client}
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
          // Restaurant rattaché : pas de sous-titre. Son nom est déjà dans l'action
          // (« Entrer — Angelo ») ; le répéter en description n'apprenait rien.
          subtitle={
            restaurantActive
              ? undefined
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
          photo={ROLE_PHOTOS.livreur}
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
  photo,
  featured,
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
  /** Photo du rôle. Absente → la pastille d'icône, au même gabarit. */
  photo?: string;
  /** Carte principale : visuel et texte plus grands. Une seule à la fois. */
  featured?: boolean;
  tint: string;
  title: string;
  /** Optionnel : une carte peut se passer de description (cf. restaurant rattaché). */
  subtitle?: string;
  actionLabel: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  pending?: boolean;
}) {
  const media = featured ? MEDIA.featured : MEDIA.compact;
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
        style={[styles.card, { padding: featured ? 14 : 12 }]}
      >
        {/* Le panneau visuel garde le rapport 4:5 de la photo et occupe toute la hauteur
            de la carte : le couple et le scooter ne sont donc pas rognés. */}
        <View
          style={[
            styles.media,
            media,
            { backgroundColor: withAlpha(tint, muted ? 0.08 : 0.18) },
          ]}
        >
          {photo ? (
            <Image
              source={{ uri: imageUrl(photo, media.width, media.height) }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={220}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            // Pas de photo (restaurant) : la pastille d'icône, centrée dans le même
            // gabarit — les deux cartes en retrait restent ainsi alignées.
            <View style={[styles.cardIcon, { backgroundColor: muted ? colors.textFaint : tint }]}>
              <LinearGradient
                colors={[withAlpha(colors.white, 0.28), withAlpha(colors.white, 0)]}
                style={StyleSheet.absoluteFill}
              />
              <Icon name={icon} size={26} color={colors.white} />
            </View>
          )}
        </View>

        <View style={styles.cardTexts}>
          <Text style={[styles.cardTitle, featured && styles.cardTitleFeatured]}>{title}</Text>
          {subtitle ? (
            <Text style={styles.cardSub} numberOfLines={featured ? 3 : 2}>
              {subtitle}
            </Text>
          ) : null}

          {/* Action en pastille : lit comme un bouton, alors que le lien texte
              précédent se confondait avec la description. */}
          <View
            style={[
              styles.cardAction,
              { backgroundColor: pending ? colors.warnBg : withAlpha(tint, 0.12) },
            ]}
          >
            {pending ? <Icon name="schedule" size={15} color={colors.warnTextAlt} /> : null}
            <Text
              style={[styles.cardActionText, { color: pending ? colors.warnTextAlt : tint }]}
              numberOfLines={1}
            >
              {loading ? '…' : actionLabel}
            </Text>
            {!pending && !disabled ? <Icon name="arrow_forward" size={15} color={tint} /> : null}
          </View>
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
  card: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  media: {
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // `justifyContent: center` : sans sous-titre (restaurant rattaché), titre et action
  // restent centrés en face du visuel au lieu de coller en haut.
  cardTexts: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.extrabold, fontSize: 17, letterSpacing: -0.3, color: colors.ink },
  cardTitleFeatured: { fontSize: 21, letterSpacing: -0.5 },
  cardSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 4 },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  cardActionText: { fontFamily: fonts.bold, fontSize: 13, flexShrink: 1 },
});
