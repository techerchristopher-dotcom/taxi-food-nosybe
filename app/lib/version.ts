import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Ce que l'app affiche d'elle-même en bas du Profil.
 *
 * ⚠️ CETTE LIGNE SERT À DÉBOGUER, PAS À DÉCORER. Quand quelqu'un dit « la correction
 * n'est pas arrivée », c'est le premier endroit qu'on regarde. Elle doit donc être VRAIE.
 *
 * Elle ne l'était pas. `DATE_MISE_A_JOUR` était une constante écrite à la main, à remonter
 * à chaque build — et personne ne le faisait. Elle a menti deux fois :
 *
 *   - le 2026-09-08, en affichant « 7 septembre » sur un binaire du 8. Conclusion tirée :
 *     « le mauvais build est installé ». Coût : une désinstallation, une réinstallation et
 *     trois échanges pour rien.
 *   - le 2026-09-10, en affichant « 8 septembre » sur un binaire du 9 qui venait de
 *     recevoir une mise à jour du 10. Conclusion tirée : « rien n'est arrivé ». Alors que
 *     tout était arrivé.
 *
 * On ne remonte donc plus une date à la main : on lit celle que le système CONNAÎT.
 *
 * `Updates.createdAt` est l'instant où le paquet JavaScript en train de tourner a été
 * publié. C'est exactement la question qu'on se pose — « est-ce que ma correction est
 * dedans ? » — et la réponse ne dépend de la vigilance de personne.
 *
 * ⚠️ Il vaut `null` quand aucune mise à jour à distance n'a été appliquée : en
 * développement, et sur un binaire fraîchement installé qui tourne encore sur le paquet
 * embarqué. On affiche alors « version du magasin », qui est la vérité de ce moment-là —
 * et surtout pas une date inventée.
 */

/** Version déclarée dans app.json, ex. « 1.0.0 ». */
export const VERSION: string = Constants.expoConfig?.version ?? '1.0.0';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 25 août 2026 » — lisible, sans dépendre du format du téléphone. */
function dateLisible(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Date du paquet JavaScript en cours d'exécution, ou null s'il est celui d'origine
 * (embarqué dans le binaire du magasin).
 *
 * ⚠️ Enveloppé dans un try : `expo-updates` lève sur un client de développement, et une
 * ligne de pied de page n'a JAMAIS le droit de faire tomber l'écran Profil.
 */
export function dateMiseAJourLisible(): string {
  try {
    const d = Updates.createdAt;
    if (d) return dateLisible(d);
  } catch {
    /* client de développement : pas de mise à jour à distance, rien à dire */
  }
  return 'version du magasin';
}

/**
 * La ligne du pied de page.
 * « TAXI FOOD · v1.2.1 · 10 septembre 2026 · NOSY BE »
 * « TAXI FOOD · v1.2.1 · version du magasin · NOSY BE » avant la 1re mise à jour reçue.
 */
export function ligneVersion(): string {
  return `TAXI FOOD · v${VERSION} · ${dateMiseAJourLisible()} · NOSY BE`;
}
