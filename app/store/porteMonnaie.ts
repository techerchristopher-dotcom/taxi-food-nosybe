/**
 * Porte-monnaie au récapitulatif (2026-10-07).
 *
 * L'écran n'est jamais l'autorité : `create_order` relit le solde et calcule la
 * remise elle-même (plats seulement, après un code qui porte sur les plats). Ce
 * store ne garde que deux choses :
 *  - le CHOIX du client (« Utiliser mon porte-monnaie »), activé par défaut ;
 *  - l'APERÇU calculé par la base (`apercu_porte_monnaie`) pour le panier, le
 *    restaurant et le code courants. Une entrée qui change périme l'aperçu :
 *    jamais un montant hérité à l'écran (même règle que `store/promo.ts`).
 *
 * Échec réseau → remise affichée 0 : on peut facturer moins qu'annoncé, jamais plus.
 */
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { apercuPorteMonnaie } from '../data/api';
import { useCart } from './cart';
import { lignesCommande } from './promo';
import { useSession } from './session';

type Apercu = { cle: string; solde: number; remise: number };

type State = {
  utiliser: boolean;
  apercu: Apercu | null;
  setUtiliser: (v: boolean) => void;
  charger: (cle: string, f: () => Promise<{ solde: number; remise: number }>) => Promise<void>;
};

let enVol: string | null = null;

export const usePorteMonnaieStore = create<State>((set, get) => ({
  utiliser: true,
  apercu: null,
  setUtiliser: (v) => set({ utiliser: v }),
  charger: async (cle, f) => {
    if (enVol === cle || get().apercu?.cle === cle) return;
    enVol = cle;
    try {
      const r = await f();
      set({ apercu: { cle, solde: r.solde, remise: r.remise } });
    } catch {
      set({ apercu: { cle, solde: 0, remise: 0 } });
    } finally {
      if (enVol === cle) enVol = null;
    }
  },
}));

export type PorteMonnaieRecap = {
  /** Solde actuel (0 tant que la base n'a pas répondu). */
  solde: number;
  /** Ce que le porte-monnaie couvrirait sur ce panier. */
  remisePossible: number;
  /** Ce qui est réellement déduit à l'écran : `remisePossible` si la bascule est active. */
  remise: number;
  utiliser: boolean;
  setUtiliser: (v: boolean) => void;
};

/** @param codePromo le code qui part à `create_order` (`promo.aEnvoyer`). */
export function usePorteMonnaie(codePromo: string | null): PorteMonnaieRecap {
  const userId = useSession((s) => s.session?.userId ?? null);
  const restaurantId = useCart((s) => s.restaurantId);
  const lines = useCart((s) => s.lines);
  const lignes = useMemo(() => lignesCommande(lines), [lines]);

  const cle = useMemo(
    () => [userId ?? '', restaurantId ?? '', codePromo ?? '', JSON.stringify(lignes)].join('|'),
    [userId, restaurantId, codePromo, lignes],
  );

  const utiliser = usePorteMonnaieStore((s) => s.utiliser);
  const setUtiliser = usePorteMonnaieStore((s) => s.setUtiliser);
  const apercu = usePorteMonnaieStore((s) => s.apercu);
  const charger = usePorteMonnaieStore((s) => s.charger);

  useEffect(() => {
    if (!userId || !restaurantId || lignes.length === 0) return;
    void charger(cle, () => apercuPorteMonnaie(restaurantId, lignes, codePromo));
  }, [cle, userId, restaurantId, lignes, codePromo, charger]);

  const aJour = apercu && apercu.cle === cle ? apercu : null;
  const solde = aJour?.solde ?? 0;
  const remisePossible = aJour?.remise ?? 0;
  return {
    solde,
    remisePossible,
    remise: utiliser ? remisePossible : 0,
    utiliser,
    setUtiliser,
  };
}

/** Après une commande ou un avis, le solde a bougé : on oublie l'aperçu. */
export function oublierApercuPorteMonnaie() {
  usePorteMonnaieStore.setState({ apercu: null });
}
