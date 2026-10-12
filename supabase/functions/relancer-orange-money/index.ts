/**
 * relancer-orange-money — relance UN client qui doit encore payer une commande
 * Orange Money encaissée à la livraison (onglet « 📱 Orange Money » de l'admin).
 *
 * Deux canaux, au SEUL client de la commande :
 *   - une notification push (mécanique Expo recopiée d'`envoyer-annonce`, sans
 *     module commun, exprès : voir l'en-tête de cette fonction) ;
 *   - un e-mail, par le workflow n8n DÉDIÉ AUX ANNONCES (jamais T7uX), webhook lu
 *     au Vault par `lire_webhook_annonce_email()`.
 *
 * Garde-fous, tous en base (`om_relance_preparer`) : commande Orange Money encore
 * « à vérifier », compte client réel (pas une commande par téléphone), et UNE
 * relance par commande et par jour (index unique) — un double clic ne relance pas
 * deux fois. Le résultat de chaque canal est écrit par `om_relance_noter`.
 *
 * Authentification : `verify_jwt = false` dans `config.toml`, même raison
 * qu'`envoyer-annonce` (la clé anon est un JWT valide) ; la fonction lit le jeton
 * de l'appelant et exige `user_roles.role = 'admin'` ACTIF.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECUS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const ATTENTE_RECUS_MS = 6000;
const SITE = 'https://taxifoodnosybe.distripro207.com';
const NUMERO = '+261 37 34 379 12';
const TITULAIRE = 'TECHER Jean Christopher';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Ticket = { id?: string; status?: string; message?: string; details?: { error?: string } };
type Recu = { status?: string; message?: string; details?: { error?: string } };

function json(code: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/** 12000 -> « 12 000 Ar » (espace insécable fine, comme l'app). */
function ar(n: number): string {
  return `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ar`;
}

function textes(langue: string, numero: string, montant: number) {
  const m = ar(montant);
  if (langue.startsWith('en')) {
    return {
      titre: `Payment for order ${numero}`,
      corps: `${m} still to pay. Orange Money to ${NUMERO} (${TITULAIRE}). Thank you!`,
    };
  }
  if (langue.startsWith('it')) {
    return {
      titre: `Pagamento dell'ordine ${numero}`,
      corps: `Restano da pagare ${m}. Orange Money al ${NUMERO} (${TITULAIRE}). Grazie!`,
    };
  }
  return {
    titre: `Paiement de ta commande ${numero}`,
    corps: `Il reste ${m} à régler. Orange Money au ${NUMERO} (${TITULAIRE}). Merci !`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1. L'appelant : un administrateur actif, rien d'autre.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_absent' });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_invalide' });
  const { data: role, error: roleError } = await admin
    .from('user_roles').select('user_id')
    .eq('user_id', user.id).eq('role', 'admin').eq('status', 'active')
    .maybeSingle();
  if (roleError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_role' });
  if (!role) return json(403, { erreur: 'autorisation_refusee', code: 'reserve_aux_admins' });

  // 2. L'entrée.
  let corps: { order_id?: string };
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: 'entree_invalide' });
  }
  if (!corps?.order_id) return json(400, { erreur: 'entree_invalide', code: 'order_id_manquant' });

  // 3. La base vérifie tout et réserve la relance du jour.
  const { data: prep, error: prepError } = await admin
    .rpc('om_relance_preparer', { p_order_id: corps.order_id, p_admin: user.id });
  if (prepError) return json(500, { erreur: 'erreur_serveur', code: 'preparation' });
  const p = prep as {
    ok: boolean; code?: string; relance_id?: string; user_id?: string;
    email?: string | null; order_number?: string; montant?: number;
  };
  if (!p?.ok) return json(409, { erreur: 'refus', code: p?.code ?? 'inconnu' });

  const relanceId = p.relance_id!;
  const numero = p.order_number ?? '';
  const montant = p.montant ?? 0;
  const route = `/order/${corps.order_id}`;
  const detail: Record<string, unknown> = {};

  // 4. Le push, au seul client.
  let pushResultat = 'aucun_appareil';
  const morts: string[] = [];
  try {
    const { data: jetons } = await admin
      .from('push_tokens').select('token, language').eq('user_id', p.user_id!)
      .returns<{ token: string; language: string | null }[]>();
    const liste = jetons ?? [];
    detail.appareils = liste.length;
    if (liste.length) {
      const messages = liste.map((j) => {
        const t = textes(j.language ?? 'fr', numero, montant);
        return {
          to: j.token, title: t.titre, body: t.corps, sound: 'default', priority: 'high',
          channelId: 'commandes', data: { route, orderId: corps.order_id },
        };
      });
      const reponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
      const resultat = await reponse.json().catch(() => null);
      const tickets: Ticket[] = Array.isArray(resultat?.data) ? resultat.data : [];
      const parTicket = new Map<string, string>();
      let ok = 0;
      tickets.forEach((t, i) => {
        if (t?.status === 'ok') {
          ok += 1;
          if (t.id) parTicket.set(t.id, messages[i]!.to);
        } else if (t?.details?.error === 'DeviceNotRegistered') morts.push(messages[i]!.to);
      });
      // ⚠️ Un ticket « ok » n'est pas une livraison : on lit les REÇUS.
      let recus = 0;
      if (parTicket.size) {
        await new Promise((r) => setTimeout(r, ATTENTE_RECUS_MS));
        try {
          const rr = await fetch(EXPO_RECUS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ ids: [...parTicket.keys()] }),
          });
          const rj = await rr.json().catch(() => null);
          for (const [id, recu] of Object.entries((rj?.data ?? {}) as Record<string, Recu>)) {
            if (recu?.status === 'ok') recus += 1;
            else if (recu?.details?.error === 'DeviceNotRegistered') {
              const jeton = parTicket.get(id);
              if (jeton) morts.push(jeton);
            }
          }
        } catch { /* reçus indisponibles : on garde les tickets */ }
      }
      detail.tickets_ok = ok;
      detail.recus_ok = recus;
      pushResultat = recus > 0 ? `ok:${recus}_appareil(s)` : ok > 0 ? 'ticket_ok_sans_recu' : 'echec';
    }
  } catch (e) {
    pushResultat = `erreur:${String(e).slice(0, 80)}`;
  }
  if (morts.length) await admin.from('push_tokens').delete().in('token', [...new Set(morts)]);

  // 5. L'e-mail, par le workflow n8n des annonces.
  let emailResultat = 'sans_adresse';
  if (p.email) {
    try {
      const { data: reglage } = await admin.rpc('lire_webhook_annonce_email');
      const webhook = (Array.isArray(reglage) ? reglage[0] : reglage) as { url?: string; secret?: string } | undefined;
      const { data: paires } = await admin.rpc('annonces_jetons', { p_users: [p.user_id] });
      const jeton = ((paires ?? []) as { user_id: string; jeton: string }[])[0]?.jeton;
      if (!webhook?.url || !webhook?.secret) emailResultat = 'webhook_absent';
      else if (!jeton) emailResultat = 'jeton_manquant';
      else {
        const t = textes('fr', numero, montant);
        const reponse = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-taxifood-secret': webhook.secret },
          body: JSON.stringify({
            evenement: 'annonce',
            destinataire: p.email,
            titre: t.titre,
            corps: `Merci pour ta commande ${numero} ! Il reste ${ar(montant)} à régler. `
              + `Tu peux payer par Orange Money au ${NUMERO} (${TITULAIRE}), en indiquant ${numero}. `
              + `Si c'est déjà fait, merci, et ne tiens pas compte de ce message.`,
            route,
            desinscription: `${SITE}/d/${jeton}`,
            test: false,
          }),
        });
        // Le workflow répond APRÈS le SMTP : 200 = accepté par le serveur de messagerie.
        emailResultat = reponse.ok ? 'ok:accepte_smtp' : `echec:n8n_${reponse.status}`;
      }
    } catch (e) {
      emailResultat = `erreur:${String(e).slice(0, 80)}`;
    }
  }

  await admin.rpc('om_relance_noter', {
    p_relance_id: relanceId, p_push: pushResultat, p_email: emailResultat, p_detail: detail,
  });

  return json(200, { ok: true, push: pushResultat, email: emailResultat });
});
