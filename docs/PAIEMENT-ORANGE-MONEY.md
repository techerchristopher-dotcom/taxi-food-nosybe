# Paiement Orange Money dans l'app — API Orange Money WebPay

Chantier ouvert le 2026-10-17. Dossier Orange : `orange monnaie/` (brief, guide pré-prod, cahier de tests, logo).

## Accès

- Invitation « Orange Money WebPay **Dev** » reçue sur techerchristopher@gmail.com le **2026-10-01 16:44**.
  ⏰ Le brief Orange donne **30 jours** pour initier l'intégration → vers le **2026-10-31**.
- Compte developer.orange.com : techerchristopher@gmail.com (connexion à faire par le porteur du projet ;
  l'affichage du `client_secret` exige un code de sécurité envoyé par e-mail).
- Application **« Taxi Food Nosy Be »** (`P33QqjHu9LCPHE40`), API « Orange Money WebPay Dev (1.0) » abonnée
  avec le compte marchand de **test** d'Orange : numéro `7701900014`, code `100935`.
- Secrets dans `.secrets.local` (git-ignoré) : `OM_DEV_MERCHANT_KEY`, `OM_DEV_AUTH_HEADER`
  (= base64 `client_id:client_secret`, sans le préfixe `Basic `). À verser au Vault pour la fonction Edge.
- **Prod** : nouvelle invitation « Orange Money WebPay Madagascar », numéro et code marchand fournis par
  Orange Money Madagascar, devise `MGA`, URL `/orange-money-webpay/mg/v1/…`. Cahier de tests à remplir pour valider.

## L'API (relue sur le portail le 2026-10-17)

1. **Jeton** — `POST https://api.orange.com/oauth/v3/token`, `Authorization: Basic <OM_DEV_AUTH_HEADER>`,
   `grant_type=client_credentials` → `access_token` valable 3 600 s.
2. **Créer le paiement** — `POST /orange-money-webpay/dev/v1/webpayment` (prod : `/mg/v1/`), Bearer :
   `merchant_key`, `currency` (**`OUV` en dev**, `MGA` en prod), `order_id` (**unique dans tout le système**,
   30 car. max), `amount`, `return_url`, `cancel_url`, `notif_url` (120 car. max chacune), `lang`, `reference`
   (nom du marchand, 30 car.). Réponse 201 : `pay_token`, `payment_url`, `notif_token`.
3. Le client paie sur `payment_url` (code PIN + OTP généré par l'USSD Orange Money). **Validité 10 min.**
4. **Notification** — Orange POSTe sur `notif_url` : `{status: SUCCESS|FAILED, notif_token, txnid}`.
   Envoyée seulement en fin de paiement confirmé. **Comparer `notif_token` à celui reçu au point 2.**
5. **Statut** — `POST /orange-money-webpay/dev/v1/transactionstatus` `{order_id, amount, pay_token}` →
   `INITIATED | PENDING | EXPIRED | SUCCESS | FAILED` (+ `txnid`). Un client qui ne fait rien reste `INITIATED`.
   NOT FOUND = order_id / amount / application ne correspondent pas.
6. Erreurs 403 : `50` accès refusé (pays/URL), `1202` merchant key fausse, `1203` devise refusée,
   `1204` order_id déjà utilisé. Support : sspo.incident@orange.com.
7. **Aucune API de remboursement** documentée.

Simulateur sandbox (OTP, soldes) : https://mpayment.orange-money.com/mpayment-otp/login — identifiants de test
dans le brief Orange. Montants de test ≤ 1 000 Ar.

## Vérifié le 2026-10-17

Jeton obtenu (scope `ope:orange-money_mpay_dev:v1:access`) ; paiement `TF-ESSAI-1792262155` de 1 000 OUV
créé (201, page de paiement 200) ; statut lu : `INITIATED`. Paiement complet (OTP) **pas encore fait**.

## Ce qui est construit (2026-10-17, commit `0e5ad09`)

**Interrupteur : `payment_config.om_en_ligne_active`, ÉTEINT.** Rallumer : `select public.admin_set_om_en_ligne(true);`
(admin) ou `update payment_config set om_en_ligne_active = true where id = 1;`. Environnement :
`payment_config.om_environnement` (`dev` aujourd'hui, `mg` en production). En `dev`, le montant envoyé à Orange
est plafonné à `om_montant_test_max` (1 000).

**Base** (migrations `20261017184411_orange_money_paiement_en_ligne`, `20261017184859_…_invisible_au_restaurant`) :
- `orders.om_en_ligne` : posé par trigger BEFORE INSERT quand la commande NAÎT en `orange_money` (refus
  `paiement:orange_money_inactif` si l'interrupteur est éteint). Distingue le paiement dans l'app de l'Orange Money
  encaissé à la porte (qui passe `payment_method` à `orange_money` par UPDATE, à la livraison).
- `commande_en_attente_de_paiement(orders)` : LA définition de « muette tant que non payée » (carte + Orange Money
  en ligne), utilisée par `notify_order_status`, `passer_en_preparation_automatiquement`,
  `commande_annoncee_le` (alertes 3 min, appels) et `reservation_carte_en_attente` (commandes programmées).
- Policy `orders_select_restaurant` : une commande Orange Money en ligne non payée est INVISIBLE au restaurant,
  quelle que soit la version de l'app.
- Tentatives dans `payment_intents` (provider `orange_money`, `amount_minor` = ariary, `fx_rate` = 1,
  `om_reference` = order_id envoyé à Orange, `payment_url`, `expire_le`). `notif_token` dans
  `payment_intents_om_jetons` (aucun droit client).
- `basculer_en_especes` accepte une commande Orange Money en ligne (et remet `om_en_ligne` à faux).
- Remboursement : `declencher_remboursement` n'envoie plus que les paiements Stripe ; une demande Orange Money
  reste « demande » + alerte Telegram admin ; `admin_om_remboursement_effectue(refund_id, référence)` la clôt.
- Tâche pg_cron `orange-money-balayage` (chaque minute, n'appelle la fonction que s'il y a à faire) : revérifie
  les paiements en attente, puis `om_expirer_commandes()` annule (en silence) les commandes en ligne non payées
  après 25 min.
- Secrets Vault : `om_merchant_key`, `om_auth_header` (posés par `scripts/poser-cles-orange-money.sh` via
  `deposer-secret`), `om_hook_secret` (généré en base).

**Fonctions Edge** (`verify_jwt = false`, chacune vérifie elle-même) :
- `paiement-orange-money` : `creer` (utilisateur réel, propriétaire, rend `payment_url` ; reprend le lien vivant),
  `verifier` (revérifie chez Orange), `balayer` (en-tête `x-hook-secret`).
- `om-notification?i=<payment_intents.id>` : compare le `notif_token` (temps constant) PUIS revérifie par
  `transactionstatus` avant d'écrire. Une notification seule ne marque jamais une commande payée.

**App** : option Orange Money sélectionnable si l'interrupteur est allumé (`ChoixModePaiement`), écran
`app/paiement-om.tsx` (bouton « Payer avec Orange Money » → page Orange dans `openAuthSessionAsync` ou l'onglet
sur le web → retour → vérification serveur), suivi de commande (`EtatPaiement`) et confirmation adaptés, textes
`paiementOm.*` FR/EN/IT. Aucun module natif ajouté (`expo-web-browser` est déjà dans les binaires) : **OTA possible**.

**Vitrine** : page de retour `landing/om/index.html` (`/om/<commande>` → `taxifood://paiement-om…`,
`?w=1` → `taxifood.distripro207.com/paiement-om…`). Déployée le 2026-10-17.

## Reste à faire

1. **Test de bout en bout** (restaurant ouvert, montant ≤ 1 000 en sandbox) : commande en Orange Money, page Orange,
   OTP via le simulateur (geste du porteur du projet : identifiants de test d'Orange), retour, commande annoncée au
   restaurant. Vérifier aussi : la notification d'Orange arrive bien sur `om-notification`, l'abandon → annulation
   silencieuse à 25 min, le repli espèces.
2. Remplir le cahier de tests d'Orange (`orange monnaie/OMM_Cahier_de_tests_…xlsx`) et le renvoyer pour la prod.
3. Production : invitation « WebPay Madagascar », compte marchand Taxi Food (numéro + code), nouvelle clé →
   `scripts/poser-cles-orange-money.sh`, `om_environnement = 'mg'`.
4. Déployer : web (Netlify), OTA ×3 runtimes + variante livreur si concernée. Admin : bouton « remboursement
   Orange Money fait » et ventilation du rapport de clôture (un Orange Money payé en ligne a `payment_status = 'paye'`).
