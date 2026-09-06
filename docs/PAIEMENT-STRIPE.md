# Paiement par carte (Stripe) — document de référence

Tout ce qui concerne l'encaissement par carte vit ici : l'architecture, les secrets, le taux
de change, la recette, les remboursements, et ce qu'il faut faire quand le marché bouge.

Le document qui l'a précédé, [PAIEMENT-EN-LIGNE.md](PAIEMENT-EN-LIGNE.md), est **historique** :
il raconte pourquoi PayPal a été écarté en septembre 2026. Sa simulation économique reste
valable et sert de base au raisonnement sur le taux, plus bas.

---

## 1. État au 2026-09-06 — ce qui existe, ce qui n'existe pas

| Brique | État |
|---|---|
| Socle base de données (`payment_config`, `payment_intents`, `orders.payment_status`, verrous) | ✅ appliqué — migrations `20260905213821` et `20260905214324` |
| Fonction SQL de lecture des secrets `stripe_config()` | ✅ créée, réservée à `service_role` |
| RPC de repli espèces `basculer_en_especes()` | ✅ appliquée — migration `20260905221246` |
| Socle du **remboursement** (`payment_refunds`, plafond, déclenchement automatique, vues) | ✅ appliqué — migrations `20260906084514` et `20260906084907` (§ 8) |
| Fonction Edge `rembourser-paiement` (l'appel réel à Stripe) | ⛔ **n'existe pas** — le socle enregistre la demande et attend (§ 8) |
| Edge Function `creer-paiement` | ✅ déployée (`verify_jwt: true`) |
| Edge Function `stripe-webhook` | ✅ déployée (`verify_jwt: false`), endpoint Stripe `we_1UCRd0…` |
| `@stripe/stripe-react-native` **0.64.0** (version épinglée par Expo SDK 57) | ✅ installé + plugin dans `app.json` |
| `@stripe/stripe-js` **9.x** + `@stripe/react-stripe-js` **6.x** (web) | ✅ installés |
| Écran `app/app/paiement.tsx` + `components/paiement/` | ✅ écrits |
| Secrets dans le Vault Supabase | ✅ **les trois posés** (`stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`) |
| `payment_config.carte_active` | **`false`** ← le seul verrou restant |

⚠️ **Rien n'est encaissable aujourd'hui, et une seule ligne le décide.** Les secrets sont posés,
donc `stripe_config()` renvoie `configure = true` : ce qui bloque désormais, c'est uniquement
`carte_active`. Tant qu'il vaut `false`, l'option carte **n'apparaît même pas** sur l'écran de
validation, et `creer-paiement` refuse en `503 carte_inactive` avant tout appel à Stripe.

Pour ouvrir le canal, connecté avec un compte admin :

```sql
select public.admin_set_carte_active(true);
```

⚠️ **Le compte Stripe est en mode RÉEL.** Ouvrir le canal, c'est encaisser de vrais euros.

**Compte Stripe** : `acct_1SNuSk53bhPYA4IF`, nom « Rentanoo », réglé en **EUR**.

---

## 2. Architecture

```
app (PaymentSheet natif / Payment Element web)
  │
  │ 1. create_order(...)              → RPC existante, NON MODIFIÉE
  │                                     rend order.id et écrit orders.total
  │
  │ 2. POST /functions/v1/creer-paiement  { order_id, idempotency_key }
  │        verify_jwt = true                      ⚠️ AUCUN MONTANT EN ENTRÉE
  │        └─ relit orders.total EN BASE
  │        └─ montant_eur_centimes(total)  → centimes d'euro, au taux de payment_config
  │        └─ INSERT payment_intents        (l'index unique partiel tranche l'idempotence)
  │        └─ POST api.stripe.com/v1/payment_intents
  │        └─ rend { client_secret }
  │
  │ 3. le client saisit sa carte DANS LE COMPOSANT STRIPE
  │        → la carte part directement chez Stripe, jamais par notre backend
  │
  ▼
Stripe  ──webhook──▶  stripe-webhook (verify_jwt = false, signature sur le corps BRUT)
                        └─ UPDATE payment_intents.status
                             └─ trigger maj_payment_status_commande
                                  └─ orders.payment_status = 'paye'
```

### Les quatre invariants à ne jamais casser

1. **Aucun montant ne vient du client.** `creer-paiement` prend `order_id` et rien d'autre.
   Accepter un montant rendrait décoratif tout le calcul serveur (prix, options, emballage,
   livraison, code promo) : un `curl` avec `amount: 1` suffirait à manger pour un centime.
2. **La conversion ariary → euro n'existe qu'à un seul endroit** : la fonction SQL
   `montant_eur_centimes(integer)`. Ni le front, ni l'Edge Function ne recalculent. Une
   seconde implémentation divergerait le jour où le taux change.
3. **`orders.payment_status` n'est écrit par personne** — il est *déduit* de `payment_intents`
   par le trigger `maj_payment_status_commande`. Il n'existe donc aucun chemin où une commande
   serait marquée payée sans qu'un encaissement existe en face.
4. **Un montant engagé ne bouge plus.** Le trigger `orders_verrou_montants` refuse toute
   modification de `subtotal` / `packaging_fee` / `delivery_fee` / `total` dès qu'un
   `payment_intents` non terminal existe sur la commande.

### Ce que Stripe reçoit de nous, exactement

Vérifié dans `supabase/functions/creer-paiement/index.ts` : **aucune donnée personnelle**.
Le corps envoyé à Stripe contient `amount`, `currency`, `automatic_payment_methods`, une
`description` (`Taxi Food TF-xx`) et des `metadata` (`order_id`, `order_number`, `amount_ar`,
`fx_rate`, `payment_intent_row`). **Ni nom, ni e-mail, ni téléphone, ni adresse, ni
`receipt_email`, ni objet `Customer`.**

C'est ce fait qui rend les déclarations App Store / Play Store défendables (§ 7). Si un jour
on ajoute `receipt_email` ou un `Customer`, **il faudra revoir ces déclarations** — c'est le
seul changement de code qui les invalide.

---

## 3. Où vivent les secrets

**Dans le Vault Supabase, jamais dans un fichier, jamais dans la conversation.** Ils sont posés
par le porteur du projet lui-même. Le modèle est celui de `public.whatsapp_hook_config()`.

| Nom dans le Vault | À quoi ça sert | Posé ? |
|---|---|---|
| `stripe_secret_key` | appels serveur à l'API Stripe (`sk_...`) | ⛔ non |
| `stripe_webhook_secret` | vérification de signature des webhooks (`whsec_...`) | ⛔ non |
| `stripe_publishable_key` | clé publiable (`pk_...`), rangée là pour que tout Stripe vienne du même endroit | ⛔ non |

Lecture par `public.stripe_config()` — `SECURITY DEFINER`, `grant execute` à **`service_role`
uniquement**, révoquée de `public`, `anon` et `authenticated`. Elle renvoie aussi
`configure` : **le seul drapeau qu'un appelant doit tester avant d'appeler Stripe.**

```sql
-- Pose des secrets (à exécuter par le porteur du projet, depuis le tableau de bord Supabase)
select vault.create_secret('sk_live_...',    'stripe_secret_key',      'Cle secrete Stripe');
select vault.create_secret('whsec_...',      'stripe_webhook_secret',  'Signature webhook Stripe');
select vault.create_secret('pk_live_...',    'stripe_publishable_key', 'Cle publiable Stripe');

-- Contrôle, sans jamais afficher la valeur
select (public.stripe_config() -> 'configure')::boolean as pret;
```

⚠️ **La clé publiable côté web.** L'export web (`taxifood.distripro207.com`) sert le même
bundle que les stores. Une variable `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` devra être ajoutée
dans les variables d'environnement **Netlify**, à côté des trois déjà documentées dans
`app/netlify.toml`. Sans elle, le bundle web sort sans configuration de paiement.

⚠️ **`@stripe/stripe-react-native` n'a pas de PaymentSheet sur le web.** La carte devra soit
être masquée sur le web, soit passer par le Payment Element. Le précédent existe déjà dans le
projet : `app/lib/push.ts:54` (`Platform.OS !== 'web'`).

---

## 4. Le taux de change : pourquoi 4 700

### La décision

**1 EUR = 4 700 Ar**, taux fixe, décidé par le porteur du projet. Le marché est autour de
**5 008 Ar** (fourchette observée sur trente jours : 4 952 – 5 053).

Convertir à 4 700 alors que le marché est à 5 008 fait payer au client **6,55 % d'euros de
plus** qu'une conversion au cours du jour. Cet écart n'est pas une marge : **il paie les frais
Stripe**, que le tarif à la commission seule ne couvrirait pas sur des paniers aussi bas.
C'est la réponse directe à l'objection qui avait fait abandonner PayPal.

### Le taux vit en base, pas dans le code

`payment_config.fx_ar_per_eur`, une seule ligne (`id = 1`, contraint). **Un taux figé dans un
bundle mobile ne se corrigerait qu'avec une soumission à l'App Store** : plusieurs jours à
perdre de l'argent à chaque commande. Ici, c'est une requête :

```sql
select public.admin_set_fx_rate(4900);   -- réservé à is_admin(), horodate et signe
```

Bornes de sécurité sur la colonne (`between 2000 and 12000`) : elles attrapent la faute de
frappe d'un facteur 10, y compris sur un `UPDATE` fait à la main.

### Ce que l'écart couvre vraiment

Tarifs Stripe France au 2026-09-06 : carte EEE standard **1,5 % + 0,25 €**, EEE premium
**2,8 % + 0,25 €**, UK **2,5 % + 0,25 €**, hors EEE **3,15 % + 0,25 €** (+ 2 % en cas de
conversion de devise). Ce qui reste après frais, par panier :

| Panier | Débit client | Valeur au marché | Marge de change | EEE std | EEE prem. | UK | hors EEE |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 20 000 Ar | 4,26 € | 3,99 € | 0,27 € | −0,05 € | −0,10 € | −0,09 € | −0,12 € |
| 25 000 Ar | 5,32 € | 4,99 € | 0,33 € | 0,00 € | −0,07 € | −0,06 € | −0,09 € |
| 35 000 Ar | 7,45 € | 6,99 € | 0,46 € | +0,10 € | 0,00 € | +0,02 € | −0,02 € |
| 45 000 Ar | 9,58 € | 8,99 € | 0,59 € | +0,20 € | +0,08 € | +0,10 € | +0,04 € |
| **55 000 Ar** | 11,71 € | 10,98 € | 0,73 € | +0,30 € | +0,15 € | +0,18 € | **+0,11 €** |
| 80 000 Ar | 17,03 € | 15,97 € | 1,06 € | +0,55 € | +0,33 € | +0,38 € | +0,27 € |

⚠️ **L'écart de taux est proportionnel, les frais Stripe ne le sont pas.** Les **0,25 € fixes**
par transaction sont ce qui casse les petits paniers — exactement le phénomène qui avait
arrêté le projet PayPal. Seuils au-dessous desquels une commande carte **coûte de l'argent** :

| Carte du client | Seuil de rentabilité |
|---|---|
| EEE standard | **25 300 Ar** |
| UK | **32 200 Ar** |
| EEE premium | **35 100 Ar** |
| Hors EEE (touriste non européen) | **39 200 Ar** |

Le panier moyen observé (≈ 50 700 Ar de marchandise + 10 000 Ar de livraison) est confortablement
au-dessus. Une petite commande à 20 000 Ar payée par carte, elle, est perdante quelle que soit
la carte. **Piste si le sujet devient réel** : un montant minimum pour proposer la carte, à
poser dans `payment_config` à côté de `montant_minimum_minor` (qui, lui, ne porte aujourd'hui
que le minimum technique de Stripe, 50 centimes).

### Si le marché descend sous 4 700 — le scénario à surveiller

L'ariary a bougé entre 4 952 et 5 053 sur trente jours. **S'il descend sous 4 700, la marge
s'inverse** : le client paierait moins cher en euros que la valeur de sa commande en ariary,
**et** on paierait les frais Stripe par-dessus. Chaque commande carte ferait perdre de l'argent.

Conduite à tenir, dans l'ordre :

1. **Surveiller.** Le taux du marché n'est lu automatiquement nulle part — c'est délibéré (pas
   de dépendance externe fragile au moment exact où le client paie). Il faut donc le regarder
   à la main, et d'autant plus souvent qu'on s'approche de 4 700.
2. **Sous 4 850 environ** (moins de 3 % d'écart, insuffisant pour la carte moyenne) :
   remonter le taux. `select public.admin_set_fx_rate(<nouveau>);` — effet immédiat, aucun
   build, aucune soumission.
3. **En urgence** : `select public.admin_set_carte_active(false);` coupe la carte et laisse les
   espèces fonctionner. Aucun déploiement nécessaire.
4. ⚠️ **Un changement de taux ne touche pas les paiements déjà engagés.** `payment_intents`
   copie `fx_rate` à la création de la tentative, il ne le référence pas : un remboursement ou
   un rapprochement comptable refait le calcul d'hier à l'identique.
5. ⚠️ **Le taux affiché au client doit suivre.** L'app lit `payment_config` — voir § 6 : ne
   jamais écrire 4 700 en dur dans un écran ou dans un texte juridique modifiable seulement à
   la main.

---

## 5. Recette — comment tester sans encaisser pour de vrai

### 5.1 Avant tout : rester en mode test

Poser une clé `sk_test_...` dans `stripe_secret_key` et le `whsec_...` du **endpoint de test**.
Le compte Stripe expose deux jeux de clés ; le Vault n'en connaît qu'un à la fois — c'est ce
qui bascule tout le projet de test en production, et c'est le seul geste qui le fait.

### 5.2 Cartes de test Stripe

| Numéro | Ce qu'il provoque | Ce qu'on vérifie |
|---|---|---|
| `4242 4242 4242 4242` | paiement accepté | `payment_intents.status = 'capture'` puis `orders.payment_status = 'paye'` |
| `4000 0025 0000 3155` | 3-D Secure exigé | passage par `requiert_action`, puis capture après validation |
| `4000 0000 0000 9995` | fonds insuffisants | `echoue`, **la commande redevient payable** (l'index unique partiel exclut les états terminaux) |
| `4000 0000 0000 0002` | carte refusée | idem |

Date d'expiration future quelconque, CVC quelconque.

### 5.3 Les cinq contrôles qui comptent

1. **Le montant est celui de la base, pas celui du client.** Appeler `creer-paiement` avec un
   `amount` ajouté dans le corps : il doit être **ignoré**, et le PaymentIntent porter le
   montant issu de `orders.total`.
2. **Double tap.** Deux appels concurrents sur la même commande → **un seul** PaymentIntent
   chez Stripe (l'index `payment_intents_un_actif_par_commande` fait échouer le second en
   `23505`, la fonction relit la ligne et rejoue sa clé d'idempotence).
3. **Abandon.** Ouvrir le PaymentSheet, fermer l'app. `payment_intents` reste en
   `requiert_action`, `orders.payment_status` en `en_attente`. ⚠️ **Aucun événement Stripe
   n'arrivera jamais** dans ce cas : c'est ce qui impose une expiration (voir § 8).
4. **Refus puis nouvelle tentative.** Carte `...9995`, puis `4242...` : deux lignes dans
   `payment_intents`, la seconde capturée, la commande `paye`. La trace du refus subsiste.
5. **Livraison bloquée.** Avec `carte_active = true`, `mark_order_delivered` sur une commande
   `cb` non payée doit lever *« Paiement carte non confirme »*. C'est le garde-fou qui empêche
   un livreur de clore une course impayée.

⚠️ **La base est celle de PRODUCTION** — il n'y a pas de bac à sable. Tout test à effet de bord
se fait dans une transaction annulée, et les lignes de test se nettoient. Rappel du projet :
`select * from create_order(...)`, **jamais** `select (create_order(...)).*` (l'expansion `.*`
évalue la fonction une fois par colonne, donc autant de commandes parasites).

---

## 6. Ce que le client doit voir AVANT de payer

⚠️ **Obligation, pas confort.** Ne pas afficher le montant en euros et le taux appliqué avant
la validation, c'est :

- un **motif de contestation bancaire** quasi imparable (le client a vu 55 000 Ar, sa banque
  lui débite 11,71 € — il ne reconnaît pas l'opération) ;
- un **problème de droit de la consommation** : le prix total à payer doit être connu avant
  l'engagement, dans la devise du débit.

L'écran de validation doit donc afficher, **avant** le bouton qui déclenche le PaymentSheet :

- le total en ariary (déjà là) ;
- le **montant exact qui sera débité, en euros** — celui de `montant_eur_centimes(total)`,
  jamais un calcul refait côté front ;
- le **taux appliqué**, lu dans `payment_config.fx_ar_per_eur`, jamais écrit en dur ;
- le fait que ce taux est **propre à Taxi Food** et n'est pas le cours du jour ;
- la mention que la banque du client peut ajouter ses propres frais.

`payment_config` est lisible par `anon` et `authenticated` (grant par colonne : `fx_ar_per_eur`,
`devise_paiement`, `carte_active`, `montant_minimum_minor` — jamais `maj_par`, qui est une
identité). Un visiteur non connecté peut donc voir le taux.

**Textes juridiques** : la mention du taux de 4 700 est en ligne dans la politique de
confidentialité, section « Paiement », dans les trois langues (§ 7). ⚠️ **Si le taux change,
ces trois paragraphes doivent changer aussi** — ils citent le chiffre en toutes lettres.
C'est le seul endroit du projet où 4 700 est écrit en dur, et c'est assumé : un texte
juridique doit être lisible sans consulter une base.

---

## 7. Conformité — l'état après ce chantier

Le raisonnement complet, avec les citations d'Apple et de Google, est dans
[FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 2 et [FICHE-PLAY-STORE.md](FICHE-PLAY-STORE.md) § 3.
Résumé du fait le plus contre-intuitif :

| | Apple | Google |
|---|---|---|
| Données de carte | **à déclarer** (`Payment Info`) | **à NE PAS déclarer** |
| Pourquoi | l'exception d'Apple exige que la saisie ait lieu **hors de l'app** — le PaymentSheet est *dans* l'app, et Apple impose de déclarer ce que collectent les **SDK tiers** intégrés | l'exception de Google exige seulement que **l'app n'accède jamais** à l'information et que le prestataire la collecte directement — les deux conditions sont remplies |

Pages publiques mises à jour, dans les trois langues :

- `landing/confidentialite/` — section « Paiement » réécrite : Stripe nommé comme prestataire,
  ce qui transite, ce qui n'est jamais chez nous, **et le taux de 4 700 annoncé**.
- `landing/suppression-compte/` — « aucun moyen de paiement collecté » corrigé ; renvoi vers
  Stripe pour les données qu'il détient en propre.
- `landing/restaurants-partenaires/` et `landing/devenir-livreur/` — « le client paie en
  espèces » nuancé, sans promettre ce qui n'est pas encore actif.

⚠️ **Ces textes disent « en cours de déploiement ».** Le jour où `carte_active` passe à `true`,
c'est cette formule qu'il faut retirer — et elle seule.

⚠️ **Le générateur `landing/tools/build-i18n.py` est cassé depuis avant ce chantier** (29 clés
`client.*` / `stores.*` absentes des pages sources, vérifié en le lançant sur l'arbre propre).
Les quatre pages EN/IT ont donc été modifiées **à la main**, à l'identique de ce que le
générateur aurait produit. Tant qu'il ne repasse pas, plus rien ne garantit que les trois
langues restent alignées : **à réparer**.

---

## 8. Remboursements

### Le cas qui a tout déclenché — TF-96, 6 septembre 2026

```
08:09:23  TF-96 créée — 16 000 Ar, La Cabane, mode carte
08:10:09  capture chez Stripe : 3,41 € débités (pi_3UCb8j53bhPYA4IF1zRA7Usq)
08:12:06  le restaurant REFUSE depuis Telegram
```

Le client a payé, ne sera pas livré, et **l'argent n'est jamais revenu**. Aucun des trois
chemins d'annulation (`repondre_commande_par_jeton`, `set_order_status`,
`admin_set_order_status`) ne regardait `payment_status` : une commande encaissée s'annulait
aussi silencieusement qu'une commande en espèces. Les 3,41 € n'apparaissaient nulle part —
ni dans le rapport du soir (borné aux commandes `livree`), ni dans le CA du jour de l'écran
admin, ni dans aucun écran. La seule trace était la ligne `payment_intents`.

### Le socle en base — migrations `20260906084514` et `20260906084907`

| Brique | Rôle |
|---|---|
| `payment_refunds` | une ligne par remboursement, **partiels compris** — montant en centimes + équivalent ariary, taux figé, motif **obligatoire**, `origine`, `idempotency_key`, `provider_refund_id` unique |
| `payment_refunds_une_demande_en_vol` | index unique partiel : **au plus une demande en vol par paiement**. La clé d'idempotence Stripe est purgée au bout de 24 h, celle-ci ne l'est jamais |
| `verifier_plafond_remboursement()` | trigger `BEFORE` : la somme des remboursements ne peut jamais dépasser le montant capturé. Le `select … for update` sur `payment_intents` **sérialise** les demandes concurrentes — c'est le verrou, pas le calcul, qui rend le contrôle sûr |
| `demander_remboursement()` | enregistre la demande. Ne parle pas à Stripe |
| `declencher_remboursement()` | met l'appel HTTP en file (`net.http_post`). **Inerte tant que `remboursement_hook_secret` est absent du Vault** |
| `remboursement_sur_annulation` | trigger sur `orders` : toute commande qui passe en `annulee` avec un paiement **capturé** produit une demande, quel que soit le chemin d'annulation |
| `remboursement_sur_capture_tardive` | le miroir : une capture qui arrive **après** l'annulation produit aussi une demande |
| `admin_demander_remboursement()` | le geste admin, journalisé dans `admin_actions` (`action = 'remboursement'`) |
| `enregistrer_verdict_remboursement()` | la porte que `stripe-webhook` devra pousser (`effectue` / `echoue`) |
| `relancer_remboursements_en_attente()` | rejoue les envois restés en file (réservé `is_admin()`) |
| `rapport_remboursements` | la vue qui rend les remboursements visibles, **y compris sur les commandes annulées** |

⚠️ **Deux partis pris à connaître avant de toucher à tout ça :**

1. **La source de vérité est le paiement capturé, pas `payment_method`.** Une commande passée
   en « espèces » par `basculer_en_especes()` alors qu'un PaymentIntent vivait encore chez
   Stripe serait quand même remboursée. Une commande espèces n'a aucune ligne capturée : elle
   ne déclenche donc rien, sans qu'on ait à tester quoi que ce soit.
2. **Une annulation ne peut jamais échouer à cause d'un remboursement.** Le trigger est sous
   `exception when others then raise warning`. Le pire scénario acceptable est « le refus
   passe, le remboursement est à relancer » ; « le restaurant ne peut plus refuser » ne l'est
   pas.

### Ce qui manque encore pour que l'argent parte réellement

- [ ] **La fonction Edge `rembourser-paiement`** — elle n'existe pas. Contrat attendu :
      `POST /functions/v1/rembourser-paiement`, en-tête `x-hook-secret`, corps
      `{ refund_id, payment_intent_row, provider_intent_id, amount_minor, currency,
      idempotency_key, order_id, order_number, motif }`. Elle lit `stripe_secret_key` du
      Vault et poste `POST /v1/refunds` avec `payment_intent`, `amount`,
      `reason = requested_by_customer` (**jamais `fraudulent`** : Stripe met alors la carte
      et l'e-mail sur ses listes de blocage Radar).
      ⚠️ La clé d'idempotence à envoyer est `payment_refunds.idempotency_key`, **jamais**
      `payment_intents.idempotency_key` — réutiliser celle du paiement ferait rejouer à Stripe
      la réponse mémorisée du PaymentIntent au lieu de créer un remboursement.
- [ ] **Poser `remboursement_hook_secret` dans le Vault**, puis
      `select public.relancer_remboursements_en_attente();` — c'est ce qui enverra la demande
      déjà enregistrée pour TF-96.
- [ ] **Déclarer la fonction dans `supabase/config.toml`** (`verify_jwt = false` : l'appelant
      est la base via `pg_net`, il s'authentifie par `x-hook-secret`).
- [ ] **`stripe-webhook`** : s'abonner à `refund.created`, `refund.updated` et surtout
      `refund.failed` — **aucun des trois n'est dans `enabled_events`** de l'endpoint
      `we_1UCRd0…` aujourd'hui — et appeler `enregistrer_verdict_remboursement()`.
- [ ] **Prévenir le client.** `notify_order_status()` se tait sur un passage `paye` →
      `rembourse` : la commande étant déjà `annulee`, `new.status is not distinct from
      old.status` est vrai et la fonction sort sans rien envoyer. Il faut une clé d'événement
      dédiée dans le trigger **et** dans le nœud Code n8n, avec le montant en euros.
- [ ] **`app/locales/*.json`** promet déjà « Si ta carte a été débitée, tu seras remboursé
      automatiquement. » L'application annonce donc un automatisme qui ne va pas encore
      jusqu'au bout.

### Le chemin manuel, tant que la fonction Edge n'existe pas

Depuis le **tableau de bord Stripe** : Paiements → le PaymentIntent → *Refund*.

⚠️ **Un remboursement fait à la main redescend bien en base** : l'endpoint Stripe **est**
abonné à `charge.refunded` et `stripe-webhook` le traite (`nouveauStatut = 'rembourse'`).
La ligne `payment_refunds` correspondante, elle, restera en `demande` — à passer à `effectue`
à la main via `enregistrer_verdict_remboursement()`.

Retrouver le paiement à partir d'une commande :

```sql
select order_number, pi.provider_intent_id, pi.amount_minor, pi.currency,
       pi.amount_ar, pi.fx_rate, pi.status, pi.captured_at
  from public.payment_intents pi
  join public.orders o on o.id = pi.order_id
 where o.order_number = 'TF-123';
```

Et dans l'autre sens, depuis un `pi_...` orphelin : les **métadonnées** du PaymentIntent chez
Stripe portent `order_id`, `order_number`, `amount_ar`, `fx_rate` et `payment_intent_row`.
C'est le filet de rattrapage prévu pour le jour où un webhook se perd.

### Le montant à rendre

**Le montant en euros de `payment_intents.amount_minor`**, pas une reconversion au taux du
jour. Le taux est figé dans la ligne (`fx_rate`) précisément pour ça : le client doit récupérer
ce qu'il a payé, à l'euro près.

Chiffré sur TF-96 : 16 000 Ar au taux figé de 4 700 = **341 centimes**. Reconvertis au marché
du jour (~5 008), ce serait **320 centimes** — 21 centimes de moins que ce que la banque du
client a prélevés. Un écart, même minuscule, c'est le motif de contestation bancaire parfait,
et une contestation coûte 20 € (66 fois le montant en jeu ici). Dans l'autre sens, Stripe
refuse tout net : « raise an error when trying to refund more money than is left on a charge ».

⚠️ **Stripe ne rend pas les frais** sur un remboursement — « Stripe's processing fees from the
original transaction aren't returned ». Sur TF-96 : 0,30 € prélevés sur 3,41 € encaissés,
soit **8,8 % du panier** perdus sur une commande dont on ne touche rien. C'est une raison de
plus pour que le restaurant ne soit **pas** notifié avant que le paiement soit confirmé (§ 9).

⚠️ **Une nuance non vérifiée, qui change le coût réel** : un remboursement demandé peu après
la charge peut partir en *reversal* plutôt qu'en *refund* — le débit disparaît du relevé du
client au lieu qu'un crédit séparé lui soit versé, et Stripe ne retient alors aucun frais.
À constater sur le premier remboursement réel, en lisant `destination_details.card.type` et la
`balance_transaction` du `Refund`. C'est la différence entre « chaque refus coûte 0,30 € » et
« un refus immédiat ne coûte rien ».

### Ce qu'il faut écrire au client

- Le crédit apparaît **sous 5 à 10 jours ouvrés**, selon la banque.
- Si le paiement était récent, il se peut que **le débit disparaisse du relevé** au lieu d'un
  crédit séparé (cas du *reversal*) — sans quoi le client cherchera un remboursement qui
  n'apparaîtra jamais.
- Le numéro de traçabilité (ARN) met jusqu'à **7 jours ouvrés** à être disponible.
- Une carte non-euro sera reconvertie par la banque du client à **son** taux du jour : il peut
  voir revenir un montant légèrement différent de celui qu'il a vu partir. Nous, on rend
  exactement ce qui a été débité.

### Le cas « paiement pas encore capturé » : on ANNULE, on ne rembourse pas

Un PaymentIntent en `requires_capture` / `requires_action` ne se rembourse pas : il faut
`POST /v1/payment_intents/{id}/cancel`, **et c'est gratuit**. Aujourd'hui `capture_method` vaut
`automatic_async` : le cas ne se présente que sur les intents restés en `en_attente` /
`requiert_action` (client parti en 3-D Secure) et sur le repli espèces (§ 11) — où la base
marque `annule` sans que Stripe en sache rien. **Optimisation de fond**, à garder pour plus
tard : autoriser à la commande et ne capturer qu'à l'acceptation par le restaurant supprimerait
la classe de bug entière (annulation gratuite au lieu de remboursement payant).

---

## 9. Le problème connu, non résolu : le restaurant est prévenu trop tôt

`create_order` insère la commande avec `status = 'recue'`, ce qui déclenche `orders_notify_new`
→ **push + e-mail + Telegram au restaurateur, avec un lien « Accepter » cliquable** — le tout
**avant** l'affichage du PaymentSheet.

Un client qui annule le paiement, ferme l'app, ou dont la carte est refusée laisse donc un
restaurant notifié, qui peut avoir commencé à cuisiner. Ce n'est pas théorique : le lien
Telegram permet d'accepter sans jamais ouvrir l'app, donc sans aucune chance de voir un
indicateur « en attente de paiement ».

**La correction possible** — et la seule compatible avec l'interdiction de toucher
`create_order` : dans `notify_order_status()`, sur `TG_OP = 'INSERT'`, se taire quand
`new.payment_method = 'cb'` et que le paiement n'est pas confirmé, puis notifier depuis le
webhook Stripe une fois `payment_intent.succeeded` reçu.

⚠️ Piège à connaître avant de s'y mettre : `orders_notify_status` est déclaré
`AFTER UPDATE OF status, picked_up_at`. Un `UPDATE` qui ne touche que `payment_status` **ne le
déclenchera pas** tant que sa clause `OF` n'est pas étendue.

Le socle fournit déjà ce qu'il faut pour le faire (`orders.payment_status`). **Ça reste à
écrire.**

---

## 10. Ce qui reste à faire, dans l'ordre

- [x] Déployer **`stripe-webhook`**, déclarer l'endpoint Stripe, poser le `whsec_...`
- [x] Installer `@stripe/stripe-react-native` (0.64.0) et brancher le PaymentSheet
- [x] Afficher montant en euros + taux avant validation (§ 6 et § 11)
- [x] Rendre Orange Money non sélectionnable, avec badge
- [x] Trancher le sort de la carte sur le **web** : Payment Element (§ 11)
- [ ] Corriger la notification prématurée au restaurant (§ 9)
- [x] Expiration des `payment_intents` restés en `requiert_action` — **le blocage n'a pas lieu** :
      `creer-paiement` REPREND la ligne vivante et relit le PaymentIntent chez Stripe au lieu
      d'en créer un second, et `basculer_en_especes()` la passe à `annule`, ce qui libère
      l'index unique partiel. Une purge périodique reste souhaitable pour l'hygiène, elle n'est
      plus nécessaire pour débloquer un client
- [x] Poser les secrets dans le Vault (§ 3)
- [ ] Passer la recette du § 5, puis `select public.admin_set_carte_active(true);`
- [ ] **Construire un build natif** (`eas build`) : `@stripe/stripe-react-native` est un module
      natif, il n'existe pas dans les binaires 1.1.0 déjà en ligne sur les magasins. Le web,
      lui, part au prochain déploiement Netlify sans rien de plus
- [ ] Retirer « en cours de déploiement » des textes publics (§ 7)
- [ ] Mettre à jour les déclarations dans les deux consoles (§ 7)

---

## 11. Le parcours côté application

### Le choix qui structure tout : un écran, pas une modale

Le plan initial disait « brancher le PaymentSheet dans `checkout.tsx`, entre `createOrder` et
`clear()` ». Ce n'est pas ce qui a été fait, et voici pourquoi.

Un écran porte une **URL**. Sur le web, le client qui recharge la page pendant le paiement, qui
revient d'une authentification 3-D Secure, ou qui perd son réseau, retombe sur `/paiement` et
l'écran **relit l'état réel en base**. Une modale lancée depuis la validation n'aurait survécu à
aucun de ces trois cas — or « réseau coupé pendant le paiement, l'écran doit dire la vérité »
était une exigence explicite.

Conséquence sur le panier : `clear()` est appelé **dès que la commande existe**, y compris pour
une carte non payée. La commande est créée quoi qu'il arrive ; garder le panier inviterait à la
passer une seconde fois. Le repli espèces et la reprise de paiement travaillent désormais sur la
**commande**, plus jamais sur le panier — c'est ce qui permet de ne rien recréer.

```
checkout.tsx ──createOrder()──▶ commande TF-xx existe
     │
     ├── especes / orange_money ──────────────────────▶ /confirmation   (inchangé)
     │
     └── cb ──▶ /paiement?orderId=…&orderNumber=…&total=…
                   │
                   ├─ lireStatutPaiement()      déjà payé ? → /confirmation
                   ├─ creer-paiement            → client_secret + publishable_key + montant + taux
                   ├─ <FormulaireCarte>         natif : PaymentSheet · web : Payment Element
                   ├─ attendreVerdictPaiement() interroge orders.payment_status
                   └─ payé → /confirmation      refusé → réessayer OU basculer_en_especes()
```

### Les fichiers

| Fichier | Rôle |
|---|---|
| `app/data/paiement.ts` | Couche données : `lireConfigPaiement`, `preparerPaiementCarte`, `attendreVerdictPaiement`, `basculerEnEspeces`, formatage euro |
| `app/app/paiement.tsx` | L'écran : les six états (préparation, formulaire, attente, payé, échec, indisponible) |
| `app/components/paiement/contrat.ts` | Le contrat commun aux deux plateformes |
| `app/components/paiement/FormulaireCarte.tsx` | **Natif** — PaymentSheet |
| `app/components/paiement/FormulaireCarte.web.tsx` | **Web** — Payment Element |
| `app/components/paiement/ChoixModePaiement.tsx` | Les trois lignes de l'écran de validation |

### ⚠️ Le fichier `.web.tsx` n'est pas cosmétique

Stripe a fermé la question : « we do not plan on supporting the web with this SDK. Please use
Stripe.js » ([stripe-react-native#1556](https://github.com/stripe/stripe-react-native/issues/1556)).
Sans le jumeau `.web.tsx`, `expo export --platform web` embarquerait le module natif et **casserait
taxifood.distripro207.com**.

**Vérifié, pas supposé** : après `expo export --platform web`, le bundle contient `js.stripe.com`
et **zéro** occurrence de `stripe-react-native`. Le SDK natif n'est importé qu'à un seul endroit du
dépôt — `FormulaireCarte.tsx` — et ce fichier a un jumeau. Le jour où quelqu'un l'importe ailleurs
sans jumeau, l'export web tombe.

Le composant vit **hors de `app/`** exprès : dans `app/`, expo-router traiterait chaque fichier
comme une route et exigerait en plus une version sans suffixe.

### La clé publiable ne vit pas dans une variable d'environnement

Elle est dans le **Vault**, et voyage jusqu'à l'app dans la réponse de `creer-paiement`. Une seule
source de vérité : changer de compte Stripe ne demande **aucun** redéploiement de l'app ni du site.
`EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` existe en secours (`app/.env.example`) et doit rester vide.

### Les états gérés, et ce qu'ils disent

| Situation | Ce que voit le client |
|---|---|
| `carte_active = false` | **L'option carte n'existe pas** sur l'écran de validation. Pas grisée : absente |
| Montant sous le minimum Stripe | Idem, plus une phrase qui explique pourquoi |
| Feuille de paiement fermée | « Paiement annulé — rien n'a été débité », retour au formulaire |
| Refus bancaire | Le motif, puis **deux** boutons : réessayer, ou payer en espèces |
| 3-D Secure en cours | « Vérification du paiement », puis au bout de 25 s « ta banque n'a pas encore répondu » — jamais « échec » |
| Réseau coupé, app rouverte | L'écran de suivi affiche l'état réel (`payment_status`) et propose « Reprendre le paiement » |
| Canal fermé côté serveur | « Ta commande est enregistrée : règle-la en espèces à la livraison » |

⚠️ **Aucun de ces états ne marque une commande payée.** `presentPaymentSheet()` sans erreur
signifie « le client a confirmé sur son appareil », rien de plus. Le verdict est lu dans
`orders.payment_status`, que seul un trigger écrit, à partir des lignes que seul le webhook
(signature vérifiée côté serveur) modifie.

### Le repli espèces — pourquoi une RPC

`basculer_en_especes(p_order_id)` (SECURITY DEFINER, `authenticated` seulement) change
`payment_method` **sur place**. Recréer la commande aurait perdu le numéro TF-xx déjà annoncé au
restaurant et reconsommé le code promo (`code_promo:deja_utilise`). `orders` n'a aucune policy
UPDATE — c'est voulu — donc l'écriture ne pouvait passer que par une fonction.

⚠️ **Limite assumée** : la ligne `payment_intents` est marquée `annule` en base, mais le
PaymentIntent chez Stripe n'est pas annulable depuis du SQL. Si le client confirmait quand même
après avoir basculé, le webhook remettrait `payment_status = 'paye'` sur une commande « espèces ».
Le sens de la divergence est le bon (l'argent réellement encaissé est enregistré), et dans le
parcours réel la feuille est fermée avant que le repli ne soit proposé.

### Interrogation, pas temps réel

`attendreVerdictPaiement` interroge `orders.payment_status` toutes les 1,2 s puis s'espace.
**Aucune table de ce projet n'est publiée dans `supabase_realtime`** (vérifié en base) : l'écran de
suivi interroge déjà toutes les 15 s, et introduire le temps réel ici aurait demandé une migration
de publication pour une seule fonctionnalité.

### Ce qui n'est pas vérifié

- **Le PaymentSheet natif n'a jamais tourné.** Il exige un build natif, qui n'existe pas encore.
- **Aucun vrai PaymentIntent n'a été créé** : `carte_active` est resté à `false`, le compte est en
  mode réel, et il n'y a aucune commande `cb` en base.
- **Le tunnel complet en tant que client connecté** n'a pas été parcouru : il demande de saisir un
  mot de passe. Ce qui a été vérifié à la place est listé dans le rapport de session.
