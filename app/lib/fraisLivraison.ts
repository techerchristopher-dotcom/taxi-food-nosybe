/**
 * Réalignement des frais de livraison affichés sur ceux qui seront facturés.
 *
 * POURQUOI ce fichier existe : le panier fige `deliveryFeeValue` au premier
 * ajout et ne l'a jamais rafraîchi ensuite, alors que `create_order` relit
 * `restaurants.delivery_fee` à chaque commande. Tant que le tarif ne bougeait
 * pas, personne ne voyait rien. Il a bougé le 2026-09-06 (5 000 → 10 000 Ar),
 * et les deux écrans où le client lit un total — le panier et le récapitulatif —
 * pouvaient dès lors annoncer un montant inférieur à celui débité.
 *
 * Le code promo rendait l'écart pire, pas meilleur : `verifier_code_promo`
 * calcule la remise « livraison » sur le tarif COURANT (10 000 → 5 000 de
 * remise), et l'écran la retranchait d'une ligne de livraison périmée à 5 000.
 * Le client lisait « livraison offerte » et payait 5 000 Ar de livraison. C'est
 * exactement le genre d'écart qui se termine en contestation.
 *
 * ⚠️ Ce hook ne corrige que les FRAIS DE LIVRAISON. Les prix des plats et les
 * suppléments sont eux aussi figés dans le panier persisté et peuvent dater ;
 * les réaligner demande une revalidation complète du panier (produit retiré,
 * option supprimée, rupture de stock), qui est un chantier à part.
 */
import { useEffect } from 'react';
import { getDeliveryFee } from '../data/api';
import { useCart } from '../store/cart';

/**
 * À monter par tout écran qui AFFICHE un total (panier, récapitulatif).
 *
 * Silencieux en cas d'échec : un réseau capricieux ne doit pas empêcher de
 * commander. On garde alors la valeur mémorisée — c'est l'état d'avant, pas une
 * régression — et `create_order` reste de toute façon la source de vérité.
 */
export function useFraisLivraisonAJour(): void {
  const restaurantId = useCart((s) => s.restaurantId);
  const setDeliveryFee = useCart((s) => s.setDeliveryFee);

  useEffect(() => {
    if (!restaurantId) return;
    let vivant = true;
    getDeliveryFee(restaurantId)
      .then((fee) => {
        if (vivant && fee != null) setDeliveryFee(fee);
      })
      .catch(() => {
        /* on garde la valeur mémorisée */
      });
    return () => {
      vivant = false;
    };
  }, [restaurantId, setDeliveryFee]);
}
