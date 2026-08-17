/**
 * Suggestions d'upsell pour le panier — « faire gonfler le panier ».
 *
 * Objectif : à la place du bouton générique « Ajouter d'autres plats », proposer des
 * produits pertinents du restaurant courant.
 *   - Le panier n'a PAS de boisson  → on suggère des boissons.
 *   - Le panier a DÉJÀ une boisson   → on suggère un dessert.
 *   - Catégorie cible vide           → on retombe sur d'autres produits (jamais rien).
 *
 * Module isolé (concurrence : data/api.ts et data/types.ts sont édités ailleurs).
 * On mirroir le style de requête de data/api.ts (client supabase, select colonnes brutes,
 * masquage doux des produits hors catégorie active).
 *
 * Détection boisson/dessert : le schéma `categories` n'a PAS de colonne « type/kind »
 * (seulement name + icon emoji + sort_order + is_active). On classe donc chaque catégorie
 * par son NOM (insensible casse/accents) ET par son EMOJI d'icône — indispensable ici car
 * « Bières » 🍺, « Softs » 🥤, « Milkshakes » 🥤, « Cocktails » 🍹 sont des boissons sans
 * jamais contenir le mot « boisson ».
 */
import { supabase } from '../lib/supabase';

export type SuggestionKind = 'drink' | 'dessert' | 'other';

export type Suggestion = {
  id: string;
  name: string;
  price: number; // ariary
  photoUrl: string | null;
  kind: SuggestionKind;
  /** true si le produit a des groupes d'options (→ passer par la fiche produit). */
  hasOptions: boolean;
};

/** Résultat : le `mode` détermine le titre de section affiché par le panier. */
export type CartSuggestions = {
  mode: SuggestionKind;
  items: Suggestion[];
};

const MAX_SUGGESTIONS = 6;

type CategoryRow = { id: string; name: string; icon: string | null };
type ProductRow = { id: string; category_id: string | null; name: string; price: number; photo_url: string | null };

/** Minuscules + suppression des accents (« Bières » → « bieres »). */
function normalize(s: string): string {
  // \p{M} = marques combinantes (accents) — retirées après décomposition NFD.
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const DRINK_NAMES = ['boisson', 'drink', 'soft', 'biere', 'cocktail', 'milkshake', 'jus', 'soda', 'cafe', 'smoothie', 'limonade'];
const DRINK_ICONS = ['🥤', '🍺', '🍻', '🍹', '🍸', '🍷', '🥂', '🍾', '🧃', '🧋', '☕', '🍶', '🫖', '🧉'];
const DESSERT_NAMES = ['dessert', 'glace', 'sucre', 'crepe', 'gateau', 'patisserie', 'gaufre', 'creme', 'tarte'];
const DESSERT_ICONS = ['🍰', '🍨', '🍦', '🧁', '🍩', '🍪', '🍮', '🍫', '🥞', '🧇', '🍧'];

function classifyCategory(name: string, icon: string | null): SuggestionKind {
  const n = normalize(name);
  const em = icon ?? '';
  if (DRINK_NAMES.some((t) => n.includes(t)) || DRINK_ICONS.includes(em)) return 'drink';
  if (DESSERT_NAMES.some((t) => n.includes(t)) || DESSERT_ICONS.includes(em)) return 'dessert';
  return 'other';
}

/**
 * Suggestions d'upsell pour le restaurant du panier.
 * @param restaurantId  restaurant courant du panier (vide → aucune suggestion)
 * @param cartProductIds ids des produits déjà dans le panier (exclus, et servent à
 *                        détecter la présence d'une boisson)
 */
export async function getCartSuggestions(
  restaurantId: string,
  cartProductIds: string[],
): Promise<CartSuggestions> {
  if (!restaurantId) return { mode: 'other', items: [] };

  const [catsRes, prodsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, icon')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id, category_id, name, price, photo_url')
      .eq('restaurant_id', restaurantId)
      .eq('is_available', true)
      .order('price', { ascending: true }),
  ]);
  if (catsRes.error) throw catsRes.error;
  if (prodsRes.error) throw prodsRes.error;

  const cats = catsRes.data as CategoryRow[];
  const activeIds = new Set(cats.map((c) => c.id));
  const kindByCat = new Map<string, SuggestionKind>(cats.map((c) => [c.id, classifyCategory(c.name, c.icon)]));

  // Masquage doux : uniquement les produits d'une catégorie ACTIVE (comme getMenu).
  const products = (prodsRes.data as ProductRow[]).filter(
    (p) => p.category_id != null && activeIds.has(p.category_id),
  );

  const kindOf = (p: ProductRow): SuggestionKind =>
    (p.category_id ? kindByCat.get(p.category_id) : undefined) ?? 'other';

  // Le panier contient-il déjà une boisson ? → si oui on bascule sur les desserts.
  const inCart = new Set(cartProductIds);
  const hasDrink = products.some((p) => inCart.has(p.id) && kindOf(p) === 'drink');

  const targetKind: SuggestionKind = hasDrink ? 'dessert' : 'drink';
  const available = products.filter((p) => !inCart.has(p.id));
  const target = available.filter((p) => kindOf(p) === targetKind);

  let mode: SuggestionKind;
  let chosen: ProductRow[];
  if (target.length > 0) {
    mode = targetKind;
    chosen = target;
  } else {
    // Catégorie cible vide (ex. aucun dessert au menu) : on montre autre chose plutôt
    // qu'une section vide. On évite de re-proposer des boissons si le client en a déjà.
    mode = 'other';
    const others = available.filter((p) => kindOf(p) !== 'drink');
    chosen = others.length > 0 ? others : available;
  }

  chosen = chosen.slice(0, MAX_SUGGESTIONS);

  // hasOptions : produits ayant des groupes d'options (→ router vers la fiche produit),
  // comme getMenu le calcule pour le menu du restaurant.
  const ids = chosen.map((p) => p.id);
  const withOptions = new Set<string>();
  if (ids.length > 0) {
    const { data: groups, error } = await supabase
      .from('product_option_groups')
      .select('product_id')
      .in('product_id', ids);
    if (error) throw error;
    for (const g of groups as { product_id: string }[]) withOptions.add(g.product_id);
  }

  const items: Suggestion[] = chosen.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    photoUrl: p.photo_url,
    kind: kindOf(p),
    hasOptions: withOptions.has(p.id),
  }));

  return { mode, items };
}
