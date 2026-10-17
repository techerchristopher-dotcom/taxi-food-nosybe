/**
 * Paiement Orange Money EN LIGNE (API WebPay) — couche données.
 *
 * Deux appels à la fonction Edge `paiement-orange-money` :
 *   - `creer`    : ouvre (ou reprend) un paiement et rend la page de paiement Orange ;
 *   - `verifier` : redemande à Orange où en est le paiement, et rend le verdict en base.
 *
 * ⚠️ L'APP NE DÉCIDE JAMAIS QU'UNE COMMANDE EST PAYÉE. Le retour du navigateur ne
 * prouve rien : seul le serveur, qui interroge Orange, écrit le paiement, et
 * `orders.payment_status` en est déduit par un trigger. On ne fait que le lire.
 * ⚠️ AUCUN MONTANT N'EST ENVOYÉ : la fonction relit `orders.total`.
 * Référence : docs/PAIEMENT-ORANGE-MONEY.md.
 */
import { supabase } from '../lib/supabase';
import { StatutPaiement } from './types';

export type MotifEchecOM =
  | 'authentification_requise'
  | 'commande_introuvable'
  | 'methode_non_orange_money'
  | 'deja_payee'
  | 'commande_non_payable'
  | 'montant_invalide'
  | 'paiement_non_configure'
  | 'orange_money_inactif'
  | 'paiement_en_cours'
  | 'orange_indisponible'
  | 'erreur_serveur'
  | 'reseau'
  | 'inconnu';

const MOTIFS = new Set<string>([
  'authentification_requise',
  'commande_introuvable',
  'methode_non_orange_money',
  'deja_payee',
  'commande_non_payable',
  'montant_invalide',
  'paiement_non_configure',
  'orange_money_inactif',
  'paiement_en_cours',
  'orange_indisponible',
  'erreur_serveur',
]);

export class ErreurPaiementOM extends Error {
  motif: MotifEchecOM;
  reference?: string;
  constructor(motif: MotifEchecOM, reference?: string) {
    super(motif);
    this.name = 'ErreurPaiementOM';
    this.motif = motif;
    this.reference = reference;
  }
}

export type PaiementOM = {
  /** Page de paiement Orange, à ouvrir dans le navigateur. Valable 10 minutes. */
  paymentUrl: string;
  expireLe: string | null;
  /** Montant envoyé à Orange (plafonné en bac à sable). */
  montant: number;
  /** `MGA` en production, `OUV` dans le bac à sable d'Orange. */
  devise: string;
  reference: string | null;
};

async function appeler(corps: Record<string, unknown>): Promise<unknown> {
  let data: unknown;
  let error: unknown;
  try {
    const r = await supabase.functions.invoke('paiement-orange-money', { body: corps });
    data = r.data;
    error = r.error;
  } catch {
    throw new ErreurPaiementOM('reseau');
  }
  if (error) {
    const contexte = (error as { context?: Response }).context;
    const statut = typeof contexte?.status === 'number' ? contexte.status : 0;
    if (!statut) throw new ErreurPaiementOM('reseau');
    let c: { erreur?: string; reference?: string } | null = null;
    try {
      c = contexte ? await contexte.clone().json() : null;
    } catch {
      c = null;
    }
    const brut = c?.erreur ?? '';
    let motif = (MOTIFS.has(brut) ? brut : 'inconnu') as MotifEchecOM;
    if (motif === 'inconnu' && statut >= 500) motif = 'erreur_serveur';
    throw new ErreurPaiementOM(motif, c?.reference);
  }
  return data;
}

/** Ouvre (ou reprend) le paiement Orange Money d'une commande déjà créée. */
export async function creerPaiementOM(orderId: string, web: boolean): Promise<PaiementOM> {
  const r = (await appeler({ action: 'creer', order_id: orderId, web })) as {
    payment_url?: string;
    expire_le?: string | null;
    montant?: number;
    devise?: string;
    reference?: string;
  } | null;
  if (!r?.payment_url) throw new ErreurPaiementOM('erreur_serveur');
  return {
    paymentUrl: r.payment_url,
    expireLe: r.expire_le ?? null,
    montant: Number(r.montant ?? 0),
    devise: r.devise ?? 'MGA',
    reference: r.reference ?? null,
  };
}

/** Demande au serveur de revérifier auprès d'Orange ; rend le statut de paiement en base. */
export async function verifierPaiementOM(orderId: string): Promise<{
  paymentStatus: StatutPaiement | null;
  statutCommande: string | null;
}> {
  const r = (await appeler({ action: 'verifier', order_id: orderId })) as {
    payment_status?: StatutPaiement | null;
    statut_commande?: string | null;
  } | null;
  return { paymentStatus: r?.payment_status ?? null, statutCommande: r?.statut_commande ?? null };
}
