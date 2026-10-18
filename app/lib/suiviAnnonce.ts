import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Suivi des annonces (2026-10-18) : qui a OUVERT une notification d'annonce, qui a vu la
 * fenêtre du week-end et quelle version il a choisie. Écrit par `noter_suivi_annonce`, qui
 * pose lui-même le compte (auth.uid()) ; lu dans l'admin par `admin_suivi_annonce`.
 *
 * Jamais bloquant : un suivi raté ne doit gêner aucun geste.
 */
type Evenement = 'ouverture_notification' | 'modale_vue' | 'modale_version';

export function noterSuiviAnnonce(evenement: Evenement, annonceId?: string | null, detail?: string | null) {
  const plateforme = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : null;
  void Promise.resolve(
    supabase.rpc('noter_suivi_annonce', {
      p_evenement: evenement,
      p_annonce_id: annonceId ?? null,
      p_detail: detail ?? null,
      p_plateforme: plateforme,
    }),
  ).catch(() => {});
}

/**
 * Ouverture d'une notification d'annonce, notée UNE fois par annonce et par appareil :
 * au démarrage à froid, la même réponse peut arriver par l'écouteur ET par
 * `getLastNotificationResponseAsync` (et encore après le rechargement d'une mise à jour).
 */
export async function noterOuvertureAnnonce(annonceId: string) {
  const cle = `tf_suivi_ouverture_${annonceId}`;
  try {
    if (await AsyncStorage.getItem(cle)) return;
    await AsyncStorage.setItem(cle, '1');
  } catch {
    // Stockage indisponible : on note quand même, la base dédoublonne par compte.
  }
  noterSuiviAnnonce('ouverture_notification', annonceId);
}
