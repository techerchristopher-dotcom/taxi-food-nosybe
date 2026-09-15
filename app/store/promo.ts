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
 *    elle a été faite (code, restaurant, compte, sous-total, composition du
 *    panier). Dès qu'une de ces entrées change, le résultat est périmé : la
 *    remise affichée retombe à zéro le temps d'un nouvel aller-retour. Jamais de
 *    montant périmé à l'écran.
 *
 * La vérification passe d'abord par `apercu_code_promo`, qui voit les lignes et
 * calcule la remise avec les règles de `create_order` (un repas offert exclut
 * les bières et les softs). `verifier_code_promo` ne sert plus que de repli.
 *
 * ⚠️ Le montant qui fait foi reste celui que `create_order` recalcule en base —
 * c'est elle qui relit les prix, le barème et les frais de livraison, et c'est
 * elle qui consomme le code. Si les deux divergent, c'est l'aperçu qui a tort.
 */
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import {
  apercuCodePromo,
  CreateOrderItem,
  RaisonPromo,
  VerificationPromo,
  verifierCodePromo,
} from '../data/api';
import { CartLine, useCart } from './cart';
import { useSession } from './session';

/** Raisons de refus de la base, plus l'échec réseau qui n'en vient pas. */
export type MotifPromo = RaisonPromo | 'reseau';

/** Sur quoi porte une remise confirmée : les frais de livraison ou le repas. */
export type PorteeCodePromo = 'livraison' | 'sous_total';

/** Ce sur quoi une vérification a été faite. Changez-en une, elle est périmée. */
type Entrees = {
  code: string;
  restaurantId: string;
  /** null = visiteur non connecté (la base répond alors `non_connecte`). */
  userId: string | null;
  sousTotal: number;
  /**
   * Composition du panier : produit, options et quantités de chaque ligne.
   *
   * ⚠️ Le sous-total ne suffit pas. Un repas offert exclut les bières et les
   * softs : remplacer une bière par un plat au même prix laisse le sous-total
   * intact et fait passer la remise de 0 au prix du plat. Sans l'empreinte,
   * l'écran garderait l'ancienne remise.
   */
  empreinte: string;
};

type Resultat = Entrees & {
  /** null quand le code a été refusé : on ne sait alors pas sur quoi il portait. */
  porteSur: PorteeCodePromo | null;
  remise: number;
  raison: MotifPromo | null;
};

/**
 * Les lignes du panier au format de `create_order`, le même que construit
 * `validate()` dans `app/checkout.tsx`. L'aperçu doit porter sur le panier qui
 * sera commandé, sinon sa remise n'est pas celle de la facture.
 */
export function lignesCommande(lines: CartLine[]): CreateOrderItem[] {
  return lines.map((l) => ({
    productId: l.product.id,
    quantity: l.quantity,
    options: l.options.map((o) => ({ optionId: o.optionId, quantity: o.quantity })),
  }));
}

/**
 * Empreinte des lignes telles qu'elles partent à la base. Triée : réordonner le
 * panier ne change pas la remise, et ne doit pas relancer d'aller-retour.
 */
function empreinteDe(lignes: CreateOrderItem[]): string {
  return lignes
    .map(
      (l) =>
        l.productId +
        '[' +
        l.options.map((o) => o.optionId + 'x' + o.quantity).sort().join(',') +
        ']x' +
        l.quantity,
    )
    .sort()
    .join(';');
}

/**
 * Le verdict dépend-il du contenu du panier ?
 *
 *  - remise confirmée sur le repas : oui, elle se calcule sur les lignes ;
 *  - remise confirmée sur la livraison : non, elle est calculée sur
 *    `restaurants.delivery_fee` relu en base et ne bouge pas d'un iota quand on
 *    ajoute une bière. Sans cette nuance, chaque tap sur [+] déclencherait un
 *    aller-retour pour rien — sur la liaison de Nosy Be, ça se voit ;
 *  - `sans_effet` : oui. Un repas offert tapé sur un panier de bières devient
 *    bon dès qu'on ajoute un plat. Figé, le refus empêchait l'envoi du code à
 *    `create_order` et le client payait son plat plein tarif ;
 *  - `reseau` : oui, la question est restée sans réponse et un changement de
 *    panier est l'occasion de la reposer ;
 *  - tout autre refus (inconnu, expiré, déjà utilisé…) : non, il tient au code
 *    et au client, pas au panier.
 */
function dependDuPanier(r: Resultat): boolean {
  if (r.raison === null) return r.porteSur === 'sous_total';
  return r.raison === 'sans_effet' || r.raison === 'reseau';
}

/** Un résultat est-il périmé pour les entrées courantes ? */
function perime(r: Resultat | null, e: Entrees): boolean {
  if (!r) return true;
  if (r.code !== e.code || r.restaurantId !== e.restaurantId || r.userId !== e.userId) return true;
  if (!dependDuPanier(r)) return false;
  return r.sousTotal !== e.sousTotal || r.empreinte !== e.empreinte;
}

/**
 * `apercu_code_promo` absente de la base (PostgREST répond PGRST202) : inutile
 * de la redemander à chaque changement de panier, on passe directement au
 * repli jusqu'au prochain lancement.
 */
let apercuAbsent = false;

/**
 * L'aperçu exact d'abord, l'ancienne vérification en repli.
 *
 * Repli quand l'aperçu échoue — base pas encore migrée, aller-retour perdu :
 * `verifier_code_promo` connaît tous les codes et n'annonce jamais plus que la
 * facture (au pire « valide, remise 0 » pour un repas hors boissons). Si elle
 * échoue aussi, l'erreur remonte : c'est l'état `reseau`.
 */
async function verificationLaPlusJuste(e: Entrees, lignes: CreateOrderItem[]): Promise<VerificationPromo> {
  if (lignes.length > 0 && !apercuAbsent) {
    try {
      return await apercuCodePromo(e.code, e.restaurantId, lignes);
    } catch (err) {
      if ((err as { code?: string } | null)?.code === 'PGRST202') apercuAbsent = true;
    }
  }
  return verifierCodePromo(e.code, e.restaurantId, e.sousTotal);
}

type PromoState = {
  resultat: Resultat | null;
  enCours: boolean;
  verifier: (e: Entrees, lignes: CreateOrderItem[]) => Promise<void>;
  /**
   * Refus prononcé par `create_order` au moment de valider (plafond atteint,
   * code consommé entre-temps depuis un autre appareil). On garde l'identité du
   * résultat courant et on n'en change que le verdict.
   */
  marquerRefus: (raison: MotifPromo) => void;
  oublier: () => void;
};

/**
 * Verdict posé par `create_order`, hors de toute vérification.
 *
 * ⚠️ Il fait AUTORITÉ sur la réponse d'une vérification encore en vol. Le cas
 * existe : la base répond « valide » à T0, le client valide à T1, et entre les
 * deux le code a été consommé depuis un autre appareil. Sans ce verrou, la
 * réponse tardive réécrirait le refus, la remise réapparaîtrait à l'écran et le
 * tap suivant renverrait le même code à `create_order` — qui le refuserait
 * encore. Boucle sans issue pour le client.
 *
 * On repère un verdict par CODE + COMPTE, pas par la signature complète : le
 * panier peut avoir bougé entre la vérification et la validation, ça ne change
 * rien au fait que ce code-là est refusé à ce client-là.
 */
let verdictValidation: string | null = null;

const cleVerdict = (e: Entrees) => e.code + '|' + (e.userId ?? '');

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

const signature = (e: Entrees) =>
  [e.code, e.restaurantId, e.userId ?? '', e.sousTotal, e.empreinte].join('|');

export const usePromoStore = create<PromoState>((set) => ({
  resultat: null,
  enCours: false,

  verifier: async (e, lignes) => {
    const sig = signature(e);
    if (enVol === sig) return;
    enVol = sig;
    set({ enCours: true });
    try {
      const r = await verificationLaPlusJuste(e, lignes);
      if (verdictValidation === cleVerdict(e)) return;
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
      if (verdictValidation !== cleVerdict(e)) {
        set({ resultat: { ...e, porteSur: null, remise: 0, raison: 'reseau' } });
      }
    } finally {
      enVol = null;
      set({ enCours: false });
    }
  },

  marquerRefus: (raison) =>
    set((s) => {
      if (s.resultat) {
        verdictValidation = cleVerdict(s.resultat);
        return { resultat: { ...s.resultat, remise: 0, raison } };
      }
      // Aucune vérification n'avait encore abouti — elle était en vol quand le
      // client a validé. Sans ce repli, le refus ne s'afficherait NULLE PART
      // (le message du récapitulatif renvoie à « ci-dessus », où il n'y aurait
      // rien) et le code repartirait tel quel au tap suivant. On fabrique donc
      // le verdict sur les entrées courantes.
      const panier = useCart.getState();
      if (!panier.promoCode || !panier.restaurantId) return {};
      const entrees: Entrees = {
        code: panier.promoCode,
        restaurantId: panier.restaurantId,
        userId: useSession.getState().session?.userId ?? null,
        sousTotal: panier.subtotal(),
        empreinte: empreinteDe(lignesCommande(panier.lines)),
      };
      verdictValidation = cleVerdict(entrees);
      return { resultat: { ...entrees, porteSur: null, remise: 0, raison } };
    }),

  oublier: () => {
    verdictValidation = null;
    set({ resultat: null });
  },
}));

export type Promo = {
  /** Code retenu, celui que le client lit dans le champ. null = aucun. */
  code: string | null;
  /**
   * Code à transmettre à `create_order` : tout code retenu que la base n'a pas
   * expressément refusé.
   *
   * ⚠️ Ce n'est PAS `valide`. N'envoyer que les codes déjà confirmés perdait en
   * silence la remise de deux clients sur trois cas d'usage : la vérification
   * encore en vol au moment du tap (liaison de Nosy Be), et l'échec réseau qui
   * laisse le code affiché dans le champ. Le client lisait « TAXIFOOD50 » à
   * l'écran et payait la livraison plein tarif, sans un mot. Un code non
   * confirmé part donc à la base, qui tranche : elle l'applique, ou elle lève
   * `code_promo:<raison>` et la commande n'est pas créée. Dans les deux cas le
   * client sait. Un code déjà refusé, lui, ne repart jamais — sinon la commande
   * échouerait en boucle.
   *
   * L'APERÇU à l'écran, lui, ne bouge pas : la remise n'est affichée que
   * confirmée. On peut donc facturer moins que le montant annoncé, jamais plus.
   */
  aEnvoyer: string | null;
  /**
   * Remise en ariary, 0 tant que la base ne l'a pas confirmée POUR CES ENTRÉES.
   *
   * ⚠️ `valide` avec une remise à 0 existe : seul le repli `verifier_code_promo`
   * a répondu, pour un repas offert hors boissons. Le vrai montant sera appliqué
   * par `create_order` ; l'écran ne doit annoncer aucun chiffre.
   */
  remise: number;
  /** true quand la base a validé le code : seul cas où on l'envoie à la commande. */
  valide: boolean;
  /**
   * Sur quoi porte la remise confirmée : la livraison, ou le repas. Le détail du
   * repas (boissons, emballage) dépend du code et n'est pas dans la réponse de
   * la base. null tant que le code n'est pas validé — un code refusé ne dit pas
   * sur quoi il aurait porté.
   */
  porteSur: PorteeCodePromo | null;
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
 * connexion, changement de restaurant, contenu du panier pour un verdict qui en
 * dépend.
 */
export function usePromo(): Promo {
  const code = useCart((s) => s.promoCode);
  const restaurantId = useCart((s) => s.restaurantId);
  const lines = useCart((s) => s.lines);
  const sousTotal = useCart((s) => s.subtotal());
  const setPromoCode = useCart((s) => s.setPromoCode);
  const userId = useSession((s) => s.session?.userId ?? null);

  const resultat = usePromoStore((s) => s.resultat);
  const enCours = usePromoStore((s) => s.enCours);
  const verifier = usePromoStore((s) => s.verifier);
  const oublier = usePromoStore((s) => s.oublier);

  // `lines` garde son identité tant que le panier ne bouge pas : lignes et
  // empreinte ne se recalculent qu'à un vrai changement.
  const lignes = useMemo(() => lignesCommande(lines), [lines]);
  const empreinte = useMemo(() => empreinteDe(lignes), [lignes]);

  const entrees: Entrees | null =
    code && restaurantId ? { code, restaurantId, userId, sousTotal, empreinte } : null;
  const aJour = entrees && !perime(resultat, entrees) ? resultat : null;

  useEffect(() => {
    if (!entrees) return;
    if (!perime(usePromoStore.getState().resultat, entrees)) return;
    void verifier(entrees, lignes);
    // `entrees` est recomposé à chaque rendu : on dépend de ses champs, pas de
    // l'objet. `lignes` suit `empreinte` et `sousTotal`, déjà dans la liste.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, restaurantId, userId, sousTotal, empreinte, resultat, verifier]);

  // Un refus vient de la BASE ; « reseau » n'est pas un refus, c'est une
  // question restée sans réponse — et c'est à `create_order` d'y répondre.
  const refuseParLaBase = !!aJour && aJour.raison !== null && aJour.raison !== 'reseau';
  const valide = !!aJour && aJour.raison === null;

  return {
    code,
    aEnvoyer: code && !refuseParLaBase ? code : null,
    remise: valide ? aJour.remise : 0,
    valide,
    porteSur: valide ? aJour.porteSur : null,
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
