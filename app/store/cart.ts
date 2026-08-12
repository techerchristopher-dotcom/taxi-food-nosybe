/**
 * Panier (zustand) + persistance locale (AsyncStorage).
 *
 * Règle métier clé : un panier ne contient QUE des produits d'un seul restaurant.
 * Ajouter un produit d'un autre restaurant déclenche un conflit (écran « Changer de restaurant ? »).
 *
 * Identité d'une ligne : `product.id` + le commentaire (clé composite). Deux ajouts du même
 * produit avec des commentaires différents = deux lignes distinctes (ex. Tacos « poulet » vs
 * « steak »). Même produit + même commentaire = fusion des quantités.
 *
 * Le contexte restaurant (nom, initiales, frais de livraison) est mémorisé DANS le panier
 * au moment du premier ajout : ni le panier ni la validation n'ont besoin de re-requêter
 * le restaurant, et le total survit hors-ligne.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../data/types';

const CART_KEY = 'taxi-food.cart';

export type CartLine = {
  /** Clé stable d'identification de la ligne (product.id + commentaire). */
  key: string;
  product: Product;
  quantity: number;
  comment?: string;
};

/** Clé composite d'une ligne : produit + commentaire normalisé. */
export function lineKey(productId: string, comment?: string): string {
  return productId + '::' + (comment ?? '');
}

/** Contexte restaurant fourni à l'ajout (l'écran qui ajoute connaît déjà le restaurant). */
export type RestaurantContext = {
  id: string;
  name: string;
  initials: string;
  deliveryFee: number;
};

type Persisted = {
  restaurantId: string | null;
  restaurantName: string;
  restaurantInitials: string;
  deliveryFeeValue: number;
  lines: CartLine[];
};

type CartState = Persisted & {
  hydrated: boolean;

  hydrate: () => Promise<void>;
  /** true si le produit peut être ajouté sans conflit de restaurant. */
  canAdd: (product: Product) => boolean;
  add: (product: Product, ctx: RestaurantContext, quantity?: number, comment?: string) => void;
  /** Vide puis ajoute (utilisé après confirmation du conflit). */
  replaceWith: (product: Product, ctx: RestaurantContext, quantity?: number, comment?: string) => void;
  /** Quantité de la ligne « ajout rapide » (sans commentaire) d'un produit. */
  quantityOf: (productId: string) => number;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;

  count: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  total: () => number;
};

async function persist(s: Persisted) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(s));
}

const EMPTY: Persisted = {
  restaurantId: null,
  restaurantName: '',
  restaurantInitials: '',
  deliveryFeeValue: 0,
  lines: [],
};

export const useCart = create<CartState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(CART_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Persisted;
        // Rétro-compat : recalcule la clé pour les paniers persistés avant l'ajout de `key`.
        const lines = (parsed.lines ?? []).map((l) => ({
          ...l,
          key: l.key ?? lineKey(l.product.id, l.comment),
        }));
        set({ ...parsed, lines, hydrated: true });
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

  add: (product, ctx, quantity = 1, comment) => {
    const key = lineKey(product.id, comment);
    const { lines } = get();
    const existing = lines.find((l) => l.key === key);
    const nextLines = existing
      ? lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      : [...lines, { key, product, quantity, comment }];
    const next: Persisted = {
      restaurantId: ctx.id,
      restaurantName: ctx.name,
      restaurantInitials: ctx.initials,
      deliveryFeeValue: ctx.deliveryFee,
      lines: nextLines,
    };
    set(next);
    void persist(next);
  },

  replaceWith: (product, ctx, quantity = 1, comment) => {
    const next: Persisted = {
      restaurantId: ctx.id,
      restaurantName: ctx.name,
      restaurantInitials: ctx.initials,
      deliveryFeeValue: ctx.deliveryFee,
      lines: [{ key: lineKey(product.id, comment), product, quantity, comment }],
    };
    set(next);
    void persist(next);
  },

  quantityOf: (productId) =>
    get().lines.find((l) => l.key === lineKey(productId))?.quantity ?? 0,

  setQuantity: (key, quantity) => {
    if (quantity <= 0) {
      get().remove(key);
      return;
    }
    const lines = get().lines.map((l) => (l.key === key ? { ...l, quantity } : l));
    const next: Persisted = { ...toPersisted(get()), lines };
    set(next);
    void persist(next);
  },

  remove: (key) => {
    const lines = get().lines.filter((l) => l.key !== key);
    const next: Persisted =
      lines.length === 0 ? { ...EMPTY } : { ...toPersisted(get()), lines };
    set(next);
    void persist(next);
  },

  clear: () => {
    const next = { ...EMPTY };
    set(next);
    void persist(next);
  },

  count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
  subtotal: () => get().lines.reduce((n, l) => n + l.product.price * l.quantity, 0),
  deliveryFee: () => get().deliveryFeeValue,
  total: () => get().subtotal() + get().deliveryFeeValue,
}));

function toPersisted(s: CartState): Persisted {
  return {
    restaurantId: s.restaurantId,
    restaurantName: s.restaurantName,
    restaurantInitials: s.restaurantInitials,
    deliveryFeeValue: s.deliveryFeeValue,
    lines: s.lines,
  };
}
