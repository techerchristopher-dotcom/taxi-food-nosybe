/**
 * Le module DistriPro tel qu'il vit DANS l'app Taxi Food (espace partenaire) :
 * identité = la session Taxi Food via la fonction Edge `distripro` (le pont),
 * restaurant = le restaurant actif du sélecteur.
 */
import { ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../store/session';
import { identitePont } from './api';
import { DistriproProvider } from './contexte';

export const LIENS_TAXIFOOD = {
  catalogue: '/(restaurant)/commander',
  panier: '/(restaurant)/commander-panier',
  commandes: '/(restaurant)/commander-commandes',
  commande: (numero: string) => `/(restaurant)/commander-commande?numero=${encodeURIComponent(numero)}`,
};

export function DistriproTaxiFood({ children }: { children: ReactNode }) {
  const identite = useMemo(
    () =>
      identitePont(
        (body) => supabase.functions.invoke('distripro', { body }),
        () => useSession.getState().session?.restaurantId ?? null,
      ),
    [],
  );
  return (
    <DistriproProvider valeur={{ identite, liens: LIENS_TAXIFOOD, dansTaxiFood: true }}>
      {children}
    </DistriproProvider>
  );
}
