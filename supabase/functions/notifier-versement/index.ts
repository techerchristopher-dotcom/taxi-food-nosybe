/**
 * notifier-versement — prévient un restaurant, sur son groupe Telegram, qu'un
 * versement vient de lui être envoyé. UN message par versement.
 *
 * Appelée par l'admin juste après `admin_enregistrer_versement`, ou par le
 * bouton « Renvoyer le message » après un échec. Jamais par la base.
 *
 * POURQUOI UNE FONCTION EDGE ET PAS n8n NI pg_net.
 *  - n8n : le seul workflow qui parle aux restaurants est T7uX, et le modifier
 *    fait perdre les notifications de commande émises pendant la réactivation.
 *    On n'y touche pas.
 *  - pg_net (comme la copie Telegram au patron dans `notify_order_status`) :
 *    asynchrone, la base ne connaît pas la réponse de Telegram au moment
 *    d'écrire. Or l'admin ne doit JAMAIS afficher « envoyé » sans que Telegram
 *    l'ait confirmé. Ici on attend la réponse, et on l'écrit.
 *
 * LE JETON DU ROBOT reste dans le Vault (`telegram_bot_token`). Il est lu par
 * `lire_jeton_telegram()`, exécutable par service_role SEULEMENT. Il ne quitte
 * jamais cette fonction : ni dans la réponse, ni dans les journaux, ni dans le
 * message d'erreur enregistré (voir `nettoyer`).
 *
 * Authentification : `verify_jwt = false` (config.toml), et la fonction vérifie
 * elle-même, comme `envoyer-annonce` : la clé `anon` est un JWT valide, `true`
 * ne prouverait rien. On exige `user_roles.role = 'admin'` ACTIF.
 *
 * Deux usages :
 *   { settlement_id }  → le vrai message, au canal ACTUEL du restaurant.
 *   { essai: true }    → un message d'EXEMPLE sur le canal admin
 *                        (`telegram_admin_chat_id`, celui d'aucun restaurant).
 *                        Aucun versement lu ni écrit.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DELAI_TELEGRAM_MS = 10000;

function json(code: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

type ReponseTelegram = {
  ok?: boolean;
  result?: { message_id?: number };
  error_code?: number;
  description?: string;
};

type Envoi =
  | { ok: true; message_id: number }
  | { ok: false; erreur: string };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ------------------------------------------------------------ 1. L'APPELANT
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_absent' });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_invalide' });

  const { data: role, error: roleError } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle();
  if (roleError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_role' });
  if (!role) return json(403, { erreur: 'autorisation_refusee', code: 'reserve_aux_admins' });

  // -------------------------------------------------------------- 2. L'ENTRÉE
  let corps: { settlement_id?: string; essai?: boolean };
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: 'entree_invalide' });
  }
  const essai = corps?.essai === true;
  const id = typeof corps?.settlement_id === 'string' ? corps.settlement_id : null;
  if (!essai && !id) return json(400, { erreur: 'entree_invalide', code: 'settlement_id_manquant' });

  // --------------------------------------------------------------- 3. LE JETON
  const { data: jeton, error: jetonError } = await admin.rpc('lire_jeton_telegram');
  if (jetonError || typeof jeton !== 'string' || !jeton) {
    // Rien n'est pris : le versement reste « à envoyer » et le bouton reste là.
    return json(503, { statut: 'echec', erreur: 'Jeton du robot Telegram absent du Vault' });
  }

  /** Aucune chaîne qui sort d'ici ne doit contenir le jeton. */
  const nettoyer = (s: string) => s.split(jeton).join('<jeton>');

  async function envoyer(chat_id: string, texte: string): Promise<Envoi> {
    const ctrl = new AbortController();
    const minuteur = setTimeout(() => ctrl.abort(), DELAI_TELEGRAM_MS);
    try {
      const r = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Texte brut, pas de parse_mode : une référence saisie ne peut rien
        // mettre en forme ni casser l'envoi.
        body: JSON.stringify({ chat_id, text: texte, disable_web_page_preview: true }),
        signal: ctrl.signal,
      });
      const rep = (await r.json().catch(() => null)) as ReponseTelegram | null;
      if (rep?.ok === true && typeof rep.result?.message_id === 'number') {
        return { ok: true, message_id: rep.result.message_id };
      }
      return {
        ok: false,
        erreur: nettoyer(`Telegram a refusé (${rep?.error_code ?? r.status}) : ${rep?.description ?? 'réponse illisible'}`),
      };
    } catch (e) {
      const delai = (e as Error)?.name === 'AbortError';
      return {
        ok: false,
        erreur: delai
          ? 'Pas de réponse de Telegram en 10 s. Le message a PU partir : regarder le groupe avant de renvoyer.'
          : nettoyer(`Telegram injoignable : ${(e as Error)?.message ?? 'erreur réseau'}`),
      };
    } finally {
      clearTimeout(minuteur);
    }
  }

  // --------------------------------------------------------------- 4a. L'ESSAI
  if (essai) {
    const { data, error } = await admin.rpc('versement_essai_telegram');
    const ligne = Array.isArray(data) ? data[0] : data;
    if (error || !ligne?.chat_id) {
      return json(503, { statut: 'echec', erreur: 'Canal admin Telegram absent du Vault' });
    }
    const res = await envoyer(ligne.chat_id, ligne.texte);
    return res.ok
      ? json(200, { statut: 'envoye', essai: true, message_id: res.message_id })
      : json(502, { statut: 'echec', essai: true, erreur: res.erreur });
  }

  // ------------------------------------------------------- 4b. LE VRAI MESSAGE
  const { data: prise, error: priseError } = await admin.rpc('versement_prendre_envoi', {
    p_settlement_id: id,
  });
  if (priseError) {
    const m = priseError.message ?? '';
    if (m.includes('deja_envoye')) return json(409, { statut: 'envoye', erreur: 'Message déjà envoyé et confirmé par Telegram' });
    if (m.includes('envoi_en_cours')) return json(409, { statut: 'en_cours', erreur: 'Un envoi est déjà en cours pour ce versement' });
    if (m.includes('versement_introuvable')) return json(404, { erreur: 'versement_introuvable' });
    if (m.includes('versement_sans_reference')) return json(409, { erreur: 'Versement ancien, sans référence : aucun message prévu' });
    return json(500, { erreur: 'erreur_serveur', code: 'prise_envoi' });
  }
  const ligne = Array.isArray(prise) ? prise[0] : prise;
  if (!ligne?.chat_id) {
    return json(200, { statut: 'sans_canal', erreur: 'Ce restaurant n’a pas de groupe Telegram' });
  }

  const res = await envoyer(ligne.chat_id, ligne.texte);
  const { error: noteError } = await admin.rpc('versement_noter_envoi', {
    p_settlement_id: id,
    p_ok: res.ok,
    p_message_id: res.ok ? res.message_id : null,
    p_erreur: res.ok ? null : res.erreur,
  });
  if (noteError) {
    // Le message est peut-être parti, mais la base ne le sait pas : on le dit.
    console.error('notifier-versement: resultat non enregistre', noteError.message);
    return json(500, {
      statut: res.ok ? 'envoye_non_enregistre' : 'echec',
      erreur: 'Résultat de l’envoi non enregistré en base',
    });
  }
  return res.ok
    ? json(200, { statut: 'envoye', message_id: res.message_id })
    : json(502, { statut: 'echec', erreur: res.erreur });
});
