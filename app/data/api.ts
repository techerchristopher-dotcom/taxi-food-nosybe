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
  hoursLabel,
  initialsFromName,
  OptionGroup,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductOption,
  Restaurant,
} from './types';

// --- Formes brutes (colonnes de la base) -----------------------------------
type RestaurantRow = {
  id: string;
  name: string;
  cuisine_type: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  delivery_fee: number;
  min_order: number;
  zone_served: string | null;
  food_types: string[] | null;
};

type ProductRow = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
  photo_url: string | null;
};

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
    isOpen: r.is_open,
    opensAt: r.opens_at ?? '',
    closesAt: r.closes_at ?? '',
    hoursLabel: hoursLabel(r.opens_at ?? '', r.closes_at ?? ''),
    etaLabel: DEFAULT_ETA,
    deliveryFee: r.delivery_fee,
    minOrder: r.min_order,
    foodTypes: r.food_types ?? [],
    categoryTags: [],
    popular: false,
    closedLabel: r.is_open ? undefined : r.opens_at ? `Ouvre à ${formatTime(r.opens_at)}` : 'Fermé',
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
  };
}

function mapOption(o: OptionRow): ProductOption {
  return {
    id: o.id,
    name: o.name,
    priceDelta: o.price_delta,
    isAvailable: o.is_available,
    sortOrder: o.sort_order,
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

function lastSegment(label: string): string {
  return label.split('—').pop()?.trim() ?? label;
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
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, opens_at, closes_at, delivery_fee, min_order, zone_served, food_types')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = data as RestaurantRow[];

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
    .select('id, name, cuisine_type, logo_url, cover_url, is_open, opens_at, closes_at, delivery_fee, min_order, zone_served, food_types')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRestaurant(data as RestaurantRow) : null;
}

export async function getMenu(
  restaurantId: string,
): Promise<{ categories: Category[]; products: Product[] }> {
  const [cats, prods] = await Promise.all([
    supabase
      .from('categories')
      .select('id, restaurant_id, name, icon, sort_order')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, restaurant_id, category_id, name, description, price, is_available, photo_url')
      .eq('restaurant_id', restaurantId),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;

  const categories = (cats.data as CategoryRow[]).map(mapCategory);
  // Masquage doux : on ne garde que les produits d'une catégorie ACTIVE.
  const activeCatIds = new Set(categories.map((c) => c.id));
  const productRows = (prods.data as ProductRow[]).filter(
    (p) => p.category_id != null && activeCatIds.has(p.category_id),
  );

  // Quels produits ont des groupes d'options (→ le menu envoie vers le détail).
  const ids = productRows.map((p) => p.id);
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
  };
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
    .select('id, restaurant_id, category_id, name, description, price, is_available, photo_url')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const [groupsRes, restaurant] = await Promise.all([
    supabase
      .from('product_option_groups')
      .select('id, name, min_select, max_select, required, sort_order, product_options ( id, name, price_delta, is_available, sort_order )')
      .eq('product_id', id)
      .order('sort_order', { ascending: true }),
    getRestaurant((data as ProductRow).restaurant_id),
  ]);
  if (groupsRes.error) throw groupsRes.error;

  const groups = (groupsRes.data as unknown as OptionGroupRow[]).map(mapOptionGroup);
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
  total: number;
  payment_method: PaymentMethod;
  status: OrderStatus;
  cancellation_reason: string | null;
  created_at: string;
  restaurants: { name: string } | null;
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
  'id, order_number, restaurant_id, subtotal, delivery_fee, total, payment_method, status, cancellation_reason, created_at, ' +
  'restaurants ( name ), addresses ( label, zone, landmark, phone, latitude, longitude ), ' +
  'order_items ( product_id, product_name_snapshot, quantity, unit_price, ' +
  'order_item_options ( option_id, option_name_snapshot, price_delta_snapshot, quantity ) )';

function mapOrder(o: OrderJoinRow): Order {
  const restaurantName = o.restaurants?.name ?? 'Restaurant';
  const addr = o.addresses;
  const addressLabel = addr
    ? `${addr.zone}${addr.label ? ' — ' + lastSegment(addr.label) : ''}`
    : '';
  return {
    id: o.id,
    orderNumber: o.order_number,
    restaurantId: o.restaurant_id,
    restaurantName,
    restaurantInitials: initialsFromName(restaurantName),
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
  return data ? mapOrder(data as unknown as OrderJoinRow) : null;
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
    | { id: string; order_number: string; subtotal: number; delivery_fee: number; total: number }
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
    total: row.total,
  };
}

// --- Espace restaurant ------------------------------------------------------

/**
 * Commandes du restaurant du compte courant, filtrées par statut. La RLS restreint
 * déjà aux commandes du restaurant lié (staff actif) — pas besoin de filtrer par
 * restaurant côté client. Les plus récentes d'abord.
 */
export async function listRestaurantOrders(statuses: OrderStatus[]): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .in('status', statuses)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as OrderJoinRow[]).map(mapOrder);
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
