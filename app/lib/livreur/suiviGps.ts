/**
 * Partage de la position du livreur pendant ses courses (app Taxi Food Livreur, 2026-10-17).
 * Cahier des charges : docs/APP-LIVREUR-CAHIER-DES-CHARGES.md § 5.1.
 *
 *   - QUAND : seulement tant qu'il tient au moins une commande `en_livraison`. L'écran
 *     Livraisons démarre le suivi dès « Je la prends » et l'arrête quand la tournée est
 *     vide. La base refuse de toute façon un point hors course (`aucune_course`) : la
 *     tâche s'arrête alors d'elle-même.
 *   - COMMENT : `Location.startLocationUpdatesAsync` + tâche `expo-task-manager`, qui
 *     continue quand le livreur passe sur Google Maps ou verrouille son écran (service de
 *     premier plan sur Android, mode « location » en arrière-plan sur iOS).
 *   - CADENCE : un point toutes les 15 s ou tous les 50 m.
 *   - RÉSEAU COUPÉ (fréquent à Nosy Be) : les points attendent dans une file sur le
 *     téléphone (AsyncStorage, 500 au plus) et partent au prochain envoi réussi.
 *
 * ⚠️ `TaskManager.defineTask` doit être appelé au CHARGEMENT du module, avant tout rendu :
 * ce fichier est importé en tête de `app-livreur/_layout.tsx`. Sur Android, si le système a
 * tué l'app, il la relance sans écran pour exécuter la tâche — le module doit alors suffire.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../supabase';

export const TACHE_GPS = 'taxifood-livreur-position';
const CLE_FILE = 'tf_livreur_file_positions';
const CLE_DERNIER_ENVOI = 'tf_livreur_dernier_envoi';
const FILE_MAX = 500;
const LOT_MAX = 100;

type Point = { lat: number; lng: number; precision: number | null; vitesse: number | null; cap: number | null; le: string };

export type EtatGps = {
  /** Le suivi tourne (tâche démarrée). */
  actif: boolean;
  /** Autorisation : 'ok' (toujours), 'premier_plan' (seulement app ouverte), 'refusee', 'inconnue'. */
  autorisation: 'ok' | 'premier_plan' | 'refusee' | 'inconnue';
  /** Dernier envoi réussi à la base (ISO). */
  dernierEnvoi: string | null;
  /** Points en attente faute de réseau. */
  enAttente: number;
  erreur: string | null;
};

export const useEtatGps = create<EtatGps>(() => ({
  actif: false,
  autorisation: 'inconnue',
  dernierEnvoi: null,
  enAttente: 0,
  erreur: null,
}));

async function lireFile(): Promise<Point[]> {
  try {
    const brut = await AsyncStorage.getItem(CLE_FILE);
    const file = brut ? (JSON.parse(brut) as Point[]) : [];
    return Array.isArray(file) ? file : [];
  } catch {
    return [];
  }
}

async function ecrireFile(file: Point[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CLE_FILE, JSON.stringify(file.slice(-FILE_MAX)));
  } catch {
    /* stockage plein : on perd au pire des points, jamais l'app */
  }
  useEtatGps.setState({ enAttente: Math.min(file.length, FILE_MAX) });
}

let envoiEnCours = false;

/** Envoie la file par lots. Ne lève jamais. Rend false si la base dit « aucune course ». */
export async function envoyerFile(): Promise<boolean> {
  if (envoiEnCours) return true;
  envoiEnCours = true;
  try {
    let file = await lireFile();
    while (file.length) {
      const lot = file.slice(0, LOT_MAX);
      const { data, error } = await supabase.rpc('livreur_envoyer_positions', { p_points: lot });
      if (error) {
        useEtatGps.setState({ erreur: 'Envoi impossible (réseau ?) — les positions attendent.' });
        return true;
      }
      const rep = data as { ok?: boolean; raison?: string } | null;
      if (rep && rep.ok === false && rep.raison === 'aucune_course') {
        await ecrireFile([]);
        return false;
      }
      file = file.slice(lot.length);
      await ecrireFile(file);
      const maintenant = new Date().toISOString();
      useEtatGps.setState({ dernierEnvoi: maintenant, erreur: null });
      AsyncStorage.setItem(CLE_DERNIER_ENVOI, maintenant).catch(() => {});
    }
    return true;
  } catch {
    useEtatGps.setState({ erreur: 'Envoi impossible (réseau ?) — les positions attendent.' });
    return true;
  } finally {
    envoiEnCours = false;
  }
}

/** Reçoit les points du système, les met en file et tente l'envoi. */
async function recevoir(locations: Location.LocationObject[]): Promise<void> {
  if (!locations?.length) return;
  const nouveaux: Point[] = locations.map((l) => ({
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    precision: l.coords.accuracy ?? null,
    // m/s → km/h ; -1 ou null quand le téléphone ne sait pas.
    vitesse: l.coords.speed != null && l.coords.speed >= 0 ? Math.round(l.coords.speed * 3.6 * 10) / 10 : null,
    cap: l.coords.heading != null && l.coords.heading >= 0 ? Math.round(l.coords.heading) : null,
    le: new Date(l.timestamp).toISOString(),
  }));
  const file = await lireFile();
  await ecrireFile([...file, ...nouveaux]);
  const encore = await envoyerFile();
  if (!encore) await arreterSuivi();
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TACHE_GPS)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TACHE_GPS, async ({ data, error }) => {
    if (error) return;
    await recevoir(data?.locations ?? []);
  });
}

/** Autorisations : premier plan d'abord (obligatoire avant l'arrière-plan), puis « toujours ». */
export async function demanderAutorisations(): Promise<EtatGps['autorisation']> {
  if (Platform.OS === 'web') return 'refusee';
  try {
    const avant = await Location.requestForegroundPermissionsAsync();
    if (avant.status !== 'granted') {
      useEtatGps.setState({ autorisation: 'refusee' });
      return 'refusee';
    }
    const fond = await Location.requestBackgroundPermissionsAsync();
    const r = fond.status === 'granted' ? 'ok' : 'premier_plan';
    useEtatGps.setState({ autorisation: r });
    return r;
  } catch {
    useEtatGps.setState({ autorisation: 'refusee' });
    return 'refusee';
  }
}

/** Lit l'état des autorisations sans rien demander. */
export async function lireAutorisations(): Promise<EtatGps['autorisation']> {
  if (Platform.OS === 'web') return 'refusee';
  try {
    const avant = await Location.getForegroundPermissionsAsync();
    if (avant.status !== 'granted') {
      const r = avant.canAskAgain ? 'inconnue' : 'refusee';
      useEtatGps.setState({ autorisation: r });
      return r;
    }
    const fond = await Location.getBackgroundPermissionsAsync();
    const r = fond.status === 'granted' ? 'ok' : 'premier_plan';
    useEtatGps.setState({ autorisation: r });
    return r;
  } catch {
    return 'inconnue';
  }
}

/**
 * Démarre le partage de position. Idempotent. Rend l'autorisation obtenue.
 * `demander` : true seulement sur un geste du livreur (bouton du bandeau, après
 * l'explication). Le démarrage automatique ne fait que LIRE l'autorisation — sinon le
 * système rouvrirait les réglages de localisation à chaque rafraîchissement de l'écran.
 */
export async function demarrerSuivi(demander = false): Promise<EtatGps['autorisation']> {
  if (Platform.OS === 'web') return 'refusee';
  const autorisation = demander ? await demanderAutorisations() : await lireAutorisations();
  if (autorisation === 'inconnue') return autorisation;
  if (autorisation === 'refusee') return autorisation;
  try {
    const deja = await Location.hasStartedLocationUpdatesAsync(TACHE_GPS);
    if (!deja) {
      await Location.startLocationUpdatesAsync(TACHE_GPS, {
        accuracy: Location.Accuracy.High,
        timeInterval: 15000,
        distanceInterval: 50,
        deferredUpdatesInterval: 15000,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.OtherNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'Taxi Food Livreur — course en cours',
          notificationBody: 'Ta position est partagée avec le client pendant la livraison.',
          notificationColor: '#E8342A',
          killServiceOnDestroy: false,
        },
      });
    }
    useEtatGps.setState({ actif: true, erreur: null });
    // Un premier point tout de suite : le client voit le livreur sans attendre 15 s.
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then((p) => recevoir([p]))
      .catch(() => {});
  } catch (e) {
    useEtatGps.setState({
      actif: false,
      erreur: (e as { message?: string })?.message ?? 'Impossible de démarrer le GPS.',
    });
  }
  return autorisation;
}

/** Arrête le partage. Idempotent. */
export async function arreterSuivi(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TACHE_GPS)) {
      await Location.stopLocationUpdatesAsync(TACHE_GPS);
    }
  } catch {
    /* déjà arrêté */
  }
  useEtatGps.setState({ actif: false });
}

/** À l'ouverture de l'app : relit l'état réel (la tâche a pu survivre à un redémarrage). */
export async function relireEtatGps(): Promise<void> {
  if (Platform.OS === 'web') return;
  await lireAutorisations();
  try {
    const actif = await Location.hasStartedLocationUpdatesAsync(TACHE_GPS);
    const dernier = await AsyncStorage.getItem(CLE_DERNIER_ENVOI);
    const file = await lireFile();
    useEtatGps.setState({ actif, dernierEnvoi: dernier, enAttente: file.length });
  } catch {
    /* rien */
  }
}
