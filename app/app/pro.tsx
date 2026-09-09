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
  // ⚠️ `loading` EST INDISPENSABLE ICI, et son oubli a casse le parcours le
  // 2026-09-09. Un lien Telegram ouvre l'app A FROID : la session vaut encore
  // `null` pendant l'hydratation. Sans cette attente, la verification ci-dessous
  // repondait « pas d'espace restaurant » et renvoyait le restaurateur vers `/`,
  // donc cote CLIENT — le defaut meme que cet ecran devait corriger.
  const loading = useSession((s) => s.loading);
  const setMode = useSession((s) => s.setMode);

  // Un espace restaurant « ouvert » exige les DEUX : le role valide ET le rattachement a
  // un etablissement — sans `restaurantId` l'espace n'aurait aucune commande a montrer.
  // Meme regle que `destination()` dans `app/index.tsx`, a ne pas assouplir d'un cote seul.
  const ouvert =
    !!session &&
    session.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
    !!session.restaurantId;

  // `null` tant qu'on ne sait pas encore : on n'a alors RIEN a decider.
  // Visiteur ou compte sans espace pro : `/` sait deposer chacun au bon endroit,
  // y compris sur le catalogue libre.
  const href = loading ? null : ouvert ? '/(restaurant)' : '/';

  // ⚠️ Le verrou porte sur la DESTINATION, jamais sur un booleen « j'ai deja navigue ».
  // Le booleen empeche de corriger le tir quand la session arrive enfin — c'est
  // exactement le piege documente dans `app/index.tsx`, qui y avait produit un
  // ecran blanc. Comparer la destination regle les deux cas : aucune boucle, et une
  // destination qui change parce que l'etat a REELLEMENT change est bien suivie.
  const dejaNavigue = useRef<string | null>(null);

  useEffect(() => {
    if (!href) return;
    if (dejaNavigue.current === href) return;
    dejaNavigue.current = href;

    if (href === '/(restaurant)') void setMode('restaurant');
    router.replace(href);
  }, [href, router, setMode]);

  return null;
}
