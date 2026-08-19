import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Image, Platform, StyleSheet, View } from 'react-native';
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
  // ⚠️ En NATIF, on attend les polices avant le premier rendu ; sur WEB, non.
  //
  // Le non-blocage systématique causait un vrai défaut visuel : le texte du tout premier
  // écran était mesuré avec la police système, puis redessiné en Archivo, plus large — la
  // dernière lettre débordait de la boîte mesurée et se faisait couper. D'où le « TAXI FOO »
  // et le « Continuer avec Googl » de l'écran de connexion, visibles jusque dans le build
  // TestFlight n°17. Les écrans suivants n'avaient rien, les polices étant déjà chargées.
  //
  // La raison d'origine du non-blocage (réseau lent à Nosy Be) ne vaut que pour le web :
  // en natif les 8 fichiers sont **embarqués dans l'app**, donc lus localement en quelques
  // millisecondes, sans réseau. On bloque donc là où c'est gratuit, et pas ailleurs.
  const [fontsLoaded] = useFonts({
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
  // Sélectionnés séparément (et jamais reconstruits) : un sélecteur qui renverrait un
  // nouvel objet à chaque rendu ferait boucler zustand.
  const roles = useSession((s) => s.session?.roles);
  const restaurantId = useSession((s) => s.session?.restaurantId ?? null);
  const setMode = useSession((s) => s.setMode);
  const hydrateCart = useCart((s) => s.hydrate);
  const cartHydrated = useCart((s) => s.hydrated);

  // La langue doit être posée AVANT le premier rendu des écrans : sinon l'app
  // s'affiche une fraction de seconde en français avant de basculer.
  const [langReady, setLangReady] = useState(false);
  /** Écran à ouvrir suite au tap sur une notification, en attente que le router soit prêt. */
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

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

  // Tap sur une notification : ouvrir directement l'écran concerné. Sans ça, on atterrit
  // sur l'accueil et il faut retrouver la commande à la main.
  //
  // `route` est choisi par le serveur selon le destinataire — suivi de commande pour le
  // client, espace restaurant ou livreur pour les pros. Repli sur `orderId` seul pour les
  // notifications émises avant l'ajout de ce champ (elles peuvent encore être en attente
  // dans le centre de notifications du téléphone).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        orderId?: string;
        route?: string;
      };
      const route = data?.route ?? (data?.orderId ? `/order/${data.orderId}` : null);
      if (route) setPendingRoute(route);
    });
    return () => sub.remove();
  }, []);

  const ready =
    !sessionLoading && cartHydrated && langReady && (Platform.OS === 'web' || fontsLoaded);

  // La navigation attend que le Stack existe : au démarrage à froid depuis une
  // notification, l'écouteur se déclenche pendant le splash, où `router.push` n'a
  // encore aucun navigateur sur lequel agir.
  useEffect(() => {
    if (!ready || !pendingRoute) return;
    setPendingRoute(null);

    // Un espace pro ne s'ouvre que si le compte porte bien le rôle ACTIF correspondant.
    // Le jeton push suit le compte, pas le rôle : un livreur dont le rôle a été retiré
    // entre-temps peut encore recevoir une course, il ne doit pas entrer pour autant.
    // Et on bascule le `mode` au passage, sinon le prochain lancement ramènerait sur
    // l'espace précédent alors que la personne travaille manifestement dans celui-ci.
    if (pendingRoute === '/(restaurant)') {
      const ok = !!roles?.some((r) => r.role === 'restaurant' && r.status === 'active') && !!restaurantId;
      if (!ok) return;
      void setMode('restaurant');
    } else if (pendingRoute === '/(livreur)') {
      const ok = !!roles?.some((r) => r.role === 'livreur' && r.status === 'active');
      if (!ok) return;
      void setMode('livreur');
    }

    router.push(pendingRoute);
  }, [ready, pendingRoute, router, roles, restaurantId, setMode]);

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
