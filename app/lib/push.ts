/**
 * Notifications push — enregistrement de l'appareil et réception.
 *
 * Pourquoi le push plutôt que le SMS : le suivi de commande (« confirmée »,
 * « en préparation », « le livreur arrive ») est exactement ce que les apps de
 * livraison envoient en push. C'est gratuit, illimité, et ça arrive même quand
 * l'app est fermée. Le SMS reste réservé au seul cas où l'on n'a pas encore
 * d'appareil enregistré : le code de vérification à l'inscription.
 *
 * Chaîne complète : cet écran enregistre un jeton Expo dans `push_tokens`
 * → un trigger Postgres sur `orders.status` appelle l'Edge Function `notify-order`
 * → celle-ci envoie le message à l'API Expo Push, qui le remet à APNs / FCM.
 *
 * ⚠️ Le jeton n'existe QUE dans une build native (EAS). Sur simulateur, sur le web
 * et dans Expo Go, `getExpoPushTokenAsync` échoue ou renvoie un jeton inutilisable :
 * toutes les fonctions ci-dessous échouent alors en silence, sans casser le parcours.
 */
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import i18n from './i18n';

/** Dernier jeton enregistré, pour pouvoir le retirer à la déconnexion. */
const TOKEN_KEY = 'tf_push_token';

/** Canal Android : sans lui, les notifications n'ont ni son ni priorité correcte. */
const ANDROID_CHANNEL = 'commandes';

/**
 * Comportement quand la notification arrive alors que l'app est au premier plan.
 * Par défaut Expo n'affiche rien dans ce cas — le client raterait le changement
 * de statut s'il a l'app ouverte sur un autre écran.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** L'identifiant du projet EAS, exigé par `getExpoPushTokenAsync` dans une build. */
function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
}

/** Un vrai téléphone en build native : la seule configuration où le push fonctionne. */
export function pushSupported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Suivi de commande',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/**
 * Demande l'autorisation puis enregistre le jeton de cet appareil pour le compte connecté.
 *
 * Appelée à chaque lancement une fois connecté : le jeton Expo peut changer
 * (réinstallation, restauration de sauvegarde), et l'utilisateur peut avoir accordé
 * l'autorisation entre deux lancements.
 *
 * Ne lève jamais : une notification ratée ne doit pas empêcher de commander.
 */
export async function registerForPush(): Promise<string | null> {
  if (!pushSupported()) return null;

  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    // On ne redemande pas si l'utilisateur a déjà refusé : iOS ne réafficherait
    // de toute façon pas la boîte de dialogue, et ça masquerait le vrai motif.
    if (status !== 'granted' && existing.canAskAgain) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: projectId(),
    });
    if (!token) return null;

    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      // La langue voyage avec le jeton : c'est le serveur qui rédige la notification,
      // il n'a aucun autre moyen de savoir dans quelle langue lire l'app.
      p_language: (i18n.language ?? 'fr').slice(0, 2),
    });
    if (error) throw error;

    await AsyncStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch (e) {
    // Cas normaux : simulateur, Expo Go, pas de connexion réseau, autorisation retirée.
    console.warn('[push] enregistrement impossible', e);
    return null;
  }
}

/**
 * Retire le jeton de cet appareil (déconnexion).
 *
 * Sans ça, le téléphone continuerait à recevoir les notifications du compte
 * précédent — et si quelqu'un d'autre se connecte, les deux comptes se
 * mélangeraient sur le même appareil.
 */
export async function unregisterFromPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('[push] désenregistrement impossible', e);
  }
}
