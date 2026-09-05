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

Un seul nœud « Code » construit l'e-mail HTML et le texte Telegram pour les sept
états (reçue, confirmée, en préparation, prête, récupérée, livrée, annulée).
Sept branches auraient été sept endroits à corriger.

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
