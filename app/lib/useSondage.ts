/**
 * Sondage d'un écran restaurant : relit la base toutes les `periodeMs`, ET tout de suite
 * quand l'app revient au premier plan.
 *
 * Pourquoi le retour au premier plan (constaté le 2026-10-02 aux Siciliens) : le
 * restaurateur quitte l'app pour appuyer sur « Accepter » dans Telegram, puis revient.
 * Pendant qu'il était ailleurs, le système a suspendu le `setInterval` (iOS le gèle, un
 * onglet de navigateur caché est ralenti à une fois par minute) : il retrouvait sa
 * commande dans l'ancien état — « Nouvelle commande » alors qu'il venait de l'accepter —
 * et concluait que rien n'avait marché. `useFocusEffect` ne couvre pas ce cas : il réagit à
 * la navigation entre écrans, pas au retour dans l'application.
 *
 * Sur le web, `AppState` de react-native-web suit `document.visibilityState` : la même
 * règle couvre l'onglet qu'on retrouve.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useSondage(reload: () => unknown, periodeMs: number) {
  useEffect(() => {
    const t = setInterval(reload, periodeMs);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') reload();
    });
    return () => {
      clearInterval(t);
      abonnement.remove();
    };
  }, [reload, periodeMs]);
}
