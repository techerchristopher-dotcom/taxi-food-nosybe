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
  tags?: string[]; // cosmétique — non stocké en base
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
  initials: string; // dérivé du nom
  cuisineType: string;
  zone: string; // = zone_served
  isOpen: boolean;
  opensAt: string;
  closesAt: string;
  hoursLabel: string; // dérivé de opens_at/closes_at
  etaLabel: string; // cosmétique (non stocké) — placeholder
  deliveryFee: number; // ariary
  minOrder: number; // ariary
  popular?: boolean; // non stocké — toujours false pour l'instant
  closedLabel?: string; // dérivé si fermé
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
  createdLabel: string;
  etaLabel?: string;
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

/** Plage horaire lisible : « 11h – 22h30 ». */
export function hoursLabel(opensAt: string, closesAt: string): string {
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
