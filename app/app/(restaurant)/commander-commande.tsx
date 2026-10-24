import { useLocalSearchParams } from 'expo-router';
import { EcranCommande } from '../../distripro/ecrans/Commande';

export default function CommanderCommande() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  return <EcranCommande numero={String(numero ?? '')} />;
}
