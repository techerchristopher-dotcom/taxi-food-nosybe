// Depot d'un visuel dans les buckets publics, sans mot de passe humain.
//
// POURQUOI ELLE EXISTE. Les buckets `produits` et `boissons` sont en ecriture
// `is_admin()` depuis la faille d'aout 2026 (des policies INSERT ouvertes au role
// `public` laissaient ecraser n'importe quelle photo avec la seule cle anon).
// Cette decision ne bouge pas. Mais elle a une consequence : deposer un visuel
// exigeait le mot de passe d'un administrateur, qui n'a pas a circuler. Chaque
// photo devait donc passer par le tableau de bord, a la main, une par une.
//
// CE QUI LA REND SURE, ET QU'IL NE FAUT PAS ASSOUPLIR :
//
// 1. LE SECRET N'EXISTE PAS EN BASE. Le Vault ne contient que son SHA-256.
//    Le secret en clair ne vit que dans .secrets.local sur le poste de
//    l'exploitant. Quelqu'un qui lirait la base entiere ne pourrait pas deposer.
//
// 2. INTERRUPTEUR. L'empreinte est relue A CHAQUE APPEL, jamais mise en cache.
//    `delete from vault.secrets where name = 'depot_visuel_empreinte'` coupe la
//    fonction INSTANTANEMENT, sans redeploiement. C'est ce qui a manque en aout :
//    la fenetre temporaire ouverte pour un depot n'a jamais ete refermee.
//    Empreinte absente = tout refuse. Jamais de valeur par defaut.
//
// 3. DEUX BUCKETS, pas un de plus. `marketing` en est exclu volontairement : il
//    sert les videos du site public.
//
// 4. CHEMINS ET TYPES CONTRAINTS, 8 Mo maximum.
//
// 5. PAS D'ECRASEMENT sans demande explicite. Un depot qui ecrase en silence une
//    photo existante est exactement le degat que la faille d'aout permettait.
//
// 6. COMPARAISON A TEMPS CONSTANT : une comparaison naive laisse deviner
//    l'empreinte caractere par caractere.
//
// ⚠️ `verify_jwt = false` est OBLIGATOIRE et n'est pas un relachement : l'appelant
// n'a volontairement aucune session Supabase. La fonction verifie elle-meme son
// appelant, par le secret. Cette valeur est figee dans supabase/config.toml —
// un redeploiement sans elle repasserait sur le defaut `true` et casserait tout
// en silence, piege deja paye sur `stripe-webhook`.

const BUCKETS_AUTORISES = new Set(['produits', 'partenaires']);
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};
const TAILLE_MAX = 8 * 1024 * 1024;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function egalConstant(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const refus = (code: string, statut: number) =>
  new Response(JSON.stringify({ erreur: code }), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return refus('methode_non_autorisee', 405);

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !cle) return refus('configuration_incomplete', 500);

  let empreinte: string | null = null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/lire_empreinte_depot_visuel`, {
      method: 'POST',
      headers: {
        apikey: cle,
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (r.ok) {
      const v = await r.json();
      empreinte = typeof v === 'string' && v.length === 64 ? v.toLowerCase() : null;
    }
  } catch (_e) {
    return refus('vault_injoignable', 503);
  }

  if (!empreinte) return refus('depot_desarme', 503);

  const fourni = req.headers.get('x-depot-secret') ?? '';
  if (!fourni) return refus('secret_manquant', 401);
  if (!egalConstant(await sha256Hex(fourni), empreinte)) return refus('secret_invalide', 401);

  let c: { bucket?: string; chemin?: string; contenu_base64?: string; ecraser?: boolean };
  try {
    c = await req.json();
  } catch (_e) {
    return refus('json_invalide', 400);
  }

  const bucket = String(c.bucket ?? '');
  const chemin = String(c.chemin ?? '');
  const ecraser = c.ecraser === true;

  if (!BUCKETS_AUTORISES.has(bucket)) return refus('bucket_non_autorise', 400);

  // Un chemin est `dossier/fichier.ext`, ou plus profond. Pas de `..`, pas de `/`
  // initial : une traversee poserait le fichier la ou personne ne l'attend.
  if (!/^[a-z0-9][a-z0-9._/-]*\.[a-z]{3,4}$/.test(chemin) || chemin.includes('..')) {
    return refus('chemin_invalide', 400);
  }

  const type = TYPES[chemin.split('.').pop()!.toLowerCase()];
  if (!type) return refus('type_non_autorise', 400);

  let octets: Uint8Array;
  try {
    const b64 = String(c.contenu_base64 ?? '');
    if (!b64) return refus('contenu_manquant', 400);
    const bin = atob(b64);
    octets = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
  } catch (_e) {
    return refus('base64_invalide', 400);
  }
  if (octets.length > TAILLE_MAX) return refus('fichier_trop_gros', 413);

  const rep = await fetch(`${url}/storage/v1/object/${bucket}/${chemin}`, {
    // PUT ecrase, POST refuse si le fichier existe.
    method: ecraser ? 'PUT' : 'POST',
    headers: {
      apikey: cle,
      Authorization: `Bearer ${cle}`,
      'Content-Type': type,
      'x-upsert': ecraser ? 'true' : 'false',
    },
    body: octets,
  });

  if (!rep.ok) {
    const detail = await rep.text();
    return new Response(
      JSON.stringify({ erreur: 'depot_refuse', statut: rep.status, detail: detail.slice(0, 300) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      bucket,
      chemin,
      octets: octets.length,
      url_publique: `${url}/storage/v1/object/public/${bucket}/${chemin}`,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
