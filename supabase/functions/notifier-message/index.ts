/**
 * notifier-message — messagerie de commande (2026-10-13).
 *
 * Deux usages, un seul secret (`x-hook-secret` = Vault `push_hook_secret`, comme
 * notify-order) :
 *   - `{ message_id }` : appelé par le trigger `messages_commande_notifier` (pg_net) à
 *     chaque message. Prévient par push les AUTRES participants de la commande :
 *     client, livreur assigné, staff du restaurant — jamais l'auteur lui-même.
 *   - `{ action: 'purge' }` : appelé chaque nuit par pg_cron. Supprime du bucket
 *     `messages` les photos de plus de 90 jours (décision du 2026-10-13) par l'API
 *     Storage — une suppression SQL dans storage.objects laisserait le fichier.
 *
 * ⚠️ Volontairement SÉPARÉE de notify-order (même règle qu'envoyer-annonce) : un
 * déploiement de la messagerie ne doit jamais pouvoir casser l'annonce d'une commande
 * au restaurant. La mécanique Expo est recopiée, pas factorisée.
 *
 * Le Telegram du restaurant, lui, part de la base (`messagerie_notifier()`), comme
 * `alerter_message_prive()`.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Lang = 'fr' | 'en' | 'it';
type Role = 'client' | 'livreur' | 'restaurant' | 'admin';

const ROLES: Record<Role, Record<Lang, string>> = {
  client: { fr: 'client', en: 'customer', it: 'cliente' },
  livreur: { fr: 'livreur', en: 'rider', it: 'fattorino' },
  restaurant: { fr: 'restaurant', en: 'restaurant', it: 'ristorante' },
  admin: { fr: 'Taxi Food', en: 'Taxi Food', it: 'Taxi Food' },
};
const PHOTO: Record<Lang, string> = { fr: '📷 Photo', en: '📷 Photo', it: '📷 Foto' };

type Message = {
  id: string;
  order_id: string;
  auteur_id: string | null;
  auteur_role: Role;
  texte: string | null;
  photo_path: string | null;
};
type Order = {
  id: string;
  order_number: string | null;
  user_id: string | null;
  courier_id: string | null;
  restaurant_id: string;
  restaurants: { name: string } | null;
};
type TokenRow = { token: string; language: Lang; user_id: string };

function prenom(full: string | null | undefined): string | null {
  const p = (full ?? '').trim().split(/\s+/)[0];
  return p || null;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: expected, error: secretError } = await supabase.rpc('push_hook_secret');
  if (secretError || !expected) return new Response('server misconfigured', { status: 500 });
  if (req.headers.get('x-hook-secret') !== expected) return new Response('forbidden', { status: 403 });

  let body: { message_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // ───────────── Purge des photos de plus de 90 jours ─────────────
  if (body.action === 'purge') {
    const limite = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: vieux, error } = await supabase
      .from('messages_commande')
      .select('id, photo_path, texte')
      .not('photo_path', 'is', null)
      .lt('created_at', limite)
      .limit(500)
      .returns<{ id: string; photo_path: string; texte: string | null }[]>();
    if (error) return Response.json({ ok: false, erreur: error.message }, { status: 500 });
    if (!vieux?.length) return Response.json({ ok: true, purgees: 0 });
    const { error: rmError } = await supabase.storage.from('messages').remove(vieux.map((m) => m.photo_path));
    if (rmError) return Response.json({ ok: false, erreur: rmError.message }, { status: 500 });
    let maj = 0;
    for (const m of vieux) {
      const { error: e } = await supabase
        .from('messages_commande')
        .update({ photo_path: null, texte: m.texte ?? '📷 Photo supprimée après 90 jours' })
        .eq('id', m.id);
      if (!e) maj++;
    }
    return Response.json({ ok: true, purgees: vieux.length, lignes: maj });
  }

  // ───────────── Notification d'un nouveau message ─────────────
  if (!body.message_id) return new Response('bad request', { status: 400 });
  const { data: m } = await supabase
    .from('messages_commande')
    .select('id, order_id, auteur_id, auteur_role, texte, photo_path')
    .eq('id', body.message_id)
    .single<Message>();
  if (!m) return new Response('message not found', { status: 404 });
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, user_id, courier_id, restaurant_id, restaurants(name)')
    .eq('id', m.order_id)
    .single<Order>();
  if (!order) return new Response('order not found', { status: 404 });

  // Nom de l'auteur, tel qu'affiché dans la conversation.
  let nomAuteur: string | null = null;
  if (m.auteur_role === 'restaurant') nomAuteur = order.restaurants?.name ?? null;
  else if (m.auteur_role === 'admin') nomAuteur = 'Taxi Food';
  else if (m.auteur_id) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', m.auteur_id).maybeSingle<{ full_name: string | null }>();
    nomAuteur = prenom(p?.full_name);
  }

  // Destinataires : chaque participant SAUF l'auteur. Un même compte n'est prévenu qu'une
  // fois, sous son premier rôle (client, puis livreur, puis restaurant).
  const destinataires: { userId: string; role: Role }[] = [];
  const vus = new Set<string>(m.auteur_id ? [m.auteur_id] : []);
  const ajouter = (userId: string | null, role: Role) => {
    if (!userId || vus.has(userId)) return;
    vus.add(userId);
    destinataires.push({ userId, role });
  };
  if (m.auteur_role !== 'client') ajouter(order.user_id, 'client');
  if (m.auteur_role !== 'livreur') ajouter(order.courier_id, 'livreur');
  if (m.auteur_role !== 'restaurant') {
    const { data: staff } = await supabase
      .from('restaurant_staff')
      .select('user_id')
      .eq('restaurant_id', order.restaurant_id)
      .returns<{ user_id: string }[]>();
    for (const s of staff ?? []) ajouter(s.user_id, 'restaurant');
  }
  if (!destinataires.length) return Response.json({ sent: 0, reason: 'aucun destinataire' });

  const roleDe = new Map(destinataires.map((d) => [d.userId, d.role]));
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, language, user_id')
    .in('user_id', destinataires.map((d) => d.userId))
    .returns<TokenRow[]>();
  if (!tokens?.length) return Response.json({ sent: 0, reason: 'aucun appareil enregistré' });

  const apercu = (m.texte ?? '').replace(/\s+/g, ' ').trim();
  const messages = tokens.map((row) => {
    const lang: Lang = (['fr', 'en', 'it'] as const).includes(row.language) ? row.language : 'fr';
    const role = roleDe.get(row.user_id) ?? 'client';
    const qui =
      m.auteur_role === 'restaurant' || m.auteur_role === 'admin'
        ? nomAuteur ?? ROLES[m.auteur_role][lang]
        : nomAuteur
          ? `${nomAuteur} (${ROLES[m.auteur_role][lang]})`
          : ROLES[m.auteur_role][lang];
    let texte = apercu.length > 140 ? `${apercu.slice(0, 139)}…` : apercu;
    if (m.photo_path) texte = texte ? `${PHOTO[lang]} · ${texte}` : PHOTO[lang];
    return {
      to: row.token,
      title: `💬 ${qui} · ${order.order_number ?? ''}`.trim(),
      body: texte,
      sound: 'default',
      priority: 'high',
      channelId: 'commandes',
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        type: 'message',
        route: `/messages/${order.id}?role=${role}`,
      },
    };
  });

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => null);

  const dead: string[] = [];
  const tickets = result?.data;
  if (Array.isArray(tickets)) {
    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, i: number) => {
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(messages[i]!.to);
    });
  }
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent: messages.length, removed: dead.length });
});
