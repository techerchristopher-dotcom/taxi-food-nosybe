import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import { colors } from '../theme/tokens';
import { useSession } from '../store/session';
import { useCart } from '../store/cart';
import { hydrateLanguage } from '../lib/i18n';
import { registerForPush } from '../lib/push';
import { useTranslation } from 'react-i18next';

function Splash() {
  return (
    <View style={styles.splash}>
      <Image source={require('../assets/icon-tile.png')} style={styles.splashLogo} />
    </View>
  );
}

export default function RootLayout() {
  // On charge les polices, mais on NE bloque PAS le rendu dessus : sur réseau lent
  // (Nosy Be), attendre les 8 fichiers fige l'app sur le splash. Elles s'appliquent
  // dès qu'elles arrivent (repli système en attendant).
  useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  const router = useRouter();
  const { i18n } = useTranslation();
  const language = i18n.language;
  const hydrateSession = useSession((s) => s.hydrate);
  const sessionLoading = useSession((s) => s.loading);
  const userId = useSession((s) => s.session?.userId ?? null);
  const hydrateCart = useCart((s) => s.hydrate);
  const cartHydrated = useCart((s) => s.hydrated);

  // La langue doit être posée AVANT le premier rendu des écrans : sinon l'app
  // s'affiche une fraction de seconde en français avant de basculer.
  const [langReady, setLangReady] = useState(false);
  /** Commande à ouvrir suite au tap sur une notification, en attente que le router soit prêt. */
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  useEffect(() => {
    hydrateSession();
    hydrateCart();
    void hydrateLanguage().finally(() => setLangReady(true));
  }, [hydrateSession, hydrateCart]);

  // Jeton push : rattaché au compte à chaque connexion ET à chaque lancement. Le jeton
  // Expo peut changer (réinstallation, restauration de sauvegarde) et l'autorisation
  // peut avoir été accordée entre deux ouvertures — le réenregistrer est idempotent.
  // `language` est dans les dépendances : c'est le serveur qui rédige les notifications,
  // un changement de langue dans le Profil doit donc remonter avec le jeton.
  useEffect(() => {
    if (!userId || !langReady) return;
    void registerForPush();
  }, [userId, langReady, language]);

  // Tap sur une notification : ouvrir directement le suivi de la commande concernée.
  // Sans ça, le client atterrit sur l'accueil et doit retrouver sa commande à la main.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { orderId?: string };
      if (data?.orderId) setPendingOrderId(data.orderId);
    });
    return () => sub.remove();
  }, []);

  const ready = !sessionLoading && cartHydrated && langReady;

  // La navigation attend que le Stack existe : au démarrage à froid depuis une
  // notification, l'écouteur se déclenche pendant le splash, où `router.push` n'a
  // encore aucun navigateur sur lequel agir.
  useEffect(() => {
    if (!ready || !pendingOrderId) return;
    setPendingOrderId(null);
    router.push(`/order/${pendingOrderId}`);
  }, [ready, pendingOrderId, router]);

  if (!ready) return <Splash />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="product/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="confirmation" options={{ gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 120, height: 120, borderRadius: 30 },
});
