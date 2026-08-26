import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { useRestaurantQueue } from '../../store/restaurantQueue';
import { useSession } from '../../store/session';

/** Espace restaurant : 3 onglets — Commandes en cours · En livraison · Historique. */
export default function RestaurantLayout() {
  const activeCount = useRestaurantQueue((s) => s.activeCount);

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
          tabBarIcon: ({ color }) => <Icon name="receipt_long" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="delivering"
        options={{
          title: 'En livraison',
          tabBarIcon: ({ color }) => <Icon name="two_wheeler" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarIcon: ({ color }) => <Icon name="history" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reglages"
        options={{
          title: 'Réglages',
          tabBarLabel: 'Réglages',
          tabBarIcon: ({ color }) => <Icon name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
