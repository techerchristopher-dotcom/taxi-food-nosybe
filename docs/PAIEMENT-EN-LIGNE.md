# Paiement en ligne (PayPal) — étudié le 2026-09-01, mis en attente

Demande initiale : intégrer PayPal via son API pour payer une commande depuis l'app.
**Décision du porteur du projet : on verra plus tard.** Ce document capture pourquoi,
pour ne pas refaire la même recherche à la prochaine tentative.

## Ce qui a été vérifié avant d'écrire une ligne de code

### 1. PayPal ne règle pas en ariary

Vérifié sur la [doc officielle des devises PayPal](https://developer.paypal.com/api/rest/reference/currency-codes/) :
MGA n'y figure pas. Les devises supportées sont USD, EUR, GBP, AUD, CAD, CHF, JPY et une
douzaine d'autres — aucune devise africaine. Ce n'est pas un blocage technique
contournable : PayPal ne détient tout simplement pas de solde en ariary.

Conséquence : tout paiement PayPal doit être exprimé dans une devise étrangère, converti au
moment du paiement.

### 2. Madagascar est un pays « envoi seulement » chez PayPal

Un résident de Madagascar peut payer avec une carte, mais **ne peut pas recevoir** de
paiement PayPal. Sans conséquence ici : Rentanoo est domiciliée à La Réunion, le compte
marchand recevrait donc normalement. Mais ça oriente l'usage réel vers la clientèle
touristique réunionnaise/française (qui a déjà un compte PayPal fonctionnel), pas vers les
résidents de Nosy Be.

### 3. Devise d'encaissement retenue si le projet reprend : EUR

Cohérent avec Rentanoo (entité française) et la clientèle majoritairement
réunionnaise/française. Encaisser directement en EUR évite en plus les 3 % de frais de
conversion de devise que PayPal facturerait si le montant était présenté dans une autre
devise que celle du compte marchand.

⚠️ **Le taux de conversion Ar → EUR devait être un chiffre fixe, modifiable à la main** dans
les réglages — pas un appel à une API de change en direct au moment du paiement, pour ne pas
ajouter une dépendance externe fragile exactement quand le client essaie de payer (connexion
de Nosy Be parfois instable).

### 4. La simulation économique qui a arrêté le projet

Faite avec de **vrais montants de commande** (base actuelle, prix inventés mais ordre de
grandeur représentatif) et le taux du jour (~1 € ≈ 5 000 Ar) :

| | Ariary | Euros |
|---|---|---|
| Commande moyenne (total) | 50 679 Ar | 10,14 € |
| Revenu Rentanoo par commande (commission 5 % + livraison) | 9 043 Ar | 1,81 € |
| Frais PayPal sur cette commande (2,90 % + 0,35 €, tarif UE) | — | **0,64 €** |

**PayPal mangerait environ 35 % de la marge sur une commande moyenne.** Sur la commande
médiane (42 000 Ar ≈ 8,40 €), les frais représentent plus d'un tiers du revenu type par
commande. La cause est structurelle : les **0,35 € fixes par transaction** écrasent tout sur
des montants aussi bas, quel que soit le prestataire — c'est le même phénomène que celui déjà
rencontré avec Stripe (« j'ai trop perdu dans les frais »), pas un problème propre à PayPal.

Source des frais : [PayPal France, tarifs marchands](https://www.paypal.com/fr/webapps/mpp/merchant-fees) —
2,90 % + 0,35 € en zone UE/EEE, +1,99 % pour un acheteur hors UE, +3 % supplémentaires si
conversion de devise nécessaire.

## La piste à explorer si le sujet revient : le rechargement de solde

Plutôt qu'un paiement PayPal par commande, un système de **crédit prépayé** : le client
recharge un montant plus élevé en une fois (20-50 €), une seule commission PayPal sur cette
somme, amortie ensuite sur plusieurs commandes payées avec ce crédit. Le coût PayPal tombe
sous les 5 % du volume au lieu de croquer un tiers de marge à chaque commande. Changement
d'architecture plus lourd qu'un bouton de paiement — nécessite son propre chiffrage avant de
s'y engager.

## État du code

**Rien n'a été touché.** Aucune migration, aucune Edge Function, aucun changement dans
l'app. `checkout.tsx` propose toujours les trois méthodes existantes (`cb`, `especes`,
`orange_money`) — qui sont des indications pour le livreur, pas de vrais paiements en ligne
(voir `locales/*.json` § `checkout.cbSub` / `orangeSub` : « Terminal du livreur »,
« Transfert au livreur »). Taxi Food n'a, à ce jour, **aucun paiement en ligne réel** —
cohérent avec les déclarations déjà soumises aux stores (Data Safety Android : « Financial
features : aucune »).
