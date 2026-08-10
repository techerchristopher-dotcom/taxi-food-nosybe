/**
 * Données factices (mock) — Taxi Food, Nosy Be.
 *
 * ⚠️ Backend NON branché : toute l'app fonctionne de bout en bout avec ces données locales.
 * Au moment de brancher Supabase (voir SCHEMA-TAXI-FOOD.md), ce fichier sera remplacé
 * par de vrais appels réseau. Les formes ci-dessous suivent volontairement le schéma :
 * profiles / addresses / restaurants / categories / products / orders / order_items.
 *
 * Noms repris de la maquette : Pizzeria Papillon, Tacos du Boulevard, Burger Baobab, Chez Loulou.
 */

export type PaymentMethod = 'cb' | 'especes' | 'orange_money';

export type OrderStatus =
  | 'recue'
  | 'confirmee'
  | 'en_preparation'
  | 'en_livraison'
  | 'livree'
  | 'annulee';

export type Product = {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number; // ariary
  isAvailable: boolean;
  tags?: string[]; // ex. ["Épicé", "33 cm"]
};

export type Category = {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
};

export type Restaurant = {
  id: string;
  name: string;
  initials: string;
  cuisineType: string; // ex. "Pizza · Italien"
  zone: string; // quartier de Nosy Be
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  hoursLabel: string; // ex. "11h – 22h30"
  etaLabel: string; // ex. "25–35 min"
  deliveryFee: number; // ariary
  minOrder: number; // ariary
  popular?: boolean;
  closedLabel?: string; // ex. "Ouvre demain à 11h00"
};

export type Address = {
  id: string;
  label: string;
  zone: string;
  landmark: string;
  phone: string;
  instructions?: string;
  isDefault: boolean;
  icon: 'home' | 'work' | 'location_on';
};

export type OrderItemSnapshot = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  comment?: string;
};

export type Order = {
  id: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  restaurantInitials: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  addressLabel: string;
  addressDetail: string;
  createdLabel: string; // ex. "Aujourd'hui 09h52"
  etaLabel?: string; // ex. "10h15 – 10h30"
};

// ---------------------------------------------------------------------------
// Profil de démo (remplacé par Supabase Auth / Google plus tard)
// ---------------------------------------------------------------------------
export const mockProfile = {
  id: 'demo-user',
  fullName: 'Rasoa Andriamana',
  email: 'rasoa.a@gmail.com',
  phone: '+261 32 45 678 90',
  initials: 'RA',
};

// ---------------------------------------------------------------------------
// Adresses enregistrées
// ---------------------------------------------------------------------------
export const mockAddresses: Address[] = [
  {
    id: 'addr-maison',
    label: 'Maison — Villa Bleue',
    zone: 'Ambondrona',
    landmark: "En face de l'épicerie Chez Néné",
    phone: '+261 32 45 678 90',
    instructions: 'Maison bleue à côté du terrain de foot, portail vert',
    isDefault: true,
    icon: 'home',
  },
  {
    id: 'addr-bureau',
    label: 'Bureau — Hell-Ville',
    zone: 'Hell-Ville',
    landmark: 'Rue Passot, à côté de la BNI',
    phone: '+261 34 11 223 44',
    isDefault: false,
    icon: 'work',
  },
];

/** Quartiers de Nosy Be proposés à la saisie d'adresse. */
export const nosyBeZones = [
  'Hell-Ville',
  'Ambondrona',
  'Ambatoloaka',
  'Madirokely',
  'Dzamandzar',
  'Djabala',
  'Ambaro',
  'Andilana',
];

// ---------------------------------------------------------------------------
// Restaurants
// ---------------------------------------------------------------------------
export const restaurants: Restaurant[] = [
  {
    id: 'r-papillon',
    name: 'Pizzeria Papillon',
    initials: 'PP',
    cuisineType: 'Pizza · Italien',
    zone: 'Hell-Ville',
    isOpen: true,
    opensAt: '11:00',
    closesAt: '22:30',
    hoursLabel: '11h – 22h30',
    etaLabel: '25–35 min',
    deliveryFee: 5000,
    minOrder: 15000,
    popular: true,
  },
  {
    id: 'r-tacos',
    name: 'Tacos du Boulevard',
    initials: 'TB',
    cuisineType: 'Tacos · Grillades',
    zone: 'Ambatoloaka',
    isOpen: true,
    opensAt: '10:00',
    closesAt: '23:00',
    hoursLabel: '10h – 23h',
    etaLabel: '20–30 min',
    deliveryFee: 4000,
    minOrder: 12000,
  },
  {
    id: 'r-baobab',
    name: 'Burger Baobab',
    initials: 'BB',
    cuisineType: 'Burgers · Street-food',
    zone: 'Madirokely',
    isOpen: true,
    opensAt: '11:00',
    closesAt: '22:00',
    hoursLabel: '11h – 22h',
    etaLabel: '30–40 min',
    deliveryFee: 6000,
    minOrder: 15000,
  },
  {
    id: 'r-loulou',
    name: 'Chez Loulou',
    initials: 'CL',
    cuisineType: 'Malgache · Poissons',
    zone: 'Hell-Ville',
    isOpen: false,
    opensAt: '11:00',
    closesAt: '21:00',
    hoursLabel: '11h – 21h',
    etaLabel: '30–45 min',
    deliveryFee: 5000,
    minOrder: 15000,
    closedLabel: 'Ouvre demain à 11h00',
  },
];

// ---------------------------------------------------------------------------
// Catégories
// ---------------------------------------------------------------------------
export const categories: Category[] = [
  // Pizzeria Papillon
  { id: 'c-pap-pizzas', restaurantId: 'r-papillon', name: 'Pizzas', sortOrder: 1 },
  { id: 'c-pap-tacos', restaurantId: 'r-papillon', name: 'Tacos', sortOrder: 2 },
  { id: 'c-pap-burgers', restaurantId: 'r-papillon', name: 'Burgers', sortOrder: 3 },
  { id: 'c-pap-boissons', restaurantId: 'r-papillon', name: 'Boissons', sortOrder: 4 },
  // Tacos du Boulevard
  { id: 'c-tac-tacos', restaurantId: 'r-tacos', name: 'Tacos', sortOrder: 1 },
  { id: 'c-tac-grill', restaurantId: 'r-tacos', name: 'Grillades', sortOrder: 2 },
  { id: 'c-tac-boissons', restaurantId: 'r-tacos', name: 'Boissons', sortOrder: 3 },
  // Burger Baobab
  { id: 'c-bao-burgers', restaurantId: 'r-baobab', name: 'Burgers', sortOrder: 1 },
  { id: 'c-bao-sides', restaurantId: 'r-baobab', name: 'Accompagnements', sortOrder: 2 },
  { id: 'c-bao-boissons', restaurantId: 'r-baobab', name: 'Boissons', sortOrder: 3 },
  // Chez Loulou
  { id: 'c-lou-plats', restaurantId: 'r-loulou', name: 'Plats malgaches', sortOrder: 1 },
  { id: 'c-lou-poissons', restaurantId: 'r-loulou', name: 'Poissons', sortOrder: 2 },
  { id: 'c-lou-boissons', restaurantId: 'r-loulou', name: 'Boissons', sortOrder: 3 },
];

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------
export const products: Product[] = [
  // --- Pizzeria Papillon · Pizzas
  {
    id: 'p-margherita',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-pizzas',
    name: 'Pizza Margherita',
    description: 'Tomate, mozzarella, basilic frais',
    price: 25000,
    isAvailable: true,
    tags: ['33 cm'],
  },
  {
    id: 'p-4fromages',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-pizzas',
    name: 'Pizza 4 Fromages',
    description: 'Mozzarella, chèvre, bleu, parmesan',
    price: 32000,
    isAvailable: true,
    tags: ['33 cm'],
  },
  {
    id: 'p-zebu',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-pizzas',
    name: 'Pizza Zébu Épicée',
    description: 'Zébu émincé, poivrons, sakay doux',
    price: 34000,
    isAvailable: true,
    tags: ['Épicé', '33 cm'],
  },
  {
    id: 'p-fruitsdemer',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-pizzas',
    name: 'Pizza Fruits de Mer',
    description: 'Crevettes, calamars, ail',
    price: 38000,
    isAvailable: false,
    tags: ['33 cm'],
  },
  // --- Pizzeria Papillon · Boissons
  {
    id: 'p-coca',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-boissons',
    name: 'Coca-Cola 50 cl',
    description: 'Bouteille fraîche',
    price: 5000,
    isAvailable: true,
  },
  {
    id: 'p-eau',
    restaurantId: 'r-papillon',
    categoryId: 'c-pap-boissons',
    name: 'Eau minérale 1 L',
    description: 'Eau Vive',
    price: 3000,
    isAvailable: true,
  },
  // --- Tacos du Boulevard
  {
    id: 'p-tacos-poulet',
    restaurantId: 'r-tacos',
    categoryId: 'c-tac-tacos',
    name: 'Tacos Poulet XL',
    description: 'Poulet mariné, frites, sauce fromagère',
    price: 18000,
    isAvailable: true,
    tags: ['XL'],
  },
  {
    id: 'p-tacos-zebu',
    restaurantId: 'r-tacos',
    categoryId: 'c-tac-tacos',
    name: 'Tacos Zébu',
    description: 'Zébu haché, cheddar, sauce algérienne',
    price: 20000,
    isAvailable: true,
  },
  {
    id: 'p-brochette',
    restaurantId: 'r-tacos',
    categoryId: 'c-tac-grill',
    name: 'Brochettes de zébu',
    description: 'Trois brochettes grillées, riz, achards',
    price: 22000,
    isAvailable: true,
  },
  {
    id: 'p-fanta',
    restaurantId: 'r-tacos',
    categoryId: 'c-tac-boissons',
    name: 'Fanta 50 cl',
    description: 'Orange, bien frais',
    price: 5000,
    isAvailable: true,
  },
  // --- Burger Baobab
  {
    id: 'p-baobab-xl',
    restaurantId: 'r-baobab',
    categoryId: 'c-bao-burgers',
    name: 'Burger Baobab XL',
    description: 'Double steak, cheddar, bacon, oignons confits',
    price: 28000,
    isAvailable: true,
    tags: ['XL'],
  },
  {
    id: 'p-baobab-poulet',
    restaurantId: 'r-baobab',
    categoryId: 'c-bao-burgers',
    name: 'Burger Poulet Croustillant',
    description: 'Poulet pané, salade, sauce maison',
    price: 24000,
    isAvailable: true,
  },
  {
    id: 'p-frites',
    restaurantId: 'r-baobab',
    categoryId: 'c-bao-sides',
    name: 'Frites maison',
    description: 'Coupées main, sel de Nosy Be',
    price: 9000,
    isAvailable: true,
  },
  {
    id: 'p-baobab-coca',
    restaurantId: 'r-baobab',
    categoryId: 'c-bao-boissons',
    name: 'Coca-Cola 50 cl',
    description: 'Bouteille fraîche',
    price: 5000,
    isAvailable: true,
  },
  // --- Chez Loulou (fermé, mais menu consultable)
  {
    id: 'p-romazava',
    restaurantId: 'r-loulou',
    categoryId: 'c-lou-plats',
    name: 'Romazava',
    description: 'Bœuf, brèdes mafane, riz blanc',
    price: 20000,
    isAvailable: true,
  },
  {
    id: 'p-poisson',
    restaurantId: 'r-loulou',
    categoryId: 'c-lou-poissons',
    name: 'Poisson grillé du jour',
    description: 'Pêche locale, riz, achards',
    price: 26000,
    isAvailable: true,
  },
];

// ---------------------------------------------------------------------------
// Historique de commandes (démo)
// ---------------------------------------------------------------------------
export const mockOrders: Order[] = [
  {
    id: 'o-2418',
    orderNumber: 'TF-2418',
    restaurantId: 'r-papillon',
    restaurantName: 'Pizzeria Papillon',
    restaurantInitials: 'PP',
    items: [
      { productId: 'p-zebu', name: 'Pizza Zébu Épicée', quantity: 2, unitPrice: 34000, comment: 'Sans oignons' },
      { productId: 'p-coca', name: 'Coca-Cola 50 cl', quantity: 1, unitPrice: 5000 },
    ],
    subtotal: 73000,
    deliveryFee: 5000,
    total: 78000,
    paymentMethod: 'especes',
    status: 'en_livraison',
    addressLabel: 'Ambondrona — Villa Bleue',
    addressDetail: "En face de l'épicerie Chez Néné",
    createdLabel: "Aujourd'hui 09h52",
    etaLabel: '10h15 – 10h30',
  },
  {
    id: 'o-2377',
    orderNumber: 'TF-2377',
    restaurantId: 'r-baobab',
    restaurantName: 'Burger Baobab',
    restaurantInitials: 'BB',
    items: [
      { productId: 'p-baobab-xl', name: 'Burger Baobab XL', quantity: 1, unitPrice: 28000 },
      { productId: 'p-frites', name: 'Frites maison', quantity: 1, unitPrice: 9000 },
    ],
    subtotal: 37000,
    deliveryFee: 6000,
    total: 43000,
    paymentMethod: 'cb',
    status: 'livree',
    addressLabel: 'Ambondrona — Villa Bleue',
    addressDetail: "En face de l'épicerie Chez Néné",
    createdLabel: '6 août · 19h40',
  },
  {
    id: 'o-2301',
    orderNumber: 'TF-2301',
    restaurantId: 'r-tacos',
    restaurantName: 'Tacos du Boulevard',
    restaurantInitials: 'TB',
    items: [
      { productId: 'p-tacos-poulet', name: 'Tacos Poulet XL', quantity: 2, unitPrice: 18000 },
      { productId: 'p-fanta', name: 'Fanta 50 cl', quantity: 2, unitPrice: 5000 },
    ],
    subtotal: 46000,
    deliveryFee: 4000,
    total: 50000,
    paymentMethod: 'orange_money',
    status: 'livree',
    addressLabel: 'Hell-Ville — Bureau',
    addressDetail: 'Rue Passot, à côté de la BNI',
    createdLabel: '2 août · 12h30',
  },
];

// ---------------------------------------------------------------------------
// Sélecteurs utilitaires
// ---------------------------------------------------------------------------
export const getRestaurant = (id: string) => restaurants.find((r) => r.id === id);
export const getProduct = (id: string) => products.find((p) => p.id === id);
export const getCategoriesFor = (restaurantId: string) =>
  categories.filter((c) => c.restaurantId === restaurantId).sort((a, b) => a.sortOrder - b.sortOrder);
export const getProductsFor = (restaurantId: string) =>
  products.filter((p) => p.restaurantId === restaurantId);

export const paymentLabel = (m: PaymentMethod): string =>
  m === 'cb' ? 'Carte bancaire' : m === 'orange_money' ? 'Orange Money' : 'Espèces';

export const paymentShort = (m: PaymentMethod): string =>
  m === 'cb' ? 'carte bancaire' : m === 'orange_money' ? 'Orange Money' : 'espèces';

export const statusLabel = (s: OrderStatus): string =>
  ({
    recue: 'Reçue',
    confirmee: 'Confirmée',
    en_preparation: 'En préparation',
    en_livraison: 'En livraison',
    livree: 'Livrée',
    annulee: 'Annulée',
  })[s];

/** Index 0..4 de l'étape de suivi pour un statut donné. */
export const statusStep = (s: OrderStatus): number =>
  ({ recue: 0, confirmee: 1, en_preparation: 2, en_livraison: 3, livree: 4, annulee: 0 })[s];
