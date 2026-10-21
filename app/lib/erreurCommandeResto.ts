/**
 * Message à montrer au restaurateur quand la base refuse une action sur une commande
 * (2026-10-19). Avant, l'écran affichait toujours « Action impossible. La commande a
 * peut-être changé » : le restaurateur ne savait ni pourquoi ni quoi faire — le soir de
 * TF-439, il n'a pas pu annuler une commande marquée « prête » par erreur.
 */
export function messageErreurCommandeResto(e: unknown): string {
  const brut = (e as { message?: string } | null)?.message ?? '';
  // Plat manquant (2026-10-20).
  if (/En attente du client/i.test(brut)) {
    return 'Un plat manque : le client choisit de le retirer ou d’annuler. Appelle-le si besoin, puis indique son choix.';
  }
  if (/modif:tout_manque/i.test(brut)) {
    return 'Si tous les plats manquent, refuse la commande (motif « plats plus disponibles »).';
  }
  if (/modif:payee_en_ligne/i.test(brut)) {
    return 'Commande déjà payée en ligne : on ne peut pas encore retirer un plat. Annule-la (le client est remboursé) ou appelle Taxi Food.';
  }
  if (/modif:rien_en_attente|modif:trop_tard/i.test(brut)) {
    return 'La commande a changé entre-temps — la liste vient d’être rafraîchie.';
  }
  if (/deja recupere/i.test(brut)) {
    return 'Le livreur a déjà récupéré cette commande : appelle Taxi Food pour l’annuler.';
  }
  if (/livreur a deja pris/i.test(brut)) {
    return 'Un livreur a déjà pris cette commande : elle ne peut plus revenir en préparation. Tu peux encore l’annuler.';
  }
  if (/ne peut plus etre annulee/i.test(brut)) {
    return 'Cette commande ne peut plus être annulée depuis ton espace : appelle Taxi Food.';
  }
  if (/motif/i.test(brut)) {
    return 'Choisis un motif pour annuler la commande.';
  }
  if (/Transition invalide/i.test(brut)) {
    return 'La commande a changé entre-temps — la liste vient d’être rafraîchie.';
  }
  if (/fetch|network|timeout/i.test(brut)) {
    return 'Pas de connexion : l’action n’est pas partie. Réessaie dans un instant.';
  }
  return brut ? `Action impossible : ${brut}` : 'Action impossible. Réessaie dans un instant.';
}
