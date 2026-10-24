import { EcranCatalogue } from '../../distripro/ecrans/Catalogue';
import { useSession } from '../../store/session';

/** Onglet « Commander » : le catalogue DistriPro, pour le restaurant actif. */
export default function Commander() {
  const nom = useSession((s) => s.session?.restaurantName ?? null);
  return <EcranCatalogue sousTitre={nom ? `Pour ${nom} · livré par DistriPro` : undefined} />;
}
