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
import {
  Address,
  addressIcon,
  Category,
  createdLabel,
  DEFAULT_ETA,
  formatTime,
  getMapsNavigationUrl,
  formatAddressLine,
  initialsFromName,
  OptionGroup,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductOption,
  Restaurant,
  DayHours,
} from './types';

// --- Formes brutes (colonnes de la base) -----------------------------------
type DayHoursRow = {
  weekday: number | null;
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
  ouvert_maintenant?: boolean | null;
  auto_open?: boolean | null;
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
  photo_url: string | null;
  stock_quantity?: number | null;
  is_featured?: boolean | null;
  featured_label?: string | null;
  in_menu?: boolean | null;
  is_archived?: boolean | null;
  diet_tags?: string[] | null;
  packaging_fee?: number | null;
  packaging_label?: string | null;
};

/** Colonnes produit demandées partout : une seule source pour ne pas en oublier une. */
const PRODUCT_COLS =
  'id, restaurant_id, category_id, name, description, price, is_available, photo_url, stock_quantity, is_featured, featured_label, in_menu, is_archived, diet_tags, packaging_fee, packaging_label';

type CategoryRow = { id: string; restaurant_id: string; name: string; icon: string | null; sort_order: number };

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
    isOpen: r.ouvert_maintenant ?? r.is_open,
    autoOpen: r.auto_open ?? false,
    todayHours: mapDayHours(r.horaires_du_jour),
    etaLabel: DEFAULT_ETA,
    deliveryFee: r.delivery_fee,
    minOrder: r.min_order,
    foodTypes: r.food_types ?? [],
    categoryTags: [],
    popular: false,
    closedLabel: (r.ouvert_maintenant ?? r.is_open)
      ? undefined
      : r.horaires_du_jour?.opens_at
        ? `Ouvre à ${formatTime(r.horaires_du_jour.opens_at)}`
        : 'Fermé',
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
    photoUrl: p.photo_url,
    hasOptions,
    stockQuantity: p.stock_quantity ?? null,
    isFeatured: p.is_featured ?? false,
    featuredLabel: p.featured_label ?? null,
    inMenu: p.in_menu ?? true,
    dietTags: p.diet_tags ?? [],
    packagingFee: p.packaging_fee ?? 0,
    packagingLabel: p.packaging_label ?? null,
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
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, ouvert_maintenant, auto_open, horaires_du_jour(weekday,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
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

  return rows.map((r) => ({ ...mapRestaurant(r), categoryTags: tagsByResto.get(r.id) ?? [] }));
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, ouvert_maintenant, auto_open, horaires_du_jour(weekday,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRestaurant(data as unknown as RestaurantRow) : null;
}

export async function getMenu(
  restaurantId: string,
): Promise<{ categories: Category[]; products: Product[]; featured: Product[] }> {
  const [cats, prods] = await Promise.all([
    supabase
      .from('categories')
      .select('id, restaurant_id, name, icon, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select(PRODUCT_COLS)
      .eq('restaurant_id', restaurantId)
      .eq('is_archived', false),
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

  return {
    categories,
    products: productRows.map((p) => mapProduct(p, withOptions.has(p.id))),
    featured: featuredRows.map((p) => mapProduct(p, withOptions.has(p.id))),
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

function mapCategory(c: CategoryRow): Category {
  return { id: c.id, restaurantId: c.restaurant_id, name: c.name, icon: c.icon, sortOrder: c.sort_order };
}

/** Produit + restaurant + groupes d'options (pour l'écran de détail / configuration). */
export async function getProductDetail(id: string): Promise<{
  product: Product;
  restaurant: Restaurant | null;
  groups: OptionGroup[];
} | null> {
  const { data, error } = await supabase
    .from('products')
    // PRODUCT_COLS et pas une liste ecrite a la main : c'est exactement l'oubli
    // qui a fait disparaitre les frais d'emballage du panier le 2026-09-05.
    .select(PRODUCT_COLS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [groupsRes, restaurant] = await Promise.all([
    supabase
      .from('product_option_groups')
      .select('id, name, min_select, max_select, required, sort_order, product_options ( id, name, price_delta, is_available, sort_order, photo_url )')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
    getRestaurant((data as ProductRow).restaurant_id),
  ]);
  if (groupsRes.error) throw groupsRes.error;

  const groups = (groupsRes.data as unknown as OptionGroupRow[])
    .map(mapOptionGroup)
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      return a.sortOrder - b.sortOrder;
    });
  const product = mapProduct(data as ProductRow, groups.length > 0);
  return { product, restaurant, groups };
}

// --- Adresses ---------------------------------------------------------------
export async function listAddresses(): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, zone, landmark, phone, instructions, is_default, latitude, longitude')
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
  total: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  cancellation_reason: string | null;
  courier_id: string | null;
  picked_up_at: string | null;
  created_at: string;
  restaurants: { name: string; logo_url: string | null } | null;
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
    order_item_options: {
      option_id: string | null;
      option_name_snapshot: string;
      price_delta_snapshot: number;
      quantity: number;
    }[];
  }[];
};

const ORDER_SELECT =
  'id, order_number, restaurant_id, subtotal, delivery_fee, packaging_fee, total, payment_method, status, cancellation_reason, courier_id, picked_up_at, created_at, ' +
  'restaurants ( name, logo_url ), addresses ( label, zone, landmark, phone, latitude, longitude ), ' +
  'order_items ( product_id, product_name_snapshot, quantity, unit_price, ' +
  'order_item_options ( option_id, option_name_snapshot, price_delta_snapshot, quantity ) )';

function mapOrder(o: OrderJoinRow): Order {
  const restaurantName = o.restaurants?.name ?? 'Restaurant';
  const addr = o.addresses;
  const addressLabel = addr ? formatAddressLine(addr.zone, addr.label) : '';
  return {
    id: o.id,
    orderNumber: o.order_number,
    restaurantId: o.restaurant_id,
    restaurantName,
    restaurantInitials: initialsFromName(restaurantName),
    restaurantLogoUrl: o.restaurants?.logo_url ?? null,
    items: (o.order_items ?? []).map((it) => ({
      productId: it.product_id ?? '',
      name: it.product_name_snapshot,
      quantity: it.quantity,
      unitPrice: it.unit_price,
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
    total: o.total,
    paymentMethod: o.payment_method,
    status: o.status,
    addressLabel,
    addressDetail: addr?.landmark ?? '',
    createdLabel: createdLabel(o.created_at),
    etaLabel: DEFAULT_ETA,
    cancellationReason: o.cancellation_reason,
    mapsUrl:
      addr?.latitude != null && addr?.longitude != null
        ? getMapsNavigationUrl(addr.latitude, addr.longitude)
        : null,
    clientPhone: addr?.phone ?? null,
    courierId: o.courier_id,
    pickedUp: o.picked_up_at != null,
  };
}

export async function listOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as OrderJoinRow[]).map(mapOrder);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [enriched] = await attachCourierProfiles([mapOrder(data as unknown as OrderJoinRow)]);
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
};

export type CreateOrderInput = {
  restaurantId: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  items: CreateOrderItem[];
};

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
  total: number;
}> {
  const { data, error } = await supabase.rpc('create_order', {
    p_restaurant_id: input.restaurantId,
    p_address_id: input.addressId,
    p_payment_method: input.paymentMethod,
    p_items: input.items.map((i) => ({
      product_id: i.productId,
      quantity: i.quantity,
      options: i.options.map((o) => ({ option_id: o.optionId, quantity: o.quantity })),
    })),
  });
  if (error) throw error;
  // La RPC `RETURNS orders` : selon PostgREST/supabase-js, `data` peut arriver soit
  // comme objet unique, soit comme tableau à un élément. On tolère les deux, et on
  // échoue bruyamment si l'id manque — plutôt que de laisser l'écran suivant naviguer
  // vers `/order/undefined` (page « introuvable ») avec un montant à 0.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; order_number: string; subtotal: number; delivery_fee: number; packaging_fee?: number | null; total: number }
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
  return attachCourierProfiles((data as unknown as OrderJoinRow[]).map(mapOrder));
}

/**
 * Fait évoluer le statut d'une commande via la RPC `set_order_status` (vérifie
 * l'appartenance au restaurant et n'autorise que les transitions valides côté serveur).
 * `reason` obligatoire pour un refus (`annulee`).
 */
export async function setOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string,
): Promise<void> {
  const { error } = await supabase.rpc('set_order_status', {
    p_order_id: orderId,
    p_new_status: status,
    p_reason: reason ?? null,
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

/** Confirme la livraison (+ encaissement espèces si applicable). */
export async function markDelivered(orderId: string, cashConfirmed: boolean): Promise<void> {
  const { error } = await supabase.rpc('mark_order_delivered', {
    p_order_id: orderId,
    p_cash_confirmed: cashConfirmed,
  });
  if (error) throw error;
}


// --- Espace restaurant : reglages -------------------------------------------

/** Enregistre le planning des 7 jours d'un coup (un seul aller-retour reseau). */
export async function setRestaurantWeekHours(days: DayHours[]): Promise<void> {
  const { error } = await supabase.rpc('set_restaurant_week_hours', {
    p_days: days.map((d) => ({
      weekday: d.weekday,
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
}): Promise<void> {
  const { error } = await supabase.rpc('save_featured_product', {
    p_product_id: input.productId ?? null,
    p_name: input.name,
    p_description: input.description ?? null,
    p_price: input.price,
    p_stock_quantity: input.stockQuantity ?? null,
    p_photo_url: input.photoUrl ?? null,
    p_featured_label: input.featuredLabel ?? null,
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
      .select('id, name, cuisine_type, logo_url, cover_url, is_open, ouvert_maintenant, auto_open, horaires_du_jour(weekday,opens_at,closes_at,is_closed), delivery_fee, min_order, zone_served, food_types')
      .eq('id', restaurantId)
      .maybeSingle(),
    supabase
      .from('restaurant_hours')
      .select('weekday, opens_at, closes_at, is_closed')
      .eq('restaurant_id', restaurantId)
      .order('weekday', { ascending: true }),
  ]);
  if (error) throw error;
  if (hoursError) throw hoursError;
  if (!data) return null;

  const byWeekday = new Map((hoursRows as DayHoursRow[]).map((h) => [h.weekday, h]));
  const weekHours: DayHours[] = Array.from({ length: 7 }, (_, weekday) =>
    mapDayHours(byWeekday.get(weekday) ?? null) ?? { weekday, opensAt: '', closesAt: '', isClosed: false },
  );

  return { ...mapRestaurant(data as unknown as RestaurantRow), weekHours };
}
