/**
 * send-otp-whatsapp — envoie le code de vérification par WhatsApp au lieu d'un SMS.
 *
 * Branchée sur le « Send SMS Hook » de Supabase Auth : quand l'app appelle
 * `signInWithOtp({ phone })`, Supabase génère le code puis, au lieu de le confier à un
 * opérateur SMS, appelle cette fonction. Rien à changer côté app — `verifyOtp` continue
 * de valider le code exactement pareil.
 *
 * Pourquoi WhatsApp : le SMS vers Madagascar est facturé à l'unité par tous les
 * opérateurs (Twilio & co) et coûte cher pour un usage pourtant ponctuel. WhatsApp
 * Business offre un quota mensuel gratuit de conversations « authentification », et
 * c'est de toute façon la messagerie utilisée à Nosy Be.
 *
 * Authentification de l'appelant : Supabase signe l'appel au format Standard Webhooks
 * (`webhook-id`, `webhook-timestamp`, `webhook-signature`). On vérifie la signature
 * nous-mêmes puisque `verify_jwt` est désactivé — l'appelant est Supabase Auth, pas un
 * utilisateur porteur de jeton.
 *
 * Les identifiants Meta et le secret du hook vivent dans le Vault, lus par la RPC
 * `whatsapp_hook_config()` réservée à `service_role`. Aucun secret en clair dans le code
 * ni dans les variables d'environnement de la fonction.
 *
 * ⚠️ Inerte tant que les 4 secrets ne sont pas posés dans le Vault : voir
 * `docs/OTP-WHATSAPP.md` pour la procédure côté Meta et côté Supabase.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const GRAPH_VERSION = 'v21.0';

/** Au-delà, on refuse : une requête rejouée bien plus tard n'a rien de légitime. */
const MAX_SKEW_SECONDS = 5 * 60;

type Config = {
  token: string;
  phone_number_id: string;
  template_name: string;
  template_lang: string;
  /** Les modèles « authentification » Meta portent presque toujours un bouton « Copier le code ». */
  template_has_button: boolean;
  hook_secret: string;
};

type HookPayload = {
  user?: { phone?: string | null };
  sms?: { otp?: string | null };
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

/** Comparaison à temps constant : une comparaison `===` fuiterait la signature octet par octet. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie la signature Standard Webhooks posée par Supabase Auth.
 *
 * Le secret est distribué sous la forme `v1,whsec_<base64>` ; c'est la partie base64
 * décodée qui sert de clé HMAC. L'en-tête `webhook-signature` peut contenir plusieurs
 * signatures séparées par des espaces (rotation de secret) — il suffit qu'une corresponde.
 */
async function verifySignature(req: Request, body: string, secret: string): Promise<boolean> {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signature = req.headers.get('webhook-signature');
  if (!id || !timestamp || !signature) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SKEW_SECONDS) return false;

  const raw = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(raw),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = bytesToBase64(mac);

  return signature
    .split(' ')
    .map((part) => part.split(',')[1] ?? '')
    .some((candidate) => timingSafeEqual(candidate, expected));
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: config, error: configError } = await supabase.rpc('whatsapp_hook_config');
  const cfg = config as Config | null;
  if (configError || !cfg?.token || !cfg.phone_number_id || !cfg.template_name || !cfg.hook_secret) {
    // Cas normal tant que les secrets Meta ne sont pas posés : on le dit clairement dans
    // les logs plutôt que de laisser un 500 opaque.
    console.error('configuration WhatsApp incomplète', configError);
    return new Response('whatsapp not configured', { status: 500 });
  }

  // Le corps brut, pas le JSON reparsé : la signature porte sur les octets reçus.
  const body = await req.text();
  if (!(await verifySignature(req, body, cfg.hook_secret))) {
    return new Response('forbidden', { status: 403 });
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('bad request', { status: 400 });
  }

  const phone = payload.user?.phone?.replace(/[^0-9]/g, '');
  const otp = payload.sms?.otp;
  if (!phone || !otp) return new Response('bad request', { status: 400 });

  const components: unknown[] = [
    { type: 'body', parameters: [{ type: 'text', text: otp }] },
  ];
  // Un modèle « authentification » avec bouton « Copier le code » exige que le code soit
  // répété dans le composant bouton : sans lui, Meta rejette l'envoi (erreur 132000).
  if (cfg.template_has_button) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: otp }],
    });
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phone_number_id}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: cfg.template_name,
          language: { code: cfg.template_lang || 'fr' },
          components,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Jamais le code lui-même dans les logs — seulement le motif du refus côté Meta.
    console.error('envoi WhatsApp refusé', response.status, detail);
    // Un non-2xx fait remonter l'échec à Supabase, donc à l'app, qui affiche
    // « Impossible d'envoyer le code ». Mieux qu'un succès silencieux sans message reçu.
    return new Response('whatsapp send failed', { status: 502 });
  }

  return Response.json({});
});
