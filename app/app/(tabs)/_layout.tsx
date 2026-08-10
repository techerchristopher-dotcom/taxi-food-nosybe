import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { useCart } from '../../store/cart';

/**
 * Barre de navigation basse (4 onglets), reprise de la maquette :
 * Accueil (storefront) · Commandes (receipt_long) · Panier (shopping_bag) · Profil (person).
 * Actif = rouge, inactif = gris. Badge de comptage sur Panier.
 */
export default function TabsLayout() {
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));

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
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Icon name="storefront" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Icon name="receipt_long" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Panier',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color }) => <Icon name="shopping_bag" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Icon name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
