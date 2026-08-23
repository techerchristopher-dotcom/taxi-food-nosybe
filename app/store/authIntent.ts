/**
 * « Où renvoyer la personne une fois connectée. »
 *
 * Le catalogue est libre (règle Apple 5.1.1(v)) : le compte n'est exigé qu'à l'entrée du
 * tunnel de commande. Il faut donc mémoriser d'où venait la personne — sinon elle ressort
 * de la connexion sur l'accueil, panier plein, sans comprendre ce qui vient de se passer.
 *
 * EN MÉMOIRE UNIQUEMENT, et c'est délibéré : une intention ne doit pas survivre au
 * redémarrage de l'app. Une intention persistée ressortirait trois jours plus tard et
 * larguerait quelqu'un sur l'écran d'adresse sans raison. Ce qui doit survivre, c'est le
 * PANIER — il est déjà persisté dans AsyncStorage (`store/cart.ts`).
 *
 * La valeur est toujours un chemin expo-router écrit en dur dans le code de l'app ; jamais
 * une URL reçue de l'extérieur (deep link, paramètre de recherche).
 */
import { create } from 'zustand';
import type { useRouter } from 'expo-router';

/**
 * LISTE FERMÉE des retours possibles.
 *
 * Le typage est le seul garde-fou : `intent` finit dans une navigation, et une cible qui
 * ne correspond à aucune route dépose la personne sur l'écran « Unmatched Route » intégré
 * à expo-router — un écran de développeur, en anglais, au milieu du tunnel de commande.
 * Les routes typées d'expo-router ne sont pas activées ici, donc un `string` nu passerait
 * la compilation sans broncher. Avec cette liste, renommer ou supprimer une de ces routes
 * casse le build au lieu de casser le parcours.
 */
export const RETOURS = [
  '/(tabs)',
  '/(tabs)/orders',
  '/(tabs)/profile',
  '/role-select',
  '/address',
] as const;

export type Retour = (typeof RETOURS)[number];

type AuthIntentState = {
  /** Chemin à rejouer après connexion, ou null. */
  intent: Retour | null;
  set: (path: Retour) => void;
  clear: () => void;
};

export const useAuthIntent = create<AuthIntentState>((set) => ({
  intent: null,
  set: (path) => set({ intent: path }),
  clear: () => set({ intent: null }),
}));

/**
 * SEULE manière d'ouvrir l'écran de connexion depuis le parcours client.
 *
 * Passer systématiquement par ici garantit deux choses : le retour est toujours défini,
 * et l'intention est toujours RÉÉCRITE — donc jamais périmée. Une intention oubliée qui
 * traîne, c'est une connexion depuis le Profil qui atterrit sur l'écran d'adresse.
 */
export function signInFor(router: ReturnType<typeof useRouter>, returnTo: Retour) {
  useAuthIntent.getState().set(returnTo);
  router.push('/login');
}
