import { Redirect } from 'expo-router';

/**
 * Adresse inconnue → l'accueil (2026-10-07).
 *
 * Cas qui l'a fait naître : une annonce qui ouvre une page NOUVELLE (`/porte-monnaie`)
 * reçue par une app qui n'a pas encore chargé la mise à jour. expo-router affichait son
 * écran technique « Unmatched Route » — vu par le porteur du projet comme « page not
 * found ». Un client ne doit jamais voir ça : on le ramène simplement à l'accueil.
 */
export default function PageIntrouvable() {
  return <Redirect href="/" />;
}
