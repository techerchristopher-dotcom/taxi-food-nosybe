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
import * as AppleAuthentication from 'expo-apple-authentication';
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
 * Présence du Client ID Google **iOS** en env = drapeau « connexion Google native prête ».
 *
 * Distinct de `googleConfigured()` : celui-ci porte sur le Client ID **web**, utilisé par le
 * flux navigateur ci-dessous. Le natif exige un Client ID d'un AUTRE type OAuth (« iOS »,
 * créé dans Google Cloud avec le bundle `com.chris97416.taxi-food-nosybe`), en plus du
 * plugin de config natif dans `app.json`. Tant qu'il manque, l'écran garde le bouton Google
 * actuel (navigateur) — comportement identique à aujourd'hui, aucune régression.
 */
export function googleNativeAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
}

/**
 * Connexion Google en **natif** : le sélecteur de compte système, pas un onglet de
 * navigateur — même principe que `signInWithApple` juste au-dessus.
 *
 * ⚠️ Import **dynamique**, jamais statique en haut de fichier : `@react-native-google-
 * signin/google-signin` est un module natif sans version web. Un import statique serait
 * bundlé côté web par Metro (le bundle compile sans erreur), mais planterait potentiellement
 * à l'exécution dans le navigateur puisque le module cherche un pont natif absent. L'import
 * dynamique, lui, n'est évalué que si cette fonction est appelée — et `googleNativeAvailable`
 * garantit qu'elle ne l'est jamais sur web.
 *
 * ⚠️ Le Client ID **web** (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) doit être passé en
 * `webClientId` à `GoogleSignin.configure` : c'est lui qui doit apparaître dans l'audience du
 * jeton pour que Supabase l'accepte, pas le Client ID iOS (qui ne sert qu'au SDK natif pour
 * savoir quelle app demande la connexion).
 */
export async function signInWithGoogleNative(): Promise<Session | null> {
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = await import(
    '@react-native-google-signin/google-signin'
  );

  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  let response: Awaited<ReturnType<typeof GoogleSignin.signIn>>;
  try {
    await GoogleSignin.hasPlayServices();
    response = await GoogleSignin.signIn();
  } catch (e: unknown) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw e;
  }
  if (!isSuccessResponse(response)) return null; // sélecteur fermé sans choix.

  const idToken = response.data.idToken;
  if (!idToken) throw new Error('Google n’a pas renvoyé de jeton.');

  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) throw error;
  return buildSession();
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

/**
 * Connexion Facebook native prête dès que la plateforme le permet — App ID et Client Token
 * sont désormais fixés dans `app.json` (plugin natif), plus aucune valeur ne manque côté
 * app. iOS uniquement : aucun build Android n'existe pour ce projet.
 */
export function facebookNativeAvailable(): boolean {
  return Platform.OS === 'ios' && facebookConfigured();
}

/**
 * Connexion Facebook en **natif** : si l'app Facebook est installée, le SDK bascule dessus
 * directement (retrouve la session déjà ouverte, aucune ressaisie) ; sinon, il ouvre une
 * feuille système (Safari intégré), jamais un onglet séparé qui affiche le domaine Supabase.
 *
 * ⚠️ Import **dynamique**, même raison que pour Google : `react-native-fbsdk-next` est un
 * module natif sans version web, jamais évalué hors iOS/Android grâce à
 * `facebookNativeAvailable`.
 *
 * ⚠️ Contrairement à Apple/Google, Facebook ne fournit **pas** de jeton OIDC signé au flux
 * classique : `signInWithIdToken` attend ici le **jeton d'accès** du SDK tel quel (confirmé
 * dans la documentation Supabase — c'est elle qui interroge l'API Graph de Facebook côté
 * serveur avec l'App Secret pour le valider, à la différence d'Apple/Google où le jeton est
 * vérifié par sa signature).
 */
export async function signInWithFacebookNative(): Promise<Session | null> {
  const { LoginManager, AccessToken } = await import('react-native-fbsdk-next');

  const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
  if (result.isCancelled) return null;

  const token = await AccessToken.getCurrentAccessToken();
  if (!token) throw new Error('Facebook n’a pas renvoyé de jeton.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'facebook',
    token: token.accessToken,
  });
  if (error) throw error;
  return buildSession();
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

/**
 * Sign in with Apple — disponible seulement sur iOS 13+.
 *
 * Apple ne fournit son bouton que là ; sur Android et sur le web l'écran de connexion ne
 * doit pas l'afficher (règle Apple, et de toute façon le module n'y répond pas).
 */
export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Connexion par Apple, en **natif** : pas de navigateur, c'est le système qui présente la
 * feuille Face ID / mot de passe. Apple renvoie un `identityToken` (JWT OIDC) qu'on échange
 * directement contre une session Supabase — d'où `signInWithIdToken` et non le flux OAuth
 * web utilisé pour Google.
 *
 * ⚠️ Apple ne transmet le NOM qu'à la **toute première** connexion, jamais ensuite. Si on
 * ne le capte pas maintenant, il est perdu définitivement pour ce compte : le jeton, lui,
 * ne porte que l'e-mail. On le recopie donc dans le profil dans la foulée.
 *
 * ⚠️ L'e-mail peut être une adresse relais `@privaterelay.appleid.com` si la personne a
 * choisi de masquer le sien. C'est normal et il faut l'accepter tel quel.
 *
 * Renvoie null si l'utilisateur annule la feuille système.
 */
export async function signInWithApple(): Promise<Session | null> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e: unknown) {
    // L'annulation remonte comme une erreur `ERR_REQUEST_CANCELED` : ce n'est pas un échec,
    // l'écran ne doit afficher aucun message.
    if (typeof e === 'object' && e && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw e;
  }

  if (!credential.identityToken) throw new Error('Apple n’a pas renvoyé de jeton.');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) throw error;

  const nom = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (nom) {
    // Ne jamais écraser un nom déjà en place : à la première connexion il n'y en a pas,
    // et aux suivantes Apple ne renvoie rien de toute façon.
    const session = await buildSession();
    if (session && !session.hasName) await setFullName(nom);
  }

  return buildSession();
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Supprime définitivement le compte de l'utilisateur connecté (règle Apple 5.1.1(v)).
 *
 * La RPC ne prend aucun paramètre : elle agit sur `auth.uid()`, donc on ne peut pas viser
 * le compte de quelqu'un d'autre. Disparaissent : profil, adresses, rôles, rattachement
 * restaurant, fiche livreur et jetons push. Les **commandes sont conservées mais
 * anonymisées** (`user_id` et `address_id` à NULL) — sinon supprimer un compte fausserait
 * rétroactivement le rapport de clôture et les reversements aux restaurants.
 *
 * Refusé tant qu'une livraison est en cours : la commande resterait bloquée côté client et
 * restaurant, sans personne pour la livrer. Le message de la base remonte tel quel.
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  // La session locale ne vaut plus rien : le compte n'existe plus côté serveur.
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  return buildSession();
}

/**
 * Envoie le code de vérification au numéro (nécessite le provider phone activé dans Supabase).
 *
 * ⚠️ Le code part par **WhatsApp**, pas par SMS : le « Send SMS Hook » de Supabase
 * détourne l'envoi vers l'Edge Function `send-otp-whatsapp`. Rien à changer ici — côté
 * API le canal reste nommé « sms », c'est seulement le transport qui diffère.
 */
export async function signInWithPhone(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

/** Vérifie le code reçu (par WhatsApp) et retourne la session. */
export async function verifyPhoneOtp(phone: string, token: string): Promise<Session | null> {
  // `type: 'sms'` est le nom du canal côté Supabase, indépendamment du transport réel.
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
