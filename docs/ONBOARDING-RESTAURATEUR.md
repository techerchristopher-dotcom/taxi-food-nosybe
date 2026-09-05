# Onboarding d'un restaurateur — procédure complète

Comment on fait entrer un **restaurateur** (la personne) dans l'application, une
fois que son **restaurant** (l'établissement, sa carte, ses visuels) existe déjà
en base.

Ces deux choses sont distinctes et ne se font pas dans le même document :

| | Document |
|---|---|
| Créer l'établissement, sa carte, ses prix, ses visuels | [PARTENAIRES.md](PARTENAIRES.md) |
| Donner au restaurateur un compte, un accès, et le prévenir | **ce document** |

Rodée le 2026-09-05 sur **La Cabane** et **Chez Bidul & Truc**. Tout ce qui suit
a réellement été exécuté ; les pièges signalés sont ceux qu'on a rencontrés, pas
des précautions théoriques.

---

## Le principe : on crée le compte à sa place

**Un restaurateur ne s'inscrit pas.** C'est nous qui créons son compte, avec un
mot de passe que nous choisissons, et nous le lui communiquons.

Décision du porteur du projet, et elle est bonne : nos partenaires sont à Nosy
Be, souvent sur un téléphone Android d'entrée de gamme, parfois avec une adresse
Yahoo qu'ils consultent rarement. Leur demander de s'inscrire, de choisir un mot
de passe et de valider un lien de confirmation par e-mail, c'est trois occasions
d'échouer avant même la première commande.

Il reste **quand même** une pré-autorisation par e-mail en base (étape 1) : elle
sert de garde-fou et de mécanisme de rattachement automatique. Sans elle, un
compte créé n'est rattaché à aucun restaurant.

---

## Étape 1 — Pré-autoriser l'adresse e-mail

Passer par la RPC dédiée, pas par un `insert` direct — la table n'a **aucune
policy d'écriture**, c'est voulu :

```sql
select public.inviter_restaurateur('adresse@du-restaurateur.tld', '<uuid du restaurant>');
```

Elle vérifie que l'appelant est administrateur, que le restaurant existe, et
normalise l'adresse **en minuscules** (le trigger compare en minuscules, et
Supabase n'harmonise pas : « Murechoco@Gmail.com » et « murechoco@gmail.com »
seraient deux personnes différentes).

Bonus non évident : **si la personne a déjà un compte**, la RPC n'attend pas une
nouvelle inscription qui n'arrivera jamais — elle applique le rôle et le
rattachement immédiatement, et le retour le dit (`"applique": "immediatement"`).

Ce que ça déclenche : à la création du compte, le trigger `on_auth_user_invitation`
sur `auth.users` fait automatiquement, sans intervention :

- une ligne `user_roles` (`role = 'restaurant'`, `status = 'active'`)
- une ligne `restaurant_staff` reliant la personne à son restaurant
- `restaurant_invitations.utilisee_le` / `utilisee_par` renseignés

⚠️ **Cette étape n'est pas optionnelle et vient toujours en premier.** La fenêtre
de création de comptes (étape 2) refuse toute adresse absente de cette table —
c'est ce qui l'empêche de servir à fabriquer un compte arbitraire.

---

## Étape 2 — Créer le compte

### Pourquoi ce n'est pas une simple requête SQL

**Un compte ne peut pas être créé en SQL.** Une ligne insérée à la main dans
`auth.users` laisse huit colonnes de jetons à `NULL`, et GoTrue répond ensuite
*« Database error querying schema »* à la connexion. Piège rencontré sur ce
projet, ne pas y revenir.

La seule méthode correcte est l'API d'administration
(`POST /auth/v1/admin/users`), qui exige la clé `service_role`. Or **cette clé ne
doit jamais transiter par une conversation** : elle ouvre toute la base sans
restriction. La plateforme la fournit d'office à une fonction Edge — d'où le sas.

### Le sas : fonction Edge temporaire `creer-compte-partenaire`

Elle est **actuellement neutralisée** (réponse 410) et son jeton est supprimé.
Pour un nouveau partenaire, il faut la redéployer, s'en servir, puis la refermer.

Sa forme, telle qu'elle a fonctionné :

- `verify_jwt: false` — l'authentification est faite dans la fonction elle-même
- un jeton aléatoire stocké dans le **Vault**, exposé par une petite fonction SQL
  `public.jeton_creation_comptes()`, et **comparé en temps constant** (une
  comparaison naïve fuit la longueur du préfixe correct et permet de deviner le
  jeton octet par octet)
- **périmètre verrouillé** : seules les adresses déjà présentes dans
  `restaurant_invitations` peuvent donner lieu à un compte
- `email_confirm: true` — **indispensable**. Sans lui, le compte existe mais le
  partenaire doit valider un e-mail avant de pouvoir se connecter, et il n'y
  arrivera pas. C'est l'équivalent d'« Auto Confirm User » dans le tableau de bord.

Avant de créer quoi que ce soit, **vérifier la frontière de sécurité** :

```
sans jeton                   -> 403
mauvais jeton                -> 403
bon jeton, adresse inconnue  -> 403  {"raison":"adresse non pre-autorisee"}
mot de passe trop court      -> 400
```

### Le mot de passe

Convention retenue : **nom court du restaurant + `207`** (207 = l'indicatif
local, déjà présent dans `distripro207`). `cabane207`, `truc207`.

⚠️ **Minimum 6 caractères — la règle réelle de Supabase.** J'avais d'abord codé
un minimum de 8 dans la fonction : `truc207` (7 caractères) a été refusé, ce qui
ressemblait à une panne alors que le mot de passe était parfaitement valide.
Ne pas être plus strict que la plateforme.

### Refermer immédiatement après

Trois gestes, dans la foulée, pas « plus tard » :

1. Redéployer la fonction Edge en réponse `410` avec un commentaire expliquant
   qu'elle a servi et quand
2. `delete from vault.secrets where name = 'jeton_creation_comptes';`
   (⚠️ `vault.delete_secret(uuid)` n'existe pas — c'est un `delete` direct)
3. `drop function if exists public.jeton_creation_comptes();`

Puis vérifier : `curl` sur la fonction doit répondre **410**.

⚠️ La suppression définitive de la fonction Edge se fait **depuis le tableau de
bord Supabase** — l'API MCP sait redéployer, pas supprimer.

---

## Étape 3 — Vérifier le rattachement automatique

Ne jamais supposer que le trigger a fait son travail :

```sql
select u.email,
       u.email_confirmed_at is not null         as email_confirme,
       ur.role::text || ' / ' || ur.status::text as role,
       r.name                                    as restaurant,
       i.utilisee_le is not null                 as invitation_appliquee
  from auth.users u
  left join public.user_roles ur on ur.user_id = u.id and ur.role = 'restaurant'
  left join public.restaurant_staff rs on rs.user_id = u.id
  left join public.restaurants r on r.id = rs.restaurant_id
  left join public.restaurant_invitations i on i.email = lower(u.email)
 where u.email = 'adresse@du-restaurateur.tld';
```

Les quatre colonnes doivent être vraies / renseignées.

---

## Étape 4 — Telegram : un groupe par restaurant

Le restaurateur reçoit ses commandes sur Telegram, avec des boutons
**Accepter / Refuser** qui mettent à jour la commande dans l'application sans
qu'il ait besoin d'ouvrir quoi que ce soit. C'est ce qui lui fait gagner du temps,
et c'est l'argument à mettre en avant.

Le robot : **@Taxifood_commandes_bot** (« Taxi Food commandes »). Son jeton est
dans `.secrets.local` (gitignored, `chmod 600`), jamais dans le dépôt.

### ⚠️ Un groupe, pas une conversation privée

Le réflexe est de demander au restaurateur d'écrire au robot depuis son compte.
Ça marche, mais ça attache les commandes à **une personne** : le jour où il
change de téléphone, part en congé ou vend l'affaire, le canal meurt avec lui.

Un groupe résout les trois : plusieurs employés y voient les commandes, on y
reste soi-même pour dépanner, et l'identifiant survit aux changements d'équipe.

### La marche à suivre

1. **[lui]** Installer Telegram avec **son numéro habituel**
2. **[lui]** Créer un groupe « Taxi Food — Nom du restaurant » et nous y ajouter
3. **[nous]** Ajouter `@Taxifood_commandes_bot` au groupe
4. **[nous]** Envoyer `/start@Taxifood_commandes_bot` **dans le groupe**
5. **[nous]** Lire l'identifiant :
   ```bash
   set -a; . ./.secrets.local; set +a
   curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getUpdates"
   ```
6. **[nous]** `select public.set_restaurant_telegram('<uuid>', '<chat_id>');`
7. **[nous]** Passer une **vraie commande de test** et regarder le groupe

⚠️ L'étape 7 n'est pas décorative : voir la ligne remplie en base ne prouve rien.
La seule preuve est le message qui arrive avec ses deux boutons.

### Les pièges

- ⚠️ **Le robot n'écoute pas tout.** `can_read_all_group_messages: false` : dans
  un groupe il ne voit que ce qui lui est explicitement adressé. Sans le
  `/start@Taxifood_commandes_bot` de l'étape 4, `getUpdates` ne renvoie rien et
  tout semble cassé sans l'être.
- ⚠️ **L'identifiant d'un groupe est négatif** — garder le signe moins.
- ⚠️ **Il change si le groupe devient un supergroupe** (Telegram convertit dès
  que le groupe grandit ou devient public) : `-987654321` devient
  `-100987654321`. Les commandes s'arrêtent net, sans erreur. Première chose à
  vérifier si un restaurant cesse de recevoir.
- ⚠️ **Jamais le `@pseudo`**, toujours l'identifiant numérique : un pseudo peut
  être changé par n'importe quel administrateur du groupe, et repris par un autre.
- ⚠️ **`getUpdates` répond `409 Conflict`** si un nœud *Telegram Trigger* tourne
  dans n8n sur le même robot — Telegram réserve alors les mises à jour au
  webhook. Aucun webhook n'est posé aujourd'hui.

### ⚠️ État réel au 2026-09-05

**Aucun restaurant n'a de vrai canal.** L'identifiant enregistré pour La Cabane,
`7699975131`, est celui de la **conversation privée du porteur du projet** avec
le robot — posé pendant les tests. Ses commandes arrivent donc chez lui, pas au
restaurant. À refaire avec un vrai groupe.

Page d'accompagnement (générateur de requête + pièges) :
https://claude.ai/code/artifact/5b98005a-012b-4c88-985c-e7d8a8f0d4e1

## Étape 5 — Le guide interactif

**https://taxifoodnosybe.distripro207.com/mon-espace/**

Page d'accompagnement animée, en **français, anglais et italien** (détection
automatique de la langue du téléphone, avec choix manuel). Elle guide l'œil pas à
pas, en quatre clics, sans texte à lire.

Depuis que les comptes sont pré-créés, elle sert surtout à montrer **où se
connecter** et **à quoi ressemble l'espace**. Si un jour on remet une inscription
autonome, ses écrans de branchement (Gmail / autre adresse) sont déjà là.

⚠️ Deux erreurs commises dessus, à ne pas refaire :
- naviguer entre les écrans **par `data-i`, jamais par position dans le DOM** —
  un écran inséré au milieu casse tout le parcours silencieusement
- le repère visuel doit être un **contour fin**, et le doigt placé **à côté** de
  la cible : un halo plein recouvrait le lien qu'il désignait

---

## Étape 6 — ⚠️ Le message copier-coller (à ne jamais oublier)

**C'est le livrable final de la procédure.** Un compte créé et non communiqué ne
sert à rien. À la fin de chaque onboarding, produire un message prêt à coller,
qui contient **obligatoirement les trois éléments** :

1. **le lien** de connexion
2. **l'adresse e-mail** du compte
3. **le mot de passe**

### Modèle

```
Bonjour <Prénom>,

Votre restaurant <Nom du restaurant> est maintenant en ligne sur Taxi Food 🎉

Votre compte est déjà créé, vous n'avez rien à inscrire.

👉 Connexion : https://taxifood.distripro207.com
   Adresse e-mail : <email>
   Mot de passe : <motdepasse>

Choisissez « Se connecter avec un e-mail », entrez ces deux lignes, et vous
arrivez directement dans votre espace.

Un petit guide en images si besoin :
https://taxifoodnosybe.distripro207.com/mon-espace/

Depuis votre espace vous pouvez ouvrir et fermer votre restaurant, régler vos
horaires jour par jour, changer votre logo et votre photo, et ajouter vos plats
du jour.

Vous recevrez chaque commande sur Telegram, avec deux boutons Accepter et
Refuser — pas besoin d'ouvrir l'application pour répondre.

À très vite,
```

### Adaptations

- **Anglais / italien** si le restaurateur ne parle pas français — le guide existe
  déjà dans les trois langues
- **WhatsApp plutôt que l'e-mail** : c'est le canal réellement lu à Nosy Be, et
  ça évite le problème ci-dessous

✅ **Le relais privé Apple ne bloque plus.** `distripro207.com` et
`christopher@distripro207.com` sont déclarés dans le portail développeur depuis le
2026-09-05, vérifiés SPF. Les adresses en `@privaterelay.appleid.com` (3 comptes
sur 10) reçoivent désormais nos messages. ⚠️ Si l'adresse expéditrice change, il
faut revenir la déclarer : Apple jette sans rien signaler.

⚠️ **Ne pas promettre que le lien ouvre l'application installée.** Les liens
universels n'arriveront qu'avec le prochain build groupé. Cette promesse a déjà
été écrite une fois à tort dans un e-mail.

---

## Récapitulatif — la checklist

- [ ] 1. `restaurant_invitations` : e-mail pré-autorisé, rattaché au bon `restaurant_id`
- [ ] 2. Compte créé via la fenêtre Edge (`email_confirm: true`, mot de passe ≥ 6)
- [ ] 3. Fenêtre refermée : Edge en 410 + secret du Vault supprimé + fonction SQL supprimée
- [ ] 4. Rattachement vérifié en SQL (`user_roles`, `restaurant_staff`, `utilisee_le`)
- [ ] 5. Telegram : **groupe dédié** créé, robot ajouté, `telegram_chat_id` et `phone` renseignés, **commande de test reçue avec ses boutons**
- [ ] 6. **Message copier-coller remis au porteur du projet, avec lien + e-mail + mot de passe**

---

## Les adresses qui comptent

| | |
|---|---|
| Application (commande + espace partenaire) | https://taxifood.distripro207.com |
| Site vitrine | https://taxifood.rentanoo.com — aussi https://taxifoodnosybe.distripro207.com |
| Guide restaurateur | https://taxifoodnosybe.distripro207.com/mon-espace/ |

## État des partenaires

| Restaurant | E-mail | Mot de passe | Compte | Telegram |
|---|---|---|---|---|
| La Cabane | murechoco@gmail.com | `cabane207` | ✅ 2026-09-05 | ⚠️ à refaire — pointe sur une conversation privée |
| Chez Bidul & Truc | marcantoine14000@yahoo.fr | `truc207` | ✅ 2026-09-05 | ❌ à faire |
| Les Siciliens | — | — | ❌ | ❌ |
| Taxi Be | — | — | ❌ | ❌ |
| Angelo | — | — | ❌ (masqué) | ❌ |
