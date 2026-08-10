/**
 * État léger de la validation de commande : adresse choisie + mode de paiement.
 * Volontairement en mémoire (le tunnel de commande est court).
 */
import { create } from 'zustand';
import { mockAddresses, PaymentMethod } from '../data/mock';

const defaultAddress = mockAddresses.find((a) => a.isDefault) ?? mockAddresses[0];

type CheckoutState = {
  addressId: string;
  paymentMethod: PaymentMethod;
  setAddress: (id: string) => void;
  setPayment: (m: PaymentMethod) => void;
};

export const useCheckout = create<CheckoutState>((set) => ({
  addressId: defaultAddress?.id ?? '',
  paymentMethod: 'especes',
  setAddress: (id) => set({ addressId: id }),
  setPayment: (m) => set({ paymentMethod: m }),
}));
