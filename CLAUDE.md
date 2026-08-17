# Taxi Food — Livraison de repas (Nosy Be)

Marketplace de livraison de repas à Nosy Be. **App cliente construite et fonctionnelle**, branchée sur le vrai backend Supabase, avec deux **vrais restaurants**. Branche de travail : `main`. **Build de production iOS opérationnel** : le build n°5 est soumis à TestFlight (voir « Build de production (EAS) » plus bas). Reste à faire : test bout-en-bout sur appareil réel via TestFlight, puis mise en service.

## Lancer l'app en local

```bash
npm run dev --prefix app        # équiv. `cd app && npx expo start`
npx expo start --web --port 8081 --prefix app   # aperçu web direct
```

⚠️ **Expo Go NE MARCHE PAS** : le projet est en **Expo SDK 57** (RN 0.86, React 19.2), plus récent que ce qu'Expo Go du store embarque → « projet incompatible ». Pour tester sur téléphone, il faut une **build de dev EAS** (voir `app/eas.json`), pas Expo Go.

- **Web** (aperçu rapide) : `http://localhost:8081`. L'accueil est derrière le login Google ; pour voir l'app sans se connecter, ouvrir directement `http://localhost:8081/(tabs)` (les routes ne sont pas gardées individuellement, et les lectures resto/produit sont en RLS publique).
- Compte de test : connexion **Google réelle** uniquement (pas de démo). Voir Auth ci-dessous.

## Stack & backend

- **Expo SDK 57** + expo-router (navigation par fichiers) + **zustand** (panier/checkout/session) + AsyncStorage.
- **Supabase** projet `bmdveawomizjpiebgtkj` (accès via le connecteur MCP claude.ai ; c'est un projet distinct des autres — voir aussi le projet frère `addition-appli`).
- **Clés** dans `app/.env` (git-ignoré, à recréer depuis `app/.env.example`) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable/anon**, publique par conception — RLS protège), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Les deux vrais restaurants

- **Taxi Be** — bar & pizzeria (Pizza, Tapas, Bières, Cocktails, Softs).
- **La Cabane** — snacks (Sandwichs & Repas, Burgers, Bières, Softs, Milkshakes, Crêpes).

⚠️ Les 4 restaurants de **démo** (Pizzeria Papillon, Tacos du Boulevard, Burger Baobab, Chez Loulou) ont été **supprimés de la base**. Ne pas les réintroduire ; aucun nom en dur dans le code (juste un exemple dans un commentaire de `data/types.ts`).

Les menus, compositions et photos viennent de photos de carte déposées dans le **bucket Storage `MENU`** (`MENU/TAXI BE/`, `MENU/LA CABANE/`) ; les logos dans le bucket `logo`. Buckets **publics**.

## Modèle de données (au-delà de `SCHEMA-TAXI-FOOD.md`)

Colonnes/tables ajoutées au fil de l'eau (migrations appliquées via MCP) :

- `restaurants` : `logo_url`, `cover_url`, `food_types text[]` (types de plats pour le **filtre** de l'accueil).
- `categories` : `icon` (emoji, ex. 🍕), `is_active` (masquage doux d'une catégorie sans supprimer ses produits).
- `products` : `photo_url`.
- **Options/suppléments** : `product_option_groups` (name, min_select, max_select, required, sort_order) + `product_options` (name, price_delta, is_available, sort_order) ; snapshot commande `order_item_options`.
- `addresses` : `latitude`, `longitude`, `location_captured_at` (**GPS obligatoire**, voir plus bas).
- RPC **`create_order`** (**SECURITY DEFINER**) : atomique, valide les options (appartenance produit, dispo, quotas min/max, groupes requis), **recalcule `unit_price` = price + Σ price_delta** (le client n'envoie jamais de prix), génère `order_number` (`TF-…`), et **vérifie que l'adresse a lat/lng** (exception sinon). La fonction fixe elle-même `user_id = auth.uid()` et exige que l'adresse appartienne à l'appelant → elle n'écrit jamais pour autrui, DEFINER est sûr.
  - ⚠️ **Pourquoi DEFINER et pas INVOKER** : la fonction fait un `UPDATE orders SET subtotal/total` après avoir inséré les lignes. `orders` n'a **volontairement aucune politique RLS UPDATE** (un client ne doit pas pouvoir modifier ses commandes via l'API REST). En INVOKER, cet UPDATE touchait **0 ligne** sous RLS → `returning into v_order` = NULL → la fonction renvoyait NULL et laissait `total = frais de livraison` (bug corrigé le 2026-08-14 : montant 0 en confirmation, « commande introuvable », total faux). DEFINER exécute les écritures hors RLS. **Ne pas repasser en INVOKER sans supprimer l'UPDATE final.**

## Multi-rôle & espace restaurant

Un même compte Google peut être **client** et/ou **restaurant** (et **livreur** en Phase 3).

- **Base** : enums `app_role` {client,restaurant,livreur} / `role_status` {pending,active,revoked} ; tables `user_roles`, `restaurant_staff` (lie un compte à un `restaurants.id`), `couriers`. RPC `request_role(p_role)` : `client` → `active` immédiat ; `restaurant`/`livreur` → `pending` jusqu'à validation **manuelle** (toi, en base).
- **Helpers rôle** (SECURITY DEFINER) : `is_active_restaurant_staff_of(rid)`, `current_restaurant_id()`. Un « restaurant actif » = rôle restaurant `active` **ET** lien `restaurant_staff`.
- **RLS restaurant** : policies SELECT additives sur `orders`/`order_items`/`order_item_options` → le staff voit les commandes de **son** restaurant (les policies client, par `user_id`, restent inchangées).
- **Transitions de statut** : RPC **`set_order_status(order_id, new_status, reason)`** (SECURITY DEFINER, comme `create_order` — aucune policy UPDATE ouverte sur `orders`). Vérifie l'appartenance au restaurant et n'autorise que les transitions valides : `recue→confirmee|annulee`, `confirmee→en_preparation|annulee`, `en_preparation→en_livraison`. `annulee` exige un motif (stocké dans `orders.cancellation_reason`, visible côté client).
- **Routage app** (`app/index.tsx`) : client **sans** rôle pro → parcours inchangé (aucun écran de sélection) ; compte multi-rôle → `mode` persisté (AsyncStorage `tf_mode`) respecté, sinon `role-select`. Espace restaurant = groupe de routes `app/(restaurant)/` : 3 onglets **Commandes en cours** (polling 12 s, badge du nb de commandes en attente d'action via le store `restaurantQueue`) · **En livraison** (`en_livraison`, lecture seule) · **Historique** (`livree`/`annulee`). Le suivi client affiche l'état **refusée + motif**. ⚠️ Tout écran resto filtre **explicitement** par `restaurant_id` (`listRestaurantOrders`) — un compte multi-rôle a deux policies SELECT sur `orders` (staff OU propriétaire) qui se cumulent en OR, la seule RLS laisserait fuiter ses commandes client.
- **Espace livreur** (`app/(livreur)/`, mode `livreur`) : colonnes `orders.courier_id`/`picked_up_at`/`delivered_at`/`cash_confirmed` (pas de nouvel enum — le statut reste `en_livraison` de la prise jusqu'à `livree` ; `courier_id`/`picked_up_at` distinguent disponible/prise/récupérée). Helper `is_active_courier()`. RLS SELECT livreur : commandes **disponibles** (`en_livraison`, `courier_id is null`) + **les siennes** (`courier_id = auth.uid()`). RPC SECURITY DEFINER : **`claim_order`** (attribution atomique `UPDATE … WHERE courier_id IS NULL`, une seule commande à la fois), `release_order`, `mark_order_picked_up`, `mark_order_delivered` (encaissement espèces obligatoire), `set_courier_availability` (upsert `couriers.is_available`). 2 onglets : **Livraisons** (toggle dispo, prise « Je la prends », cycle Récupérée→Livrée, polling 12 s) + **Historique**. Le suivi client distingue « en attente d'un livreur » vs « récupérée, en route » via `picked_up_at`.
- ⚠️ **Compte de test** : le compte `techerchristopher@gmail.com` (`9ca91352…`) est lié à **Angelo** (staff restaurant **actif**) **et** a le rôle **livreur actif** (pour tester les deux espaces). À sa connexion il voit l'écran de sélection de rôle. Pour lier un **vrai** compte restaurant : `user_roles(user_id,'restaurant','active',now())` + `restaurant_staff(user_id, restaurant_id)` ; pour un **livreur** : `user_roles(user_id,'livreur','active',now())` (la ligne `couriers` est créée au 1er toggle de disponibilité).
- **Non fait (P2 futur)** : notifications push (prévoir `push_tokens`), édition menu/horaires depuis l'app, filtrage livreur par zone (`couriers.zone`), stats.

## Dashboard admin (web — `admin/`)

Petite app **Next.js 15** (App Router, TS) séparée, **même projet Supabase**, réservée à l'admin. `cd admin && npm install && npm run dev` → http://localhost:3000.

- **Auth** : rôle **`admin`** (`app_role` étendu) attribué **uniquement à la main** en base, jamais via `request_role`. Connexion **Google** (même provider). Garde : `supabase.rpc('is_admin')` ; un non-admin voit « Accès refusé » et surtout **ne lit aucune donnée** (RLS `*_select_admin using (is_admin())`). ⚠️ Ajouter `http://localhost:3000` (+ l'URL Netlify de prod) dans **Supabase → Auth → Redirect URLs**.
- **Base** (migrations `app_role_add_admin`, `admin_dashboard_foundation`) : `restaurants.commission_rate` (fraction 0..1, **placeholder 0.15 à ajuster par resto**) ; `orders.commission_rate/commission_amount` **figés à la livraison** (`mark_order_delivered`) → un rapport déjà sorti ne bouge jamais ; table `restaurant_settlements` (trace des reversements). RPC SECURITY DEFINER admin : `set_commission_rate`, `record_settlement` (calcule le net dû sur la période, jour local `Indian/Antananarivo`), `approve_role`/`reject_role`.
- **Modèle d'argent** (tranché) : le livreur encaisse tout le cash → te le remet → tu reverses au restaurant `Σ plats − commission` et gardes commission + frais de livraison. **Commission sur les plats (`subtotal`) uniquement.** Seules les `livree` comptent ; aucune commission sur une annulée. **Ouvert** : rémunération livreur (le rapport trace le reversement restaurant en priorité).
- **Écrans (4 onglets)** : Temps réel (commandes actives tous restos + livreurs dispo, polling 10 s, badge RETARD) · Rapport de clôture (période, net à reverser/resto, totaux, export CSV, « marquer reversé » + historique) · Demandes de rôle (valider/refuser, lier `restaurant_staff`) · Restaurants & menus (créer/éditer un restaurant ; gérer catégories/produits — prix, description, dispo, **photo par URL en V1**, upload direct = P1). Écritures via RPC admin (`admin_create_restaurant`, `admin_update_restaurant`, `admin_upsert_category`, `admin_upsert_product`), gardées par `is_admin()`.
- **Reste (P1/P2)** : rémunération livreur dans le rapport (question ouverte), upload photo depuis le dashboard, filtres/recherche commandes, graphes, mode admin mobile allégé.

## Règles produit importantes (déjà implémentées)

- **Choix structurés, pas de commentaire libre** : les produits « à choix » (kebab, tacos, burgers, pizzas…) utilisent des groupes d'options (radios / cases). Le champ commentaire a été retiré.
- **Suppléments = ingrédients de la composition** (1:1, prix unitaire) ; La Cabane a en plus « Sauce au choix » (obligatoire) + « Sauce supplémentaire » (+2 000 Ar).
- **Filtre accueil** = `restaurants.food_types` (Pizza, Tacos, Kebab, Burger, Américain, Panini, Crêpe, Milkshake, Tapas) ; un resto multi-types ressort dans chaque filtre. **Les tags sur la carte resto = les CATÉGORIES actives** (emoji + nom), différent des food types.
- **Photos** : `products.photo_url` via `ProductThumb`, logos resto via `RestaurantLogo` (image + repli initiales) ; repli propre si `null`/échec, jamais le nom en texte.
- **GPS OBLIGATOIRE** pour valider une commande (pas d'adressage postal à Nosy Be) : l'écran adresse bloque « Confirmer » tant qu'aucune position n'est captée (`expo-location`) ; refus → réessayer/Réglages, aucun contournement. Adresses enregistrées sans GPS = signalées et bloquées. Utilitaire `getMapsNavigationUrl(lat,lng)` prêt pour un futur back-office livreur. Depuis le 2026-08-17, un **aperçu carte cliquable** (`MapPreview`, voir plus bas) permet de vérifier visuellement la position captée.

## Fonctionnalités livrées le 2026-08-17/18 (build n°5, soumis à TestFlight)

- **Options en grille de chips** (`app/app/product/[id].tsx`) : les groupes d'options s'affichent en chips repliables (flexWrap) façon Uber Eats/Deliveroo au lieu de lignes empilées. Sélectionné = fond `colors.primary` + coche blanche ; non sélectionné = bordure fine. Logique de sélection/prix **inchangée**.
- **Photos de sauces dans les chips** : colonne `product_options.photo_url` (nullable). Vignette ~34px affichée à gauche du libellé quand renseignée (7 sauces à ce jour : Ketchup, Mayonnaise, Andalouse, Algérienne, Blanche, Harissa, Samouraï — bucket Storage `produits`, chemin `sauces/<nom>.png`). Repli silencieux (pas de vignette) si absente ou en échec de chargement.
- **Groupes d'options obligatoires en premier** : tri appliqué dans `getProductDetail` (`app/data/api.ts`) — corrige l'ordre illogique observé sur les tacos (« sauce supplémentaire » payante affichée avant « sauce au choix » obligatoire), appliqué à tous les produits à options.
- **Suggestions d'upsell au panier** (`app/data/suggestions.ts`, `app/app/(tabs)/cart.tsx`) : remplace le bouton générique « Ajouter d'autres plats » par de vraies suggestions **du restaurant courant** — une boisson si le panier n'en contient pas encore, sinon un dessert, avec ajout rapide en un tap. Classification par nom **et** emoji de catégorie (la table `categories` n'a pas de colonne « type » — les catégories boisson comme « Bières »/« Softs »/« Cocktails » ne contiennent jamais le mot « boisson »).
- **Aperçu carte GPS cliquable** (`app/components/MapPreview.tsx`, utilisé dans `app/app/address.tsx`) : tuiles raster **OpenStreetMap** (`tile.openstreetmap.org`) affichées via `<Image>`, **zéro dépendance native, zéro clé API**. Choix fait après échec répété de `npx expo install react-native-maps` (timeouts réseau persistants) — plus léger et sans risque de build pour un simple aperçu. Appui → ouvre l'app de cartes native (Plans iOS / Google Maps). Attribution OSM affichée (obligatoire).
- **Écran de confirmation illustré** (`app/app/confirmation.tsx`) : le logo du restaurant réapparaît, plus la photo de chaque plat/boisson commandé, dans une `ScrollView` (évite l'overflow avec plusieurs articles).
- **Connexion par téléphone + bouton Facebook** : voir section Auth ci-dessous.

## Auth (⚠️ flux Google spécifique)

- **Google** — flux **`supabase.auth.signInWithOAuth`** (PKCE) + `expo-web-browser` + deep link, **PAS** `signInWithIdToken`. Raison : côté Google seul l'URI de callback Supabase est déclaré → c'est le flux médié par Supabase qui marche. Tout est dans `app/lib/auth.ts`.
- Provider Google activé côté Supabase (Client ID + Secret). Redirect URLs Supabase autorisées : `taxifood://*`, `exp://*`, `http://localhost:8081`.
- **Le login réel ne peut pas être testé par Claude** (saisie d'identifiants Google = action humaine). Vérifié : la chaîne serveur renvoie bien un 302 vers Google.
- **Téléphone (SMS OTP)**, depuis le 2026-08-17 : écran `app/app/login-phone.tsx`, `signInWithOtp`/`verifyOtp` dans `app/lib/auth.ts`. Fonctionnel côté code ; comme Google, nécessite un humain pour saisir un vrai numéro/code.
- **Bouton Facebook**, présent sur `app/app/login.tsx` : **volontairement sans câblage** (aucun `onPress`, affichage seul) — décision explicite du 2026-08-17, en attente d'une consigne produit avant de le brancher. Ne pas y toucher sans demande explicite.

## Build de production (EAS) — état

- **Compte Apple Developer actif** (Team « jean christopher techer », `CV2FA6NJ75`) ; certificat de distribution + provisioning profile iOS gérés par EAS (Expo server), valides jusqu'à 08/2027.
- `app/eas.json` : profils `development` (dev client), `preview` (interne), `production` (`distribution: "store"`, `autoIncrement: true` → **chaque build de prod incrémente automatiquement `buildNumber`**, ne jamais le fixer à la main). `appVersionSource: "remote"`.
- Bundle ids : iOS `com.chris97416.taxi-food-nosybe`, Android `com.chris97416.taxifoodnosybe` (Android interdit les tirets). Soumission App Store Connect : `submit.production.ios.ascAppId = "6802418114"`.
- **Build n°5** (commit `551d56f`, 2026-08-18) : construit puis **soumis avec succès à TestFlight** (`eas submit`), contient les 6 fonctionnalités listées ci-dessus. En cours de traitement Apple après soumission (~5-10 min habituellement).
  - ⚠️ Le **build n°4** (commit `3e49a1e`) existe aussi sur EAS mais correspond à un état du code **antérieur** à ces 6 fonctionnalités (lancé manuellement par erreur en parallèle) — ne pas le distribuer aux testeurs.
- Commandes de référence : `cd app && eas build -p ios --profile production --non-interactive` puis `eas submit -p ios --profile production --id <buildId> --non-interactive`.
- **Android** : jamais buildé en profil `production` à ce jour ; `eas build --profile development --platform android` marche tout de suite (APK, aucun compte payant requis).

## Ce qui est vérifié vs pas encore

- ✅ Vérifié en web (lectures publiques, sans login) : accueil/filtres/logos/emojis, menu, configurateur d'options + prix temps réel, panier (clé par produit+options), blocage GPS obligatoire + capture (position simulée), `tsc --noEmit`, bundle web.
- ✅ Vérifié côté build : `eas build`/`eas submit` production iOS opérationnels de bout en bout (credentials, upload, soumission App Store Connect).
- ⏳ **Non testé** (nécessite un humain) : la connexion de bout en bout (Google, téléphone), l'écriture réelle en base (`addresses` GPS, `orders`/`order_items`), et le rendu visuel réel des 6 fonctionnalités du build n°5 (chips, vignettes de sauces, carte, écran de confirmation) sur un vrai appareil. Tables encore vides. **À dérouler via TestFlight** dès que le build n°5 est disponible côté Apple.

## Conventions

- Dépôt git **isolé** dans `taxi-food-nosybe/`. GitHub : https://github.com/techerchristopher-dotcom/taxi-food-nosybe . **Commit + push (HTTPS) après chaque étape.**
- Après toute migration touchant le schéma : penser à régénérer les types si un fichier `db-types` est réintroduit (actuellement les types sont mappés à la main dans `app/data/api.ts`).
- ⚠️ **Tester une RPC à effet de bord en SQL** : utiliser `select * from create_order(...)` (une seule évaluation). **Jamais `select (create_order(...)).*`** : l'expansion `.*` d'un type composite évalue la fonction **une fois par colonne** → autant d'insertions parasites. Et pour reproduire un souci RLS, tester sous `set local role authenticated` + `set_config('request.jwt.claims', ...)` dans une transaction annulée — sinon on tourne en superuser et la RLS est ignorée (le bug reste invisible).
- Documentation en français.
- Docs de référence : `CAHIER-DES-CHARGES-MVP.md`, `SCHEMA-TAXI-FOOD.md`, `PROMPT_BUILD_APP_CLIENT.md`.
