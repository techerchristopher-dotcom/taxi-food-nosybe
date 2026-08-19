/**
 * Types métier + helpers d'affichage — Taxi Food.
 *
 * Ces types décrivent les FORMES consommées par les écrans. La couche `data/api.ts`
 * lit Supabase et mappe les lignes de la base vers ces formes (voir mappers).
 *
 * Certains champs purement cosmétiques n'existent pas en base (l'ETA de livraison,
 * le badge « Populaire », les tags produit) : ils sont dérivés côté client ou laissés
 * vides, sans jamais bloquer l'UI.
 */

import i18n from '../lib/i18n';

export type PaymentMethod = 'cb' | 'especes' | 'orange_money';

/** Rôles applicatifs (multi-rôle : un compte peut être client ET restaurant, etc.). */
export type AppRole = 'client' | 'restaurant' | 'livreur';
export type RoleStatus = 'pending' | 'active' | 'revoked';
export type RoleEntry = { role: AppRole; status: RoleStatus };

/** Mode d'usage courant choisi sur l'écran de sélection (persisté localement). */
export type AppMode = 'client' | 'restaurant' | 'livreur';

/** Motifs de refus proposés au restaurant (liste rapide + précision libre optionnelle). */
export const REFUSAL_REASONS = [
  'Rupture de stock',
  'Fermé exceptionnellement',
  'Trop de commandes',
  'Article indisponible',
  'Hors zone de livraison',
] as const;

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
  photoUrl?: string | null; // URL photo produit (Supabase Storage), null si absente
  hasOptions?: boolean; // true si le produit a des groupes d'options (→ passer par le détail)
  tags?: string[]; // cosmétique — non stocké en base
};

/** Une option d'un groupe (ex. « Poulet », « + Fromage »). */
export type ProductOption = {
  id: string;
  name: string;
  priceDelta: number; // 0 = gratuit, >0 = supplément payant (ariary)
  isAvailable: boolean;
  sortOrder: number;
  photoUrl?: string | null; // vignette de l'option (ex. sauces), null si absente
};

/** Un groupe d'options d'un produit (ex. « Choix de la viande », obligatoire, 1 choix). */
export type OptionGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
  sortOrder: number;
  options: ProductOption[];
};

/** Une option choisie par le client, mémorisée dans la ligne de panier. */
export type SelectedOption = {
  optionId: string;
  groupId: string;
  name: string;
  priceDelta: number;
  quantity: number;
};

/** Total des suppléments d'une sélection d'options. */
export function optionsTotal(options: SelectedOption[]): number {
  return options.reduce((n, o) => n + o.priceDelta * o.quantity, 0);
}

/**
 * Image redimensionnée à partir d'une URL Supabase Storage publique
 * (endpoint /render/image), aux dimensions réellement affichées.
 *
 * Les visuels du bucket `produits` pèsent 1 à 2 Mo (PNG générés en pleine résolution).
 * Les servir tels quels pour une pastille de 34 px était la cause principale de la
 * lenteur ressentie. Mesuré sur `sauces/harissa.png` (1 336 ko) :
 *   68 px  →  7 ko en PNG, **868 octets en WebP**
 *   800 px →  751 ko en PNG, **40 ko en WebP**
 * Le WebP n'est servi que si le client l'annonce dans `Accept` : c'est le cas d'
 * `expo-image` (SDWebImage / Glide), pas du composant `Image` de React Native — d'où
 * la bascule vers `expo-image` partout où une image distante est affichée.
 *
 * Renvoie l'URL d'origine si ce n'est pas une URL Storage publique.
 */
export function imageUrl(
  url: string | null | undefined,
  width: number,
  height: number,
): string | undefined {
  if (!url) return undefined;
  const marker = '/storage/v1/object/public/';
  const i = url.indexOf(marker);
  if (i < 0) return url;
  const base = url.slice(0, i);
  const path = url.slice(i + marker.length);
  // ×2 pour la densité écran (retina). Au-delà de 2 l'œil ne fait plus la différence
  // et le poids repart à la hausse.
  const w = Math.round(width * 2);
  const h = Math.round(height * 2);
  return `${base}/storage/v1/render/image/public/${path}?width=${w}&height=${h}&resize=cover&quality=75`;
}

/** Raccourci carré, cas de loin le plus fréquent (vignettes, logos, pastilles). */
export function thumbnailUrl(url: string | null | undefined, size: number): string | undefined {
  return imageUrl(url, size, size);
}

export type Category = {
  id: string;
  restaurantId: string;
  name: string;
  icon?: string | null; // emoji de la catégorie (ex. 🍕)
  sortOrder: number;
};

/** Tag de catégorie affiché sur la carte restaurant (emoji + nom). */
export type CategoryTag = { name: string; icon: string | null };

export type Restaurant = {
  id: string;
  name: string;
  initials: string; // dérivé du nom
  logoUrl?: string | null; // logo du restaurant (Supabase Storage), null si absent
  coverUrl?: string | null; // bannière du restaurant, null si absente
  cuisineType: string;
  zone: string; // = zone_served
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  hoursLabel: string; // dérivé de opens_at/closes_at
  etaLabel: string; // cosmétique (non stocké) — placeholder
  deliveryFee: number; // ariary
  minOrder: number; // ariary
  foodTypes: string[]; // types de plats proposés (ex. ['Tacos','Kebab','Burger']) — filtre accueil
  categoryTags: CategoryTag[]; // catégories ACTIVES du resto (emoji + nom) — tags de la carte
  popular?: boolean; // non stocké — toujours false pour l'instant
  closedLabel?: string; // dérivé si fermé
};

/** Ordre d'affichage préféré des filtres de type de plat sur l'accueil. */
export const FOOD_TYPE_ORDER = [
  'Pizza',
  'Tacos',
  'Kebab',
  'Burger',
  'Américain',
  'Panini',
  'Crêpe',
  'Milkshake',
  'Tapas',
];

export type Address = {
  id: string;
  label: string;
  zone: string;
  landmark: string;
  phone: string;
  instructions?: string;
  isDefault: boolean;
  icon: 'home' | 'work' | 'location_on';
  // Position GPS (obligatoire pour commander — pas d'adressage postal à Nosy Be).
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * Lien d'itinéraire Maps (ouvre l'app Maps native, calcul d'itinéraire automatique).
 * Aucune clé API requise. Pour un futur écran livreur / back-office.
 */
export function getMapsNavigationUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export type OrderItemSnapshot = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  photoUrl?: string | null;
  options?: { optionId: string | null; name: string; priceDelta: number; quantity: number }[];
};

export type Order = {
  id: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  restaurantInitials: string;
  restaurantLogoUrl?: string | null;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  addressLabel: string;
  addressDetail: string;
  createdLabel: string;
  etaLabel?: string;
  /** Motif de refus (rempli quand status = annulee), visible côté client et resto. */
  cancellationReason?: string | null;
  /** Lien d'itinéraire Google Maps vers la position du client (null si pas de GPS). */
  mapsUrl?: string | null;
  /** Téléphone du client sur l'adresse de livraison (pour le restaurant/livreur). */
  clientPhone?: string | null;
  /** Livreur ayant pris la commande (null tant qu'aucun livreur ne l'a prise). */
  courierId?: string | null;
  /** true dès que le livreur a récupéré la commande au restaurant (picked_up_at non nul). */
  pickedUp?: boolean;
  /** Nom/téléphone du livreur assigné (visible côté restaurant et client). */
  courierName?: string | null;
  courierPhone?: string | null;
};

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

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

/** ETA de livraison — non stocké en base au MVP, placeholder cosmétique. */
export const DEFAULT_ETA = '25–40 min';

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

/*
 * Ces trois helpers lisent la traduction courante via le singleton i18next plutôt que de
 * prendre `t` en paramètre : ils sont appelés depuis une quinzaine d'endroits, dont des
 * fonctions non-composants. Les écrans qui les affichent s'abonnent à `useTranslation()`,
 * donc un changement de langue les re-rend et les libellés suivent.
 */

export const paymentLabel = (m: PaymentMethod): string => i18n.t(`payment.${m}`);

export const paymentShort = (m: PaymentMethod): string => i18n.t(`payment.${m}Short`);

export const statusLabel = (s: OrderStatus): string => i18n.t(`status.${s}`);

/** Index 0..4 de l'étape de suivi pour un statut donné. */
export const statusStep = (s: OrderStatus): number =>
  ({ recue: 0, confirmee: 1, en_preparation: 2, en_livraison: 3, livree: 4, annulee: 0 })[s];

/**
 * Ligne d'adresse affichable : « quartier — adresse précise ».
 *
 * Les deux champs ont longtemps reçu la même valeur (la zone administrative déduite du
 * GPS), ce qui affichait « Province d'Antsiranana — Province d'Antsiranana » à la
 * validation de commande. On déduplique ici pour que les adresses déjà enregistrées
 * s'affichent proprement, sans migration de données.
 */
export function formatAddressLine(zone: string, label?: string | null): string {
  const precise = (label ?? '').split('—').pop()?.trim() ?? '';
  const z = zone.trim();
  if (!precise) return z;
  if (!z) return precise;
  if (precise.toLowerCase() === z.toLowerCase()) return z;
  return `${z} — ${precise}`;
}

/** Initiales à partir d'un nom : première lettre du 1er et du dernier mot. « Tacos du Boulevard » → « TB ». */
export function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '--';
  const first = words[0][0];
  const last = words[words.length - 1][0];
  return (first + (words.length > 1 ? last : '')).toUpperCase();
}

/** Formate une heure « 22:30:00 » en « 22h30 » (minutes omises si 00). */
export function formatTime(t: string | null | undefined): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return m && m !== '00' ? `${Number(h)}h${m}` : `${Number(h)}h`;
}

/**
 * Plage horaire lisible : « 11h – 22h30 ».
 *
 * Renvoie une chaîne **vide** si l'une des deux bornes manque : les trois restaurants n'ont
 * pas encore d'horaires en base, et le gabarit produisait alors un tiret solitaire à côté
 * d'une icône d'horloge — lisible comme un défaut d'affichage, pas comme une absence
 * d'information. L'appelant doit masquer l'élément quand la chaîne est vide.
 */
export function hoursLabel(opensAt: string, closesAt: string): string {
  if (!opensAt || !closesAt) return '';
  return `${formatTime(opensAt)} – ${formatTime(closesAt)}`;
}

/** Date ISO → libellé court « Aujourd'hui 09h52 » / « 6 août · 19h40 ». */
export function createdLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) return `Aujourd'hui ${hh}h${mm}`;
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d.getDate()} ${mois[d.getMonth()]} · ${hh}h${mm}`;
}

/** Icône d'adresse dérivée du libellé. */
export function addressIcon(label: string | null | undefined): Address['icon'] {
  const l = (label ?? '').toLowerCase();
  if (l.includes('maison') || l.includes('villa') || l.includes('home')) return 'home';
  if (l.includes('bureau') || l.includes('travail') || l.includes('work')) return 'work';
  return 'location_on';
}
