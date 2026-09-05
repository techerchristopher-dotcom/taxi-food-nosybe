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
| Edge Function `creer-paiement` | 🚧 en cours d'écriture (agent parallèle) |
| Edge Function `stripe-webhook` | 🚧 en cours d'écriture (agent parallèle) |
| `@stripe/stripe-react-native` dans l'app | ⏳ pas installé |
| Secrets dans le Vault Supabase | ⛔ **aucun posé** |
| `payment_config.carte_active` | **`false`** |

⚠️ **Rien n'est encaissable aujourd'hui.** `carte_active` vaut `false` et aucun secret n'est
posé : `stripe_config()` renvoie `configure = false`, et tout appelant doit rester **inerte et
le dire**, jamais planter. C'est ce qui permet de déployer le code avant les secrets.

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

### Le chemin normal

Depuis le **tableau de bord Stripe** : Paiements → le PaymentIntent → *Refund*. C'est le seul
chemin aujourd'hui ; il n'existe **aucune RPC ni aucun écran** de remboursement.

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

⚠️ **Rembourser dans Stripe ne met PAS la base à jour** tant que `stripe-webhook` n'écoute pas
`charge.refunded` / `payment_intent.refunded`. Le webhook doit passer la ligne en `rembourse` ;
le trigger fait alors basculer `orders.payment_status` à `rembourse` tout seul. **Tant que le
webhook n'existe pas, il faut le faire à la main**, sinon la commande reste marquée `paye`
alors que l'argent est rendu.

### Le montant à rendre

**Le montant en euros de `payment_intents.amount_minor`**, pas une reconversion au taux du
jour. Le taux est figé dans la ligne (`fx_rate`) précisément pour ça : le client doit récupérer
ce qu'il a payé, à l'euro près.

⚠️ **Stripe ne rend pas les frais fixes** sur un remboursement. Une commande remboursée coûte
donc les 0,25 € (et la commission, selon le tarif). C'est une raison de plus pour que le
restaurant ne soit **pas** notifié avant que le paiement soit confirmé (§ 9).

### Le cas « le restaurant refuse la commande »

Une commande carte déjà encaissée puis refusée par le restaurant **doit être remboursée** —
c'est aujourd'hui le seul cas qui l'exige, et il n'est **pas automatisé**. Le texte de suivi
`tracking.refusedHint` (« Aucun montant ne te sera débité ») devient faux dans cette situation :
il faudra le conditionner au moyen de paiement.

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

- [ ] Terminer et déployer **`stripe-webhook`** (`verify_jwt: false`, signature vérifiée sur
      le **corps brut** — modèle `send-otp-whatsapp/index.ts:118-122`, jamais sur le JSON
      reparsé), puis **déclarer l'endpoint dans le tableau de bord Stripe** et poser le
      `whsec_...` obtenu dans le Vault
- [ ] Installer `@stripe/stripe-react-native` et brancher le PaymentSheet dans
      `app/app/checkout.tsx`, **entre `createOrder` et `clear()`** : si le paiement échoue ou
      est annulé, le panier ne doit pas être vidé
- [ ] Afficher montant en euros + taux avant validation (§ 6)
- [ ] Rendre Orange Money non sélectionnable, avec badge « Bientôt disponible »
- [ ] Décider du sort de la carte sur le **web** (masquer, ou Payment Element)
- [ ] Corriger la notification prématurée au restaurant (§ 9)
- [ ] Expiration des `payment_intents` restés en `requiert_action` — sans elle, une commande
      abandonnée reste verrouillée par l'index unique partiel et **ne peut plus être repayée**
- [ ] Poser les secrets dans le Vault (§ 3), d'abord en **test**
- [ ] Passer la recette du § 5, puis `select public.admin_set_carte_active(true);`
- [ ] Retirer « en cours de déploiement » des textes publics (§ 7)
- [ ] Mettre à jour les déclarations dans les deux consoles (§ 7)
