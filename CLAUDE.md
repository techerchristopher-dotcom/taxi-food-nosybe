# Taxi Food — Livraison de repas (Nosy Be)

Marketplace de livraison de repas à Nosy Be. **App cliente construite et fonctionnelle**, branchée sur le vrai backend Supabase, avec trois **vrais restaurants** (Angelo, Taxi Be, La Cabane). Branche de travail : `main`.

Trois livrables distincts, à ne pas confondre :

| | Quoi | Où |
|---|---|---|
| **`app/`** | l'application mobile (Expo, iOS + Android) | **en ligne sur l'App Store**, déposée sur le Play Store |
| **`admin/`** | le tableau de bord de gestion (Next.js, web) | `taxi-food-admin-nosybe.netlify.app` |
| **`landing/`** | le site de **pré-lancement**, trilingue | **`taxifoodnosybe.distripro207.com`** |

## Où en est la soumission

**iOS — ⏳ 1.2.0 (28) EN VÉRIFICATION CHEZ APPLE**, envoyée le **2026-09-07 à 23 h 09**
depuis App Store Connect. Apple annonce jusqu'à 48 h. La 1.1.0 reste en ligne pendant ce
temps.

⚠️ **Les builds 26 et 27 sont des échecs, pas des versions** : le profil de provisioning
n'avait pas encore l'entitlement Apple Pay. Détail et remède dans `docs/PAIEMENT-STRIPE.md`
§ 12 — et la règle à retenir : **`eas build --non-interactive` ne régénère JAMAIS le profil**
après un changement de capacité Apple, il réutilise celui en cache et échoue à l'identique.

⚠️ **Ce qui a changé dans la fiche produit, et qui n'est pas anodin.** La déclaration de
confidentialité a gagné un 9ᵉ type de données : **Informations de paiement**
(*Fonctionnalité de l'app*, lié à l'identité, pas de suivi), parce que la carte se saisit
désormais dans la feuille Stripe **à l'intérieur de l'app**. Apple affiche une exemption qui
ne s'applique PAS ici — le raisonnement complet, à ressortir si c'est contesté, est dans
`docs/FICHE-APP-STORE.md` § 8.

⚠️ **Changer de build oblige à retirer la version de la vérification**, donc à repartir en
bas de la file. Les textes, eux, restent modifiables pendant l'attente.

⚠️ **À défaire dès qu'Apple valide** : les réglages posés pour le relecteur (restaurants
ouverts en permanence, Taxi Be rendu visible et renvoyé sur le Telegram du porteur du
projet). Tableau dans `docs/FICHE-APP-STORE.md` § 7. Les laisser en l'état fait de vrais
dégâts en exploitation.

**Historique.** La **1.0.0 (22)** est passée le 2026-08-24, après **deux rejets** du build 17 :

1. **Guideline 5.1.1(v)** — « the app requires users to register before viewing the menu ». L'app s'ouvrait sur l'écran de connexion. Corrigé : le catalogue est désormais libre, voir la section « Navigation libre » plus bas. C'est le changement de comportement le plus important de tout le projet.
2. **Guideline 2.1(a)** — « we cannot access the Restaurant and Courier accounts ». Un seul compte de démo était fourni, et les notes disaient que les espaces pro étaient hors périmètre. **Apple veut vérifier CHAQUE type de compte.** Trois comptes actifs sont maintenant fournis.

⚠️ Le relecteur teste sur **iPad** (iPad Air 11-inch M3 sur les deux revues), en mode compatibilité iPhone puisque `supportsTablet: false`. Il a aussi passé de **vraies commandes** chez Angelo (TF-47, TF-48, depuis une adresse Apple private relay) : pendant une revue, quelqu'un doit pouvoir traiter une commande qui arrive, sinon le parcours paraît cassé.

**Android — ✅ PUBLIÉE SUR LE PLAY STORE le 2026-09-08.** Constaté moi-même en console,
pas rapporté : *« Last published on September 8, 2026 »*, plus aucun bloc « Changes in
review », et la fiche répond **HTTP 200** :
`https://play.google.com/store/apps/details?id=com.chris97416.taxifoodnosybe`

**La revue a duré 7 jours** (déposée le 1er septembre à 2 h 13). C'est la normale pour un
**premier** passage : le dossier complet part en examen manuel — classification du contenu,
sécurité des données, public cible 18 ans et plus, déclaration publicitaire, applications
gouvernementales et **fonctionnalités financières**, cette dernière étant la plus lente.

⚠️ **Ne pas s'alarmer avant 7 jours** la prochaine fois, et **ne rien modifier pendant** :
toucher un élément du dossier remet le compteur à zéro. Au-delà de 7 jours, le levier utile
est *Aide → Contacter l'assistance* dans la console, bien plus efficace que d'attendre.

⚠️ **Ce qui est publié aujourd'hui, c'est encore la 1.1.0 (build 4)** — sans paiement par
carte, sans les deux services par jour, sans le partage social, sans l'offre du jour.
**La 1.2.0 (build 5) a été testée en interne le 2026-09-08** (paiement carte confirmé,
Google Pay affiche son bouton mais reste bloqué par `OR_BIBED_11` tant que l'accès
production Google Pay n'est pas approuvé — voir `docs/PAIEMENT-STRIPE.md` § 12-13), puis
**envoyée en production le même jour** (« Promote release », sans re-téléverser le
fichier). Statut au moment d'écrire : *Changes in review*, jusqu'à 7 jours annoncés.

⚠️ **La règle des 12 testeurs ne s'applique pas, la question est close.** Le compte est un
**compte d'organisation** (vu en console : « Organization account », ID
`6682410097385681985`), pas un compte personnel. Ne plus la reposer.

⚠️ **Classement IARC** — Global Rating ID `e3a3d6e9-5f88-8f8f-8ef0-3f8d89a9dc4b`, mis en
ligne le 2026-09-08 en même temps que l'app. Le réutiliser tel quel sur tout autre magasin
ayant licencié IARC (Amazon, Galaxy Store) évite de refaire le questionnaire. ⚠️ Une version
qui **changerait les réponses** au questionnaire oblige à le repasser — à surveiller au dépôt
de la 1.2.0, même si vendre des repas livrés ne devrait rien changer (le questionnaire porte
sur le **contenu numérique**).

Toute la chaîne technique était prête et testée en conditions réelles le 2026-08-19 (Google
natif, Facebook en flux web, clé Maps, notifications FCM). Compte Google Play créé,
**identité vérifiée**, appareil Android physique disponible depuis le 2026-08-24.

### Les deux empreintes Android — ne jamais les confondre

| | SHA-256 | À quoi ça sert |
|---|---|---|
| **Clé de signature Google** (Play App Signing) | `9E:83:EC:47:51:33:B9:01:63:15:63:25:6D:E0:AD:55:DE:EF:FE:81:00:1D:F3:5C:7D:94:7B:AE:BB:CA:8C:74` | **C'est celle-ci** qu'il faut dans `assetlinks.json` |
| **Clé de dépôt** (EAS, keystore `Default`) | `02:05:17:F9:C3:DD:6E:15:1F:20:08:EC:C6:9E:85:9A:41:77:68:1A:DA:20:26:6A:FB:D4:10:9E:93:95:03:D4` | Signe l'AAB envoyé à Google, rien d'autre |

Google **re-signe** l'app avec sa propre clé après le dépôt : c'est donc la sienne que le
téléphone vérifie quand il décide d'ouvrir un lien `https://` dans l'app plutôt que dans le
navigateur. Mettre l'empreinte EAS ferait silencieusement tomber **tous** les liens partagés
dans le navigateur, et le symptôme est pénible à diagnostiquer (rien n'échoue, ça marche
« presque »). `assetlinks.json` acceptant plusieurs empreintes, on met **les deux**.

⚠️ **Utile à savoir** : la clé de signature Google est générée dès le **premier** dépôt d'un
bundle, pas à la validation — son empreinte est donc récupérable sans rien attendre.
Où la retrouver : **Play Console → Protected with Play → App signing**. La page affiche
même le `assetlinks.json` déjà rempli, prêt à copier. Package Android :
`com.chris97416.taxifoodnosybe`, identifiant d'app Play `4972795001003481903`.

✅ **Règle Google des testeurs — POINT TRANCHÉ le 2026-09-07.** Le compte est bien un
**compte d'organisation** (« Organization account », vu en clair en Play Console,
identifiant `6682410097385681985`). L'obligation de test fermé avec des testeurs pendant
14 jours continus ne vise que les comptes **personnels** créés après le 13 novembre 2023 :
elle **ne s'applique donc pas ici**. La conversion envisagée a bien été faite. Ce doute est
clos, ne plus le rouvrir.

⚠️ Le tableau de bord affiche quand même un parcours guidé « SET UP YOUR CLOSED TEST TRACK »
avec *Select testers* non coché. **Ce n'est pas un blocage** : c'est le fil d'accueil
générique de Play Console, et la production est déjà partie en revue à côté. Ne pas s'y
laisser prendre. Procédure : [docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md).

⚠️ **Cinq documents à tenir à jour, à lire avant de commencer quoi que ce soit :**

- **[docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md)** — ce qui est écrit mais pas encore compilé, et la recette à passer sur appareil avant l'envoi. Décision du 2026-08-18 : on empile les chantiers et on ne fait **qu'un seul gros build**, la liaison de Nosy Be rendant chaque envoi coûteux. À vider après chaque build.
- **[docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md)** — audit de conformité iOS, bloquant par bloquant.
- **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md)** — textes de la fiche, questionnaire App Privacy, classement d'âge, **et les notes de revue à coller** (§ 4, rédigées en anglais).
- **[docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md)** — état des lieux Android : ce qui est fait, ce qui est bloqué par du code, et ce qui l'est par un compte externe que seul le porteur du projet peut créer.
- **[docs/ONBOARDING-RESTAURATEUR.md](docs/ONBOARDING-RESTAURATEUR.md)** — **la procédure à rejouer telle quelle à chaque nouveau restaurant** : pré-autoriser l'adresse, créer le compte à la place du restaurateur (impossible en SQL — sas Edge temporaire, refermé aussitôt), vérifier le rattachement, brancher Telegram, et **finir par le message copier-coller à lui envoyer, avec le lien, l'adresse e-mail et le mot de passe**. ⚠️ Cette dernière étape est le livrable : un compte créé et non communiqué ne sert à rien. La création de la carte et des visuels, elle, est dans [docs/PARTENAIRES.md](docs/PARTENAIRES.md).

## Lancer l'app en local

```bash
npm run dev --prefix app        # équiv. `cd app && npx expo start`
npx expo start --web --port 8081 --prefix app   # aperçu web direct
```

⚠️ **Expo Go NE MARCHE PAS** : le projet est en **Expo SDK 57** (RN 0.86, React 19.2), plus récent que ce qu'Expo Go du store embarque → « projet incompatible ». Pour tester sur téléphone, il faut une **build de dev EAS** (voir `app/eas.json`), pas Expo Go.

⚠️ **`expo run:ios` : forcer la locale UTF-8.** Quand un nouveau module natif est ajouté, `pod install` se relance et CocoaPods plante sur `Unicode Normalization not appropriate for ASCII-8BIT` : Ruby lit le chemin du projet en binaire quand `LANG`/`LC_ALL` sont vides, ce qui est le cas par défaut dans un shell non interactif. Le piège est déroutant parce que le build ne casse **qu'à l'ajout d'une dépendance native**, jamais sur un rebuild ordinaire (les Pods déjà installés ne sont pas retouchés). Remède :

```bash
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device <udid>
```

- **Web** (aperçu rapide) : `http://localhost:8081`. L'accueil **est libre depuis le 2026-08-22** (voir « Navigation libre ») : on arrive directement sur le catalogue, sans compte.
- Comptes de démonstration : trois, créés pour la revue Apple — voir « Comptes de démonstration » plus bas.

## Stack & backend

- **Expo SDK 57** + expo-router (navigation par fichiers) + **zustand** (panier/checkout/session) + AsyncStorage.
- **Supabase** projet `bmdveawomizjpiebgtkj` (accès via le connecteur MCP claude.ai ; c'est un projet distinct des autres — voir aussi le projet frère `addition-appli`).
- **Clés** dans `app/.env` (git-ignoré, à recréer depuis `app/.env.example`) : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (clé **publishable/anon**, publique par conception — RLS protège), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.

## Les vrais restaurants

État vérifié en base le 2026-09-07 : **cinq** lignes dans `restaurants`, dont trois seulement
sont `listing_status = 'visible'`. Le titre de cette section disait « les trois vrais
restaurants » ; c'est daté.

- **Chez Bidul & Truc** (`700e8f32-…`) — **visible**, et le seul en `auto_open = true` : son
  ouverture est déduite de ses horaires, pas d'un interrupteur. Deux services par jour, midi et
  soir, et une catégorie « Pizza » servie de 18 h à 22 h seulement — c'est lui qui a fait naître
  tout le chantier « heures de service » plus bas. Enseigne, logo et visuels branchés depuis
  `produits/chez-bidul-truc/divers`. ⚠️ **Sa couverture est un HEIC**, photo iPhone déposée
  telle quelle : Chrome et Android ne savent pas l'afficher, Safari si. Elle passe côté client
  parce que la fiche restaurant appelle `imageUrl()`, qui réécrit vers le **transformateur
  d'images Supabase** et rend un `image/jpeg`. `PhotoEditable`, dans l'écran Réglages du
  partenaire, affichait l'URL **brute** : le restaurateur voyait un cadre vide sur Android que
  ses clients, eux, ne voyaient pas. Corrigé le 2026-09-07 — tout passe par le transformateur.
- **La Cabane** — snacks. ⚠️ Son `chat_id` Telegram était celui du téléphone du porteur du
  projet, posé pendant les tests : **ses commandes nous arrivaient à nous**. Remplacé le
  2026-09-06 par son canal privé, message de contrôle et commande de test remis. La commande de
  test n'est pas une formalité : c'est elle qui a rattrapé le bug de la commande vide.
- **Les Siciliens** — visible.
- **Angelo** — `listing_status = 'hidden'`. Voir sa carte en base pour le détail des catégories.
- **Taxi Be** — `coming_soon`. Bar & pizzeria (Pizza, Tapas, Bières, Cocktails, Softs). ⚠️ Les 6 cocktails sont désactivés depuis le 2026-08-19 (`categories.is_active = false`, décision classement d'âge — voir `docs/FICHE-APP-STORE.md` § 3), les 19 bières restent.

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
- RPC **`create_order`** (**SECURITY DEFINER**) : atomique, valide les options (appartenance produit, dispo, quotas min/max, groupes requis), **recalcule `unit_price` = price + Σ price_delta** (le client n'envoie jamais de prix), lit **elle-même** `restaurants.delivery_fee`, applique le code promo éventuel, génère `order_number` (`TF-…`), et **vérifie que l'adresse a lat/lng** (exception sinon). La fonction fixe elle-même `user_id = auth.uid()` et exige que l'adresse appartienne à l'appelant → elle n'écrit jamais pour autrui, DEFINER est sûr.
  - ⚠️ **Elle existe en DEUX signatures, et pas une de plus** : l'implémentation à **5 arguments** (`…, p_code_promo text`) et une **enveloppe à 4 arguments** typée `payment_method`, que les versions déjà installées sur les magasins appellent. **Ne jamais recréer `create_order` en changeant le type d'un paramètre** : `create or replace` n'écrase pas, il *ajoute* une surcharge, et PostgREST répond alors `PGRST203 « Could not choose the best candidate function »` — plus aucune commande ne passe. C'est exactement ce qui s'est produit le 2026-09-05 (migration « adresse introuvable », `payment_method` → `text`) et qui est resté invisible jusqu'au 2026-09-06 faute de commande passée entre-temps.
  - ⚠️ **Pourquoi DEFINER et pas INVOKER** : la fonction fait un `UPDATE orders SET subtotal/total` après avoir inséré les lignes. `orders` n'a **volontairement aucune politique RLS UPDATE** (un client ne doit pas pouvoir modifier ses commandes via l'API REST). En INVOKER, cet UPDATE touchait **0 ligne** sous RLS → `returning into v_order` = NULL → la fonction renvoyait NULL et laissait `total = frais de livraison` (bug corrigé le 2026-08-14 : montant 0 en confirmation, « commande introuvable », total faux). DEFINER exécute les écritures hors RLS. **Ne pas repasser en INVOKER sans supprimer l'UPDATE final.**

## Multi-rôle & espace restaurant

Un même compte Google peut être **client** et/ou **restaurant** (et **livreur** en Phase 3).

- **Base** : enums `app_role` {client,restaurant,livreur} / `role_status` {pending,active,revoked} ; tables `user_roles`, `restaurant_staff` (lie un compte à un `restaurants.id`), `couriers`. RPC `request_role(p_role)` : `client` → `active` immédiat ; `restaurant`/`livreur` → `pending` jusqu'à validation **manuelle** (toi, en base).
- **Helpers rôle** (SECURITY DEFINER) : `is_active_restaurant_staff_of(rid)`, `current_restaurant_id()`. Un « restaurant actif » = rôle restaurant `active` **ET** lien `restaurant_staff`.
- **RLS restaurant** : policies SELECT additives sur `orders`/`order_items`/`order_item_options` → le staff voit les commandes de **son** restaurant (les policies client, par `user_id`, restent inchangées).
- **Transitions de statut** : RPC **`set_order_status(order_id, new_status, reason)`** (SECURITY DEFINER, comme `create_order` — aucune policy UPDATE ouverte sur `orders`). Vérifie l'appartenance au restaurant et n'autorise que les transitions valides : `recue→confirmee|annulee`, `confirmee→en_preparation|annulee`, `en_preparation→en_livraison`. `annulee` exige un motif (stocké dans `orders.cancellation_reason`, visible côté client).
- **Routage app** (`app/index.tsx`, corrigé le 2026-09-06) : **un rôle pro ACTIF est une décision d'administrateur, un rôle client n'est qu'un tap.** L'aiguillage lit, dans cet ordre, le `mode` persisté (AsyncStorage `tf_mode`), puis les rôles **pro actifs seuls** — le rôle client n'est plus lu du tout, il ne donne aucun droit. Un restaurant ou un livreur actif entre donc DIRECTEMENT dans son espace même s'il porte aussi un rôle client, et sans passer par `/phone` ; `role-select` est réservé au seul cas restaurant **et** livreur actifs. Le mode déduit des rôles est écrit, pas seulement calculé. On sort de l'espace pro par le bouton **« ↔ App client »** de l'en-tête (qui POSE `mode = 'client'`), on y revient par **Profil → « Mon espace partenaire »**. Voir « Navigation libre » et `docs/EN-ATTENTE-DE-BUILD.md` § « Un partenaire arrive dans SON espace ». Espace restaurant = groupe de routes `app/(restaurant)/` : 4 onglets **Commandes en cours** (polling 12 s, badge du nb de commandes en attente d'action via le store `restaurantQueue`) · **En livraison** (`en_livraison`, lecture seule) · **Historique** (`livree`/`annulee`) · **Réglages** (logo, couverture, téléphone public, ouverture, horaires, plats à l'affiche, ruptures). Chaque écran monte `RestaurantHeader`, qui porte le badge **« Espace partenaire »**. Le suivi client affiche l'état **refusée + motif**. ⚠️ **La RLS ne sépare RIEN toute seule, et ça vaut dans LES DEUX SENS.** `orders` porte quatre policies SELECT permissives (propriétaire, staff du restaurant, livreur, admin) qui se cumulent en OU ; `addresses` en porte trois. Chaque écran filtre donc explicitement : côté pro par `restaurant_id` / `courier_id` (`listRestaurantOrders`, `listMyActiveDeliveries`), **et côté client par `user_id`** (`listOrders`, `listAddresses`). Le sens client manquait : corrigé le 2026-09-06 après vérification avec de vrais jetons — l'onglet **Commandes** du parcours client renvoyait 4 lignes à `demo.resto` et 5 à `demo.livreur`, **aucune n'étant la leur** (les commandes de leurs clients, nom, téléphone et adresse joints), et le Profil listait 2 adresses de clients comme « adresses enregistrées ». C'était latent depuis toujours, mais le bouton « App client » a mis cet écran à UN tap d'un partenaire.
- **Visite guidée de l'espace partenaire** (2026-09-06) — 5 étapes jouées **à la première entrée** dans l'espace restaurant, rejouables par **Réglages → « Découvrir votre espace »** : Commandes (avec une **commande d'exemple**) · En livraison · Historique · Réglages · le bouton « App client ». `components/VisiteGuidee.tsx` ; les cibles se signalent elles-mêmes via `components/ZoneVisite.tsx` + `store/visiteGuidee.ts` (la barre d'onglets et l'en-tête ne sont pas dessinés par l'écran qui joue la visite). Quatre règles à ne pas casser :
  - ⚠️ **Le repère ne masque JAMAIS sa cible** : voile en **quatre bandes autour**, contour fin, bulle **à côté**. Pas d'aplat par-dessus (erreur déjà commise sur le guide restaurateur du site vitrine).
  - ⚠️ **Le panneau « Exemple » est ÉPINGLÉ hors du `ScrollView` de la carte.** Sur 667 pt (iPhone SE/8, et le mode compatibilité iPhone du relecteur Apple) la carte d'exemple déborde et il faut défiler pour atteindre « Refuser »/« Accepter ». Tant que la légende défilait avec elle, ce geste la chassait de l'écran : il restait une commande #TF-000 d'apparence réelle, sans son démenti. Ne jamais la remettre dans le contenu défilant. C'est aussi la seule carte de l'app où `showsVerticalScrollIndicator` est **vrai**.
  - ⚠️ **Fermer la visite mémorise à TOUTE étape — et l'écran doit le dire.** La case « Ne plus afficher » n'existe qu'à l'étape 5 ; sa seule présence enseigne « je ferme sans cocher, donc elle reviendra ». Une ligne (`visitePro.fermerNote`) est donc affichée sur les étapes **1 à 4 seulement** et donne le chemin de repêchage, avec le libellé **interpolé** depuis `visitePro.revoirTitre`. Ne pas afficher les deux ensemble : la bulle dépasserait sa hauteur éprouvée.
  - ⚠️ **La commande d'exemple n'existe pas en base** — objet en mémoire rendu par le vrai `RestaurantOrderCard`, badge « Exemple ». En créer une vraie polluerait rapport journalier et commissions et déclencherait e-mail + Telegram + push. Ses frais de livraison sont **lus** dans `restaurants.delivery_fee`, jamais écrits en dur.
  - ⚠️ **N'annoncer que ce qui existe, AVEC LES MOTS DE L'ÉCRAN** — une promesse fausse envoie le restaurateur chercher un bouton absent. Trois pièges déjà payés (revue de vérité du 2026-09-06) : (a) **vocabulaire** — l'écran Réglages écrit « Couverture » et « À l'affiche », pas « devanture » ni « plat du jour » ; et contrairement à ce qui était écrit ici, `save_featured_product` **crée bien un plat avec son prix** (en `in_menu = false` : il vit à l'affiche, pas dans la carte permanente), et le **prix d'un plat de la carte devient modifiable** dès qu'il est étoilé, puisqu'il rejoint « À l'affiche » et son bouton « Modifier » ; (b) **libellés cités** — toujours interpolés depuis la clé réellement rendue (`{{lien}}` ← `profile.proRestaurantLabel`), jamais recopiés : l'anglais et l'italien renvoyaient vers un « My partner space » qui n'existe pas ; (c) **ce qui n'est vrai qu'ensuite** — une commande entre dans « En livraison » dès qu'elle est marquée prête, donc **avant** qu'un livreur l'ait prise.
  - ⚠️ **La préférence est en BASE** (`profiles.visite_pro_vue_le`, écrite par la RPC `marquer_visite_pro_vue(p_vue boolean)` SECURITY DEFINER), pas en AsyncStorage : elle suit la personne, pas l'appareil. Fermer la visite en cours de route la mémorise aussi — elle ne doit pas se represser un soir de service.
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

## Paiement par carte (Stripe) — 2026-09-06

**Document de référence complet : [docs/PAIEMENT-STRIPE.md](docs/PAIEMENT-STRIPE.md).**
Ce qu'il faut savoir sans l'ouvrir :

- ⚠️ **LE CANAL CARTE EST OUVERT.** `payment_config.carte_active` vaut **`true`** depuis le
  2026-09-06 07 h 39, et le compte Stripe est en mode **RÉEL** : TF-96 a encaissé 3,41 € pour de
  bon. Ce paragraphe annonçait le contraire — il datait d'avant l'ouverture. Arrêt d'urgence,
  sans déploiement : `select public.admin_set_carte_active(false);` en tant qu'admin ; les
  espèces continuent de fonctionner. Tant que l'interrupteur est faux, l'option carte
  **n'apparaît pas** sur l'écran de validation (absente, pas grisée) et `creer-paiement` refuse
  avant tout appel à Stripe.
- ✅ **Une commande carte annulée demande et envoie son remboursement toute seule.** Trigger sur
  `orders` (et son miroir sur une capture tardive) → `payment_refunds` → fonction Edge
  **`rembourser-paiement`** → Stripe. Le montant rendu est celui des **euros réellement
  débités** (`payment_intents.amount_minor`), jamais une reconversion de l'ariary au taux du
  jour. Un paiement jamais capturé est **annulé** (gratuit), pas remboursé. Détail, recette et
  limites : `docs/PAIEMENT-STRIPE.md` § 8.
- ✅ **Un remboursement se déclenche aussi à la main, et le client en est prévenu.** Cinquième
  onglet **Remboursements** du tableau de bord admin : montant modifiable (un plat manquant
  n'est pas une commande annulée), motif obligatoire, double confirmation, et le rappel que
  **Stripe ne rend pas ses frais**. Côté client, le trigger `notifier_remboursement()` sur
  `payment_refunds` envoie l'e-mail dès qu'un remboursement passe à `effectue` — jamais sur
  `demande`, `echoue` ni `sans_objet`. ⚠️ **Le workflow n8n reste à réimporter sur
  l'instance** : tant que ce n'est pas fait, un remboursement réussi envoie au client un
  **second e-mail d'annulation** (l'ancien nœud Code retombe sur `cmd.statut`, qui vaut
  `annulee`) **et repousse un message Telegram d'annulation au restaurant** — vérifié dans le
  nœud de `HEAD~1`, qui émet vers Telegram sur `cle === 'annulee'`.
- ⚠️ **La liste des remboursables part des `payment_intents` capturés, jamais de
  `payment_method`.** Une commande peut porter « carte » sans qu'un centime ait été pris, et
  `basculer_en_especes()` peut la repasser en espèces alors qu'un paiement vit encore.
- ⚠️ **RIEN NE RÉESSAIE TOUT SEUL.** `pg_cron` n'est pas installé sur ce projet et `pg_net`
  n'émet qu'une fois : si Stripe est injoignable au moment de l'annulation, la demande reste
  en `demande` avec son motif dans `erreur`, et **elle y reste**. Elle bloque au passage tout
  autre remboursement sur le même paiement (index unique partiel). Le réveil est un geste
  humain : bouton **« Relancer les envois »** de l'onglet Remboursements, ou
  `select public.relancer_remboursements_en_attente();`. ⚠️ Cet appel SQL **levait
  « Reserve aux administrateurs » jusqu'à la migration `20260906113000`** — `is_admin()` lit
  `auth.uid()`, NULL sur une connexion directe — donc le filet de sécurité n'avait jamais pu
  servir.
- **« Ce client a-t-il été remboursé ? » se répond en une requête** :
  `select * from public.suivi_remboursements where commande = 'TF-96';` — une ligne par
  paiement encaissé, colonne `ou_en_est` en français, et `a_regarder` pour le balayage du soir.
  `rapport_remboursements` agrège par jour et par restaurant : elle compte, elle ne montre pas.
- **Les prix restent en ariary, le débit se fait en euros** à un taux **fixe** lu dans
  `payment_config.fx_ar_per_eur` (4 700 Ar = 1 EUR). Jamais une constante dans le code.
  L'écran de validation ET l'écran de paiement affichent le total en ariary, le montant exact
  en euros et le taux — c'est une exigence de revue Apple, pas une politesse.
- ⚠️ **L'app ne décide JAMAIS qu'une commande est payée.** `presentPaymentSheet()` sans erreur
  veut dire « le client a confirmé sur son appareil », rien de plus. Le verdict est
  `orders.payment_status`, écrit par un trigger à partir des lignes que seul le webhook Stripe
  (signature vérifiée côté serveur) modifie.
- ⚠️ **`components/paiement/FormulaireCarte.web.tsx` n'est pas cosmétique.** Stripe ne supporte
  pas le web avec le SDK React Native. Sans ce jumeau, `expo export --platform web` embarquerait
  le module natif et casserait taxifood.distripro207.com. Le SDK natif n'est importé qu'à **un**
  endroit du dépôt ; l'y importer ailleurs sans jumeau casse le site.
- **Le PaymentSheet natif exige un nouveau build** (`@stripe/stripe-react-native` est un module
  natif) : il n'existe pas dans les binaires 1.1.0 en ligne. Le web, lui, part au prochain
  déploiement Netlify.
- **Orange Money est non sélectionnable** (badge « Bientôt ») à la SAISIE seulement. Trois
  commandes en base le portent : `admin/lib/util.ts` et `components/DeliverSheet.tsx` doivent
  continuer à les afficher — ne pas les toucher.
- ✅ **Le restaurant n'est plus prévenu d'une commande carte non payée** (migration
  `20260905231109`). `notify_order_status()` se tait sur une commande `cb` dont le paiement
  n'est pas capturé, et **rattrape l'annonce** à l'encaissement (ou au repli espèces).
  ⚠️ Le trigger `orders_notify_status` est passé à
  `after update of status, picked_up_at, payment_status, payment_method` : **ne jamais retirer
  les deux dernières colonnes**. Sans `payment_status`, la capture ne réveille pas le trigger
  et le restaurant ne serait *jamais* prévenu ; sans `payment_method`, le repli espèces non
  plus. Toute la garde est conditionnée à `carte_active` : elle est donc **inerte tant que
  l'interrupteur est à `false`**, et « cb » continue d'y désigner le terminal du livreur.
  ✅ **Exécutée pour de vrai le 2026-09-06**, et la preuve est dans `net._http_response` :
  aucun appel sortant entre 05 h 44 et 08 h 10 alors que cinq commandes carte non payées
  étaient créées dans cette fenêtre (TF-91, 92, 94, 95, 96), puis push + n8n à **08:10:10**,
  une seconde après la capture de TF-96 à 08:10:09. La garde tient, et son rattrapage aussi.
- ✅ **Double encaissement fermé des deux côtés** : `mark_order_delivered` fait primer
  `payment_status = 'paye'` sur `payment_method` et n'enregistre alors aucun cash, même si
  l'appelant coche la case. `app/components/DeliverSheet.tsx` porte la même règle à l'écran —
  la garde app seule ne suffisait pas.
- ⚠️ **Reste ouvert** : le repli espèces n'annule toujours pas le PaymentIntent chez Stripe
  (il faudrait une Edge Function). La colonne `carte_non_encaissee` du rapport rend le cas
  visible — **elle doit rester à zéro**.
- ✅ **`creer-paiement` déployée est la version 4**, conforme au dépôt (relue le 2026-09-06 :
  garde `CLE_STRIPE_VALIDE`, `try/catch` global, nettoyage récursif de `raw_event`), avec
  `verify_jwt = true`. `rembourser-paiement` est déployée elle aussi et répond bien les codes
  du dépôt (`identifiant_manquant`, `devise_incoherente`, `sans_objet`… vus en production).
  Ce paragraphe annonçait la version 1 : il datait d'avant le chantier du 2026-09-06.
  `supabase/config.toml` fige désormais `verify_jwt` pour toutes les fonctions.
- 🚨 **LE TROU LE PLUS GRAVE ENCORE OUVERT : le client peut écrire lui-même le total de sa
  commande.** `creer-paiement` relit `orders.total` — c'est juste — mais `orders`,
  `order_items` et `order_item_options` acceptent toujours un **INSERT direct par l'API REST**
  (policies `orders_insert_own`, `order_items_insert_own`, `order_item_options_insert_own`),
  et `orders` ne porte **aucune contrainte CHECK** : `total`, `delivery_fee`, `commission_rate`
  et `commission_amount` sont libres, `address_id` est nullable. Avec la clé anon (publique par
  conception) et un compte gratuit : un repas payé 50 centimes en carte, une commande espèces
  à 0 Ar qui réveille quand même le restaurant, une livraison sans GPS, un rapport de clôture
  falsifié. Vérifié le 2026-09-06 : **aucune source** (`app/`, `admin/`, `landing/`) n'insère
  dans ces trois tables — le seul `.insert(` du projet porte sur `addresses` — et `create_order`
  est `SECURITY DEFINER` appartenant à `postgres`, propriétaire des trois tables, aucune en
  `FORCE ROW LEVEL SECURITY` : elle n'est pas soumise à la RLS et n'a jamais eu besoin de ces
  policies. Le correctif tient en trois lignes, à appliquer avec son fichier de migration :
  `drop policy if exists orders_insert_own on public.orders;` et les deux équivalents.
  ⚠️ Deux sessions successives ont vu leur écriture **refusée par le classificateur de
  permissions** (DDL sur des policies RLS) : c'est un geste que le porteur du projet doit faire
  lui-même, ou autoriser explicitement.

## ⚠️ Le restaurant recevait une commande VIDE (corrige le 2026-09-06)

Constate sur le telephone du patron de Chez Bidul & Truc a sa premiere commande :
**« il me dit qu'il a recu une commande a 0 Ar »**. Ce n'etait pas un souci d'affichage
Telegram — c'est bien une commande vide qui partait. Mesure dans une transaction annulee :

| | En base | Envoye au restaurant |
|---|---|---|
| Sous-total | 9 000 Ar | **0** |
| Total | 19 000 Ar | **10 000** (les frais de livraison seuls) |
| Articles | 1 | **0** |

**Cause.** `create_order` procede en trois temps, et elle y est obligee : INSERT de la
commande (subtotal 0, total = frais de livraison) pour obtenir son id, INSERT des lignes
d'articles qui referencent cet id, puis UPDATE des montants recalcules. `orders_notify_new`
etait un `AFTER INSERT` ordinaire : il partait **dans l'intervalle**.

⚠️ **Pourquoi c'est reste invisible — et pourquoi ca aurait frappe le premier vrai client.**
Les seules commandes annoncees jusqu'ici etaient des commandes **carte**, volontairement
muettes a l'insertion : leur annonce est rattrapee plus tard par le trigger UPDATE, quand
articles et montants sont en place. **Le chemin carte masquait le defaut ; le chemin
especes — celui de la quasi-totalite des clients reels — le portait en plein.**

**Correctif** (migration `20260906183000_le_restaurant_recoit_la_commande_entiere`), deux
gestes **indissociables** :

1. `orders_notify_new` devient un **`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`** :
   il se declenche au COMMIT, pas a l'insertion.
2. `notify_order_status()` **RELIT la ligne** (`select * into v_o from orders where id = new.id`)
   au lieu de faire confiance a `NEW`. ⚠️ Un trigger differe conserve le `NEW` **fige a
   l'instant de l'INSERT** : reporter sans relire n'aurait repare que la moitie du probleme —
   les articles seraient apparus (ils viennent d'un sous-select), les montants seraient restes
   faux. C'est la moitie la plus trompeuse.

⚠️ **Ne jamais remettre `orders_notify_new` en `after insert` simple, ni retirer la relecture
de `notify_order_status()`.** Les deux gestes se tiennent : reporter sans relire ne repare que
la moitie du probleme, et relire sans reporter ne repare rien. Le defaut revient entier, et il
ne se voit pas en carte. Etat re-verifie en base le 2026-09-07 :
`CREATE CONSTRAINT TRIGGER orders_notify_new AFTER INSERT ON public.orders DEFERRABLE INITIALLY
DEFERRED FOR EACH ROW EXECUTE FUNCTION notify_order_status()`.

✅ **Verifie apres correction** : base et charge utile coincident (total 19 000, sous-total
9 000, 1 article nomme). ✅ **Et le bouton Accepter de Telegram fonctionne de bout en bout** —
TF-99 est passee en `confirmee` par un appui du patron : Telegram -> lien `/a/<id>/<jeton>` ->
base. C'etait le dernier maillon jamais eprouve.

Les trois liens de la charge utile (suivi, accepter, refuser) sont passes au domaine canonique
au meme moment.

## Codes promo (2026-09-06)

**Le code donne une remise sur la LIVRAISON seulement.** La commission prélevée sur les
plats n'est pas touchée : la remise sort de notre marge de livraison, jamais de la poche du
restaurant. Le code de lancement est **`TAXIFOOD50`** — 50 %, soit 10 000 → 5 000 Ar.

- **Tables** : `promo_codes` (code, `code_normalise` **générée** via `normaliser_code_promo()`
  — majuscules, sans espaces —, type/valeur de remise, `porte_sur` ∈ {livraison, sous_total},
  `actif`, `commence_le`, `expire_le`, `max_utilisations` global) et `promo_redemptions`
  (qui, quel code, quelle commande, quand). RLS active, **aucune policy client** : lecture
  réservée à `is_admin()`, écriture uniquement par les fonctions SECURITY DEFINER.
- ⚠️ **L'unicité par client est la contrainte `unique (code_id, user_id)`, pas un `select`
  suivi d'un `insert`.** Deux commandes envoyées en même temps depuis deux appareils
  passeraient toutes les deux une vérification préalable. `create_order` insère et **traduit
  la violation** (`unique_violation`) en `code_promo:deja_utilise`.
- ⚠️ **La consommation est dans `create_order`, pas dans un appel séparé.** Même
  transaction : un code ne peut pas être consommé pour une commande qui échoue, ni l'inverse.
- **`verifier_code_promo(code, restaurant, sous_total)`** ne consomme rien : elle sert
  l'aperçu au panier. Le montant qui fait foi reste celui que `create_order` recalcule.
- **Le client n'envoie que le CODE.** Barème, frais de livraison et total sont relus en base.
  `orders.promo_code` / `orders.promo_discount` sont des **instantanés** : la commande reste
  lisible si le code est désactivé plus tard.
- **Verrou de plafond global** : `select … from promo_codes … for update` sérialise les
  commandes portant le même code. L'unicité par client, elle, ne dépend jamais de ce comptage.
- ⚠️ **Le rapport de clôture compte les frais de livraison NETS de remise** (`admin/`), et le
  net à reverser au restaurant est inchangé.
- ✅ **Le champ se saisit AU PANIER**, sous la ligne « Frais de livraison » : `components/CodePromo.tsx`
  monté à l'identique par `(tabs)/cart.tsx` et `checkout.tsx`, vérification partagée dans
  `store/promo.ts`. Le **code** vit avec le panier (AsyncStorage, il survit au détour par
  `/login`) ; la **vérification** vit en mémoire et porte les entrées sur lesquelles elle a été
  faite — une entrée qui change périme le résultat, jamais un montant hérité à l'écran.
- ⚠️ **`promo.aEnvoyer` n'est PAS `promo.valide`.** Tout code retenu qu'aucune réponse de la
  base n'a expressément refusé part à `create_order`, qui tranche. N'envoyer que les codes
  confirmés perdait la remise en silence dans deux cas très réels sur la liaison de Nosy Be :
  vérification encore en vol au moment du tap, et échec réseau. L'aperçu à l'écran, lui, ne
  bouge que confirmé : **on peut facturer moins qu'annoncé, jamais plus.**
- ✅ **Les frais de livraison affichés sont réalignés sur ceux qui seront facturés**
  (`app/lib/fraisLivraison.ts`, monté par les deux seuls écrans qui affichent un total).
  Le panier figeait `deliveryFeeValue` au premier ajout et ne le rafraîchissait jamais, alors
  que `create_order` relit `restaurants.delivery_fee` : au passage de 5 000 à 10 000 Ar, un
  panier resté ouvert affichait « livraison offerte » avec le code promo et se faisait
  facturer 5 000 Ar. Vérifié en production le 2026-09-06 avec un panier volontairement périmé
  à 5 000 : l'écran affiche 10 000. ⚠️ **Les prix des plats et des suppléments, eux, restent
  figés dans le panier persisté** — la vraie réponse est une revalidation du panier à
  l'ouverture (prix, disponibilité, rupture), qui est un chantier, pas un correctif.
- ⚠️ **RIEN, NULLE PART, NE LIBÈRE UNE UTILISATION CONSOMMÉE.** `create_order` insère dans
  `promo_redemptions` au moment de créer la commande ; ni une annulation, ni un paiement carte
  qui échoue ne rendent le code au client. C'est déjà arrivé : l'unique ligne de la table
  appartient à **TF-91**, commande carte jamais payée. Et comme `max_utilisations` est NULL
  sur TAXIFOOD50 et que `promo_redemptions_user_id_fkey` est `ON DELETE CASCADE`, supprimer
  puis recréer son compte rend le code réutilisable sans plafond.

## Heures de service — deux services par jour, cartes à l'heure (2026-09-07)

Chantier ouvert en branchant **Chez Bidul & Truc**, qui sert **midi ET soir** et dont les
**pizzas ne sortent qu'à partir de 18 h**. Migration
`20260907190000_deux_services_par_jour_et_cartes_a_l_heure`.

- ⚠️ **Deux services n'étaient pas « pas prévus » : ils étaient INTERDITS par la clé.**
  `restaurant_hours` avait `primary key (restaurant_id, weekday)` — une seule ligne par jour,
  point. La table porte désormais `service smallint not null default 1`
  (`check (service between 1 and 2)` ; 1 = midi, 2 = soir) et sa clé primaire est
  **`(restaurant_id, weekday, service)`** — vérifié en base. Un restaurant à service unique
  n'utilise que le 1 : la migration ne change rien pour lui.
- **`ouvert_maintenant(restaurants)` est passé en `exists`** : ouvert = il existe **un**
  service du jour, non fermé, dont la plage contient l'heure d'`Indian/Antananarivo`. Le
  calcul de plage est extrait dans **`heure_dans_plage(ouvre, ferme, moment)`**, et il l'est
  exprès : il sert maintenant à **trois** endroits (ouverture du restaurant, disponibilité
  d'une catégorie, garde de `create_order`) — trois copies auraient divergé. Il gère le
  **passage de minuit** (22h → 02h est vraie aux deux bouts).
- **`services_du_jour(r)` rend TOUS les services du jour**, dans l'ordre. `horaires_du_jour(r)`
  survit et rend le **service 1**, le temps que les binaires déjà sur les magasins soient
  remplacés. ⚠️ La fiche restaurant lit `services_du_jour`, pas `horaires_du_jour` : à 18 h,
  un restaurant qui sert midi et soir affichait « Ouvert · 11h30 – 15h » — l'état était juste,
  l'horaire montrait le service **déjà terminé**.
- ⚠️ **`set_restaurant_week_hours` : `service` est OPTIONNEL dans la charge utile et retombe
  sur 1.** C'est ce qui laisse les écrans déjà installés (sept objets sans `service`) piloter
  le midi sans rien casser. Mais s'appuyer là-dessus depuis l'app écraserait silencieusement
  un service du soir sur le midi : `app/data/api.ts` envoie donc **toujours** `service`, même
  à 1. Et « Fermé » ferme **la journée**, donc les DEUX services — n'en remettre qu'un à zéro
  laisserait un service du soir actif en base sur un jour de fermeture.

### Une catégorie peut n'être servie qu'à certaines heures

- **`categories.serving_from` / `serving_to`** (`time`, nullables). **Vide = servie dès que le
  restaurant est ouvert** — c'est le cas de toutes les catégories sauf une, vérifiée en base :
  « Pizza » chez Chez Bidul & Truc, **18:00 → 22:00**. Le verdict est rendu par
  `categorie_servie_maintenant(categories)`, que `getMenu` sélectionne comme colonne calculée.
- ⚠️ Avant, `is_active` était le seul levier, et il est tout ou rien : masquer les pizzas le
  midi obligeait à **les éteindre et les rallumer à la main, deux fois par jour, tous les
  jours**.

### Et le vrai trou : `create_order` ne regardait NI l'ouverture NI l'heure

⚠️ **On pouvait commander à 3 h du matin sur un restaurant fermé.** Mesuré le 2026-09-07 dans
une transaction annulée, Chez Bidul & Truc fermé : « restaurant ouvert ? f | commande acceptée
? t » — TF-107, 19 000 Ar. Le restaurant aurait reçu son message Telegram, avec ses boutons,
sans personne en cuisine. **L'écran grisait le bouton — l'écran n'a jamais été l'autorité** :
la clé anon est publique par conception, l'API REST s'appelle directement.

`create_order` lève désormais deux exceptions, en `errcode = '22023'` :

| Message levé | Quand |
|---|---|
| `service:restaurant_ferme` | `ouvert_maintenant(resto)` est faux |
| <code>service:categorie_hors_service&#124;nom&#124;de&#124;a</code> | la catégorie d'un plat du panier n'est pas servie à cette heure |

- ⚠️ **Le séparateur est `|`, pas `:`** — un nom de catégorie peut contenir un deux-points, et
  le découpage côté app se ferait alors au mauvais endroit.
- ⚠️ **Pas de `to_char()` sur un `time`** : Postgres n'a pas de `to_char(time, text)`. Les
  heures partent en `substring(x::text from 1 for 5)`, soit « 18:00 ».
- Côté app, `refusServiceDepuisErreur()` (`app/data/api.ts`) reconstitue le motif, et
  `checkout.tsx` le teste **avant** le code promo : un restaurant fermé ou une carte pas encore
  ouverte n'est pas un échec technique, et « la commande n'a pas pu être créée » ne dit rien à
  quelqu'un qui vient de composer son panier. Le client doit lire **l'heure à laquelle
  revenir**.
- Côté saisie, l'écran Réglages du partenaire compose les deux services par jour
  (« + Ajouter un service du soir », « Retirer ») ; sa clé interne est `weekday:service`, pas
  `weekday`.

## L'ordre de la carte n'existait pas (2026-09-07)

Migration `20260907200000_la_carte_ne_se_reordonne_plus_toute_seule`.

⚠️ **`products` ne portait aucune colonne d'ordre, et `getMenu` ne demandait aucun `ORDER
BY`.** Sans tri explicite, Postgres rend les lignes dans l'**ordre physique du fichier**, et
une ligne `UPDATE`-ée est réécrite **à la fin**. Chaque changement de prix, chaque rupture
cochée, chaque plat étoilé faisait donc descendre le plat au bas de sa catégorie, **chez le
client, définitivement**. Constaté en posant des labels « contient du porc » chez Chez Bidul &
Truc : le croque-monsieur est passé de la 3e à la 15e place et la croque-madame en dernier,
alors que **rien n'avait bougé à l'écran** — c'est la base qui les avait déplacés. Ce n'est pas
un défaut d'affichage : c'est un ordre qui n'existait pas, et un restaurateur qui range sa
carte ne pouvait pas la ranger.

- Le correctif a **deux moitiés indissociables** : la colonne `products.sort_order` **et** le
  tri explicite `.order('sort_order').order('name')` dans `getMenu`. ⚠️ **Ne jamais retirer cet
  `ORDER BY`** : la colonne seule ne trie rien, et le défaut revient entier et silencieux.
  `name` départage les ex æquo pour que l'ordre reste stable même à rangs égaux.
- Le semis part de `ctid` — la position physique, précisément ce qui servait d'ordre implicite
  — numéroté par dizaines dans chaque catégorie, pour que **rien ne bouge** à l'application de
  la migration. ⚠️ **L'ordre semé est donc celui d'aujourd'hui, déjà partiellement brassé par
  les modifications passées** : il n'y a aucun moyen de retrouver l'ordre d'origine de la carte
  papier, `products` n'ayant même pas de `created_at`. Le figer est le mieux qu'on puisse faire
  sans inventer.
- Les 18 plats de la catégorie « Plat » de Chez Bidul & Truc ont ensuite été remis dans l'ordre
  de sa **carte papier**, relevé sur la photo versionnée à côté — ni alphabétique, ni par prix :
  celui que le restaurateur a choisi.
- Index `products_categorie_ordre_idx (category_id, sort_order)`.
- ⚠️ **Figer l'ordre n'est pas le CHOISIR.** Le restaurateur qui veut remonter sa spécialité en
  tête de catégorie ne pouvait toujours rien faire : l'ordre était simplement figé, et figé sur
  une disposition déjà brassée. Un écran de réordonnancement (« monter » / « descendre » dans
  les Réglages) et sa RPC `set_product_sort_order` sont **en cours dans le répertoire de
  travail, ni commités ni appliqués en base au 2026-09-07** — migration
  `20260907210000_le_restaurateur_range_enfin_sa_carte.sql`. À reprendre là.

## Partage social d'un plat ou d'un restaurant (2026-09-07)

`app/lib/partage.ts` et `app/components/PartageSheet.tsx`, qui exporte **deux** composants :
**`PartageSheet`** (la feuille modale, montée par la fiche produit et par les lignes de menu de
la fiche restaurant) et **`PartageEnLigne`** (la rangée « Partager sur : » annoncée en clair sur
la fiche produit — une icône de partage seule ne se remarque pas, et la fiche est le seul écran
qui a la place).

- ⚠️ **`navigator.share` N'EXISTE PAS sur un navigateur de bureau** — vérifié le 2026-09-07 en
  production : `typeof navigator.share === 'undefined'`. `Share.share` de React Native s'appuie
  dessus côté web, donc le bouton de partage n'y faisait **RIEN, en silence**, l'échec étant
  avalé par le `catch` de `partager()`. Et c'est exactement là que ça compte : un restaurateur
  qui pousse son plat sur la page Facebook de son établissement le fait **depuis un
  ordinateur**. Les trois destinations sont donc explicites et marchent partout (WhatsApp par
  `wa.me`, Facebook par `sharer.php`, copie du lien pour tout le reste), et la feuille système
  n'est proposée que là où **`partageNatifDisponible()`** est vrai.
- ⚠️ **Facebook IGNORE tout texte qu'on lui passe** — le paramètre `quote` ne fonctionne plus
  depuis 2017. Titre, description et image viennent **exclusivement** des balises Open Graph de
  la page ciblée : d'où `/p/<id>` et `/r/<id>`, servis par
  `landing/netlify/functions/partage.mjs`, qui lit Supabase et rend ces balises. Ne jamais
  pointer un partage vers `/product/<id>`, qui est l'app et n'a aucune balise.
- ⚠️ **L'URL est mise DANS `message`, et `url` est laissé vide** dans `Share.share`. C'est
  contre-intuitif et délibéré : quand les deux sont fournis, iOS publie deux éléments distincts
  et la plupart des applications de destination n'en retiennent qu'un — l'URL. Le texte
  disparaît, le destinataire reçoit un lien nu.
- **Le lien partagé est une vraie URL `https://`, jamais le schéma `taxifood://`** : un schéma
  privé n'est même pas cliquable dans WhatsApp et ne fait rien chez qui n'a pas l'app —
  c'est-à-dire exactement la personne qu'on cherche à convertir.
- ⚠️ **`SITE`, dans `app/lib/partage.ts`, est un endroit de PLUS où le domaine doit rester
  aligné**, avec `app.json` (`ios.associatedDomains`, `android.intentFilters`),
  `landing/.well-known/apple-app-site-association` et `landing/.well-known/assetlinks.json`.
  Désaligné, le lien tombe silencieusement dans le navigateur au lieu de l'app.

⚠️ **Le domaine canonique est `taxifoodnosybe.distripro207.com`** — c'est lui que portent
`SITE`, les trois liens de la notification Telegram (suivi, accepter, refuser) et toutes les URL
absolues du site. **Ne pas le confondre avec `taxifood.distripro207.com`, qui est l'app web** :
elle n'a aucune balise Open Graph, et un partage qui la vise ne montre qu'un lien nu.

## Règles produit importantes (déjà implémentées)

- ⚠️ **Labels alimentaires « contient du porc » : on ne tague que ce qui est CONFIRMÉ par le
  restaurateur, jamais par déduction.** Document de référence :
  [docs/LABELS-ALIMENTAIRES.md](docs/LABELS-ALIMENTAIRES.md). Un label est un label de
  confiance : se tromper une fois coûte le client définitivement, et **ne rien afficher vaut
  mieux qu'une supposition**. La déduction se trompe dans les **deux** sens — les pizzas
  « Reine » et « Pepperoni » d'Angelo et de Taxi Be sont au jambon de volaille (les taguer
  aurait fait fuir exactement les clients que le label sert), et à l'inverse la « Terrine foie
  gras » de Chez Bidul & Truc n'en contient pas, alors que la déduction courante l'aurait
  taguée et aurait écarté un plat à 29 000 Ar sans raison. Colonne `products.diet_tags`, posée
  par `set_product_diet_tags`.
- **Un groupe d'options OBLIGATOIRE qui ne propose qu'une seule option disponible se
  pré-remplit** (2026-09-07). ⚠️ « Coché par défaut » **n'existe nulle part en base** —
  `product_options` n'a pas de colonne pour ça : la règle vit dans l'écran produit, et elle est
  **générale**, pas codée en dur pour un restaurant. Sans elle, il reste un tap pour rien et,
  pour qui ne le voit pas, un bouton « Ajouter » grisé inexplicable. ⚠️ Une sélection déjà faite
  l'emporte toujours : la règle **pré-remplit, elle n'écrase jamais**.
- ⚠️ **La rubrique de mise en avant s'appelle « Offre du jour » DES DEUX CÔTÉS du comptoir**
  (2026-09-07) : le partenaire lisait « À l'affiche » dans ses Réglages et le client « Plats du
  jour » sur la fiche — deux noms pour une seule chose. Le libellé de l'écran Réglages est une
  **chaîne EN DUR**, pas une clé traduite, et la **visite guidée le CITE dans les trois
  langues** : renommer l'un sans l'autre envoie le restaurateur chercher une section qui
  n'existe plus. Les deux bougent ensemble, et le nom cité reste le **texte littéral de
  l'écran**, français quelle que soit la langue lue.
- **Choix structurés, pas de commentaire libre** : les produits « à choix » (kebab, tacos, burgers, pizzas…) utilisent des groupes d'options (radios / cases). Le champ commentaire a été retiré.
- **Suppléments = ingrédients de la composition** (1:1, prix unitaire) ; La Cabane a en plus « Sauce au choix » (obligatoire) + « Sauce supplémentaire » (+2 000 Ar).
- **Frais de livraison : 10 000 Ar depuis le 2026-09-06** (5 000 auparavant). Le montant vit **uniquement** dans `restaurants.delivery_fee` — il n'est écrit en dur nulle part dans le code ; l'app et le site l'affichent tels qu'ils le lisent. Le seul reliquat était la valeur **par défaut du formulaire** de création de restaurant (`admin/components/Restaurants.tsx`), mise à jour elle aussi.
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
- ⚠️ **Un compte à rôle PRO ACTIF entre DIRECTEMENT dans son espace** — même s'il porte aussi un rôle client (règle élargie le 2026-09-06 ; elle ne visait auparavant que les comptes à rôle unique, et se cassait au premier tap sur « Je commande »). Lui présenter `/role-select`, dont la carte mise en avant était « Je commande », l'envoyait du mauvais côté. C'est très probablement ce qui aurait provoqué un troisième rejet Apple, et c'est ce qui a réellement égaré le premier vrai restaurateur. On sort de l'espace pro par le bouton **« ↔ App client »** de l'en-tête et on y revient par **Profil → « Mon espace partenaire »** (`components/RestaurantHeader.tsx`, `components/CourierHeader.tsx` — **dans `components/`, pas dans les dossiers de routes** : un grep limité aux routes ne les trouve pas).

## Comptes de démonstration (revue Apple)

Trois comptes e-mail + mot de passe, **rôles actifs**, un par public. Identifiants et notes de revue en anglais : **[docs/FICHE-APP-STORE.md](docs/FICHE-APP-STORE.md) § 4** — à recopier dans *App Review Information* à chaque soumission.

⚠️ **Apple veut vérifier chaque type de compte.** Le rejet 2.1(a) du build 17 vient précisément de là : un seul compte fourni, et des notes de revue qui présentaient les espaces professionnels comme hors périmètre. Le relecteur a demandé le rôle restaurant depuis l'app, l'a obtenu en statut `pending`, et n'a donc rien vu.

⚠️ Ces comptes ont été créés **par l'API Auth**, pas par un `INSERT` SQL. Une ligne `auth.users` insérée en SQL laisse huit colonnes de jetons à `NULL` et GoTrue répond « Database error querying schema » à la connexion. Piège déjà rencontré, ne pas le refaire.

⚠️ `auth.users` **n'a pas de contrainte unique sur `email`** : `ON CONFLICT (email)` échoue. Et la table `user_roles` porte `activated_at`, pas `approved_at`.

## 📓 Journal du 2026-09-09 — veille de lancement

Session longue : garde « restaurant ferme », cartes coupees, comptabilite du
rapport, temps reel, canal Telegram du patron, icones refaites, 1.2.1 soumise
sur les deux magasins. **Tout y est consigne, avec les pieges et ce qui reste
ouvert** : [docs/JOURNAL-2026-09-09.md](docs/JOURNAL-2026-09-09.md).

⚠️ La liste « Reste ouvert » de ce journal porte des points **bloquants avant
l'ouverture**, dont le Telegram de La Cabane qui pointe encore sur le patron.

## ⚠️ Une correction se livre sur QUATRE surfaces (2026-09-09)

**Le même code `app/` tourne à trois endroits, qui se mettent à jour séparément.
Corriger l'un ne corrige pas les autres.** Oublier la troisième est l'erreur
commise le 2026-09-09 : la garde « restaurant fermé » avait été publiée en OTA
et vérifiée sur mobile, pendant que **le site web restait figé sur le build du
07/09 — 21 commits en retard**. Le client testait sur le web et voyait encore
l'ancien écran ; seule la garde en base empêchait la commande de passer.

| Surface | Comment elle se met à jour | Délai |
|---|---|---|
| **Base Supabase** | migration (MCP + fichier dans `supabase/migrations/`) | immédiat, tout le parc |
| **Apps iOS / Android** | `eas update` sur la branche `production` | au **2ᵉ** lancement de l'app |
| **Site web** (`app/`) | **déploiement Netlify À LA MAIN** | immédiat après la commande |
| **Dashboard admin** (`admin/`) | **déploiement Netlify À LA MAIN**, site distinct | immédiat après la commande |

### Les deux commandes, à lancer ensemble

```bash
# 1. Mobile (canal production, runtime = appVersion)
cd app && npx eas update --branch production --message "…"

# 2. Web — NE PAS OUBLIER
cd app && npx expo export -p web --output-dir dist && npx netlify deploy --prod --dir=dist

# 3. Dashboard admin — SI admin/ a change (site Netlify DIFFERENT)
cd admin && npm run build && npx netlify deploy --prod --dir=out --site=taxi-food-admin-nosybe
```

- ⚠️ **`eas update` sans `--environment`.** EAS n'a **aucune** variable
  d'environnement enregistrée côté serveur (vérifié le 2026-09-09) : passer
  `--environment production` fait échouer la commande, et le faire avec
  `--non-interactive` publierait un bundle **sans URL Supabase**. Les variables
  viennent de `app/.env`, dont les 6 valeurs ont été confrontées une à une à
  `eas.json > build.production.env` — identiques.
- ⚠️ **L'admin est un site Netlify SÉPARÉ** (`taxi-food-admin-nosybe`, Next.js
  exporté en statique) et se déploie à la main lui aussi. Oubli constaté le
  2026-09-09 : il était resté sur le build du 05/09, **sans les remboursements
  ni le pilotage du service** — le patron voyait ses commandes mais ne pouvait
  pas agir dessus, et croyait l'outil casse. Verifier avec
  `git log --since=<date du dernier deploiement> -- admin/`.
- ⚠️ **Aucun des sites n'a de déploiement continu depuis GitHub.** Pousser sur
  `main` ne le met pas à jour. Site Netlify `taxi-food-commander`
  (https://taxifood.distripro207.com), `siteId` dans `app/.netlify/state.json`,
  `deploy_source: cli`. C'est exactement le piège des migrations MCP hors dépôt :
  ce qui n'est pas automatique diverge en silence.
- **Corriger la base D'ABORD, toujours.** C'est la seule surface qui protège
  tout le parc immédiatement, y compris les versions anciennes qui ne recevront
  jamais l'OTA (un client resté en 1.1.0) et le web tant qu'il n'est pas
  redéployé. L'écran n'est jamais l'autorité : la clé anon est publique et
  `create_order` reste appelable directement.

## Build de production (EAS) — état

- **Compte Apple Developer actif** (Team « jean christopher techer », `CV2FA6NJ75`) ; certificat de distribution + provisioning profile iOS gérés par EAS (Expo server), valides jusqu'à 08/2027.
- `app/eas.json` : profils `development` (dev client), `preview` (interne), `production` (`distribution: "store"`, `autoIncrement: true` → **chaque build de prod incrémente automatiquement `buildNumber`**, ne jamais le fixer à la main), `simulator` (build iOS pour simulateur, jamais soumis). `appVersionSource: "remote"`.
- Bundle ids : iOS `com.chris97416.taxi-food-nosybe`, Android `com.chris97416.taxifoodnosybe` (Android interdit les tirets). Soumission App Store Connect : `submit.production.ios.ascAppId = "6802418114"`.
- **iOS build 1.0.0 (22) — dernier sorti, envoyé à App Store Connect le 2026-08-23.** Répond aux deux rejets du build 17 : catalogue libre sans compte (5.1.1(v)), trois comptes de démonstration à rôles actifs (2.1(a)), entrée directe dans l'espace pro pour un compte à rôle unique, et le correctif de l'écran blanc à la déconnexion. Le build 17 apportait l'authentification native (Apple/Google/Facebook), la suppression de compte et les correctifs des captures App Store. Historique complet des builds 5 à 22 : [docs/SOUMISSION-APPLE.md](docs/SOUMISSION-APPLE.md) et [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md).
- ⚠️ **Un build touchant les capabilities Apple (Push, Sign In with Apple) doit être lancé par Christopher lui-même, dans son propre terminal, en interactif** (`eas build -p ios --profile production`, **sans** `--non-interactive`). Lancé depuis un outil sans TTY réel, EAS bascule silencieusement en mode non-interactif et réutilise un profil de provisioning obsolète sans jamais contacter Apple — cause exacte de l'échec des builds 7, 8 et 11. Google et Facebook natifs n'ont besoin d'aucune capability côté portail Apple (juste des schémas d'URL dans Info.plist) : un build non-interactif suffirait pour ces deux-là, mais autant garder le même réflexe partout.
- **Android** : builds `development` testés avec succès le 2026-08-19 (émulateur Pixel 8 local, `eas build --profile development --platform android`) — connexion Google native, Facebook (flux web) et position GPS tous confirmés fonctionnels en conditions réelles. **Un bundle de production a depuis été déposé sur le Play Store** (vers le 2026-08-29, en attente de revue au 2026-09-05) — la vérification d'identité du compte n'est donc plus un obstacle. Voir [docs/SOUMISSION-ANDROID.md](docs/SOUMISSION-ANDROID.md).

## Ce qui est vérifié vs pas encore

- ✅ Vérifié en web (lectures publiques, sans login) : accueil/filtres/logos/emojis, menu, configurateur d'options + prix temps réel, panier (clé par produit+options), blocage GPS obligatoire + capture (position simulée), `tsc --noEmit`, bundle web.
- ✅ Vérifié côté build iOS : `eas build`/`eas submit` production opérationnels de bout en bout, build 22 **envoyé** le 2026-08-23.
- ✅ Vérifié en navigateur : aiguillage de `destination()` sur les 12 combinaisons de session/rôle/mode, et la déconnexion depuis la sélection de rôle (l'écran blanc ne revient pas).
- ✅ Vérifié en production sur le site : écriture réelle en `waitlist`, refus du `INSERT` direct, limitation de débit non falsifiable, badges chargés et inertes.
- ✅ Vérifié sur appareil réel (iOS, TestFlight) : connexion native Apple/Google/Facebook, suppression de compte, écrans multilingues.
- ✅ Vérifié sur appareil réel (Android, émulateur Pixel 8, 2026-08-19) : connexion Google native, connexion Facebook (flux web), position GPS — testé en conditions réelles, parcours client complet, par le porteur du projet.
- ⏳ **Non testé** : parcours restaurant et livreur sur appareil réel, toutes plateformes. Le build `production` Android est déposé mais **je n'ai pas de retour d'usage dessus** (ni revue Google, ni test terrain). **Recette du build 22 sur appareil** : liste dans [docs/EN-ATTENTE-DE-BUILD.md](docs/EN-ATTENTE-DE-BUILD.md) — notamment un compte SMS neuf (sans nom ni numéro) qui part de « Commander » et doit arriver sur `/address`, et le bouton Retour après connexion qui doit fermer l'app, pas révéler une seconde barre d'onglets.

## Le site de pré-lancement (`landing/`)

**https://taxifoodnosybe.distripro207.com** — site statique, aucun build, aucune dépendance. Déploiement `netlify deploy --prod --dir=landing`. Documentation propre : [landing/LISEZ-MOI.md](landing/LISEZ-MOI.md).

✅ **Domaine canonique changé le 2026-09-06 : `taxifood.rentanoo.com` → `taxifoodnosybe.distripro207.com`.** C'est le *primary domain* Netlify du site `taxifood-nosybe-landing`, et toutes les URL absolues des pages (canonical, hreflang, og:image, sitemap, JSON-LD, `Sitemap:` de `robots.txt`) le désignent désormais. Tant qu'elles pointaient sur rentanoo, **le nouveau nom ne pouvait pas être indexé** : le canonical envoyait Google ailleurs.

⚠️ **`taxifood.rentanoo.com` est redirigé, pas coupé** — trois raisons de ne pas le retirer du DNS ni de Netlify : des liens `/p/<id>` partagés sur WhatsApp le portent encore ; les binaires **1.0.0/1.1.0 déjà en ligne sur l'App Store déclarent ce nom** dans leurs Universal Links (`app.json` déclare maintenant les **deux**, ce qui n'existera que dans le prochain build) ; et un 301 transfère à Google ce qui avait été indexé dessus. Les règles vivent dans `landing/_redirects`. ⚠️ **`/.well-known/*` y est explicitement servi en 200 sur l'ancien nom** : iOS et Android **ne suivent pas les redirections** en cherchant `apple-app-site-association` et `assetlinks.json`, un 301 casserait l'association des liens pour toute nouvelle installation des binaires en ligne.

⚠️ **Le *primary domain* Netlify ne redirige RIEN tout seul** (vérifié le 2026-08-24, et ça contredit ce qu'on lit partout) : `taxifood-nosybe-landing.netlify.app` répondait 200 avec le site entier, canonical compris, et Netlify ne pose de `X-Robots-Tag: noindex` que sur les deploy previews et les branch deploys, **jamais en production**. La seule protection est la règle de redirection absolue de `_redirects`.

⚠️ **L'indexation ne se déclenche pas toute seule** : le site n'est pas déclaré en Search Console, geste que seul le porteur du projet peut faire (validation de propriété). Sans lui, Google découvrira le nouveau nom par les 301 et le sitemap, mais lentement.

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
