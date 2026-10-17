// ⚠️ EN PREMIER : déclare la tâche GPS avant tout rendu. Sur Android, quand le système
// relance l'app sans écran pour livrer des positions, seul ce module est exécuté.
import '../lib/livreur/suiviGps';

import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Image, Platform, StyleSheet, View } from 'react-native';
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
import i18n from '../lib/i18n';
import { miseAJourAuDemarrage, miseAJourAuRetour } from '../lib/miseAJour';
import { BandeauMiseAJour } from '../components/BandeauMiseAJour';
import { relireEtatGps } from '../lib/livreur/suiviGps';

/**
 * Racine de l'app Taxi Food Livreur (2026-10-17). Même socle que l'app client
 * (polices, session Supabase, mises à jour à distance) mais un seul espace : les livraisons.
 * Pas de panier, pas de catalogue, pas de choix de rôle.
 *
 * Langue : les écrans livreur sont en français (décision produit). On fixe le français
 * pour les libellés partagés (statuts, modes de paiement) lus par `RestaurantOrderCard`.
 */
function Splash() {
  return (
    <View style={styles.splash}>
      <Image source={require('../assets/livreur/icon.png')} style={styles.splashLogo} />
    </View>
  );
}

export default function RacineLivreur() {
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
  const hydrate = useSession((s) => s.hydrate);
  const sessionLoading = useSession((s) => s.loading);
  const [langue, setLangue] = useState(false);
  const [majVerifiee, setMajVerifiee] = useState(Platform.OS === 'web');
  const [delaiDepasse, setDelaiDepasse] = useState(false);

  // Web seulement (aperçu) : retire le voile de démarrage posé par `public/index.html`.
  useEffect(() => {
    if (Platform.OS === 'web') document.getElementById('tf-boot')?.remove();
  }, []);

  useEffect(() => {
    void hydrate();
    void i18n.changeLanguage('fr').finally(() => setLangue(true));
    void relireEtatGps();
    if (Platform.OS !== 'web') void miseAJourAuDemarrage().finally(() => setMajVerifiee(true));
    const t = setTimeout(() => setDelaiDepasse(true), 8000);
    return () => clearTimeout(t);
  }, [hydrate]);

  // Retour au premier plan : relire l'état du GPS (autorisation changée dans les
  // réglages, tâche coupée par le système) et proposer une mise à jour téléchargée.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (etat) => {
      if (etat !== 'active') return;
      void relireEtatGps();
      // Jamais de rechargement d'office : un livreur est peut-être en pleine course.
      void miseAJourAuRetour(() => false);
    });
    return () => sub.remove();
  }, []);

  const ready = (!sessionLoading && langue && majVerifiee && (Platform.OS === 'web' || fontsLoaded)) || delaiDepasse;
  if (!ready) return <Splash />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
      <BandeauMiseAJour />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { width: 120, height: 120, borderRadius: 30 },
});
