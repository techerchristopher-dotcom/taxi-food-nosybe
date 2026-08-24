# Taxi Food — Livraison de repas (Nosy Be)

Marketplace de livraison de repas à Nosy Be. **App cliente construite et fonctionnelle**, branchée sur le vrai backend Supabase, avec trois **vrais restaurants** (Angelo, Taxi Be, La Cabane). Branche de travail : `main`.

Trois livrables distincts, à ne pas confondre :

| | Quoi | Où |
|---|---|---|
| **`app/`** | l'application mobile (Expo, iOS + Android) | soumise à l'App Store |
| **`admin/`** | le tableau de bord de gestion (Next.js, web) | `taxi-food-admin-nosybe.netlify.app` |
| **`landing/`** | le site de **pré-lancement**, trilingue | `taxifood-nosybe-landing.netlify.app` |

## Où en est la soumission

**iOS — build 1.0.0 (22) soumis le 2026-08-23**, après **deux rejets** du build 17 :

1. **Guideline 5.1.1(v)** — « the app requires users to register before viewing the menu ». L'app s'ouvrait sur l'écran de connexion. Corrigé : le catalogue est désormais libre, voir la section « Navigation libre » plus bas. C'est le changement de comportement le plus important de tout le projet.
2. **Guideline 2.1(a)** — « we cannot access the Restaurant and Courier accounts ». Un seul compte de démo était fourni, et les notes disaient que les espaces pro étaient hors périmètre. **Apple veut vérifier CHAQUE type de compte.** Trois comptes actifs sont maintenant fournis.

⚠️ Le relecteur teste sur **iPad** (iPad Air 11-inch M3 sur les deux revues), en mode compatibilité iPhone puisque `supportsTablet: false`. Il a aussi passé de **vraies commandes** chez Angelo (TF-47, TF-48, depuis une adresse Apple private relay) : pendant une revue, quelqu'un doit pouvoir traiter une commande qui arrive, sinon le parcours paraît cassé.

**Android** — toute la chaîne technique est prête et testée en conditions réelles le 2026-08-19 (Google natif, Facebook en flux web, clé Maps, notifications FCM). Compte Google Play créé, **identité vérifiée**. Restent la vérification du numéro de téléphone et celle de l'accès à un **appareil Android physique** — cette dernière est refusée depuis un émulateur (détection anti-fraude de Google, message trompeur parlant d'Android 10). Aucun build `production` Android n'est encore sorti.

⚠️ **Quatre documents à tenir à jour, à lire avant de commencer quoi que ce soit :**

- **[docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md)** — ce qui est écrit mais pas encore compilé, et la recette à passer sur appareil avant l'envoi. Décision du 2026-08-18 : on empile les chantiers et on ne fait **qu'un seul gros build**, la liaison de Nosy Be rendant chaque envoi coûteux. À vider après chaque build.
- **[docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md)** — audit de conformité iOS, bloquant par bloquant.
- **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md)** — textes de la fiche, questionnaire App Privacy, classement d'âge, **et les notes de revue à coller** (§ 4, rédigées en anglais).
- **[docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md)** — état des lieux Android : ce qui est fait, ce qui est bloqué par du code, et ce qui l'est par un compte externe que seul le porteur du projet peut créer.

## Lancer l'app en local

```bash
npm run dev --prefix app        # équiv. `cd app && npx expo start`
npx expo start --web --port 8081 --prefix app   # aperçu web direct
```

⚠️ **Expo Go NE MARCHE PAS** : le projet est en **Expo SDK 57** (RN 0.86, React 19.2), plus récent que ce qu'Expo Go du store embarque → « projet incompatible ». Pour tester sur téléphone, il faut une **build de dev EAS** (voir `app/eas.json`), pas Expo Go.

- **Web** (aperçu rapide) : `http://localhost:8081`. L'accueil **est libre depuis le 2026-08-22** (voir « Navigation libre ») : on arrive directement sur le catalogue, sans compte.
- Comptes de démonstration : trois, créés pour la revue Apple — voir « Comptes de démonstration » plus bas.

## Stack & backend

- **Expo SDK 57** + expo-router (navigation par fichiers) + **zustand** (panier/checkout/session) + AsyncStorage.
- **Supabase** projet `bmdveawomizjpiebgtkj` (accès via le connecteur MCP claude.ai ; c'est un projet distinct des autres — voir aussi le projet frère `addition-appli`).
- **Clés** dans `app/.env` (git-ignoré, à recréer depuis `app/.env.example`) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable/anon**, publique par conception — RLS protège), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Les trois vrais restaurants

- **Angelo** — voir sa carte en base pour le détail des catégories.
- **Taxi Be** — bar & pizzeria (Pizza, Tapas, Bières, Cocktails, Softs). ⚠️ Les 6 cocktails sont désactivés depuis le 2026-08-19 (`categories.is_active = false`, décision classement d'âge — voir `docs/FICHE-APP-STORE.md` § 3), les 19 bières restent.
- **La Cabane** — snacks (Sandwichs & Repas, Burgers, Bières, Softs, Milkshakes, Crêpes).

⚠️ Les 4 restaurants de **démo** (Pizzeria Papillon, Tacos du Boulevard, Burger Baobab, Chez Loulou) ont été **supprimés de la base**. Ne pas les réintroduire ; aucun nom en dur dans le code (juste un exemple dans un commentaire de `data/types.ts`).

Les menus, compositions et photos viennent de photos de carte déposées dans le **bucket Storage `MENU`** (`MENU/TAXI BE/`, `MENU/LA CABANE/`) ; les logos dans le bucket `logo`. Buckets **publics**.

### Buckets Storage

| Bucket | Contenu | Écriture |
|---|---|---|
| `MENU` | photos des cartes papier, source des menus | — |
| `logo` | logos des restaurants | — |
| `produits` | visuels produits et sauces (`sauces/<nom>.png`) | `public.is_admin()` |
| `boissons` | visuels boissons | `public.is_admin()` |
| `marketing` | visuels de communication, hors app : `app-store/` (les captures de la fiche, en 6,9" **et** 6,5"), `video/` (rushes des vidéos du site) | `public.is_admin()` |

Tous sont **publics en lecture**.

⚠️ **Historique corrigé le 2026-08-19** (migration `buckets_produits_boissons_ecriture_admin`) : `produits` et `boissons` avaient des politiques `INSERT`/`UPDATE` ouvertes au rôle `public`, sans autre prédicat que le `bucket_id`. La clé anon étant lisible dans le bundle de l'app, cela suffisait à déposer ou **écraser** n'importe quelle photo de produit. Reliquat des fonctions Edge d'import (`import-visuels`, `montage-visuels`, neutralisées depuis). Alignés sur `marketing` : écriture réservée aux administrateurs, lecture publique inchangée. Vérifié : la clé anon se fait refuser en écriture (403 RLS), la lecture publique répond toujours 200.

Le dépôt initial dans `marketing` a demandé une **fenêtre temporaire** (migrations `bucket_marketing_depot_initial` puis `bucket_marketing_fermeture`) : l'écriture y est réservée aux administrateurs, et le seul compte admin est celui du porteur du projet — dont le mot de passe n'a pas à transiter. La fenêtre était restreinte au préfixe `app-store/` et a été refermée aussitôt. Même procédé pour un futur dépôt, ou passer par le tableau de bord Supabase (qui utilise `service_role` et contourne la RLS).

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
- **Routage app** (`app/index.tsx`) : `mode` persisté (AsyncStorage `tf_mode`) respecté ; `role-select` **uniquement pour un vrai compte multi-rôle**, jamais pour un compte à rôle unique — voir « Navigation libre » pour la règle complète et pourquoi elle a changé. Espace restaurant = groupe de routes `app/(restaurant)/` : 3 onglets **Commandes en cours** (polling 12 s, badge du nb de commandes en attente d'action via le store `restaurantQueue`) · **En livraison** (`en_livraison`, lecture seule) · **Historique** (`livree`/`annulee`). Le suivi client affiche l'état **refusée + motif**. ⚠️ Tout écran resto filtre **explicitement** par `restaurant_id` (`listRestaurantOrders`) — un compte multi-rôle a deux policies SELECT sur `orders` (staff OU propriétaire) qui se cumulent en OR, la seule RLS laisserait fuiter ses commandes client.
- **Espace livreur** (`app/(livreur)/`, mode `livreur`) : colonnes `orders.courier_id`/`picked_up_at`/`delivered_at`/`cash_confirmed` (pas de nouvel enum — le statut reste `en_livraison` de la prise jusqu'à `livree` ; `courier_id`/`picked_up_at` distinguent disponible/prise/récupérée). Helper `is_active_courier()`. RLS SELECT livreur : commandes **disponibles** (`en_livraison`, `courier_id is null`) + **les siennes** (`courier_id = auth.uid()`). RPC SECURITY DEFINER : **`claim_order`** (attribution atomique `UPDATE … WHERE courier_id IS NULL`, une seule commande à la fois), `release_order`, `mark_order_picked_up`, `mark_order_delivered` (encaissement espèces obligatoire), `set_courier_availability` (upsert `couriers.is_available`). 2 onglets : **Livraisons** (toggle dispo, prise « Je la prends », cycle Récupérée→Livrée, polling 12 s) + **Historique**. Le suivi client distingue « en attente d'un livreur » vs « récupérée, en route » via `picked_up_at`.
- ⚠️ **Compte de test** : le compte `techerchristopher@gmail.com` (`9ca91352…`) est lié à **Angelo** (staff restaurant **actif**) **et** a le rôle **livreur actif** (pour tester les deux espaces). À sa connexion il voit l'écran de sélection de rôle. Pour lier un **vrai** compte restaurant : `user_roles(user_id,'restaurant','active',now())` + `restaurant_staff(user_id, restaurant_id)` ; pour un **livreur** : `user_roles(user_id,'livreur','active',now())` (la ligne `couriers` est créée au 1er toggle de disponibilité).
- **Non fait (P2 futur)** : édition menu/horaires depuis l'app, filtrage livreur par zone (`couriers.zone`), stats. Notifications push : **faites** pour les trois publics — client, restaurant, livreur (voir plus bas).

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

## Corrections du retour build 5 + multilingue (2026-08-18, build n°6)

Retour de test TestFlight sur iPhone, 5 points corrigés + 2 chantiers :

- **A1 — Logo du restaurant au panier** : la colonne est **`restaurants.logo_url`** (et non `photo_url`). Le panier mémorise `restaurantLogoUrl` (`app/store/cart.ts`) et l'affiche via `RestaurantLogo` ; repli initiales inchangé.
- **A2 — Grille de chips pour TOUS les groupes d'options** : il n'y avait **aucune condition « single-select »** dans le code — le vrai coupable était la **largeur** des chips (contenu + « + 2 000 Ar » ⇒ une seule par ligne). Corrigé par `flexBasis: '47%'`, libellé et prix empilés, coche hors flux.
- **A3 — Sélecteur d'indicatif pays** (`app/components/PhoneField.tsx`, `app/data/countries.ts`) : drapeau + indicatif, Madagascar par défaut, La Réunion et voisins présents ; placeholder **et** règle de validation dépendants du pays.
- **A4 — Adresse de livraison précise et éditable** : champ « adresse précise » libre avec exemple concret, éditable **après** la géolocalisation. `formatAddressLine` déduplique zone/label — c'est ce qui affichait « Province d'Antsiranana — Province d'Antsiranana » sur les adresses déjà en base, sans migration de données.
- **A5 — Carte native** : l'aperçu précédent n'était **ni un webview ni une lib JS**, mais des **tuiles OSM affichées en `<Image>`**. Remplacé par **`react-native-maps`** (`MapSurface.tsx` = natif, `MapSurface.web.tsx` = repli tuiles, résolution par extension de plateforme Metro : le natif ne part jamais dans le bundle web). ⚠️ **Android exigera une clé Google Maps** (`android.config.googleMaps.apiKey` dans `app.json`) ; iOS utilise MapKit, aucune clé.

### Multilingue FR / EN / IT

- `i18next` + `react-i18next` + `expo-localization`. Tout est dans **`app/lib/i18n.ts`** ; dictionnaires dans **`app/locales/{fr,en,it}.json`** (210 clés, parité vérifiée entre les trois).
- **Français par défaut et langue de repli.** Au 1er lancement on suit la langue du téléphone si elle fait partie des trois. Choix manuel dans **Profil → Langue de l'app** (drapeau + nom), effet immédiat, persisté en AsyncStorage (`taxifood.language`) — donc valable sans compte et conservé après déconnexion. `hydrateLanguage()` est attendu **avant le premier rendu** (`app/app/_layout.tsx`), sinon l'app clignote en français.
- **Périmètre assumé** : tout le **parcours client** + Profil + connexion/rôles + composants partagés sont traduits. Les espaces **restaurant / livreur / admin restent en français** (arbitrage : ce sont des outils internes, le personnel est francophone). Effet de bord accepté : `statusLabel`/`paymentLabel`/`paymentShort` lisent le singleton i18next, donc les badges de statut et libellés de paiement suivent la langue **même** sur les écrans resto/livreur.
- ⚠️ **On ne traduit QUE les libellés d'interface.** Noms de restaurants, de produits, d'options, types de plats (filtre accueil) et motif de refus saisi par le restaurant viennent de la base et s'affichent tels quels.
- Pièges : `closedLabel` était calculé au mapping (`data/api.ts`) donc figé en français — `RestaurantCard` le recalcule maintenant à partir de `opensAt`. Le filtre « Tout » de l'accueil est devenu une sentinelle opaque `'__all__'` (son identifiant ne peut plus servir de libellé).

### Reconnexion des utilisateurs déjà inscrits

- **Diagnostic** : la reconnexion marchait déjà côté Supabase (`verifyOtp` rend bien la session du compte existant). Le bug était en base : le trigger **`handle_new_user` ne recopiait jamais `auth.users.phone` dans `profiles.phone`**. Résultat, `app/index.tsx` voyait `session.phone = null` et renvoyait le client sur l'écran « ton numéro de téléphone » — pour lui redemander le numéro qu'il venait de valider par SMS.
- **Migration `profile_phone_unique_and_otp_phone_sync`** : trigger corrigé (recopie du numéro vérifié), rattrapage des comptes déjà créés, et **index unique partiel `profiles_phone_unique`** sur les seuls chiffres du numéro (`regexp_replace(phone,'[^0-9]','','g')`) — deux profils ne peuvent plus porter le même numéro. Le trigger **ne recopie pas** un numéro déjà pris : la création de compte ne doit jamais échouer sur l'index.
- **App** : `buildSession` retombe sur `user.phone` (numéro déjà vérifié côté Auth) si le profil est vide ; `login-phone.tsx` entre directement dans `/(tabs)` quand la session lue côté serveur porte déjà un numéro, sinon `/` aiguille vers la suite de l'inscription ; `setPhone` traduit la violation `23505` en `PhoneAlreadyUsedError`, affichée proprement sur `app/phone.tsx`.
- **Déconnexion** : déjà présente, Profil → « Se déconnecter » (`app/app/(tabs)/profile.tsx`).
- Contrôles passés en base (transaction annulée) : nouvel inscrit OTP → numéro présent dans `profiles` ✅ · second compte au même numéro → profil créé **sans** numéro, aucune erreur ✅ · écriture directe d'un doublon → refusée par l'index ✅.

## Notifications push (2026-08-18)

**Pourquoi le push et pas le SMS.** Les apps de livraison modernes n'envoient quasiment pas de SMS : le suivi de commande passe en **push** (gratuit, illimité, arrive app fermée), les reçus en **e-mail** (gratuit). Le SMS n'est irremplaçable qu'au seul moment où l'on n'a pas encore d'appareil enregistré : le **code de vérification à l'inscription** — traité à part (voir « OTP par WhatsApp »).

Chaîne complète, sans aucun service tiers payant :

```
app  →  push_tokens          (RPC register_push_token)
orders INSERT / UPDATE  →  triggers orders_notify_new / orders_notify_status  →  pg_net
                        →  Edge Function notify-order  →  API Expo Push  →  APNs / FCM
```

**Trois publics, une seule fonction.** La base dit seulement ce qui vient d'arriver (`event` = `nouvelle` ou `statut`, plus `status` et `picked_up`) ; c'est la fonction Edge qui décide qui prévenir :

| Événement | Prévenu |
|---|---|
| commande créée (`INSERT`, statut `recue`) | le **restaurant** (tout `restaurant_staff` du resto concerné) |
| changement de statut / `picked_up_at` | le **client** |
| passage `en_livraison` **et** `courier_id is null` | en plus, les **livreurs** avec `couriers.is_available = true` |

⚠️ Deux garde-fous à ne pas retirer : une course **déjà attribuée** ne rappelle pas les livreurs, et un livreur **hors service** n'est pas réveillé. Les textes destinés au restaurant et aux livreurs n'existent **qu'en français** (leurs écrans le sont aussi) — le repli `?? set.fr` s'en charge si leur jeton porte une autre langue.

- **Table `push_tokens`** : `token text primary key`, `user_id`, `platform`, `language`, RLS ligne-par-ligne. ⚠️ **La clé primaire est le jeton, pas (user_id, token)** : un appareil = un compte. Si quelqu'un se reconnecte avec un autre compte sur le même téléphone, la ligne **change de propriétaire** au lieu de se dupliquer — sinon l'ancien compte continuerait de recevoir les notifications de commandes d'un autre.
- **RPC** `register_push_token(p_token, p_platform, p_language)` / `unregister_push_token(p_token)` (SECURITY DEFINER). ⚠️ La version à 2 arguments a été **supprimée** en ajoutant `p_language` : PostgREST ne savait pas départager les deux surcharges.
- **Langue portée par le jeton, pas par le profil** : c'est le serveur qui rédige la notification, et le choix de langue vit dans l'AsyncStorage de l'appareil. Un même compte sur deux téléphones réglés différemment reçoit la bonne langue sur chacun. `_layout.tsx` réenregistre le jeton quand `i18n.language` change.
- **Triggers `orders_notify_status`** (`AFTER UPDATE OF status, picked_up_at`) **et `orders_notify_new`** (`AFTER INSERT`), une seule fonction `notify_order_status()` qui branche sur `TG_OP` : appel de l'Edge Function par `net.http_post` (pg_net, asynchrone — la commande n'attend jamais la notification). L'UPDATE écoute **aussi `picked_up_at`** parce que la prise en charge par le livreur ne change pas le statut (`en_livraison` du début à la fin) alors que c'est le moment que le client attend le plus.
- **Secret partagé dans le Vault** (`push_hook_secret`) : `verify_jwt` est désactivé sur la fonction (l'appelant est la base, pas un utilisateur), donc elle vérifie elle-même l'en-tête `x-hook-secret`. Le trigger lit le secret dans le Vault pour l'émettre ; la fonction le relit avec sa clé service_role pour le comparer. Aucune clé en clair, **aucun réglage manuel côté tableau de bord**. `public.push_hook_secret()` n'est exécutable que par `service_role`.
- **Code source** : `supabase/functions/notify-order/index.ts` — **premier répertoire `supabase/` du dépôt**. L'original fait foi ici, pas dans le tableau de bord ; le déploiement se fait par MCP.
- **Textes FR/EN/IT dans la fonction**, volontairement dupliqués des dictionnaires de l'app : le serveur n'a pas accès au bundle. Toute reformulation de `status.*` côté app devrait s'y répercuter. Nom du restaurant et motif d'annulation viennent de la base, **jamais traduits**.
- **Nettoyage automatique** : Expo répond 200 même quand un jeton individuel est mort. Un ticket `DeviceNotRegistered` (app désinstallée) ne guérira jamais → le jeton est supprimé à la volée.
- **App** : `app/lib/push.ts` (enregistrement, ne lève jamais — une notification ratée ne doit pas empêcher de commander), désenregistrement dans `signOut` **avant** `auth.signOut` (la RPC a besoin du jeton d'accès encore valide).
- **Écran ouvert au tap** : décidé **par le serveur** (`data.route`), puisque la même fonction sert trois publics — `/order/[id]`, `/(restaurant)` ou `/(livreur)`. `_layout.tsx` n'ouvre un espace pro **que si le compte porte le rôle ACTIF correspondant** (le jeton suit le compte, pas le rôle) et bascule le `mode` au passage. Repli sur `orderId` seul pour les notifications antérieures restées dans le centre de notifications du téléphone.
- ⚠️ **Rien de tout ça n'est visible sans une build EAS native** : ni Expo Go, ni simulateur, ni web n'obtiennent de jeton (`pushSupported()` renvoie false). Sur iOS, EAS doit détenir une clé APNs (`eas credentials` la provisionne).
- ✅ **Vérifié de bout en bout côté serveur** (jetons de test, base restaurée après) : refus sans secret (403), envoi réel à Expo sur changement de statut, message de prise en charge sur `picked_up_at`, suppression du jeton mort ; puis, pour les trois publics — création → restaurant seul, `en_livraison` sans livreur assigné → client + livreur, avec livreur assigné → client seul, livreur hors service → client seul. Reste à voir sur un vrai téléphone au prochain build.
- ⚠️ **Piège de test** : le compte `techerchristopher@gmail.com` est à la fois client, `restaurant_staff` et `couriers` — un test de destinataires sur ce seul compte ne prouve rien. Utiliser le second compte (`locationscooternosybe@gmail.com`) comme client pur pour distinguer les publics.

## Auth

Trois fournisseurs sont **natifs** depuis le 2026-08-18 (Apple, Google, Facebook) : plus de
redirection navigateur, donc plus jamais le domaine `bmdveawomizjpiebgtkj.supabase.co` visible
à la connexion. Chaque bouton connecte OU inscrit selon que le compte existe déjà — voir la
ligne « Connecte-toi ou crée ton compte en un tap » sur `login.tsx`. Tout est dans
`app/lib/auth.ts`.

- **Apple** — `expo-apple-authentication`, `signInAsync` puis `signInWithIdToken({provider:'apple'})`. Le NOM n'est fourni qu'à la **toute première** connexion, jamais ensuite — recopié dans `profiles` immédiatement, sinon perdu pour de bon. `usesAppleSignIn: true` dans `app.json` (entitlement Apple — nécessite un build **interactif**, voir plus bas). **iOS uniquement, en permanence** — Apple n'exige pas cette option sur Android, aucun équivalent n'existe.
- **Google** — `@react-native-google-signin/google-signin`, `signInWithIdToken({provider:'google'})`. ⚠️ **« Skip nonce check » doit être activé** côté *Authentication → Providers → Google* : les SDK natifs mobiles ne savent pas satisfaire le nonce que Supabase attend par défaut (documenté officiellement par Supabase comme la solution standard pour iOS natif, pas un contournement). **Natif sur iOS ET Android** depuis le 2026-08-19. Trois Client IDs distincts dans Google Cloud, tous dans le même projet (`227662072769` / `taxifoodnosybe`) et tous listés dans *Client IDs* de Supabase : web (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), iOS (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`), Android (`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`). ⚠️ **Le Client ID Android n'est jamais lu par le SDK** (`GoogleSignin.configure` n'a pas de paramètre `androidClientId`) — sur Android, c'est l'**empreinte SHA-1 du keystore de signature** (celui qu'EAS gère, récupérable via `eas credentials --platform android`) qui doit être enregistrée sur ce Client ID dans Google Cloud ; la variable d'env ne sert que de drapeau « configuration faite », comme son équivalent iOS. Testé en conditions réelles sur Android le 2026-08-19 (connexion + position GPS confirmées fonctionnelles par le porteur du projet).
- **Facebook** — `react-native-fbsdk-next` en mode **« Limited Login »** sur iOS : `logInWithPermissions([...], 'limited', nonce)` puis `AuthenticationToken.getAuthenticationTokenIOS()`, dont le JWT part dans `signInWithIdToken({provider:'facebook', token, nonce})`.
  - ⚠️ **C'est bien le Limited Login qu'il faut, pas le flux classique.** `signInWithIdToken` attend un **jeton OIDC signé** (le type `SignInWithIdTokenCredentials` de supabase-js : « OIDC ID token issued by the specified provider »), validé par sa signature. Le jeton d'accès classique de l'API Graph n'est pas un JWT → Supabase répond **« Bad ID token »**. Erreur constatée à l'écran le 2026-08-19 seulement après avoir fait remonter le message brut dans l'UI, les journaux Supabase étant en panne prolongée. Le guide Facebook de Supabase ne mentionne nulle part le Limited Login, ce qui avait envoyé le diagnostic dans la mauvaise direction pendant deux builds.
  - ⚠️ **Le nonce est obligatoire** : le jeton du Limited Login porte toujours un claim `nonce`, et supabase-js impose de fournir la valeur d'origine dès que c'est le cas. Généré via `expo-crypto` et passé des deux côtés (SDK puis Supabase).
  - ⚠️ **Ne pas rétrograder sous la `13.x`** : la 13.0.0 adopte facebook-ios-sdk 17, qui apporte les **privacy manifests** exigés par Apple pour ce SDK depuis mai 2024 — une 12.x risquerait un rejet App Store. Une tentative de pin en 12.2.0 (2026-08-18) reposait sur le diagnostic erroné ci-dessus : inutile, et risquée pour la soumission.
  - Côté Meta : permission `email` à ajouter dans **Use Cases → Authentication and Account Creation** (écran distinct de la config du produit Facebook Login) ; « Allow users without an email » activé côté Supabase en filet de sécurité. ⚠️ Une app déjà autorisée par un compte **ne redemande pas** les nouvelles permissions — il faut la révoquer dans *Facebook → Applications et sites web* pour que le consentement complet réapparaisse.
  - ⚠️ **Sur Android, le Limited Login n'existe pas** — vérifié (doc Meta + rapports de bug Supabase) : c'est une fonctionnalité liée à l'App Tracking Transparency d'Apple, sans équivalent Android. Le SDK Android ne renvoie qu'un jeton d'accès Graph API classique (opaque, pas un JWT), que `signInWithIdToken` ne sait pas vérifier. `facebookNativeAvailable()` (`lib/auth.ts`) est donc **`Platform.OS === 'ios'` en permanence**, pas une limite temporaire. Sur Android, `handleOAuth` bascule automatiquement sur `signInWithOAuth('facebook')` — le flux web classique, déjà générique — sans code supplémentaire. Testé en conditions réelles le 2026-08-19 (`redirectTo` déclenché dans les logs, onglet Chrome ouvert).
- **Téléphone (OTP)**, depuis le 2026-08-17 : écran `app/app/login-phone.tsx`, `signInWithOtp`/`verifyOtp`. Depuis le 2026-08-18 le code part par **WhatsApp**, pas SMS — voir plus bas.
- **E-mail + mot de passe**, depuis le 2026-08-18 : `app/app/login-email.tsx` (connexion + mot de passe oublié) et `app/app/signup.tsx` (création de compte avec nom). Erreurs Supabase traduites en codes métier (`AuthError`), jamais le message anglais brut.
- **Suppression de compte**, depuis le 2026-08-18 : Profil → « Supprimer mon compte », RPC `delete_my_account()` (agit sur `auth.uid()` seul). Les commandes sont **anonymisées**, pas supprimées (`orders.user_id`/`address_id` → NULL) — sinon ça faussait rétroactivement le rapport de clôture et les reversements aux restaurants.
- **Nom du profil** : `app/app/name.tsx`, demandé une seule fois aux comptes **créés par SMS** (l'OTP ne fournit aucun nom). L'aiguillage `app/app/index.tsx` s'appuie sur `session.hasName`, pas sur `fullName` — qui retombe sur « Client » et masquerait le manque.
- **Code de vérification par WhatsApp**, depuis le 2026-08-18 : **aucun fournisseur SMS n'est configuré** (`/otp` répondait `400: Unsupported phone provider`) et le SMS vers Madagascar est facturé à l'unité. Le code passe donc par le **« Send SMS Hook »** de Supabase → Edge Function `send-otp-whatsapp` → WhatsApp Cloud API (quota mensuel gratuit sur les conversations « authentification »). **Rien ne change côté app** : `verifyOtp({ type: 'sms' })` reste correct, `sms` est le nom du canal dans l'API Supabase, pas le transport. Seuls les libellés ont été réécrits (« Code WhatsApp », et l'avertissement que le numéro doit avoir WhatsApp).
  - Sécurité : `verify_jwt` désactivé (l'appelant est Supabase Auth), signature **Standard Webhooks** vérifiée par la fonction elle-même (HMAC-SHA256, comparaison à temps constant, refus au-delà de 5 min → anti-rejeu). Identifiants Meta + secret du hook dans le **Vault**, lus par `whatsapp_hook_config()` réservée à `service_role`. Le code à 6 chiffres n'est **jamais journalisé**.
  - ⚠️ **Inerte tant que les secrets ne sont pas posés** (répond `500 whatsapp not configured`) : il faut une app Meta Business, un numéro WhatsApp Business, un **jeton système permanent** (les temporaires expirent en 24 h) et un **modèle « Authentification » approuvé**. Procédure complète, table de diagnostic des erreurs Meta et SQL de pose des secrets : **[docs/OTP-WHATSAPP.md](docs/OTP-WHATSAPP.md)**.

## Navigation libre (rejet Apple 5.1.1(v), corrigé le 2026-08-22)

**Parcourir Taxi Food ne demande aucun compte.** Restaurants, menus, fiches produit, configurateur d'options, panier : tout est accessible déconnecté. Le compte n'est réclamé qu'au moment de **commander**, parce qu'il faut alors une adresse et un numéro.

C'est un principe, pas un réglage : Apple rejette une app qui met du contenu non personnalisé derrière une inscription. Si un écran de découverte redevient gardé un jour, le rejet reviendra.

- **`app/app/index.tsx`** porte tout l'aiguillage dans une fonction **pure** `destination(session, mode, intent)`, lisible d'un bloc. Pas de session → `/(tabs)`. Les longs commentaires en tête de fichier expliquent chaque garde ; ils valent mieux que ce résumé.
- **La garde est sur le tunnel de commande** (`app/address.tsx`), pas sur les écrans de découverte.
- **`app/store/authIntent.ts`** mémorise en RAM où la personne voulait aller avant de se connecter, pour l'y ramener après. L'intention est **consommée quand elle sert de destination**, jamais avant — sinon on boucle.
- ⚠️ **Le verrou de navigation porte sur la DESTINATION, pas sur un booléen.** Un simple « j'ai déjà navigué » produisait un **écran blanc**, constaté sur appareil : en se déconnectant depuis la sélection de rôle on repasse par `/`, mais expo-router **réutilise l'instance déjà montée** — le booléen valait déjà `true`, l'effet sortait aussitôt, et le `return null` laissait un écran vide sans onglets ni retour.
- ⚠️ **`retourOnglets()` (`app/lib/nav.ts`) et non `router.replace`** pour rentrer dans `(tabs)` : le `replace` empilait un **second** jeu d'onglets par-dessus celui du fond de pile (deux barres d'onglets visibles).
- ⚠️ **Un compte à rôle unique entre DIRECTEMENT dans son espace.** Un employé de restaurant ou un livreur n'a pas de rôle client : lui présenter `/role-select`, dont la carte mise en avant est « Je commande », l'envoyait du mauvais côté. C'est très probablement ce qui aurait provoqué un troisième rejet. On sort de l'espace pro par le bouton `swap_horiz` de l'en-tête (`components/RestaurantHeader.tsx`, `components/CourierHeader.tsx` — **dans `components/`, pas dans les dossiers de routes** : un grep limité aux routes ne les trouve pas).

## Comptes de démonstration (revue Apple)

Trois comptes e-mail + mot de passe, **rôles actifs**, un par public. Identifiants et notes de revue en anglais : **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md) § 4** — à recopier dans *App Review Information* à chaque soumission.

⚠️ **Apple veut vérifier chaque type de compte.** Le rejet 2.1(a) du build 17 vient précisément de là : un seul compte fourni, et des notes de revue qui présentaient les espaces professionnels comme hors périmètre. Le relecteur a demandé le rôle restaurant depuis l'app, l'a obtenu en statut `pending`, et n'a donc rien vu.

⚠️ Ces comptes ont été créés **par l'API Auth**, pas par un `INSERT` SQL. Une ligne `auth.users` insérée en SQL laisse huit colonnes de jetons à `NULL` et GoTrue répond « Database error querying schema » à la connexion. Piège déjà rencontré, ne pas le refaire.

⚠️ `auth.users` **n'a pas de contrainte unique sur `email`** : `ON CONFLICT (email)` échoue. Et la table `user_roles` porte `activated_at`, pas `approved_at`.

## Build de production (EAS) — état

- **Compte Apple Developer actif** (Team « jean christopher techer », `CV2FA6NJ75`) ; certificat de distribution + provisioning profile iOS gérés par EAS (Expo server), valides jusqu'à 08/2027.
- `app/eas.json` : profils `development` (dev client), `preview` (interne), `production` (`distribution: "store"`, `autoIncrement: true` → **chaque build de prod incrémente automatiquement `buildNumber`**, ne jamais le fixer à la main), `simulator` (build iOS pour simulateur, jamais soumis). `appVersionSource: "remote"`.
- Bundle ids : iOS `com.chris97416.taxi-food-nosybe`, Android `com.chris97416.taxifoodnosybe` (Android interdit les tirets). Soumission App Store Connect : `submit.production.ios.ascAppId = "6802418114"`.
- **iOS build 1.0.0 (22) — dernier sorti, envoyé à App Store Connect le 2026-08-23.** Répond aux deux rejets du build 17 : catalogue libre sans compte (5.1.1(v)), trois comptes de démonstration à rôles actifs (2.1(a)), entrée directe dans l'espace pro pour un compte à rôle unique, et le correctif de l'écran blanc à la déconnexion. Le build 17 apportait l'authentification native (Apple/Google/Facebook), la suppression de compte et les correctifs des captures App Store. Historique complet des builds 5 à 22 : [docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md) et [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md).
- ⚠️ **Un build touchant les capabilities Apple (Push, Sign In with Apple) doit être lancé par Christopher lui-même, dans son propre terminal, en interactif** (`eas build -p ios --profile production`, **sans** `--non-interactive`). Lancé depuis un outil sans TTY réel, EAS bascule silencieusement en mode non-interactif et réutilise un profil de provisioning obsolète sans jamais contacter Apple — cause exacte de l'échec des builds 7, 8 et 11. Google et Facebook natifs n'ont besoin d'aucune capability côté portail Apple (juste des schémas d'URL dans Info.plist) : un build non-interactif suffirait pour ces deux-là, mais autant garder le même réflexe partout.
- **Android** : builds `development` testés avec succès le 2026-08-19 (émulateur Pixel 8 local, `eas build --profile development --platform android`) — connexion Google native, Facebook (flux web) et position GPS tous confirmés fonctionnels en conditions réelles. **Jamais buildé en profil `production` à ce jour** : bloqué sur la vérification d'identité du compte développeur Google Play (en cours chez Google). Voir [docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md).

## Ce qui est vérifié vs pas encore

- ✅ Vérifié en web (lectures publiques, sans login) : accueil/filtres/logos/emojis, menu, configurateur d'options + prix temps réel, panier (clé par produit+options), blocage GPS obligatoire + capture (position simulée), `tsc --noEmit`, bundle web.
- ✅ Vérifié côté build iOS : `eas build`/`eas submit` production opérationnels de bout en bout, build 22 **envoyé** le 2026-08-23.
- ✅ Vérifié en navigateur : aiguillage de `destination()` sur les 12 combinaisons de session/rôle/mode, et la déconnexion depuis la sélection de rôle (l'écran blanc ne revient pas).
- ✅ Vérifié en production sur le site : écriture réelle en `waitlist`, refus du `INSERT` direct, limitation de débit non falsifiable, badges chargés et inertes.
- ✅ Vérifié sur appareil réel (iOS, TestFlight) : connexion native Apple/Google/Facebook, suppression de compte, écrans multilingues.
- ✅ Vérifié sur appareil réel (Android, émulateur Pixel 8, 2026-08-19) : connexion Google native, connexion Facebook (flux web), position GPS — testé en conditions réelles, parcours client complet, par le porteur du projet.
- ⏳ **Non testé** : build `production` Android (bloqué sur la vérification de l'appareil physique, voir plus haut) ; parcours restaurant et livreur sur appareil réel, toutes plateformes. **Recette du build 22 sur appareil** : liste dans [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md) — notamment un compte SMS neuf (sans nom ni numéro) qui part de « Commander » et doit arriver sur `/address`, et le bouton Retour après connexion qui doit fermer l'app, pas révéler une seconde barre d'onglets.

## Le site de pré-lancement (`landing/`)

**https://taxifood-nosybe-landing.netlify.app** — site statique, aucun build, aucune dépendance. Déploiement `netlify deploy --prod --dir=landing`. Documentation propre : [landing/LISEZ-MOI.md](landing/LISEZ-MOI.md).

⚠️ **Le domaine `taxifood.rentanoo.com` n'est PAS branché.** Les `canonical` et les `hreflang` pointent déjà dessus : tant que le DNS n'est pas posé, **Google n'indexe rien**. Il faut ajouter le domaine dans Netlify, poser un CNAME `taxifood` → `taxifood-nosybe-landing.netlify.app` chez **Hostinger** (rentanoo.com y est géré, `ns1/ns2.dns-parking.com` ; le site rentanoo lui-même tourne sur Railway), puis en faire le **domaine principal** dans Netlify — sinon les deux adresses se font concurrence.

**Six pages, deux parcours × trois langues.** Client : `/`, `/en/`, `/it/`. Restaurateur : `/restaurants-partenaires/`, `/en/restaurant-partners/`, `/it/ristoranti-partner/`.

⚠️ **Deux pages distinctes, pas un onglet.** La maquette d'origine cachait le contenu restaurateur en `display:none` — invisible pour Google, et pénalisé. Séparer les URL était la seule façon de référencer les deux offres.

- **La maquette Claude Design (`.dc.html`) n'a pas été livrée telle quelle.** Elle chargeait React + Babel standalone depuis unpkg et recompilait le JSX **dans le navigateur** : ~3 Mo de dépendances externes pour une page de contenu. Remplacée par un runtime maison d'environ 120 lignes qui fait des **mises à jour chirurgicales du DOM** — vérifié en navigateur : le champ de saisie conserve son focus et sa valeur à chaque changement d'état, ce que le re-rendu naïf cassait. **16,98 Mo → 207 ko.**
- **Traductions** : `landing/i18n/{fr,en,it}.json`, **304 clés**, parité vérifiée. Rien n'est traduit à la volée : chaque page sert sa langue en dur, avec `hreflang` réciproques + `x-default`.
- **SEO** : JSON-LD en `@graph` (Organization, WebSite, LocalBusiness, FAQPage), Open Graph par langue, images en WebP + `srcset`, `robots.txt` et `sitemap.xml` couvrant les 6 URL.
- **Sécurité** : en-têtes dans `landing/_headers` (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- **Vidéos** (`landing/media/`) : `taxi-food-540.mp4` côté client, `resto-540.mp4` côté restaurateur. **Chargées au clic seulement** — une image fixe WebP légère et un `poster` tiennent la place avant. La liaison de Nosy Be ne pardonne pas un `<video autoplay preload>`.
- **Bloc fondateur** : photo + récit personnel, sur les 6 pages, en 3 langues. Le polo au logo Taxi Food est une image générée ; le logo y est **approximé**, pas le vrai fichier — recomposer le vrai laissait un halo visible.
- **Badges App Store / Google Play** (2026-08-24) : **fichiers rapatriés en local** (deux requêtes externes en moins), localisés par langue, ratio Play/Apple de 1,22. Le badge Apple **français est plus large** (viewBox 126,5 contre 119,7 — « Télécharger dans » est plus long) : une largeur unique décalerait la mise en page. La section sombre `#comment` utilise la déclinaison **blanche** d'Apple, sinon le badge noir disparaît. Pour l'instant `pointer-events:none` + pastille « bientôt disponible ».
  - **Le jour du lancement**, trois gestes : envelopper chaque `<img>` dans un `<a href>` vers la fiche, retirer `pointer-events:none`, supprimer les pastilles.
  - ⚠️ Les **licences d'usage** (Apple *Marketing Resources*, formulaire partenaire Google) restent à accepter par le porteur du projet.

### Liste d'attente

Le formulaire écrit réellement en base (`waitlist`), vérifié en soumettant le formulaire en production puis en relisant la ligne.

- ⚠️ **L'écriture directe en table est fermée.** Elle passe par des RPC `SECURITY DEFINER`. Une fois les RPC en place, le `INSERT` direct était **resté ouvert** — un oubli classique : ajouter la porte propre ne ferme pas l'ancienne. Le POST répond désormais 401 (`42501`), la RPC 204.
- ⚠️ **La limitation de débit lisait la MAUVAISE valeur de `x-forwarded-for`.** Elle prenait la **première**, que le client contrôle : il suffisait d'envoyer une fausse IP à chaque requête pour ne jamais être limité. Elle lit maintenant la **dernière** (celle posée par le proxy). Vérifié : 7 requêtes avec 7 fausses IP, bloquées dès la 4ᵉ.
- ⚠️ **La normalisation des téléphones laissait passer des doublons** : `+261 34 11 111 11` et `0261341111111` donnaient deux clés différentes. `normaliser_telephone()` traite le préfixe `00`, le `0` national et la forme à 9 chiffres. L'index unique a **refusé de se construire** tant que les doublons de test n'étaient pas purgés — ce qui prouve la correction.

## Conventions

- Dépôt git **isolé** dans `taxi-food-nosybe/`. GitHub : https://github.com/techerchristopher-dotcom/taxi-food-nosybe . **Commit + push (HTTPS, pas SSH) après chaque étape.**
- ⚠️ **Ne jamais committer depuis un répertoire parent.** `/Users/christopher` est lui-même couvert par un dépôt git : un `git add` lancé d'un cran au-dessus embarque le home entier.
- ⚠️ **Secrets.** `app/.env` est git-ignoré et doit le rester. La clé **anon/publishable** y est publique par conception (la RLS protège) ; la clé **`service_role` n'y a jamais sa place**. Les identifiants Meta/WhatsApp et l'App Secret Facebook ne transitent pas par la conversation — ils vont dans le Vault Supabase. Une clé privée Firebase a déjà traîné dans le dépôt (commit `84fe5c9`) : `.gitignore` couvre désormais `*firebase-adminsdk*.json`.
- ⚠️ **La base Supabase est la base de PRODUCTION.** Pas de bac à sable. Tout test à effet de bord se fait dans une transaction annulée, et les lignes de test se nettoient.
- ⚠️ **Avancer point par point.** Consigne explicite du porteur du projet : vérifier chaque correctif isolément avant de passer au suivant, plutôt que d'empiler les changements et de tout casser d'un coup.
- Après toute migration touchant le schéma : penser à régénérer les types si un fichier `db-types` est réintroduit (actuellement les types sont mappés à la main dans `app/data/api.ts`).
- ⚠️ **Tester une RPC à effet de bord en SQL** : utiliser `select * from create_order(...)` (une seule évaluation). **Jamais `select (create_order(...)).*`** : l'expansion `.*` d'un type composite évalue la fonction **une fois par colonne** → autant d'insertions parasites. Et pour reproduire un souci RLS, tester sous `set local role authenticated` + `set_config('request.jwt.claims', ...)` dans une transaction annulée — sinon on tourne en superuser et la RLS est ignorée (le bug reste invisible).
- ⚠️ **`revoke ... from public` ne retire PAS `anon` / `authenticated`.** Supabase pose un `ALTER DEFAULT PRIVILEGES` qui accorde `EXECUTE` à ces deux **rôles nommés** sur **toute** fonction nouvellement créée dans `public`. `PUBLIC` est une notion distincte : le révoquer laisse les grants nommés intacts. Pour verrouiller une fonction interne, révoquer **explicitement** chaque rôle *et* `public` séparément, puis vérifier dans `pg_proc.proacl` (`=X/postgres` = grant PUBLIC résiduel).
- ⚠️ **Une fonction trigger n'a pas besoin du droit `EXECUTE` pour se déclencher** : PostgreSQL le vérifie **au `CREATE TRIGGER`**, pas à chaque tir. Révoquer `EXECUTE` sur une fonction trigger la retire de l'API REST sans casser le trigger (vérifié expérimentalement sur `notify_order_status`).
- 💡 **Lire le résultat d'un test SQL par MCP** : `RAISE NOTICE` n'est pas remonté par `execute_sql`. Accumuler le résultat dans une variable `text` puis `raise exception 'RESULTAT >>> %', v_out` — ça affiche **et** annule la transaction, donc le test ne laisse aucune trace.
- 💡 **Diagnostiquer un flux d'auth natif (Apple/Google/Facebook) sans les logs** : `query_logs` sur `auth_logs` a connu des pannes prolongées côté Supabase (« Backend error », service entier indisponible, pas juste cette table). En repli : interroger directement `auth.users` / `auth.identities` (`created_at`, `last_sign_in_at`) — ça dit si une tentative a **atteint** Supabase et créé quelque chose, ce qui suffit souvent à localiser le problème (avant vs après l'échange avec le fournisseur) sans avoir besoin du message d'erreur exact.
- 💡 **`npx expo install` ajoute les plugins natifs SANS leurs options.** Vérifié deux fois le 2026-08-18 (`@react-native-google-signin/google-signin` et `react-native-fbsdk-next`) : l'entrée nue route vers une branche de config différente (souvent Firebase) qui exige un fichier absent et **fait échouer la compilation native**. Toujours lire le code du plugin (`node_modules/<pkg>/plugin/`) avant de laisser l'entrée telle quelle, et lui donner ses options explicitement.
- ⚠️ **Les prix et les contenus produits viennent de la base** : jamais traduits, jamais écrits en dur, ni dans l'app, ni sur le site.
- Documentation en français.
- Docs de référence : `CAHIER-DES-CHARGES-MVP.md`, `SCHEMA-TAXI-FOOD.md`, `PROMPT_BUILD_APP_CLIENT.md`.
