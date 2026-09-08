import Constants from 'expo-constants';

/**
 * Ce que l'app affiche d'elle-même en bas du Profil.
 *
 * ⚠️ `DATE_MISE_A_JOUR` est à REMONTER À CHAQUE BUILD envoyé aux magasins.
 * ⚠️ ET SI ON L'OUBLIE, ELLE MENT. Oublié le 2026-09-08 : le pied de page
 * affichait encore « 7 septembre » sur un binaire du 8, ce qui a fait conclure
 * a tort que le mauvais build etait installe — et couter une desinstallation,
 * une reinstallation et trois echanges pour rien. Ne jamais s'en servir pour
 * identifier un binaire : le seul repere fiable est le VERSION CODE, lu dans
 * la console du magasin.
 * C'est la seule ligne à changer, et elle est listée dans
 * `docs/EN-ATTENTE-DE-BUILD.md` parmi les gestes de sortie.
 *
 * Pourquoi une constante et pas une date calculée : rien, à l'exécution, ne
 * connaît la date de compilation. `expo-constants` donne la version déclarée,
 * pas le moment où le binaire est sorti. Une date « automatique » serait donc
 * soit celle du téléphone — qui ne veut rien dire — soit une machinerie de
 * script de build pour une ligne de texte. Une constante assumée est plus
 * honnête : quand elle est fausse, ça se voit.
 */
export const DATE_MISE_A_JOUR = '2026-09-08';

/** Version déclarée dans app.json, ex. « 1.0.0 ». */
export const VERSION: string = Constants.expoConfig?.version ?? '1.0.0';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « 25 août 2026 » — lisible, sans dépendre du format du téléphone. */
export function dateMiseAJourLisible(): string {
  const [a, m, j] = DATE_MISE_A_JOUR.split('-').map(Number);
  if (!a || !m || !j) return DATE_MISE_A_JOUR;
  return `${j} ${MOIS[m - 1]} ${a}`;
}

/**
 * La ligne du pied de page.
 * « TAXI FOOD · v1.0.0 · 25 août 2026 · NOSY BE »
 */
export function ligneVersion(): string {
  return `TAXI FOOD · v${VERSION} · ${dateMiseAJourLisible()} · NOSY BE`;
}
