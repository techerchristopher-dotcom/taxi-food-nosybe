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
type Audience = 'client' | 'restaurant' | 'livreur' | 'livreur_assigne';

type Payload = {
  order_id: string;
  status: string;
  /** true quand c'est la prise en charge par le livreur, pas un changement de statut. */
  picked_up?: boolean;
  /**
   * 'nouvelle' pour un INSERT, 'statut' (défaut) pour un UPDATE, 'noter' pour la
   * relance « Comment c'était ? » envoyée par pg_cron (`relancer_avis_a_donner`)
   * ~40 min après la livraison. 'relance' : le restaurant n'a pas répondu en 3 min,
   * on le relance et on prévient le client (`alerter_commandes_sans_reponse`, 2026-10-12).
   */
  event?: 'nouvelle' | 'statut' | 'noter' | 'relance' | 'attente_client' | 'client_a_repondu'
    /** Plat manquant (2026-10-20) : au client (relance 1 ou 2), puis au restaurant quand c'est tranché. */
    | 'modification' | 'modification_retiree' | 'modification_faite';
  /** Rang de la relance « client injoignable » (1 à 3). */
  relance?: number;
  /**
   * Jalon livreur. `assigned` : il vient d'appuyer sur « Je prends la commande » et part
   * vers le restaurant (2026-10-07). `arriving` / `arrived` : après la récupération,
   * « J'arrive » / « Je suis là ».
   */
  phase?: 'assigned' | 'arriving' | 'arrived' | null;
};

type Order = {
  id: string;
  order_number: string | null;
  user_id: string;
  restaurant_id: string;
  courier_id: string | null;
  status: string;
  cancellation_reason: string | null;
  /** Motif de refus choisi par le restaurant (2026-10-05) — NULL pour un refus ancien. */
  cancellation_code: string | null;
  /** Précision libre du restaurant, déjà nettoyée par la base. */
  cancellation_detail: string | null;
  /** Qui a annulé (2026-10-19) : restaurant | admin | client | systeme. */
  annulee_par: string | null;
  picked_up_at: string | null;
  /** Plat manquant (2026-10-20) : 'retire' | 'annule' une fois que le client a choisi. */
  modif_resolution: string | null;
  modif_attente_depuis: string | null;
  restaurants: { name: string } | null;
};

/**
 * Motifs de refus, dans la langue du CLIENT. Mêmes codes que la base
 * (`orders_cancellation_code_check`, `libelle_motif_refus`) et que l'app
 * (`refusal.codes.*` dans `app/locales`). La précision libre du restaurant, elle,
 * n'est jamais traduite.
 */
const MOTIFS_REFUS: Record<string, Record<Lang, string>> = {
  rupture: {
    fr: 'Un ou plusieurs plats ne sont plus disponibles',
    en: 'One or more dishes are no longer available',
    it: 'Uno o più piatti non sono più disponibili',
  },
  trop_de_commandes: {
    fr: 'Trop de commandes en ce moment',
    en: 'Too many orders right now',
    it: 'Troppi ordini in questo momento',
  },
  fermeture: {
    fr: 'Le restaurant ferme ou est fermé',
    en: 'The restaurant is closing or closed',
    it: 'Il ristorante sta chiudendo o è chiuso',
  },
  livraison_impossible: {
    fr: 'Adresse trop éloignée ou non desservie',
    en: 'Address too far away or outside the delivery area',
    it: 'Indirizzo troppo lontano o non servito',
  },
  autre: {
    fr: 'Le restaurant n’a pas pu accepter la commande',
    en: 'The restaurant could not accept the order',
    it: 'Il ristorante non ha potuto accettare l’ordine',
  },
};

/** Précision posée par `annuler_ma_reservation` : la seule façon de reconnaître une
 *  annulation faite par le client (le code reste `autre`). Même texte qu'en base. */
const ANNULEE_PAR_LE_CLIENT = 'Annulée par le client';

const MOT_MOTIF: Record<Lang, string> = { fr: 'Motif :', en: 'Reason:', it: 'Motivo:' };

/** Motif lisible dans la langue du client ; repli sur le texte composé par la base. */
function motifRefus(order: Order, lang: Lang): string | null {
  const libelles = order.cancellation_code ? MOTIFS_REFUS[order.cancellation_code] : undefined;
  if (!libelles) return order.cancellation_reason;
  const detail = order.cancellation_detail?.trim();
  if (order.cancellation_code === 'autre') return detail || libelles[lang] || libelles.fr;
  const libelle = libelles[lang] ?? libelles.fr;
  // Typographie : espace avant les deux-points en français seulement.
  return detail ? `${libelle}${lang === 'fr' ? ' : ' : ': '}${detail}` : libelle;
}

type TokenRow = { token: string; language: Lang; platform: string; app?: string; user_id?: string };

/**
 * Deux applications depuis le 2026-10-17 (Taxi Food et Taxi Food Livreur) : chaque jeton
 * porte son `app`. Client et restaurant → jetons de l'app client. Livreur → jetons de l'app
 * livreur s'il en a, sinon ses jetons de l'app client (livreur pas encore passé à la nouvelle
 * app). Sans ce tri, un même téléphone avec les deux apps recevrait tout en double.
 */
function trierParApplication(rows: TokenRow[], audience: Audience): TokenRow[] {
  if (audience !== 'livreur' && audience !== 'livreur_assigne') return rows.filter((r) => (r.app ?? 'client') === 'client');
  const avecApp = new Set(rows.filter((r) => r.app === 'livreur').map((r) => r.user_id));
  return rows.filter((r) => (avecApp.has(r.user_id) ? r.app === 'livreur' : (r.app ?? 'client') === 'client'));
}

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
  // Réservation annulée par le CLIENT lui-même (`annuler_ma_reservation`, 2026-10-16) :
  // le texte « annulee » dirait que le restaurant n'a pas pu l'honorer — faux, et c'est
  // le restaurant qu'il accuserait.
  annulee_client: {
    fr: { title: 'Réservation annulée ✅', body: 'Ta commande chez {resto} est bien annulée. Tu n’as rien à payer.' },
    en: { title: 'Booking cancelled ✅', body: 'Your order from {resto} has been cancelled. You have nothing to pay.' },
    it: { title: 'Prenotazione annullata ✅', body: 'Il tuo ordine da {resto} è stato annullato. Non devi pagare nulla.' },
  },
  // Le livreur ACCEPTE la course (« Je prends la commande ») : il part chercher la
  // commande au restaurant. Seul `courier_id` change — demande du porteur du projet,
  // 2026-10-07 : jusque-là le client n'apprenait rien entre « prête » et « récupérée ».
  assigned: {
    fr: { title: 'Un livreur s’occupe de ta commande 🛵', body: 'Il est en route vers {resto} pour la récupérer.' },
    en: { title: 'A courier is on your order 🛵', body: 'They are on their way to {resto} to pick it up.' },
    it: { title: 'Un rider si occupa del tuo ordine 🛵', body: 'Sta andando da {resto} a ritirarlo.' },
  },
  // Prise en charge par le livreur : le statut reste `en_livraison`, seul
  // `picked_up_at` change. C'est pourtant le moment que le client attend le plus.
  picked_up: {
    fr: { title: 'Le livreur est en route 🛵', body: 'Ta commande vient d’être récupérée chez {resto}.' },
    en: { title: 'Your courier is on the way 🛵', body: 'Your order has just been picked up at {resto}.' },
    it: { title: 'Il corriere sta arrivando 🛵', body: 'Il tuo ordine è stato appena ritirato da {resto}.' },
  },
  // Deux jalons du livreur (26/09/2026) : « J'arrive » à cinq minutes, « Je suis là »
  // devant la porte. Ce sont les deux moments où le client doit bouger.
  arriving: {
    fr: { title: 'Ton livreur arrive dans 5 minutes 🛵', body: 'Tiens-toi prêt, il est tout près.' },
    en: { title: 'Your courier arrives in 5 minutes 🛵', body: 'Get ready, they are very close.' },
    it: { title: 'Il tuo rider arriva tra 5 minuti 🛵', body: 'Tieniti pronto, è vicinissimo.' },
  },
  arrived: {
    fr: { title: 'Ton livreur est devant chez toi 📍', body: 'Il t’attend — sors le retrouver.' },
    en: { title: 'Your courier is at your door 📍', body: 'They are waiting for you — come out to meet them.' },
    it: { title: 'Il tuo rider è davanti a casa tua 📍', body: 'Ti sta aspettando — esci a riceverlo.' },
  },
  // Relance ~40 min après la livraison (pg_cron, `relancer_avis_a_donner`) : le
  // client a eu le temps de manger. Une seule, jamais deux — voir docs/NOTATION-AVIS.md.
  // Depuis le 2026-10-07 : +1 000 Ar au porte-monnaie (plus de code AVIS<PRENOM>).
  noter: {
    fr: { title: 'Alors, c’était comment ? ⭐', body: 'Note ta commande chez {resto} en 10 secondes — 1 000 Ar dans ton porte-monnaie.' },
    en: { title: 'So, how was it? ⭐', body: 'Rate your order from {resto} in 10 seconds — 1,000 Ar in your wallet.' },
    it: { title: 'Allora, com’era? ⭐', body: 'Valuta il tuo ordine da {resto} in 10 secondi — 1.000 Ar nel tuo portafoglio.' },
  },

  // Le restaurant n'a pas répondu en 3 min : on le relance (Telegram) et on le dit au
  // client, plutôt que de le laisser devant « Commande reçue » sans savoir (2026-10-12).
  relance_resto: {
    fr: { title: 'Le restaurant tarde un peu ⏳', body: '{resto} n’a pas encore confirmé ta commande. On le relance pour toi.' },
    en: { title: 'The restaurant is taking a moment ⏳', body: '{resto} hasn’t confirmed your order yet. We’re chasing them for you.' },
    it: { title: 'Il ristorante ci sta mettendo un po’ ⏳', body: '{resto} non ha ancora confermato il tuo ordine. Lo stiamo sollecitando per te.' },
  },

  // Client injoignable (2026-10-19) : le livreur ou le restaurant n'arrive pas à le
  // joindre. Trois relances, de plus en plus pressantes ; le tap ouvre le suivi, où un
  // bouton « Je suis là » lève le blocage.
  attente_client_1: {
    fr: { title: 'On n’arrive pas à te joindre 📞', body: 'Ta commande {numero} ({resto}) t’attend. Ouvre l’appli pour nous répondre.' },
    en: { title: 'We can’t reach you 📞', body: 'Your order {numero} ({resto}) is waiting. Open the app to reply.' },
    it: { title: 'Non riusciamo a contattarti 📞', body: 'Il tuo ordine {numero} ({resto}) ti aspetta. Apri l’app per risponderci.' },
  },
  attente_client_2: {
    fr: { title: 'Ton livreur te cherche 🛵', body: 'Réponds-nous pour ta commande {numero} : un tap sur « Je suis là » suffit.' },
    en: { title: 'Your courier is looking for you 🛵', body: 'Reply about your order {numero}: one tap on “I’m here” is enough.' },
    it: { title: 'Il tuo rider ti sta cercando 🛵', body: 'Rispondici per l’ordine {numero}: basta un tocco su “Ci sono”.' },
  },
  attente_client_3: {
    fr: { title: 'Dernier appel pour ta commande ⏳', body: 'Sans nouvelles de toi, ta commande {numero} risque d’être annulée.' },
    en: { title: 'Last call for your order ⏳', body: 'Without word from you, your order {numero} may be cancelled.' },
    it: { title: 'Ultima chiamata per il tuo ordine ⏳', body: 'Senza tue notizie, l’ordine {numero} potrebbe essere annullato.' },
  },

  // Plat manquant (2026-10-20) : le restaurant n'a plus un plat. Le client choisit dans
  // son suivi : retirer ce plat (le reste arrive) ou tout annuler.
  modification_1: {
    fr: { title: 'Un plat manque dans ta commande ✏️', body: '{resto} n’a plus un des plats de ta commande {numero}. Choisis : le retirer et recevoir le reste, ou annuler.' },
    en: { title: 'A dish is missing from your order ✏️', body: '{resto} has run out of one dish in your order {numero}. Choose: remove it and get the rest, or cancel.' },
    it: { title: 'Manca un piatto nel tuo ordine ✏️', body: '{resto} ha finito un piatto del tuo ordine {numero}. Scegli: toglierlo e ricevere il resto, o annullare.' },
  },
  modification_2: {
    fr: { title: 'Ta commande attend ton choix ⏳', body: 'Un plat manque chez {resto} ({numero}). Un tap : retirer ce plat ou annuler.' },
    en: { title: 'Your order is waiting for your choice ⏳', body: 'A dish is missing at {resto} ({numero}). One tap: remove it or cancel.' },
    it: { title: 'Il tuo ordine aspetta la tua scelta ⏳', body: 'Manca un piatto da {resto} ({numero}). Un tocco: toglierlo o annullare.' },
  },
  // Le restaurant (ou Taxi Food) a retiré le plat manquant après avoir eu le client au téléphone.
  modification_faite: {
    fr: { title: 'Ta commande est modifiée ✏️', body: 'Le plat manquant a été retiré de {numero}, comme convenu. {resto} prépare le reste.' },
    en: { title: 'Your order has been updated ✏️', body: 'The missing dish was removed from {numero}, as agreed. {resto} is preparing the rest.' },
    it: { title: 'Il tuo ordine è stato modificato ✏️', body: 'Il piatto mancante è stato tolto da {numero}, come concordato. {resto} prepara il resto.' },
  },
  // Le client (ou le restaurant après un appel) a annulé parce qu'un plat manquait.
  annulee_modif: {
    fr: { title: 'Commande annulée', body: 'Ta commande chez {resto} est annulée : un plat manquait. Tu n’as rien à payer.' },
    en: { title: 'Order cancelled', body: 'Your order from {resto} is cancelled: a dish was missing. You have nothing to pay.' },
    it: { title: 'Ordine annullato', body: 'Il tuo ordine da {resto} è annullato: mancava un piatto. Non devi pagare nulla.' },
  },

  // --- Restaurant ---
  modification_retiree: {
    fr: { title: 'Commande modifiée ✏️', body: '{numero} : le plat manquant est retiré. Préparez le reste.' },
  },
  nouvelle_commande: {
    fr: { title: 'Nouvelle commande 🛎️', body: 'Commande {numero} à confirmer.' },
  },

  // Annulée par TAXI FOOD (admin) : ne pas accuser le restaurant (2026-10-19).
  annulee_taxifood: {
    fr: { title: 'Commande annulée', body: 'Taxi Food a dû annuler ta commande chez {resto}.' },
    en: { title: 'Order cancelled', body: 'Taxi Food had to cancel your order from {resto}.' },
    it: { title: 'Ordine annullato', body: 'Taxi Food ha dovuto annullare il tuo ordine da {resto}.' },
  },
  // Annulée automatiquement (paiement non abouti, restaurant fermé à l'heure prévue…).
  annulee_systeme: {
    fr: { title: 'Commande annulée', body: 'Ta commande chez {resto} a été annulée.' },
    en: { title: 'Order cancelled', body: 'Your order from {resto} has been cancelled.' },
    it: { title: 'Ordine annullato', body: 'Il tuo ordine da {resto} è stato annullato.' },
  },
  // --- Livreurs ---
  // Le livreur qui avait PRIS la course (2026-10-19) : sans ce message, la course
  // disparaissait de son écran sans un mot, le repas parfois déjà en main.
  course_annulee: {
    fr: { title: 'Course annulée ❌', body: '{numero} chez {resto} est annulée : ne la livre pas.' },
  },
  course_annulee_recuperee: {
    fr: { title: 'Course annulée ❌', body: '{numero} chez {resto} est annulée. Tu l’as déjà récupérée : ne la livre pas, appelle Taxi Food.' },
  },
  client_a_repondu: {
    fr: { title: 'Le client a répondu ✅', body: '{numero} : le client est joignable, tu peux reprendre la course.' },
  },
  course_disponible: {
    fr: { title: 'Course disponible 🛵', body: '{resto} — commande {numero} prête à enlever.' },
  },
};

/** Écran à ouvrir au tap, selon le public visé. */
const ROUTES: Record<Audience, (order: Order) => string> = {
  client: (order) => `/order/${order.id}`,
  restaurant: () => '/(restaurant)',
  livreur: () => '/(livreur)',
  livreur_assigne: () => '/(livreur)',
};

/** La relance « noter » ouvre le suivi de commande directement sur le bloc de notation. */
function routeFor(audience: Audience, key: string, order: Order): string {
  if (audience === 'client' && key.startsWith('modification_')) return `/order/${order.id}?modifier=1`;
  if (audience === 'client' && key === 'noter') return `/order/${order.id}?noter=1`;
  if (audience === 'client' && key.startsWith('attente_client')) return `/order/${order.id}?repondre=1`;
  return ROUTES[audience](order);
}

function buildText(order: Order, key: string, lang: Lang) {
  const set = MESSAGES[key];
  if (!set) return null;
  const text = set[lang] ?? set.fr;
  if (!text) return null;
  const resto = order.restaurants?.name ?? 'Le restaurant';
  let body = text.body.replaceAll('{resto}', resto).replaceAll('{numero}', order.order_number ?? '');
  // Motif de refus : libellé du code traduit dans la langue du client, précision libre
  // du restaurant telle quelle. Sans code (refus ancien, annulation admin) : texte en base.
  const motif = key === 'annulee' || key === 'annulee_taxifood' ? motifRefus(order, lang) : null;
  if (motif) {
    body = `${body} ${MOT_MOTIF[lang] ?? MOT_MOTIF.fr} ${motif}`;
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
    .select('id, order_number, user_id, restaurant_id, courier_id, status, cancellation_reason, cancellation_code, cancellation_detail, annulee_par, picked_up_at, modif_resolution, modif_attente_depuis, restaurants(name)')
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
  } else if (payload.event === 'relance') {
    // Seulement si la commande attend toujours : acceptée entre-temps, on se tait.
    if (order.status === 'recue') envois.push({ audience: 'client', key: 'relance_resto' });
  } else if (payload.event === 'attente_client') {
    // La base a posé l'état ; terminée entre-temps, on se tait.
    if (order.status !== 'livree' && order.status !== 'annulee') {
      const rang = Math.min(Math.max(payload.relance ?? 1, 1), 3);
      envois.push({ audience: 'client', key: `attente_client_${rang}` });
    }
  } else if (payload.event === 'modification') {
    // Seulement si on attend toujours le client : tranché entre-temps, on se tait.
    if (order.modif_attente_depuis && order.status !== 'livree' && order.status !== 'annulee') {
      envois.push({ audience: 'client', key: (payload.relance ?? 1) >= 2 ? 'modification_2' : 'modification_1' });
    }
  } else if (payload.event === 'modification_retiree') {
    envois.push({ audience: 'restaurant', key: 'modification_retiree' });
  } else if (payload.event === 'modification_faite') {
    if (order.status !== 'annulee') envois.push({ audience: 'client', key: 'modification_faite' });
  } else if (payload.event === 'client_a_repondu') {
    if (order.courier_id) envois.push({ audience: 'livreur_assigne', key: 'client_a_repondu' });
  } else if (payload.event === 'noter') {
    // La base a déjà vérifié : livrée, sans avis, jamais relancée.
    if (order.status === 'livree') envois.push({ audience: 'client', key: 'noter' });
  } else {
    const parLeClient = payload.status === 'annulee' && order.cancellation_code === 'autre'
      && order.cancellation_detail === ANNULEE_PAR_LE_CLIENT;
    const annulee = payload.status === 'annulee' && !payload.phase && !payload.picked_up;
    const cleAnnulation = order.modif_resolution === 'annule' ? 'annulee_modif'
      : parLeClient || order.annulee_par === 'client' ? 'annulee_client'
      : order.annulee_par === 'admin' ? 'annulee_taxifood'
      : order.annulee_par === 'systeme' ? 'annulee_systeme' : 'annulee';
    const key = payload.phase ? payload.phase : payload.picked_up ? 'picked_up'
      : annulee ? cleAnnulation : payload.status;
    if (MESSAGES[key]) envois.push({ audience: 'client', key });
    // Le livreur qui avait pris la course est prévenu de l'annulation.
    if (annulee && order.courier_id) {
      envois.push({ audience: 'livreur_assigne', key: order.picked_up_at ? 'course_annulee_recuperee' : 'course_annulee' });
    }
    // Course libérée par le restaurant et pas encore prise : les livreurs disponibles
    // sont prévenus. Si `courier_id` est déjà rempli, la course est attribuée — inutile
    // de réveiller tout le monde pour rien.
    if (!payload.phase && !payload.picked_up && payload.status === 'en_livraison' && !order.courier_id) {
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
    } else if (audience === 'livreur_assigne') {
      userIds = order!.courier_id ? [order!.courier_id] : [];
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
      .select('token, language, platform, app, user_id')
      .in('user_id', userIds)
      .returns<TokenRow[]>();
    return trierParApplication(tokens ?? [], audience);
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
          route: routeFor(envoi.audience, envoi.key, order),
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
