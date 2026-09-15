import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Point d'entrée des liens partagés vers les PLATS DU JOUR d'un restaurant :
 * `https://taxifoodnosybe.distripro207.com/j/<restaurant>` → écran `/restaurant/<id>`,
 * dont le haut est justement le bandeau « Offre du jour ».
 *
 * Même rôle que `p/[id].tsx` : sans ce fichier, iOS et Android ouvriraient bien l'app,
 * mais le routeur ne connaîtrait pas le chemin `/j/<id>` et retomberait sur l'accueil.
 * ⚠️ Le chemin `/j/` doit aussi figurer dans `app.json` (intentFilters Android) et dans
 * `landing/.well-known/apple-app-site-association` (iOS).
 */
export default function LienPlatsDuJour() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return <Redirect href="/(tabs)" />;
  return <Redirect href={{ pathname: '/restaurant/[id]', params: { id } }} />;
}
