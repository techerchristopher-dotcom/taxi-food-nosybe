/**
 * Couche d'accès aux données — Supabase.
 *
 * Toutes les lectures/écritures passent par ici. Les fonctions renvoient les FORMES
 * définies dans data/types.ts (mêmes objets que ceux consommés par les écrans).
 *
 * RLS : restaurants/categories/products + product_option_groups/product_options sont en
 * lecture publique ; addresses et orders/order_item_options sont filtrés sur l'utilisateur.
 */
import { supabase } from '../lib/supabase';
import { langueCatalogue, preparerTraductions, tr } from '../lib/catalogueTraduit';
import {
  Address,
  addressIcon,
  Category,
  createdLabel,
  DEFAULT_ETA,
  libelleDureeMediane,
  formatTime,
  getMapsNavigationUrl,
  formatAddressLine,
  initialsFromName,
  OptionGroup,
  Order,
  OrderStatus,
  PaymentMethod,
  StatutPaiement,
  Product,
  ProductIngredient,
  ProductOption,
  Restaurant,
  DayHours,
} from './types';
import type { EstimationCommande, AvisEnAttente, Avis, AvisRestaurateur, CodeRemerciement, MonAvis, MotifPorteMonnaie, PorteMonnaie, RefusalCode } from './types';

// --- Formes brutes (colonnes de la base) -----------------------------------
type DayHoursRow = {
  weekday: number | null;
  /** Absent de `horaires_du_jour` (fonction composite) : on retombe alors sur 1. */
  service?: number | null;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean | null;
};

type RestaurantRow = {
  id: string;
  name: string;
  cuisine_type: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_open: boolean;
  listing_status?: string | null;
  phone?: string | null;
  ouvert_maintenant?: boolean | null;
  auto_open?: boolean | null;
  /**
   * Prochaine ouverture RÉELLE (`ouvre_a` / `ouvre_dans_jours`, exposées le
   * 2026-09-28) : les services déjà passés ne comptent pas. Null : fermeture
   * manuelle, ou rien sous sept jours.
   */
  ouvre_a?: string | null;
  ouvre_dans_jours?: number | null;
  /** Note (cuisine + préparation) et nombre d'avis publiés, calculés par la base. Null sous 3 avis. */
  note_moyenne?: number | null;
  nb_avis?: number | null;
  /** Arrivé sur Taxi Food depuis moins de 14 jours (colonne calculée `est_nouveau`). */
  est_nouveau?: boolean | null;
  /** Durée médiane réelle commande → livraison (colonne calculée, null sous 3 commandes). */
  duree_mediane_min?: number | null;
  // horaires_du_jour(restaurants) renvoie un type composite : PostgREST l'expose
  // comme un OBJET, pas un tableau (verifie au curl sur l'API du projet). Quand
  // aucun horaire n'existe pour aujourd'hui, l'objet est present mais tous ses
  // champs valent null — d'ou le garde-fou sur `weekday` dans mapDayHours().
  //
  // /!\ L'inference de types de supabase-js suppose, elle, un tableau : elle ne
  // sait pas distinguer un embed to-one d'un to-many sans relation FK. C'est
  // pour cela que les trois `select` de ce fichier passent par `as unknown as`
  // — le type genere est faux, la forme decrite ici est la bonne.
  horaires_du_jour?: DayHoursRow | null;
  /** Tous les services du jour (midi, soir), dans l'ordre. */
  services_du_jour?: DayHoursRow[] | null;
  delivery_fee: number;
  min_order: number;
  zone_served: string | null;
  food_types: string[] | null;
};

function mapDayHours(h?: DayHoursRow | null): DayHours | null {
  // `weekday` null = la fonction composite n'a trouve aucune ligne pour ce jour.
  if (!h || h.weekday === null) return null;
  return {
    weekday: h.weekday,
    service: h.service ?? 1,
    opensAt: h.opens_at ?? '',
    closesAt: h.closes_at ?? '',
    isClosed: h.is_closed ?? false,
  };
}

type ProductRow = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  listing_status?: string | null;
  photo_url: string | null;
  stock_quantity?: number | null;
  is_featured?: boolean | null;
  featured_label?: string | null;
  in_menu?: boolean | null;
  is_archived?: boolean | null;
  diet_tags?: string[] | null;
  packaging_fee?: number | null;
  packaging_label?: string | null;
  sort_order?: number | null;
};

/** Colonnes produit demandées partout : une seule source pour ne pas en oublier une. */
const PRODUCT_COLS =
  'id, restaurant_id, category_id, name, description, price, is_available, listing_status, photo_url, stock_quantity, is_featured, featured_label, in_menu, is_archived, diet_tags, packaging_fee, packaging_label, sort_order';

type CategoryRow = {
  id: string;
  restaurant_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  serving_from?: string | null;
  serving_to?: string | null;
  categorie_servie_maintenant?: boolean | null;
};

type AddressRow = {
  id: string;
  label: string | null;
  zone: string;
  landmark: string | null;
  phone: string | null;
  instructions: string | null;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
};

type OptionRow = {
  id: string;
  name: string;
  price_delta: number;
  is_available: boolean;
  sort_order: number;
  photo_url: string | null;
  par_defaut?: boolean | null;
};

type OptionGroupRow = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: boolean;
  sort_order: number;
  product_options: OptionRow[];
};

// --- Mappers ----------------------------------------------------------------
function mapRestaurant(r: RestaurantRow): Restaurant {
  return {
    id: r.id,
    name: r.name,
    initials: initialsFromName(r.name),
    logoUrl: r.logo_url,
    coverUrl: r.cover_url,
    cuisineType: r.cuisine_type ?? '',
    zone: r.zone_served ?? '',
    // L'ouverture EFFECTIVE, calculee par la base : deduite des horaires si
    // le restaurant est en automatique, sinon la bascule manuelle. On ne la
    // calcule PAS ici : l'horloge du telephone n'est pas une reference.
    listingStatus: (r.listing_status as Restaurant['listingStatus']) ?? 'visible',
    // Un restaurant « bientôt disponible » n'est jamais commandable, quel que
    // soit son is_open : le badge et le grisé découlent de ce seul champ.
    isOpen: r.listing_status === 'coming_soon' ? false : (r.ouvert_maintenant ?? r.is_open),
    autoOpen: r.auto_open ?? false,
    phone: r.phone ?? null,
    todayHours: mapDayHours(r.horaires_du_jour),
    // ⚠️ TOUS les services du jour, pas seulement le premier. A 18 h, un
    // restaurant qui sert midi ET soir affichait « Ouvert · 11h30 – 15h » :
    // l'etat etait juste, l'horaire montrait le service deja termine.
    todayServices: (r.services_du_jour ?? [])
      .map((h) => mapDayHours(h))
      .filter((h): h is DayHours => h !== null),
    // La vraie médiane du restaurant (2026-10-07), plus le « 25–40 min » écrit en dur.
    etaLabel: libelleDureeMediane(r.duree_mediane_min),
    dureeMedianeMin: r.duree_mediane_min ?? null,
    deliveryFee: r.delivery_fee,
    minOrder: r.min_order,
    foodTypes: r.food_types ?? [],
    categoryTags: [],
    popular: false,
    // La PROCHAINE ouverture, calculée par la base — pas le premier service du
    // jour. À 18 h 20, `horaires_du_jour` disait « 12h » (le midi, terminé)
    // alors que le soir ouvre à 19 h : `ouvre_a` porte la bonne réponse.
    opensAt: r.ouvre_a ?? null,
    opensInDays: r.ouvre_dans_jours ?? null,
    // La note, calculée par la base (cuisine + préparation, jamais la livraison).
    noteMoyenne: r.note_moyenne == null ? null : Number(r.note_moyenne),
    nbAvis: r.nb_avis ?? 0,
    // « Nouveau » : décidé par la base (14 jours après sa première mise en ligne).
    estNouveau: r.est_nouveau === true,
  };
}

function mapProduct(p: ProductRow, hasOptions = false): Product {
  return {
    id: p.id,
    restaurantId: p.restaurant_id,
    categoryId: p.category_id ?? '',
    name: p.name,
    description: p.description ?? '',
    price: p.price,
    isAvailable: p.is_available,
    // ⚠️ Ne vaut QUE le libellé du badge — la commande reste coupée par `isAvailable`.
    // Si `listing_status` manquait à PRODUCT_COLS, on lirait `undefined` et tout
    // retomberait sur 'visible' sans lever la moindre erreur : erreur silencieuse type.
    listingStatus: (p.listing_status as Product['listingStatus']) ?? 'visible',
    photoUrl: p.photo_url,
    hasOptions,
    stockQuantity: p.stock_quantity ?? null,
    isFeatured: p.is_featured ?? false,
    featuredLabel: p.featured_label ?? null,
    inMenu: p.in_menu ?? true,
    dietTags: p.diet_tags ?? [],
    packagingFee: p.packaging_fee ?? 0,
    packagingLabel: p.packaging_label ?? null,
    sortOrder: p.sort_order ?? 0,
  };
}

function mapOption(o: OptionRow): ProductOption {
  return {
    id: o.id,
    name: o.name,
    priceDelta: o.price_delta,
    isAvailable: o.is_available,
    sortOrder: o.sort_order,
    photoUrl: o.photo_url,
    parDefaut: o.par_defaut ?? false,
  };
}

function mapOptionGroup(g: OptionGroupRow): OptionGroup {
  return {
    id: g.id,
    name: g.name,
    minSelect: g.min_select,
    maxSelect: g.max_select,
    required: g.required,
    sortOrder: g.sort_order,
    options: (g.product_options ?? [])
      .filter((o) => o.is_available)
      .map(mapOption)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

// --- Traduction du catalogue (écrans CLIENTS seulement, voir lib/catalogueTraduit.ts) ---
function traduireProduit(p: Product): Product {
  return { ...p, name: tr(p.name), description: tr(p.description), featuredLabel: tr(p.featuredLabel), packagingLabel: tr(p.packagingLabel) };
}
function traduireCategorie(c: Category): Category {
  return { ...c, name: tr(c.name) };
}
function traduireGroupe(g: OptionGroup): OptionGroup {
  return { ...g, name: tr(g.name), options: g.options.map((o) => ({ ...o, name: tr(o.name) })) };
}
function traduireRestaurant(r: Restaurant): Restaurant {
  return { ...r, cuisineType: tr(r.cuisineType), categoryTags: r.categoryTags.map((c) => ({ ...c, name: tr(c.name) })) };
}
function traduireCommande(o: Order): Order {
  return {
    ...o,
    items: o.items.map((it) => ({
      ...it,
      name: tr(it.name),
      packagingLabel: tr(it.packagingLabel),
      options: it.options?.map((op) => ({ ...op, name: tr(op.name) })),
    })),
  };
}

function mapAddress(a: AddressRow): Address {
  return {
    id: a.id,
    label: a.label ?? a.zone,
    zone: a.zone,
    landmark: a.landmark ?? '',
    phone: a.phone ?? '',
    instructions: a.instructions ?? undefined,
    isDefault: a.is_default,
    icon: addressIcon(a.label),
    latitude: a.latitude,
    longitude: a.longitude,
  };
}

// --- Restaurants & menu -----------------------------------------------------
export async function listRestaurants(): Promise<Restaurant[]> {
  await preparerTraductions();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, listing_status, phone, ouvert_maintenant, auto_open, ouvre_a, ouvre_dans_jours, note_moyenne, nb_avis, est_nouveau, duree_mediane_min, horaires_du_jour(weekday,opens_at,closes_at,is_closed), services_du_jour(weekday,service,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
    // ⚠️ Le filtre est ici, PAS dans la RLS : la lecture des restaurants reste
    // publique, parce que l'historique d'un client doit continuer d'afficher le
    // nom d'un restaurant retire du catalogue. `hidden` masque la LISTE, il ne
    // supprime rien.
    .neq('listing_status', 'hidden')
    // ⚠️ L'ORDRE EST DÉCIDÉ EN BASE, pas ici. `rang_ouverture` = le statut d'abord
    // (disponibles, puis en négociation), puis les restaurants OUVERTS en tête,
    // puis le rang choisi dans l'admin. Ce n'est pas la colonne générée
    // `rang_catalogue` : une colonne générée ne peut pas dépendre de l'heure, et
    // c'est l'heure qui dit qui est ouvert. La vitrine trie sur la même fonction
    // — deux règles écrites séparément finissaient par diverger. Avant, le tri
    // par date mettait Taxi Be, le plus ancien, en tête alors qu'on ne pouvait
    // rien y commander. `created_at` ne sert plus qu'à départager deux rangs égaux.
    .order('rang_ouverture', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = data as unknown as RestaurantRow[];

  // Catégories ACTIVES (emoji + nom) par restaurant, pour les tags des cartes.
  const ids = rows.map((r) => r.id);
  const tagsByResto = new Map<string, { name: string; icon: string | null }[]>();
  if (ids.length > 0) {
    const { data: cats, error: e2 } = await supabase
      .from('categories')
      .select('restaurant_id, name, icon, sort_order')
      .in('restaurant_id', ids)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (e2) throw e2;
    for (const c of cats as { restaurant_id: string; name: string; icon: string | null }[]) {
      const arr = tagsByResto.get(c.restaurant_id) ?? [];
      arr.push({ name: c.name, icon: c.icon });
      tagsByResto.set(c.restaurant_id, arr);
    }
  }

  return rows.map((r) => traduireRestaurant({ ...mapRestaurant(r), categoryTags: tagsByResto.get(r.id) ?? [] }));
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  await preparerTraductions();
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, listing_status, phone, ouvert_maintenant, auto_open, ouvre_a, ouvre_dans_jours, note_moyenne, nb_avis, est_nouveau, duree_mediane_min, horaires_du_jour(weekday,opens_at,closes_at,is_closed), services_du_jour(weekday,service,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? traduireRestaurant(mapRestaurant(data as unknown as RestaurantRow)) : null;
}

/**
 * Frais de livraison RÉELS, calculés par la base pour l'adresse choisie.
 *
 * ⚠️ Depuis le 2026-09-24 la livraison n'est plus un forfait : 10 000 Ar
 * jusqu'à 3 km, puis 1 000 Ar par kilomètre entamé (distance à vol d'oiseau
 * × 1,3 pour approcher la route). Le montant DÉPEND donc de l'adresse, et il
 * change quand le client en change.
 *
 * ⚠️ On passe un IDENTIFIANT d'adresse, jamais des coordonnées : la base vérifie
 * que l'adresse appartient à l'appelant. Sans adresse (panier d'un visiteur qui
 * n'a pas encore choisi), on demande le tarif de base — celui affiché « à partir
 * de ».
 *
 * Ce montant ne fait PAS foi : `create_order` recalcule tout à la création et
 * ignore ce que l'écran a pu croire. C'est ici pour ne pas mentir au client,
 * pas pour décider du prix.
 */
export type FraisLivraison = {
  /** Montant en ariary. */
  frais: number;
  /** Distance routière estimée en km, ou null si elle n'est pas calculable. */
  distanceKm: number | null;
  /** false = repli sur le tarif de base (restaurant sans position, adresse sans GPS). */
  distanceConnue: boolean;
  /** Kilomètres inclus dans le tarif de base (3 aujourd'hui). */
  kmInclus: number;
  /** Ariary par kilomètre entamé au-delà (1 000 aujourd'hui). */
  prixParKm: number;
  /** Tarif de base (10 000 aujourd'hui). */
  base: number;
};

type FraisRow = {
  frais: number;
  distance_km: number | string | null;
  distance_connue: boolean;
  km_inclus: number | string;
  prix_par_km: number;
  base: number;
};

function mapFrais(row: FraisRow): FraisLivraison {
  return {
    frais: row.frais,
    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
    distanceConnue: row.distance_connue,
    kmInclus: Number(row.km_inclus),
    prixParKm: row.prix_par_km,
    base: row.base,
  };
}

export async function getFraisLivraison(
  restaurantId: string,
  addressId?: string | null,
): Promise<FraisLivraison | null> {
  if (!restaurantId) return null;
  const { data, error } = addressId
    ? await supabase.rpc('frais_livraison_adresse', {
        p_restaurant_id: restaurantId,
        p_address_id: addressId,
      })
    : await supabase.rpc('frais_livraison_detail', {
        p_restaurant_id: restaurantId,
        p_latitude: null,
        p_longitude: null,
      });
  if (error) throw error;
  const row = (data as FraisRow[] | null)?.[0];
  return row ? mapFrais(row) : null;
}

export async function getMenu(
  restaurantId: string,
  // ⚠️ `traduire` : la carte CLIENT seulement. Les Réglages du restaurateur appellent
  // getMenu sans option — un menu traduit y serait réenregistré dans la mauvaise langue.
  options: { traduire?: boolean } = {},
): Promise<{ categories: Category[]; products: Product[]; featured: Product[] }> {
  if (options.traduire) await preparerTraductions();
  const [cats, prods] = await Promise.all([
    supabase
      .from('categories')
      .select(
        'id, restaurant_id, name, icon, sort_order, serving_from, serving_to, categorie_servie_maintenant',
      )
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select(PRODUCT_COLS)
      .eq('restaurant_id', restaurantId)
      .eq('is_archived', false)
      // ⚠️ Tri EXPLICITE, obligatoire. Sans lui, Postgres rend les lignes dans
      // l'ordre physique du fichier, et une ligne modifiee est reecrite a la
      // fin : chaque changement de prix ou de disponibilite faisait descendre le
      // plat au bas de sa categorie chez le client. Constate le 2026-09-07 — un
      // croque-monsieur passe de la 3e a la 15e place en recevant un label.
      // `name` departage les egalites pour que l'ordre reste stable meme si deux
      // plats partagent le meme rang.
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;

  const categories = (cats.data as unknown as CategoryRow[]).map(mapCategory);
  const allRows = prods.data as unknown as ProductRow[];

  // Masquage doux : on ne garde que les produits d'une catégorie ACTIVE. Les
  // créations « à l'affiche » (in_menu = false) n'ont pas de catégorie : elles
  // n'apparaissent QUE dans la mise en avant, jamais dans la carte permanente.
  const activeCatIds = new Set(categories.map((c) => c.id));
  const productRows = allRows.filter(
    (p) => p.in_menu !== false && p.category_id != null && activeCatIds.has(p.category_id),
  );
  const featuredRows = allRows.filter((p) => p.is_featured);

  // Quels produits ont des groupes d'options (→ le menu envoie vers le détail).
  const ids = [...new Set([...productRows, ...featuredRows].map((p) => p.id))];
  const withOptions = new Set<string>();
  if (ids.length > 0) {
    const { data: groups, error } = await supabase
      .from('product_option_groups')
      .select('product_id')
      .in('product_id', ids);
    if (error) throw error;
    for (const g of groups as { product_id: string }[]) withOptions.add(g.product_id);
  }

  const menu = {
    categories,
    products: productRows.map((p) => mapProduct(p, withOptions.has(p.id))),
    featured: featuredRows.map((p) => mapProduct(p, withOptions.has(p.id))),
  };
  if (!options.traduire) return menu;
  return {
    categories: menu.categories.map(traduireCategorie),
    products: menu.products.map(traduireProduit),
    featured: menu.featured.map(traduireProduit),
  };
}

/**
 * Tout ce que le partenaire peut remettre à l'affiche : ses créations passées
 * (in_menu = false), à l'affiche ou non. C'est la bibliothèque qui évite de
 * re-téléverser la même photo chaque semaine.
 */
export async function getFeaturedLibrary(restaurantId: string): Promise<Product[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLS)
    .eq('restaurant_id', restaurantId)
    .eq('in_menu', false)
    .eq('is_archived', false)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as unknown as ProductRow[]).map((p) => mapProduct(p));
}

/**
 * Les plats du jour de TOUS les restaurants, en une seule liste.
 *
 * ⚠️ UNE SEULE REQUÊTE, ET ELLE VIT EN BASE (`plats_du_jour_publics`). La
 * vitrine appelle exactement la même : c'est la leçon de l'ordre du catalogue,
 * où l'app et le site avaient chacun leur tri et ne montraient pas la même
 * chose. Le filtrage (à l'affiche, non archivé, disponible, non épuisé,
 * restaurant `visible`) et l'ordre (ouverts d'abord, puis `rang_catalogue`,
 * puis `sort_order`) sont décidés là-bas, pas ici.
 *
 * ⚠️ UN RESTAURANT FERMÉ GARDE SA PLACE, grisé, avec son heure d'ouverture.
 * Sans cela la rubrique est vide en milieu d'après-midi — trois restaurants sur
 * quatre le sont à ce moment-là. Décision du porteur du projet, 2026-09-25.
 */
export type PlatDuJour = {
  id: string;
  name: string;
  description: string;
  price: number;
  photoUrl: string | null;
  dietTags: string[];
  restaurantId: string;
  restaurantName: string;
  restaurantZone: string;
  restaurantCuisine: string;
  restaurantLogoUrl: string | null;
  /** Ouverture EFFECTIVE du restaurant, calculée par la base — jamais par l'horloge du téléphone. */
  isOpen: boolean;
  /** 0 = aujourd'hui, 1 = demain… `null` quand la base ne promet rien. */
  opensInDays: number | null;
  /** 'HH:MM', ou null : ouverture manuelle, ou aucune ouverture sous sept jours. */
  opensAt: string | null;
};

type PlatDuJourRow = {
  product_id: string;
  nom: string;
  description: string | null;
  prix: number;
  photo_url: string | null;
  diet_tags: string[] | null;
  restaurant_id: string;
  restaurant_nom: string;
  restaurant_zone: string | null;
  restaurant_cuisine: string | null;
  restaurant_logo: string | null;
  frais_livraison: number | null;
  ouvert: boolean;
  ouvre_dans_jours: number | null;
  ouvre_a: string | null;
  rang: number;
};

export async function listPlatsDuJour(): Promise<PlatDuJour[]> {
  await preparerTraductions();
  const { data, error } = await supabase.rpc('plats_du_jour_publics');
  if (error) throw error;
  return ((data as PlatDuJourRow[] | null) ?? []).map((r) => ({
    id: r.product_id,
    name: tr(r.nom),
    description: tr(r.description ?? ''),
    price: r.prix,
    photoUrl: r.photo_url,
    dietTags: r.diet_tags ?? [],
    restaurantId: r.restaurant_id,
    restaurantName: r.restaurant_nom,
    restaurantZone: r.restaurant_zone ?? '',
    restaurantCuisine: tr(r.restaurant_cuisine ?? ''),
    restaurantLogoUrl: r.restaurant_logo,
    isOpen: r.ouvert,
    opensInDays: r.ouvre_dans_jours ?? null,
    opensAt: r.ouvre_a,
  }));
}

/**
 * ✨ « Nouveau sur Taxi Food » — les restaurants arrivés depuis moins de 14 jours, avec
 * 4 plats en photo (un par catégorie). Une seule source : la RPC `nouveautes_publiques()`,
 * qui décide du filtre ET de l'ordre (ouverts d'abord, puis le plus récent). Liste vide
 * hors période : la rangée disparaît de l'accueil.
 */
export type Nouveaute = {
  restaurantId: string;
  name: string;
  cuisineType: string;
  zone: string;
  logoUrl: string | null;
  coverUrl: string | null;
  isOpen: boolean;
  opensInDays: number | null;
  opensAt: string | null;
  plats: { id: string; name: string; price: number; photoUrl: string | null }[];
};

type NouveauteRow = {
  restaurant_id: string;
  nom: string;
  cuisine: string | null;
  zone: string | null;
  logo_url: string | null;
  cover_url: string | null;
  ouvert: boolean;
  ouvre_dans_jours: number | null;
  ouvre_a: string | null;
  plats: { id: string; nom: string; prix: number; photo_url: string | null }[] | null;
};

export async function listNouveautes(): Promise<Nouveaute[]> {
  await preparerTraductions();
  const { data, error } = await supabase.rpc('nouveautes_publiques');
  if (error) throw error;
  return ((data as NouveauteRow[] | null) ?? []).map((r) => ({
    restaurantId: r.restaurant_id,
    name: r.nom,
    cuisineType: tr(r.cuisine ?? ''),
    zone: r.zone ?? '',
    logoUrl: r.logo_url,
    coverUrl: r.cover_url,
    isOpen: r.ouvert,
    opensInDays: r.ouvre_dans_jours ?? null,
    opensAt: r.ouvre_a,
    plats: (r.plats ?? []).map((p) => ({ id: p.id, name: tr(p.nom), price: p.prix, photoUrl: p.photo_url })),
  }));
}

/**
 * 📢 Le bandeau d'annonce du moment (RPC `bandeau_actif`), déjà traduit par la base dans la
 * langue de l'interface. `null` quand il n'y en a pas : passé sa date de fin, il disparaît
 * de lui-même. `version` change à chaque réécriture dans l'admin.
 */
export type Bandeau = { id: string; titre: string; texte: string | null; route: string; version: string };

export async function getBandeau(): Promise<Bandeau | null> {
  const { data, error } = await supabase.rpc('bandeau_actif', { p_langue: langueCatalogue() });
  if (error) throw error;
  const b = ((data as Bandeau[] | null) ?? [])[0];
  return b ? { id: b.id, titre: b.titre, texte: b.texte, route: b.route || '/', version: b.version } : null;
}

function mapCategory(c: CategoryRow): Category {
  return {
    id: c.id,
    restaurantId: c.restaurant_id,
    name: c.name,
    icon: c.icon,
    sortOrder: c.sort_order,
    servingFrom: c.serving_from ? c.serving_from.slice(0, 5) : null,
    servingTo: c.serving_to ? c.serving_to.slice(0, 5) : null,
    // ⚠️ Le verdict vient de la base. `?? true` couvre le seul cas où la colonne
    // calculée n'est pas demandée (une requête plus ancienne) : on n'invente pas
    // une fermeture, c'est `create_order` qui tranchera de toute façon.
    servedNow: c.categorie_servie_maintenant ?? true,
  };
}

/** Produit + restaurant + groupes d'options (pour l'écran de détail / configuration). */
export async function getProductDetail(id: string): Promise<{
  product: Product;
  restaurant: Restaurant | null;
  /**
   * ⚠️ La catégorie porte l'HORAIRE DE SERVICE (pizzas de 18 h à 22 h chez Chez
   * Bidule & Truc). Sans elle, la fiche ne pouvait savoir que si le restaurant était
   * ouvert — et laissait ajouter une pizza à midi. Or cette fiche est la porte d'un
   * lien partagé ET de toute pizza à options : c'était la voie directe pour
   * contourner la carte.
   */
  category: Category | null;
  groups: OptionGroup[];
  /** Ingrédients principaux en pastilles ; vide quand le plat n'en a pas (cas le plus courant). */
  ingredients: ProductIngredient[];
} | null> {
  await preparerTraductions();
  const { data, error } = await supabase
    .from('products')
    // PRODUCT_COLS et pas une liste ecrite a la main : c'est exactement l'oubli
    // qui a fait disparaitre les frais d'emballage du panier le 2026-09-05.
    .select(PRODUCT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const categoryId = (data as ProductRow).category_id;
  const [groupsRes, restaurant, categoryRes, ingredientsRes] = await Promise.all([
    supabase
      .from('product_option_groups')
      .select('id, name, min_select, max_select, required, sort_order, product_options ( id, name, price_delta, is_available, sort_order, photo_url, par_defaut )')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
    getRestaurant((data as ProductRow).restaurant_id),
    // Même colonnes que la carte, `categorie_servie_maintenant` comprise : le
    // verdict vient de la base, jamais de l'horloge du téléphone.
    categoryId
      ? supabase
          .from('categories')
          .select('id, restaurant_id, name, icon, sort_order, serving_from, serving_to, categorie_servie_maintenant')
          .eq('id', categoryId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('product_ingredients')
      .select('au_choix, sort_order, ingredients ( emoji, nom )')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
  ]);
  if (groupsRes.error) throw groupsRes.error;
  // Une catégorie illisible ne doit pas rendre la fiche illisible : on la traite
  // comme absente, et `create_order` tranchera de toute façon.
  const category = categoryRes.data ? mapCategory(categoryRes.data as CategoryRow) : null;

  const groups = (groupsRes.data as unknown as OptionGroupRow[])
    .map(mapOptionGroup)
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
  const product = mapProduct(data as ProductRow, groups.length > 0);
  // Les pastilles sont un plus : une erreur de lecture les fait disparaître, jamais la fiche.
  const ingredients: ProductIngredient[] = ingredientsRes.error
    ? []
    : ((ingredientsRes.data ?? []) as unknown as { au_choix: boolean; ingredients: { emoji: string; nom: string } | null }[])
        .filter((r) => r.ingredients)
        .map((r) => ({ emoji: r.ingredients!.emoji, name: tr(r.ingredients!.nom), auChoix: r.au_choix }));
  return {
    product: traduireProduit(product),
    restaurant,
    category: category ? traduireCategorie(category) : null,
    groups: groups.map(traduireGroupe),
    ingredients,
  };
}

// --- Adresses ---------------------------------------------------------------
/**
 * MES adresses de livraison — le Profil et le choix d'adresse du tunnel de commande.
 *
 * ⚠️ Même piège que `listOrders` : la RLS ne suffit pas. `addresses` porte, en plus de
 * `addresses_all_own`, une politique SELECT qui ouvre l'adresse d'une commande au staff du
 * restaurant et au livreur qui la porte — il leur faut bien savoir où livrer. Sans filtre,
 * un restaurateur passé côté client voyait donc les adresses de SES CLIENTS listées comme
 * les siennes (2 lignes pour `demo.resto`, qui n'en a aucune), et pouvait en choisir une
 * comme adresse de livraison. Le filtre `user_id` est ce qui sépare les deux lectures.
 */
export async function listAddresses(): Promise<Address[]> {
  // `getSession()` lit le jeton local — pas d'aller-retour réseau.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, zone, landmark, phone, instructions, is_default, latitude, longitude')
    .eq('user_id', session.user.id)
    // Les adresses des commandes saisies par TELEPHONE depuis l'admin
    // (`admin_commande_telephone`, libelle « ☎ <client> ») appartiennent au
    // compte de l'admin : ce sont celles de ses clients, pas les siennes.
    .or('label.is.null,label.not.like.☎*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as AddressRow[]).map(mapAddress);
}

export async function createAddress(input: {
  label: string;
  zone: string;
  landmark: string;
  phone: string;
  instructions?: string;
  isDefault?: boolean;
  // Position GPS optionnelle (null si le client ne l'a pas partagée).
  latitude?: number | null;
  longitude?: number | null;
  capturedAt?: string | null;
}): Promise<Address> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Non connecté');

  const { count } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true });
  const isDefault = input.isDefault ?? count === 0;

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: input.label,
      zone: input.zone,
      landmark: input.landmark,
      phone: input.phone,
      instructions: input.instructions ?? null,
      is_default: isDefault,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      location_captured_at: input.capturedAt ?? null,
    })
    .select('id, label, zone, landmark, phone, instructions, is_default, latitude, longitude')
    .single();
  if (error) throw error;
  return mapAddress(data as AddressRow);
}

// --- Commandes --------------------------------------------------------------
type OrderJoinRow = {
  id: string;
  order_number: string;
  restaurant_id: string;
  subtotal: number;
  delivery_fee: number;
  packaging_fee?: number | null;
  promo_code?: string | null;
  promo_discount?: number | null;
  remise_porte_monnaie?: number | null;
  total: number;
  payment_method: PaymentMethod;
  payment_status?: StatutPaiement | null;
  status: OrderStatus;
  cancellation_reason: string | null;
  cancellation_code?: string | null;
  cancellation_detail?: string | null;
  courier_id: string | null;
  picked_up_at: string | null;
  ready_at?: string | null;
  arriving_at?: string | null;
  arrived_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  restaurants: {
    name: string;
    logo_url: string | null;
    phone: string | null;
    preparation_auto?: boolean | null;
  } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  addresses: {
    label: string | null;
    zone: string;
    landmark: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  order_items: {
    product_id: string | null;
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
    comment: string | null;
    packaging_fee_snapshot?: number | null;
    packaging_label_snapshot?: string | null;
    order_item_options: {
      option_id: string | null;
      option_name_snapshot: string;
      price_delta_snapshot: number;
      quantity: number;
    }[];
  }[];
};

const ORDER_SELECT =
  'id, order_number, restaurant_id, subtotal, delivery_fee, packaging_fee, promo_code, promo_discount, remise_porte_monnaie, total, payment_method, payment_status, status, cancellation_reason, cancellation_code, cancellation_detail, courier_id, picked_up_at, ready_at, arriving_at, arrived_at, delivered_at, created_at, ' +
  'restaurants ( name, logo_url, phone, preparation_auto ), profiles ( full_name, phone ), ' +
  'addresses ( label, zone, landmark, phone, latitude, longitude ), ' +
  'order_items ( product_id, product_name_snapshot, quantity, unit_price, comment, packaging_fee_snapshot, packaging_label_snapshot, ' +
  'order_item_options ( option_id, option_name_snapshot, price_delta_snapshot, quantity ) )';

function mapOrder(o: OrderJoinRow): Order {
  const restaurantName = o.restaurants?.name ?? 'Restaurant';
  const addr = o.addresses;
  // Commande saisie par TELEPHONE depuis l'admin (`admin_commande_telephone`) : le
  // compte est celui de l'admin, le vrai client est sur le libelle « ☎ <nom> ».
  const clientTelephone = addr?.label?.startsWith('☎ ') ? addr.label.slice(2).trim() : null;
  const addressLabel = addr ? formatAddressLine(addr.zone, clientTelephone ? null : addr.label) : '';
  return {
    id: o.id,
    orderNumber: o.order_number,
    restaurantId: o.restaurant_id,
    restaurantName,
    restaurantInitials: initialsFromName(restaurantName),
    restaurantLogoUrl: o.restaurants?.logo_url ?? null,
    restaurantPhone: o.restaurants?.phone ?? null,
    // Bascule automatique confirmee -> en_preparation (tache pg_cron, 30 a 60 s).
    preparationAuto: o.restaurants?.preparation_auto === true,
    clientName: clientTelephone ?? o.profiles?.full_name ?? null,
    items: (o.order_items ?? []).map((it) => ({
      productId: it.product_id ?? '',
      name: it.product_name_snapshot,
      quantity: it.quantity,
      unitPrice: it.unit_price,
      comment: it.comment ?? null,
      packagingFee: it.packaging_fee_snapshot ?? 0,
      packagingLabel: it.packaging_label_snapshot ?? null,
      options: (it.order_item_options ?? []).map((op) => ({
        optionId: op.option_id,
        name: op.option_name_snapshot,
        priceDelta: op.price_delta_snapshot,
        quantity: op.quantity,
      })),
    })),
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    packagingFee: o.packaging_fee ?? 0,
    promoCode: o.promo_code ?? null,
    promoDiscount: o.promo_discount ?? 0,
    remisePorteMonnaie: o.remise_porte_monnaie ?? 0,
    total: o.total,
    paymentMethod: o.payment_method,
    // Verdict du webhook Stripe, deduit de `payment_intents` par un trigger.
    // `non_requis` pour tout ce qui se regle a la livraison.
    paymentStatus: o.payment_status ?? 'non_requis',
    status: o.status,
    addressLabel,
    addressDetail: addr?.landmark ?? '',
    createdLabel: createdLabel(o.created_at),
    etaLabel: DEFAULT_ETA,
    cancellationReason: o.cancellation_reason,
    cancellationCode: o.cancellation_code ?? null,
    cancellationDetail: o.cancellation_detail ?? null,
    mapsUrl:
      addr?.latitude != null && addr?.longitude != null
        ? getMapsNavigationUrl(addr.latitude, addr.longitude)
        : null,
    // Le telephone saisi sur l'adresse de livraison prime : c'est celui que le
    // client a donne POUR cette commande. Le profil sert de repli.
    clientPhone: addr?.phone ?? o.profiles?.phone ?? null,
    courierId: o.courier_id,
    pickedUp: o.picked_up_at != null,
    arrivingAt: o.arriving_at ?? null,
    arrivedAt: o.arrived_at ?? null,
    deliveredAt: o.delivered_at ?? null,
    createdAt: o.created_at,
    readyAt: o.ready_at ?? null,
    pickedUpAt: o.picked_up_at ?? null,
  };
}

/**
 * MES commandes — l'onglet « Commandes » du parcours client.
 *
 * ⚠️ Le filtre `user_id` est OBLIGATOIRE, la RLS ne suffit pas. `orders` porte quatre
 * politiques SELECT permissives qui se cumulent en OU : propriétaire, staff du restaurant,
 * livreur (courses disponibles + les siennes), admin. Sans ce filtre, la requête renvoyait
 * donc à un restaurateur les commandes de SES CLIENTS — nom, téléphone et adresse joints —
 * et à un livreur toutes les courses en attente, dans leur historique PERSONNEL. Vérifié le
 * 2026-09-06 avec de vrais jetons : 4 lignes pour `demo.resto`, 5 pour `demo.livreur`, zéro
 * leur appartenant. C'est le pendant exact de l'avertissement déjà porté par
 * `listRestaurantOrders` — il manquait dans l'autre sens.
 *
 * Le sujet est devenu quotidien avec le bouton « App client » de l'en-tête pro (2026-09-06) :
 * un partenaire est désormais à UN tap de cet écran, alors qu'il n'y venait jamais avant.
 */
export async function listOrders(): Promise<Order[]> {
  // `getSession()` lit le jeton déjà en mémoire/stockage — pas d'aller-retour réseau,
  // contrairement à `getUser()`. Sans session, rien à lire : on ne lance pas la requête.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  await preparerTraductions();
  return (data as unknown as OrderJoinRow[]).map(mapOrder).map(traduireCommande);
}

/**
 * Estimation indicative de la commande, FIGÉE par la base à la création (2026-10-07).
 * Null pour une commande antérieure, ou si la lecture échoue : l'écran de suivi masque
 * alors simplement le bloc — une estimation ne doit jamais empêcher de suivre sa commande.
 */
export async function getEstimationCommande(orderId: string): Promise<EstimationCommande | null> {
  const { data, error } = await supabase
    .from('estimations_commande')
    .select('preparation_min, preparation_source, charge_commandes, charge_min, attente_livreur_min, trajet_min, livraison_min, total_min, distance_km, heure_prete_estimee, heure_livree_estimee')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error || !data) return null;
  const e = data as {
    preparation_min: number;
    preparation_source: EstimationCommande['preparationSource'];
    charge_commandes: number;
    charge_min: number;
    attente_livreur_min: number;
    trajet_min: number;
    livraison_min: number;
    total_min: number;
    distance_km: number | string | null;
    heure_prete_estimee: string;
    heure_livree_estimee: string;
  };
  return {
    preparationMin: e.preparation_min,
    preparationSource: e.preparation_source,
    chargeCommandes: e.charge_commandes,
    chargeMin: e.charge_min,
    attenteLivreurMin: e.attente_livreur_min,
    trajetMin: e.trajet_min,
    livraisonMin: e.livraison_min,
    totalMin: e.total_min,
    distanceKm: e.distance_km == null ? null : Number(e.distance_km),
    heurePreteEstimee: e.heure_prete_estimee,
    heureLivreeEstimee: e.heure_livree_estimee,
  };
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  await preparerTraductions();
  const [enriched] = await attachCourierProfiles([traduireCommande(mapOrder(data as unknown as OrderJoinRow))]);
  if (!enriched) return null;
  // Enrichit les photos produit (non stockées dans le snapshot).
  const productIds = enriched.items.map((i) => i.productId).filter(Boolean);
  if (productIds.length > 0) {
    const { data: photos } = await supabase
      .from('products')
      .select('id, photo_url')
      .in('id', productIds);
    if (photos) {
      const pm = new Map(
        (photos as { id: string; photo_url: string | null }[]).map((p) => [p.id, p.photo_url]),
      );
      return {
        ...enriched,
        items: enriched.items.map((it) => ({ ...it, photoUrl: pm.get(it.productId) ?? null })),
      };
    }
  }
  return enriched;
}

/**
 * Renseigne courierName/courierPhone à partir des profils des livreurs assignés.
 * La RLS n'autorise cette lecture qu'au client de la commande et au staff du restaurant.
 */
async function attachCourierProfiles(orders: Order[]): Promise<Order[]> {
  const ids = Array.from(new Set(orders.map((o) => o.courierId).filter(Boolean) as string[]));
  if (ids.length === 0) return orders;
  const { data } = await supabase.from('profiles').select('id, full_name, phone').in('id', ids);
  const map = new Map(
    ((data ?? []) as { id: string; full_name: string | null; phone: string | null }[]).map((p) => [p.id, p]),
  );
  return orders.map((o) => {
    const p = o.courierId ? map.get(o.courierId) : undefined;
    return p ? { ...o, courierName: p.full_name ?? null, courierPhone: p.phone ?? null } : o;
  });
}

/** Statut seul (pour le rafraîchissement périodique de l'écran de suivi). */
export async function getOrderStatus(id: string): Promise<OrderStatus | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as OrderStatus) ?? null;
}

export type CreateOrderItem = {
  productId: string;
  quantity: number;
  options: { optionId: string; quantity: number }[];
  /** Précision libre du client sur ce plat. La base la borne à 140 caractères. */
  comment?: string | null;
};

export type CreateOrderInput = {
  restaurantId: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  items: CreateOrderItem[];
  /** Code promo saisi tel quel. La base normalise, valide et calcule la remise. */
  codePromo?: string | null;
  /**
   * Payer une partie des PLATS avec le porte-monnaie (2026-10-07). La base relit le
   * solde et calcule la remise elle-même ; le client n'envoie qu'un oui / non.
   */
  utiliserPorteMonnaie?: boolean;
};

/**
 * Raisons de refus d'un code promo, telles que la base les renvoie.
 * Chaîne fermée : ajouter une raison en base sans l'ajouter ici casse le build
 * plutôt que d'afficher un message vide au client.
 */
export type RaisonPromo =
  | 'inconnu'
  | 'inactif'
  | 'pas_encore'
  | 'expire'
  | 'epuise'
  | 'deja_utilise'
  | 'non_connecte'
  | 'restaurant_inconnu'
  /**
   * Le code est bon, mais il ne donne rien ICI : un code « livraison » sur un
   * restaurant qui livre gratuitement, un repas offert sur un panier sans plat
   * (bières et softs seuls). Refusé plutôt qu'annoncé à 0 Ar : « Tu économises
   * 0 Ar » laisserait croire au client qu'il a dépensé son code.
   */
  | 'sans_effet';

export type VerificationPromo =
  | { valide: true; code: string; remise: number; porteSur: 'livraison' | 'sous_total'; description: string | null }
  | { valide: false; raison: RaisonPromo };

/**
 * `verifier_code_promo` et `apercu_code_promo` répondent dans la même forme :
 * une seule lecture, pour que les deux chemins ne divergent jamais sur un
 * champ manquant.
 */
function lireVerificationPromo(data: unknown, code: string): VerificationPromo {
  const r = data as {
    valide: boolean;
    raison?: RaisonPromo;
    code?: string;
    remise?: number;
    porte_sur?: 'livraison' | 'sous_total';
    description?: string | null;
  } | null;
  if (!r?.valide) return { valide: false, raison: r?.raison ?? 'inconnu' };
  return {
    valide: true,
    code: r.code ?? code.trim().toUpperCase(),
    remise: r.remise ?? 0,
    porteSur: r.porte_sur ?? 'livraison',
    description: r.description ?? null,
  };
}

/**
 * Vérifie un code promo AVANT de valider le panier, sans rien consommer.
 *
 * ⚠️ Le montant renvoyé est un APERÇU. Le montant qui compte est celui que
 * `create_order` recalcule au moment de la commande : c'est elle qui relit le
 * barème et les frais de livraison en base. Si les deux divergeaient, c'est la
 * commande qui aurait raison.
 *
 * ⚠️ Gardée pour les versions installées, et comme REPLI de `apercuCodePromo`.
 * Elle ne reçoit que le sous-total, boissons comprises : pour un repas offert
 * hors boissons, elle répond « valide, remise 0 » (migration 20260914193000).
 * Elle n'annonce donc jamais plus que la facture, mais pas le vrai montant.
 */
export async function verifierCodePromo(
  code: string,
  restaurantId: string,
  sousTotal: number,
): Promise<VerificationPromo> {
  const { data, error } = await supabase.rpc('verifier_code_promo', {
    p_code: code,
    p_restaurant_id: restaurantId,
    p_sous_total: sousTotal,
  });
  if (error) throw error;
  return lireVerificationPromo(data, code);
}

/**
 * Aperçu EXACT d'un code promo, calculé sur les lignes du panier.
 *
 * POURQUOI en plus de `verifierCodePromo` : un repas offert porte sur les plats,
 * les suppléments et l'emballage, sans les bières ni les softs. Le sous-total
 * ne dit pas quelles lignes sont des boissons ; `apercu_code_promo` relit
 * produits, options et catégories en base, avec les règles de `create_order`.
 * La remise annoncée est donc celle qui sera facturée.
 *
 * ⚠️ `p_items` part au MÊME format que dans `createOrder`. Un écart ferait
 * calculer la remise sur un autre panier que celui qui sera commandé.
 *
 * Lève en cas d'échec (fonction absente d'une base pas encore migrée, réseau) :
 * c'est à l'appelant de retomber sur `verifierCodePromo` (`store/promo.ts`).
 */
export async function apercuCodePromo(
  code: string,
  restaurantId: string,
  items: CreateOrderItem[],
): Promise<VerificationPromo> {
  const { data, error } = await supabase.rpc('apercu_code_promo', {
    p_code: code,
    p_restaurant_id: restaurantId,
    p_items: items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      options: i.options.map((o) => ({ option_id: o.optionId, quantity: o.quantity })),
    })),
  });
  if (error) throw error;
  return lireVerificationPromo(data, code);
}

/**
 * Traduit l'échec d'un `create_order` portant sur le code promo en raison
 * exploitable. La base lève `code_promo:<raison>` : un préfixe stable, choisi
 * pour que l'app n'ait jamais à reconnaître une phrase française.
 */
export function raisonPromoDepuisErreur(message: string): RaisonPromo | null {
  const m = /code_promo:([a-z_]+)/i.exec(message ?? '');
  return m ? (m[1] as RaisonPromo) : null;
}

/** Pourquoi la base a refusé de servir : le restaurant est fermé, ou la carte
 *  demandée n'est pas encore ouverte (les pizzas au four, le soir seulement). */
export type RefusService =
  | { motif: 'restaurant_ferme' }
  | { motif: 'categorie_hors_service'; categorie: string; de: string; a: string };

/**
 * Traduit l'échec d'un `create_order` portant sur les heures de service.
 *
 * ⚠️ Ce n'est pas un doublon de la vérification d'écran. L'écran grise ce qui
 * n'est pas servi, mais l'écran n'a jamais été l'autorité : la clé anon est
 * publique par conception, et `create_order` reste appelable directement. La
 * base tranche, et ces messages ne font que rendre son verdict lisible.
 *
 * ⚠️ Séparateur « | » et non « : » — un nom de catégorie peut contenir un
 * deux-points, et le découpage se ferait alors au mauvais endroit.
 */
export function refusServiceDepuisErreur(message: string): RefusService | null {
  const msg = message ?? '';
  if (/service:restaurant_ferme/i.test(msg)) return { motif: 'restaurant_ferme' };
  const m = /service:categorie_hors_service\|([^|]*)\|([^|]*)\|([^|\s]*)/i.exec(msg);
  if (m) return { motif: 'categorie_hors_service', categorie: m[1], de: m[2], a: m[3] };
  return null;
}

/**
 * Crée une commande via la RPC `create_order` (atomique, options validées et prix
 * recalculés côté serveur). Renvoie le numéro généré par la base (ex. TF-1).
 */
export async function createOrder(input: CreateOrderInput): Promise<{
  id: string;
  orderNumber: string;
  subtotal: number;
  deliveryFee: number;
  packagingFee: number;
  promoCode: string | null;
  promoDiscount: number;
  remisePorteMonnaie: number;
  total: number;
}> {
  // ⚠️ `p_code_promo` est TOUJOURS transmis, même à null. La RPC existe en deux
  // formes — quatre paramètres (les versions déjà installées sur les magasins)
  // et cinq — et c'est le nombre de clés envoyées qui départage. Omettre la clé
  // ferait retomber l'app sur l'ancienne forme, qui ignore les codes promo.
  const { data, error } = await supabase.rpc('create_order', {
    p_restaurant_id: input.restaurantId,
    p_address_id: input.addressId,
    p_payment_method: input.paymentMethod,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      options: i.options.map((o) => ({ option_id: o.optionId, quantity: o.quantity })),
      // `create_order` lit `v_item->>'comment'` depuis le 2026-09-05 : la clé
      // existait côté base, l'app ne l'envoyait simplement jamais.
      comment: i.comment?.trim() || null,
    })),
    p_code_promo: input.codePromo ?? null,
    // Clé envoyée SEULEMENT quand le client veut s'en servir : sans elle, l'appel
    // reste exactement celui des versions précédentes (défaut false en base).
    ...(input.utiliserPorteMonnaie ? { p_utiliser_porte_monnaie: true } : {}),
  });
  if (error) throw error;
  // La RPC `RETURNS orders` : selon PostgREST/supabase-js, `data` peut arriver soit
  // comme objet unique, soit comme tableau à un élément. On tolère les deux, et on
  // échoue bruyamment si l'id manque — plutôt que de laisser l'écran suivant naviguer
  // vers `/order/undefined` (page « introuvable ») avec un montant à 0.
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        id: string;
        order_number: string;
        subtotal: number;
        delivery_fee: number;
        packaging_fee?: number | null;
        promo_code?: string | null;
        promo_discount?: number | null;
        remise_porte_monnaie?: number | null;
        total: number;
      }
    | null
    | undefined;
  if (!row?.id) {
    throw new Error("La commande a été créée mais le serveur a renvoyé une réponse inattendue.");
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    packagingFee: row.packaging_fee ?? 0,
    promoCode: row.promo_code ?? null,
    promoDiscount: row.promo_discount ?? 0,
    remisePorteMonnaie: row.remise_porte_monnaie ?? 0,
    total: row.total,
  };
}

// --- Espace restaurant ------------------------------------------------------

/**
 * Commandes d'UN restaurant, filtrées par statut. On filtre explicitement par
 * `restaurantId` : un compte multi-rôle (restaurant ET client) a deux politiques SELECT
 * (staff OU propriétaire) qui se cumulent en OR — sans ce filtre, ses commandes passées
 * en tant que client (y compris chez d'autres restaurants) fuiteraient dans la liste, et
 * toute action dessus serait refusée par `set_order_status`. Les plus récentes d'abord.
 *
 * ⚠️ UNE COMMANDE CARTE NON ENCAISSÉE N'EXISTE PAS POUR LE RESTAURANT.
 * `create_order` insère en `status = 'recue'` AVANT que le client n'ait vu le
 * PaymentSheet. Sans ce filtre, la commande d'un client qui abandonne son
 * paiement s'affiche sur la tablette avec son bouton « Accepter » : le
 * restaurant cuisine, personne ne paie, et la marchandise est perdue. On la
 * masque tant que l'encaissement n'a pas abouti — elle réapparaît d'elle-même
 * dès que `payment_status` passe à `paye`, ou dès que le client bascule en
 * espèces (`basculer_en_especes` repasse `payment_method` à `especes`).
 * `rembourse` n'est PAS masqué : il ne s'atteint qu'après un `paye`, donc le
 * restaurant connaît déjà la commande et doit continuer à la voir.
 *
 * ⚠️ CE FILTRE NE SUFFIT PAS SEUL. Il ferme la porte de la tablette ; celle du
 * push, de l'e-mail et du Telegram (avec leur lien « Accepter ») se ferme dans
 * `notify_order_status`, migration `20260906020000_annonce_restaurant_apres_
 * encaissement_carte.sql` — écrite mais PAS ENCORE APPLIQUÉE en base. Les deux
 * doivent être en place avant de passer `admin_set_carte_active(true)`.
 */
export async function listRestaurantOrders(
  statuses: OrderStatus[],
  restaurantId: string,
): Promise<Order[]> {
  if (!restaurantId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('restaurant_id', restaurantId)
    .in('status', statuses)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const visibles = (data as unknown as OrderJoinRow[]).filter(
    (o) =>
      o.payment_method !== 'cb' ||
      (o.payment_status ?? 'non_requis') === 'paye' ||
      (o.payment_status ?? 'non_requis') === 'rembourse',
  );
  return attachCourierProfiles(visibles.map(mapOrder));
}

/**
 * Fait évoluer le statut d'une commande via la RPC `set_order_status` (vérifie
 * l'appartenance au restaurant et n'autorise que les transitions valides côté serveur).
 * Un refus (`annulee`) exige un motif : `refus.code` (+ précision libre facultative),
 * la base compose alors le texte lu par le client (`cancellation_reason`).
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  refus?: { code: RefusalCode; precision?: string | null },
): Promise<void> {
  const precision = refus?.precision?.trim() || null;
  const { error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_new_status: status,
    p_code: refus?.code ?? null,
    p_precision: precision,
  });
  if (error) throw error;
}

// --- Espace livreur ---------------------------------------------------------

/** Nombre maximum de commandes qu'un livreur peut tenir en même temps. */
export const MAX_TOURNEE = 3;

/**
 * Commandes DISPONIBLES à livrer (en_livraison, pas encore prises).
 * Filtre explicite `courier_id is null` (pas seulement la RLS).
 *
 * `restaurantId` restreint au restaurant demandé. On s'en sert dès que le
 * livreur tient déjà une commande : les autres restaurants lui seraient
 * refusés par la base, autant ne pas les lui montrer. Lui proposer un bouton
 * qui échoue à tous les coups, c'est le piège classique.
 */
export async function listAvailableDeliveries(restaurantId?: string | null): Promise<Order[]> {
  let q = supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('status', 'en_livraison')
    .is('courier_id', null);
  if (restaurantId) q = q.eq('restaurant_id', restaurantId);
  const { data, error } = await q.order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as OrderJoinRow[]).map(mapOrder);
}

/**
 * La tournée du livreur courant : les commandes qu'il tient, de la plus
 * ancienne à la plus récente. Jusqu'à MAX_TOURNEE, toutes du même restaurant
 * — c'est la base qui l'impose (voir la RPC claim_order).
 *
 * Filtre explicite par `courierId` : un compte multi-rôle a plusieurs
 * politiques de lecture qui se cumulent, la RLS seule laisserait passer
 * les commandes qu'il a passées comme client.
 */
export async function listMyActiveDeliveries(courierId: string): Promise<Order[]> {
  if (!courierId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('courier_id', courierId)
    .eq('status', 'en_livraison')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as unknown as OrderJoinRow[]).map(mapOrder);
}

/** Historique des livraisons du livreur courant (livree), plus récent d'abord. */
export async function listMyDeliveries(courierId: string): Promise<Order[]> {
  if (!courierId) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('courier_id', courierId)
    .eq('status', 'livree')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as OrderJoinRow[]).map(mapOrder);
}

/** Disponibilité courante du livreur (false si aucune ligne couriers). */
export async function getCourierAvailability(courierId: string): Promise<boolean> {
  if (!courierId) return false;
  const { data, error } = await supabase
    .from('couriers')
    .select('is_available')
    .eq('user_id', courierId)
    .maybeSingle();
  if (error) throw error;
  return Boolean((data as { is_available: boolean } | null)?.is_available);
}

/** Bascule la disponibilité (upsert via RPC). */
export async function setCourierAvailability(available: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_courier_availability', { p_available: available });
  if (error) throw error;
}

/** Prend une commande disponible (attribution atomique). Lève si déjà prise. */
export async function claimDelivery(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_order', { p_order_id: orderId });
  if (error) throw error;
}

/** Abandonne une commande prise (repasse disponible). */
export async function releaseDelivery(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('release_order', { p_order_id: orderId });
  if (error) throw error;
}

/** Confirme la récupération au restaurant. */
export async function markPickedUp(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_order_picked_up', { p_order_id: orderId });
  if (error) throw error;
}

// --- Restaurants en négociation : intérêt et alerte d'ouverture -------------
// ---------------------------------------------------------------------------
// Avis clients (docs/NOTATION-AVIS.md)
// ---------------------------------------------------------------------------

/**
 * Dépose l'avis d'une commande livrée. La base vérifie TOUT (client de la commande,
 * statut livrée, sept jours, un seul avis, pas une commande téléphone) et renvoie
 * le code promo de remerciement. Erreurs métier : `avis:deja_depose`, `avis:trop_tard`…
 */
export async function deposerAvis(input: {
  orderId: string;
  cuisine: number;
  preparation: number;
  livraison: number;
  commentaire: string | null;
  consentement: boolean;
  langue: string;
  /** URL publique du bucket `avis`, sous le dossier du client — la base refuse tout autre chemin. */
  photoUrl?: string | null;
  /**
   * Message privé au restaurant (≤ 500 car.) : stocké à part (`avis_messages_prives`),
   * lu par le restaurant et Taxi Food seulement, jamais publié. La clé n'est envoyée
   * que si le client a écrit quelque chose.
   */
  messagePrive?: string | null;
  /** Pseudo public (2-20 car.) à la place du prénom ; absent = le prénom. */
  pseudo?: string | null;
}): Promise<CodeRemerciement> {
  const { data, error } = await supabase.rpc('deposer_avis', {
    p_order_id: input.orderId,
    p_cuisine: input.cuisine,
    p_preparation: input.preparation,
    p_livraison: input.livraison,
    p_commentaire: input.commentaire,
    p_consentement: input.consentement,
    p_langue: input.langue,
    p_photo_url: input.photoUrl ?? null,
    ...(input.messagePrive ? { p_message_prive: input.messagePrive } : {}),
    ...(input.pseudo ? { p_pseudo: input.pseudo } : {}),
  });
  if (error) throw error;
  // Depuis le 2026-10-07 la base ne crée plus de code : `code` vaut null et le
  // remerciement est un crédit de porte-monnaie (`credit_porte_monnaie`).
  const d = data as {
    code: string | null; valeur: number; expire_le: string | null;
    credit_porte_monnaie?: number | null; solde_porte_monnaie?: number | null;
  };
  return {
    code: d.code ?? null,
    valeur: d.valeur,
    expireLe: d.expire_le ?? null,
    creditPorteMonnaie: d.credit_porte_monnaie ?? 0,
    soldePorteMonnaie: d.solde_porte_monnaie ?? null,
  };
}

/** L'avis que j'ai laissé sur cette commande, ou null. */
export async function monAvis(orderId: string): Promise<MonAvis | null> {
  const { data, error } = await supabase.rpc('mon_avis', { p_order_id: orderId });
  if (error) throw error;
  if (!data) return null;
  const d = data as {
    note_cuisine: number; note_preparation: number; note_livraison: number;
    commentaire: string | null; photo_url?: string | null; consentement_publication: boolean; created_at: string;
    code: string | null; code_valeur: number | null; code_expire_le: string | null;
    credit_porte_monnaie?: number | null; message_prive?: string | null;
  };
  return {
    noteCuisine: d.note_cuisine,
    notePreparation: d.note_preparation,
    noteLivraison: d.note_livraison,
    commentaire: d.commentaire,
    photoUrl: d.photo_url ?? null,
    consentement: d.consentement_publication,
    createdAt: d.created_at,
    code: d.code,
    codeValeur: d.code_valeur,
    codeExpireLe: d.code_expire_le,
    creditPorteMonnaie: d.credit_porte_monnaie ?? 0,
    messagePrive: d.message_prive ?? null,
  };
}

// ---------------------------------------------------------------------------
// Porte-monnaie (2026-10-07)
// ---------------------------------------------------------------------------

/** Mon solde et mes 100 derniers mouvements, lus en base. */
export async function monPorteMonnaie(): Promise<PorteMonnaie> {
  const { data, error } = await supabase.rpc('mon_porte_monnaie');
  if (error) throw error;
  const d = (data ?? {}) as {
    solde?: number;
    mouvements?: { id: string; montant: number; motif: string; commande: string | null; restaurant: string | null; created_at: string }[];
  };
  return {
    solde: d.solde ?? 0,
    mouvements: (d.mouvements ?? []).map((m) => ({
      id: m.id,
      montant: m.montant,
      motif: m.motif as MotifPorteMonnaie,
      commande: m.commande,
      restaurant: m.restaurant,
      createdAt: m.created_at,
    })),
  };
}

/**
 * Les commandes que le client peut encore noter (livrées depuis moins de 7 jours, sans avis,
 * pas prises par téléphone) — mêmes règles que `deposer_avis`, calculées par la base.
 */
export async function mesAvisEnAttente(): Promise<AvisEnAttente[]> {
  const { data, error } = await supabase.rpc('mes_avis_en_attente');
  if (error) throw error;
  return ((data ?? []) as { order_id: string; numero: string; restaurant: string; restaurant_id: string; livree_le: string; limite_le: string }[]).map((r) => ({
    orderId: r.order_id,
    numero: r.numero,
    restaurant: r.restaurant,
    restaurantId: r.restaurant_id,
    livreeLe: r.livree_le,
    limiteLe: r.limite_le,
  }));
}

/**
 * Ce que le porte-monnaie couvrirait sur ce panier, calculé par la base comme le
 * fera `create_order` (plats seulement, après un code qui porte sur les plats).
 * Un aperçu : rien n'est débité.
 */
export async function apercuPorteMonnaie(
  restaurantId: string,
  items: CreateOrderItem[],
  codePromo: string | null,
): Promise<{ solde: number; remise: number }> {
  const { data, error } = await supabase.rpc('apercu_porte_monnaie', {
    p_restaurant_id: restaurantId,
    p_items: items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      options: i.options.map((o) => ({ option_id: o.optionId, quantity: o.quantity })),
    })),
    p_code_promo: codePromo,
  });
  if (error) throw error;
  const d = (data ?? {}) as { solde?: number; remise?: number };
  return { solde: d.solde ?? 0, remise: d.remise ?? 0 };
}

/** Les avis publiés d'un restaurant, du plus récent au plus ancien. Lecture publique. */
export async function listAvisRestaurant(restaurantId: string, limite = 20, decalage = 0): Promise<Avis[]> {
  const { data, error } = await supabase.rpc('avis_restaurant', {
    p_restaurant_id: restaurantId,
    p_limite: limite,
    p_decalage: decalage,
  });
  if (error) throw error;
  return ((data ?? []) as {
    id: string; prenom: string; note_cuisine: number; note_preparation: number; note_livraison: number;
    note_restaurant: number | string; commentaire: string | null; created_at: string;
    reponse_restaurant: string | null; reponse_le: string | null; photo_url?: string | null;
  }[]).map((a) => ({
    id: a.id,
    prenom: a.prenom,
    noteCuisine: a.note_cuisine,
    notePreparation: a.note_preparation,
    noteLivraison: a.note_livraison,
    noteRestaurant: Number(a.note_restaurant),
    commentaire: a.commentaire,
    photoUrl: a.photo_url ?? null,
    createdAt: a.created_at,
    reponseRestaurant: a.reponse_restaurant,
    reponseLe: a.reponse_le,
  }));
}

/**
 * Dépose la photo du plat dans le bucket `avis`, sous le dossier du client
 * (`<uid>/<horodatage>.jpg`) — le seul chemin que la policy d'écriture accepte, et
 * le seul que `deposer_avis` reconnaît. Renvoie l'URL publique.
 */
export async function envoyerPhotoAvis(uri: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Connexion requise');
  const arraybuffer = await fetch(uri).then((res) => res.arrayBuffer());
  const isPng = uri.toLowerCase().endsWith('.png');
  const path = `${session.user.id}/${Date.now()}.${isPng ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from('avis').upload(path, arraybuffer, {
    contentType: isPng ? 'image/png' : 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('avis').getPublicUrl(path).data.publicUrl;
}

/** Les avis reçus par MON restaurant (staff actif), avec la commande et le statut. */
export async function avisDeMonRestaurant(restaurantId: string): Promise<AvisRestaurateur[]> {
  const { data, error } = await supabase.rpc('avis_de_mon_restaurant', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return ((data ?? []) as {
    id: string; order_id: string; order_number: string; prenom: string;
    note_cuisine: number; note_preparation: number; note_livraison: number; note_restaurant: number | string;
    commentaire: string | null; created_at: string;
    reponse_restaurant: string | null; reponse_le: string | null; statut: 'publie' | 'masque';
    photo_url?: string | null; message_prive?: string | null;
  }[]).map((a) => ({
    id: a.id,
    orderId: a.order_id,
    orderNumber: a.order_number,
    prenom: a.prenom,
    noteCuisine: a.note_cuisine,
    notePreparation: a.note_preparation,
    noteLivraison: a.note_livraison,
    noteRestaurant: Number(a.note_restaurant),
    commentaire: a.commentaire,
    photoUrl: a.photo_url ?? null,
    createdAt: a.created_at,
    reponseRestaurant: a.reponse_restaurant,
    reponseLe: a.reponse_le,
    statut: a.statut,
    messagePrive: a.message_prive ?? null,
  }));
}

/** Réponse publique du restaurant à un avis (≤ 500 caractères). Texte vide = retirer. */
export async function repondreAvis(avisId: string, reponse: string | null): Promise<void> {
  const { error } = await supabase.rpc('repondre_avis', { p_avis_id: avisId, p_reponse: reponse });
  if (error) throw error;
}

/**
 * Note une visite (silencieuse) ou une demande d'alerte sur un restaurant
 * `coming_soon`. Renvoie « le client est inscrit à l'alerte ». Ne lève pas si le
 * restaurant a ouvert entre-temps : la base répond simplement l'état.
 */
export async function noterInteretRestaurant(restaurantId: string, kind: 'visite' | 'alerte'): Promise<boolean> {
  const { data, error } = await supabase.rpc('noter_interet_restaurant', {
    p_restaurant_id: restaurantId,
    p_kind: kind,
  });
  if (error) throw error;
  return data === true;
}

/** Le client a-t-il déjà demandé à être prévenu de l'ouverture de ce restaurant ? */
export async function monInteretRestaurant(restaurantId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mon_interet_restaurant', { p_restaurant_id: restaurantId });
  if (error) throw error;
  return data === true;
}

/** « J'arrive » : le client reçoit « ton livreur arrive dans 5 minutes ». Un seul appui. */
export async function markArriving(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_order_arriving', { p_order_id: orderId });
  if (error) throw error;
}

/** « Je suis là » : le client reçoit « ton livreur est devant chez toi ». Un seul appui. */
export async function markArrived(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_order_arrived', { p_order_id: orderId });
  if (error) throw error;
}

/** Confirme la livraison (+ encaissement espèces si applicable). */
export async function markDelivered(orderId: string, cashConfirmed: boolean): Promise<void> {
  const { error } = await supabase.rpc('mark_order_delivered', {
    p_order_id: orderId,
    p_cash_confirmed: cashConfirmed,
  });
  if (error) throw error;
}


// --- Espace restaurant : reglages -------------------------------------------

/**
 * Enregistre le planning de la semaine d'un coup (un seul aller-retour reseau),
 * services du midi ET du soir compris.
 *
 * ⚠️ `service` part toujours, meme a 1. La RPC le fait retomber sur 1 quand il
 * manque — c'est ce qui laisse les versions deja installees sur les magasins
 * continuer de piloter le service du midi sans rien casser — mais compter
 * la-dessus depuis ici rendrait un service du soir silencieusement ecrase sur
 * le midi.
 */
export async function setRestaurantWeekHours(days: DayHours[]): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_week_hours', {
    p_days: days.map((d) => ({
      weekday: d.weekday,
      service: d.service ?? 1,
      opens_at: d.isClosed ? null : d.opensAt || null,
      closes_at: d.isClosed ? null : d.closesAt || null,
      is_closed: d.isClosed,
    })),
  });
  if (error) throw error;
}

/** Bascule l'ouverture automatique (suit le planning) / manuelle. */
export async function setRestaurantAutoOpen(autoOpen: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_auto_open', { p_auto_open: autoOpen });
  if (error) throw error;
}

/** Ouvrir ou fermer a la main. Bascule aussi le restaurant en mode manuel. */
export async function setRestaurantOpen(isOpen: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_open', { p_is_open: isOpen });
  if (error) throw error;
}

/** Mettre un produit en rupture, ou le remettre en vente. */
export async function setProductAvailable(productId: string, available: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_product_available', {
    p_product_id: productId,
    p_available: available,
  });
  if (error) throw error;
}

/** Telephone public du restaurant, affiche au client sur ses commandes. */
export async function setRestaurantPhone(phone: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_phone', { p_phone: phone });
  if (error) throw error;
}

/** Depose le logo ou la couverture (deja uploade cote client dans le bucket `partenaires`) et met a jour la fiche. */
export async function setRestaurantPhoto(kind: 'logo' | 'cover', url: string): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_photo', { p_kind: kind, p_url: url });
  if (error) throw error;
}

/**
 * Cree une mise en avant, ou met a jour une fiche deja en bibliotheque puis la
 * remet a l'affiche. `photoUrl` vide ne PAS effacer la photo existante : c'est
 * ce qui permet de reprogrammer le meme plat sans rien re-televerser.
 */
export async function saveFeaturedProduct(input: {
  productId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  stockQuantity?: number | null;
  photoUrl?: string | null;
  featuredLabel?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_featured_product', {
    p_product_id: input.productId ?? null,
    p_name: input.name,
    p_description: input.description ?? null,
    p_price: input.price,
    p_stock_quantity: input.stockQuantity ?? null,
    p_photo_url: input.photoUrl ?? null,
    p_featured_label: input.featuredLabel ?? null,
  });
  if (error) throw error;
  // La RPC renvoie la ligne `products` : on en garde l'identifiant, sans quoi un
  // plat tout juste cree n'aurait aucun id ou poser ses garnitures.
  return (data as { id: string }).id;
}

/** Accompagnements et sauces d'un plat : ce que le client devra choisir. */
export type Garnitures = { accompagnements: string[]; sauces: string[] };

type GarnitureRow = { kind: string; name: string; usages: number };

/**
 * La bibliotheque de garnitures du restaurant : tout ce qui existe DEJA sur sa
 * carte, accompagnements d'un cote, sauces de l'autre, les plus utilises en tete.
 *
 * ⚠️ Le classement vient du NOM du groupe d'options (« accompagnement », « sauce »),
 * la convention deja en place chez les partenaires. Pas de colonne en plus — mais
 * la contrepartie est qu'un groupe nomme autrement reste invisible ici. C'est voulu :
 * on ne propose pas de recocher des supplements pizza comme un accompagnement.
 */
export async function fetchGarnituresDisponibles(): Promise<Garnitures> {
  const { data, error } = await supabase.rpc('restaurant_garnitures');
  if (error) throw error;
  const rows = (data ?? []) as GarnitureRow[];
  return {
    accompagnements: rows.filter((r) => r.kind === 'accompagnement').map((r) => r.name),
    sauces: rows.filter((r) => r.kind === 'sauce').map((r) => r.name),
  };
}

/** Ce qui est deja coche sur ce plat — pour rouvrir la fenetre sur son etat reel. */
export async function fetchGarnituresDuPlat(productId: string): Promise<Garnitures> {
  const { data, error } = await supabase
    .from('product_option_groups')
    .select('name, product_options ( name, sort_order )')
    .eq('product_id', productId);
  if (error) throw error;
  const groups = (data ?? []) as unknown as {
    name: string;
    product_options: { name: string; sort_order: number }[];
  }[];
  const noms = (g: { product_options: { name: string; sort_order: number }[] }) =>
    [...g.product_options].sort((a, b) => a.sort_order - b.sort_order).map((o) => o.name);
  return {
    accompagnements: groups.filter((g) => /accompagnement/i.test(g.name)).flatMap(noms),
    sauces: groups.filter((g) => /sauce/i.test(g.name)).flatMap(noms),
  };
}

/**
 * Remplace les accompagnements et les sauces d'un plat par ceux qui ont ete coches.
 * Un tableau vide retire le groupe : c'est la facon de dire « ce plat se sert seul ».
 */
export async function setProductGarnitures(productId: string, g: Garnitures): Promise<void> {
  const { error } = await supabase.rpc('set_product_garnitures', {
    p_product_id: productId,
    p_accompagnements: g.accompagnements,
    p_sauces: g.sauces,
  });
  if (error) throw error;
}

/** Met a l'affiche / retire n'importe quel produit (y compris de la carte permanente). */
export async function setProductFeatured(
  productId: string,
  featured: boolean,
  featuredLabel?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('set_product_featured', {
    p_product_id: productId,
    p_featured: featured,
    p_featured_label: featuredLabel ?? null,
  });
  if (error) throw error;
}

/** Quantite restante annoncee (le restaurateur la decremente lui-meme). */
export async function setProductStock(productId: string, stock: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_product_stock', {
    p_product_id: productId,
    p_stock: stock,
  });
  if (error) throw error;
}

/**
 * Pose le rang d'un plat dans sa categorie. Sans rang explicite, l'ordre suivait
 * la disposition physique des lignes et changeait a chaque modification.
 * Un echange avec le voisin se fait en DEUX appels : `sort_order` ne porte aucune
 * contrainte d'unicite, l'etat intermediaire reste donc toujours valide.
 */
export async function setProductSortOrder(productId: string, sortOrder: number): Promise<void> {
  const { error } = await supabase.rpc('set_product_sort_order', {
    p_product_id: productId,
    p_sort_order: sortOrder,
  });
  if (error) throw error;
}

/** Retrait DEFINITIF de la bibliotheque (archive si le plat a deja ete commande). */
export async function archiveProduct(productId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_product', { p_product_id: productId });
  if (error) throw error;
}

/** Le restaurant de l'utilisateur courant, avec son planning de la semaine complet. */
export async function getMyRestaurant(
  restaurantId: string,
): Promise<(Restaurant & { weekHours: DayHours[] }) | null> {
  if (!restaurantId) return null;
  const [{ data, error }, { data: hoursRows, error: hoursError }] = await Promise.all([
    supabase
      .from('restaurants')
      .select('id, name, cuisine_type, logo_url, cover_url, is_open, listing_status, phone, ouvert_maintenant, auto_open, ouvre_a, ouvre_dans_jours, note_moyenne, nb_avis, est_nouveau, duree_mediane_min, horaires_du_jour(weekday,opens_at,closes_at,is_closed), services_du_jour(weekday,service,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
      .eq('id', restaurantId)
      .maybeSingle(),
    supabase
      .from('restaurant_hours')
      .select('weekday, service, opens_at, closes_at, is_closed')
      .eq('restaurant_id', restaurantId)
      .order('weekday', { ascending: true })
      .order('service', { ascending: true }),
  ]);
  if (error) throw error;
  if (hoursError) throw hoursError;
  if (!data) return null;

  // ⚠️ On rend TOUTES les lignes trouvees, pas une par jour : un jour a deux
  // services, et n'en garder qu'un ferait disparaitre le soir de l'ecran — puis
  // de la base, au premier enregistrement.
  const weekHours: DayHours[] = (hoursRows as DayHoursRow[]).map(
    (h) => mapDayHours(h) as DayHours,
  );

  return { ...mapRestaurant(data as unknown as RestaurantRow), weekHours };
}

/**
 * Memorise que la visite guidee de l'espace partenaire a ete vue — ou, avec
 * `vue = false`, remet le compte a l'etat « jamais vue » quand la case
 * « ne plus afficher » a ete decochee pendant une rediffusion.
 *
 * ⚠️ La preference est portee par le COMPTE, pas par l'appareil : elle survit a
 * un changement de telephone et a une reinstallation. C'est tout l'interet de
 * la ranger en base plutot qu'en AsyncStorage.
 */
export async function marquerVisiteProVue(vue: boolean): Promise<void> {
  const { error } = await supabase.rpc('marquer_visite_pro_vue', { p_vue: vue });
  if (error) throw error;
}
