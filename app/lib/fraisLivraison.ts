/**
 * Réalignement des frais de livraison affichés sur ceux qui seront facturés.
 *
 * POURQUOI ce fichier existe : le panier fige `deliveryFeeValue` au premier
 * ajout et ne l'a jamais rafraîchi ensuite, alors que `create_order` recalcule
 * les frais à chaque commande. Tant que le tarif ne bougeait pas, personne ne
 * voyait rien. Il a bougé le 2026-09-06 (5 000 → 10 000 Ar), et les deux écrans
 * où le client lit un total — le panier et le récapitulatif — pouvaient dès lors
 * annoncer un montant inférieur à celui débité.
 *
 * ⚠️ DEPUIS LE 2026-09-24, LE TARIF DÉPEND DE L'ADRESSE : 10 000 Ar jusqu'à
 * 3 km, puis 1 000 Ar par kilomètre entamé. Le montant ne se lit donc plus sur
 * le restaurant seul — il se recalcule à chaque changement d'adresse. C'est la
 * raison d'être du paramètre `addressId` : sans lui, l'écran afficherait le
 * tarif de base pendant que la base en facturerait un autre, exactement le
 * défaut que ce fichier avait été écrit pour fermer.
 *
 * Le code promo rendait l'écart pire, pas meilleur : `verifier_code_promo`
 * calcule la remise « livraison » sur le tarif COURANT, et l'écran la
 * retranchait d'une ligne de livraison périmée. Le client lisait « livraison
 * offerte » et payait la livraison. C'est exactement le genre d'écart qui se
 * termine en contestation.
 *
 * ⚠️ Ce hook ne corrige que les FRAIS DE LIVRAISON. Les prix des plats et les
 * suppléments sont eux aussi figés dans le panier persisté et peuvent dater ;
 * les réaligner demande une revalidation complète du panier (produit retiré,
 * option supprimée, rupture de stock), qui est un chantier à part.
 */
import { useEffect, useState } from 'react';
import { FraisLivraison, getFraisLivraison } from '../data/api';
import { useCart } from '../store/cart';

/**
 * À monter par tout écran qui AFFICHE un total (panier, récapitulatif).
 *
 * `addressId` : l'adresse retenue pour la livraison. Absente (panier ouvert
 * avant le choix de l'adresse), on affiche le tarif de base et le détail rendu
 * porte `distanceConnue = false` — l'écran doit alors dire « à partir de ».
 *
 * Silencieux en cas d'échec : un réseau capricieux ne doit pas empêcher de
 * commander. On garde alors la valeur mémorisée — c'est l'état d'avant, pas une
 * régression — et `create_order` reste de toute façon la source de vérité.
 */
export function useFraisLivraisonAJour(addressId?: string | null): FraisLivraison | null {
  const restaurantId = useCart((s) => s.restaurantId);
  const setDeliveryFee = useCart((s) => s.setDeliveryFee);
  const [detail, setDetail] = useState<FraisLivraison | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    let vivant = true;
    getFraisLivraison(restaurantId, addressId ?? null)
      .then((d) => {
        if (!vivant || !d) return;
        setDetail(d);
        setDeliveryFee(d.frais);
      })
      .catch(() => {
        /* on garde la valeur mémorisée */
      });
    return () => {
      vivant = false;
    };
  }, [restaurantId, addressId, setDeliveryFee]);

  return detail;
}
