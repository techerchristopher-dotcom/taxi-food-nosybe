import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useSession } from '../store/session';

/**
 * `/pro` — l'adresse publique de l'espace restaurant.
 *
 * L'accueil de l'espace restaurant vit dans un GROUPE expo-router, `(restaurant)/index`, et
 * les groupes n'apparaissent pas dans l'URL : cet écran n'avait donc AUCUNE adresse
 * atteignable depuis l'extérieur de l'app. Le bouton « Voir la commande » de la page
 * d'acceptation Telegram pointait faute de mieux sur `/`.
 *
 * Or `/` repasse par l'aiguillage de `app/index.tsx`, et cet aiguillage fait gagner le MODE
 * mémorisé sur les rôles — c'est voulu, un choix explicite doit primer. Résultat : un
 * restaurateur passé côté client la veille atterrissait dans l'app CLIENT, en venant d'un
 * lien qui lui annonçait sa propre commande. Constaté sur appareil le 2026-09-09.
 *
 * Cet écran tranche : il POSE le mode restaurant, puis entre dans l'espace. Arriver ici est
 * un acte explicite — on a appuyé sur « Voir la commande » — il a donc le même droit
 * d'écraser le mode mémorisé que les cartes de `/role-select`.
 *
 * ⚠️ Il ne rend RIEN et ne garde rien : c'est un aiguillage, pas un écran. Un indicateur de
 * chargement clignoterait à chaque passage.
 */
export default function Pro() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const setMode = useSession((s) => s.setMode);
  // Même verrou que `app/index.tsx` : expo-router réutilise l'instance déjà montée, un
  // effet rejoué renverrait une seconde fois et empilerait un écran de trop.
  const dejaFait = useRef(false);

  useEffect(() => {
    if (dejaFait.current) return;
    dejaFait.current = true;

    // Un espace restaurant « ouvert » exige les DEUX : le rôle validé ET le rattachement à
    // un établissement — sans `restaurantId` l'espace n'aurait aucune commande à montrer.
    // Même règle que `destination()`, à ne pas assouplir d'un côté seulement.
    const ouvert =
      !!session &&
      session.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
      !!session.restaurantId;

    // Visiteur, ou compte sans espace pro : on ne force rien et on laisse `/` faire son
    // travail — il sait déposer chacun au bon endroit, y compris sur le catalogue libre.
    if (!ouvert) {
      router.replace('/');
      return;
    }

    void setMode('restaurant');
    router.replace('/(restaurant)');
  }, [session, router, setMode]);

  return null;
}
