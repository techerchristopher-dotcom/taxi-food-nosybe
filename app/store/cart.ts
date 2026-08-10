/**
 * Panier (zustand) + persistance locale (AsyncStorage).
 *
 * Règle métier clé : un panier ne contient QUE des produits d'un seul restaurant.
 * Ajouter un produit d'un autre restaurant déclenche un conflit (écran « Changer de restaurant ? »).
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRestaurant, Product } from '../data/mock';

const CART_KEY = 'taxi-food.cart';

export type CartLine = {
  product: Product;
  quantity: number;
  comment?: string;
};

type CartState = {
  restaurantId: string | null;
  lines: CartLine[];
  hydrated: boolean;

  hydrate: () => Promise<void>;
  /** true si le produit peut être ajouté sans conflit de restaurant. */
  canAdd: (product: Product) => boolean;
  add: (product: Product, quantity?: number, comment?: string) => void;
  /** Vide puis ajoute (utilisé après confirmation du conflit). */
  replaceWith: (product: Product, quantity?: number, comment?: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;

  count: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
};

async function persist(state: Pick<CartState, 'restaurantId' | 'lines'>) {
  await AsyncStorage.setItem(
    CART_KEY,
    JSON.stringify({ restaurantId: state.restaurantId, lines: state.lines }),
  );
}

export const useCart = create<CartState>((set, get) => ({
  restaurantId: null,
  lines: [],
  hydrated: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(CART_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { restaurantId: string | null; lines: CartLine[] };
        set({ restaurantId: parsed.restaurantId, lines: parsed.lines, hydrated: true });
        return;
      } catch {
        // ignore
      }
    }
    set({ hydrated: true });
  },

  canAdd: (product) => {
    const { restaurantId, lines } = get();
    return lines.length === 0 || restaurantId === product.restaurantId;
  },

  add: (product, quantity = 1, comment) => {
    const { lines, restaurantId } = get();
    const existing = lines.find((l) => l.product.id === product.id);
    let nextLines: CartLine[];
    if (existing) {
      nextLines = lines.map((l) =>
        l.product.id === product.id
          ? { ...l, quantity: l.quantity + quantity, comment: comment ?? l.comment }
          : l,
      );
    } else {
      nextLines = [...lines, { product, quantity, comment }];
    }
    const next = { restaurantId: restaurantId ?? product.restaurantId, lines: nextLines };
    set(next);
    void persist(next);
  },

  replaceWith: (product, quantity = 1, comment) => {
    const next = {
      restaurantId: product.restaurantId,
      lines: [{ product, quantity, comment }],
    };
    set(next);
    void persist(next);
  },

  setQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().remove(productId);
      return;
    }
    const lines = get().lines.map((l) =>
      l.product.id === productId ? { ...l, quantity } : l,
    );
    const next = { restaurantId: get().restaurantId, lines };
    set(next);
    void persist(next);
  },

  remove: (productId) => {
    const lines = get().lines.filter((l) => l.product.id !== productId);
    const restaurantId = lines.length === 0 ? null : get().restaurantId;
    const next = { restaurantId, lines };
    set(next);
    void persist(next);
  },

  clear: () => {
    const next = { restaurantId: null, lines: [] };
    set(next);
    void persist(next);
  },

  count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
  subtotal: () => get().lines.reduce((n, l) => n + l.product.price * l.quantity, 0),
  deliveryFee: () => {
    const id = get().restaurantId;
    return id ? (getRestaurant(id)?.deliveryFee ?? 0) : 0;
  },
  total: () => get().subtotal() + get().deliveryFee(),
}));
