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
import type { Session } from '../lib/auth';
import type { AppMode, AppRole } from '../data/types';

const MODE_KEY = 'tf_mode';

type SessionState = {
  session: Session | null;
  loading: boolean;
  /** Mode d'usage choisi (client/restaurant), null tant que non choisi. */
  mode: AppMode | null;
  hydrate: () => Promise<void>;
  /** Recharge la session (rôles inclus) depuis le backend. */
  refresh: () => Promise<Session | null>;
  /** Lance le flux Google (signInWithOAuth) et met à jour la session. */
  signInWithGoogle: () => Promise<Session | null>;
  /** Finalise une session à partir d'un deep link de retour OAuth (cold start). */
  completeFromUrl: (url: string) => Promise<Session | null>;
  signOut: () => Promise<void>;
  setPhone: (phone: string) => Promise<void>;
  /** Choisit le mode d'usage courant (persisté). */
  setMode: (mode: AppMode | null) => Promise<void>;
  /** Demande un rôle (request_role) puis rafraîchit la session. */
  requestRole: (role: AppRole) => Promise<Session | null>;
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
  },
  refresh: async () => {
    const session = await auth.getSession();
    set({ session });
    return session;
  },
  signInWithGoogle: async () => {
    const session = await auth.signInWithGoogle();
    if (session) set({ session });
    return session;
  },
  completeFromUrl: async (url: string) => {
    const session = await auth.createSessionFromUrl(url);
    if (session) set({ session });
    return session;
  },
  signOut: async () => {
    await auth.signOut();
    await AsyncStorage.removeItem(MODE_KEY);
    set({ session: null, mode: null });
  },
  setPhone: async (phone: string) => {
    const updated = await auth.setPhone(phone);
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
}));
