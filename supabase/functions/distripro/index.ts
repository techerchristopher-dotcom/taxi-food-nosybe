/**
 * distripro — le pont entre l'espace partenaire Taxi Food et DistriPro.
 *
 * Le partenaire (restaurant actif) commande ses emballages, frites et légumes à
 * DistriPro SANS second compte : il est reconnu par sa session Taxi Food.
 *
 *   App (onglet « Commander »)  --JWT Taxi Food-->  cette fonction
 *     1. vérifie le jeton de l'appelant ;
 *     2. établit le restaurant : celui demandé (sélecteur) ou le restaurant actif,
 *        et exige `is_active_restaurant_staff_of` (évalué AVEC le jeton de l'appelant) ;
 *     3. relie le restaurant à un client DistriPro (créé au premier passage) ;
 *     4. appelle les RPC `pont_*` de DistriPro avec le secret du pont (Vault Taxi Food,
 *        DistriPro n'en garde que l'empreinte SHA-256).
 *
 * Le catalogue, lui, est public : l'app le lit directement sur DistriPro.
 * Aucun prix, aucun total n'est calculé ici : DistriPro (`creer_commande`) fait foi.
 *
 * Actions (corps JSON `{ action, restaurant_id?, ... }`) :
 *   session        → { restaurant, client_id }
 *   commander      → { lignes, date_livraison, paiement_mode, commentaire }
 *   mes_commandes  → liste
 *   document       → { numero }  (bon de commande / BL / facture)
 *
 * `verify_jwt = false` dans config.toml (la clé anon est un JWT valide : `true` ne
 * prouverait rien) ; la fonction exige elle-même un utilisateur réel.
 * Déployée depuis ce dépôt ; l'original fait foi ici.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

// DistriPro — URL et clé PUBLIABLE (publiques par conception, comme sur son site).
const DP_URL = 'https://tlnpkvveeqzefghhywfe.supabase.co';
const DP_KEY = 'sb_publishable__Vw3KFYROnVbwMVQlhteew_OHAnxwGC';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(code: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function dp(fonction: string, params: Record<string, unknown>) {
  const r = await fetch(`${DP_URL}/rest/v1/rpc/${fonction}`, {
    method: 'POST',
    headers: { apikey: DP_KEY, Authorization: `Bearer ${DP_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const texte = await r.text();
  let corps: unknown = null;
  try { corps = JSON.parse(texte); } catch { corps = { ok: false, reason: 'reponse_illisible' }; }
  if (!r.ok) return { ok: false, reason: 'distripro_indisponible', status: r.status } as Record<string, unknown>;
  return corps as Record<string, unknown>;
}

function ar(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, reason: 'methode' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1. L'appelant
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(401, { ok: false, reason: 'jeton_absent' });
  const { data: auth } = await service.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json(401, { ok: false, reason: 'jeton_invalide' });
  const commeLui = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  let corps: Record<string, unknown>;
  try { corps = await req.json(); } catch { return json(400, { ok: false, reason: 'entree_invalide' }); }
  const action = String(corps?.action ?? '');

  // 2. Le restaurant : demandé, sinon le restaurant actif ; toujours vérifié
  let restaurantId = typeof corps.restaurant_id === 'string' ? corps.restaurant_id : null;
  if (!restaurantId) {
    const { data } = await commeLui.rpc('current_restaurant_id');
    restaurantId = (data as string | null) ?? null;
  }
  if (!restaurantId) return json(403, { ok: false, reason: 'pas_partenaire' });
  const { data: estStaff } = await commeLui.rpc('is_active_restaurant_staff_of', { p_restaurant_id: restaurantId });
  if (estStaff !== true) return json(403, { ok: false, reason: 'pas_partenaire' });

  const { data: resto } = await service
    .from('restaurants').select('id, name, phone, zone_served').eq('id', restaurantId).maybeSingle();
  if (!resto) return json(404, { ok: false, reason: 'restaurant_introuvable' });

  const { data: secret } = await service.rpc('distripro_pont_secret');
  if (!secret) return json(500, { ok: false, reason: 'pont_non_configure' });

  // 3. Liaison (créée au premier passage, nom/téléphone tenus à jour)
  const relie = await dp('pont_relier_client', {
    p_secret: secret, p_restaurant_id: resto.id, p_nom: resto.name,
    p_telephone: resto.phone ?? null, p_zone: resto.zone_served ?? null,
  });
  if (!relie?.ok) return json(502, { ok: false, reason: relie?.reason ?? 'liaison' });
  if (relie.actif === false) return json(403, { ok: false, reason: 'compte_distripro_desactive' });
  await service.from('distripro_liaisons').upsert({
    restaurant_id: resto.id, distripro_client_id: relie.client_id as number, relie_par: user.id,
  }, { onConflict: 'restaurant_id', ignoreDuplicates: true });

  const restaurant = { id: resto.id, nom: resto.name };

  // 4. Les actions
  if (action === 'session') {
    return json(200, { ok: true, restaurant, client_id: relie.client_id });
  }

  if (action === 'mes_commandes') {
    const r = await dp('pont_mes_commandes', { p_secret: secret, p_restaurant_id: resto.id });
    return json(200, { ...r, restaurant });
  }

  if (action === 'document') {
    const numero = String(corps.numero ?? '').trim();
    if (!numero) return json(400, { ok: false, reason: 'numero_manquant' });
    const r = await dp('pont_document', { p_secret: secret, p_restaurant_id: resto.id, p_numero: numero });
    return json(200, r);
  }

  if (action === 'commander') {
    const r = await dp('pont_creer_commande', {
      p_secret: secret, p_restaurant_id: resto.id,
      p_lignes: corps.lignes ?? [], p_date_livraison: corps.date_livraison ?? null,
      p_paiement_mode: corps.paiement_mode ?? null, p_commentaire: corps.commentaire ?? null,
    });
    if (r?.ok) {
      // Copie au canal Telegram admin ; un échec ici n'annule jamais la commande.
      try {
        const [{ data: jeton }, { data: chat }] = await Promise.all([
          service.rpc('lire_jeton_telegram'), service.rpc('lire_chat_telegram_admin'),
        ]);
        const c = (r.commande ?? {}) as Record<string, unknown>;
        const lignes = Array.isArray(c.lignes) ? c.lignes as Array<Record<string, unknown>> : [];
        if (jeton && chat) {
          const texte = [
            `📦 Commande DistriPro — ${resto.name}`,
            `${c.numero ?? ''} · livraison ${c.date_livraison ?? ''}`,
            ...lignes.map((l) => `• ${l.quantite} × ${l.libelle}`),
            `Total : ${ar(Number(c.total ?? 0))} · paiement à la livraison (${c.paiement_mode ?? ''})`,
          ].join('\n');
          await fetch(`https://api.telegram.org/bot${jeton}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chat, text: texte, disable_web_page_preview: true }),
            signal: AbortSignal.timeout(8000),
          });
        }
      } catch { /* silencieux */ }
    }
    return json(200, { ...r, restaurant });
  }

  return json(400, { ok: false, reason: 'action_inconnue' });
});
