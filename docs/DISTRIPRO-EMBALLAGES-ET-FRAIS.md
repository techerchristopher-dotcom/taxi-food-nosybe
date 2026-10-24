# DistriPro × Taxi Food — emballages, frites et légumes pour les restaurants

> Diagnostic, cahier des charges et plan d'implémentation. Rédigé le 2026-10-23.
> **Rien n'est implémenté.** Ce document attend les décisions du § 6 avant le premier lot.

---

## 0. La demande, reformulée

1. **Compléter l'offre Taxi Food** par une gamme d'**emballages adaptés** (barquettes, bols,
   cartons pizza, boîtes à frites, sacs, couverts…) achetés en gros chez **Bazary Be**, parce que
   trop de restaurants livrent dans de mauvais contenants.
2. Les vendre **via DistriPro**, avec **seulement** : tomates, pommes de terre, oignons, ail,
   **frites en 3 calibres** (Frity) et les **emballages**. Les autres catégories DistriPro sont
   **masquées, pas supprimées**.
3. **Deux portes, un seul système** :
   - **client externe** → le site **distripro207.com**, responsive, pensé comme une web app ;
   - **restaurant partenaire Taxi Food** → un **onglet « Commander » dans l'app Taxi Food**,
     **natif** : pas de WebView, pas de redirection vers un site. Le partenaire sait qu'il est
     passé dans l'univers DistriPro, mais il ne quitte pas l'app.
4. **Une mise à jour faite une fois se voit partout** : app et site web.

---

## 1. Ce que j'ai vérifié (diagnostic)

### 1.1 Dossier `~/Desktop/bazarybe` — ✅ accès confirmé

Deux fichiers, **même contenu** : `Catalogue prix gros.png` (affiche) et
`BazaryBe_Catalogue_Produits_2026.pdf` (2 pages). Fournisseur : **BazaryBe Store**, 67 Ha Sud
face CENAM, arrêt Fokotany — **Antananarivo** —, tél. 034 38 177 45, « livraison Tana & province ».

#### Catalogue et prix unitaires calculés

| Famille | Produit | Lot | Prix du lot | **Prix unitaire** |
|---|---|---|---|---|
| Bols | Bol kraft 450 ml | ×20 | 23 000 | **1 150** |
| | Bol kraft 750 ml | ×20 | 25 000 | **1 250** |
| | Bol kraft 1 L | ×20 | 27 000 | **1 350** |
| | Bol kraft 1,5 L | ×20 | 30 000 | **1 500** |
| | Bol kraft 1,8 L | ×20 | 37 000 | **1 850** |
| Barquettes | Rectangulaire transparente 500 ml | min. 50 | — | **800** |
| | Rectangulaire 750 ml | min. 50 | — | **800** |
| | Rectangulaire 1 L | min. 50 | — | **750** ⚠️ |
| | Rectangulaire 1,5 L | min. 50 | — | **1 500** |
| | Ronde 250 ml | à l'unité | — | **400** |
| | Ronde 300 ml | à l'unité | — | **700** ⚠️ |
| | Ronde 500 ml | à l'unité | — | **500** |
| | Ronde 1 L | à l'unité | — | **900** |
| | Ronde 2 L | à l'unité | — | **1 800** |
| Boîtes | Boîte à frites kraft | ×50 | 17 000 | **340** |
| | Boîte à frites rayée 11 cm | ×50 | 17 000 | **340** |
| | Boîte à frites rayée 13 cm | ×50 | 17 000 | **340** |
| | Carton pizza 26 cm | ×100 | 140 000 | **1 400** |
| | Carton pizza 29 cm | ×100 | 160 000 | **1 600** |
| | Carton pizza 33 cm | ×100 | 180 000 | **1 800** |
| Sacs | Sac sandwich papier 31×11 | ×100 | 18 000 | **180** |
| | Sac écru N1 11×17 | ×100 | 12 000 | **120** |
| | N2 12×21 | ×100 | 13 000 | **130** |
| | N3 14×24 | ×100 | 15 000 | **150** |
| | N4 13,5×25 | ×100 | 16 000 | **160** |
| | N5 blanc 18×25 **ou** 18×29 ⚠️ | ×100 | 21 000 | **210** |
| | N6 17×35 | ×100 | 23 000 | **230** |
| | N7 24×40 | ×100 | 25 000 | **250** |
| Couverts | Baguettes chinoises (emballage individuel) | ×100 | 27 000 | **270** |
| | Couvert plastique blanc | ×50 | 5 000 | **100** ⚠️ |
| | Couvert plastique noir | ×50 | 12 000 | **240** ⚠️ |
| | Couvert bois | ×100 | 16 000 | **160** |
| | Cuillère à glace « Malagasy » multicolore | ×50 | 2 000 | **40** |
| | Cuillère à glace importée | ×500 | 35 000 | **70** |

**Anomalies à faire confirmer par Bazary Be avant de publier un seul prix :**

1. **Sac écru N5** : 18×25 cm sur l'affiche, 18×29 cm dans le PDF.
2. **Barquette ronde 300 ml à 700 Ar, plus chère que la 500 ml à 500 Ar** — inversion probable.
3. **Barquette rectangulaire 1 L à 750 Ar, moins chère que la 750 ml à 800 Ar.**
4. **Couverts « ×50 »** : 50 couverts **de chaque sorte** (150 pièces) ou 50 pièces en tout ?
   Le prix unitaire varie du simple au triple.
5. **Barquettes : couvercle inclus ?** L'affiche les montre fermées, le texte ne dit rien.
6. **Bols kraft : couvercle inclus ?** Même question (le visuel montre un couvercle plastique).
7. **Quantité minimale** des barquettes rondes (aucune n'est indiquée).

**Ce que le catalogue ne dit pas, et qui décide de la rentabilité :**

- 🚚 **Le fournisseur est à Tana, pas à Nosy Be.** « Prix de gros » = prix départ Tana.
  Le **transport** (vol cargo, ou route + bac via Ankify : coût, délai, casse) n'est chiffré
  nulle part. Sur des cartons pizza (encombrants, légers), le fret peut peser plus que la marge.
- 📦 **Aucun stock local.** DistriPro fonctionne aujourd'hui **sans stock** (on commande au
  fournisseur le matin, on livre le lendemain). C'est impossible avec un fournisseur à
  plusieurs jours de bateau : **il faut un stock à Nosy Be.**
- 🖼️ **Les visuels du catalogue appartiennent à Bazary Be** (logo, mise en page). Les packshots
  du site seront à refaire (chaîne Higgsfield + `packshot.py` existante).

#### Croisement avec ce que les restaurants Taxi Food facturent déjà

Relevé en base Taxi Food le 2026-10-23 :

| Restaurant | Emballage facturé au client | Ce que coûterait le bon contenant Bazary Be (hors transport) |
|---|---|---|
| **Les Siciliens** | « Boîte à pizza » **3 000 Ar** (part qui revient à Taxi Food) | carton 33 cm **1 800** → marge réelle si Taxi Food fournit les cartons |
| Chez Bidule & Truc (masqué) | « Boîte à pizza » 2 000 | carton 29–33 cm 1 600–1 800 |
| **La Cabane** | « Emballage à emporter » **1 000** sur 148 plats | bol kraft 750 ml **1 250** ⚠️ > 1 000 · barquette 800 · boîte à frites 340 |
| **L'escale Créole** | 1 000 / 2 000 | bol kraft 1 L 1 350 · barquette ronde 1 L 900 |
| **La Plage**, **Chez M&K** | **rien** | M&K (chinois) : bol kraft + baguettes = cas d'école |

⚠️ **Constat utile** : sur certains plats, le forfait de 1 000 Ar **ne couvre pas** un contenant
correct. Le « mauvais emballage » est peut-être aussi une question de prix — le futur onglet
doit afficher, par plat, ce que coûte le bon contenant.

📉 **Volume Taxi Food sur 30 jours : ~84 commandes livrées**, tous restaurants. C'est trop peu
pour justifier un stock à lui seul : le vrai volume, c'est **toute la vente à emporter** de ces
restaurants (comptoir, téléphone, autres plateformes). Le plan vise donc les restaurants, pas
seulement les commandes Taxi Food — et les **clients externes** du site.

### 1.2 DistriPro — le site existe, c'est le dépôt `pem-drive`

| | |
|---|---|
| Dépôt | `github.com/techerchristopher-dotcom/pem-drive` (privé), copie locale `~/Desktop/1-DEV CLAUDE /PEM/pem-drive`, à jour avec `origin/main` |
| Stack | React + Vite + TypeScript + Tailwind (storefront) + **8 portails HTML statiques** (admin commandes, clients, fournisseurs, cockpit, veille, comparateur, express, assistant) |
| Base | Supabase **`tlnpkvveeqzefghhywfe`** — **projet distinct** de Taxi Food (`bmdveawomizjpiebgtkj`), autre organisation |
| Hébergement | Netlify `distripro207` → **distripro207.netlify.app**, auto-déployé par `git push` |
| Auth client | **maison** : mot de passe généré par l'exploitant (`nom207`), vérifié par RPC. Pas de `supabase.auth`. Mot de passe conservé en `localStorage` (posture démo assumée) |
| Ce qui marche | catalogue, tarif dégressif (`seuil_gros`), panier, `creer_commande` (prix recalculés serveur), date de livraison (coupure midi → J+1 / J+2), paiement à la livraison (5 moyens), bon de commande, préparation, ruptures + bascule fournisseur, **bon de livraison**, **facture** (numérotation sans trou, snapshot), e-mails n8n avec PDF, multi-fournisseurs avec prix d'achat et marge |
| Entité qui facture | **RENTANOO SARL** (NIF 4019655514). ⚠️ **Objet social = location de véhicules**, pas le commerce alimentaire — réserve déjà signalée deux fois dans le CLAUDE.md DistriPro, toujours ouverte |

**État de la base DistriPro (lu le 2026-10-23) :** 823 produits « stars », **120 vendables**,
11 fournisseurs, 2 clients, **1 seule commande** (21/07). Le site n'a jamais servi en vrai.

**Les 4 légumes demandés existent déjà et sont vendables :**

| Produit | id | Prix de vente | Offres fournisseurs (prix d'achat) |
|---|---|---|---|
| Tomate | 1147 | 7 000 | Vanessa 6 500 · Aliette 6 500 · Bibiane 7 000 · Prisca 6 000 |
| Pomme de terre | 1146 | 5 200 | Vanessa 5 000 · Aliette 5 000 · Bibiane 5 500 · Prisca 5 000 |
| Oignon | 1149 | 5 000 | Vanessa 4 500 · Aliette 5 000 · Bibiane 6 000 · Prisca 5 000 |
| Ail | 2964 | 12 796 | Aliette 12 000 · Bibiane 14 000 · Prisca 12 000 |

⚠️ **Aucune unité en base** : la table `produits` n'a ni `unite` ni `conditionnement`. « 7 000 »
veut dire « au kilo » dans la tête de l'exploitant, nulle part dans les données. Inacceptable
pour des emballages vendus par paquet de 20, 50 ou 100.

⚠️ **Aucune frite, aucun emballage Bazary Be.** Seules traînent 4 barquettes alu / boîtes à
glace non vendables (rayon Maison).

⚠️ **Piège de masquage déjà en place** : une sous-catégorie n'est **cliquable qu'à partir de
5 produits vendables** (`v_catalogue_dispo`). Avec 4 légumes, « Légumes frais » serait
**grisée**. Le recentrage du catalogue doit revoir cette règle, pas seulement cacher des rayons.

⚠️ Les 120 vendables actuels couvrent Fruits (17), Légumes (28), Viandes (14), Poissonnerie (5),
Crèmerie, Boissons, Épicerie, Entretien… : **tout cela passe en masqué.**

### 1.3 Frity — les frites

Dossier `~/Desktop/1-DEV CLAUDE /fritty`. Frites **fraîches, crues, congelées**, coupées par
toi, sachet transparent de **2,5 kg**, 8 000 Ar/kg en lancement (visé 9 000–10 000). Capacité
**< 100 kg/semaine** (3 à 5 clients sérieux). Gamme : Monsieur Frity = **allumette**, Madame
Frity = **rondelles** (potatoes).

⚠️ **Les « 3 calibres » ne sont définis nulle part.** À trancher (§ 6, D3).

⚠️ **Conflit de domaine** : `distripro207.com` sert **aujourd'hui la landing Frity**
(site Netlify `frity-nosybe`, titre « FRITY — Vos frites sont déjà coupées | Distripro Nosy Be »),
alors que le storefront DistriPro est sur `distripro207.netlify.app`. Le Frity CLAUDE.md
prévoyait d'ailleurs que Frity vive en **`/frity` dans le site DistriPro**. Les sous-domaines
`taxifood.`, `taxifoodnosybe.` et `admin.distripro207.com` (Taxi Food) ne sont **pas** concernés.

### 1.4 Taxi Food — ce qui existe déjà et qu'on réutilise

- **Qui est partenaire ?** Déjà tranché en base : rôle `restaurant` **actif** + lien
  `restaurant_staff` (`is_active_restaurant_staff_of`, `current_restaurant_id()`, sélecteur
  multi-restaurants). Un client simple ne verra jamais l'onglet.
- **Espace restaurateur** `app/app/(restaurant)/` : 4 onglets (Commandes, En livraison,
  Historique, Réglages) + `versements` caché. Un 5ᵉ onglet « Commander » tient à 375 px.
- **Le précédent `APP_VARIANT`** : l'app livreur est une variante du même code Expo. Le même
  mécanisme permet de produire **le site distripro207.com à partir du même code** que l'onglet
  de l'app (voir § 3.2).
- **Reversements** : Taxi Food doit déjà de l'argent à chaque restaurant
  (`admin_commandes_a_reverser`). Déduire une facture DistriPro d'un reversement serait le
  paiement le plus simple qui soit — **si** la comptabilité le permet (§ 6, D6).

---

## 2. Cahier des charges

### 2.1 Périmètre du catalogue DistriPro

| Rayon (nouveau) | Produits | Unité de vente | Fournisseur |
|---|---|---|---|
| 🥔 **Légumes** | Tomate, Pomme de terre, Oignon, Ail | **kg** (pas de 1 kg, ou 0,5 kg — à décider) | Vanessa, Aliette, Bibiane, Prisca (existants) |
| 🍟 **Frites Frity** | 3 calibres | **sachet de 2,5 kg** | Frity (nouveau fournisseur = production propre) |
| 📦 **Emballages** | les 35 références Bazary Be, en sous-rayons : Bols · Barquettes · Cartons pizza · Boîtes à frites · Sacs · Couverts & baguettes | **paquet** (20, 50, 100, 500) ou **unité avec minimum** (barquettes ×50) | Bazary Be (nouveau fournisseur) |

**Exigences :**

- E1. Tout le reste du catalogue est **masqué, jamais supprimé ni désactivé** (`actif` intact :
  le cockpit, la veille et l'invariant de CA de DistriPro en dépendent).
- E2. Le masquage est **piloté par une donnée** (un drapeau en base), réversible en un `UPDATE`,
  pas par une liste en dur dans le code.
- E3. Chaque produit porte son **unité**, son **conditionnement** (« paquet de 50 »), sa
  **quantité minimale** et son **pas** (on commande 50, 100, 150 barquettes — pas 37).
- E4. Le prix affiché = **prix du lot** + **prix à l'unité** en petit (« 17 000 Ar le paquet de
  50 · 340 Ar pièce ») : c'est ce qui permet au restaurateur de comparer à son forfait emballage.
- E5. Le dégressif existant (`seuil_gros`) reste disponible (ex. 4 paquets et plus).
- E6. **Stock** pour les emballages : quantité disponible à Nosy Be, décrémentée à la commande,
  refus serveur au-delà ; affichage « En stock » / « Plus que N » / « Réassort en cours ».
  Les légumes et les frites restent **sans stock** (logique actuelle : commande le matin,
  livraison J+1).
- E7. Photos : packshots maison, fond clair, une par référence (pas les visuels Bazary Be).

### 2.2 Les deux portes

**Porte A — l'app Taxi Food, onglet « Commander » (partenaires)**

- A1. Visible **uniquement** pour un compte restaurant actif rattaché à un restaurant
  (même garde que le reste de l'espace partenaire). Jamais pour un client, jamais pour un livreur.
- A2. **100 % natif** (React Native) : catalogue, fiche produit, panier, validation, mes
  commandes, détail, bon de livraison / facture. **Aucune WebView, aucun `Linking.openURL`
  vers le site.**
- A3. **Bascule d'univers visible** : en-tête aux couleurs DistriPro, logo DistriPro, mention
  « Commande fournisseur — livrée par DistriPro ». Le partenaire ne doit jamais confondre ce
  panier avec une commande client.
- A4. **Aucune nouvelle connexion** : le partenaire est reconnu par sa session Taxi Food. Son
  compte client DistriPro est créé/relié automatiquement au premier accès (nom du restaurant,
  téléphone, position GPS déjà connus de Taxi Food).
- A5. **Panier séparé** du panier client Taxi Food (stores distincts, clés AsyncStorage
  distinctes) — un restaurateur qui est aussi client ne doit jamais mélanger les deux.
- A6. Multi-restaurants : la commande DistriPro est passée **pour le restaurant actif** du
  sélecteur ; le nom du restaurant est rappelé sur l'écran de validation.
- A7. Textes en français (l'espace restaurateur l'est) ; les textes passent par une table de
  textes du module pour pouvoir servir l'italien des Siciliens plus tard.
- A8. Livrable **en OTA** si aucun module natif n'est ajouté (objectif : n'en ajouter aucun).

**Porte B — distripro207.com (tous les clients, partenaires ou non)**

- B1. Responsive, mobile d'abord, **installable (PWA)**, pensé comme une web app.
- B2. Mêmes écrans, mêmes données, mêmes règles que l'onglet de l'app (§ 3.2 : même code).
- B3. Connexion par le compte DistriPro existant (mot de passe remis par l'exploitant) ; un
  partenaire Taxi Food peut aussi s'y connecter avec son compte Taxi Food (option, lot 4).
- B4. Catalogue et prix **lisibles sans compte** (règle déjà en vigueur sur DistriPro ; c'est
  aussi la règle Apple pour l'app) ; le compte n'est demandé qu'au moment de commander.
- B5. La landing **Frity** reste accessible (`/frity`), le bouton « Commander » mène au rayon
  Frites Frity.
- B6. Les portails d'exploitation (`/admin-commandes`, `/admin-fournisseurs`, `/cockpit`…) ne
  bougent pas.

### 2.3 Règles métier communes (dans la base DistriPro, nulle part ailleurs)

- R1. **La base DistriPro fait foi** : catalogue, prix, stock, commandes, documents. L'app et
  le site **n'ont aucun prix en dur et ne calculent aucun total** — ils affichent ce que la
  base renvoie (même règle que `create_order` côté Taxi Food).
- R2. Livraison : règle DistriPro existante (coupure **12 h** → J+1, sinon J+2, 7 j/7, 14 jours
  d'horizon), **à vérifier pour les emballages** (sortie de stock, donc possiblement J+0/J+1).
- R3. Paiement à la livraison (5 moyens existants) ; option « déduit de mon prochain
  reversement Taxi Food » pour les partenaires, **si D6 est validée**.
- R4. Bon de livraison et facture : chaîne DistriPro existante, sans changement ; le partenaire
  les consulte dans l'app.
- R5. Notifications : e-mail n8n existant + **Telegram admin** (« 📦 Commande DistriPro — La
  Cabane — 3 articles — 52 000 Ar ») + **push** au partenaire à chaque changement de statut
  (en livraison, livrée).
- R6. Sécurité : la clé publique d'aucun des deux projets ne permet de lire une commande, un
  client, un prix d'achat ou une marge (règles DistriPro §9terdecies et Taxi Food RLS).

### 2.4 Hors périmètre (volontairement)

- Paiement en ligne (carte / Orange Money WebPay) sur DistriPro.
- Fusion des deux bases.
- Les autres catégories DistriPro (elles restent masquées, réactivables plus tard).
- Une app DistriPro séparée dans les magasins.

---

## 3. Architecture proposée

### 3.1 Le pont entre les deux bases — **recommandé : une fonction Edge « pont »**

Les deux projets Supabase sont séparés et n'ont **pas le même système d'identité**
(Taxi Food : `supabase.auth` + JWT ; DistriPro : mot de passe maison). Trois options :

| | Option | Verdict |
|---|---|---|
| A | L'app appelle directement la base DistriPro avec un mot de passe client stocké sur le téléphone | ❌ deuxième identité à gérer, mot de passe en clair sur le téléphone, rien ne prouve que c'est bien un partenaire actif |
| **B** | **Fonction Edge `distripro` côté Taxi Food** : elle vérifie le JWT Taxi Food + le statut partenaire actif, retrouve le client DistriPro relié au restaurant, puis appelle des RPC DistriPro dédiées protégées par un **secret partagé** (Vault des deux côtés) | ✅ **recommandé** — l'identité reste celle de Taxi Food, DistriPro reste la seule source de vérité, aucun secret dans l'app |
| C | Migrer DistriPro dans la base Taxi Food | ❌ des semaines de travail, risque sur une chaîne commandes/BL/factures qui marche |

```
App Taxi Food (onglet Commander, natif)
   │  JWT Taxi Food
   ▼
Edge Function « distripro » (projet Taxi Food)
   │  1. vérifie le JWT
   │  2. is_active_restaurant_staff_of(restaurant actif)
   │  3. lit la liaison restaurant → client DistriPro (table privée)
   │  4. appelle DistriPro avec x-pont-secret
   ▼
RPC « pont_* » (projet DistriPro, SECURITY DEFINER, exécutables par personne d'autre)
   │  enveloppes qui délèguent aux fonctions existantes (méthode §9terdecies de DistriPro)
   ▼
catalogue · creer_commande · mes_commandes · mon_document (inchangés)
```

Le catalogue, lui, est **public** : l'app peut le lire directement avec la clé publique
DistriPro (comme le site), sans passer par le pont. Seuls commander, lister ses commandes et
lire ses documents passent par le pont.

### 3.2 « Une mise à jour = app + site » — **recommandé : un seul code d'écrans**

Exiger que le site reflète l'app, c'est poser la question : **combien de codes d'écrans ?**

| | Option | Conséquence |
|---|---|---|
| 1 | Garder le storefront Vite actuel et construire en plus les écrans natifs dans l'app | **deux codes** à faire évoluer à la main ; la parité dépend de la discipline — c'est exactement le piège déjà payé sur Taxi Food (la vitrine et l'app qui ne disent plus la même chose) |
| **2** | **Écrire le module DistriPro une seule fois dans le code Expo** (`app/distripro/`), le monter dans l'onglet partenaire **et** l'exporter en web sous une variante `APP_VARIANT=distripro` servie sur **distripro207.com** | ✅ **recommandé** — un seul code, une seule OTA + un seul déploiement web par changement ; la parité est **structurelle**, pas une promesse |

Avec l'option 2, le travail d'écrans est de toute façon nécessaire pour l'app (exigence
« natif ») : le site web en sort **sans travail supplémentaire d'écrans**. Le storefront Vite
est retiré du domaine (gardé dans le dépôt), les **portails d'exploitation restent tels quels**
sur `distripro207.netlify.app` (ou `gestion.distripro207.com`).

Le module parle à DistriPro au travers d'un **adaptateur d'identité** :
- dans l'app Taxi Food → adaptateur « pont » (session Taxi Food, § 3.1) ;
- sur distripro207.com → adaptateur « compte DistriPro » (mot de passe existant) ou « pont »
  si le visiteur se connecte avec son compte Taxi Food.

⚠️ La variante web doit être construite **sans** le reste de l'app Taxi Food (aucun écran client
Taxi Food, aucune clé Stripe) : même discipline que la variante livreur.

### 3.3 Base DistriPro — modifications

| Objet | Changement |
|---|---|
| `produits` | `+ unite` (kg, sachet, paquet, pièce), `+ conditionnement` (« Paquet de 50 »), `+ qte_par_lot`, `+ qte_min`, `+ pas`, `+ stock` (nullable = pas de gestion de stock), `+ publie boolean default false` |
| `rayons` / `sous_categories` | nouveaux : Légumes, Frites Frity, Emballages (+ 6 sous-rayons) — ou réemploi de « Légumes frais » |
| `v_produits_vendables`, `v_catalogue_dispo` | ajout de `publie` ; **règle des 5 vendables** remplacée par « ≥ 1 vendable » pour les rayons publiés (sinon les 4 légumes sont grisés) |
| `creer_commande` | refuse un produit non `publie`, applique `qte_min` / `pas`, décrémente et contrôle `stock` **dans la même transaction**, sous verrou |
| `fournisseurs` | + **Bazary Be**, + **Frity** |
| `offres` | prix d'achat Bazary Be **rendus Nosy Be** (prix + quote-part transport), prix Frity |
| `clients` | `+ origine` (`site` / `taxifood`), `+ taxifood_restaurant_id` |
| nouvelles RPC | `pont_catalogue?`, `pont_relier_client`, `pont_creer_commande`, `pont_mes_commandes`, `pont_document` — `REVOKE ALL … FROM PUBLIC, anon, authenticated` puis contrôle `has_function_privilege` |
| `admin_config` | `+ secret_pont_taxifood` |

### 3.4 Base Taxi Food — modifications

| Objet | Changement |
|---|---|
| `distripro_liaisons` (restaurant_id PK, distripro_client_id, relie_le, relie_par) | RLS sans policy, aucun droit — lue par la fonction Edge seule |
| Vault | `distripro_pont_secret`, `distripro_url` |
| Fonction Edge `distripro` | actions `relier`, `commander`, `mes_commandes`, `document` ; `verify_jwt = true` |
| ~~(lot 6) reversements~~ | abandonné : paiement à la livraison (D6) |

---

## 4. Plan d'implémentation par lots

Chaque lot se termine par une vérification réelle (PostgREST avec la clé publique, transaction
annulée, écran à 375 px) et n'enchaîne sur le suivant qu'après ton feu vert.

### Lot 0 — Décisions et préalables (toi, sans code)
- Répondre aux décisions D1 à D9 (§ 6).
- Demander à Bazary Be : les 7 anomalies du § 1.1, **devis de transport Tana → Nosy Be**,
  délai, conditionnement des cartons, possibilité de dépôt-vente.
- Arrêter le **stock initial** à commander (je propose une liste à partir des cartes des
  restaurants et de leurs volumes : lot 5 en avance, en tableur).
- Fixer les **prix de vente** (je fournis un tableur : prix Bazary Be + transport/unité +
  marge cible → prix au lot et à l'unité, comparé au forfait emballage de chaque restaurant).

### Lot 1 — Catalogue DistriPro recentré (base seule, aucun écran)
1. Migration : colonnes `unite`, `conditionnement`, `qte_par_lot`, `qte_min`, `pas`, `stock`,
   `publie` ; rayons et sous-rayons ; fournisseurs Bazary Be et Frity.
2. Création des 35 références Bazary Be + 3 frites ; `publie = true` sur ces 38 + les 4 légumes.
3. Vues `v_produits_vendables` / `v_catalogue_dispo` : filtre `publie`, règle des 5 vendables
   revue.
4. `creer_commande` : `publie`, minimum, pas, stock (verrou, refus explicite).
5. Contrôles : invariant CA DistriPro inchangé (`1 217 876 842,80 Ar`), catalogue public = 42
   produits, commande test en transaction annulée (stock décrémenté puis rollback), refus
   d'un produit masqué, refus sous le minimum.
6. Le storefront Vite actuel affiche déjà le résultat (il lit la base) : **première version
   visible sans une ligne de front**, utile pour relire les fiches.

### Lot 2 — Le pont (base DistriPro + base Taxi Food + fonction Edge)
1. RPC `pont_*` côté DistriPro (enveloppes, secret, REVOKE complet).
2. Table `distripro_liaisons` + secrets Vault côté Taxi Food.
3. Fonction Edge `distripro` (JWT, partenaire actif, restaurant actif du sélecteur).
4. Création automatique du client DistriPro au premier accès (nom, téléphone, emplacement
   déduits du restaurant Taxi Food ; `origine = 'taxifood'`).
5. Contrôles : un client simple → 403 ; un partenaire d'un autre restaurant → ne voit pas les
   commandes du voisin ; secret faux → refus ; clé publique sur les RPC `pont_*` → 401.

### Lot 3 — Le module natif dans l'app Taxi Food
1. `app/distripro/` : écrans Catalogue (rayons, recherche), Fiche, Panier, Validation (date,
   paiement, commentaire), Mes commandes, Détail, Document (BL / facture rendus nativement,
   bouton « Partager »).
2. Store `distriproCart` séparé, persisté sous sa propre clé.
3. 5ᵉ onglet « Commander » dans `(restaurant)/`, en-tête DistriPro, visite guidée mise à jour
   (une étape de plus, avec le libellé exact de l'onglet).
4. Aucun module natif ajouté → **OTA sur les trois runtimes + web Taxi Food**.
5. Contrôles : `tsc`, parcours complet sur l'app web à 375 px avec un compte partenaire,
   commande réelle de test **sur un produit à 0 stock fictif** (ou en accord avec toi) puis
   annulation, vérification que l'e-mail et le Telegram partent.

### Lot 4 — distripro207.com = la même chose, en web
1. Variante `APP_VARIANT=distripro` (export web du seul module + adaptateur « compte DistriPro »).
2. Nouveau site Netlify, domaine **distripro207.com** déplacé depuis `frity-nosybe` ; la landing
   Frity passe en **`/frity`** (redirection 301 conservée pour les liens déjà imprimés —
   flyer du 1er septembre).
3. PWA (manifest, icônes, bandeau de mise à jour sur le modèle de DistriPro).
4. Portails d'exploitation : inchangés, sur `distripro207.netlify.app`.
5. Contrôles : même parcours qu'au lot 3 mais en compte DistriPro ; liens Frity imprimés
   toujours valides ; SEO de base (titre, description, sitemap).

### Lot 5 — Le conseil emballage (ce qui règle le vrai problème)
1. Correspondance **catégorie de plat → contenant conseillé** (Pizza → carton 33 cm ;
   Frites → boîte à frites ; Soupe / plat en sauce → bol kraft 750 ml ; Burger → barquette +
   sac ; Chinois → bol kraft + baguettes…), réglable dans l'admin.
2. Dans l'onglet Commander : **« Ma liste conseillée »** calculée sur SA carte et SES volumes
   Taxi Food des 30 derniers jours, en un tap → panier.
3. Dans Réglages : à côté du forfait « Emballage à emporter », le coût réel du bon contenant
   (« votre forfait : 1 000 Ar — un bol kraft 750 ml vous coûte 1 250 Ar »).
4. (Option) rappel de réassort estimé : « au rythme de vos commandes, plus de cartons dans
   ~6 jours ».

### Lot 6 — Finitions (la déduction du reversement est abandonnée : paiement à la livraison)
1. Déduction d'une facture DistriPro du prochain reversement Taxi Food (ligne visible dans
   « Mes versements » et dans le rapport de clôture).
2. Push au partenaire sur les statuts DistriPro.

---

## 5. Risques et points de vigilance

| Risque | Parade |
|---|---|
| **Transport Tana → Nosy Be** non chiffré : la marge peut disparaître sur les cartons pizza | Devis avant toute fixation de prix (lot 0) ; prix d'achat saisis **rendus Nosy Be** |
| **Immobiliser du stock** (cartons ×100 à 140 000–180 000 Ar) | Stock initial calibré sur les volumes réels, réassort par lots ; démarrer par les 10 références qui servent les restaurants actifs |
| **Objet social de RENTANOO SARL** (location de véhicules) pour facturer légumes et emballages | Déjà signalé côté DistriPro, toujours ouvert — avis du comptable avant la 1ʳᵉ vraie facture |
| Deux bases, deux identités | Le pont isole tout ; aucune clé DistriPro privée dans l'app |
| Parité app / site | Un seul code d'écrans (option 2) |
| Domaine distripro207.com occupé par Frity | Frity déplacé en `/frity`, redirections conservées |
| Capacité Frity < 100 kg/semaine | Plafond de commande par semaine, ou « sur réservation » (D3) |
| Chantiers Taxi Food en parallèle (10 worktrees ouverts) | Module dans un worktree dédié, fichiers nouveaux uniquement, un seul fichier partagé touché (`(restaurant)/_layout.tsx`) |

---

## 6 bis. Décisions prises le 2026-10-23

| # | Décision |
|---|---|
| **D1** | ✅ **Pont validé** (fonction Edge Taxi Food + RPC DistriPro à secret). |
| **D3** | ✅ **3 calibres de frites Frity** : **PM** (petit modèle, style frite McDo), **MM** (moyen modèle, frite normale), **GM** (gros modèle, style pomme frite). Pour chaque modèle, on ajoutera ensuite **le style de plat recommandé**. ⏳ Prix par sachet et plafond hebdomadaire : non fixés. |
| **D4** | ✅ **Prix d'achat Bazary Be + 20 % de transport**, puis **+ 15 % de marge** : prix de vente = achat × 1,20 × 1,15 = **achat × 1,38**. En base : l'offre Bazary Be porte le prix **rendu Nosy Be** (× 1,20), le prix de vente le × 1,15 (même logique que la règle DistriPro « +15 % détail »). |
| **D6** | ✅ **Paiement à la livraison**, pour tout le monde. Le lot 6 « déduction du reversement » est **abandonné**. |

### Grille de prix des emballages (D4 appliquée)

Prix du lot arrondi aux **500 Ar supérieurs** (à confirmer). Les barquettes, vendues par Bazary
Be à l'unité, sont vendues ici **par 50** (leur minimum de commande).

| Produit | Lot | Achat Tana | Rendu Nosy Be (+20 %) | Calcul (+15 %) | **Prix de vente du lot** | Prix à l'unité |
|---|---|---|---|---|---|---|
| Bol kraft 450 ml | ×20 | 23 000 | 27 600 | 31 740 | **32 000** | 1 600 |
| Bol kraft 750 ml | ×20 | 25 000 | 30 000 | 34 500 | **34 500** | 1 725 |
| Bol kraft 1 L | ×20 | 27 000 | 32 400 | 37 260 | **37 500** | 1 875 |
| Bol kraft 1,5 L | ×20 | 30 000 | 36 000 | 41 400 | **41 500** | 2 075 |
| Bol kraft 1,8 L | ×20 | 37 000 | 44 400 | 51 060 | **51 500** | 2 575 |
| Barquette rect. 500 ml | ×50 | 40 000 | 48 000 | 55 200 | **55 500** | 1 110 |
| Barquette rect. 750 ml | ×50 | 40 000 | 48 000 | 55 200 | **55 500** | 1 110 |
| Barquette rect. 1 L | ×50 | 37 500 | 45 000 | 51 750 | **52 000** | 1 040 |
| Barquette rect. 1,5 L | ×50 | 75 000 | 90 000 | 103 500 | **103 500** | 2 070 |
| Barquette ronde 250 ml | ×50 | 20 000 | 24 000 | 27 600 | **28 000** | 560 |
| Barquette ronde 300 ml ⚠️ | ×50 | 35 000 | 42 000 | 48 300 | **48 500** | 970 |
| Barquette ronde 500 ml | ×50 | 25 000 | 30 000 | 34 500 | **34 500** | 690 |
| Barquette ronde 1 L | ×50 | 45 000 | 54 000 | 62 100 | **62 500** | 1 250 |
| Barquette ronde 2 L | ×50 | 90 000 | 108 000 | 124 200 | **124 500** | 2 490 |
| Boîte à frites kraft | ×50 | 17 000 | 20 400 | 23 460 | **23 500** | 470 |
| Boîte à frites rayée 11 cm | ×50 | 17 000 | 20 400 | 23 460 | **23 500** | 470 |
| Boîte à frites rayée 13 cm | ×50 | 17 000 | 20 400 | 23 460 | **23 500** | 470 |
| Carton pizza 26 cm | ×100 | 140 000 | 168 000 | 193 200 | **193 500** | 1 935 |
| Carton pizza 29 cm | ×100 | 160 000 | 192 000 | 220 800 | **221 000** | 2 210 |
| Carton pizza 33 cm | ×100 | 180 000 | 216 000 | 248 400 | **248 500** | 2 485 |
| Sac sandwich 31×11 | ×100 | 18 000 | 21 600 | 24 840 | **25 000** | 250 |
| Sac écru N1 | ×100 | 12 000 | 14 400 | 16 560 | **17 000** | 170 |
| Sac écru N2 | ×100 | 13 000 | 15 600 | 17 940 | **18 000** | 180 |
| Sac écru N3 | ×100 | 15 000 | 18 000 | 20 700 | **21 000** | 210 |
| Sac écru N4 | ×100 | 16 000 | 19 200 | 22 080 | **22 500** | 225 |
| Sac écru N5 blanc ⚠️ | ×100 | 21 000 | 25 200 | 28 980 | **29 000** | 290 |
| Sac écru N6 | ×100 | 23 000 | 27 600 | 31 740 | **32 000** | 320 |
| Sac écru N7 | ×100 | 25 000 | 30 000 | 34 500 | **34 500** | 345 |
| Baguettes chinoises | ×100 | 27 000 | 32 400 | 37 260 | **37 500** | 375 |
| Couvert plastique blanc ⚠️ | ×50 | 5 000 | 6 000 | 6 900 | **7 000** | 140 |
| Couvert plastique noir ⚠️ | ×50 | 12 000 | 14 400 | 16 560 | **17 000** | 340 |
| Couvert bois | ×100 | 16 000 | 19 200 | 22 080 | **22 500** | 225 |
| Cuillère glace malagasy | ×50 | 2 000 | 2 400 | 2 760 | **3 000** | 60 |
| Cuillère glace importée | ×500 | 35 000 | 42 000 | 48 300 | **48 500** | 97 |

**Ce que la grille dit aux restaurants partenaires :**
- **Les Siciliens** : le carton 33 cm revient à **2 485 Ar** ; le client paie 3 000 Ar
  d'emballage (part Taxi Food) → il reste ~500 Ar par pizza à Taxi Food.
- **La Cabane** : forfait 1 000 Ar ; un bol kraft 750 ml vendu **1 725 Ar**, une barquette
  rectangulaire 1 110 Ar, une boîte à frites 470 Ar. Le forfait ne couvre qu'une partie des contenants.
- **L'escale Créole** : forfait 1 000 / 2 000 Ar ; barquette ronde 1 L 1 250 Ar, bol kraft 1 L 1 875 Ar.

### Décisions du 2026-10-23 (2ᵉ passe)

- **Arrondi** : prix du lot arrondi aux **500 Ar supérieurs** ✅.
- **D2** ✅ : **un seul code d'écrans** (module Expo), onglet de l'app + distripro207.com.
- **Frites Frity** : **9 000 Ar/kg** pour les trois modèles (sachet 2,5 kg = **22 500 Ar**).
  **Minimum 5 kg (2 sachets) pour le GM et le PM** ; MM : ⏳ minimum à confirmer.
- **Légumes, prix de vente au kilo** : oignon **8 000**, tomate **7 000**, ail **19 000**
  (⏳ à valider), pomme de terre **5 000**.
- **Déduction du reversement Taxi Food : PAS abandonnée, EN ATTENTE.** Le chemin est construit
  (choix visible à la validation) mais affiché **« Pas encore disponible »**, non sélectionnable.
- **Anomalies Bazary Be** : réglées plus tard par un message au vendeur.
- **Fiche technique emballage par plat** (nouveau, voir lot 5) : pour chaque plat, la liste
  détaillée des contenants (ex. tacos = barquette + boîte à frites + sachet + sauce + couverts),
  avec **coût de revient** et **prix de vente** de l'emballage complet, pour savoir si Bazary Be
  couvre tous les besoins des restaurants et pour être transparent.
- **Prix de gros vs prix Messenger** : l'affiche « Catalogue prix gros » est le **tarif de gros**,
  base des calculs. Les prix envoyés par Messenger le 04/09 sont plus élevés et élargissent la
  gamme (barquettes noires, alu, polystyrène, bol 1,2 L, boîte à nouilles, hygiène, sauces) :
  relevé brut dans `~/Desktop/bazarybe/releves/2026-09-04-messenger-tarifs.md`.

### Légumes et frites

- **Légumes** (tomate, pomme de terre, oignon, ail) : fournisseurs de Nosy Be, **pas de
  transport** : la règle existante de DistriPro (+15 % sur le prix d'achat) s'applique. Prix
  actuels inchangés.
- **Frites Frity PM / MM / GM** : sachet de 2,5 kg. ⏳ Prix à fixer (référence Frity :
  8 000 Ar/kg en lancement = 20 000 Ar le sachet).

## 6. Décisions qui t'appartiennent

| # | Question | Ma recommandation |
|---|---|---|
| **D1** | ✅ Architecture du pont | **Validée** : option B |
| **D2** | Site web | Option 2 : un seul code Expo, variante `distripro` sur distripro207.com ; storefront Vite retiré du domaine |
| **D3** | Les **3 calibres** de frites : lesquels (ex. allumette 7 mm / classique 10 mm / steak 13 mm, ou allumette / classique / rondelles) ? prix ? plafond hebdomadaire ? | à toi |
| **D4** | ✅ Marge sur les emballages | **Validée** : +20 % transport puis +15 % (§ 6 bis) |
| **D5** | Stock : quelles références et combien au départ ? | liste proposée au lot 0, à partir des cartes |
| **D6** | ✅ **Paiement à la livraison** — tranché. ~~Paiement des partenaires : à la livraison seulement, ou aussi **déduction du reversement** Taxi Food ? (deux entités ?) ~~ | lot 6 abandonné |
| **D7** | Livraison DistriPro : même règle de coupure midi pour les emballages en stock ? Frais de livraison ? Minimum de commande ? | emballages : J+1 sans coupure, livraison offerte au-delà d'un minimum |
| **D8** | Les autres catégories DistriPro (fruits, viandes, épicerie…) : masquées pour combien de temps ? | masquées jusqu'à nouvel ordre, réactivables par un `UPDATE` |
| **D9** | Domaine : `distripro207.com` racine pour la boutique et Frity en `/frity` ? Portails d'exploitation sur `gestion.distripro207.com` ? | oui |

---

## 7. Avancement au 2026-10-24

**Décision transport (option b)** : le transport est calculé **par référence**, à partir du coût
réel au colis divisé par les pièces du colis, jamais un pourcentage fixe. Raison : la 1ʳᵉ commande
Bazary Be (septembre, Rapide Service, reçu n° 522030) a coûté **65 368 Ar de transport pour
91 000 Ar de marchandise** (~72 %). Rapide Service facture **au colis** (32 200 Ar en P1, que le
colis fasse 15 ou 35 litres) : le levier est de **remplir de gros colis**.

**Base fournisseur créée dans DistriPro** (schéma `sourcing`, non exposé, RLS, aucun droit public ;
migrations `pem-drive/supabase/migrations/20261024090000…` à `…100000`, commits `d944835`,
`8c92359`) :
- Bazary Be = fournisseur n° 12 (portail fermé), contact **Robin**, bazarybestore@gmail.com,
  MVola 034 38 177 45, Orange Money code marchand 385829.
- **105 références** (9 familles), **131 prix** sur 4 niveaux (gros affiche, liste Messenger,
  WhatsApp, facture), chaque prix daté et rattaché à sa source (6 sources).
- **1 envoi réel** et le transport par pièce : bol kraft 750 ml **742 Ar** (achat 1 300),
  gobelet 500 ml **683 Ar** (achat 520).
- **16 fiches emballage** (kits) et 28 catégories Taxi Food rattachées : vue
  `sourcing.v_kits_synthese` (achat, transport connu, prix de vente, besoins non couverts).

**Ce que Bazary Be ne couvre pas (d'après les kits)** : pots à sauce avec couvercle, serviettes
papier, pailles, couvercles étanches pour bols kraft (si non inclus) ; papier ingraissable en
rupture ; boîte burger à confirmer (HB2 ?).

**Relevés bruts** : `~/Desktop/bazarybe/releves/` (Messenger, WhatsApp, script `gen_sourcing.py`).

**Reste à collecter** : ~20 photos du fil WhatsApp et les publications Facebook / Instagram
(visuels, nouvelles références, prix publics) ; archives de bazarybestore.mg (site hors ligne).

### Collecte complète Bazary Be (2026-10-24, en autonomie)

- **WhatsApp** : 14 photos téléchargées (9 uniques) → `~/Desktop/bazarybe/visuels/whatsapp/`. Aucune photo
  produit de Bazary Be ; colis et reçu Rapide Service, paiement Orange Money (08/09, réf. MP260908.1109.B39033).
  Commande : passée le 07/09, payée et expédiée le 08/09. E-mail du 05/09 de **Robin** (bazarybestore@gmail.com).
- **Facebook** : 7 615 photos parcourues (octobre 2026 → juillet 2024, arrêt volontaire au-delà), dédoublonnées
  par empreinte visuelle en **1 281 visuels**, revus un à un → **329 produits distincts** (223 emballages,
  66 alimentaires, 40 hygiène). Une publication par produit ouverte au rythme lent (~12 s) : légende + image
  pleine taille → `~/Desktop/bazarybe/visuels/facebook/` (328 images, 54 Mo), catalogue
  `releves/facebook_catalogue.json`, planches de revue `releves/planches/`.
- **Prix publics : quasi inexistants** (2 légendes sur 329). Les prix se donnent en privé → brouillon de message
  à Robin `~/Desktop/bazarybe/releves/BROUILLON-message-Robin-prix.md` (**non envoyé**).
- **Base** (commit DistriPro `86c5947`) : **377 références** (dont 272 issues de Facebook, « prix à demander »),
  383 visuels, 336 sources. Site bazarybestore.mg hors ligne ; un visuel cite `bazarybe.mg` (à vérifier).
- **Fiches emballage** : pot à sauce, serviettes et paille désormais couverts par Bazary Be ; boîte burger
  remplacée (HB2 = boîte bento/nem) ; il ne reste que le couvercle des bols kraft à confirmer.
