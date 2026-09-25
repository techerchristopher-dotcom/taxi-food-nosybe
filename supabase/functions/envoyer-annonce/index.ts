/**
 * envoyer-annonce — envoie une ANNONCE écrite à la main dans l'admin, sur ses
 * DEUX canaux : la notification push ET l'e-mail.
 *
 * ⚠️ POURQUOI L'E-MAIL (2026-09-25). Le push n'atteint que les téléphones où
 * l'app est installée : 19 appareils pour 7 comptes ce matin-là. Beaucoup de
 * clients commandent DEPUIS LE SITE et ne recevaient donc rien du tout.
 *
 * ⚠️ UNE SEULE FONCTION POUR LES DEUX CANAUX, exprès. L'annonce est UNE ligne,
 * avec UN statut : « déjà envoyée » doit vouloir dire la même chose pour les
 * deux canaux, sinon un second appui repart sur l'un des deux. Les compteurs,
 * eux, restent séparés (`envois_*` pour le push, `emails_*` pour l'e-mail) :
 * l'écran ne doit jamais additionner des appareils et des adresses.
 *
 * ⚠️ LE CHEMIN E-MAIL EST CELUI QUI EXISTE DÉJÀ — le SMTP de n8n, même
 * credential et même expéditeur que les e-mails de commande — mais par un
 * workflow DÉDIÉ (`Taxi Food — annonce par e-mail`), jamais T7uX. Modifier
 * T7uX, ou seulement le désactiver puis le réactiver comme un `PUT` l'exige,
 * perd les notifications de commande émises pendant la coupure.
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
 * cible, route, canal, doublon 24 h). Cette fonction ne fait que l'envoyer une
 * fois, puis inscrit le résultat dans la ligne.
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

/** La vitrine, qui porte la page de désinscription `/d/<jeton>`. */
const SITE = 'https://taxifoodnosybe.distripro207.com';

/**
 * Combien d'e-mails partent en parallèle vers n8n.
 *
 * ⚠️ Le workflow répond APRÈS le SMTP (`responseNode`) : un 200 veut dire que le
 * serveur de messagerie a accepté le message, pas seulement que n8n a reçu la
 * demande. C'est ce qui permet d'écrire un compte rendu honnête. En contrepartie
 * chaque appel dure le temps d'un envoi SMTP, d'où le parallélisme — modeste,
 * pour ne pas faire passer le SMTP mutualisé de l'hébergeur pour un robot.
 */
const EMAILS_EN_PARALLELE = 4;

/**
 * ⚠️ UNE FONCTION EDGE N'A PAS L'ÉTERNITÉ. Passé ce budget on arrête d'envoyer
 * et on le DIT (`emails_non_tentes`), plutôt que de se faire couper au milieu et
 * de laisser une ligne d'historique qui ment. Aujourd'hui trois destinataires :
 * le budget ne sert à rien. Le jour où ils sont trois cents, il sert de filet et
 * l'envoi par lots devra être repensé (file d'attente côté base).
 */
const BUDGET_EMAILS_MS = 60_000;

type Annonce = {
  id: string;
  titre: string;
  corps: string;
  cible: 'clients' | 'moi';
  route: string | null;
  statut: string;
  canal: 'push' | 'email' | 'push_email';
  envoyee_par: string;
};

type Webhook = { url: string | null; secret: string | null };
type Destinataire = { user_id: string; email: string };

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
    .select('id, titre, corps, cible, route, statut, canal, envoyee_par')
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

  const veutPush = annonce.canal === 'push' || annonce.canal === 'push_email';
  const veutEmail = annonce.canal === 'email' || annonce.canal === 'push_email';

  // --------------------------------------------------------- 3. LES APPAREILS
  let userIds: string[] = [];
  if (veutPush) {
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
  }

  const { data: jetons, error: jetonsError } = userIds.length
    ? await admin.from('push_tokens').select('token').in('user_id', userIds).returns<{ token: string }[]>()
    : { data: [], error: null };
  if (jetonsError) return json(500, { erreur: 'erreur_serveur', code: 'lecture_jetons' });

  const tokens = [...new Set((jetons ?? []).map((j) => j.token))];

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

  // --------------------------------------------------------- 5. LES E-MAILS
  // Placé ENTRE l'envoi push et la lecture des reçus, exprès : les reçus Expo ne
  // sont de toute façon pas prêts avant quelques secondes, et le temps des
  // e-mails est du temps d'attente en moins.
  let emailsVises = 0;
  let emailsEnvoyes = 0;
  let emailsEchoues = 0;
  let emailsNonTentes = 0;

  if (veutEmail) {
    const debutEmails = Date.now();
    try {
      // 5a. Où écrire. Le secret ne descend JAMAIS dans le navigateur : il vit au
      // Vault et n'est lu qu'ici, avec la clé service_role.
      const { data: reglage, error: reglageError } = await admin.rpc('lire_webhook_annonce_email');
      const webhook = (Array.isArray(reglage) ? reglage[0] : reglage) as Webhook | undefined;
      if (reglageError || !webhook?.url || !webhook?.secret) {
        // ⚠️ On ne fait pas échouer l'annonce entière : le push, lui, est parti.
        // On l'écrit dans les erreurs pour que l'écran le dise.
        erreurs['email:webhook_absent'] = (erreurs['email:webhook_absent'] ?? 0) + 1;
      } else {
        const url = webhook.url;
        const secret = webhook.secret;
        // 5b. Qui. La liste des adresses ne sort que par cette RPC, réservée à
        // `service_role` : ni `anon` ni `authenticated` ne peuvent la lire.
        const { data: cibles, error: ciblesError } = await admin
          .rpc('annonces_cibles_email', { p_cible: annonce.cible, p_auteur: annonce.envoyee_par });
        if (ciblesError) throw new Error(`cibles:${ciblesError.message}`);

        const liste = (cibles ?? []) as Destinataire[];
        emailsVises = liste.length;

        if (liste.length) {
          // 5c. Le jeton de désinscription de chacun — créé s'il manque.
          // ⚠️ SANS JETON, PAS D'E-MAIL. Un message commercial sans porte de
          // sortie n'a pas le droit de partir, et un jeton manquant est le signe
          // que quelque chose s'est cassé en amont.
          const { data: paires, error: jetonsErr } = await admin
            .rpc('annonces_jetons', { p_users: liste.map((c) => c.user_id) });
          if (jetonsErr) throw new Error(`jetons:${jetonsErr.message}`);
          const jetonDe = new Map(
            ((paires ?? []) as { user_id: string; jeton: string }[]).map((p) => [p.user_id, p.jeton]),
          );

          const envoyerUn = async (c: Destinataire) => {
            const jeton = jetonDe.get(c.user_id);
            if (!jeton) {
              emailsEchoues += 1;
              erreurs['email:jeton_manquant'] = (erreurs['email:jeton_manquant'] ?? 0) + 1;
              return;
            }
            try {
              const reponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  // Le workflow n8n refuse (403) toute requête sans cet en-tête.
                  'x-taxifood-secret': secret,
                },
                body: JSON.stringify({
                  evenement: 'annonce',
                  annonce_id: annonce.id,
                  destinataire: c.email,
                  titre: annonce.titre,
                  corps: annonce.corps,
                  route: annonce.route ?? '/',
                  desinscription: `${SITE}/d/${jeton}`,
                  test: annonce.cible === 'moi',
                }),
              });
              // ⚠️ Le workflow répond APRÈS le SMTP : un 200 dit que le serveur
              // de messagerie a accepté le message. C'est la seule raison pour
              // laquelle on a le droit d'écrire « parti » dans l'historique.
              if (reponse.ok) emailsEnvoyes += 1;
              else {
                emailsEchoues += 1;
                const cle = `email:n8n_${reponse.status}`;
                erreurs[cle] = (erreurs[cle] ?? 0) + 1;
              }
            } catch (e) {
              emailsEchoues += 1;
              const cle = `email:reseau:${String(e).slice(0, 50)}`;
              erreurs[cle] = (erreurs[cle] ?? 0) + 1;
            }
          };

          for (let i = 0; i < liste.length; i += EMAILS_EN_PARALLELE) {
            if (Date.now() - debutEmails > BUDGET_EMAILS_MS) {
              // On préfère un chiffre juste et un reste annoncé à une ligne
              // d'historique qui prétend que tout est parti.
              emailsNonTentes = liste.length - i;
              erreurs['email:budget_depasse'] = emailsNonTentes;
              break;
            }
            await Promise.all(liste.slice(i, i + EMAILS_EN_PARALLELE).map(envoyerUn));
          }
        }
      }
    } catch (e) {
      console.error('envoyer-annonce: canal e-mail', e);
      const cle = `email:${String(e).slice(0, 60)}`;
      erreurs[cle] = (erreurs[cle] ?? 0) + 1;
      if (emailsVises === 0) emailsEchoues += 1;
    }
  }

  // --------------------------------------------------- 6. LES REÇUS (la vérité)
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

  // ⚠️ « Échouée » ne veut dire échouée que si RIEN n'est parti, sur AUCUN des
  // deux canaux. Une annonce dont le push part et dont les e-mails tombent reste
  // « envoyée » : elle a bien réveillé des téléphones, et le détail des échecs
  // est juste à côté. L'inverse serait pire — un statut « échec » sur une
  // annonce déjà reçue inviterait à la renvoyer.
  const rienNEstParti = reussis === 0 && emailsEnvoyes === 0;
  const quelqueChoseAEchoue = echoues > 0 || emailsEchoues > 0 || emailsNonTentes > 0;

  const { error: majError } = await admin.from('annonces').update({
    statut: rienNEstParti && quelqueChoseAEchoue ? 'echouee' : 'envoyee',
    envoyee_le: new Date().toISOString(),
    jetons_vises: tokens.length,
    envois_reussis: reussis,
    envois_echoues: echoues,
    jetons_supprimes: new Set(morts).size,
    emails_vises: emailsVises,
    emails_envoyes: emailsEnvoyes,
    emails_echoues: emailsEchoues + emailsNonTentes,
    // `recus_ok` est le nombre d'appareils qui ont VRAIMENT reçu. Il peut être
    // nul si les reçus n'étaient pas encore prêts : dans ce cas il vaut null.
    details: {
      ...(Object.keys(erreurs).length ? { erreurs } : {}),
      canal: annonce.canal,
      ...(tokens.length === 0 && veutPush ? { note: 'aucun appareil enregistre' } : {}),
      recus_ok: recusOk + recusErreurs > 0 ? recusOk : null,
      recus_echoues: recusOk + recusErreurs > 0 ? recusErreurs : null,
    },
  }).eq('id', annonce.id);
  if (majError) console.error('envoyer-annonce: historique non mis a jour', majError);

  return json(200, {
    canal: annonce.canal,
    jetons_vises: tokens.length,
    reussis,
    echoues,
    supprimes: new Set(morts).size,
    recus_ok: recusOk + recusErreurs > 0 ? recusOk : null,
    recus_echoues: recusOk + recusErreurs > 0 ? recusErreurs : null,
    emails_vises: emailsVises,
    emails_envoyes: emailsEnvoyes,
    emails_echoues: emailsEchoues,
    emails_non_tentes: emailsNonTentes,
    erreurs,
  });
});
