/**
 * Ce que chaque « hôte » du module DistriPro lui fournit :
 *  - l'identité (pont Taxi Food dans l'app, compte DistriPro sur le site) ;
 *  - les chemins de navigation (les routes ne sont pas les mêmes dans l'app,
 *    où le module vit dans l'espace partenaire, et sur distripro207.com).
 */
import { createContext, ReactNode, useContext } from 'react';
import type { Identite } from './api';

export type LiensDP = {
  catalogue: string;
  panier: string;
  commandes: string;
  commande: (numero: string) => string;
  /** « Ma liste conseillée » (app seulement : elle repose sur les ventes Taxi Food). */
  conseil?: string;
  /** Connexion (site seulement) ; absent dans l'app : la session Taxi Food suffit. */
  connexion?: string;
};

type ContexteDP = { identite: Identite; liens: LiensDP; dansTaxiFood: boolean };

const Ctx = createContext<ContexteDP | null>(null);

export function DistriproProvider({ valeur, children }: { valeur: ContexteDP; children: ReactNode }) {
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useDistripro(): ContexteDP {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDistripro hors de DistriproProvider');
  return v;
}

/** Couleurs DistriPro (charte du site : vert forêt + cobalt). La bascule d'univers se voit. */
export const dp = {
  foret: '#1A3B31',
  foretClair: '#2B6B45',
  menthe: '#E6F3EC',
  cobalt: '#2C6BF2',
  cobaltClair: '#EEF3FE',
  papier: '#FAFAF9',
  encre: '#13231E',
  gris: '#6B7280',
  bord: '#E3E7E5',
  ambre: '#B4620A',
  ambreFond: '#FFF3E2',
  rouge: '#C42419',
  rougeFond: '#FDECEB',
  blanc: '#FFFFFF',
} as const;
