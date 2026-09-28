import { useEffect, useState } from 'react';

/**
 * L'heure courante, rafraîchie toutes les 30 s — seulement quand `actif`.
 *
 * Sert au compte à rebours « Ouvre dans 35 min » : sans tic, un écran laissé
 * ouvert dirait encore « dans 35 min » une heure plus tard. Inactif, le hook
 * ne pose AUCUN minuteur : une liste de vingt cartes n'a pas à se redessiner
 * toutes les 30 s pour des restaurants ouverts ou fermés jusqu'à demain.
 */
export function useMaintenant(actif: boolean, periodeMs = 30_000): Date {
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    if (!actif) return;
    setMaintenant(new Date());
    const id = setInterval(() => setMaintenant(new Date()), periodeMs);
    return () => clearInterval(id);
  }, [actif, periodeMs]);
  return maintenant;
}
