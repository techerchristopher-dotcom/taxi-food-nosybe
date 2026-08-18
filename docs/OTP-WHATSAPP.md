# Code de vérification par WhatsApp

Comment le code à 6 chiffres de l'inscription par numéro de téléphone part **sur WhatsApp**
plutôt que par SMS, et ce qu'il reste à faire pour l'allumer.

## Pourquoi WhatsApp et pas un SMS

Aucun fournisseur SMS n'est configuré aujourd'hui : `/otp` répond `400: Unsupported phone
provider`, donc le bouton « Continuer avec un numéro » est inopérant en production.

Le SMS vers Madagascar est facturé à l'unité par tous les opérateurs (Twilio et
équivalents), sans palier gratuit. WhatsApp Business, lui, offre un **quota mensuel gratuit
de conversations « authentification »**, largement au-dessus de ce qu'un bar-restaurant de
Nosy Be consomme — et c'est de toute façon la messagerie que tout le monde utilise sur
place.

Le reste des messages de l'app ne passe **pas** par là : le suivi de commande est en
notification push (gratuit, illimité). Le code d'inscription est le seul moment où l'on n'a
pas encore d'appareil enregistré, donc le seul qui a besoin d'un canal externe.

## Comment ça marche

```
app  →  signInWithOtp({ phone })
     →  Supabase Auth génère le code
     →  « Send SMS Hook »  →  Edge Function send-otp-whatsapp
     →  WhatsApp Cloud API (Meta)  →  message sur le téléphone du client
app  →  verifyOtp({ phone, token, type: 'sms' })  →  session
```

Côté app, **rien ne change** : Supabase appelle le hook au lieu d'un opérateur SMS, et
`verifyOtp` valide le code exactement comme avant. Le canal reste nommé `sms` dans l'API
Supabase — c'est seulement le transport qui diffère. Seuls les libellés d'écran ont été
réécrits (« Code WhatsApp », « Ce numéro doit donc avoir WhatsApp »).

Code : [`supabase/functions/send-otp-whatsapp/index.ts`](../supabase/functions/send-otp-whatsapp/index.ts).

## Sécurité

- `verify_jwt` est **désactivé** : l'appelant est Supabase Auth, pas un utilisateur porteur
  de jeton. La fonction vérifie donc elle-même la signature **Standard Webhooks**
  (`webhook-id`, `webhook-timestamp`, `webhook-signature`), en HMAC-SHA256, avec
  comparaison à temps constant et refus au-delà de 5 minutes d'écart (anti-rejeu).
- Les identifiants Meta et le secret du hook vivent dans le **Vault Supabase**, chiffrés.
  La RPC `public.whatsapp_hook_config()` est le seul point de lecture, exécutable
  **uniquement par `service_role`**. Aucun secret dans le dépôt ni dans les variables
  d'environnement de la fonction.
- Le code à 6 chiffres n'est **jamais écrit dans les logs** : en cas de refus côté Meta, on
  ne journalise que le statut HTTP et le message d'erreur de Meta.

## Ce qu'il reste à faire (action de ta part)

Tant que les secrets ne sont pas posés, la fonction répond `500 whatsapp not configured` et
la connexion par numéro reste inopérante — exactement comme aujourd'hui, sans régression.

### 1. Côté Meta (developers.facebook.com)

1. Créer une app **Business** et y ajouter le produit **WhatsApp**.
2. Rattacher un **numéro d'expéditeur WhatsApp Business**. ⚠️ Ce numéro ne doit plus être
   utilisé dans l'application WhatsApp normale. Le numéro de test fourni par Meta suffit
   pour valider la chaîne, mais il ne peut écrire qu'à des numéros déclarés à la main.
3. Relever le **Phone number ID** (pas le numéro lui-même).
4. Créer un **utilisateur système** avec le rôle sur l'app WhatsApp, et générer un **jeton
   d'accès permanent** (les jetons temporaires expirent en 24 h — inutilisables ici).
5. Créer un **modèle de message** de catégorie **Authentification**, avec le bouton
   « Copier le code », et le faire approuver (quelques minutes en général). Noter son nom
   exact (par exemple `otp_taxi_food`) et sa **langue** (`fr`).

### 2. Côté Supabase — activer le hook

Tableau de bord → **Authentication → Hooks → Send SMS Hook** :

- type **HTTPS**
- URL : `https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/send-otp-whatsapp`
- copier le **secret** généré (il commence par `v1,whsec_`)

Puis **Authentication → Sign In / Providers → Phone** : activer le provider (le
fournisseur SMS peut rester vide, le hook le remplace).

### 3. Côté Supabase — poser les secrets

Dans le **SQL Editor**, en remplaçant les cinq valeurs. À faire toi-même : ces
identifiants ne doivent transiter nulle part ailleurs.

```sql
select vault.create_secret('COLLER_LE_JETON_PERMANENT_META', 'whatsapp_token');
select vault.create_secret('COLLER_LE_PHONE_NUMBER_ID',      'whatsapp_phone_number_id');
select vault.create_secret('otp_taxi_food',                  'whatsapp_template_name');
select vault.create_secret('fr',                             'whatsapp_template_lang');
select vault.create_secret('v1,whsec_COLLER_LE_SECRET_DU_HOOK', 'send_sms_hook_secret');
```

Si le modèle approuvé n'a **pas** de bouton « Copier le code » :

```sql
select vault.create_secret('false', 'whatsapp_template_has_button');
```

Pour corriger une valeur déjà posée, utiliser `vault.update_secret` plutôt que d'en créer
une seconde du même nom.

### 4. Vérifier

Lancer l'app, « Continuer avec un numéro », saisir un numéro qui a WhatsApp. Le message
doit arriver en quelques secondes. En cas d'échec, la raison exacte donnée par Meta est
dans les logs de la fonction (tableau de bord → Edge Functions → `send-otp-whatsapp`) :

| Symptôme | Cause probable |
|---|---|
| `500 whatsapp not configured` | un des secrets manque ou est mal nommé |
| `403 forbidden` | le secret du hook posé dans le Vault ne correspond pas à celui du tableau de bord |
| `502` + `code 190` | jeton Meta invalide ou expiré (jeton temporaire au lieu de permanent) |
| `502` + `code 132000` | le modèle attend un composant bouton : poser `whatsapp_template_has_button` |
| `502` + `code 131030` | numéro destinataire non déclaré (limite du numéro de test Meta) |

## Ce qui a déjà été vérifié

Chaîne testée de bout en bout avec des secrets factices, supprimés depuis :

- signature valide → la requête part bien vers l'API Meta (rejetée en `401` par le jeton
  factice, ce qui prouve que l'appel est complet et bien formé) ;
- signature fausse → `403` ;
- corps modifié après signature → `403` ;
- horodatage vieux de 2 h → `403` ;
- deux signatures dont une bonne (rotation de secret) → acceptée ;
- aucun code à 6 chiffres présent dans les logs.

Reste à valider avec de vrais identifiants Meta et un vrai numéro.
