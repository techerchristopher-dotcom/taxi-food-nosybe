/**
 * Couche d'accès aux données — Supabase.
 *
 * Toutes les lectures/écritures passent par ici. Les fonctions renvoient les FORMES
 * définies dans data/types.ts (mêmes objets que ceux consommés par les écrans),
 * pour que brancher le vrai backend ne change rien à l'UI.
 *
 * RLS : restaurants/categories/products sont en lecture publique ; addresses et orders
 * sont filtrés automatiquement sur l'utilisateur connecté (auth.uid()).
 */
import { supabase } from '../lib/supabase';
import {
  Address,
  addressIcon,
  Category,
  createdLabel,
  DEFAULT_ETA,
  formatTime,
  hoursLabel,
  initialsFromName,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  Restaurant,
} from './types';

// --- Formes brutes (colonnes de la base) -----------------------------------
type RestaurantRow = {
  id: string;
  name: string;
  cuisine_type: string | null;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
  delivery_fee: number;
  min_order: number;
  zone_served: string | null;
};

type ProductRow = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
};

type CategoryRow = { id: string; restaurant_id: string; name: string; sort_order: number };

type AddressRow = {
  id: string;
  label: string | null;
  zone: string;
  landmark: string | null;
  phone: string | null;
  instructions: string | null;
  is_default: boolean;
};

// --- Mappers ----------------------------------------------------------------
function mapRestaurant(r: RestaurantRow): Restaurant {
  return {
    id: r.id,
    name: r.name,
    initials: initialsFromName(r.name),
    cuisineType: r.cuisine_type ?? '',
    zone: r.zone_served ?? '',
    isOpen: r.is_open,
    opensAt: r.opens_at ?? '',
    closesAt: r.closes_at ?? '',
    hoursLabel: hoursLabel(r.opens_at ?? '', r.closes_at ?? ''),
    etaLabel: DEFAULT_ETA,
    deliveryFee: r.delivery_fee,
    minOrder: r.min_order,
    popular: false,
    closedLabel: r.is_open ? undefined : r.opens_at ? `Ouvre à ${formatTime(r.opens_at)}` : 'Fermé',
  };
}

function mapProduct(p: ProductRow): Product {
  return {
    id: p.id,
    restaurantId: p.restaurant_id,
    categoryId: p.category_id ?? '',
    name: p.name,
    description: p.description ?? '',
    price: p.price,
    isAvailable: p.is_available,
  };
}

function mapCategory(c: CategoryRow): Category {
  return { id: c.id, restaurantId: c.restaurant_id, name: c.name, sortOrder: c.sort_order };
}

/** Dernier segment d'un libellé « Maison — Villa Bleue » → « Villa Bleue ». */
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
  };
}

// --- Restaurants & menu -----------------------------------------------------
export async function listRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, is_open, opens_at, closes_at, delivery_fee, min_order, zone_served')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as RestaurantRow[]).map(mapRestaurant);
}

export async function getRestaurant(id: string): Promise<Restaurant | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_type, is_open, opens_at, closes_at, delivery_fee, min_order, zone_served')
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
      .select('id, restaurant_id, name, sort_order')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, restaurant_id, category_id, name, description, price, is_available')
      .eq('restaurant_id', restaurantId),
  ]);
  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  return {
    categories: (cats.data as CategoryRow[]).map(mapCategory),
    products: (prods.data as ProductRow[]).map(mapProduct),
  };
}

/** Produit + son restaurant (pour composer le contexte panier : frais, nom, initiales). */
export async function getProductWithRestaurant(
  id: string,
): Promise<{ product: Product; restaurant: Restaurant | null } | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, restaurant_id, category_id, name, description, price, is_available')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const product = mapProduct(data as ProductRow);
  const restaurant = await getRestaurant(product.restaurantId);
  return { product, restaurant };
}

// --- Adresses ---------------------------------------------------------------
export async function listAddresses(): Promise<Address[]> {
  const { data, error } = await supabase
    .from('addresses')
    .select('id, label, zone, landmark, phone, instructions, is_default')
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
}): Promise<Address> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Non connecté');

  // Première adresse de l'utilisateur → défaut d'office.
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
    })
    .select('id, label, zone, landmark, phone, instructions, is_default')
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
  created_at: string;
  restaurants: { name: string } | null;
  addresses: { label: string | null; zone: string; landmark: string | null } | null;
  order_items: {
    product_id: string | null;
    product_name_snapshot: string;
    quantity: number;
    unit_price: number;
    comment: string | null;
  }[];
};

const ORDER_SELECT =
  'id, order_number, restaurant_id, subtotal, delivery_fee, total, payment_method, status, created_at, ' +
  'restaurants ( name ), addresses ( label, zone, landmark ), ' +
  'order_items ( product_id, product_name_snapshot, quantity, unit_price, comment )';

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
      comment: it.comment ?? undefined,
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

export type CreateOrderInput = {
  restaurantId: string;
  addressId: string;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number; comment?: string }[];
};

/**
 * Crée une commande via la fonction RPC `create_order` (atomique, prix recalculés
 * côté serveur). Renvoie le numéro généré par la base (ex. TF-2419) et l'id.
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
      comment: i.comment ?? null,
    })),
  });
  if (error) throw error;
  const row = data as {
    id: string;
    order_number: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
  };
  return {
    id: row.id,
    orderNumber: row.order_number,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
  };
}
