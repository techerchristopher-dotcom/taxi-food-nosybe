/**
 * Petit hook de chargement de données asynchrones, avec rechargement à chaque focus
 * de l'écran (utile pour rafraîchir listes/commandes après une mutation).
 *
 * Passe les dépendances qui déterminent la requête (ex. [id]) : le callback est mémoïsé
 * dessus, ce qui évite toute boucle de re-render.
 */
import { DependencyList, useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Erreur de chargement');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(load);

  return { data, loading, error, reload: load };
}
