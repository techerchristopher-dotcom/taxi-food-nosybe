/**
 * Couche d'authentification — Supabase Auth (connexion Google).
 *
 * Le SEUL point de contact avec le backend d'auth. Le reste de l'app ne connaît que
 * le type `Session` et les fonctions exportées ici.
 *
 * Flux : l'écran de connexion obtient un `id_token` Google (via expo-auth-session),
 * puis l'échange contre une session Supabase avec `signInWithIdToken`. Le trigger
 * `handle_new_user` crée automatiquement la ligne `profiles` côté base.
 *
 * ⚠️ CONFIGURATION REQUISE (à faire par Christopher avant que la connexion marche) :
 *   1. Google Cloud Console → identifiants OAuth 2.0 (Web client ID au minimum).
 *   2. Supabase → Authentication → Providers → Google : coller Client ID + Secret.
 *   3. Renseigner l'URI de redirection Supabase dans Google Cloud Console.
 * Tant que EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID est vide, `googleConfigured()` renvoie false
 * et l'écran de connexion affiche un message clair au lieu de lancer le flux.
 */
import { supabase } from './supabase';
import { initialsFromName } from '../data/types';

export type Session = {
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  /** Téléphone : null tant que l'utilisateur ne l'a pas renseigné (1re connexion). */
  phone: string | null;
};

/** Client IDs Google (env). Le Web client ID est requis pour le flux Expo/Supabase. */
export const googleClientIds = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
};

/** true si la connexion Google est configurée (au moins le Web client ID). */
export function googleConfigured(): boolean {
  return Boolean(googleClientIds.webClientId);
}

/** Construit la session applicative à partir de l'utilisateur Auth + sa ligne profiles. */
async function buildSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const user = session.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .maybeSingle();

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = profile?.full_name ?? meta.full_name ?? meta.name ?? 'Client';
  const email = profile?.email ?? user.email ?? '';

  return {
    userId: user.id,
    fullName,
    email,
    initials: initialsFromName(fullName),
    phone: profile?.phone ?? null,
  };
}

/**
 * Échange un id_token Google contre une session Supabase.
 * L'obtention du token se fait côté écran (expo-auth-session) ; ici on ne fait que l'échange.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<Session> {
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  const session = await buildSession();
  if (!session) throw new Error('Session introuvable après connexion.');
  return session;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  return buildSession();
}

/** Enregistre le numéro de téléphone (saisi une fois après la 1re connexion) dans profiles. */
export async function setPhone(phone: string): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
  if (error) throw error;
  return buildSession();
}
