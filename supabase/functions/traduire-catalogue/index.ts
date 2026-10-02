/**
 * traduire-catalogue — traduit en anglais et en italien les textes du menu qui
 * n'ont pas encore de traduction, et les range dans `traductions_catalogue`.
 *
 * QUI L'APPELLE. La BASE, et elle seule : le trigger `traduction_auto` posé sur
 * products / categories / product_option_groups / product_options / restaurants
 * met un appel en file (pg_net) dès qu'un texte du menu est créé ou modifié ET
 * qu'il manque au moins une traduction. Aucune tâche planifiée — décision du
 * porteur du projet, le 2026-10-02.
 *
 * ⚠️ ELLE NE REÇOIT AUCUN TEXTE. Le corps de la requête est ignoré : la liste de
 * ce qu'il faut traduire est RELUE en base (`textes_a_traduire_auto()`), comme
 * `rembourser-paiement` relit son montant. Un appelant ne peut donc ni injecter
 * un texte dans le dictionnaire, ni faire payer des traductions inutiles.
 *
 * ⚠️ ELLE N'ÉCRASE JAMAIS UNE TRADUCTION EXISTANTE (`ignore-duplicates`). Une
 * correction faite à la main gagne toujours sur la machine ; deux appels
 * simultanés traduisent au pire deux fois la même phrase, sans dégât.
 *
 * Les lignes qu'elle écrit portent `source = 'auto'` : c'est ce qui permet de
 * relire ce que la machine a produit.
 *
 * Secrets (Vault, lus par RPC réservées au service_role) :
 *   - `traduction_hook_secret` : généré en base, jamais vu par personne ;
 *   - `anthropic_api_key`      : posé depuis le poste par `deposer-secret`.
 * Tant que la clé est absente, la fonction répond 503 `cle_absente` et rien
 * n'est perdu : le prochain texte modifié relancera la traduction de TOUT ce
 * qui manque.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { z } from 'npm:zod@3';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';

const LOT = 60;

const Sortie = z.object({
  traductions: z.array(z.object({ fr: z.string(), en: z.string(), it: z.string() })),
});

const CONSIGNES = `Tu traduis le menu d'une application de livraison de repas à Nosy Be (Madagascar), du français vers l'anglais (en) et l'italien (it).

Règles :
- Recopie chaque texte français à l'identique dans "fr" : c'est une clé, un seul caractère de différence la rend inutilisable.
- Un plat local ou malgache (romazava, ravitoto, mi sao, composé, achard, sambos, koba…) garde son nom, suivi d'une courte explication entre parenthèses : « Romazava (beef and greens broth) ».
- Les noms propres, marques, noms de pizzas et de cocktails restent tels quels (THB, Coca-Cola, Margherita, Mojito) ; seuls les mots ordinaires autour se traduisent.
- Garde les quantités, unités, prix, emojis et la ponctuation d'origine (33cl, 1,5 L, x2).
- Ton court et naturel de carte de restaurant, pas de traduction mot à mot. Pas de majuscule à chaque mot.
- Si un texte n'a pas besoin de traduction (nom propre seul), renvoie-le identique.
- Renvoie une entrée par texte reçu, ni plus ni moins.`;

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

type Manque = { fr: string; nature: string; manque_en: boolean; manque_it: boolean };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ erreur: 'methode_non_autorisee' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !cle) return json({ erreur: 'configuration_incomplete' }, 500);
  const entetes = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
  const rpc = async (nom: string) => {
    const r = await fetch(`${url}/rest/v1/rpc/${nom}`, { method: 'POST', headers: entetes, body: '{}' });
    if (!r.ok) throw new Error(`${nom}: ${r.status}`);
    return r.json();
  };

  try {
    const attendu = await rpc('traduction_hook_secret');
    const recu = req.headers.get('x-hook-secret') ?? '';
    if (typeof attendu !== 'string' || attendu.length < 32 || !egalConstant(recu, attendu)) {
      return json({ erreur: 'non_autorise' }, 401);
    }

    const apiKey = await rpc('anthropic_api_key');
    if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) return json({ erreur: 'cle_absente' }, 503);

    const manques: Manque[] = await rpc('textes_a_traduire_auto');
    if (!manques.length) return json({ traduits: 0 });

    const client = new Anthropic({ apiKey });
    let ecrits = 0;
    const rates: string[] = [];

    for (let i = 0; i < manques.length; i += LOT) {
      const lot = manques.slice(i, i + LOT);
      const liste = lot.map((m) => ({ fr: m.fr, nature: m.nature }));
      const reponse = await client.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        output_config: { effort: 'low', format: zodOutputFormat(Sortie) },
        system: CONSIGNES,
        messages: [{ role: 'user', content: `Textes à traduire (JSON) :\n${JSON.stringify(liste)}` }],
      });
      if (reponse.stop_reason === 'refusal' || !reponse.parsed_output) {
        rates.push(...lot.map((m) => m.fr));
        continue;
      }

      const parFr = new Map(reponse.parsed_output.traductions.map((t) => [t.fr, t]));
      const lignes: { fr: string; langue: string; texte: string; source: string }[] = [];
      for (const m of lot) {
        const t = parFr.get(m.fr);
        if (!t) { rates.push(m.fr); continue; }
        if (m.manque_en && t.en.trim()) lignes.push({ fr: m.fr, langue: 'en', texte: t.en.trim(), source: 'auto' });
        if (m.manque_it && t.it.trim()) lignes.push({ fr: m.fr, langue: 'it', texte: t.it.trim(), source: 'auto' });
      }
      if (!lignes.length) continue;

      const r = await fetch(`${url}/rest/v1/traductions_catalogue?on_conflict=fr,langue`, {
        method: 'POST',
        headers: { ...entetes, Prefer: 'resolution=ignore-duplicates,return=minimal' },
        body: JSON.stringify(lignes),
      });
      if (!r.ok) throw new Error(`ecriture: ${r.status} ${await r.text()}`);
      ecrits += lignes.length;
    }

    if (rates.length) console.warn('traduire-catalogue: textes non traduits', rates);
    return json({ textes: manques.length, traductions_ecrites: ecrits, rates: rates.length });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ erreur: 'cle_invalide' }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ erreur: 'limite_api' }, 503);
    console.error('traduire-catalogue', e);
    return json({ erreur: 'echec', detail: String(e) }, 500);
  }
});
