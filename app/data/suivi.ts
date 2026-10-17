/**
 * Suivi du livreur côté client (2026-10-17). Une seule porte en base : `suivi_livreur`,
 * qui vérifie que la commande est bien à l'appelant, qu'elle est en livraison avec un
 * livreur, et ne rend rien après la livraison. Aucun appel Google : position et trace
 * viennent de notre base, la carte est gratuite.
 */
import { supabase } from '../lib/supabase';

export type PointSuivi = { lat: number; lng: number };

export type SuiviLivreur = {
  suivi: true;
  phase: 'vers_restaurant' | 'vers_toi' | 'arrive' | 'devant_chez_toi';
  livreur: string | null;
  position: (PointSuivi & { precision: number | null; le: string; age_s: number }) | null;
  /** Chemin parcouru depuis la prise : [lat, lng][] (vide si tournée multi-clients). */
  trace: [number, number][];
  autresCommandes: number;
  restaurant: PointSuivi | null;
  client: PointSuivi | null;
  kmRestants: number | null;
  etaMin: number | null;
  /** Heure du serveur, pour calculer l'âge sans dépendre de l'horloge du téléphone. */
  recuLe: number;
};

export type PasDeSuivi = { suivi: false; raison: string };

export async function getSuiviLivreur(orderId: string): Promise<SuiviLivreur | PasDeSuivi> {
  const { data, error } = await supabase.rpc('suivi_livreur', { p_order_id: orderId });
  if (error) throw error;
  const d = data as Record<string, unknown>;
  if (!d || d.suivi !== true) return { suivi: false, raison: String(d?.raison ?? 'inconnu') };
  return {
    suivi: true,
    phase: d.phase as SuiviLivreur['phase'],
    livreur: (d.livreur as string | null) ?? null,
    position: (d.position as SuiviLivreur['position']) ?? null,
    trace: Array.isArray(d.trace) ? (d.trace as [number, number][]) : [],
    autresCommandes: Number(d.autres_commandes ?? 0),
    restaurant: (d.restaurant as PointSuivi | null) ?? null,
    client: (d.client as PointSuivi | null) ?? null,
    kmRestants: d.km_restants != null ? Number(d.km_restants) : null,
    etaMin: d.eta_min != null ? Number(d.eta_min) : null,
    recuLe: Date.now(),
  };
}
