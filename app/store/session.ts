/**
 * État de session global (zustand), au-dessus de lib/auth.
 * Les écrans consomment ce store ; lib/auth reste le seul point de contact avec le backend.
 */
import { create } from 'zustand';
import * as auth from '../lib/auth';
import type { Session } from '../lib/auth';

type SessionState = {
  session: Session | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  signIn: () => Promise<Session>;
  signOut: () => Promise<void>;
  setPhone: (phone: string) => Promise<void>;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  loading: true,
  hydrate: async () => {
    const session = await auth.getSession();
    set({ session, loading: false });
  },
  signIn: async () => {
    const session = await auth.signIn();
    set({ session });
    return session;
  },
  signOut: async () => {
    await auth.signOut();
    set({ session: null });
  },
  setPhone: async (phone: string) => {
    const updated = await auth.setPhone(phone);
    set({ session: updated });
  },
}));
