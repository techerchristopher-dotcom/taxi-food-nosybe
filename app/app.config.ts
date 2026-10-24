/**
 * Deux applications, un seul projet (2026-10-17) — docs/APP-LIVREUR-CAHIER-DES-CHARGES.md § 3.
 *
 *   - sans variable            → « Taxi Food », l'app client : `app.json` tel quel, RIEN ne change ;
 *   - `APP_VARIANT=distripro`  → le site distripro207.com (web seulement), écrans dans
 *     `app-distripro/`, module partagé `distripro/` (le même que l'onglet « Commander ») ;
 *   - `APP_VARIANT=livreur`    → « Taxi Food Livreur » : autre identifiant, autre projet EAS
 *     (donc flux de mises à jour séparé), écrans dans `app-livreur/`, position en arrière-plan.
 *
 * ⚠️ L'app livreur ne déclare AUCUN lien universel (associatedDomains, intentFilters
 * https) : sinon les liens partagés aux clients s'ouvriraient dans l'app livreur.
 * Notifications Android : `google-services-livreur.json` (app Firebase
 * `1:227662072769:android:db36612400e2822805fd40`). Les jetons sont rangés par app
 * (`push_tokens.app`), voir § 6.1 du cahier des charges.
 */
import type { ConfigContext, ExpoConfig } from 'expo/config';

const LIVREUR = process.env.APP_VARIANT === 'livreur';
/** Le site distripro207.com (web seulement) : le module `distripro/`, sans rien de Taxi Food. */
const DISTRIPRO = process.env.APP_VARIANT === 'distripro';

/** Projet EAS de l'app livreur (créé le 2026-10-17). */
const PROJET_EAS_LIVREUR = 'e0d5567e-9321-4071-94e8-44910ab1434d'; // @chris97416/taxi-food-livreur

type Plugin = string | [string, Record<string, unknown>];

function nomDuPlugin(p: unknown): string {
  return Array.isArray(p) ? String(p[0]) : String(p);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = config as ExpoConfig;
  if (DISTRIPRO) {
    // Web seulement : aucun build natif, aucune mise à jour à distance. Les écrans viennent
    // de `app-distripro/` ; Stripe, la position, la galerie n'ont rien à faire ici.
    const garde = new Set(['expo-font', 'expo-web-browser']);
    const plugins: Plugin[] = (base.plugins ?? []).filter((p) => garde.has(nomDuPlugin(p))) as Plugin[];
    plugins.unshift(['expo-router', { root: './app-distripro' }]);
    return {
      ...base,
      name: 'DistriPro',
      slug: 'distripro',
      scheme: 'distripro',
      web: { ...(base.web ?? {}), themeColor: '#1A3B31', name: 'DistriPro', shortName: 'DistriPro', lang: 'fr' } as ExpoConfig['web'],
      plugins,
      extra: {
        ...base.extra,
        variante: 'distripro',
        router: { ...(base.extra?.router ?? {}), root: './app-distripro' },
      },
    };
  }
  if (!LIVREUR) return base;

  const projetEas = PROJET_EAS_LIVREUR;

  // Plugins de l'app client qu'on garde, avec leurs options. Stripe et le partage
  // dans la galerie n'ont rien à faire ici ; la position est redéclarée plus bas.
  const exclus = new Set(['@stripe/stripe-react-native', 'expo-media-library', 'expo-location', 'expo-router', 'expo-image-picker']);
  const plugins: Plugin[] = (base.plugins ?? []).filter((p) => !exclus.has(nomDuPlugin(p))) as Plugin[];

  plugins.unshift(['expo-router', { root: './app-livreur' }]);
  plugins.push([
    'expo-image-picker',
    {
      photosPermission: 'Taxi Food Livreur accède à tes photos seulement si tu en envoies une dans la messagerie d’une commande.',
      cameraPermission: 'Taxi Food Livreur utilise l’appareil photo seulement si tu envoies une photo dans la messagerie d’une commande.',
      microphonePermission: false,
    },
  ]);
  plugins.push([
    'expo-location',
    {
      locationAlwaysAndWhenInUsePermission:
        'Taxi Food Livreur partage ta position avec le client et Taxi Food pendant tes courses uniquement, même quand tu utilises une app de navigation. Elle n’est jamais partagée en dehors d’une course.',
      locationWhenInUsePermission:
        'Taxi Food Livreur partage ta position avec le client et Taxi Food pendant tes courses uniquement.',
      locationAlwaysPermission:
        'Taxi Food Livreur partage ta position avec le client et Taxi Food pendant tes courses uniquement, même quand tu utilises une app de navigation.',
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
      isIosBackgroundLocationEnabled: true,
    },
  ]);

  const { associatedDomains: _domaines, ...ios } = base.ios ?? {};
  const { intentFilters: _liens, googleServicesFile: _fcm, ...android } = base.android ?? {};

  return {
    ...base,
    name: 'Taxi Food Livreur',
    slug: 'taxi-food-livreur',
    scheme: 'taxifoodlivreur',
    version: '1.0.0',
    runtimeVersion: '1.0.0',
    icon: './assets/livreur/icon.png',
    updates: { url: `https://u.expo.dev/${projetEas}` },
    ios: {
      ...ios,
      bundleIdentifier: 'com.chris97416.taxifood-livreur',
      infoPlist: {
        ...(ios.infoPlist ?? {}),
        UIBackgroundModes: ['location'],
      },
    },
    android: {
      ...android,
      package: 'com.chris97416.taxifoodlivreur',
      // App déclarée dans Firebase le 2026-10-17 (notifications Android, FCM).
      googleServicesFile: './google-services-livreur.json',
      adaptiveIcon: {
        ...(android.adaptiveIcon ?? {}),
        foregroundImage: './assets/livreur/android-icon-foreground.png',
      },
      permissions: [
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_LOCATION',
        'android.permission.WAKE_LOCK',
      ],
    },
    plugins,
    extra: {
      ...base.extra,
      variante: 'livreur',
      router: { ...(base.extra?.router ?? {}), root: './app-livreur' },
      eas: { projectId: projetEas },
    },
  };
};
