/**
 * Panier (zustand) + persistance locale (AsyncStorage).
 *
 * Règle métier clé : un panier ne contient QUE des produits d'un seul restaurant.
 * Ajouter un produit d'un autre restaurant déclenche un conflit (écran « Changer de restaurant ? »).
 *
 * Identité d'une ligne : `product.id` + la combinaison des options choisies (clé composite).
 * Deux ajouts du même produit avec des options différentes = deux lignes distinctes
 * (ex. Tacos « Poulet + Andalouse » vs « Steak + Harissa + Fromage »). Mêmes options = fusion.
 *
 * Le prix unitaire d'une ligne = prix de base du produit + somme des suppléments choisis.
 * (Le serveur recalcule ce prix de façon autoritaire dans create_order — ici c'est l'affichage.)
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { optionsTotal, Product, SelectedOption } from '../data/types';

const CART_KEY = 'taxi-food.cart';

export type CartLine = {
  /** Clé stable : product.id + options triées. */
  key: string;
  product: Product;
  quantity: number;
  options: SelectedOption[];
};

/** Clé composite d'une ligne : produit + ids d'options triés. */
export function lineKey(productId: string, optionIds: string[] = []): string {
  return productId + '::' + [...optionIds].sort().join(',');
}

/** Prix unitaire d'une ligne = base + suppléments. */
export function lineUnitPrice(line: CartLine): number {
  return line.product.price + optionsTotal(line.options);
}

/**
 * Frais d'emballage du panier, regroupés par libellé (« Boîte à pizza »…).
 *
 * Ce n'est PAS une option que le client choisit : c'est un frais porté par le
 * produit, comme la livraison est portée par le restaurant. Une boîte par
 * exemplaire — deux pizzas, deux boîtes.
 */
/**
 * ⚠️ Fonction PURE, à consommer via `useMemo` dans les écrans — jamais via un
 * sélecteur Zustand. Elle renvoie un nouveau tableau à chaque appel : passée en
 * sélecteur, elle provoque une boucle de rendu infinie (« Maximum update depth
 * exceeded »). Erreur commise puis corrigée le 2026-09-05.
 */
export function packagingLines(lines: CartLine[]): { label: string; amount: number }[] {
  const parLibelle = new Map<string, number>();
  for (const l of lines) {
    const fee = l.product.packagingFee ?? 0;
    if (fee <= 0) continue;
    const label = l.product.packagingLabel || 'Emballage';
    parLibelle.set(label, (parLibelle.get(label) ?? 0) + fee * l.quantity);
  }
  return [...parLibelle].map(([label, amount]) => ({ label, amount }));
}

/** Contexte restaurant fourni à l'ajout (l'écran qui ajoute connaît déjà le restaurant). */
export type RestaurantContext = {
  id: string;
  name: string;
  initials: string;
  /** Logo du restaurant (`restaurants.logo_url`), null si le resto n'en a pas. */
  logoUrl?: string | null;
  deliveryFee: number;
};

type Persisted = {
  restaurantId: string | null;
  restaurantName: string;
  restaurantInitials: string;
  /** Logo mémorisé avec le panier : le bandeau l'affiche sans relire le restaurant. */
  restaurantLogoUrl: string | null;
  deliveryFeeValue: number;
  lines: CartLine[];
  /**
   * Code promo saisi, tel que le client l'a tapé (normalisé par la base au retour).
   *
   * ⚠️ C'est le CODE seul, jamais la remise : le montant est recalculé en base à
   * chaque vérification, et de façon autoritaire par `create_order`. Il vit ici
   * parce qu'il se saisit au panier — là où le client découvre les frais de
   * livraison — et doit encore être là au récapitulatif, deux écrans et une
   * connexion plus loin (`/address` fait `router.replace('/login')`, le panier
   * est démonté au passage). La vérification, elle, est dans `store/promo.ts`.
   */
  promoCode: string | null;
};

type CartState = Persisted & {
  hydrated: boolean;

  hydrate: () => Promise<void>;
  /** true si le produit peut être ajouté sans conflit de restaurant. */
  canAdd: (product: Product) => boolean;
  add: (product: Product, ctx: RestaurantContext, quantity?: number, options?: SelectedOption[]) => void;
  /** Vide puis ajoute (utilisé après confirmation du conflit). */
  replaceWith: (product: Product, ctx: RestaurantContext, quantity?: number, options?: SelectedOption[]) => void;
  /** Quantité de la ligne « ajout rapide » (sans option) d'un produit. */
  quantityOf: (productId: string) => number;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  /** Pose ou retire le code promo saisi (null = retiré). */
  setPromoCode: (code: string | null) => void;
  /**
   * Réaligne les frais de livraison mémorisés sur ceux que la base facturera.
   *
   * ⚠️ `deliveryFeeValue` est un INSTANTANÉ pris au premier ajout au panier, et
   * il ne bougeait plus jamais. `create_order`, elle, relit toujours
   * `restaurants.delivery_fee`. Les deux ont divergé pour de bon le 2026-09-06
   * (5 000 → 10 000 Ar) : un panier resté ouvert affichait 5 000 et se faisait
   * facturer 10 000. Avec un code promo « livraison », dont la remise est
   * calculée sur le tarif COURANT, le total affiché tombait carrément à
   * « livraison offerte » pour une livraison à 5 000 Ar bien due.
   */
  setDeliveryFee: (fee: number) => void;

  count: () => number;
  subtotal: () => number;
  deliveryFee: () => number;
  packagingFee: () => number;
  total: () => number;
};

async function persist(s: Persisted) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(s));
}

const EMPTY: Persisted = {
  restaurantId: null,
  restaurantName: '',
  restaurantInitials: '',
  restaurantLogoUrl: null,
  deliveryFeeValue: 0,
  lines: [],
  promoCode: null,
};

export const useCart = create<CartState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  // ⚠️ `hydrated: true` est posé dans un `finally`, et le `try` couvre la LECTURE du
  // stockage autant que l'analyse JSON. `hydrated` retient le splash de `app/_layout.tsx` :
  // un `AsyncStorage.getItem` qui échoue laissait l'app sur son logo pour toujours. Un
  // panier illisible, c'est un panier vide — pas une app morte.
  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Persisted;
      const lines = (parsed.lines ?? []).map((l) => ({
        ...l,
        options: l.options ?? [],
        key: l.key ?? lineKey(l.product.id, (l.options ?? []).map((o) => o.optionId)),
      }));
      // `restaurantLogoUrl` et `promoCode` sont absents des paniers persistés
      // avant leur introduction.
      set({
        ...parsed,
        restaurantLogoUrl: parsed.restaurantLogoUrl ?? null,
        promoCode: parsed.promoCode ?? null,
        lines,
      });
    } catch (e) {
      console.warn('[panier] hydratation impossible', e);
    } finally {
      set({ hydrated: true });
    }
  },

  canAdd: (product) => {
    const { restaurantId, lines } = get();
    return lines.length === 0 || restaurantId === product.restaurantId;
  },

  add: (product, ctx, quantity = 1, options = []) => {
    const key = lineKey(product.id, options.map((o) => o.optionId));
    const { lines } = get();
    const existing = lines.find((l) => l.key === key);
    const nextLines = existing
      ? lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      : [...lines, { key, product, quantity, options }];
    const next: Persisted = {
      restaurantId: ctx.id,
      restaurantName: ctx.name,
      restaurantInitials: ctx.initials,
      restaurantLogoUrl: ctx.logoUrl ?? null,
      deliveryFeeValue: ctx.deliveryFee,
      lines: nextLines,
      promoCode: get().promoCode,
    };
    set(next);
    void persist(next);
  },

  // Le code promo SURVIT au changement de restaurant : le client l'a saisi
  // exprès, le lui retirer en silence serait la meilleure façon de lui faire
  // payer la livraison plein tarif sans qu'il comprenne pourquoi. Il est
  // revérifié contre le nouveau restaurant (`store/promo.ts` : le restaurant
  // fait partie des entrées de la vérification), et si le code ne s'y applique
  // pas le client lit la raison exacte au lieu d'une remise disparue.
  replaceWith: (product, ctx, quantity = 1, options = []) => {
    const next: Persisted = {
      restaurantId: ctx.id,
      restaurantName: ctx.name,
      restaurantInitials: ctx.initials,
      restaurantLogoUrl: ctx.logoUrl ?? null,
      deliveryFeeValue: ctx.deliveryFee,
      lines: [{ key: lineKey(product.id, options.map((o) => o.optionId)), product, quantity, options }],
      promoCode: get().promoCode,
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

  setPromoCode: (code) => {
    const next: Persisted = { ...toPersisted(get()), promoCode: code };
    set(next);
    void persist(next);
  },

  // On n'écrit que si la valeur CHANGE : l'appelant est un effet d'écran, et
  // un `set` inconditionnel relancerait le rendu à chaque montage. Et on ne
  // touche rien tant que le panier est vide — `EMPTY.deliveryFeeValue` vaut 0
  // et doit le rester, sinon un panier vide afficherait des frais.
  setDeliveryFee: (fee) => {
    const s = get();
    if (s.lines.length === 0 || s.deliveryFeeValue === fee) return;
    const next: Persisted = { ...toPersisted(s), deliveryFeeValue: fee };
    set(next);
    void persist(next);
  },

  count: () => get().lines.reduce((n, l) => n + l.quantity, 0),
  subtotal: () => get().lines.reduce((n, l) => n + lineUnitPrice(l) * l.quantity, 0),
  deliveryFee: () => get().deliveryFeeValue,
  packagingFee: () => packagingLines(get().lines).reduce((n, p) => n + p.amount, 0),
  total: () =>
    get().subtotal() +
    packagingLines(get().lines).reduce((n, p) => n + p.amount, 0) +
    get().deliveryFeeValue,
}));

function toPersisted(s: CartState): Persisted {
  return {
    restaurantId: s.restaurantId,
    restaurantName: s.restaurantName,
    restaurantInitials: s.restaurantInitials,
    restaurantLogoUrl: s.restaurantLogoUrl,
    deliveryFeeValue: s.deliveryFeeValue,
    lines: s.lines,
    promoCode: s.promoCode,
  };
}
