/**
 * État léger de la validation de commande : adresse choisie + mode de paiement.
 * Volontairement en mémoire (le tunnel de commande est court).
 * L'adresse sélectionnée (addressId) est un vrai id de la table `addresses`.
 */
import { create } from 'zustand';
import { PaymentMethod } from '../data/types';

type CheckoutState = {
  addressId: string | null;
  paymentMethod: PaymentMethod;
  setAddress: (id: string) => void;
  setPayment: (m: PaymentMethod) => void;
};

export const useCheckout = create<CheckoutState>((set) => ({
  addressId: null,
  paymentMethod: 'especes',
  setAddress: (id) => set({ addressId: id }),
  setPayment: (m) => set({ paymentMethod: m }),
}));
