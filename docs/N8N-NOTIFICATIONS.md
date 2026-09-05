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
jamais rien.

À faire avant de compter sur l'e-mail : y déclarer l'adresse expéditrice Gmail
retenue. C'est le genre de panne qu'on ne découvre qu'en interrogeant un client.

## Ce qu'il reste à faire

1. **Dans n8n**, ouvrir le workflow et choisir les identifiants :
   - nœud « E-mail au client » → un compte Gmail ;
   - nœud « Telegram au restaurant » → un robot Telegram (créé via `@BotFather`).
2. **Activer** le workflow (il est créé inactif).
3. **Déclarer l'expéditeur Gmail** chez Apple (voir ci-dessus).
4. **Pour chaque restaurant**, récupérer l'identifiant de son canal Telegram et
   le poser : `select public.set_restaurant_telegram('<uuid>', '<chat_id>');`
   ⚠️ L'identifiant **numérique**, pas le `@pseudo` : un pseudo peut changer.
5. Passer une vraie commande de test et vérifier les trois canaux.
