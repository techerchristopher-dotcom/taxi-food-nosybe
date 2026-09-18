/**
 * collecter-telechargements — releve chaque jour les telechargements de l'App Store.
 *
 * Appelee par la BASE (pg_cron -> pg_net), une fois par jour, jamais par l'app.
 * Elle authentifie son appelant par le secret partage `collecte_hook_secret`
 * (Vault), exactement comme `notify-order` : `verify_jwt = false` dans
 * config.toml, et la verification se fait ici.
 *
 * CE QU'IL FAUT SAVOIR AVANT D'Y TOUCHER
 *
 * 1. **404 = aucun rapport ce jour-la**, pas une panne. Apple ne publie rien
 *    pour une journee sans la moindre unite. On l'inscrit comme releve « vide » :
 *    sans ca, le rattrapage repasserait chaque jour sur les memes journees
 *    vides, et le journal ne saurait pas dire « on a regarde, il n'y avait rien ».
 * 2. **Le rapport est un TSV GZIPPE**, pas du JSON (`Accept: application/a-gzip`).
 *    Ce n'est pas un `content-encoding` : le corps est un FICHIER gzip, il faut
 *    le decompresser soi-meme.
 * 3. **`Product Type Identifier` distingue premier telechargement (1, 1F, 1T…),
 *    re-telechargement (3…) et mise a jour (7…)**. On stocke le type tel quel et
 *    on n'additionne jamais : une mise a jour n'est pas un nouveau client.
 * 4. **Rejouable**. Les lignes sont posees en `upsert` sur
 *    (jour, magasin, pays, type) : relancer la collecte d'un jour deja releve
 *    remplace les memes lignes, il ne les ajoute pas. C'est ce qui permet de
 *    rattraper sans peur.
 * 5. **La cle privee ne quitte jamais le Vault** : elle est lue par
 *    `config_app_store()`, reservee a `service_role`, et sert a signer un JWT
 *    valable 20 minutes.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ASC_API = 'https://api.appstoreconnect.apple.com/v1/salesReports';
const MAGASIN = 'app_store';

type Config = { cle_privee: string; issuer_id: string; key_id: string; vendeur: string };

function base64url(octets: Uint8Array): string {
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM PKCS#8 -> CryptoKey ECDSA P-256. */
async function importerCle(pem: string): Promise<CryptoKey> {
  const corps = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(corps);
  const der = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i);
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/**
 * Le jeton d'Apple. ⚠️ `aud` vaut `appstoreconnect-v1` et l'expiration ne doit
 * pas depasser 20 minutes : au-dela, Apple repond 401 sans expliquer pourquoi.
 */
async function jeton(config: Config): Promise<string> {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: config.key_id, typ: 'JWT' })));
  const charge = base64url(new TextEncoder().encode(JSON.stringify({
    iss: config.issuer_id, iat: maintenant, exp: maintenant + 1200, aud: 'appstoreconnect-v1',
  })));
  const cle = await importerCle(config.cle_privee);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cle,
    new TextEncoder().encode(`${entete}.${charge}`),
  );
  return `${entete}.${charge}.${base64url(new Uint8Array(signature))}`;
}

/** « 2026-09-16 » dans le fuseau d'Apple (UTC suffit : les rapports sont datés au jour). */
function jourISO(decalageJours: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - decalageJours);
  return d.toISOString().slice(0, 10);
}

type Ligne = { pays: string; type_produit: string; unites: number };

/** Le TSV d'Apple -> des lignes agregees par (pays, type). */
function lireRapport(tsv: string): Ligne[] {
  const lignes = tsv.split('\n').filter((l) => l.trim().length);
  if (lignes.length < 2) return [];
  const entetes = lignes[0].split('\t').map((c) => c.trim());
  const iType = entetes.indexOf('Product Type Identifier');
  const iUnites = entetes.indexOf('Units');
  const iPays = entetes.indexOf('Country Code');
  if (iType < 0 || iUnites < 0 || iPays < 0) return [];

  const cumul = new Map<string, Ligne>();
  for (const brute of lignes.slice(1)) {
    const cases = brute.split('\t');
    const type = (cases[iType] ?? '').trim();
    const pays = (cases[iPays] ?? '').trim() || 'ZZ';
    const unites = Number.parseInt((cases[iUnites] ?? '0').trim(), 10);
    if (!type || !Number.isFinite(unites)) continue;
    const cle = `${pays}|${type}`;
    const deja = cumul.get(cle);
    if (deja) deja.unites += unites;
    else cumul.set(cle, { pays, type_produit: type, unites });
  }
  return [...cumul.values()];
}

type Journal = {
  magasin: string; jour: string; statut: 'ok' | 'vide' | 'echec';
  lignes: number; message: string | null; fait_le: string;
};

/**
 * Le journal : un etat par journee, remplace a chaque passage.
 *
 * ⚠️ L'ERREUR D'ECRITURE EST REMONTEE dans la reponse. C'est en l'avalant qu'un
 * index unique PARTIEL est passe inapercu le 2026-09-18 : PostgREST n'envoie pas
 * de clause WHERE avec `on_conflict`, l'inference echouait, et toutes les lignes
 * du journal etaient refusees en silence — la collecte repassait donc chaque
 * jour sur des journees deja relevees, sans que rien ne le signale.
 */
async function journaliser(
  supabase: ReturnType<typeof createClient>,
  resultats: Record<string, string>,
  ligne: Journal,
): Promise<void> {
  const { error } = await supabase.from('releves_magasins').upsert(ligne, { onConflict: 'magasin,jour' });
  if (error) {
    console.error('collecter-telechargements: journal refuse', error.message);
    resultats[`${ligne.jour}_journal`] = `refuse: ${error.message.slice(0, 120)}`;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // --- L'appelant : la base ---
  const { data: attendu, error: secretError } = await supabase.rpc('collecte_hook_secret');
  if (secretError || !attendu) return new Response('server misconfigured', { status: 500 });
  if (req.headers.get('x-hook-secret') !== attendu) return new Response('forbidden', { status: 403 });

  let corps: { jours?: number; jour?: string; force?: boolean } = {};
  try {
    corps = await req.json();
  } catch { /* corps vide accepté : les valeurs par défaut suffisent */ }

  const { data: config, error: configError } = await supabase.rpc('config_app_store');
  const c = config as Config | null;
  if (configError || !c?.cle_privee || !c.issuer_id || !c.key_id || !c.vendeur) {
    return Response.json({ erreur: 'config_app_store_incomplete' }, { status: 500 });
  }

  // Les jours a regarder : hier, puis les precedents pour rattraper ce qui
  // manque (une execution ratee, la fonction deployee apres coup).
  const jours = corps.jour
    ? [corps.jour]
    : Array.from({ length: Math.min(Math.max(corps.jours ?? 7, 1), 30) }, (_, i) => jourISO(i + 1));

  const { data: dejaFaits } = await supabase
    .from('releves_magasins')
    .select('jour, statut')
    .eq('magasin', MAGASIN)
    .in('statut', ['ok', 'vide'])
    .returns<{ jour: string; statut: string }[]>();
  const connus = new Set((dejaFaits ?? []).map((r) => r.jour));

  const jeton_ = await jeton(c);
  const resultats: Record<string, string> = {};

  for (const jour of jours) {
    if (connus.has(jour) && !corps.force) {
      resultats[jour] = 'deja_releve';
      continue;
    }
    try {
      const adresse = `${ASC_API}?filter[frequency]=DAILY&filter[reportDate]=${jour}`
        + `&filter[reportSubType]=SUMMARY&filter[reportType]=SALES&filter[vendorNumber]=${c.vendeur}`;
      const reponse = await fetch(adresse, {
        headers: { Authorization: `Bearer ${jeton_}`, Accept: 'application/a-gzip' },
      });

      if (reponse.status === 404) {
        // Aucun rapport : journee sans une seule unite. C'est une information,
        // pas un echec.
        await reponse.body?.cancel();
        // ⚠️ L'erreur d'ecriture du journal est REMONTEE : c'est en l'avalant
        // qu'un index inadapte est passe inapercu (2026-09-18).
        await journaliser(supabase, resultats, {
          magasin: MAGASIN, jour, statut: 'vide', lignes: 0,
          message: 'aucun rapport Apple ce jour-la', fait_le: new Date().toISOString(),
        });
        resultats[jour] = 'vide';
        continue;
      }
      if (!reponse.ok) {
        const texte = (await reponse.text()).slice(0, 300);
        await journaliser(supabase, resultats, {
          magasin: MAGASIN, jour, statut: 'echec', lignes: 0,
          message: `HTTP ${reponse.status} ${texte}`, fait_le: new Date().toISOString(),
        });
        resultats[jour] = `echec_${reponse.status}`;
        continue;
      }

      const tsv = await new Response(
        reponse.body!.pipeThrough(new DecompressionStream('gzip')),
      ).text();
      const lignes = lireRapport(tsv);

      if (lignes.length) {
        const { error } = await supabase.from('telechargements_magasins').upsert(
          lignes.map((l) => ({
            jour, magasin: MAGASIN, pays: l.pays, type_produit: l.type_produit,
            unites: l.unites, releve_le: new Date().toISOString(),
          })),
          { onConflict: 'jour,magasin,pays,type_produit' },
        );
        if (error) {
          await journaliser(supabase, resultats, {
            magasin: MAGASIN, jour, statut: 'echec', lignes: lignes.length,
            message: error.message.slice(0, 300), fait_le: new Date().toISOString(),
          });
          resultats[jour] = 'echec_ecriture';
          continue;
        }
      }
      await journaliser(supabase, resultats, {
        magasin: MAGASIN, jour, statut: lignes.length ? 'ok' : 'vide', lignes: lignes.length,
        message: lignes.length ? null : 'rapport sans ligne exploitable',
        fait_le: new Date().toISOString(),
      });
      resultats[jour] = `${lignes.length} lignes`;
    } catch (e) {
      await journaliser(supabase, resultats, {
        magasin: MAGASIN, jour, statut: 'echec', lignes: 0,
        message: String(e).slice(0, 300), fait_le: new Date().toISOString(),
      });
      resultats[jour] = 'echec';
    }
  }

  return Response.json({ magasin: MAGASIN, jours: resultats });
});
