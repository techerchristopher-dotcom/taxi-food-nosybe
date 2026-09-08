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
| Fonction Edge `rembourser-paiement` (l'appel réel à Stripe) | ✅ **déployée** (`verify_jwt: false`) — migrations `20260906090100` et `20260906090200`, secret `remboursement_hook_secret` posé (§ 8) |
| Edge Function `creer-paiement` | ✅ déployée (`verify_jwt: true`) |
| Edge Function `stripe-webhook` | ✅ déployée (`verify_jwt: false`), endpoint Stripe `we_1UCRd0…` |
| `@stripe/stripe-react-native` **0.64.0** (version épinglée par Expo SDK 57) | ✅ installé + plugin dans `app.json` |
| `@stripe/stripe-js` **9.x** + `@stripe/react-stripe-js` **6.x** (web) | ✅ installés |
| Écran `app/app/paiement.tsx` + `components/paiement/` | ✅ écrits |
| Secrets dans le Vault Supabase | ✅ **les quatre posés** (`stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`, `remboursement_hook_secret`) |
| `payment_config.carte_active` | ⚠️ **`true`** — le canal est OUVERT |

⚠️ **LE CANAL EST OUVERT ET LE COMPTE EST EN MODE RÉEL.** Relevé en base le 2026-09-06 à 09 h :
`carte_active` vaut **`true`** depuis 07 h 39, et TF-96 l'a prouvé en encaissant 3,41 € pour de
bon. Ce tableau annonçait `false` — il datait d'avant l'ouverture, et le CLAUDE.md en a hérité.
Chaque commande carte qui passe débite donc de vrais euros.

Pour refermer le canal en urgence, connecté avec un compte admin :

```sql
select public.admin_set_carte_active(false);   -- les espèces continuent de fonctionner
```

La clé Stripe du Vault est une clé **restreinte**. Vérifié le 2026-09-06 sans rien créer
(`POST /v1/refunds` avec un corps vide, sans `payment_intent` : Stripe vérifie les permissions
avant les paramètres) : elle répond **400 « One of the following params should be provided »**
et non 403 — elle a donc bien le droit d'**écrire des remboursements**.

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
| `relancer_remboursements_en_attente()` | rejoue les envois restés en file. Ouverte à un administrateur connecté **et à la base elle-même** (éditeur SQL, `service_role`) depuis la migration `20260906113000` — avant elle, `is_admin()` seul la rendait **inutilisable depuis l'éditeur SQL**, où `auth.uid()` est NULL |
| `rapport_remboursements` | la vue d'agrégat par jour et par restaurant — elle compte, elle ne montre pas |
| `suivi_remboursements` | **une ligne par paiement encaissé**, avec la colonne `ou_en_est` en français : c'est la vue qui répond à « ce client a-t-il été remboursé ? » en une requête |

⚠️ **Deux partis pris à connaître avant de toucher à tout ça :**

1. **La source de vérité est le paiement capturé, pas `payment_method`.** Une commande passée
   en « espèces » par `basculer_en_especes()` alors qu'un PaymentIntent vivait encore chez
   Stripe serait quand même remboursée. Une commande espèces n'a aucune ligne capturée : elle
   ne déclenche donc rien, sans qu'on ait à tester quoi que ce soit.
2. **Une annulation ne peut jamais échouer à cause d'un remboursement.** Le trigger est sous
   `exception when others then raise warning`. Le pire scénario acceptable est « le refus
   passe, le remboursement est à relancer » ; « le restaurant ne peut plus refuser » ne l'est
   pas.

### La fonction Edge `rembourser-paiement` — ✅ déployée le 2026-09-06

`supabase/functions/rembourser-paiement/index.ts`, `verify_jwt = false`, déclarée dans
`supabase/config.toml`. Elle est ce qui manquait entre « la demande est enregistrée » et
« l'argent part ».

**Deux portes d'entrée, jamais une troisième** : la base (en-tête `x-hook-secret`, comparé au
Vault **à temps constant**) ou un administrateur authentifié (`user_roles.role = 'admin'`,
`status = 'active'`, lu explicitement — pas `is_admin()`, qui s'appuie sur `auth.uid()`, NULL
sous la clé `service_role`). Vérifié : la **clé `anon` du projet**, qui est un JWT valide et
que porte l'app cliente, se fait refuser en `403 jeton_invalide`.

**Elle n'accepte aucun montant**, exactement comme `creer-paiement`. Le corps peut porter
`amount_minor` et `currency` — le trigger les envoie — mais ils ne servent qu'à **vérifier** :
s'ils diffèrent de la ligne `payment_refunds`, elle refuse en `409` **avant tout appel à
Stripe**. Le montant qui part est `payment_refunds.amount_minor`, relu en base.

**Elle relit l'état réel chez Stripe avant d'agir** (`GET /v1/payment_intents/{id}` avec
`expand[]=latest_charge`), et branche :

| État Stripe du PaymentIntent | Ce qu'elle fait |
|---|---|
| `succeeded` | `POST /v1/refunds` — `reason = requested_by_customer`, **jamais `fraudulent`** (listes de blocage Radar) |
| `requires_*`, `processing` | `POST /v1/payment_intents/{id}/cancel` — **gratuit**, rien n'avait été pris |
| `canceled` | rien du tout |

Dans les deux derniers cas la demande se clôt en **`sans_objet`** (quatrième état ajouté par la
migration `20260906090100`) : dire `effectue` ferait entrer un montant jamais rendu dans le
rapport, et `echoue` crierait à l'incident sur une ligne où personne ne doit rien à personne.

**Trois barrières contre le double remboursement**, dans cet ordre :
1. la fonction refuse une demande qui n'est plus en `demande` ou qui porte déjà un `re_...`
   (réponse `200 deja_traite`, **sans toucher à Stripe**) ;
2. l'en-tête `Idempotency-Key` envoyé à Stripe est `payment_refunds.idempotency_key` — **jamais**
   `payment_intents.idempotency_key`, qui ferait rejouer la réponse mémorisée du PaymentIntent ;
3. `enregistrer_envoi_remboursement()` n'attache un `re_...` qu'à une ligne qui n'en a pas.
   C'est la seule des trois qui survive à la purge des clés d'idempotence Stripe (24 h).

⚠️ **Un envoi raté ne marque jamais la demande `echoue`** : elle reste en `demande` avec son
motif dans `erreur`, et `relancer_remboursements_en_attente()` la rejouera. La marquer terminale
la sortirait de l'index unique partiel `payment_refunds_une_demande_en_vol` — la relance
créerait alors une **seconde** demande, donc un second remboursement.

⚠️ **`carte_active` n'est délibérément pas testé** dans cette fonction : couper l'encaissement ne
doit jamais empêcher de rendre de l'argent déjà pris. C'est même le moment où on en a besoin.

**Ce qui reste :**

- [ ] `select public.relancer_remboursements_en_attente();` — **c'est ce geste qui rendra les
      3,41 € de TF-96**. Volontairement pas fait : cette commande est celle du porteur du projet,
      à lui de décider s'il la rembourse par là ou depuis le tableau de bord Stripe.
      ⚠️ **Cet appel levait « Reserve aux administrateurs » jusqu'à la migration
      `20260906113000`** : `is_admin()` lit `auth.uid()`, NULL sur une connexion directe. Le
      filet de sécurité de tout le chantier n'avait donc jamais pu se déclencher. Le même geste
      existe maintenant en un clic dans l'onglet **Remboursements** (bouton « Relancer les
      envois »), qui n'apparaît que s'il y a quelque chose à relancer.
- [ ] **`stripe-webhook`** : s'abonner à `refund.created`, `refund.updated` et surtout
      `refund.failed` — **aucun des trois n'est dans `enabled_events`** de l'endpoint
      `we_1UCRd0…` aujourd'hui — et appeler `enregistrer_verdict_remboursement()`.
- [x] **Prévenir le client — fait le 2026-09-06** (migration `20260906093054` +
      `n8n/taxifood-notifications.json`). Voir « L'annonce au client » plus bas.
      ⚠️ **Le workflow n8n reste à réimporter sur l'instance** : tant que ce n'est pas fait,
      le trigger envoie bien sa charge utile mais le nœud Code en ligne ne connaît pas la clé
      `rembourse` et renvoie l'e-mail d'annulation.
- [ ] **`app/locales/*.json`** promet déjà « Si ta carte a été débitée, tu seras remboursé
      automatiquement. » L'application annonce donc un automatisme qui ne va pas encore
      jusqu'au bout.

### Un soir de service, 21 h — revue d'exploitation du 2026-09-06

Le scénario réel : le restaurant refuse depuis Telegram une commande déjà débitée, personne
n'est devant un écran. Voici ce que la chaîne fait, seule.

**Le chemin nominal tient, et il est rapide.** `repondre_commande_par_jeton` passe la commande
en `annulee` → le trigger `remboursement_sur_annulation` écrit la demande → `declencher_remboursement()`
met l'appel en file (`pg_net`) → `rembourser-paiement` relit Stripe, poste le remboursement,
écrit le verdict → le trigger `notifier_remboursement` prévient le client. **Quelques secondes**,
sans intervention. Le client reçoit l'e-mail d'annulation, puis celui du remboursement.

**Mais la chaîne n'a aucune seconde chance automatique.** Quatre faits, tous vérifiés en base :

1. **`pg_cron` n'est pas installé sur ce projet** (`select * from pg_extension` : absent).
   Rien de périodique ne tourne. Aucune relance, aucune veille, aucune alerte.
2. **`pg_net` n'est pas une file avec réessai.** Il émet une fois. Si Stripe est indisponible à
   cet instant, la fonction Edge écrit le motif dans `payment_refunds.erreur`, laisse la demande
   en `demande` — c'est le bon comportement, `echoue` voudrait dire « la banque a refusé » — et
   **plus rien ne se passe**. La demande ne se perd pas : elle **dort**.
3. **Une demande qui dort bloque tout le reste.** L'index unique partiel n'autorise qu'une
   demande en vol par paiement : tant qu'elle y est, aucun autre remboursement n'est possible
   sur ce paiement, et l'écran admin masquait le bouton « Rembourser ».
4. **Le réveil demande un geste humain**, et il faut d'abord savoir qu'il y a quelqu'un à
   réveiller. C'est ce que la revue a corrigé : bannière rouge + bouton « Relancer les envois »
   dans l'onglet Remboursements, et la vue `suivi_remboursements` côté SQL.

**Combien de temps avant que le client soit remboursé et prévenu ?** Quelques secondes si tout
va bien ; **indéfiniment** si l'envoi échoue et que personne ne regarde. Il n'y a pas de délai
maximal garanti, et il ne peut pas y en avoir sans ordonnanceur.

**« Ce client a-t-il été remboursé ? » — une requête, désormais :**

```sql
select commande, client, encaisse_minor, remboursement, ou_en_est, depuis
  from public.suivi_remboursements where commande = 'TF-96';

-- et le balayage du soir :
select * from public.suivi_remboursements where a_regarder;
```

`ou_en_est` distingue les six situations en français, dont les deux qu'aucun écran ne séparait :
« envoyé à Stripe, verdict attendu » et « **PAS PARTI CHEZ STRIPE** ». `a_regarder` isole ce qui
réclame une main : une commande annulée et encaissée sans aucune demande, un `echoue`, ou une
demande de plus de dix minutes sans `re_...`.

⚠️ La vue porte le nom et le téléphone du client : elle est révoquée à `anon` **et** à
`authenticated` (vérifié : `permission denied for view suivi_remboursements`). Elle sert la
connexion directe, pas l'API.

**Ce qui reste ouvert après cette revue** — aucun n'est corrigeable depuis le périmètre du
chantier :

- **`stripe-webhook` n'est abonné à aucun `refund.*`.** Quand Stripe répond `pending` plutôt que
  `succeeded`, la demande reste en `demande` **pour toujours** : le client n'est jamais prévenu,
  `payment_status` ne bascule jamais, et le paiement reste bloqué pour tout autre remboursement.
  Et surtout un `refund.failed` — l'argent nous est revenu, le client n'a rien — est
  **totalement invisible**.
- **Le workflow n8n n'est pas réimporté.** Tant qu'il ne l'est pas, un remboursement réussi
  envoie au client un **second e-mail d'annulation** (le nœud Code en ligne ne connaît pas la clé
  `rembourse` et retombe sur `cmd.statut`, qui vaut `annulee`) — et **repousse un message
  Telegram d'annulation au restaurant**, puisque l'ancien nœud émet vers Telegram sur
  `cle === 'annulee'`.
- **Rien n'alerte.** Voir `a_regarder` ci-dessus : il faut aller regarder.

### Recette de `rembourser-paiement` — 2026-09-06, sans rembourser un centime

Les appels **autorisés** ne sont pas passés en `curl` : le secret serait sorti du Vault pour
transiter par un terminal. Ils sont passés **depuis la base**, par `net.http_post`, qui lit le
secret sur place — c'est-à-dire par le chemin de production exact.

| # | Ce qu'on envoie | Réponse | Ce que ça prouve |
|---|---|---|---|
| A | `curl` sans aucun en-tête | `403 sans_autorisation` | La fonction est fermée par défaut |
| B | `curl` avec un mauvais `x-hook-secret` | `403 secret_invalide` | Le secret est réellement comparé |
| C | `curl` en `GET` | `405` | — |
| D | `curl` avec la **clé `anon` du projet** | `403 jeton_invalide` | Un JWT valide ne suffit pas : l'app cliente ne peut pas rembourser |
| E | `curl` avec un jeton bidon | `403 jeton_invalide` | — |
| F | autorisé, TF-96, `amount_minor: 99999` | `409 montant_incoherent`, `attendu: 341` | **Le montant vient de la base**, jamais du réseau. Refus **avant** tout appel à Stripe |
| G | autorisé, `currency: "usd"` | `409 devise_incoherente` | Idem sur la devise |
| H | autorisé, `refund_id` inconnu | `404 demande_introuvable` | — |
| I | autorisé, corps sans identifiant | `400 identifiant_manquant` | — |
| J | **bout en bout** : capture tardive sur TF-95 → trigger → `pg_net` → fonction | `200 sans_objet`, `statut_stripe: canceled` | Toute la chaîne, du trigger au verdict écrit en base |
| K | second appel sur la demande de J | `200 deja_traite` | Un rejeu ne repart pas chez Stripe |
| L | `declencher_remboursement()` sur la demande de J | `false`, aucun HTTP émis | La base ne remet pas en file une demande tranchée |

⚠️ **Aucune de ces preuves n'a déplacé d'argent.** Le test J s'appuie sur **TF-95**, la commande
de vérification du 6 septembre, dont le PaymentIntent `pi_3UCb3W…` est `canceled` chez Stripe
(vérifié par `GET` : `amount_received = 0`, `latest_charge = null`) : il est *impossible* d'en
rembourser un centime. TF-95 a été remise dans son état d'origine et la ligne de test supprimée.
TF-96 n'a jamais été appelée qu'avec des corps volontairement faux, et vérification faite chez
Stripe après coup, elle est toujours `succeeded` / non remboursée.

⚠️ **CE QUI N'EST PAS PROUVÉ : la branche `POST /v1/refunds` elle-même.** Le seul paiement
`succeeded` du compte est TF-96, celle du porteur du projet — l'exercer, c'est la rembourser
pour de bon. Ce qui est établi à sa place : la clé restreinte du Vault **a bien la permission
d'écrire des remboursements** (§ 1), et tout ce qui précède l'appel — autorisation, relecture en
base, refus d'incohérence, relecture chez Stripe, barrières anti-rejeu — a tourné en vrai. La
première vraie annulation de commande carte fera le reste ; **lire alors
`destination_details.card.type` du `Refund`** pour trancher enfin la question du *reversal*
(§ « Stripe ne rend pas les frais »).

### Le chemin manuel — il reste valable, et il reste le seul pour TF-96

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

### L'annonce au client — trigger `notifier_remboursement()`, 2026-09-06

Migration `20260906093054_remboursement_prevenir_le_client.sql`. Trigger sur
**`payment_refunds`**, `after insert or update of status`, qui n'envoie la charge utile au
webhook n8n (`evenement: 'rembourse'`) que lorsqu'un remboursement passe à **`effectue`**.

⚠️ **Pourquoi pas depuis `orders`.** Deux raisons, et la seconde est la vraie :
`notify_order_status()` est structurellement muette sur `paye` → `rembourse` (la commande est
déjà `annulee`, donc `new.status is not distinct from old.status`) ; et surtout, un
remboursement **partiel** ne fait jamais bouger `orders.payment_status`, que
`repercuter_remboursement_sur_paiement()` ne bascule qu'au montant plein. Un déclencheur posé
sur la commande resterait muet exactement là où le client comprend le moins son relevé.

**Ce qui ne déclenche RIEN, et pourquoi :** `demande` (rien n'est parti), `sans_objet` (rien
n'avait été capturé), et surtout **`echoue`** — le client n'a pas son argent, lui écrire
qu'il a été remboursé serait le pire mensonge de la chaîne. C'est une alerte interne, à
brancher sur `refund.failed`.

Le trigger est sous `exception when others then raise warning`, même règle que le trigger
d'annulation : **rendre l'argent ne doit jamais échouer parce qu'un e-mail n'est pas parti.**

Recette du 2026-09-06, **en transaction annulée** (`pg_net` met la requête dans une table :
le rollback l'emporte, aucun e-mail ne part) : verdict `effectue` sur TF-96 → **1** requête
mise en file, vers le webhook n8n, en-tête `x-taxifood-secret` présent,
`evenement: rembourse`, `341 eur / 16 000 Ar`, `partiel: false`, motif et numéro justes ·
`demande` → `demande` : **0** · `→ echoue` : **0** · `→ sans_objet` : **0** ·
`effectue` puis deux `UPDATE` de plus (dont l'attachement d'un `re_…`) : **1** seule requête.
Après rollback, TF-96 est intacte (`demande` / `capture` / `paye`, file `pg_net` vide).

L'e-mail lui-même est rendu par le nœud Code de `n8n/taxifood-notifications.json`, vérifié
sur la charge utile réelle de TF-96 : objet « Remboursement de 3,41 € — commande TF-96 ».
Il annonce le montant **en euros** (celui que la banque a débité), le délai de 5 à 10 jours
ouvrés, le cas du débit qui disparaît au lieu d'un crédit séparé, et la reconversion possible
par une banque hors zone euro. ⚠️ **Le workflow n'est pas déployé sur l'instance** — voir
`docs/N8N-NOTIFICATIONS.md`.

### Le bouton « Rembourser » de l'espace admin — 2026-09-06

Onglet **Remboursements** (`admin/components/Remboursements.tsx`), cinquième onglet du
tableau de bord. Il appelle `admin_demander_remboursement(p_order_id, p_motif,
p_montant_minor)`, qui journalise dans `admin_actions` et déclenche la fonction Edge.

⚠️ **La liste part des PAIEMENTS, pas des commandes.** `payment_method = 'cb'` ne prouve
rien : une commande peut porter « carte » sans qu'un centime ait été pris, et
`basculer_en_especes()` peut la repasser en espèces alors qu'un PaymentIntent vit encore.
L'écran ne liste donc que les `payment_intents` en `capture` / `rembourse` — même critère que
le trigger `remboursement_sur_annulation`. C'est aussi ce qui le rend visible : une commande
annulée sort de « Temps réel » (`.not('status','in','(livree,annulee)')`) et n'entre jamais
dans le rapport de clôture, borné aux `livree`.

Le montant par défaut est tout ce qui reste ; il se baisse pour un plat manquant. Le plafond
affiché est celui que `verifier_plafond_remboursement()` impose de toute façon, et
l'équivalent ariary annoncé recopie la règle de `demander_remboursement()` (sur un
remboursement **total**, on reprend `amount_ar` du paiement au lieu de le recalculer : le
chemin retour 341 × 4 700 / 100 = 16 027 ne retombe pas sur les 16 000 Ar d'origine).
⚠️ **`arRendu()` dans `admin/lib/remboursement.ts` a une version de retard sur ce point**
depuis la migration `20260906120000` : la base donne désormais l'ariary **restant** au
remboursement qui solde le paiement — le total comme le **dernier des partiels** — parce que
la somme de plusieurs partiels reconvertis chacun de son côté dépassait le total encaissé
(200 + 141 centimes = 9 400 + 6 627 = 16 027 Ar sur une commande de 16 000). L'écran annoncera
donc 6 627 Ar là où la base écrira 6 600, sur ce seul cas. Purement affichage, à aligner.
Motif obligatoire, et deux écrans avant l'envoi. Le bouton **n'apparaît pas** quand une
demande est déjà en vol (la base n'en autorise qu'une par paiement) ni quand tout est rendu :
un bouton présent puis refusé par la base apprend à se méfier de l'écran.

L'écran dit noir sur blanc que **Stripe ne rend pas ses frais** — c'est la seule information
que le gestionnaire ne peut deviner nulle part ailleurs au moment de cliquer.

« Temps réel » a reçu au passage le minimum qui manquait : une pastille **Payée** /
**Remboursée** sur la ligne, et un avertissement explicite avant d'annuler une commande déjà
débitée. Sans ça on continue d'annuler à l'aveugle — c'est ce qui est arrivé à TF-96.

### Le cas « paiement pas encore capturé » : on ANNULE, on ne rembourse pas

Un PaymentIntent en `requires_capture` / `requires_action` ne se rembourse pas : il faut
`POST /v1/payment_intents/{id}/cancel`, **et c'est gratuit**. Aujourd'hui `capture_method` vaut
`automatic_async` : le cas ne se présente que sur les intents restés en `en_attente` /
`requiert_action` (client parti en 3-D Secure) et sur le repli espèces (§ 11) — où la base
marque `annule` sans que Stripe en sache rien. **Optimisation de fond**, à garder pour plus
tard : autoriser à la commande et ne capturer qu'à l'acceptation par le restaurant supprimerait
la classe de bug entière (annulation gratuite au lieu de remboursement payant).

### Qui a le droit de déclencher un remboursement — revue adversariale du 2026-09-06

Vérifié **par requête sur l'API en production**, pas par lecture de code, avec les trois comptes
de démonstration de la fiche App Store (client, restaurant) et la clé `anon` du projet.

| Tentative | Réponse |
|---|---|
| `POST /functions/v1/rembourser-paiement`, aucun en-tête | `403 sans_autorisation` |
| avec la **clé `anon`** en `Authorization` (un JWT parfaitement valide) | `403 jeton_invalide` |
| avec le jeton d'un **client** connecté | `403 reserve_aux_admins` |
| avec le jeton d'un **restaurateur** connecté | `403 reserve_aux_admins` |
| avec un `x-hook-secret` inventé | `403 secret_invalide` |
| `GET` au lieu de `POST` | `405` |
| `rpc/admin_demander_remboursement` en client, puis en restaurateur | `Reserve aux administrateurs` |
| `rpc/relancer_remboursements_en_attente` en client, puis en restaurateur | `Reserve aux administrateurs` |
| `rpc/demander_remboursement`, `declencher_remboursement`, `enregistrer_verdict_remboursement`, `stripe_config`, `remboursement_hook_secret` en client | `permission denied for function` |
| `INSERT` direct dans `payment_refunds` en client | `permission denied for table` |
| lecture de `payment_refunds` en anonyme | `permission denied` |

La clé Stripe ne sort d'aucune de ces réponses : elle n'apparaît dans aucun corps, et les
journaux de la fonction n'en écrivent que la **longueur** et la position du premier caractère
illisible. Aucune clé (`sk_`, `rk_`, `whsec_`) n'existe dans le dépôt ni dans son historique git.

**Une faille a en revanche été trouvée et fermée, et elle ne passait pas par la fonction de
remboursement** : `orders.accept_token` — le jeton des liens Telegram « J'accepte / Je refuse » —
était **lisible par le client dans sa propre commande** (`GET /rest/v1/orders?select=accept_token`
répondait 200, et `create_order` rend de toute façon la ligne entière). Avec ce jeton, l'appel
anonyme `rpc/repondre_commande_par_jeton` acceptait le client comme s'il était le restaurant :
sur une commande encore en `recue` — c'est-à-dire déjà encaissée, la fenêtre exacte de TF-96 —
il pouvait la refuser avec un motif de son choix, ce qui déclenche `remboursement_sur_annulation`
et renvoie l'argent, le refus étant journalisé au nom du restaurant. Le même jeton permettait
aussi de **confirmer** la commande à sa place.

Corrigé par la migration `20260906101500_le_client_ne_refuse_plus_sa_propre_commande` : le jeton
vit désormais dans `public.order_accept_jetons`, table sans policy **et sans aucun droit** pour
`anon` et `authenticated` (contrôlé : `permission denied` pour les trois rôles). Masquer la
colonne n'aurait pas suffi, et les deux essais sont dans l'en-tête de la migration : un
`revoke select (colonne)` ne perce pas le `GRANT SELECT` de table, et les droits de colonne ne
s'appliquent pas à la ligne composite que `create_order` rend à l'appelant.


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

⚠️ **Cette liste datait du 5 septembre et n'est plus vraie.** Elle est conservée corrigée, parce
qu'elle dit ce qui restait à prouver et quand ça l'a été.

- ~~Le PaymentSheet natif n'a jamais tourné.~~ **Il a tourné le 2026-09-07**, sur un vrai iPhone
  via TestFlight (build 25) : TF-117, 213 centimes capturés pour 10 000 Ar. C'est la première
  exécution du module natif — il n'avait jamais été compilé avant ce build.
- ~~Aucun vrai PaymentIntent n'a été créé.~~ Il y en a désormais plusieurs, dont deux capturés
  pour de bon (TF-96 et TF-117).
- **Le remboursement n'a toujours jamais abouti de bout en bout.** TF-96 est resté au statut
  `demande`, `provider_refund_id` à NULL, pendant plus de 34 heures. C'est la moitié du circuit
  qui reste à prouver — voir § 8.

---

## 12. Apple Pay — monté le 2026-09-07

### Pourquoi il n'apparaissait pas

Au premier essai sur appareil, la feuille s'est ouverte **sans bouton Apple Pay et sans la moindre
erreur**. Ce n'était pas une panne : **aucune** des trois pièces nécessaires n'existait. Apple Pay
n'apparaît QUE si les trois sont réunies, et il n'y a aucun message quand il en manque une.

| Pièce | Où | Valeur |
|---|---|---|
| Identifiant marchand | portail Apple Developer | `merchant.com.chris97416.taxi-food-nosybe` |
| Entitlement dans le binaire | `app.json`, plugin `@stripe/stripe-react-native` | `merchantIdentifier` (**doit être identique**) |
| Certificat de traitement des paiements | Apple, puis déposé chez Stripe | expire le **2028-10-06** |

Côté code, deux lignes seulement, dans `components/paiement/FormulaireCarte.tsx` :
`initStripe({ merchantIdentifier })` et `applePay: { merchantCountryCode: 'FR' }`.

⚠️ **`merchantCountryCode` est le pays du COMPTE STRIPE, pas celui du client.** Le compte Rentanoo
est immatriculé en France (`country: "FR"`, lu via l'API le 2026-09-07). Un code qui ne correspond
pas au compte fait échouer le paiement au moment de la confirmation, pas à l'initialisation —
donc tard, et sur un vrai client.

### ⚠️ Le piège qui a coûté deux builds : le profil de provisioning

Poser le `merchantIdentifier` dans `app.json` **ne suffit pas**. L'App ID chez Apple doit lui aussi
porter la capacité, sinon Xcode refuse de signer :

```
Provisioning profile "…" doesn't include the Apple Pay capability.
Provisioning profile "…" doesn't support the merchant.… Merchant ID.
Provisioning profile "…" doesn't include the com.apple.developer.in-app-payments entitlement.
```

Il faut donc, dans le portail Apple : App ID → **Apple Pay Payment Processing** → *Configure* →
cocher l'identifiant marchand → *Save*. Apple prévient alors que les profils existants sont
invalidés : c'est voulu, il faut qu'ils le soient.

⚠️ **Et surtout : `eas build --non-interactive` ne régénère PAS le profil.** Le log le dit en une
ligne facile à rater :

```
Skipping Provisioning Profile validation on Apple Servers because we aren't authenticated.
```

EAS réutilise alors le profil en cache, périmé, et le build échoue exactement de la même façon —
deux fois de suite (builds 26 et 27). **Après toute modification de capacité Apple, le build doit
tourner en mode interactif**, pour qu'EAS s'authentifie auprès d'Apple et refabrique le profil.
C'est ce qui a produit le build 28.

### Vérifier que c'est bien en place

Le certificat est visible dans Stripe : *Paramètres → Moyens de paiement → Apple Pay →
Certificats iOS*. Une ligne verte au nom de l'identifiant marchand, avec sa date d'expiration.

⚠️ **Le certificat expire le 2028-10-06.** Passé cette date, Apple Pay cesse de fonctionner
silencieusement — le bouton disparaît, sans erreur, comme au premier jour. Il faudra refaire un
CSR chez Stripe et un certificat chez Apple, en suivant cette section.

### Ce qui n'est pas encore prouvé

**Aucun paiement Apple Pay n'a encore abouti.** Le montage est complet et le build 28 est signé
avec l'entitlement — mais tant qu'un vrai débit n'est pas passé par la feuille Apple Pay sur un
appareil, la chaîne reste théorique.

---

## 13. Google Pay — 2026-09-08

### Le code ne coûte que deux lignes

Contrairement à Apple Pay (§ 12), **ni identifiant marchand ni certificat** côté code :
`enableGooglePay: true` dans le plugin Stripe d'`app.json` (qui ouvre l'API Wallet dans le
manifeste Android) et le bloc `googlePay` dans `initPaymentSheet`. C'est tout.

Vérifié dans l'AAB du build 5, avant de chercher ailleurs :

```
strings base/manifest/AndroidManifest.xml | grep wallet.api.enabled   → présent
strings base/dex/*.dex | grep -c GooglePayLauncher                    → 339
```

⚠️ **Réflexe à garder** : quand un moyen de paiement n'apparaît pas, ouvrir l'AAB AVANT de
soupçonner l'appareil. Trente secondes, et ça élimine la moitié des hypothèses.

### ⚠️ Piège n°1 — le bouton était masqué par un réglage Stripe

Le bouton n'apparaissait pas du tout. Cause : dans la configuration des moyens de paiement
(`pmc_1SNuTH53bhPYA4IFkmBsgTjt`), **`google_pay` était `off`** alors qu'`apple_pay` était
`on`. Le SDK interroge Stripe, Stripe répond « pas Google Pay », et le bouton n'est pas
dessiné — **sans erreur, sans log**.

```
apple_pay  : available true  · on      ← Apple Pay marchait
google_pay : available false · off     ← d'où le bouton absent
```

Corrigé dans le tableau de bord (*Paramètres → Paiements → Moyens de paiement → Default*).
⚠️ Le `available: false` était une **conséquence** de la désactivation, pas un défaut
d'éligibilité : il est repassé à `true` en même temps. Ne pas s'en alarmer.

⚠️ **L'API du connecteur MCP est en lecture seule sur ce réglage** — la bascule se fait
forcément dans le tableau de bord.

### ⚠️ Piège n°2 — `OR_BIBED_11` : Google veut approuver l'app

Une fois le bouton affiché, Google Pay s'ouvre et échoue sur :

> Ce marchand ne parvient pas à accepter votre paiement pour le moment. **[OR_BIBED_11]**

Ce n'est pas une erreur Stripe : elle est levée par Google avant que Stripe soit sollicité.
Elle signifie **« le marchand n'a pas terminé son inscription à l'API Google Pay »**. Pour une
app Android, Google exige une **approbation d'accès production**, avec examen humain — captures
du parcours de paiement à l'appui.

C'est l'équivalent Google du montage Apple Pay, en plus lourd : Apple délivre un certificat en
deux minutes, Google fait une revue.

### Dossier d'accès production — soumis le 2026-09-08

| | |
|---|---|
| Entreprise Google Pay | **Taxi Food**, `BCR2DN6DVL7LTMZZ` |
| Pays du compte | **Réunion (RE)** ⚠️ définitif |
| Identité légale | **RENTANOO**, profil de paiement `7669-2844-6310` — déjà vérifié par Google (30/08) |
| Profil d'entreprise | ✅ Approved (MCC 5812, site, support) |
| Type d'intégration | **Gateway** (Stripe est un PSP reconnu) |
| Application | `com.chris97416.taxifoodnosybe`, détectée automatiquement |
| Statut | ⏳ **en cours d'examen**, verrouillé jusqu'au verdict |

⚠️ **PIÈGE DU PAYS, ET IL A COÛTÉ UNE ENTREPRISE POUR RIEN.** Google traite **« Réunion »
comme un pays distinct de « France »**. Une première entreprise avait été créée en France
(`BCR2DN6DVL7OHPRE`) sur le raisonnement « le compte Stripe est FR » — sauf que le profil de
paiement RENTANOO, lui, est enregistré sous Réunion, et devenait donc inutilisable. Le pays
ne se change pas après coup.

**Le verrou porte sur l'ENTREPRISE, pas sur le compte** : la console en accepte plusieurs. La
sortie a donc été de créer une seconde entreprise en Réunion. La première subsiste, inutilisée,
et ne gêne rien.

⚠️ **La bonne question à se poser était celle du porteur du projet** : *« si Google demande
les documents de Taxi Food, ça n'existe pas — tout est rattaché à Rentanoo »*. Choisir le pays
du profil de paiement qu'on veut utiliser, PAS celui du compte Stripe. Rentanoo étant déjà
vérifiée chez Google, il n'y a eu aucun justificatif à produire.

### Les cinq captures exigées

Google réclame le parcours d'achat complet, **du même achat** : sélection d'un article,
récapitulatif avant paiement, écran de choix du moyen de paiement **avec le bouton Google Pay
visible**, la feuille Google Pay, et la confirmation de commande. 1 Mo maximum par fichier.

⚠️ **Android interdit la capture de la feuille Google Pay** — il faut la photographier avec un
autre appareil. Et Google précise qu'**une photo du message d'erreur convient** : la photo de
`OR_BIBED_11` a donc servi de quatrième capture.

⚠️ **La console refuse les dépôts de fichiers injectés** (les champs se remplissent, la page
ne réagit pas, même en émettant `change`). Comme pour l'`.aab` du Play Store, la sélection doit
être faite à la main.

### État au 2026-09-08

| | |
|---|---|
| Google Pay & Wallet Console | compte créé — **Taxi Food**, `BCR2DN6DVL7OHPRE` |
| Pays du compte | **France** ⚠️ **définitif**, Google l'annonce (« Country can't be changed later ») |
| Profil d'entreprise | ✅ enregistré (MCC **5812**, site, support e-mail et téléphone) |
| Profil de paiement Google | ❌ à faire — identité légale et fiscale |
| Accès production | ❌ à demander ensuite |

**Pourquoi la France et pas Madagascar**, alors que Google pré-remplissait Madagascar : le
compte Stripe est immatriculé en France, et le code déclare déjà `merchantCountryCode: 'FR'`.
Déclarer Madagascar chez Google aurait mis les deux bouts de la chaîne en désaccord, sur un
choix irréversible.

⚠️ **Ne pas promouvoir la 1.2.0 en production Android tant que Google n'a pas approuvé** : le
client verrait un bouton Google Pay qui échoue à tous les coups — pire que pas de bouton. Le
paiement par carte, lui, fonctionne déjà.
