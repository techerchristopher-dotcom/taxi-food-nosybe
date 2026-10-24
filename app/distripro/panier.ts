/**
 * Panier DistriPro — SÉPARÉ du panier client Taxi Food (exigence A5) : autre store,
 * autre clé de stockage. Un restaurateur qui est aussi client ne mélange jamais
 * une commande fournisseur et une commande de repas.
 *
 * Le panier ne garde que de quoi AFFICHER (nom, prix indicatif, règles de quantité) ;
 * le prix et la disponibilité qui font foi sont relus par `creer_commande`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ProduitDP } from './api';

const CLE = 'tf_distripro_panier_v1';

export type LignePanierDP = {
  produitId: number;
  quantite: number;
  nom: string;
  prix: number;
  unite: string | null;
  qteMin: number;
  pas: number;
  stock: number | null;
};

type Etat = {
  lignes: LignePanierDP[];
  charge: boolean;
  charger: () => Promise<void>;
  quantite: (produitId: number) => number;
  /** +1 pas ; au premier ajout, la quantité minimale. */
  ajouter: (p: ProduitDP) => void;
  /** -1 pas ; sous le minimum, la ligne disparaît. */
  retirer: (produitId: number) => void;
  supprimer: (produitId: number) => void;
  vider: () => void;
  /** Resynchronise prix et règles avec le catalogue relu (prix changé en base). */
  rafraichir: (produits: ProduitDP[]) => void;
};

function sauver(lignes: LignePanierDP[]) {
  AsyncStorage.setItem(CLE, JSON.stringify(lignes)).catch(() => {});
}

export const usePanierDP = create<Etat>((set, get) => ({
  lignes: [],
  charge: false,
  async charger() {
    if (get().charge) return;
    try {
      const brut = await AsyncStorage.getItem(CLE);
      set({ lignes: brut ? (JSON.parse(brut) as LignePanierDP[]) : [], charge: true });
    } catch {
      set({ charge: true });
    }
  },
  quantite(produitId) {
    return get().lignes.find((l) => l.produitId === produitId)?.quantite ?? 0;
  },
  ajouter(p) {
    const lignes = [...get().lignes];
    const i = lignes.findIndex((l) => l.produitId === p.id);
    if (i < 0) {
      lignes.push({
        produitId: p.id, quantite: Math.max(p.qteMin, p.pas), nom: p.nom, prix: p.prix,
        unite: p.unite, qteMin: p.qteMin, pas: p.pas, stock: p.stock,
      });
    } else {
      const suivante = lignes[i].quantite + p.pas;
      if (p.stock !== null && suivante > p.stock) return;
      lignes[i] = { ...lignes[i], quantite: suivante };
    }
    set({ lignes });
    sauver(lignes);
  },
  retirer(produitId) {
    const lignes = get()
      .lignes.map((l) => (l.produitId === produitId ? { ...l, quantite: l.quantite - l.pas } : l))
      .filter((l) => l.quantite >= l.qteMin && l.quantite > 0);
    set({ lignes });
    sauver(lignes);
  },
  supprimer(produitId) {
    const lignes = get().lignes.filter((l) => l.produitId !== produitId);
    set({ lignes });
    sauver(lignes);
  },
  vider() {
    set({ lignes: [] });
    sauver([]);
  },
  rafraichir(produits) {
    const parId = new Map(produits.map((p) => [p.id, p]));
    const lignes = get().lignes.map((l) => {
      const p = parId.get(l.produitId);
      return p ? { ...l, nom: p.nom, prix: p.prix, unite: p.unite, qteMin: p.qteMin, pas: p.pas, stock: p.stock } : l;
    });
    set({ lignes });
    sauver(lignes);
  },
}));

export function totalIndicatif(lignes: LignePanierDP[]): number {
  return lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
}
