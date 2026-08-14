import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase (navigateur) du dashboard admin. Même projet que l'app mobile.
 * La clé anon est publique par conception : l'accès aux données de pilotage est protégé
 * par la RLS + le rôle `admin` (helper is_admin()), jamais par le secret de la clé.
 * detectSessionInUrl : true pour finaliser le retour OAuth Google (code PKCE dans l'URL).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error('Config Supabase manquante : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
