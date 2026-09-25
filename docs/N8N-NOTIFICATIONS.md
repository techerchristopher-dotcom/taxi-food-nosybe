# Notifications de commande — les trois canaux

Objectif : le client est prévenu à **chaque** étape de sa commande, et le
restaurant sait qu'une commande arrive, même s'il n'a pas l'application.

| Canal | Qui | Quand | État |
|---|---|---|---|
| **Push** | Client | chaque étape | ✅ en service (fonction Edge `notify-order`) |
| **E-mail** | Client | chaque étape | ⏳ workflow créé, **identifiants à choisir** |
| **Telegram** | Restaurant | nouvelle commande, annulation | ⏳ workflow créé, **robot à créer** |

## Comment ça marche

Une seule source de vérité : le trigger Postgres **`notify_order_status`** sur
`orders`, qui se déclenche à l'insertion et au changement de `status` ou de
`picked_up_at`. Il envoie **deux appels HTTP asynchrones** (`pg_net`) :

1. la fonction Edge `notify-order` → notification push ;
2. le webhook n8n → e-mail client + Telegram restaurant.

⚠️ **Asynchrones, et c'est vital** : `net.http_post` met la requête en file et
rend la main immédiatement. Une commande ne doit jamais échouer parce qu'un
service de notification répond mal.

⚠️ **Inertes tant que les secrets ne sont pas posés** : sans `n8n_webhook_url`
dans le Vault, le bloc laisse un avertissement et passe son chemin.

⚠️ **La prise en charge par le livreur ne change PAS le statut.** La commande
reste `en_livraison` du début à la fin ; seul `picked_up_at` se remplit. C'est
pourtant l'étape que le client attend le plus — d'où la clé `recuperee`, à part.

## Ce que n8n reçoit

Une charge **complète** : numéro, statut, articles, montants, nom et e-mail du
client, restaurant et son téléphone, adresse et position.

⚠️ **Volontairement complète pour que n8n n'ait AUCUN accès à la base.** Un jeton
de service dans un outil tiers serait une clé de tout le système, pour
économiser une requête.

## Workflow n8n

`n8n/taxifood-notifications.json` — créé sur l'instance sous l'identifiant
**`T7uXG7Lwwjro6Ds8`**, webhook `POST /webhook/taxifood-commande`.

> ⛔ **MISE À JOUR DU 2026-09-15 — RÉIMPORT INTERDIT.** L'avertissement ci-dessous
> (« partir de ce fichier ») est **caduc**. `n8n/taxifood-notifications.json` et
> l'instance ont divergé **dans les deux sens** : l'instance envoie par le nœud SMTP
> « SMTP account » depuis `christopher@distripro207.com` (l'expéditeur déclaré chez
> Apple), porte les boutons J'accepte / Je refuse et la photo en tête, que le fichier
> n'a pas. Réimporter le fichier casserait les notifications de tous les restaurants.
>
> **La référence est désormais l'instance.** Avant chaque modification, prendre par `GET`
> une sauvegarde datée **hors du dépôt** (elle contient le chemin du webhook de production,
> non authentifié) — ⚠️ au 2026-09-15, **aucune sauvegarde n'existe encore**. Toute modification passe
> par : `GET` → sauvegarde → modifier **la seule chaîne `jsCode`** → test local ancien
> / nouveau code sur des charges factices → `PUT` (`name`, `nodes`, `connections`,
> `settings`) → **désactiver puis réactiver** (un `PUT` sur un workflow actif ne
> réenregistre pas son webhook de production) → `GET` et diff programmé.
>
> **État au 2026-09-15 : T7uX n'a PAS été modifié** (versionId `e3ec172e…`, actif,
> 8 nœuds, inchangé depuis le 2026-09-05). La sauvegarde n'a pas pu être écrite
> (action refusée par le garde-fou de la session), donc la modification n'a pas été
> tentée.
>
> **Changement prêt, en attente — ligne « repas offert par vous » dans le Telegram
> restaurant.** Nœud « Prepare le message », constante `telegram` : insérer juste après
> la ligne `+ \`\n\n💰 ${ar(cmd.sous_total)} (hors livraison) · ${cmd.paiement}\`` :
>
> ```js
>       // Geste du restaurant (code offert) : la part offerte sort de SA recette,
>       // pas de celle de Taxi Food. Sans cette ligne, le patron verrait passer
>       // un montant qu'il ne touchera pas en entier et croirait a une erreur.
>       + (cmd.offert_par_restaurant === true
>           ? `\nRepas offert par vous — code ${cmd.code_promo || '—'} (−${ar(cmd.remise_charge_restaurant)})`
>           : '')
> ```
>
> Testé hors n8n le 2026-09-15 sur le `jsCode` live : sans geste (commande simple,
> code TAXIFOOD50, annulation, charge sans les champs `offert_par_restaurant` /
> `remise_charge_restaurant`), la sortie complète est **identique octet pour octet** à
> l'ancien code ; avec geste, seul `telegram_texte` change, d'une ligne. Rien d'autre
> (boutons, photo, e-mail client, branches). ⚠️ En mode photo, le texte est une légende
> Telegram limitée à 1 024 caractères : la ligne ajoute ~55 caractères à une commande
> déjà longue.

### Workflow « Taxi Food — code offert » (`xDZt2TzDehkvNUHN`)

Workflow **dédié**, distinct de T7uX pour ne jamais risquer les notifications de
commande. Appelé par le trigger `notifier_code_offert` (insertion `promo_envois`,
canal `email`). Code du nœud versionné dans
[`n8n/code-offert.js`](../n8n/code-offert.js).

Webhook `POST` sur un chemin non devinable (volontairement absent du dépôt), réponse
immédiate → « Prepare l e-mail du code offert » → « E-mail present ? » → « E-mail au
client » (même credential « SMTP account » et même expéditeur que T7uX, texte + HTML).

⚠️ **État au 2026-09-15 : créé INACTIF, et pas encore activable.** Le nœud webhook
exige une authentification Header Auth, mais **la credential n'est pas posée** : sa
valeur est le secret Vault `n8n_webhook_secret`, et elle n'a pas pu être transférée
de la base à n8n sans l'afficher. À faire à la main :

1. Dans n8n → *Credentials* → nouvelle **Header Auth** : nom de l'en-tête
   `x-taxifood-secret`, valeur = `n8n_webhook_secret` (Supabase → *Vault*).
2. La sélectionner sur le nœud « Code offert (webhook) », puis **activer**.
3. Tester : `POST` sans en-tête → 403 attendu ; `POST` avec l'en-tête et une charge
   factice vers une boîte interne → exécution `success`.
4. **Seulement ensuite**, poser `n8n_code_offert_url` dans le Vault (URL de
   production du webhook). Tant que ce secret n'existe pas, `notifier_code_offert` ne
   fait rien — c'est voulu : posé trop tôt, chaque envoi partirait vers un webhook
   inactif et serait perdu sans bruit (la ligne `promo_envois` reste `demande`).

⚠️ Aucun retour de n8n vers la base : on n'affiche jamais « envoyé » ni « reçu ».

> ~~⚠️ À RÉIMPORTER SUR L'INSTANCE — DEUX CHANGEMENTS EN ATTENTE (2026-09-06). Partir de ce
> fichier, jamais de la version en ligne.~~ **CADUC depuis le 2026-09-15 — voir l'encadré
> « RÉIMPORT INTERDIT » plus haut.** Le paragraphe est conservé pour l'historique des deux
> changements qu'il décrivait ; il ne doit plus guider aucun geste.

1. **La ligne de remise** (`Code TAXIFOOD50 −5 000 Ar`) dans l'e-mail client et dans le
   message Telegram ; la charge utile du trigger transporte désormais `code_promo` et
   `remise`. Tant que le workflow en ligne n'est pas remplacé, un e-mail de commande remisée
   listera « Livraison 10 000 Ar » puis un total inférieur de 5 000 : le client qui additionne
   ne tombera pas juste.
2. **L'e-mail de remboursement** (voir plus bas). Tant qu'il n'est pas en ligne, un client
   remboursé ne reçoit **rien du tout** : le trigger enverra bien sa charge utile, le nœud
   Code retombera sur `cmd.statut` et lui renverra l'e-mail d'annulation qu'il a déjà reçu.

Un seul nœud « Code » construit l'e-mail HTML et le texte Telegram pour les huit
états (reçue, confirmée, en préparation, prête, récupérée, livrée, annulée,
**remboursée**). Huit branches auraient été huit endroits à corriger.

### Workflow « Taxi Food — annonce par e-mail » (`IJ7R1rUjR59onohu`)

Workflow **dédié**, actif depuis le 2026-09-25. Il envoie l'e-mail d'une **annonce** écrite dans
l'onglet 📣 de l'admin — pas une commande. Appelé par la fonction Edge `envoyer-annonce`, une
requête par destinataire.

⛔ **Séparé de T7uX pour la même raison que le code offert** : les notifications de commande ne
doivent jamais dépendre d'un déploiement fait pour autre chose, et un `PUT` sur un workflow actif
oblige à le désactiver puis le réactiver — ce qui perd les notifications émises pendant la coupure.

**Même credential SMTP (`r44dcVHPrXmkP8KY`) et même expéditeur** `Taxi Food
<christopher@distripro207.com>` que T7uX. Ce n'est pas du confort : c'est l'adresse **déclarée chez
Apple** pour le relais privé `@privaterelay.appleid.com`. Un autre expéditeur verrait ses messages
jetés en silence pour ces comptes-là.

Chaîne : webhook `POST` (chemin non devinable, **Header Auth `x-taxifood-secret`**, credential
`xeyGARBik6oI7eKp`) → « Prepare l e-mail d annonce » (code versionné dans
[`n8n/annonce-email.js`](../n8n/annonce-email.js)) → « Envoyable ? » → « E-mail au client » →
« Parti ».

⚠️ **`responseMode: responseNode`, et c'est le point important.** Le webhook ne répond **qu'après**
le nœud SMTP : un 200 signifie que le serveur de messagerie a accepté le message. C'est ce qui
permet à l'écran admin d'écrire « parti » sans mentir. Contrairement à T7uX et au code offert, qui
répondent à la réception et ne renvoient donc rien d'utile à la base.

⚠️ **Pas de lien de désinscription, pas d'e-mail.** Le nœud « Envoyable ? » coupe la branche et le
nœud « Refuse » répond **422**. Un message commercial sans porte de sortie n'a pas le droit de
partir, et un lien manquant est le signe que la chaîne des jetons est cassée en amont.

⚠️ **Un webhook créé par l'API n'est pas enregistré tant qu'on ne l'a pas désactivé puis réactivé**,
et il lui faut un `webhookId` sur son nœud. Sans ces deux choses, l'URL de production répond
« webhook is not registered » (404) alors que le workflow est bien `active`. Constaté et corrigé
le 2026-09-25.

Secrets côté base : `n8n_annonce_email_url` et `n8n_annonce_email_secret` au Vault, lus par
`lire_webhook_annonce_email()` (grant `service_role` seul).

### L'e-mail de remboursement — `evenement: 'rembourse'`

Il n'est **pas** envoyé par `notify_order_status()`, qui en est structurellement incapable :
sur le passage `paye` → `rembourse` la commande est déjà `annulee`, donc
`new.status is not distinct from old.status` est vrai et la fonction sort sans rien envoyer.
C'est le trigger **`notifier_remboursement()`** sur `payment_refunds`
(migration `20260906093054`) qui appelle le webhook, et seulement quand un remboursement
passe à **`effectue`**.

⚠️ **Pourquoi côté `payment_refunds` et non côté `orders`** : un remboursement **partiel**
ne fait jamais basculer `orders.payment_status`, qui ne passe à `rembourse` qu'au montant
plein. Un déclencheur posé sur la commande resterait muet exactement dans le cas où le
client comprend le moins ce qu'il voit sur son relevé.

Rien n'est envoyé sur `demande` (l'argent n'est pas parti), sur `sans_objet` (rien n'avait
été capturé) ni sur `echoue` — ce dernier surtout : **le client n'a PAS son argent**, lui
écrire « vous avez été remboursé » serait le mensonge le plus grave de la chaîne. Un échec
est une alerte interne, à traiter avec l'abonnement `refund.failed` du webhook Stripe.

Bloc `remboursement` de la charge utile : `montant_minor`, `devise`, `montant_ar`, `taux`,
`capture_minor`, `partiel`, `motif`, `origine`, `effectue_le`. **Le montant annoncé est en
euros** : c'est celui que la banque du client a débité, le seul qu'il retrouvera sur son
relevé. L'e-mail dit ce qu'il doit dire — quelle commande, combien, pourquoi, et sous quel
délai (5 à 10 jours ouvrés, avec la nuance du débit qui disparaît au lieu d'un crédit
séparé). Il ne renvoie **pas** vers le téléphone du restaurant : le restaurant n'a rien
encaissé et ne peut rien rendre.

Le restaurant n'est pas prévenu par Telegram d'un remboursement : il a déjà reçu
l'annulation, et l'argent rendu est un mouvement entre Taxi Food et le client.

Le restaurant **n'est pas** notifié à chaque étape : c'est lui qui les déclenche,
le prévenir de ses propres actions serait du bruit. Uniquement nouvelle commande
et annulation.

## ⚠️ Le piège des relais privés Apple

**3 comptes sur 10** utilisent une adresse `@privaterelay.appleid.com`
(« Masquer mon adresse » lors d'une connexion Apple).

Ces adresses fonctionnent, **mais Apple ne relaie que si le domaine expéditeur
est déclaré** dans le portail développeur : *Certificates, Identifiers & Profiles
→ Services → Sign in with Apple for Email Communication → Configure*. Sinon le
message est **jeté en silence** : n8n dira « envoyé », et le client ne recevra
jamais rien. C'est le genre de panne qu'on ne découvre qu'en interrogeant un client.

### ✅ Réglé le 2026-09-05

Déclarés dans le portail, tous deux **vérifiés SPF (pastille verte)** :

| Type | Valeur |
|---|---|
| Domaine | `distripro207.com` |
| Adresse | `christopher@distripro207.com` |

⚠️ **L'expéditeur n'est pas Gmail** — ce document l'a affirmé à tort. Le nœud
« E-mail au client » envoie par le **SMTP Hostinger**, depuis
`Taxi Food <christopher@distripro207.com>`. Le domaine porte déjà SPF
(`include:_spf.mail.hostinger.com`), DKIM (`hostingermail-a`) et DMARC, ce qui
explique que la vérification Apple soit passée immédiatement.

⚠️ **Si l'adresse expéditrice change un jour, il faut revenir la déclarer ici.**
Apple ne vérifie pas l'adresse à l'envoi : il jette, sans rien signaler.

## Alerte de première connexion

⚠️ **Le trou que ça bouche.** Depuis qu'on crée les comptes partenaires
nous-mêmes, l'alerte d'inscription tire au moment où **nous** créons le compte,
pas au moment où le patron s'en sert. On envoie ses identifiants, puis plus
rien : impossible de savoir s'il a réussi à entrer, perdu le message, ou jamais
essayé. Et donc impossible d'enchaîner sur « maintenant, installez Telegram ».

Le signal est `auth.users.last_sign_in_at`, qui passe de `NULL` à une date
**exactement une fois** dans la vie d'un compte. GoTrue le met à jour lui-même :
rien à instrumenter côté application.

Trigger `on_auth_user_first_signin` → même webhook n8n que l'inscription, avec
`evenement: 'premiere_connexion'`. Le workflow, renommé **« Taxi Food —
inscription et première connexion »**, distingue les deux : objet
`✅ <Restaurant> s'est connecté`, et un encadré « Prochaine étape : Telegram ».

⚠️ **Réservé au personnel de restaurant, délibérément.** Pour un client
ordinaire, l'inscription et la première connexion sont le même instant :
alerter sur les deux doublerait chaque client sans rien apprendre. Le décalage
n'existe que pour les comptes créés à l'avance.

Le code du nœud est versionné dans
[`n8n/alerte-inscription-et-premiere-connexion.js`](../n8n/alerte-inscription-et-premiere-connexion.js) —
l'API n8n accepte uniquement `name`, `nodes`, `connections` et `settings` sur un
`PUT`, tout autre champ produit un 400.

**Vérifié pour de vrai le 2026-09-05**, pas supposé : `last_sign_in_at` remis à
`NULL` sur `demo.resto@taxifood.mg`, vraie connexion par l'API
d'authentification, puis `net._http_response` → `200 {"message":"Workflow was
started"}` et exécution n8n `success` avec l'objet
`✅ Taxi Be s'est connecté` accepté par le SMTP.

### Le mail de bienvenue au restaurateur

À la première connexion, **deux messages partent** : l'alerte au porteur du
projet, et un mail de bienvenue **au patron**, qui l'emmène installer Telegram.

⚠️ **Le nœud Code renvoie deux items**, et n8n exécute alors le nœud e-mail une
fois par item — c'est ce qui évite une branche parallèle et un second nœud à
maintenir. Le champ `destinataire` porte l'adresse, donc le nœud e-mail doit
avoir `toEmail = {{ $json.destinataire }}` et **non une adresse en dur**, sinon
le mail de bienvenue part chez nous. L'adresse était en dur : c'est corrigé.

⚠️ **Un e-mail n'exécute pas de JavaScript.** Le bouton ne peut donc pas savoir
si le lecteur est sur iPhone ou Android. Il pointe sur
[`/telegram/`](../landing/telegram/index.html) du site vitrine, qui détecte
après le clic et renvoie sur le bon magasin — vérifié sur les quatre cas, y
compris l'iPad qui se déclare « Macintosh ».

⚠️ **Pas d'échappement HTML dans une ligne d'objet.** « Chez Bidul & Truc » y
devenait « Chez Bidul &amp;amp; Truc », lisible tel quel dans la boîte de
réception. Corrigé.

Visuels du mail, déposés dans `marketing/guide/` :

| Fichier | Rôle |
|---|---|
| `telegram-logo.png` | logo Telegram, fond transparent, 240 px |
| `telegram-commande.jpg` | à quoi ressemble une commande reçue, avec ses deux boutons |

Copies dans le dépôt : [`assets/guide/`](../assets/guide/).

## Ce qu'il reste à faire

1. **Dans n8n**, ouvrir le workflow et choisir les identifiants :
   - nœud « E-mail au client » → un compte Gmail ;
   - nœud « Telegram au restaurant » → un robot Telegram (créé via `@BotFather`).
2. **Activer** le workflow (il est créé inactif).
3. ~~Déclarer l'expéditeur chez Apple~~ — **fait le 2026-09-05** (voir ci-dessus).
4. **Pour chaque restaurant**, brancher le téléphone du patron sur Telegram —
   conversation directe avec le robot, trente secondes sur son appareil.
   Procédure et pièges dans
   [ONBOARDING-RESTAURATEUR.md](ONBOARDING-RESTAURATEUR.md) § 4.
5. Passer une vraie commande de test et vérifier les trois canaux.
