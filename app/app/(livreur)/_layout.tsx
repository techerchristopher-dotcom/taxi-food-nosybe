import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { useSession } from '../../store/session';

/** Espace livreur : 2 onglets — Livraisons · Historique. */
export default function CourierLayout() {
  // Même garde que l'espace restaurant : depuis l'ouverture du catalogue aux visiteurs
  // (règle Apple 5.1.1(v)), `app/index.tsx` ne protège plus rien. Rôle livreur ACTIF
  // exigé — un rôle retiré referme la porte.
  //
  // ⚠️ Sortie vers `/(tabs)` et non `/` : depuis l'intérieur du groupe, `/` se résout sur
  // `(livreur)/index`, donc sur ce layout, qui redirige encore — boucle infinie.
  const session = useSession((s) => s.session);
  const allowed = !!session?.roles.some((r) => r.role === 'livreur' && r.status === 'active');
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Livraisons',
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
