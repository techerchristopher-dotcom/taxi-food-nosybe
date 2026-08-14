/**
 * Compteur des commandes « en attente d'action » du restaurant (recue/confirmee/
 * en_preparation). Alimenté par l'écran « Commandes en cours » à chaque chargement
 * (polling inclus) ; lu par le layout d'onglets pour afficher le badge — pas de polling
 * séparé.
 */
import { create } from 'zustand';

type RestaurantQueueState = {
  activeCount: number;
  setActiveCount: (n: number) => void;
};

export const useRestaurantQueue = create<RestaurantQueueState>((set) => ({
  activeCount: 0,
  setActiveCount: (n) => set({ activeCount: n }),
}));
