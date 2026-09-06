import { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { useSession } from '../store/session';
import { retourOnglets } from '../lib/nav';

/**
 * En-tête sombre de l'espace restaurant : le badge « Espace partenaire », le nom du
 * restaurant, le titre d'écran, et le passage côté client.
 *
 * ⚠️ Le badge n'est pas de la décoration. Consigne du porteur du projet après la première
 * connexion d'un vrai restaurateur : « on mélange le pro et le perso, ce n'est pas bon ».
 * Les quatre écrans de l'espace montent cet en-tête, le mot « partenaire » est donc visible
 * partout dans l'espace pro, et le nom du restaurant confirme DUQUEL il s'agit.
 */
export function RestaurantHeader({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const restaurantName = useSession((s) => s.session?.restaurantName ?? 'Mon restaurant');
  const setMode = useSession((s) => s.setMode);

  /**
   * ⚠️ Ce bouton POSE le mode client, il ne l'efface plus.
   *
   * Il faisait `setMode(null)` puis `replace('/role-select')` : le mode était effacé AVANT
   * que la personne ait choisi quoi que ce soit, et l'écran sur lequel on la déposait a pour
   * carte la plus voyante « Je commande », qui créait au passage un rôle client définitif.
   * Un restaurateur qui tapait cette double flèche sans libellé — c'est arrivé le
   * 2026-09-06 — sortait de son espace pro sans jamais pouvoir y revenir.
   *
   * Désormais : un choix explicite, nommé, et réversible depuis Profil → « Mon espace
   * partenaire ». Le mode étant persisté, l'app rouvrira côté client tant qu'il ne sera pas
   * revenu — c'est bien ce qu'il a demandé.
   */
  async function voirAppClient() {
    await setMode('client');
    // `retourOnglets` et non `replace` : on redescend jusqu'aux onglets déjà montés au lieu
    // d'en empiler un second jeu (voir `lib/nav.ts`).
    retourOnglets(router, '/(tabs)');
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.badge}>
          <Icon name="storefront" size={13} color={colors.white} />
          <Text style={styles.badgeText}>Espace partenaire</Text>
        </View>
        {/* `numberOfLines` : un nom d'établissement à rallonge passerait sinon sur deux
            lignes et repousserait le titre d'écran hors de l'en-tête. */}
        <Text style={styles.resto} numberOfLines={1}>
          {restaurantName}
        </Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
      <Pressable
        onPress={voirAppClient}
        hitSlop={8}
        style={styles.switch}
        accessibilityRole="button"
        accessibilityLabel="Voir l'application client"
      >
        <Icon name="swap_horiz" size={18} color={colors.white} />
        <Text style={styles.switchText}>App client</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.screen,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  // `alignSelf` : la pastille se règle sur son texte au lieu de barrer toute la largeur.
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.white,
  },
  resto: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 7 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: -0.5, color: colors.white, marginTop: 2 },
  // Le rond muet est devenu une pastille avec son intitulé : c'est ce bouton sans étiquette
  // qui a fait sortir un restaurateur de son espace sans qu'il sache ce qu'il déclenchait.
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  switchText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
});
