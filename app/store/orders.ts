/**
 * Commandes (zustand). Alimenté au départ par l'historique mock, puis enrichi par les
 * commandes créées dans la session (validation du panier). Sert au suivi, à l'historique
 * et à la fonction « Recommander ».
 *
 * Le numéro de commande est généré localement (TF-####) — côté backend ce sera une séquence
 * Postgres (voir SCHEMA-TAXI-FOOD.md, règle order_number).
 */
import { create } from 'zustand';
import {
  mockOrders,
  Order,
  OrderItemSnapshot,
  PaymentMethod,
} from '../data/mock';
import type { CartLine } from './cart';

let counter = 2419; // suit le dernier numéro de démo (TF-2418)

type NewOrderInput = {
  restaurantId: string;
  restaurantName: string;
  restaurantInitials: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  addressLabel: string;
  addressDetail: string;
  etaLabel?: string;
};

type OrdersState = {
  orders: Order[];
  create: (input: NewOrderInput) => Order;
  getById: (id: string) => Order | undefined;
};

export const useOrders = create<OrdersState>((set, get) => ({
  orders: mockOrders,

  create: (input) => {
    const number = counter++;
    const items: OrderItemSnapshot[] = input.lines.map((l) => ({
      productId: l.product.id,
      name: l.product.name,
      quantity: l.quantity,
      unitPrice: l.product.price,
      comment: l.comment,
    }));
    const order: Order = {
      id: `o-${number}`,
      orderNumber: `TF-${number}`,
      restaurantId: input.restaurantId,
      restaurantName: input.restaurantName,
      restaurantInitials: input.restaurantInitials,
      items,
      subtotal: input.subtotal,
      deliveryFee: input.deliveryFee,
      total: input.total,
      paymentMethod: input.paymentMethod,
      status: 'recue',
      addressLabel: input.addressLabel,
      addressDetail: input.addressDetail,
      createdLabel: "À l'instant",
      etaLabel: input.etaLabel,
    };
    set({ orders: [order, ...get().orders] });
    return order;
  },

  getById: (id) => get().orders.find((o) => o.id === id),
}));
