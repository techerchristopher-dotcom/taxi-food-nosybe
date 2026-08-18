import { Redirect } from 'expo-router';
import { useSession } from '../store/session';

/**
 * Aiguillage au démarrage.
 * - Pas de session → connexion.
 * - Compte sans nom (créé par SMS) → saisie du nom, avant tout le reste.
 * - Client « simple » (aucun rôle pro) → parcours inchangé : téléphone puis app cliente.
 * - Compte multi-rôle (restaurant/livreur) → mode choisi respecté, sinon écran de sélection.
 */
export default function Index() {
  const session = useSession((s) => s.session);
  const mode = useSession((s) => s.mode);

  if (!session) return <Redirect href="/login" />;

  // Le nom manque uniquement aux comptes créés par SMS (Google et l'inscription e-mail
  // le fournissent). On le demande avant tout : le restaurant et le livreur voient ce
  // nom sur la commande, « Client » ne leur sert à rien.
  if (!session.hasName) return <Redirect href="/name" />;

  const hasStaffRole = session.roles.some((r) => r.role === 'restaurant' || r.role === 'livreur');
  const activeRestaurant =
    session.roles.some((r) => r.role === 'restaurant' && r.status === 'active') &&
    !!session.restaurantId;
  const activeCourier = session.roles.some((r) => r.role === 'livreur' && r.status === 'active');

  // Client sans rôle pro : comportement historique, pas d'écran de sélection.
  if (!hasStaffRole) {
    if (!session.phone) return <Redirect href="/phone" />;
    return <Redirect href="/(tabs)" />;
  }

  // Comptes multi-rôle : on respecte le mode choisi, sinon on demande de choisir.
  if (mode === 'restaurant' && activeRestaurant) return <Redirect href="/(restaurant)" />;
  if (mode === 'livreur' && activeCourier) return <Redirect href="/(livreur)" />;
  if (mode === 'client') {
    if (!session.phone) return <Redirect href="/phone" />;
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/role-select" />;
}
