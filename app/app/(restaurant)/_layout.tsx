import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';

/** Espace restaurant : 2 onglets — Commandes en cours · Historique. */
export default function RestaurantLayout() {
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color }) => <Icon name="receipt_long" size={24} color={color} />,
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
