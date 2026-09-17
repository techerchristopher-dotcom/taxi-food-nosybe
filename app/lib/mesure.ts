import { Platform } from 'react-native';

/**
 * Mesure d'audience de l'app WEB (taxifood.distripro207.com) — Umami Cloud.
 *
 * Le tracker est chargé par `public/index.html`, qui compte seul les pages vues
 * (le routeur change l'adresse par l'historique du navigateur, Umami le suit).
 * Ce fichier ne sert qu'aux ÉTAPES qui ne sont pas des pages : ajout au panier,
 * commande validée, partage. C'est ce qui dit jusqu'où va un visiteur arrivé par
 * une publication.
 *
 * ⚠️ WEB SEULEMENT, et silencieux. Sur l'app installée `window.umami` n'existe pas :
 * la fonction ne fait rien. Une mesure ne doit jamais faire échouer un geste —
 * d'où le try/catch, même autour d'un appel qui « ne peut pas » lever.
 *
 * ⚠️ AUCUNE DONNÉE PERSONNELLE dans les propriétés : ni nom, ni téléphone, ni
 * adresse, ni montant rattachable à une personne. Umami est choisi précisément
 * pour se passer de bandeau de consentement ; y envoyer un identifiant client
 * détruirait cet argument.
 */
export function mesurer(nom: string, donnees?: Record<string, string | number | boolean>) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const umami = (window as unknown as { umami?: { track: (n: string, d?: object) => void } }).umami;
    // `surface` : repère explicite dans les événements, utile si un jour les deux
    // audiences sont regroupées dans un même site Umami.
    umami?.track(nom, { surface: 'app-web', ...donnees });
  } catch {
    // Jamais bloquant.
  }
}
