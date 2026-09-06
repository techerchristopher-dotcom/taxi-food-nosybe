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
 *
 * ⚠️ **Un rôle pro ACTIF est une décision d'administrateur ; un rôle client n'est qu'un
 * tap.** C'est le principe qui gouverne tout ce qui suit, et il a été payé cher : cette
 * fonction testait autrefois `role === 'client' && status === 'active'` pour décider si un
 * compte était « vraiment » multi-rôle. Or ce rôle s'obtient en tapant la carte « Je
 * commande » de `/role-select`, il ne donne AUCUN droit (aucune policy RLS ne le
 * mentionne — commander est autorisé par `orders.user_id = auth.uid()`), et il est
 * définitif côté app. Le patron de « Chez Bidul & Truc » l'a tapé une fois le 2026-09-06 :
 * à partir de là son compte n'a plus jamais retrouvé son espace pro, et l'app lui a
 * redemandé son téléphone comme à un nouveau client. On ne lit donc plus le rôle client
 * ici — seuls les rôles pro actifs et le `mode` décident.
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

  // Un restaurant « actif » exige les DEUX : le rôle validé et le rattachement à un
  // établissement. Sans `restaurantId`, l'espace pro n'aurait aucune commande à montrer.
  const restaurantActif =
    session.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
    !!session.restaurantId;
  const livreurActif = session.roles.some((r) => r.role === 'livreur' && r.status === 'active');

  // Le `mode` porte le seul choix EXPLICITE de la personne (bouton « App client » de
  // l'en-tête pro, cartes de `/role-select`, tap sur une notification pro). Il est persisté
  // en local et passe donc avant les rôles : quelqu'un qui est passé côté client hier doit
  // y retrouver l'app ce matin, pas être renvoyé de force dans son espace pro.
  if (mode === 'restaurant' && restaurantActif) return '/(restaurant)';
  if (mode === 'livreur' && livreurActif) return '/(livreur)';
  if (mode === 'client') return cheminClient(session, intent, restaurantActif || livreurActif);

  // Aucun mode choisi : premier lancement, réinstallation, ou compte tout neuf. On tranche
  // sur les rôles pro actifs SEULS.
  //
  // Un compte professionnel entre DIRECTEMENT dans son espace, sans écran intermédiaire.
  // C'est aussi ce qui protège la revue Apple : le relecteur connecté avec le compte
  // restaurant de démonstration tomberait sinon sur `/role-select`, dont la carte la plus
  // voyante est « Je commande » — il conclurait, une seconde fois, qu'il n'accède pas à
  // l'espace restaurant (rejet 2.1(a) du build 17). Cette garantie ne dépend plus de
  // l'ABSENCE de rôle client sur ces comptes, qui était un équilibre fragile.
  if (restaurantActif && livreurActif) return '/role-select'; // seule vraie ambiguïté
  if (restaurantActif) return '/(restaurant)';
  if (livreurActif) return '/(livreur)';

  // Aucun rôle pro actif — y compris une demande encore en `pending`, qui n'ouvre rien et
  // ne doit donc pas détourner le démarrage vers l'écran de choix.
  return cheminClient(session, intent, false);
}

/**
 * Le parcours client, et la question du téléphone.
 *
 * `profiles.phone` sert à UNE chose : que le livreur puisse appeler en arrivant. On le
 * demande donc à un client au moment où il se connecte, comme avant — c'est le seul numéro
 * qu'on aura de lui, et le tunnel de commande s'en sert pour pré-remplir l'adresse.
 *
 * ⚠️ Mais pas à quelqu'un qui a un espace pro. Un restaurateur qui vient regarder l'app
 * côté client n'est pas en train de commander : lui barrer la route par un formulaire de
 * numéro, sans rien lui expliquer, c'est exactement ce qui s'est passé le 2026-09-06 — il
 * y a saisi le numéro de son ÉTABLISSEMENT, croyant qu'on le lui redemandait par erreur.
 * Le numéro reste exigé s'il commande vraiment : l'écran `/address` a son propre champ
 * téléphone, obligatoire, sur chaque adresse de livraison.
 */
function cheminClient(session: Session, intent: string | null, pro: boolean): string {
  if (!pro && !session.phone) return '/phone';
  return intent ?? '/(tabs)';
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
  const setMode = useSession((s) => s.setMode);
  const [intent] = useState(() => useAuthIntent.getState().intent);
  const dejaNavigue = useRef<string | null>(null);

  const href = destination(session, mode, intent);

  useEffect(() => {
    if (dejaNavigue.current === href) return;
    dejaNavigue.current = href;

    // Une intention ne sert qu'une fois — sinon une connexion demandée depuis le Profil
    // finirait par déposer quelqu'un sur l'écran d'adresse des semaines plus tard.
    if (intent && href === intent) useAuthIntent.getState().clear();

    // Le mode déduit des rôles est ÉCRIT, pas seulement calculé. Sans ça, un restaurateur
    // qui n'est jamais passé par `/role-select` restait en `mode = null` indéfiniment,
    // donc suspendu à cette déduction à chaque lancement — et un aller-retour côté client
    // devenait indémêlable. `destination()` reste pure : l'effet vit ici, à côté de la
    // consommation de l'intention. Écrire le mode ne change pas `href` (le mode posé mène
    // au même espace), le verrou `dejaNavigue` n'est donc pas rejoué.
    // Même geste que `app/_layout.tsx` au tap sur une notification pro.
    if (!mode) {
      if (href === '/(restaurant)') void setMode('restaurant');
      else if (href === '/(livreur)') void setMode('livreur');
    }

    if (href.startsWith('/(tabs)')) retourOnglets(router, href);
    else router.replace(href);
  }, [intent, href, router, mode, setMode]);

  // Le temps de la bascule : rien du tout. Un spinner clignoterait sur chaque démarrage.
  return null;
}
