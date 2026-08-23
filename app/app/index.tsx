import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '../store/session';
import { useAuthIntent } from '../store/authIntent';
import { retourOnglets } from '../lib/nav';
import type { Session } from '../lib/auth';
import type { AppMode } from '../data/types';

/**
 * Où envoyer la personne, selon l'état de son compte. Fonction pure, sans hook : c'est
 * elle qui porte toute la logique d'aiguillage, et elle se relit d'un bloc.
 */
function destination(session: Session | null, mode: AppMode | null, intent: string | null): string {
  // Pas de session → CATALOGUE LIBRE. Parcourir les restaurants, un menu, une fiche
  // produit et remplir son panier ne demande pas de compte (règle Apple 5.1.1(v)).
  // Le seul écran qui en exige un est le tunnel de commande, et il porte sa propre garde
  // (`app/address.tsx`) — pas ici.
  if (!session) return '/(tabs)';

  // Le nom manque uniquement aux comptes créés par SMS (Google et l'inscription e-mail
  // le fournissent). On le demande avant tout : le restaurant et le livreur voient ce
  // nom sur la commande, « Client » ne leur sert à rien.
  if (!session.hasName) return '/name';

  const hasStaffRole = session.roles.some((r) => r.role === 'restaurant' || r.role === 'livreur');
  const activeRestaurant =
    session.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
    !!session.restaurantId;
  const activeCourier = session.roles.some((r) => r.role === 'livreur' && r.status === 'active');

  // Client sans rôle pro : comportement historique, pas d'écran de sélection.
  if (!hasStaffRole) {
    if (!session.phone) return '/phone';
    return intent ?? '/(tabs)';
  }

  // Comptes multi-rôle : on respecte le mode choisi, sinon on demande de choisir.
  if (mode === 'restaurant' && activeRestaurant) return '/(restaurant)';
  if (mode === 'livreur' && activeCourier) return '/(livreur)';
  if (mode === 'client') {
    if (!session.phone) return '/phone';
    return intent ?? '/(tabs)';
  }
  return '/role-select';
}

/**
 * Aiguillage au démarrage, et point de retour unique après connexion : les écrans de
 * connexion (`login`, `login-email`, `login-phone`, `signup`) ainsi que `name`, `phone` et
 * `role-select` font tous `router.replace('/')`, c'est donc ici que l'INTENTION mise de
 * côté avant la connexion est rejouée — mais seulement une fois le compte complet.
 *
 * ⚠️ L'intention est LUE UNE FOIS puis figée pour toute la durée de ce montage
 * (`useState(() => …)`), et la navigation n'a lieu QU'UNE FOIS (`navigated`). Ce n'est pas de
 * la coquetterie : si la destination changeait en cours de route, une seconde navigation
 * annulerait la première — la personne serait déposée sur l'accueil au lieu du tunnel de
 * commande, exactement le bug qu'on corrige. Cet écran ne monte de toute façon qu'une fois
 * la session hydratée (`app/_layout.tsx` retient le rendu derrière son splash), la première
 * destination calculée est donc la bonne.
 *
 * ⚠️ L'intention est consommée quand elle SERT DE DESTINATION (`href === intent`), et pas
 * une seconde plus tôt. C'est ce qui la fait survivre aux écrans qui repassent par ici —
 * nom, téléphone, sélection de rôle — sans jamais l'y enfermer : `/role-select` figurait
 * autrefois dans une liste d'écrans « de transit » où l'on n'effaçait pas, ce qui bouclait
 * pour de bon (Profil visiteur → « Devenir partenaire » → connexion → sélection de rôle →
 * « Continuer comme client » → `/` → sélection de rôle → …).
 *
 * ⚠️ Navigation IMPÉRATIVE et non `<Redirect>` : le `<Redirect>` d'expo-router fait un
 * `replace`, qui posait un SECOND `(tabs)` par-dessus celui qui vit au fond de la pile
 * (voir `lib/nav.ts`).
 *
 * ⚠️ Le verrou porte sur la DESTINATION, pas sur un simple booléen « j'ai déjà navigué ».
 * Le booléen produisait un ÉCRAN BLANC, constaté sur appareil le 2026-08-23 : en se
 * déconnectant depuis la sélection de rôle, on repasse par `/`, mais expo-router réutilise
 * l'instance d'`Index` déjà montée au démarrage — le booléen valait donc déjà `true`,
 * l'effet sortait aussitôt, et le `return null` de fin laissait l'écran vide, sans onglets
 * ni retour. Comparer la destination règle les deux cas d'un coup : on ne navigue jamais
 * deux fois vers le MÊME endroit (pas de boucle), et une destination qui change parce que
 * l'état a réellement changé (une session qui disparaît) est bien suivie.
 */
export default function Index() {
  const router = useRouter();
  const session = useSession((s) => s.session);
  const mode = useSession((s) => s.mode);
  const [intent] = useState(() => useAuthIntent.getState().intent);
  const dejaNavigue = useRef<string | null>(null);

  const href = destination(session, mode, intent);

  useEffect(() => {
    if (dejaNavigue.current === href) return;
    dejaNavigue.current = href;

    // Une intention ne sert qu'une fois — sinon une connexion demandée depuis le Profil
    // finirait par déposer quelqu'un sur l'écran d'adresse des semaines plus tard.
    if (intent && href === intent) useAuthIntent.getState().clear();

    if (href.startsWith('/(tabs)')) retourOnglets(router, href);
    else router.replace(href);
  }, [intent, href, router]);

  // Le temps de la bascule : rien du tout. Un spinner clignoterait sur chaque démarrage.
  return null;
}
