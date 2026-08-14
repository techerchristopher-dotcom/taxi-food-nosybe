import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';
import { colors, fonts, radius, shadow, spacing } from '../theme/tokens';
import { useSession } from '../store/session';
import { AppRole } from '../data/types';

/**
 * Écran de sélection de rôle (multi-rôle). Affiché après connexion pour un compte qui a
 * (ou demande) un rôle pro. Le client s'active immédiatement ; restaurant/livreur passent
 * en `pending` jusqu'à validation manuelle de l'admin.
 */
export default function RoleSelectScreen() {
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
      setError("Action impossible pour le moment. Réessaie.");
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
          <Text style={styles.hi}>Bonjour {session.fullName.split(' ')[0]}</Text>
          <Text style={styles.title}>Comment veux-tu utiliser Taxi Food ?</Text>
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
          title="Je commande"
          subtitle="Parcourir les restaurants et me faire livrer."
          actionLabel="Continuer comme client"
          loading={busy === 'client'}
          onPress={chooseClient}
        />

        {/* RESTAURANT — selon l'état du rôle */}
        <RoleCard
          icon="storefront"
          tint={colors.secondary}
          title="Je suis un restaurant"
          subtitle={
            restaurantActive
              ? `Traiter les commandes de ${session.restaurantName}.`
              : statusOf('restaurant') === 'pending'
                ? 'Ta demande est en cours de validation par Taxi Food.'
                : 'Recevoir et gérer les commandes de mon établissement.'
          }
          actionLabel={
            restaurantActive
              ? `Entrer — ${session.restaurantName}`
              : statusOf('restaurant') === 'pending'
                ? 'En attente de validation'
                : "Demander l'accès restaurant"
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
          title="Je suis livreur"
          subtitle={
            statusOf('livreur') === 'active'
              ? 'Voir les commandes prêtes à livrer et les prendre en charge.'
              : statusOf('livreur') === 'pending'
                ? 'Ta demande est en cours de validation par Taxi Food.'
                : 'Prendre des livraisons dans tout Nosy Be.'
          }
          actionLabel={
            statusOf('livreur') === 'active'
              ? 'Entrer — espace livreur'
              : statusOf('livreur') === 'pending'
                ? 'En attente de validation'
                : "Demander l'accès livreur"
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
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [styles.card, pressed && !disabled && { opacity: 0.9 }]}
    >
      <View style={[styles.cardIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={26} color={colors.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
        <View style={[styles.cardAction, disabled && { opacity: 0.55 }]}>
          {pending ? <Icon name="schedule" size={16} color={colors.secondary} /> : null}
          <Text style={[styles.cardActionText, pending && { color: colors.secondary }]}>
            {loading ? '…' : actionLabel}
          </Text>
          {!pending && !disabled ? <Icon name="arrow_forward" size={16} color={tint} /> : null}
        </View>
      </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    ...shadow.card,
  },
  cardIcon: { width: 52, height: 52, borderRadius: radius.iconTile, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  cardSub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 3 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  cardActionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
