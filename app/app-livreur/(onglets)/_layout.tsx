import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Icon } from '../../components/Icon';
import { colors, fonts } from '../../theme/tokens';
import { useSession } from '../../store/session';

/** Trois onglets : Livraisons · Historique · Profil. Rôle livreur ACTIF exigé. */
export default function Onglets() {
  const session = useSession((s) => s.session);
  if (!session) return <Redirect href="/connexion" />;
  if (!session.roles.some((r) => r.role === 'livreur' && r.status === 'active')) return <Redirect href="/pas-livreur" />;

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
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Livraisons', tabBarIcon: ({ color }) => <Icon name="two_wheeler" size={26} color={color} /> }}
      />
      <Tabs.Screen
        name="historique"
        options={{ title: 'Historique', tabBarIcon: ({ color }) => <Icon name="history" size={26} color={color} /> }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: 'Profil', tabBarIcon: ({ color }) => <Icon name="person" size={26} color={color} /> }}
      />
    </Tabs>
  );
}
