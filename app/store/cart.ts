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
import { mesurer } from '../lib/mesure';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { optionsTotal, Product, SelectedOption } from '../data/types';

const CART_KEY = 'taxi-food.cart';

export type CartLine = {
  /** Clé stable : product.id + options triées (+ un suffixe unique si la ligne porte une précision). */
  key: string;
  product: Product;
  quantity: number;
  options: SelectedOption[];
  /**
   * Précision du client sur CE plat (« sans tomate »). Pas une option : pas de
   * prix, pas de validation en base — juste un mot transmis au restaurant.
   */
  comment?: string | null;
};

/** Clé composite d'une ligne : produit + ids d'options triés. */
export function lineKey(productId: string, optionIds: string[] = []): string {
  return productId + '::' + [...optionIds].sort().join(',');
}

/**
 * Une ligne AVEC précision est toujours une ligne à part, jamais fusionnée :
 * « 2 tacos dont 1 sans tomate » doit rester deux lignes. La clé reste stable
 * pendant qu'on retouche le texte au panier — sinon le champ se démonterait à
 * chaque lettre tapée (la ligne est rendue avec `key={l.key}`).
 */
function cleDeLigne(productId: string, options: SelectedOption[], comment?: string | null): string {
  const base = lineKey(productId, options.map((o) => o.optionId));
  return comment?.trim() ? `${base}::c${Date.now()}` : base;
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
export type PackagingLine = {
  label: string;
  /** Total de la ligne. */
  amount: number;
  /** Nombre d'exemplaires facturés — pour écrire « 3 × 2 000 Ar » et que 6 000 ne tombe pas du ciel. */
  count: number;
  /** Montant par exemplaire. */
  unit: number;
};

export function packagingLines(lines: CartLine[]): PackagingLine[] {
  return regrouperEmballages(
    lines.map((l) => ({
      // Emballage d'un exemplaire = celui du plat + celui des options choisies (barquette de
      // grains, de riz en plus…) — même calcul que `create_order`, qui fait foi.
      fee:
        (l.product.packagingFee ?? 0) +
        (l.options ?? []).reduce((n, o) => n + (o.packagingFee ?? 0) * o.quantity, 0),
      label: l.product.packagingLabel,
      quantity: l.quantity,
    })),
  );
}

/**
 * Même regroupement qu'au panier, mais depuis une commande PASSÉE (instantanés
 * `packagingFee` / `packagingLabel` de chaque ligne). Le client doit lire le
 * même libellé au suivi qu'au paiement — et le restaurant sur sa carte.
 */
export function packagingLinesFromItems(
  items: { quantity: number; packagingFee?: number; packagingLabel?: string | null }[],
): PackagingLine[] {
  return regrouperEmballages(
    items.map((it) => ({ fee: it.packagingFee ?? 0, label: it.packagingLabel, quantity: it.quantity })),
  );
}

/**
 * Regroupe par libellé ET par montant unitaire : deux frais au même nom mais à
 * des tarifs différents resteraient deux lignes, sinon « n × montant » mentirait.
 */
function regrouperEmballages(
  lignes: { fee: number; label?: string | null; quantity: number }[],
): PackagingLine[] {
  const groupes = new Map<string, PackagingLine>();
  for (const l of lignes) {
    if (l.fee <= 0) continue;
    const label = l.label || 'Emballage';
    const cle = `${label}::${l.fee}`;
    const g = groupes.get(cle) ?? { label, amount: 0, count: 0, unit: l.fee };
    g.amount += l.fee * l.quantity;
    g.count += l.quantity;
    groupes.set(cle, g);
  }
  return [...groupes.values()];
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
  add: (product: Product, ctx: RestaurantContext, quantity?: number, options?: SelectedOption[], comment?: string | null) => void;
  /** Vide puis ajoute (utilisé après confirmation du conflit). */
  replaceWith: (product: Product, ctx: RestaurantContext, quantity?: number, options?: SelectedOption[], comment?: string | null) => void;
  /** Retouche la précision d'une ligne depuis le panier (clé inchangée). */
  setComment: (key: string, comment: string) => void;
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

  add: (product, ctx, quantity = 1, options = [], comment = null) => {
    const key = cleDeLigne(product.id, options, comment);
    const { lines } = get();
    const existing = lines.find((l) => l.key === key);
    const nextLines = existing
      ? lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l))
      : [...lines, { key, product, quantity, options, comment: comment?.trim() || null }];
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
    // Web seulement, sans donnée personnelle : voir lib/mesure.ts.
    mesurer('ajout-panier', { restaurant: ctx.name });
  },

  // Le code promo SURVIT au changement de restaurant : le client l'a saisi
  // exprès, le lui retirer en silence serait la meilleure façon de lui faire
  // payer la livraison plein tarif sans qu'il comprenne pourquoi. Il est
  // revérifié contre le nouveau restaurant (`store/promo.ts` : le restaurant
  // fait partie des entrées de la vérification), et si le code ne s'y applique
  // pas le client lit la raison exacte au lieu d'une remise disparue.
  replaceWith: (product, ctx, quantity = 1, options = [], comment = null) => {
    const next: Persisted = {
      restaurantId: ctx.id,
      restaurantName: ctx.name,
      restaurantInitials: ctx.initials,
      restaurantLogoUrl: ctx.logoUrl ?? null,
      deliveryFeeValue: ctx.deliveryFee,
      lines: [{ key: cleDeLigne(product.id, options, comment), product, quantity, options, comment: comment?.trim() || null }],
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

  setComment: (key, comment) => {
    const lines = get().lines.map((l) => (l.key === key ? { ...l, comment: comment || null } : l));
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
