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

/** Fournisseurs OAuth branchés dans l'app. */
export type OAuthProvider = 'google' | 'facebook';

export type Session = {
  userId: string;
  fullName: string;
  email: string;
  initials: string;
  /** Téléphone : null tant que l'utilisateur ne l'a pas renseigné (1re connexion). */
  phone: string | null;
  /**
   * true si le profil porte un vrai nom saisi/fourni. `fullName` retombe sur « Client »
   * quand il manque : sans ce drapeau, l'aiguillage ne saurait pas distinguer un compte
   * Google (nom fourni) d'un compte SMS (aucun nom).
   */
  hasName: boolean;
  /** Rôles du compte (multi-rôle). Vide pour un client « simple » jamais passé par request_role. */
  roles: RoleEntry[];
  /** Restaurant lié si le compte est staff restaurant ACTIF (V1 : un compte = un resto). */
  restaurantId: string | null;
  restaurantName: string | null;
};

/** Deep link de retour de l'OAuth (scheme `taxifood` en natif, origine en web). */
export const redirectTo = makeRedirectUri({ scheme: 'taxifood', path: 'auth/callback' });

/**
 * Présence du Client ID Google en env = drapeau « configuration Google faite ».
 * (Le flux signInWithOAuth s'appuie sur le provider configuré côté Supabase ; ce Client ID
 * n'est pas transmis par l'app, mais sa présence sert de garde avant de lancer le flux.)
 */
export function googleConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
}

/**
 * Présence de l'App ID Facebook en env = drapeau « configuration Facebook faite ».
 *
 * Même logique que pour Google : le flux passe par le provider configuré CÔTÉ Supabase
 * (App ID + App Secret dans Authentication → Providers → Facebook). Cette variable ne sert
 * qu'à éviter d'ouvrir un navigateur sur une erreur Supabase incompréhensible.
 */
export function facebookConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID);
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
 * Lance un flux OAuth (Google ou Facebook) et renvoie la session, ou null si
 * l'utilisateur annule. L'obtention et l'échange du code se font ici ; l'écran n'a
 * qu'à appeler cette fonction.
 *
 * Le parcours est identique pour les deux fournisseurs — seul le nom du provider change,
 * puisque c'est Supabase qui détient les identifiants et pilote la redirection.
 */
export async function signInWithOAuth(provider: OAuthProvider): Promise<Session | null> {
  // WEB / PWA : redirection pleine page vers Google (pas de fenêtre d'auth séparée, qui
  // sort de la PWA sur iOS et ne revient jamais). Au retour sur l'origine, supabase-js
  // échange le `code` (detectSessionInUrl) et onAuthChange met la session à jour.
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return null; // la page est en train de rediriger ; la session arrive au retour.
  }

  // NATIF : on ouvre un onglet d'auth et on capte le deep link de retour.
  console.log('[auth] redirectTo =', redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error(`URL d'autorisation ${provider} indisponible.`);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'success' && result.url) {
    return createSessionFromUrl(result.url);
  }
  // 'cancel' / 'dismiss' : l'utilisateur a fermé la fenêtre.
  return null;
}

/** Raccourci historique — conservé pour ne rien casser côté écrans. */
export async function signInWithGoogle(): Promise<Session | null> {
  return signInWithOAuth('google');
}

export async function signInWithFacebook(): Promise<Session | null> {
  return signInWithOAuth('facebook');
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
  // Repli sur le numéro d'authentification : un compte créé par OTP a déjà un numéro
  // VÉRIFIÉ côté Auth. Sans ce repli, un profil au numéro vide renverrait un client
  // déjà inscrit sur l'écran « ton numéro » pour lui redemander ce qu'il vient de valider.
  const authPhone = (user.phone ?? '').trim() || null;
  const rawName = (profile?.full_name ?? meta.full_name ?? meta.name ?? '').trim();
  const fullName = rawName || 'Client';
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
    phone: profile?.phone ?? authPhone,
    hasName: rawName.length > 0,
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

/** Envoie un OTP par SMS (nécessite le provider phone activé dans Supabase). */
export async function signInWithPhone(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Vérifie l'OTP reçu par SMS et retourne la session. */
export async function verifyPhoneOtp(phone: string, token: string): Promise<Session | null> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
  return buildSession();
}

/**
 * Codes d'erreur d'authentification traduits par les écrans.
 *
 * On NE propage PAS le message brut de Supabase (anglais, technique) : chaque écran mappe
 * ce code sur une clé i18n. `unknown` est le repli pour tout ce qui n'est pas identifié.
 */
export type AuthErrorCode =
  | 'invalidCredentials'
  | 'emailTaken'
  | 'weakPassword'
  | 'invalidEmail'
  | 'rateLimit'
  | 'notConfigured'
  | 'unknown';

export class AuthError extends Error {
  code: AuthErrorCode;
  constructor(code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** Traduit une erreur Supabase Auth en code métier. */
function authErrorCode(e: unknown): AuthErrorCode {
  const err = e as { code?: string; status?: number; message?: string };
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
    return 'invalidCredentials';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered')) {
    return 'emailTaken';
  }
  if (code === 'weak_password' || msg.includes('password should be')) return 'weakPassword';
  if (code === 'validation_failed' || msg.includes('invalid email')) return 'invalidEmail';
  if (err?.status === 429 || code.includes('rate_limit')) return 'rateLimit';
  if (msg.includes('not enabled') || msg.includes('unsupported')) return 'notConfigured';
  return 'unknown';
}

/** Format e-mail minimal — on laisse Supabase faire la validation qui fait foi. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/** Longueur minimale imposée par Supabase Auth par défaut. */
export const MIN_PASSWORD_LENGTH = 8;

/** Connexion avec un e-mail et un mot de passe déjà créés. */
export async function signInWithEmail(email: string, password: string): Promise<Session | null> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw new AuthError(authErrorCode(error));
  return buildSession();
}

/**
 * Crée un compte e-mail + mot de passe.
 *
 * Le nom est passé dans `options.data.full_name` : c'est exactement ce que lit le trigger
 * `handle_new_user` pour remplir `profiles.full_name`. Sans ça, un compte e-mail serait
 * créé sans nom, comme les comptes SMS.
 *
 * Renvoie `{ session: null, needsConfirmation: true }` quand la confirmation d'e-mail est
 * active côté Supabase : le compte existe mais la session n'arrive qu'après le clic sur
 * le lien reçu par e-mail.
 */
export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
): Promise<{ session: Session | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: redirectTo },
  });
  if (error) throw new AuthError(authErrorCode(error));
  if (!data.session) return { session: null, needsConfirmation: true };
  return { session: await buildSession(), needsConfirmation: false };
}

/** Envoie l'e-mail de réinitialisation de mot de passe. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) throw new AuthError(authErrorCode(error));
}

/**
 * Enregistre le nom du profil.
 *
 * Nécessaire pour les comptes créés par SMS : l'OTP ne fournit aucun nom, et le livreur
 * comme le restaurant ont besoin de savoir qui ils servent.
 */
export async function setFullName(fullName: string): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const name = fullName.trim();
  const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
  if (error) throw error;
  // Recopié aussi dans les métadonnées Auth : `buildSession` s'en sert de repli si la
  // lecture du profil échoue (RLS, réseau), et ça garde les deux sources cohérentes.
  await supabase.auth.updateUser({ data: { full_name: name } });
  return buildSession();
}

/** Levée quand le numéro saisi appartient déjà à un autre compte (index d'unicité). */
export class PhoneAlreadyUsedError extends Error {
  constructor() {
    super('PHONE_ALREADY_USED');
    this.name = 'PhoneAlreadyUsedError';
  }
}

/**
 * Enregistre le numéro de téléphone (saisi une fois après la 1re connexion) dans profiles.
 *
 * Un index d'unicité (`profiles_phone_unique`) empêche deux profils de porter le même
 * numéro : on traduit la violation 23505 en erreur métier pour que l'écran affiche un
 * message utile plutôt qu'un message Postgres.
 */
export async function setPhone(phone: string): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { error } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
  if (error) {
    if (error.code === '23505') throw new PhoneAlreadyUsedError();
    throw error;
  }
  return buildSession();
}
