/**
 * Retour vers les onglets clients, SANS en empiler une seconde copie.
 *
 * Depuis que le catalogue est libre (règle Apple 5.1.1(v)), `(tabs)` n'est plus un écran
 * comme un autre : c'est la RACINE de la pile, et l'écran de connexion vient se poser
 * par-dessus. Un `router.replace('/(tabs)')` fait alors ce qu'on lui demande — il remplace
 * l'écran courant par un `(tabs)` NEUF — et laisse le `(tabs)` d'origine dessous. Résultat :
 * après connexion, le bouton retour Android et le glisser-retour iOS ne sortent plus de
 * l'app, ils dévoilent un second navigateur d'onglets identique. Chaque cycle
 * déconnexion / reconnexion en empilait un de plus.
 *
 * `dismissTo` fait l'inverse : il REDESCEND jusqu'au `(tabs)` déjà monté en jetant tout ce
 * qui se trouve au-dessus (connexion, inscription, aiguillage…). La pile revient donc
 * exactement à ce qu'elle était avant la connexion.
 *
 * Deux détails vérifiés dans `expo-router@57` (`react-navigation/routers/StackRouter.js`,
 * cas `POP_TO`) :
 *  - si aucune route `(tabs)` n'existe dans la pile — démarrage à froid — l'action se
 *    comporte exactement comme un `replace` ; le repli `canDismiss()` n'est donc qu'une
 *    ceinture de sécurité, jamais un changement de comportement ;
 *  - `dismissTo('/(tabs)/orders')` repose les paramètres de navigation imbriqués sur la
 *    route retrouvée, et `useNavigationBuilder` les consomme en basculant l'onglet visé.
 *    L'onglet de destination est donc bien respecté, pas seulement le groupe.
 */
import type { useRouter } from 'expo-router';

type Router = ReturnType<typeof useRouter>;

export function retourOnglets(router: Router, href: string) {
  if (router.canDismiss()) router.dismissTo(href);
  else router.replace(href);
}
