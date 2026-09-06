import { Redirect, Tabs } from 'expo-router';
import { Platform, useWindowDimensions } from 'react-native';
import { Icon } from '../../components/Icon';
import { ZoneVisite } from '../../components/ZoneVisite';
import { colors, fonts } from '../../theme/tokens';
import { useRestaurantQueue } from '../../store/restaurantQueue';
import { useSession } from '../../store/session';

/**
 * Espace restaurant : 4 onglets — Commandes · En livraison · Historique · Réglages.
 *
 * Chaque icône est enveloppée d'une `ZoneVisite` : la visite guidée du premier
 * lancement désigne ces onglets un par un, et elle est jouée depuis l'écran
 * Commandes, qui n'a aucun moyen de savoir où la barre d'onglets les a posés.
 */
export default function RestaurantLayout() {
  const activeCount = useRestaurantQueue((s) => s.activeCount);
  const { width } = useWindowDimensions();

  /**
   * Marges de la mise en évidence autour d'une icône d'onglet. On ne peut
   * mesurer que l'icône (24 px) ; la cellule d'onglet, elle, fait un quart de
   * la largeur et porte son intitulé JUSTE EN DESSOUS. Sans ces marges le
   * contour serrerait l'icône et laisserait le mot dans l'ombre.
   */
  const margeOnglet = {
    gauche: Math.max(width / 8 - 12, 10),
    droite: Math.max(width / 8 - 12, 10),
    haut: 8,
    bas: 20,
  };

  // Garde propre à l'espace pro. Elle existait implicitement dans `app/index.tsx` tant que
  // l'app entière était derrière une session ; ce n'est plus le cas depuis l'ouverture du
  // catalogue (règle Apple 5.1.1(v)), et le lien profond `taxifood:///(restaurant)` ouvrait
  // alors une interface professionnelle vide. Un rôle RETIRÉ doit refermer la porte, pas
  // seulement un rôle absent — d'où le contrôle du statut `active`.
  //
  // ⚠️ On sort vers `/(tabs)` et surtout PAS vers `/` : depuis l'intérieur de ce groupe,
  // `/` se résout sur `(restaurant)/index`, donc sur ce layout, qui redirige encore —
  // boucle infinie (« Maximum update depth exceeded »), reproduite au premier essai.
  // Le nom du groupe rend la destination non ambiguë.
  const session = useSession((s) => s.session);
  const allowed =
    !!session?.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
    !!session?.restaurantId;
  if (!allowed) return <Redirect href="/(tabs)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10 },
        tabBarBadgeStyle: { backgroundColor: colors.primary, fontFamily: fonts.bold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Commandes',
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarIcon: ({ color }) => (
            <ZoneVisite nom="commandes" marge={margeOnglet}>
              <Icon name="receipt_long" size={24} color={color} />
            </ZoneVisite>
          ),
        }}
      />
      <Tabs.Screen
        name="delivering"
        options={{
          title: 'En livraison',
          tabBarIcon: ({ color }) => (
            <ZoneVisite nom="livraison" marge={margeOnglet}>
              <Icon name="two_wheeler" size={24} color={color} />
            </ZoneVisite>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color }) => (
            <ZoneVisite nom="historique" marge={margeOnglet}>
              <Icon name="history" size={24} color={color} />
            </ZoneVisite>
          ),
        }}
      />
      <Tabs.Screen
        name="reglages"
        options={{
          title: 'Réglages',
          tabBarLabel: 'Réglages',
          tabBarIcon: ({ color }) => (
            <ZoneVisite nom="reglages" marge={margeOnglet}>
              <Icon name="settings" size={24} color={color} />
            </ZoneVisite>
          ),
        }}
      />
    </Tabs>
  );
}
