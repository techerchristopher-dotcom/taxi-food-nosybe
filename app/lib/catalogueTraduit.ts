/**
 * Traduction des MENUS (noms de plats, descriptions, catégories, options, types de cuisine,
 * libellés d'emballage) — 2026-10-02.
 *
 * Les menus sont saisis en français en base. Le dictionnaire `traductions_catalogue`
 * (français → anglais / italien) est chargé UNE fois par langue, et appliqué par les écrans
 * CLIENTS seulement. Une traduction manquante, ou une base injoignable, laisse le français :
 * on n'affiche jamais une clé vide, et un plat ajouté demain reste lisible avant traduction.
 *
 * ⚠️ JAMAIS dans l'espace restaurateur ni chez le livreur. Un restaurateur dont le téléphone
 * est en anglais qui modifierait son plat réenregistrerait le nom ANGLAIS à la place du
 * français. C'est pourquoi `getMenu` ne traduit que sur demande (`{ traduire: true }`) et
 * que `getFeaturedLibrary` / `listRestaurantOrders` ne traduisent jamais.
 *
 * ⚠️ La COMMANDE n'est pas concernée : `create_order` fige les noms depuis la base
 * (`product_name_snapshot`, `option_name_snapshot`), donc en français — la cuisine reçoit
 * toujours le nom de SA carte, quelle que soit la langue du client.
 */
import i18n from 'i18next';
import { supabase } from './supabase';

type Langue = 'fr' | 'en' | 'it';

let langueChargee: Langue | null = null;
let dico = new Map<string, string>();
let enCours: { langue: Langue; promesse: Promise<void> } | null = null;

/** La langue d'affichage du catalogue : celle de l'interface, si elle est traduite. */
export function langueCatalogue(): Langue {
  const l = (i18n.language || 'fr').slice(0, 2);
  return l === 'en' || l === 'it' ? l : 'fr';
}

/**
 * Charge le dictionnaire de la langue active s'il ne l'est pas déjà. À appeler (await) au
 * début de chaque chargement client : un changement de langue est donc pris en compte au
 * prochain affichage de l'écran (les écrans relisent à chaque focus).
 */
export async function preparerTraductions(): Promise<void> {
  const langue = langueCatalogue();
  if (langue === 'fr') {
    langueChargee = 'fr';
    dico = new Map();
    return;
  }
  if (langueChargee === langue) return;
  if (enCours?.langue === langue) return enCours.promesse;
  const promesse = (async () => {
    try {
      const { data, error } = await supabase.rpc('traductions_catalogue_langue', { p_langue: langue });
      if (error) throw error;
      // Seulement si la langue n'a pas changé pendant le chargement.
      if (langueCatalogue() === langue) {
        dico = new Map(((data as { fr: string; texte: string }[] | null) ?? []).map((r) => [r.fr, r.texte]));
        langueChargee = langue;
      }
    } catch {
      // Base injoignable : on garde le français, et on réessaiera au prochain chargement.
    } finally {
      if (enCours?.langue === langue) enCours = null;
    }
  })();
  enCours = { langue, promesse };
  return promesse;
}

/** Le texte dans la langue d'affichage, ou l'original s'il n'a pas de traduction. */
export function tr<T extends string | null | undefined>(texte: T): T {
  if (!texte || langueChargee === 'fr' || langueChargee === null) return texte;
  return (dico.get(texte) ?? texte) as T;
}
