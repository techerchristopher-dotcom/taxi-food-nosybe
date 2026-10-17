/**
 * Petits outils de l'app livreur : position des restaurants, liens de navigation,
 * récapitulatif du jour.
 */
import { Linking, Platform } from 'react-native';
import { supabase } from '../supabase';
import type { Order } from '../../data/types';

export type Point = { lat: number; lng: number };

/** Position des restaurants (colonnes publiques). Ceux sans position sont absents. */
export async function positionsRestaurants(ids: string[]): Promise<Record<string, Point>> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (!uniques.length) return {};
  const { data } = await supabase.from('restaurants').select('id, latitude, longitude').in('id', uniques);
  const out: Record<string, Point> = {};
  for (const r of (data ?? []) as { id: string; latitude: number | null; longitude: number | null }[]) {
    if (r.latitude != null && r.longitude != null) out[r.id] = { lat: r.latitude, lng: r.longitude };
  }
  return out;
}

/** Coordonnées du client lues dans le lien GPS déjà calculé par `mapOrder`. */
export function positionClient(order: Order): Point | null {
  const m = order.mapsUrl?.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

/**
 * Ouvre la navigation vers un point. Google Maps (application si installée, sinon
 * navigateur) : c'est ce que les livreurs de Nosy Be utilisent. Sur iPhone sans Google
 * Maps, le lien s'ouvre dans Plans via le navigateur.
 */
export function naviguerVers(p: Point): void {
  const dest = `${p.lat},${p.lng}`;
  const url =
    Platform.OS === 'android'
      ? `google.navigation:q=${dest}&mode=l`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=two-wheeler`;
  Linking.openURL(url).catch(() =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`).catch(() => {}),
  );
}

/** Le jour local de Nosy Be (AAAA-MM-JJ) d'une date. */
function jourNosyBe(iso: string | Date): string {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'Indian/Antananarivo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(typeof iso === 'string' ? new Date(iso) : iso);
  } catch {
    return (typeof iso === 'string' ? iso : iso.toISOString()).slice(0, 10);
  }
}

export type RecapJour = {
  livraisons: number;
  especes: number;
  especesCommandes: number;
  orangeMoney: number;
  orangeMoneyCommandes: number;
  carte: number;
};

/** Ce que le livreur a fait aujourd'hui, et l'argent liquide qu'il a sur lui. */
export function recapDuJour(livrees: Order[], maintenant = new Date()): RecapJour {
  const jour = jourNosyBe(maintenant);
  const r: RecapJour = { livraisons: 0, especes: 0, especesCommandes: 0, orangeMoney: 0, orangeMoneyCommandes: 0, carte: 0 };
  for (const o of livrees) {
    const quand = o.deliveredAt ?? o.createdAt;
    if (!quand || jourNosyBe(quand) !== jour) continue;
    r.livraisons += 1;
    if (o.paymentStatus === 'paye') r.carte += 1;
    else if (o.paymentMethod === 'orange_money') {
      r.orangeMoney += o.total;
      r.orangeMoneyCommandes += 1;
    } else if (o.paymentMethod === 'especes') {
      r.especes += o.total;
      r.especesCommandes += 1;
    }
  }
  return r;
}
