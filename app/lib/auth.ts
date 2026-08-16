/**
 * Couche d'authentification — Supabase Auth (connexion Google).
 *
 * Le SEUL point de contact avec le backend d'auth. Le reste de l'app ne connaît que
 * le type `Session` et les fonctions exportées ici.
 *
 * Flux retenu : `supabase.auth.signInWithOAuth({ provider: 'google' })`, cohérent avec
 * la config Google (seule l'URI de callback Supabase est déclarée côté Google, et le
 * provider Google est configuré côté tableau de bord Supabase avec Client ID + Secret).
 *   1. signInWithOAuth renvoie l'URL d'autorisation Google (via Supabase).
 *   2. On l'ouvre dans un onglet d'auth (expo-web-browser).
 *   3. Google → callback Supabase → redirection vers le deep link de l'app (redirectTo),
 *      avec un `code` PKCE.
 *   4. On échange ce code contre une session (exchangeCodeForSession).
 *   5. Le trigger `handle_new_user` crée automatiquement la ligne `profiles`.
 *
 * ⚠️ CÔTÉ SUPABASE : le deep link de retour (`redirectTo` ci-dessous) doit figurer dans
 * Authentication → URL Configuration → Redirect URLs (ex. `taxifood://*`, et l'URL de dev
 * `exp://...` si test en Expo Go). Il est loggé au lancement du flux pour être recopié.
 */
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from './supabase';
import { AppRole, initialsFromName, RoleEntry } from '../data/types';

export type Session = {
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  /** Téléphone : null tant que l'utilisateur ne l'a pas renseigné (1re connexion). */
  phone: string | null;
  /** Rôles du compte (multi-rôle). Vide pour un client « simple » jamais passé par request_role. */
  roles: RoleEntry[];
  /** Restaurant lié si le compte est staff restaurant ACTIF (V1 : un compte = un resto). */
  restaurantId: string | null;
  restaurantName: string | null;
};

/** Deep link de retour de l'OAuth (scheme `taxifood` en natif, origine en web). */
export const redirectTo = makeRedirectUri({ scheme: 'taxifood' });

/**
 * Présence du Client ID Google en env = drapeau « configuration Google faite ».
 * (Le flux signInWithOAuth s'appuie sur le provider configuré côté Supabase ; ce Client ID
 * n'est pas transmis par l'app, mais sa présence sert de garde avant de lancer le flux.)
 */
export function googleConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}

/** Extrait les paramètres d'un deep link (query et fragment). */
function parseParams(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const afterQ = url.split('?')[1]?.split('#')[0];
  const afterHash = url.split('#')[1];
  for (const part of [afterQ, afterHash]) {
    if (!part) continue;
    for (const kv of part.split('&')) {
      const [k, v] = kv.split('=');
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
    }
  }
  return out;
}

/** Finalise la session à partir de l'URL de retour (code PKCE ou tokens implicites). */
export async function createSessionFromUrl(url: string): Promise<Session | null> {
  const params = parseParams(url);
  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error);
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    return buildSession();
  }
  if (params.access_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw error;
    return buildSession();
  }
  return null;
}

/**
 * Lance le flux Google et renvoie la session (ou null si l'utilisateur annule).
 * L'obtention et l'échange du code se font ici ; l'écran n'a qu'à appeler cette fonction.
 */
export async function signInWithGoogle(): Promise<Session | null> {
  // WEB / PWA : redirection pleine page vers Google (pas de fenêtre d'auth séparée, qui
  // sort de la PWA sur iOS et ne revient jamais). Au retour sur l'origine, supabase-js
  // échange le `code` (detectSessionInUrl) et onAuthChange met la session à jour.
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return null; // la page est en train de rediriger ; la session arrive au retour.
  }

  // NATIF : on ouvre un onglet d'auth et on capte le deep link de retour.
  console.log('[auth] redirectTo =', redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("URL d'autorisation Google indisponible.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    return createSessionFromUrl(result.url);
  }
  // 'cancel' / 'dismiss' : l'utilisateur a fermé la fenêtre.
  return null;
}

/**
 * S'abonne aux changements d'état d'auth Supabase (utile sur web : après la redirection
 * OAuth, la session est établie au chargement — on la propage au store).
 */
export function onAuthChange(cb: (session: Session | null) => void) {
  return supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
      cb(await buildSession());
    } else if (event === 'SIGNED_OUT') {
      cb(null);
    }
  });
}

/** Construit la session applicative à partir de l'utilisateur Auth + sa ligne profiles. */
async function buildSession(): Promise<Session | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const user = session.user;

  // Profil + rôles + restaurant lié en parallèle.
  const [{ data: profile }, { data: roleRows }, { data: staffRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role, status'),
    supabase.from('restaurant_staff').select('restaurant_id, restaurants ( name )'),
  ]);

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const fullName = profile?.full_name ?? meta.full_name ?? meta.name ?? 'Client';
  const email = profile?.email ?? user.email ?? '';

  const roles = (roleRows ?? []) as RoleEntry[];
  const hasActiveRestaurant = roles.some((r) => r.role === 'restaurant' && r.status === 'active');
  // Le lien staff n'est retenu que si le rôle restaurant est ACTIF (sinon pas d'accès).
  // L'embed `restaurants` peut arriver en objet ou en tableau selon l'inférence — on normalise.
  const staff = (staffRows ?? []) as unknown as {
    restaurant_id: string;
    restaurants: { name: string } | { name: string }[] | null;
  }[];
  const link = hasActiveRestaurant ? staff[0] : undefined;
  const linkRestaurant = Array.isArray(link?.restaurants) ? link?.restaurants[0] : link?.restaurants;

  return {
    userId: user.id,
    fullName,
    email,
    initials: initialsFromName(fullName),
    phone: profile?.phone ?? null,
    roles,
    restaurantId: link?.restaurant_id ?? null,
    restaurantName: linkRestaurant?.name ?? null,
  };
}

/**
 * Demande un rôle (`request_role`) : `client` s'active tout de suite, `restaurant`/
 * `livreur` restent `pending` jusqu'à validation manuelle de l'admin. Renvoie la session
 * rafraîchie (rôles à jour).
 */
export async function requestRole(role: AppRole): Promise<Session | null> {
  const { error } = await supabase.rpc('request_role', { p_role: role });
  if (error) throw error;
  return buildSession();
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
