/**
 * Vente additionnelle — les boissons et desserts d'un restaurant, prêts à proposer.
 *
 * Constat du porteur du projet (2026-10-22) : la plupart des clients commandent un
 * plat sans boisson. Trois écrans proposent donc les boissons (puis les desserts)
 * au bon moment, et lisent TOUS cette même liste :
 *   1. la fiche plat, juste après « Ajouter » (`components/vente/ProposeBoisson.tsx`) ;
 *   2. le panier (carrousel au-dessus du récapitulatif) ;
 *   3. le récapitulatif avant paiement (un seul rappel, s'il n'y a toujours pas de boisson).
 *
 * ⚠️ La liste part de `getMenu(…, { traduire: true })` — la carte CLIENT telle qu'elle
 * s'affiche : mêmes produits, mêmes prix (promo comprise via `prixClient`), même
 * emballage/consigne, mêmes traductions. Un `Product` complet voyage donc jusqu'au
 * panier : aucun produit reconstruit à la main (c'est ce qui avait fait oublier la
 * consigne à l'affichage dans l'ancien carrousel).
 *
 * Classement : `categories.est_boisson` (la base ne compte que « Bières » et « Softs »)
 * OU le nom / l'emoji de la catégorie (« Boissons », « Cocktails », 🥤…) — la base
 * range « Boissons » avec la nourriture, l'écran ne doit pas l'oublier pour autant.
 */
import { supabase } from '../lib/supabase';
import { getMenu } from './api';
import { Product } from './types';

export type Additionnels = {
  boissons: Product[];
  desserts: Product[];
  /** ids de toutes les boissons de la carte (disponibles ou non) : sert à savoir si le panier en a une. */
  idsBoissons: Set<string>;
  /** ids de tous les desserts de la carte. */
  idsDesserts: Set<string>;
};

const VIDE: Additionnels = { boissons: [], desserts: [], idsBoissons: new Set(), idsDesserts: new Set() };

/** Minuscules + suppression des accents (« Bières » → « bieres »). */
function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const DRINK_NAMES = ['boisson', 'drink', 'soft', 'biere', 'cocktail', 'milkshake', 'jus', 'soda', 'cafe', 'smoothie', 'limonade'];
const DRINK_ICONS = ['🥤', '🍺', '🍻', '🍹', '🍸', '🍷', '🥂', '🍾', '🧃', '🧋', '☕', '🍶', '🫖', '🧉'];
const DESSERT_NAMES = ['dessert', 'glace', 'sucre', 'crepe', 'gateau', 'patisserie', 'gaufre', 'tarte'];
const DESSERT_ICONS = ['🍰', '🍨', '🍦', '🧁', '🍩', '🍪', '🍮', '🍫', '🥞', '🧇', '🍧'];

type Genre = 'boisson' | 'dessert' | 'plat';

function genreCategorie(name: string, icon: string | null, estBoisson: boolean | null): Genre {
  const n = normalize(name);
  const em = icon ?? '';
  if (estBoisson || DRINK_NAMES.some((m) => n.includes(m)) || DRINK_ICONS.includes(em)) return 'boisson';
  if (DESSERT_NAMES.some((m) => n.includes(m)) || DESSERT_ICONS.includes(em)) return 'dessert';
  return 'plat';
}

/**
 * Rang d'une boisson dans la proposition : les sodas d'abord (tout le monde en boit,
 * enfants compris), puis l'alcool, et l'eau en dernier — on propose d'abord ce qui
 * fait plaisir.
 */
const ALCOOL = ['biere', 'cocktail', 'vin', 'rhum', 'alcool', 'beer', 'birra'];
function rangBoisson(p: Product, nomCat: string): number {
  if (/^(eau|water|acqua)\b/.test(normalize(p.name))) return 2;
  return ALCOOL.some((m) => normalize(nomCat).includes(m)) ? 1 : 0;
}

// Petit cache mémoire : la fiche plat, le panier et le récapitulatif demandent la
// même liste à quelques secondes d'intervalle, sur une liaison lente.
const DUREE_CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; val: Promise<Additionnels> }>();

export function getAdditionnels(restaurantId: string | null | undefined): Promise<Additionnels> {
  if (!restaurantId) return Promise.resolve(VIDE);
  const hit = cache.get(restaurantId);
  if (hit && Date.now() - hit.at < DUREE_CACHE_MS) return hit.val;
  const val = charger(restaurantId).catch((e) => {
    cache.delete(restaurantId);
    throw e;
  });
  cache.set(restaurantId, { at: Date.now(), val });
  return val;
}

async function charger(restaurantId: string): Promise<Additionnels> {
  const [menu, cats] = await Promise.all([
    getMenu(restaurantId, { traduire: true }),
    supabase.from('categories').select('id, name, icon, est_boisson').eq('restaurant_id', restaurantId),
  ]);
  if (cats.error) throw cats.error;

  const genreParCat = new Map<string, Genre>();
  const nomParCat = new Map<string, string>();
  for (const c of cats.data as { id: string; name: string; icon: string | null; est_boisson: boolean | null }[]) {
    genreParCat.set(c.id, genreCategorie(c.name, c.icon, c.est_boisson));
    nomParCat.set(c.id, c.name);
  }
  // Une catégorie hors service à cette heure (ex. « Pizza » 18–22 h) ne se propose pas.
  const servie = new Map(menu.categories.map((c) => [c.id, c.servedNow]));
  const ordreCat = new Map(menu.categories.map((c, i) => [c.id, i]));

  const idsBoissons = new Set<string>();
  const idsDesserts = new Set<string>();
  const boissons: Product[] = [];
  const desserts: Product[] = [];

  for (const p of menu.products) {
    const g = genreParCat.get(p.categoryId) ?? 'plat';
    if (g === 'boisson') idsBoissons.add(p.id);
    if (g === 'dessert') idsDesserts.add(p.id);
    const commandable =
      p.isAvailable && p.stockQuantity !== 0 && p.listingStatus !== 'coming_soon' && servie.get(p.categoryId) !== false;
    if (!commandable) continue;
    if (g === 'boisson') boissons.push(p);
    if (g === 'dessert') desserts.push(p);
  }

  // Une vignette vide ne donne envie de rien : les produits photographiés passent devant.
  const tri = (a: Product, b: Product) =>
    Number(!a.photoUrl) - Number(!b.photoUrl) ||
    rangBoisson(a, nomParCat.get(a.categoryId) ?? '') - rangBoisson(b, nomParCat.get(b.categoryId) ?? '') ||
    (ordreCat.get(a.categoryId) ?? 0) - (ordreCat.get(b.categoryId) ?? 0) ||
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  boissons.sort(tri);
  desserts.sort(tri);

  return { boissons, desserts, idsBoissons, idsDesserts };
}

/** Le panier contient-il déjà une boisson de ce restaurant ? */
export function aUneBoisson(a: Additionnels | null | undefined, productIds: string[]): boolean {
  if (!a) return false;
  return productIds.some((id) => a.idsBoissons.has(id));
}

/** Le panier contient-il déjà un dessert ? */
export function aUnDessert(a: Additionnels | null | undefined, productIds: string[]): boolean {
  if (!a) return false;
  return productIds.some((id) => a.idsDesserts.has(id));
}

/** Un plat « principal » (ni boisson, ni dessert) : c'est après lui qu'on propose une boisson. */
export function estPlatPrincipal(a: Additionnels | null | undefined, productId: string): boolean {
  if (!a) return false;
  return !a.idsBoissons.has(productId) && !a.idsDesserts.has(productId);
}
