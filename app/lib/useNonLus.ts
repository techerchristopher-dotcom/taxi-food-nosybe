/**
 * Messages non lus par commande, pour un rôle (badges des boutons 💬). Relu toutes les
 * 15 s, au retour dans l'app et quand l'écran reprend le focus — c'est-à-dire au retour
 * d'une conversation, où les messages viennent d'être lus.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { nonLusMessagerie, RoleMessagerie } from '../data/messagerie';
import { useSondage } from './useSondage';

export function useNonLus(role: RoleMessagerie | null, actif = true): Record<string, number> {
  const [compte, setCompte] = useState<Record<string, number>>({});
  const relire = useCallback(() => {
    if (!role || !actif) return;
    void nonLusMessagerie(role).then(setCompte);
  }, [role, actif]);
  useFocusEffect(relire);
  useSondage(relire, 15000);
  return compte;
}
