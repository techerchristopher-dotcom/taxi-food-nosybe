/**
 * telegram-webhook — reçoit les messages adressés au robot @Taxifood_commandes_bot (2026-10-19).
 *
 * - Note chaque groupe où le robot voit passer un message (`telegram_chats_vus`) : c'est là
 *   qu'on lit désormais l'identifiant d'un nouveau groupe restaurant. Depuis que le webhook
 *   est posé, `getUpdates` ne répond plus (Telegram refuse les deux à la fois).
 * - Dans le groupe « Taxi Food — Clôtures de service » seulement : `/cloture`, `/cloture
 *   force`, `/etat`, `/aide`. La base décide de tout (`telegram_commande`) ; ici on ne fait
 *   que relayer sa réponse.
 *
 * Authentification : Telegram renvoie le `secret_token` donné à `setWebhook` dans l'en-tête
 * `X-Telegram-Bot-Api-Secret-Token` (Vault `telegram_webhook_secret`). On répond toujours
 * 200 à Telegram une fois authentifié — sinon il rejoue le même message en boucle.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: secret } = await supabase.rpc('lire_telegram_webhook_secret');
  const recu = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!secret || !egal(recu, String(secret))) return new Response('forbidden', { status: 403 });

  let update: Record<string, any>;
  try {
    update = await req.json();
  } catch {
    return new Response('ok');
  }
  const msg = update.message ?? update.edited_message ?? update.channel_post ?? update.my_chat_member;
  const chat = msg?.chat;
  if (!chat?.id) return new Response('ok');

  const auteur = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username || '';
  await supabase.rpc('telegram_noter_chat', {
    p_chat_id: chat.id,
    p_titre: chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ') ?? '',
    p_type: chat.type ?? '',
    p_auteur: auteur,
  });

  const texte: string = typeof msg.text === 'string' ? msg.text : '';
  if (!texte.startsWith('/')) return new Response('ok');

  const { data: reponse, error } = await supabase.rpc('telegram_commande', {
    p_chat_id: chat.id,
    p_texte: texte,
    p_auteur: auteur,
  });
  if (error) console.error('telegram_commande', error.message);
  const corps = error ? `⚠️ Erreur : ${error.message}` : String(reponse ?? '');
  if (!corps) return new Response('ok');

  const { data: jeton } = await supabase.rpc('lire_jeton_telegram');
  if (!jeton) return new Response('ok');
  await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat.id, text: corps.slice(0, 4000), reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true } }),
  }).catch((e) => console.error('sendMessage', String(e).replaceAll(String(jeton), '***')));
  return new Response('ok');
});
