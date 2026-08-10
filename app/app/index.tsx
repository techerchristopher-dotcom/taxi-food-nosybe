import { Redirect } from 'expo-router';
import { useSession } from '../store/session';

/** Aiguillage au démarrage : connexion → téléphone → app. */
export default function Index() {
  const session = useSession((s) => s.session);
  if (!session) return <Redirect href="/login" />;
  if (!session.phone) return <Redirect href="/phone" />;
  return <Redirect href="/(tabs)" />;
}
