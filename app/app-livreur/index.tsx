import { Redirect } from 'expo-router';
import { useSession } from '../store/session';

/**
 * Aiguillage de l'app livreur :
 *   - pas de session              → connexion ;
 *   - session sans rôle livreur ACTIF → « Ce compte n'est pas livreur » ;
 *   - livreur actif               → les livraisons.
 * Le rôle actif est une décision d'administrateur : la base la revérifie à chaque RPC.
 */
export default function Aiguillage() {
  const session = useSession((s) => s.session);
  if (!session) return <Redirect href="/connexion" />;
  const livreur = session.roles.some((r) => r.role === 'livreur' && r.status === 'active');
  if (!livreur) return <Redirect href="/pas-livreur" />;
  return <Redirect href="/(onglets)" />;
}
