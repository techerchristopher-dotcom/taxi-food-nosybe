/**
 * notifier-message — messagerie (2026-10-13, lot 4).
 *
 * Un seul secret (`x-hook-secret` = Vault `push_hook_secret`, comme notify-order), trois
 * usages :
 *   - `{ message_id, type: 'commande' }` : message d'une conversation de commande (trigger
 *     `messages_commande_notifier`). Dans l'ordre :
 *       1. TRADUCTION par Claude (fr/en/it + langue d'origine), écrite sur le message —
 *          la base émet alors un signal temps réel et l'app relit le message traduit.
 *          Sans clé `anthropic_api_key` au Vault, on passe : rien ne casse ;
 *       2. PUSH aux autres participants (client, livreur, staff du restaurant), dans la
 *          langue de chaque appareil, traduit si possible ;
 *       3. TELEGRAM au restaurant quand le client ou le livreur écrit (dans sa langue, avec
 *          la traduction), et copie admin des messages du client et du restaurant. Un seul
 *          Telegram par minute et par auteur sur une commande.
 *   - `{ message_id, type: 'support' }` : conversation client ↔ Taxi Food (hors commande).
 *     Client → Telegram admin (avec traduction en français). Taxi Food → push au client.
 *   - `{ action: 'purge' }` : chaque nuit (pg_cron), photos de plus de 90 jours supprimées
 *     du bucket `messages` par l'API Storage.
 *
 * ⚠️ Volontairement SÉPARÉE de notify-order (même règle qu'envoyer-annonce) : un
 * déploiement de la messagerie ne doit jamais pouvoir casser l'annonce d'une commande.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { z } from 'npm:zod@3';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LANGUES = ['fr', 'en', 'it'] as const;

type Lang = 'fr' | 'en' | 'it';
type Role = 'client' | 'livreur' | 'restaurant' | 'admin';
type Traductions = Partial<Record<Lang, string>>;

const ROLES: Record<Role, Record<Lang, string>> = {
  client: { fr: 'client', en: 'customer', it: 'cliente' },
  livreur: { fr: 'livreur', en: 'rider', it: 'fattorino' },
  restaurant: { fr: 'restaurant', en: 'restaurant', it: 'ristorante' },
  admin: { fr: 'Taxi Food', en: 'Taxi Food', it: 'Taxi Food' },
};
const PHOTO: Record<Lang, string> = { fr: '📷 Photo', en: '📷 Photo', it: '📷 Foto' };
const NOM_LANGUE: Record<string, string> = { fr: 'français', en: 'anglais', it: 'italien', mg: 'malgache', de: 'allemand', es: 'espagnol' };

type Message = {
  id: string;
  auteur_id: string | null;
  auteur_role: Role;
  texte: string | null;
  photo_path: string | null;
  created_at: string;
  order_id?: string;
  client_id?: string;
};
type Order = {
  id: string;
  order_number: string | null;
  user_id: string | null;
  courier_id: string | null;
  restaurant_id: string;
  restaurants: { name: string; langue: string | null; telegram_chat_id: string | null } | null;
};
type TokenRow = { token: string; language: Lang; user_id: string };

const SortieTraduction = z.object({
  langue_source: z.string(),
  fr: z.string(),
  en: z.string(),
  it: z.string(),
});

const CONSIGNES = `Tu traduis des messages échangés pendant une livraison de repas à Nosy Be (Madagascar) entre un client (souvent touriste), un livreur, un restaurant et l'équipe Taxi Food.

Rends :
- langue_source : code ISO 639-1 à deux lettres de la langue du message (fr, en, it, mg, de, es…) ;
- fr, en, it : le message traduit dans chacune de ces langues. Dans sa propre langue, recopie-le tel quel.

Règles : ton naturel et court, comme un SMS ; garde les emojis, numéros, heures, prix et noms propres ; ne réponds jamais au message, ne commente pas, traduis seulement. Si un message contient déjà deux langues séparées par « · », traduis le sens une seule fois.`;

function prenom(full: string | null | undefined): string | null {
  const p = (full ?? '').trim().split(/\s+/)[0];
  return p || null;
}

function langueDe(l: unknown): Lang {
  return (LANGUES as readonly string[]).includes(String(l)) ? (l as Lang) : 'fr';
}

/** Traduit un texte ; null si pas de clé, refus, délai dépassé ou erreur. */
async function traduire(supabase: SupabaseClient, texte: string): Promise<{ source: string; t: Traductions } | null> {
  const { data: apiKey } = await supabase.rpc('anthropic_api_key');
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) return null;
  try {
    const client = new Anthropic({ apiKey, timeout: 12000, maxRetries: 1 });
    const r = await client.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(SortieTraduction) },
      system: CONSIGNES,
      messages: [{ role: 'user', content: texte }],
    });
    if (r.stop_reason === 'refusal' || !r.parsed_output) return null;
    const o = r.parsed_output;
    const source = o.langue_source.trim().toLowerCase().slice(0, 2);
    if (!/^[a-z]{2}$/.test(source)) return null;
    return { source, t: { fr: o.fr.trim(), en: o.en.trim(), it: o.it.trim() } };
  } catch (e) {
    console.warn('traduction impossible', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Texte à montrer à un lecteur de langue `lang` : traduit si la langue diffère. */
function pourLecteur(texte: string | null, source: string | null, t: Traductions | null, lang: Lang): string | null {
  if (!texte) return null;
  if (source && source !== lang && t?.[lang]) return t[lang]!;
  return texte;
}

async function envoyerPush(supabase: SupabaseClient, messages: Record<string, unknown>[]) {
  if (!messages.length) return { sent: 0, removed: 0 };
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
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') dead.push(String(messages[i]!.to));
    });
  }
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);
  return { sent: messages.length, removed: dead.length };
}

async function envoyerTelegram(jeton: string, chatId: string, texte: string): Promise<boolean> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texte, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: expected, error: secretError } = await supabase.rpc('push_hook_secret');
  if (secretError || !expected) return new Response('server misconfigured', { status: 500 });
  if (req.headers.get('x-hook-secret') !== expected) return new Response('forbidden', { status: 403 });

  let body: { message_id?: string; action?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // ───────────── Purge des photos de plus de 90 jours ─────────────
  if (body.action === 'purge') {
    const limite = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const bilan: Record<string, number> = {};
    for (const table of ['messages_commande', 'messages_support']) {
      const { data: vieux, error } = await supabase
        .from(table)
        .select('id, photo_path, texte')
        .not('photo_path', 'is', null)
        .lt('created_at', limite)
        .limit(500)
        .returns<{ id: string; photo_path: string; texte: string | null }[]>();
      if (error) return Response.json({ ok: false, erreur: error.message }, { status: 500 });
      if (!vieux?.length) {
        bilan[table] = 0;
        continue;
      }
      const { error: rmError } = await supabase.storage.from('messages').remove(vieux.map((m) => m.photo_path));
      if (rmError) return Response.json({ ok: false, erreur: rmError.message }, { status: 500 });
      for (const m of vieux) {
        await supabase.from(table).update({ photo_path: null, texte: m.texte ?? '📷 Photo supprimée après 90 jours' }).eq('id', m.id);
      }
      bilan[table] = vieux.length;
    }
    return Response.json({ ok: true, purgees: bilan });
  }

  if (!body.message_id) return new Response('bad request', { status: 400 });
  const support = body.type === 'support';
  const table = support ? 'messages_support' : 'messages_commande';

  const { data: m } = await supabase
    .from(table)
    .select(support ? 'id, client_id, auteur_id, auteur_role, texte, photo_path, created_at' : 'id, order_id, auteur_id, auteur_role, texte, photo_path, created_at')
    .eq('id', body.message_id)
    .single<Message>();
  if (!m) return new Response('message not found', { status: 404 });

  // ── 1. Traduction ──
  let source: string | null = null;
  let trad: Traductions | null = null;
  if (m.texte) {
    const r = await traduire(supabase, m.texte);
    if (r) {
      source = r.source;
      trad = r.t;
      await supabase.from(table).update({ langue_source: source, traductions: trad }).eq('id', m.id);
    }
  }

  const { data: jeton } = await supabase.rpc('lire_jeton_telegram');
  const { data: adminChat } = await supabase.rpc('lire_chat_telegram_admin');
  const chatAdmin: string | null = typeof adminChat === 'string' ? adminChat : null;

  // Une ligne « traduction » ajoutée sous l'original quand la langue diffère.
  const avecTraduction = (lang: Lang) => {
    if (!m.texte) return '';
    const original = `« ${m.texte} »`;
    if (source && source !== lang && trad?.[lang]) {
      const etiquette = lang === 'it' ? 'traduzione' : 'traduction';
      return `${original}\n(${etiquette} : « ${trad[lang]} »)`;
    }
    return original;
  };
  const lignePhoto = (lang: Lang) =>
    m.photo_path ? (lang === 'it' ? "📷 Foto (visibile nell'app)" : "📷 Photo (visible dans l'app)") : '';
  const contenu = (lang: Lang) => [avecTraduction(lang), lignePhoto(lang)].filter(Boolean).join('\n');

  // ───────────── Conversation avec Taxi Food (hors commande) ─────────────
  if (support) {
    const clientId = m.client_id!;
    if (m.auteur_role === 'client') {
      const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', clientId).maybeSingle<{ full_name: string | null; phone: string | null }>();
      const { data: recent } = await supabase
        .from('messages_support')
        .select('id')
        .eq('client_id', clientId)
        .eq('auteur_role', 'client')
        .neq('id', m.id)
        .gt('created_at', new Date(new Date(m.created_at).getTime() - 60000).toISOString())
        .limit(1);
      let tg = false;
      if (typeof jeton === 'string' && chatAdmin && !recent?.length) {
        const langueTxt = source && source !== 'fr' ? ` (écrit en ${NOM_LANGUE[source] ?? source})` : '';
        tg = await envoyerTelegram(
          jeton,
          chatAdmin,
          `🆘 Message à Taxi Food — ${p?.full_name ?? 'client'}${p?.phone ? ` · ${p.phone}` : ''}${langueTxt}\n\n${contenu('fr')}\n\nRépondre : admin → 💬 Messages → Clients.`,
        );
      }
      return Response.json({ telegram_admin: tg, traduit: !!trad });
    }
    // Taxi Food répond : push au client.
    const { data: tokens } = await supabase.from('push_tokens').select('token, language, user_id').eq('user_id', clientId).returns<TokenRow[]>();
    const messages = (tokens ?? []).map((row) => {
      const lang = langueDe(row.language);
      let texte = (pourLecteur(m.texte, source, trad, lang) ?? '').replace(/\s+/g, ' ').trim();
      if (texte.length > 140) texte = `${texte.slice(0, 139)}…`;
      if (m.photo_path) texte = texte ? `${PHOTO[lang]} · ${texte}` : PHOTO[lang];
      return {
        to: row.token,
        title: '💬 Taxi Food',
        body: texte,
        sound: 'default',
        priority: 'high',
        channelId: 'commandes',
        data: { type: 'support', route: '/aide' },
      };
    });
    return Response.json({ ...(await envoyerPush(supabase, messages)), traduit: !!trad });
  }

  // ───────────── Conversation d'une commande ─────────────
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, user_id, courier_id, restaurant_id, restaurants(name, langue, telegram_chat_id)')
    .eq('id', m.order_id!)
    .single<Order>();
  if (!order) return new Response('order not found', { status: 404 });

  let nomAuteur: string | null = null;
  if (m.auteur_role === 'restaurant') nomAuteur = order.restaurants?.name ?? null;
  else if (m.auteur_role === 'admin') nomAuteur = 'Taxi Food';
  else if (m.auteur_id) {
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', m.auteur_id).maybeSingle<{ full_name: string | null }>();
    nomAuteur = prenom(p?.full_name);
  }

  // ── 2. Push ──
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
    const { data: staff } = await supabase.from('restaurant_staff').select('user_id').eq('restaurant_id', order.restaurant_id).returns<{ user_id: string }[]>();
    for (const s of staff ?? []) ajouter(s.user_id, 'restaurant');
  }
  let push = { sent: 0, removed: 0 };
  if (destinataires.length) {
    const roleDe = new Map(destinataires.map((d) => [d.userId, d.role]));
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, language, user_id')
      .in('user_id', destinataires.map((d) => d.userId))
      .returns<TokenRow[]>();
    const messages = (tokens ?? []).map((row) => {
      const lang = langueDe(row.language);
      const role = roleDe.get(row.user_id) ?? 'client';
      const qui =
        m.auteur_role === 'restaurant' || m.auteur_role === 'admin'
          ? nomAuteur ?? ROLES[m.auteur_role][lang]
          : nomAuteur
            ? `${nomAuteur} (${ROLES[m.auteur_role][lang]})`
            : ROLES[m.auteur_role][lang];
      let texte = (pourLecteur(m.texte, source, trad, lang) ?? '').replace(/\s+/g, ' ').trim();
      if (texte.length > 140) texte = `${texte.slice(0, 139)}…`;
      if (m.photo_path) texte = texte ? `${PHOTO[lang]} · ${texte}` : PHOTO[lang];
      return {
        to: row.token,
        title: `💬 ${qui} · ${order.order_number ?? ''}`.trim(),
        body: texte,
        sound: 'default',
        priority: 'high',
        channelId: 'commandes',
        data: { orderId: order.id, orderNumber: order.order_number, type: 'message', route: `/messages/${order.id}?role=${role}` },
      };
    });
    push = await envoyerPush(supabase, messages);
  }

  // ── 3. Telegram (une fois par minute et par auteur sur la commande) ──
  const { data: recent } = await supabase
    .from('messages_commande')
    .select('id')
    .eq('order_id', order.id)
    .eq('auteur_role', m.auteur_role)
    .neq('id', m.id)
    .gt('created_at', new Date(new Date(m.created_at).getTime() - 60000).toISOString())
    .limit(1);
  let tgResto = false;
  let tgAdmin = false;
  if (typeof jeton === 'string' && !recent?.length) {
    const resto = order.restaurants;
    if ((m.auteur_role === 'client' || m.auteur_role === 'livreur') && resto?.telegram_chat_id) {
      const lang: Lang = resto.langue === 'it' ? 'it' : 'fr';
      const texte =
        lang === 'it'
          ? `💬 Messaggio ${m.auteur_role === 'client' ? 'del cliente' : 'del fattorino'} — ordine ${order.order_number ?? '?'}\n\n${contenu('it')}\n\nPer rispondere: app Taxi Food → ordini in corso → pulsante « Messages ».`
          : `💬 Message ${m.auteur_role === 'client' ? 'du client' : 'du livreur'} — commande ${order.order_number ?? '?'}\n\n${contenu('fr')}\n\nPour répondre : app Taxi Food → Commandes en cours → bouton « Messages ».`;
      tgResto = await envoyerTelegram(jeton, resto.telegram_chat_id, texte);
    }
    if ((m.auteur_role === 'client' || m.auteur_role === 'restaurant') && chatAdmin) {
      tgAdmin = await envoyerTelegram(
        jeton,
        chatAdmin,
        `💬 ${order.order_number ?? '?'} · ${resto?.name ?? '?'} — ${m.auteur_role === 'client' ? 'le client' : 'le restaurant'} écrit :\n${contenu('fr')}`,
      );
    }
  }

  return Response.json({ ...push, telegram_resto: tgResto, telegram_admin: tgAdmin, traduit: !!trad });
});
