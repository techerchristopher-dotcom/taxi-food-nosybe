// Depot d'un SECRET D'EXPLOITATION dans le Vault, depuis le poste.
//
// POURQUOI ELLE EXISTE. La cle privee App Store Connect (`.p8`) vit sur le poste
// de l'exploitant. Elle doit arriver dans le Vault Supabase sans passer par :
// un commit, une conversation, ni le presse-papier d'un tableau de bord. La CLI
// Supabase aurait suffi (`supabase secrets set`), mais elle exige une session
// que ce poste n'a pas (aucun jeton dans ~/.supabase). Ce sas fait le meme
// travail : le poste POSTe le contenu, la fonction l'ecrit dans le Vault.
//
// CE QUI LA REND SURE, ET QU'IL NE FAUT PAS ASSOUPLIR :
//
// 1. MEME SECRET DE DEPOT QUE `deposer-visuel`, et donc MEME INTERRUPTEUR : le
//    Vault ne contient que son SHA-256 (`depot_visuel_empreinte`), relu a chaque
//    appel. `delete from vault.secrets where name = 'depot_visuel_empreinte'`
//    desarme les DEUX fonctions instantanement, sans redeploiement.
// 2. LISTE BLANCHE DE NOMS, cote base (`poser_secret_exploitation`) : cette
//    fonction ne peut ecrire ni `stripe_secret_key`, ni `push_hook_secret`, ni
//    l'empreinte de depot elle-meme. Une porte d'entree generale sur le Vault
//    serait pire que le probleme qu'on resout.
// 3. ELLE NE REND JAMAIS UN SECRET. Aucune lecture, aucun echo : la reponse dit
//    « cree » ou « remplace », rien d'autre. Un sas qui relit est un sas qui fuit.
// 4. COMPARAISON A TEMPS CONSTANT du secret de depot.
//
// ⚠️ `verify_jwt = false` est OBLIGATOIRE (l'appelant n'a aucune session
// Supabase) et fige dans supabase/config.toml.

const NOMS = new Set([
  'asc_private_key',
  'asc_issuer_id',
  'asc_key_id',
  'asc_vendor_number',
  'umami_api_key_vitrine',
  'umami_api_key_app',
]);

const TAILLE_MAX = 16 * 1024;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
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

  const entetes = {
    apikey: cle,
    Authorization: `Bearer ${cle}`,
    'Content-Type': 'application/json',
  };

  let empreinte: string | null = null;
  try {
    const r = await fetch(`${url}/rest/v1/rpc/lire_empreinte_depot_visuel`, {
      method: 'POST', headers: entetes, body: '{}',
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

  let c: { nom?: string; valeur?: string };
  try {
    c = await req.json();
  } catch (_e) {
    return refus('json_invalide', 400);
  }

  const nom = String(c.nom ?? '');
  const valeur = String(c.valeur ?? '');
  if (!NOMS.has(nom)) return refus('nom_non_autorise', 400);
  if (!valeur || valeur.length > TAILLE_MAX) return refus('valeur_invalide', 400);

  const r = await fetch(`${url}/rest/v1/rpc/poser_secret_exploitation`, {
    method: 'POST', headers: entetes, body: JSON.stringify({ p_nom: nom, p_valeur: valeur }),
  });
  if (!r.ok) {
    // On ne renvoie PAS le corps de la reponse : il pourrait contenir la valeur.
    console.error('deposer-secret: ecriture refusee', r.status);
    return refus('ecriture_refusee', 500);
  }
  const issue = await r.json().catch(() => null);
  return new Response(JSON.stringify({ nom, issue }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
