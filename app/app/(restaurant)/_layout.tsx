import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { useRestaurantQueue } from '../../store/restaurantQueue';

/** Espace restaurant : 3 onglets — Commandes en cours · En livraison · Historique. */
export default function RestaurantLayout() {
  const activeCount = useRestaurantQueue((s) => s.activeCount);

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
    </Tabs>
  );
}
