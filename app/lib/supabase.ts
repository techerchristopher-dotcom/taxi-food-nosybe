/**
 * Client Supabase — point d'entrée unique vers le backend.
 *
 * L'URL et la clé publique (publishable / anon) sont lues dans les variables
 * d'environnement Expo (EXPO_PUBLIC_*), jamais en dur dans le code.
 * La clé publiée ici est faite pour être exposée côté client : la sécurité
 * repose sur les politiques RLS de la base, pas sur le secret de la clé.
 *
 * La session Auth est persistée avec AsyncStorage et rafraîchie automatiquement.
 */
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Configuration Supabase manquante : renseigne EXPO_PUBLIC_SUPABASE_URL et " +
      "EXPO_PUBLIC_SUPABASE_ANON_KEY dans app/.env (voir app/.env.example).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Flux OAuth mobile : PKCE (échange d'un `code` contre une session).
    flowType: 'pkce',
    // Le retour d'OAuth est traité manuellement via un deep link (voir lib/auth.ts).
    detectSessionInUrl: false,
  },
});

// Rafraîchit le token tant que l'app est au premier plan, le met en pause sinon
// (recommandation officielle Supabase + Expo).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
