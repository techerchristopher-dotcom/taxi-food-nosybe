/**
 * Un nombre décimal écrit dans la langue de l'écran.
 *
 * POURQUOI un fichier pour ça : les distances de livraison s'affichent à côté
 * d'un montant, et « 9.3 km » au milieu d'une phrase française à côté de
 * « 17 000 Ar » se lit comme une faute. `toLocaleString` fait le travail, mais
 * il faut lui passer la langue COURANTE de l'app (i18n), pas celle du système :
 * le client choisit sa langue dans le Profil, et le téléphone peut être en
 * anglais pendant que l'app parle italien.
 *
 * Une décimale au plus : au-delà, on afficherait une précision que le calcul
 * (vol d'oiseau × 1,3) n'a pas.
 */
export function nombre(valeur: number, langue: string): string {
  try {
    return valeur.toLocaleString(langue, { maximumFractionDigits: 1 });
  } catch {
    // Moteur sans données de locale (Hermes sans ICU sur certains Android) :
    // mieux vaut un point qu'un écran vide.
    return String(Math.round(valeur * 10) / 10);
  }
}
