/**
 * envoyer-annonce — envoie une ANNONCE push, écrite à la main dans l'admin.
 *
 * À ne pas confondre avec `notify-order`, qui ne parle que d'une commande et
 * qui est appelée par la base. Ici l'appelant est un HUMAIN, administrateur,
 * depuis le tableau de bord : c'est lui qui décide, personne d'autre, et rien
 * ne part tout seul.
 *
 * ⚠️ **On ne factorise PAS avec `notify-order`.** Les deux fonctions parlent à
 * l'API Expo de la même façon (envoi par paquets, lecture des tickets, purge des
 * jetons `DeviceNotRegistered`), et la tentation est grande d'en faire un module
 * commun. La fiabilité des notifications de COMMANDE prime sur l'élégance : un
 * module partagé, c'est un déploiement de `envoyer-annonce` capable de casser
 * l'annonce d'une commande au restaurant. Les deux fichiers restent séparés,
 * chacun déployable sans l'autre. Toute correction de la mécanique Expo se porte
 * donc dans LES DEUX, volontairement.
 *
 * Authentification : `verify_jwt = false` dans `config.toml`, et la fonction
 * vérifie elle-même. Raison identique à `rembourser-paiement` : la clé `anon` du
 * projet est un JWT valide et franchirait `verify_jwt = true` sans rien prouver.
 * On lit donc le jeton de l'appelant, on en tire l'utilisateur, et on exige
 * `user_roles.role = 'admin'` ACTIF, lu explicitement (pas `is_admin()`, qui
 * s'appuie sur `auth.uid()`, NULL sous la clé service_role).
 *
 * L'annonce est écrite AVANT par `admin_creer_annonce` (garde-fous : longueurs,
 * cible, route, doublon 24 h). Cette fonction ne fait que l'envoyer une fois,
 * puis inscrit le résultat dans la ligne.
 *
 * Déployée depuis ce dépôt ; l'original fait foi ici, pas dans le tableau de bord.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECUS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

/**
 * ⚠️ UN TICKET « ok » NE VEUT PAS DIRE LIVRÉ. Mesuré le 2026-09-18 sur les
 * 10 appareils du compte administrateur : 10 tickets « ok » à l'envoi, puis
 * 9 reçus `DeviceNotRegistered` (anciennes builds désinstallées) et un seul
 * vrai destinataire. `notify-order` ne lit que les tickets ; ici on va chercher
 * les REÇUS quelques secondes plus tard, parce qu'une annonce annonce SON
 * chiffre au fondateur — un « 26 envoyés » qui vaut 1 est un mensonge utile à
 * personne. Les reçus peuvent n'être pas encore prêts : c'est sans gravité, on
 * n'en tire alors aucune conclusion et les jetons morts partiront au prochain envoi.
 */
const ATTENTE_RECUS_MS = 8000;

/** L'admin est une app web : sans ces en-têtes, l'appel ne part même pas. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Expo accepte 100 messages par requête. */
const PAQUET = 100;

type Annonce = {
  id: string;
  titre: string;
  corps: string;
  cible: 'clients' | 'moi';
  route: string | null;
  statut: string;
  envoyee_par: string;
};

type Ticket = { id?: string; status?: string; message?: string; details?: { error?: string } };
type Recu = { status?: string; message?: string; details?: { error?: string } };

function json(code: number, corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: code,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { erreur: 'methode_non_autorisee' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ------------------------------------------------------------ 1. L'APPELANT
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_absent' });
  const { data: auth, error: authError } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (authError || !user) return json(403, { erreur: 'autorisation_refusee', code: 'jeton_invalide' });

  const { data: role, error: roleError } = await admin
    .from('user_roles')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .eq('status', 'active')
    .maybeSingle();
  if (roleError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_role' });
  if (!role) return json(403, { erreur: 'autorisation_refusee', code: 'reserve_aux_admins' });

  // -------------------------------------------------------------- 2. L'ENTRÉE
  let corps: { annonce_id?: string };
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: 'entree_invalide' });
  }
  if (!corps?.annonce_id) return json(400, { erreur: 'entree_invalide', code: 'annonce_id_manquant' });

  const { data: annonce, error: lectureError } = await admin
    .from('annonces')
    .select('id, titre, corps, cible, route, statut, envoyee_par')
    .eq('id', corps.annonce_id)
    .maybeSingle<Annonce>();
  if (lectureError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_annonce' });
  if (!annonce) return json(404, { erreur: 'annonce_introuvable' });
  // ⚠️ Une annonce ne s'envoie qu'UNE fois : sans ça, un double appui du
  // navigateur (ou un rechargement de page) réveille deux fois tout le parc.
  if (annonce.statut !== 'preparee') {
    return json(409, { erreur: 'deja_envoyee', statut: annonce.statut });
  }
  // L'auteur enregistré et l'appelant doivent être la même personne : l'annonce
  // porte un nom dans l'historique, il doit être le bon.
  if (annonce.envoyee_par !== user.id) {
    return json(403, { erreur: 'autorisation_refusee', code: 'auteur_different' });
  }

  // --------------------------------------------------------- 3. LES APPAREILS
  let userIds: string[];
  if (annonce.cible === 'moi') {
    userIds = [user.id];
  } else {
    const { data: clients, error: clientsError } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'client')
      .eq('status', 'active')
      .returns<{ user_id: string }[]>();
    if (clientsError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_clients' });
    userIds = [...new Set((clients ?? []).map((r) => r.user_id))];
  }

  const { data: jetons, error: jetonsError } = userIds.length
    ? await admin.from('push_tokens').select('token').in('user_id', userIds).returns<{ token: string }[]>()
    : { data: [], error: null };
  if (jetonsError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_jetons' });

  const tokens = [...new Set((jetons ?? []).map((j) => j.token))];
  if (!tokens.length) {
    await admin.from('annonces').update({
      statut: 'envoyee', envoyee_le: new Date().toISOString(),
      jetons_vises: 0, envois_reussis: 0, envois_echoues: 0,
      details: { note: 'aucun appareil enregistre' },
    }).eq('id', annonce.id);
    return json(200, { jetons_vises: 0, reussis: 0, echoues: 0, supprimes: 0 });
  }

  // ------------------------------------------------------------- 4. L'ENVOI
  // Le texte est envoyé TEL QUEL, dans la langue où il a été écrit : une annonce
  // est rédigée par une personne, pas composée à partir de clés traduites comme
  // les messages de `notify-order`.
  const messages = tokens.map((token) => ({
    to: token,
    title: annonce.titre,
    body: annonce.corps,
    sound: 'default',
    priority: 'high',
    channelId: 'commandes',
    // Repris par l'app au tap (`data.route`). Pas d'`orderId` : ce n'est pas une
    // commande, et l'app retombe alors sur `route` seul.
    data: { route: annonce.route ?? '/', annonceId: annonce.id },
  }));

  let reussis = 0;
  let echoues = 0;
  const morts: string[] = [];
  const erreurs: Record<string, number> = {};
  /** id de ticket -> jeton, pour relire les reçus et savoir QUEL jeton est mort. */
  const parTicket = new Map<string, string>();

  for (let i = 0; i < messages.length; i += PAQUET) {
    const lot = messages.slice(i, i + PAQUET);
    let tickets: Ticket[] | null = null;
    try {
      const reponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lot),
      });
      const resultat = await reponse.json().catch(() => null);
      tickets = Array.isArray(resultat?.data) ? resultat.data : null;
      if (!tickets) {
        echoues += lot.length;
        erreurs[`reponse_expo_${reponse.status}`] = (erreurs[`reponse_expo_${reponse.status}`] ?? 0) + lot.length;
        continue;
      }
    } catch (e) {
      // Un paquet perdu ne doit pas empêcher les suivants de partir.
      echoues += lot.length;
      const cle = `reseau:${String(e).slice(0, 60)}`;
      erreurs[cle] = (erreurs[cle] ?? 0) + lot.length;
      continue;
    }
    tickets.forEach((ticket, j) => {
      if (ticket?.status === 'ok') {
        reussis += 1;
        if (ticket.id) parTicket.set(ticket.id, lot[j]!.to);
        return;
      }
      echoues += 1;
      const cle = ticket?.details?.error ?? ticket?.message ?? 'erreur_inconnue';
      erreurs[cle] = (erreurs[cle] ?? 0) + 1;
      // Jeton mort (app désinstallée) : il ne guérira jamais, on le retire —
      // même règle que `notify-order`.
      if (ticket?.details?.error === 'DeviceNotRegistered') morts.push(lot[j]!.to);
    });
  }

  // --------------------------------------------------- 5. LES REÇUS (la vérité)
  let recusOk = 0;
  let recusErreurs = 0;
  if (parTicket.size) {
    try {
      await new Promise((r) => setTimeout(r, ATTENTE_RECUS_MS));
      const ids = [...parTicket.keys()];
      for (let i = 0; i < ids.length; i += 300) {
        const lot = ids.slice(i, i + 300);
        const reponse = await fetch(EXPO_RECUS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ ids: lot }),
        });
        const resultat = await reponse.json().catch(() => null);
        const recus = resultat?.data as Record<string, Recu> | undefined;
        if (!recus) continue;
        for (const [id, recu] of Object.entries(recus)) {
          if (recu?.status === 'ok') {
            recusOk += 1;
            continue;
          }
          recusErreurs += 1;
          const cle = `recu:${recu?.details?.error ?? recu?.message ?? 'inconnu'}`;
          erreurs[cle] = (erreurs[cle] ?? 0) + 1;
          if (recu?.details?.error === 'DeviceNotRegistered') {
            const jeton = parTicket.get(id);
            if (jeton) morts.push(jeton);
          }
        }
      }
    } catch (e) {
      // Reçus indisponibles : on garde les chiffres des tickets, sans rien inventer.
      console.error('envoyer-annonce: recus illisibles', e);
    }
  }

  if (morts.length) await admin.from('push_tokens').delete().in('token', [...new Set(morts)]);

  const { error: majError } = await admin.from('annonces').update({
    statut: reussis > 0 || echoues === 0 ? 'envoyee' : 'echouee',
    envoyee_le: new Date().toISOString(),
    jetons_vises: tokens.length,
    envois_reussis: reussis,
    envois_echoues: echoues,
    jetons_supprimes: new Set(morts).size,
    // `recus_ok` est le nombre d'appareils qui ont VRAIMENT reçu. Il peut être
    // nul si les reçus n'étaient pas encore prêts : dans ce cas il vaut null.
    details: {
      ...(Object.keys(erreurs).length ? { erreurs } : {}),
      recus_ok: recusOk + recusErreurs > 0 ? recusOk : null,
      recus_echoues: recusOk + recusErreurs > 0 ? recusErreurs : null,
    },
  }).eq('id', annonce.id);
  if (majError) console.error('envoyer-annonce: historique non mis a jour', majError);

  return json(200, {
    jetons_vises: tokens.length,
    reussis,
    echoues,
    supprimes: new Set(morts).size,
    recus_ok: recusOk + recusErreurs > 0 ? recusOk : null,
    recus_echoues: recusOk + recusErreurs > 0 ? recusErreurs : null,
    erreurs,
  });
});
