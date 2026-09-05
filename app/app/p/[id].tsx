import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Point d'entrée des liens partagés vers un produit :
 * `https://taxifood.rentanoo.com/p/<id>` → écran `/product/<id>`.
 *
 * Ce fichier n'affiche rien. Il existe uniquement pour qu'expo-router sache
 * faire correspondre le CHEMIN du lien universel à un écran : le routeur
 * n'ouvre que des chemins qu'il connaît, et `/p/<id>` n'en est pas un tant
 * qu'aucun fichier ne porte ce nom. Sans lui, iOS et Android ouvriraient bien
 * l'app — mais elle retomberait sur l'accueil, ce qui est le symptôme le plus
 * déroutant à diagnostiquer (« le lien marche à moitié »).
 *
 * Le chemin est court exprès : il est destiné à être lu et retapé dans une
 * conversation WhatsApp.
 */
export default function LienProduit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)" />;
  return <Redirect href={{ pathname: '/product/[id]', params: { id } }} />;
}
