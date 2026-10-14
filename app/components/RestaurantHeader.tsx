import { ReactNode, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { ZoneVisite } from './ZoneVisite';
import { colors, fonts, radius, spacing } from '../theme/tokens';
import { useSession } from '../store/session';
import { useRestaurantQueue } from '../store/restaurantQueue';
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
  const restaurantId = useSession((s) => s.session?.restaurantId ?? null);
  const restaurants = useSession((s) => s.session?.restaurants ?? []);
  const choisirRestaurant = useSession((s) => s.choisirRestaurant);
  const setActiveCount = useRestaurantQueue((s) => s.setActiveCount);
  const setMode = useSession((s) => s.setMode);
  // Sélecteur réservé aux comptes rattachés à PLUSIEURS restaurants (ex. le porteur du
  // projet, qui pilote La Cabane et L'escale Créole). Un restaurateur ordinaire n'en voit rien.
  const multi = restaurants.length > 1;
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(id: string) {
    if (id === restaurantId) {
      setChoixOuvert(false);
      return;
    }
    setEnCours(id);
    setErreur(null);
    try {
      await choisirRestaurant(id);
      // Le badge appartenait à l'autre restaurant : il se recalcule au prochain chargement.
      setActiveCount(0);
      setChoixOuvert(false);
    } catch {
      setErreur('Impossible de changer de restaurant. Vérifie ta connexion et réessaie.');
    } finally {
      setEnCours(null);
    }
  }

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
        {multi ? (
          <Pressable
            onPress={() => setChoixOuvert(true)}
            hitSlop={8}
            style={styles.restoChoix}
            accessibilityRole="button"
            accessibilityLabel={`Restaurant piloté : ${restaurantName}. Changer de restaurant`}
          >
            <Text style={[styles.resto, styles.restoMulti]} numberOfLines={1}>
              {restaurantName}
            </Text>
            <Icon name="expand_more" size={16} color={colors.white} />
          </Pressable>
        ) : (
          <Text style={styles.resto} numberOfLines={1}>
            {restaurantName}
          </Text>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>
      {right}
      {/* `ZoneVisite` : la dernière étape de la visite guidée désigne ce bouton.
          C'est la seule sortie de l'espace pro, et son ancienne version muette a
          fait sortir un restaurateur sans qu'il sache y revenir. */}
      <ZoneVisite nom="bascule" marge={{ haut: 5, bas: 5, gauche: 5, droite: 5 }}>
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
      </ZoneVisite>

      {multi ? (
        <Modal visible={choixOuvert} transparent animationType="fade" onRequestClose={() => setChoixOuvert(false)}>
          <Pressable style={styles.voile} onPress={() => setChoixOuvert(false)}>
            {/* Pressable intérieur : un tap dans la feuille ne la referme pas. */}
            <Pressable style={styles.feuille} onPress={() => {}}>
              <Text style={styles.feuilleTitre}>Quel restaurant piloter ?</Text>
              <Text style={styles.feuilleAide}>
                Commandes, horaires, ouverture et plats suivent le restaurant choisi.
              </Text>
              {restaurants.map((r) => {
                const actif = r.id === restaurantId;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => void choisir(r.id)}
                    disabled={!!enCours}
                    style={[styles.ligne, actif && styles.ligneActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: actif }}
                  >
                    <Icon name="storefront" size={18} color={actif ? colors.primary : colors.ink} />
                    <Text style={[styles.ligneNom, actif && styles.ligneNomActif]} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {enCours === r.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : actif ? (
                      <Icon name="check" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
              {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
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
  restoChoix: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginTop: 7, minHeight: 24 },
  restoMulti: { marginTop: 0, color: colors.white, fontFamily: fonts.semibold, textDecorationLine: 'underline' },
  voile: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.screen },
  feuille: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 18, gap: 8 },
  feuilleTitre: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  feuilleAide: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(0,0,0,0.6)', marginBottom: 6 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  ligneActive: { borderColor: colors.primary, backgroundColor: 'rgba(232,52,42,0.06)' },
  ligneNom: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  ligneNomActif: { color: colors.primary },
  erreur: { fontFamily: fonts.regular, fontSize: 13, color: colors.primary, marginTop: 4 },
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
