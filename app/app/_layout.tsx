import { Stack } from 'expo-router';
import { useEffect } from 'react';
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

  const hydrateSession = useSession((s) => s.hydrate);
  const sessionLoading = useSession((s) => s.loading);
  const hydrateCart = useCart((s) => s.hydrate);
  const cartHydrated = useCart((s) => s.hydrated);

  useEffect(() => {
    hydrateSession();
    hydrateCart();
  }, [hydrateSession, hydrateCart]);

  const ready = !sessionLoading && cartHydrated;
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
