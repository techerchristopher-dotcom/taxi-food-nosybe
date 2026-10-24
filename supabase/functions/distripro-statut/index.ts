/**
 * distripro-statut — sens RETOUR du pont : DistriPro prévient Taxi Food quand une commande
 * fournisseur d'un restaurant partenaire change de statut, et on pousse une notification
 * au staff de CE restaurant (onglet « Commander » → détail de la commande au tap).
 *
 * Appelant : la base DistriPro (trigger `pont_notifier_statut`, pg_net). Barrière : l'en-tête
 * `x-pont-retour`, comparé par `distripro_retour_ok()` (Taxi Food ne garde que son SHA-256).
 * `verify_jwt = false` (config.toml) : l'appelant n'est pas un utilisateur.
 *
 * Mécanique Expo recopiée d'`envoyer-annonce` / `notify-order`, sans module commun, exprès
 * (un déploiement ici ne doit jamais pouvoir casser les notifications de commande).
 * Déployée depuis ce dépôt ; l'original fait foi ici.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const TEXTES: Record<string, { titre: string; corps: (n: string) => string }> = {
  en_preparation: { titre: '📦 DistriPro prépare votre commande', corps: (n) => `${n} est en préparation.` },
  en_livraison: { titre: '🛵 Votre commande DistriPro arrive', corps: (n) => `${n} est en cours de livraison. Paiement à la livraison.` },
  livree: { titre: '✅ Commande DistriPro livrée', corps: (n) => `${n} a été livrée. Le bon de livraison est dans « Commander ».` },
  annulee: { titre: 'Commande DistriPro annulée', corps: (n) => `${n} a été annulée. Ouvrez « Commander » pour le détail.` },
};

function json(code: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { ok: false });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const secret = req.headers.get('x-pont-retour') ?? '';
  const { data: ok } = await admin.rpc('distripro_retour_ok', { p_secret: secret });
  if (ok !== true) return json(403, { ok: false, reason: 'secret' });

  let corps: { restaurant_id?: string; numero?: string; statut?: string };
  try { corps = await req.json(); } catch { return json(400, { ok: false, reason: 'entree' }); }
  const texte = TEXTES[String(corps.statut ?? '')];
  if (!corps.restaurant_id || !corps.numero || !texte) return json(400, { ok: false, reason: 'entree' });

  // Staff ACTIF du restaurant (rôle restaurant actif + rattachement)
  const { data: staff } = await admin
    .from('restaurant_staff').select('user_id').eq('restaurant_id', corps.restaurant_id);
  const ids = (staff ?? []).map((s) => s.user_id as string);
  if (!ids.length) return json(200, { ok: true, envoyes: 0 });
  const { data: actifs } = await admin
    .from('user_roles').select('user_id').in('user_id', ids).eq('role', 'restaurant').eq('status', 'active');
  const userIds = [...new Set((actifs ?? []).map((a) => a.user_id as string))];
  if (!userIds.length) return json(200, { ok: true, envoyes: 0 });

  const { data: jetons } = await admin.from('push_tokens').select('token').eq('app', 'client').in('user_id', userIds);
  const tokens = [...new Set((jetons ?? []).map((j) => j.token as string))];
  if (!tokens.length) return json(200, { ok: true, envoyes: 0 });

  const route = `/(restaurant)/commander-commande?numero=${encodeURIComponent(corps.numero)}`;
  const messages = tokens.map((to) => ({
    to, title: texte.titre, body: texte.corps(corps.numero!), sound: 'default',
    data: { route, distripro: corps.numero },
  }));
  const r = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const rep = await r.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
  const tickets = rep?.data ?? [];
  const morts = tickets.map((t, i) => (t?.details?.error === 'DeviceNotRegistered' ? tokens[i] : null)).filter(Boolean) as string[];
  if (morts.length) await admin.from('push_tokens').delete().in('token', morts);
  return json(200, { ok: true, envoyes: tickets.filter((t) => t?.status === 'ok').length });
});
