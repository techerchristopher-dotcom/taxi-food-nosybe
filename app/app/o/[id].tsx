import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Point d'entrée des liens de suivi envoyés par e-mail :
 * `https://taxifood.rentanoo.com/o/<id>` → écran `/order/<id>`.
 *
 * Même mécanique que `app/p/[id].tsx` : expo-router n'ouvre que des chemins
 * qu'il connaît, et `/o/<id>` n'en est pas un tant qu'aucun fichier ne porte ce
 * nom. Sans lui, iOS ouvrirait bien l'app — sur l'accueil, sans la commande.
 */
export default function LienCommande() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)/orders" />;
  return <Redirect href={{ pathname: '/order/[id]', params: { id } }} />;
}
