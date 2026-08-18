/**
 * État de session global (zustand), au-dessus de lib/auth.
 * Les écrans consomment ce store ; lib/auth reste le seul point de contact avec le backend.
 *
 * Multi-rôle : la session porte les rôles du compte + le restaurant lié. Le `mode` (client
 * ou restaurant) est le choix d'usage courant, persisté localement pour éviter de repasser
 * par l'écran de sélection à chaque lancement.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as auth from '../lib/auth';
import { unregisterFromPush } from '../lib/push';
import type { Session } from '../lib/auth';
import type { AppMode, AppRole } from '../data/types';

const MODE_KEY = 'tf_mode';

// Abonnement unique aux changements d'auth (récupère la session au retour OAuth web).
let authSubscribed = false;

type SessionState = {
  session: Session | null;
  loading: boolean;
  /** Mode d'usage choisi (client/restaurant), null tant que non choisi. */
  mode: AppMode | null;
  hydrate: () => Promise<void>;
  /** Recharge la session (rôles inclus) depuis le backend. */
  refresh: () => Promise<Session | null>;
  /** Lance un flux OAuth (Google ou Facebook) et met à jour la session. */
  signInWithOAuth: (provider: auth.OAuthProvider) => Promise<Session | null>;
  /** Finalise une session à partir d'un deep link de retour OAuth (cold start). */
  completeFromUrl: (url: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  /** Supprime définitivement le compte (règle Apple 5.1.1(v)) puis vide la session. */
  deleteAccount: () => Promise<void>;
  setPhone: (phone: string) => Promise<void>;
  /** Enregistre le nom du profil (comptes créés par SMS, sans nom). */
  setFullName: (fullName: string) => Promise<void>;
  /** Choisit le mode d'usage courant (persisté). */
  setMode: (mode: AppMode | null) => Promise<void>;
  /** Demande un rôle (request_role) puis rafraîchit la session. */
  requestRole: (role: AppRole) => Promise<Session | null>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<Session | null>;
  /** Connexion e-mail + mot de passe (compte déjà créé). */
  signInWithEmail: (email: string, password: string) => Promise<Session | null>;
  /** Création de compte e-mail + mot de passe. `needsConfirmation` = e-mail à valider. */
  signUpWithEmail: (
    fullName: string,
    email: string,
    password: string,
  ) => Promise<{ session: Session | null; needsConfirmation: boolean }>;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  loading: true,
  mode: null,
  hydrate: async () => {
    const [session, mode] = await Promise.all([
      auth.getSession(),
      AsyncStorage.getItem(MODE_KEY),
    ]);
    set({ session, mode: (mode as AppMode | null) ?? null, loading: false });
    // Sur web, le retour de la redirection OAuth établit la session au chargement :
    // on la propage ici (sinon l'écran reste bloqué sur le login).
    if (!authSubscribed) {
      authSubscribed = true;
      auth.onAuthChange((s) => set({ session: s, loading: false }));
    }
  },
  refresh: async () => {
    const session = await auth.getSession();
    set({ session });
    return session;
  },
  signInWithOAuth: async (provider: auth.OAuthProvider) => {
    const session = await auth.signInWithOAuth(provider);
    if (session) set({ session });
    return session;
  },
  completeFromUrl: async (url: string) => {
    const session = await auth.createSessionFromUrl(url);
    if (session) set({ session });
    return session;
  },
  signOut: async () => {
    // AVANT auth.signOut : la RPC a besoin du jeton d'accès encore valide. Sans ça,
    // l'appareil resterait abonné aux notifications du compte qu'on vient de quitter.
    await unregisterFromPush();
    await auth.signOut();
    await AsyncStorage.removeItem(MODE_KEY);
    set({ session: null, mode: null });
  },
  deleteAccount: async () => {
    // Même ordre que signOut : le désenregistrement du jeton push a besoin du jeton
    // d'accès encore valide. La suppression en base l'effacerait de toute façon, mais on
    // ne veut pas dépendre de la cascade si la RPC échoue en cours de route.
    await unregisterFromPush();
    await auth.deleteAccount();
    await AsyncStorage.removeItem(MODE_KEY);
    set({ session: null, mode: null });
  },
  setPhone: async (phone: string) => {
    const updated = await auth.setPhone(phone);
    set({ session: updated });
  },
  setFullName: async (fullName: string) => {
    const updated = await auth.setFullName(fullName);
    set({ session: updated });
  },
  setMode: async (mode: AppMode | null) => {
    if (mode) await AsyncStorage.setItem(MODE_KEY, mode);
    else await AsyncStorage.removeItem(MODE_KEY);
    set({ mode });
  },
  requestRole: async (role: AppRole) => {
    const session = await auth.requestRole(role);
    if (session) set({ session });
    return session;
  },
  signInWithPhone: async (phone: string) => {
    await auth.signInWithPhone(phone);
  },
  verifyPhoneOtp: async (phone: string, token: string) => {
    const session = await auth.verifyPhoneOtp(phone, token);
    if (session) set({ session });
    return session;
  },
  signInWithEmail: async (email: string, password: string) => {
    const session = await auth.signInWithEmail(email, password);
    if (session) set({ session });
    return session;
  },
  signUpWithEmail: async (fullName: string, email: string, password: string) => {
    const result = await auth.signUpWithEmail(fullName, email, password);
    if (result.session) set({ session: result.session });
    return result;
  },
}));
