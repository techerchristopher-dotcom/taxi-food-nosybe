import { Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { identiteCompte } from '../distripro/api';
import { DistriproProvider, dp } from '../distripro/contexte';

/**
 * Racine du site distripro207.com (APP_VARIANT=distripro, web seulement).
 * Mêmes écrans que l'onglet « Commander » de l'app Taxi Food (module `distripro/`) ;
 * l'identité, ici, est le compte client DistriPro (mot de passe remis par l'exploitant).
 * Le catalogue reste lisible sans compte : le mot de passe n'est demandé qu'à la commande.
 */
export const LIENS_SITE = {
  catalogue: '/',
  panier: '/panier',
  commandes: '/commandes',
  commande: (numero: string) => `/commande?numero=${encodeURIComponent(numero)}`,
  connexion: '/connexion',
};

export default function RacineDistripro() {
  const [polices] = useFonts({ Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold, Archivo_800ExtraBold });
  const identite = useMemo(() => identiteCompte(), []);

  useEffect(() => {
    if (Platform.OS === 'web') document.getElementById('tf-boot')?.remove();
  }, [polices]);

  if (!polices) return <View style={{ flex: 1, backgroundColor: dp.foret }} />;
  return (
    <SafeAreaProvider>
      <DistriproProvider valeur={{ identite, liens: LIENS_SITE, dansTaxiFood: false }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: dp.papier } }} />
      </DistriproProvider>
    </SafeAreaProvider>
  );
}
