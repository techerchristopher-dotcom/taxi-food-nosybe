// Publie sur la Page Facebook Taxi Food les avis positifs en file (2026-10-08).
//
// Appelée par la BASE (tâche pg_cron `publier-avis-facebook` → `reveiller_publication_avis()`
// → pg_net), jamais par un navigateur. Vérifie elle-même l'en-tête `x-hook-secret` contre le
// Vault (`facebook_hook_secret`) — d'où `verify_jwt = false` dans supabase/config.toml.
//
// Ce qu'elle fait : prend les publications dues (`publications_avis_prendre`, verrou), poste
// chacune en PHOTO sur la Page (Graph API `/{page_id}/photos`, `url` + `caption`), puis note
// le résultat (`publications_avis_noter`). Une photo plutôt qu'un lien : Facebook rogne la
// carte d'aperçu d'un lien, une photo s'affiche en grand — c'est ce qui donne envie.
//
// ⚠️ Sans `facebook_page_token` au Vault, elle répond 503 et ne touche à RIEN : les
// publications restent `a_publier`. (La base ne l'appelle d'ailleurs pas dans ce cas.)
// ⚠️ Le jeton n'est jamais renvoyé ni journalisé, et il est effacé de tout message d'erreur.

const GRAPH = 'https://graph.facebook.com/v21.0';

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });

function egalConstant(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

type Publication = { id: string; texte: string; image_url: string | null };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erreur: 'methode_non_autorisee' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !cle) return json({ erreur: 'configuration_incomplete' }, 500);
  const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
  const rpc = async (nom: string, corps: unknown = {}) => {
    const r = await fetch(`${url}/rest/v1/rpc/${nom}`, { method: 'POST', headers: entetes, body: JSON.stringify(corps) });
    if (!r.ok) throw new Error(`${nom}: ${r.status}`);
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  };

  let config: { page_id?: string; page_token?: string; hook_secret?: string };
  try {
    config = await rpc('lire_config_facebook');
  } catch {
    return json({ erreur: 'config_illisible' }, 500);
  }
  const recu = req.headers.get('x-hook-secret') ?? '';
  if (!config?.hook_secret || config.hook_secret.length < 32 || !egalConstant(recu, config.hook_secret)) {
    return json({ erreur: 'non_autorise' }, 401);
  }
  if (!config.page_token || !config.page_id) return json({ erreur: 'facebook_non_configure' }, 503);
  const jeton = config.page_token;
  const masquer = (s: string) => s.split(jeton).join('***');

  const dues: Publication[] = (await rpc('publications_avis_prendre', { p_limite: 1 })) ?? [];
  const resultats: { id: string; ok: boolean; post_id?: string; erreur?: string }[] = [];

  for (const p of dues) {
    try {
      const corps = new URLSearchParams({ caption: p.texte, access_token: jeton, published: 'true' });
      let chemin = 'feed';
      if (p.image_url) {
        corps.set('url', p.image_url);
        chemin = 'photos';
      } else {
        corps.delete('caption');
        corps.set('message', p.texte);
      }
      const r = await fetch(`${GRAPH}/${config.page_id}/${chemin}`, {
        method: 'POST',
        body: corps,
        signal: AbortSignal.timeout(20000),
      });
      const rep = await r.json().catch(() => ({}));
      if (r.ok && (rep.post_id || rep.id)) {
        const postId = String(rep.post_id ?? rep.id);
        await rpc('publications_avis_noter', { p_id: p.id, p_ok: true, p_post_id: postId, p_erreur: null });
        resultats.push({ id: p.id, ok: true, post_id: postId });
      } else {
        const erreur = masquer(JSON.stringify(rep?.error ?? rep ?? { statut: r.status }));
        await rpc('publications_avis_noter', { p_id: p.id, p_ok: false, p_post_id: null, p_erreur: erreur });
        resultats.push({ id: p.id, ok: false, erreur });
      }
    } catch (e) {
      const erreur = masquer(String((e as Error)?.message ?? e));
      await rpc('publications_avis_noter', { p_id: p.id, p_ok: false, p_post_id: null, p_erreur: erreur }).catch(() => {});
      resultats.push({ id: p.id, ok: false, erreur });
    }
  }

  return json({ ok: true, traitees: resultats.length, resultats });
});
