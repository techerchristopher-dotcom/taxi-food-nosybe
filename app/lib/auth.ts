/**
 * Couche d'authentification — ISOLÉE derrière une interface claire.
 *
 * ⚠️ SCAFFOLD MVP : pour l'instant, aucune vraie authentification réseau.
 * Le bouton « Continuer avec Google » simule une connexion et stocke la session en local
 * (AsyncStorage). Le flux d'écran et l'UI sont en place ; le vrai OAuth Google via
 * Supabase Auth sera branché plus tard.
 *
 * ➜ Pour brancher Supabase Auth (Google OAuth), il ne faut modifier QUE ce fichier :
 *    - signIn()  : lancer le flux expo-auth-session / supabase.auth.signInWithOAuth
 *    - signOut() : supabase.auth.signOut()
 *    - getSession() : supabase.auth.getSession()
 *    Le reste de l'app ne connaît que ces trois fonctions et le type Session.
 *
 * NB : expo-auth-session / expo-web-browser / expo-crypto sont déjà installés et prêts
 * à être utilisés ici lorsque le vrai provider Google sera configuré (client IDs à fournir).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockProfile } from '../data/mock';

const SESSION_KEY = 'taxi-food.session';

export type Session = {
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  /** Téléphone : null tant que l'utilisateur ne l'a pas renseigné (1re connexion). */
  phone: string | null;
};

/**
 * Simule la connexion Google. Renvoie une session SANS téléphone : l'app redirige alors
 * vers l'écran de saisie du numéro (obligatoire avant de commander), comme au 1er login réel.
 */
export async function signIn(): Promise<Session> {
  const session: Session = {
    userId: mockProfile.id,
    fullName: mockProfile.fullName,
    email: mockProfile.email,
    initials: mockProfile.initials,
    phone: null,
  };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function getSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

/** Enregistre le numéro de téléphone (saisi une fois après la 1re connexion). */
export async function setPhone(phone: string): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  const updated = { ...session, phone };
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(updated));
  return updated;
}
