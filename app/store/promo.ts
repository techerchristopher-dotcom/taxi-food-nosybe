/**
 * Code promo — vérification partagée par le panier et le récapitulatif.
 *
 * POURQUOI ici et pas dans un `useState` d'écran : le code se saisit au PANIER,
 * au moment où le client découvre les frais de livraison (c'est là qu'il décide
 * de partir ou de continuer), et il doit encore être là au récapitulatif — deux
 * écrans, une connexion et un écran d'adresse plus loin. Un état d'écran ne
 * survit pas à ce trajet : `/address` fait `router.replace('/login')` quand il
 * n'y a pas de compte, et le panier est démonté au passage.
 *
 * Deux morceaux, deux durées de vie :
 *  - le CODE SAISI vit avec le panier (`store/cart.ts`, persisté dans
 *    AsyncStorage) : il disparaît quand le panier disparaît, jamais avant ;
 *  - la VÉRIFICATION vit ici, en mémoire, et porte les ENTRÉES sur lesquelles
 *    elle a été faite (code, restaurant, compte, sous-total). Dès qu'une de ces
 *    entrées change, le résultat est périmé : la remise affichée retombe à zéro
 *    le temps d'un nouvel aller-retour. Jamais de montant périmé à l'écran.
 *
 * ⚠️ Ce qui s'affiche avant validation est un APERÇU. Le montant qui fait foi est
 * celui que `create_order` recalcule en base — c'est elle qui relit le barème et
 * les frais de livraison, et c'est elle qui consomme le code. Si les deux
 * divergent, c'est l'aperçu qui a tort.
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { RaisonPromo, verifierCodePromo } from '../data/api';
import { useCart } from './cart';
import { useSession } from './session';

/** Raisons de refus de la base, plus l'échec réseau qui n'en vient pas. */
export type MotifPromo = RaisonPromo | 'reseau';

/** Ce sur quoi une vérification a été faite. Changez-en une, elle est périmée. */
type Entrees = {
  code: string;
  restaurantId: string;
  /** null = visiteur non connecté (la base répond alors `non_connecte`). */
  userId: string | null;
  sousTotal: number;
};

type Resultat = Entrees & {
  /** null quand le code a été refusé : on ne sait alors pas sur quoi il portait. */
  porteSur: 'livraison' | 'sous_total' | null;
  remise: number;
  raison: MotifPromo | null;
};

/**
 * Un résultat est-il périmé pour les entrées courantes ?
 *
 * Le sous-total n'est comparé que pour un code qui porte DESSUS : la remise d'un
 * code « livraison » est calculée sur `restaurants.delivery_fee` relu en base et
 * ne bouge pas d'un iota quand on ajoute une bière au panier. Sans cette nuance,
 * chaque tap sur [+] déclencherait un aller-retour réseau pour rien — sur la
 * liaison de Nosy Be, ça se voit.
 */
function perime(r: Resultat | null, e: Entrees): boolean {
  if (!r) return true;
  if (r.code !== e.code || r.restaurantId !== e.restaurantId || r.userId !== e.userId) return true;
  return r.porteSur === 'sous_total' && r.sousTotal !== e.sousTotal;
}

type PromoState = {
  resultat: Resultat | null;
  enCours: boolean;
  verifier: (e: Entrees) => Promise<void>;
  /**
   * Refus prononcé par `create_order` au moment de valider (plafond atteint,
   * code consommé entre-temps depuis un autre appareil). On garde l'identité du
   * résultat courant et on n'en change que le verdict.
   */
  marquerRefus: (raison: MotifPromo) => void;
  oublier: () => void;
};

/**
 * Garde anti-double-appel, hors du store à dessein.
 *
 * Le panier reste monté sous le récapitulatif dans la pile de navigation : les
 * deux écrans montent le hook, et leurs deux effets partent dans le même cycle,
 * avant le moindre re-rendu — un drapeau lu depuis le store vaudrait encore
 * `false` pour le second. Cette variable de module, elle, est écrite et relue
 * dans le même tour de boucle.
 */
let enVol: string | null = null;

const signature = (e: Entrees) => [e.code, e.restaurantId, e.userId ?? '', e.sousTotal].join('|');

export const usePromoStore = create<PromoState>((set) => ({
  resultat: null,
  enCours: false,

  verifier: async (e) => {
    const sig = signature(e);
    if (enVol === sig) return;
    enVol = sig;
    set({ enCours: true });
    try {
      const r = await verifierCodePromo(e.code, e.restaurantId, e.sousTotal);
      set({
        resultat: r.valide
          ? { ...e, code: r.code, porteSur: r.porteSur, remise: r.remise, raison: null }
          : { ...e, porteSur: null, remise: 0, raison: r.raison },
      });
      // La base renvoie le code NORMALISÉ (majuscules, sans espaces) : on aligne
      // le panier dessus, sinon la prochaine vérification porterait sur une autre
      // chaîne que celle qu'on vient de valider et repartirait pour un tour.
      if (r.valide && r.code !== e.code) useCart.getState().setPromoCode(r.code);
    } catch {
      set({ resultat: { ...e, porteSur: null, remise: 0, raison: 'reseau' } });
    } finally {
      enVol = null;
      set({ enCours: false });
    }
  },

  marquerRefus: (raison) =>
    set((s) => ({ resultat: s.resultat ? { ...s.resultat, remise: 0, raison } : s.resultat })),

  oublier: () => set({ resultat: null }),
}));

export type Promo = {
  /** Code retenu, tel qu'il sera envoyé à `create_order`. null = aucun. */
  code: string | null;
  /** Remise en ariary, 0 tant que la base ne l'a pas confirmée POUR CES ENTRÉES. */
  remise: number;
  /** true quand la base a validé le code : seul cas où on l'envoie à la commande. */
  valide: boolean;
  /** Raison du refus, ou null. `non_connecte` n'est pas un refus, voir ci-dessous. */
  raison: MotifPromo | null;
  /**
   * Le visiteur n'a pas de compte : la base ne peut pas se prononcer (elle ne
   * sait pas s'il a déjà utilisé le code). Le code est GARDÉ et revérifié tout
   * seul à la connexion — on lui dit ça, pas « code invalide ».
   */
  enAttenteConnexion: boolean;
  enCours: boolean;
  appliquer: (saisi: string) => void;
  retirer: () => void;
};

/**
 * Le code promo vu par un écran du tunnel : le code retenu, la remise confirmée
 * pour l'état courant du panier, et de quoi le poser ou le retirer.
 *
 * C'est ce hook qui redéclenche la vérification quand une entrée change —
 * connexion, changement de restaurant, sous-total pour un code qui en dépend.
 */
export function usePromo(): Promo {
  const code = useCart((s) => s.promoCode);
  const restaurantId = useCart((s) => s.restaurantId);
  const sousTotal = useCart((s) => s.subtotal());
  const setPromoCode = useCart((s) => s.setPromoCode);
  const userId = useSession((s) => s.session?.userId ?? null);

  const resultat = usePromoStore((s) => s.resultat);
  const enCours = usePromoStore((s) => s.enCours);
  const verifier = usePromoStore((s) => s.verifier);
  const oublier = usePromoStore((s) => s.oublier);

  const entrees: Entrees | null = code && restaurantId ? { code, restaurantId, userId, sousTotal } : null;
  const aJour = entrees && !perime(resultat, entrees) ? resultat : null;

  useEffect(() => {
    if (!entrees) return;
    if (!perime(usePromoStore.getState().resultat, entrees)) return;
    void verifier(entrees);
    // `entrees` est recomposé à chaque rendu : on dépend de ses champs, pas de l'objet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, restaurantId, userId, sousTotal, resultat, verifier]);

  return {
    code,
    remise: aJour?.raison === null ? aJour.remise : 0,
    valide: !!aJour && aJour.raison === null,
    raison: aJour?.raison === 'non_connecte' ? null : (aJour?.raison ?? null),
    enAttenteConnexion: aJour?.raison === 'non_connecte',
    enCours,
    appliquer: (saisi: string) => {
      const propre = saisi.trim().toUpperCase();
      if (!propre) return;
      oublier();
      setPromoCode(propre);
    },
    retirer: () => {
      oublier();
      setPromoCode(null);
    },
  };
}
