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
