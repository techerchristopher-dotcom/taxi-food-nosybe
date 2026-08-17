import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fr from '../locales/fr.json';
import en from '../locales/en.json';
import it from '../locales/it.json';

/**
 * Multilingue — français (défaut), anglais, italien.
 *
 * Règles retenues :
 *  - le FRANÇAIS est la langue de repli : Nosy Be est francophone, et une clé oubliée
 *    doit s'afficher en français plutôt que de montrer la clé brute ;
 *  - au 1er lancement on suit la langue du téléphone SI elle fait partie des trois,
 *    sinon français ;
 *  - le choix manuel (écran Profil) est persisté localement, sans compte : il vaut donc
 *    pour un visiteur non connecté et survit à la déconnexion.
 *
 * ⚠️ On ne traduit QUE les libellés d'interface. Les noms de restaurants, de produits et
 * d'options viennent de la base et s'affichent tels quels — les traduire donnerait des
 * plats introuvables à la lecture de la commande côté cuisine.
 */

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const SUPPORTED: LanguageCode[] = ['fr', 'en', 'it'];
const STORAGE_KEY = 'taxifood.language';

/** Langue du téléphone si elle est gérée, sinon français. */
function deviceLanguage(): LanguageCode {
  try {
    for (const locale of Localization.getLocales()) {
      const code = (locale.languageCode ?? '').toLowerCase();
      if ((SUPPORTED as string[]).includes(code)) return code as LanguageCode;
    }
  } catch {
    /* certaines plateformes web n'exposent rien : on reste en français */
  }
  return 'fr';
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    it: { translation: it },
  },
  lng: 'fr', // remplacé par `hydrateLanguage()` au démarrage
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React échappe déjà
  returnNull: false,
});

/**
 * Applique la langue au démarrage : choix mémorisé s'il existe, sinon langue du téléphone.
 * Appelé une fois depuis `app/_layout.tsx`, avant le premier rendu des écrans.
 */
export async function hydrateLanguage(): Promise<void> {
  let code: LanguageCode | null = null;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED as string[]).includes(saved)) code = saved as LanguageCode;
  } catch {
    /* stockage indisponible : on retombe sur la langue du téléphone */
  }
  await i18n.changeLanguage(code ?? deviceLanguage());
}

/** Choix manuel depuis le Profil : effet immédiat + mémorisé pour les lancements suivants. */
export async function setLanguage(code: LanguageCode): Promise<void> {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* la langue reste appliquée pour cette session, simplement non mémorisée */
  }
}

export default i18n;
