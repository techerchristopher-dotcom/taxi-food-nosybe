/**
 * notify-order — envoie les notifications push liées au cycle de vie d'une commande.
 *
 * Trois publics, un seul point d'entrée :
 *   - le **client**      : chaque changement d'état de sa commande ;
 *   - le **restaurant**  : une commande vient d'arriver ;
 *   - les **livreurs**   : une course vient d'être libérée par le restaurant.
 *
 * Appelée par les triggers Postgres `orders_notify_new` (INSERT) et
 * `orders_notify_status` (UPDATE) via pg_net, jamais par l'app.
 *
 * Authentification : `verify_jwt` est désactivé (l'appelant est la base, pas un
 * utilisateur), et la fonction vérifie elle-même un secret partagé passé en en-tête
 * `x-hook-secret`. Ce secret vit dans le Vault Supabase, chiffré ; le trigger le lit
 * pour l'émettre, la fonction le relit avec sa clé service_role pour le comparer.
 * Aucune clé ne circule en clair, et aucun réglage manuel n'est nécessaire côté
 * tableau de bord.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Lang = 'fr' | 'en' | 'it';
type Audience = 'client' | 'restaurant' | 'livreur';

type Payload = {
  order_id: string;
  status: string;
  /** true quand c'est la prise en charge par le livreur, pas un changement de statut. */
  picked_up?: boolean;
  /** 'nouvelle' pour un INSERT, 'statut' (défaut) pour un UPDATE. */
  event?: 'nouvelle' | 'statut';
};

type Order = {
  id: string;
  order_number: string | null;
  user_id: string;
  restaurant_id: string;
  courier_id: string | null;
  status: string;
  cancellation_reason: string | null;
  restaurants: { name: string } | null;
};

type TokenRow = { token: string; language: Lang; platform: string };

type Message = {
  to: string;
  title: string;
  body: string;
  sound: string;
  priority: string;
  channelId: string;
  data: Record<string, unknown>;
};

/**
 * Textes des notifications.
 *
 * Volontairement écrits ici et non tirés des dictionnaires de l'app : c'est le serveur
 * qui rédige, il n'a pas accès au bundle. Les deux jeux doivent rester cohérents —
 * toute reformulation côté app (`status.*`) devrait se répercuter ici.
 *
 * `{resto}` est remplacé par le nom du restaurant, tel qu'il est en base : on ne
 * traduit jamais un nom d'établissement. `{numero}` par `order_number` (TF-…).
 *
 * Les messages destinés au restaurant et aux livreurs n'existent qu'en français :
 * leurs écrans le sont aussi (décision produit). Le repli `?? set.fr` s'en charge si
 * leur jeton porte une autre langue.
 */
const MESSAGES: Record<string, Partial<Record<Lang, { title: string; body: string }>>> = {
  confirmee: {
    fr: { title: 'Commande confirmée ✅', body: '{resto} a accepté ta commande et va la préparer.' },
    en: { title: 'Order confirmed ✅', body: '{resto} accepted your order and will start preparing it.' },
    it: { title: 'Ordine confermato ✅', body: '{resto} ha accettato il tuo ordine e lo sta per preparare.' },
  },
  en_preparation: {
    fr: { title: 'En préparation 👨‍🍳', body: '{resto} prépare ta commande.' },
    en: { title: 'Being prepared 👨‍🍳', body: '{resto} is preparing your order.' },
    it: { title: 'In preparazione 👨‍🍳', body: '{resto} sta preparando il tuo ordine.' },
  },
  en_livraison: {
    fr: { title: 'Prête à partir 🛵', body: 'Ta commande attend un livreur.' },
    en: { title: 'Ready to go 🛵', body: 'Your order is waiting for a courier.' },
    it: { title: 'Pronto per la consegna 🛵', body: 'Il tuo ordine sta aspettando un corriere.' },
  },
  livree: {
    fr: { title: 'Commande livrée 🎉', body: 'Bon appétit ! Merci d’avoir commandé avec Taxi Food.' },
    en: { title: 'Order delivered 🎉', body: 'Enjoy your meal! Thanks for ordering with Taxi Food.' },
    it: { title: 'Ordine consegnato 🎉', body: 'Buon appetito! Grazie per aver ordinato con Taxi Food.' },
  },
  annulee: {
    fr: { title: 'Commande annulée', body: '{resto} n’a pas pu honorer ta commande.' },
    en: { title: 'Order cancelled', body: '{resto} could not fulfil your order.' },
    it: { title: 'Ordine annullato', body: '{resto} non ha potuto evadere il tuo ordine.' },
  },
  // Prise en charge par le livreur : le statut reste `en_livraison`, seul
  // `picked_up_at` change. C'est pourtant le moment que le client attend le plus.
  picked_up: {
    fr: { title: 'Le livreur est en route 🛵', body: 'Ta commande vient d’être récupérée chez {resto}.' },
    en: { title: 'Your courier is on the way 🛵', body: 'Your order has just been picked up at {resto}.' },
    it: { title: 'Il corriere sta arrivando 🛵', body: 'Il tuo ordine è stato appena ritirato da {resto}.' },
  },

  // --- Restaurant ---
  nouvelle_commande: {
    fr: { title: 'Nouvelle commande 🛎️', body: 'Commande {numero} à confirmer.' },
  },

  // --- Livreurs ---
  course_disponible: {
    fr: { title: 'Course disponible 🛵', body: '{resto} — commande {numero} prête à enlever.' },
  },
};

/** Écran à ouvrir au tap, selon le public visé. */
const ROUTES: Record<Audience, (order: Order) => string> = {
  client: (order) => `/order/${order.id}`,
  restaurant: () => '/(restaurant)',
  livreur: () => '/(livreur)',
};

function buildText(order: Order, key: string, lang: Lang) {
  const set = MESSAGES[key];
  if (!set) return null;
  const text = set[lang] ?? set.fr;
  if (!text) return null;
  const resto = order.restaurants?.name ?? 'Le restaurant';
  let body = text.body.replaceAll('{resto}', resto).replaceAll('{numero}', order.order_number ?? '');
  // Le motif de refus est saisi par le restaurant : on le montre tel quel, jamais traduit.
  if (key === 'annulee' && order.cancellation_reason) {
    body = `${body} Motif : ${order.cancellation_reason}`;
  }
  return { title: text.title, body };
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- Authentification de l'appelant (la base) ---
  const { data: expected, error: secretError } = await supabase.rpc('push_hook_secret');
  if (secretError || !expected) {
    console.error('secret introuvable', secretError);
    return new Response('server misconfigured', { status: 500 });
  }
  if (req.headers.get('x-hook-secret') !== expected) {
    return new Response('forbidden', { status: 403 });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }
  if (!payload?.order_id) return new Response('bad request', { status: 400 });

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, user_id, restaurant_id, courier_id, status, cancellation_reason, restaurants(name)')
    .eq('id', payload.order_id)
    .single<Order>();
  if (orderError || !order) {
    console.error('commande introuvable', payload.order_id, orderError);
    return new Response('order not found', { status: 404 });
  }

  // --- Qui prévenir, et avec quel message ---
  const envois: { audience: Audience; key: string }[] = [];
  if (payload.event === 'nouvelle') {
    // Le client vient de la passer, il est devant son écran : lui seul n'a rien à recevoir.
    envois.push({ audience: 'restaurant', key: 'nouvelle_commande' });
  } else {
    const key = payload.picked_up ? 'picked_up' : payload.status;
    if (MESSAGES[key]) envois.push({ audience: 'client', key });
    // Course libérée par le restaurant et pas encore prise : les livreurs disponibles
    // sont prévenus. Si `courier_id` est déjà rempli, la course est attribuée — inutile
    // de réveiller tout le monde pour rien.
    if (!payload.picked_up && payload.status === 'en_livraison' && !order.courier_id) {
      envois.push({ audience: 'livreur', key: 'course_disponible' });
    }
  }
  if (!envois.length) {
    return Response.json({ skipped: `aucun message pour "${payload.status}"` });
  }

  // --- Destinataires ---
  async function tokensFor(audience: Audience): Promise<TokenRow[]> {
    let userIds: string[];
    if (audience === 'client') {
      userIds = [order.user_id];
    } else if (audience === 'restaurant') {
      const { data } = await supabase
        .from('restaurant_staff')
        .select('user_id')
        .eq('restaurant_id', order.restaurant_id)
        .returns<{ user_id: string }[]>();
      userIds = (data ?? []).map((r) => r.user_id);
    } else {
      // Seulement les livreurs qui se sont déclarés disponibles : un livreur hors
      // service ne doit pas être réveillé à 23 h par une course qu'il ne prendra pas.
      const { data } = await supabase
        .from('couriers')
        .select('user_id')
        .eq('is_available', true)
        .returns<{ user_id: string }[]>();
      userIds = (data ?? []).map((r) => r.user_id);
    }
    if (!userIds.length) return [];
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token, language, platform')
      .in('user_id', userIds)
      .returns<TokenRow[]>();
    return tokens ?? [];
  }

  const messages: Message[] = [];
  for (const envoi of envois) {
    for (const row of await tokensFor(envoi.audience)) {
      const text = buildText(order, envoi.key, row.language);
      if (!text) continue;
      messages.push({
        to: row.token,
        title: text.title,
        body: text.body,
        sound: 'default',
        priority: 'high',
        channelId: 'commandes',
        // Repris par l'app au tap pour ouvrir directement le bon écran.
        data: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: order.status,
          route: ROUTES[envoi.audience](order),
        },
      });
    }
  }

  if (!messages.length) return Response.json({ sent: 0, reason: 'aucun appareil enregistré' });

  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await response.json().catch(() => null);

  // Expo répond 200 même quand un jeton individuel est mort. Un jeton
  // `DeviceNotRegistered` (app désinstallée) ne guérira jamais : on le supprime,
  // sinon la table grossit indéfiniment et chaque envoi traîne des échecs.
  const dead: string[] = [];
  const tickets = result?.data;
  if (Array.isArray(tickets)) {
    tickets.forEach((ticket: { status?: string; details?: { error?: string } }, i: number) => {
      if (ticket?.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(messages[i]!.to);
      }
    });
  }
  if (dead.length) await supabase.from('push_tokens').delete().in('token', dead);

  return Response.json({ sent: messages.length, removed: dead.length, expo: result });
});
