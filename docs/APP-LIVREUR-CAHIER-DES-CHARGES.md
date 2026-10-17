# App « Taxi Food Livreur » + suivi du livreur en temps réel — cahier des charges

> Rédigé le 2026-10-16. **Aucune ligne de code écrite** : ce document sert de plan, à valider
> avant toute implémentation. Il reprend l'existant (ce qui marche déjà côté livreur) et décrit
> ce qu'il faut construire.
>
> Décisions du porteur du projet (2026-10-16) :
> 1. **Option 2** pour le suivi : rafraîchissement automatique espacé + bouton « Actualiser ».
> 2. **Une application dédiée aux livreurs**, sur **Android ET iPhone**.
> 3. Le porteur du projet **livre lui-même**, sur **iPhone**.

---

## 0. ÉTAT AU 2026-10-17 — ce qui est livré

| Lot | État |
|---|---|
| 0 Variante (même projet, `APP_VARIANT=livreur`) | ✅ `app.config.ts`, config client inchangée (vérifié octet pour octet), projet EAS `@chris97416/taxi-food-livreur` |
| 1 Base | ✅ appliquée en production (`claimed_at`, `positions_livreur`, `suivi_livreur`, purge 7 j) — vérifiée en transaction annulée et par PostgREST. ⏸️ `push_tokens.app` (§ 6.1) **pas fait** : l'app livreur n'enregistre aucun jeton tant que Firebase n'a pas le package |
| 2 App livreur (écrans) | ✅ connexion, pas-livreur, Livraisons, Historique + récap du jour, Profil |
| 3 GPS arrière-plan | ✅ écrit, dans le build Android ; ⏳ **à éprouver sur un vrai téléphone** |
| 4 Carte client | ✅ publiée : OTA ×3 + web (vérifiée sur données simulées à 375 px) |
| 5 Admin | ✅ « 📍 Livreurs en course » dans Temps réel, déployé |
| 6 Itinéraire Google | ⏸️ non fait (V1 sans Google, décision § 5.4) |
| 7 Magasins | ⏳ Android : APK installable par lien (pas de fiche Play) ; iPhone : build interactif à lancer par le porteur du projet |

**Gestes restants (consoles, à faire par le porteur du projet)** — voir le compte rendu de livraison :
1. Google Cloud : identifiant OAuth **Android** pour `com.chris97416.taxifoodlivreur` + empreinte SHA-1
   de la clé EAS (sinon « Continuer avec Google » refuse ; l'e-mail marche).
2. Firebase : ajouter l'app Android `com.chris97416.taxifoodlivreur`, puis § 6.1 (notifications).
3. iPhone : `APP_VARIANT=livreur npx eas build -p ios --profile livreur-production` en interactif
   (nouvel App ID avec Sign in with Apple ; Supabase → Apple : ajouter le bundle).
4. Play Console (plus tard) : créer l'app, déclaration « localisation en arrière-plan » + vidéo.

## 1. Pourquoi une app à part (rappel)

| Raison | Détail |
|---|---|
| **Position « toujours » (arrière-plan)** | Indispensable pour suivre le livreur quand il navigue sur Google Maps ou verrouille son écran. Demander ça dans l'app CLIENT exposerait au rejet (Apple et Google demandent une justification ; Google une déclaration + vidéo pour toute la fiche). Dans une app livreur, la justification est évidente. |
| **Fin de la jonglerie** | Aujourd'hui un compte bascule client / restaurant / livreur dans une même app (`role-select`, `mode` persisté, bouton « App client »). L'app livreur s'ouvre directement sur les livraisons. |
| **Cycles de mise à jour séparés** | Un correctif livreur ne touche plus le parcours de commande, et inversement. |
| **Interface pensée pour la route** | Gros boutons, écran allumé, navigation en un tap, son d'arrivée de course. |

---

## 2. L'EXISTANT — ce qui fonctionne aujourd'hui (référence : `main`, commit `a84503a`)

⚠️ **La copie de travail principale est sur la branche `orange-money`, en retard sur `main`** :
elle porte encore `MAX_TOURNEE = 3` et le filtre « un seul restaurant », retirés sur `main` le
2026-10-16 (`30e54c3`, migration `20261016140000_livreur_sans_limite`). **Toute reprise part de
`main`.** Règle rappelée : un livreur prend **autant de commandes qu'il veut, de tous les
restaurants** — ne jamais réintroduire de plafond (base, app, migration).

### 2.1 Devenir livreur
- Candidature publique : `landing/devenir-livreur/` → RPC `submit_courier_lead` → table `courier_leads`.
- Rôle : `user_roles (livreur, pending → active)`, validé à la main par l'admin (`approve_role`).
  `is_active_courier()` = rôle livreur **actif**.
- La ligne `couriers` (user_id, is_available, zone) est créée au premier basculement de disponibilité.
- Comptes livreurs actifs au 2026-10-16 : **2**.

### 2.2 Écran « Livraisons » (`app/app/(livreur)/index.tsx`)
| Fonction | Base | Remarque |
|---|---|---|
| Interrupteur **Disponible / Indisponible** | `set_courier_availability` (upsert `couriers`) | Indisponible = ne voit pas la file, ne reçoit pas les push « course disponible ». |
| **File des commandes à livrer** | RLS `orders_select_courier` : `en_livraison` ET `courier_id is null` | Tous restaurants. Sondage **12 s**. |
| **Je la prends** | `claim_order` — prise **atomique** (`where courier_id is null`), **sans limite** | Push client « Un livreur s'occupe de ta commande 🛵 » (jalon `assigned`, migration `20261007150000`). |
| **Ma tournée** | `listMyActiveDeliveries` (`courier_id = moi`, `en_livraison`) | Plusieurs commandes, plusieurs restaurants. |
| **Abandonner** (avant récupération seulement, à l'écran) | `release_order` remet `courier_id`, `picked_up_at`, `arriving_at`, `arrived_at` à NULL | La base l'accepte tant que `en_livraison`. |
| **Récupérée** | `mark_order_picked_up` → `picked_up_at` | Push client « Le livreur est en route ». |
| **J'arrive** puis **Je suis là** | `mark_order_arriving` / `mark_order_arrived` (un seul appui chacun) | Push client « arrive dans 5 minutes » / « devant chez toi ». Pas d'e-mail n8n. 53/53 livraisons récentes ont « J'arrive ». |
| **Marquer livrée** (`DeliverSheet`) | `mark_order_delivered(p_order_id, p_cash_confirmed, p_mode_encaissement)` | Espèces : case « J'ai bien encaissé X » obligatoire. Orange Money : rien à cocher, part « à vérifier ». Déjà payé par carte (`payment_status = 'paye'`) : rien à encaisser — **prime sur `payment_method`**. Commission figée à la livraison. |
| **Messagerie** (💬, non-lus) | `messagerie_*`, `useNonLus('livreur')`, écran `messages/[id]` | Client + livreur + restaurant + Taxi Food. Photos en bucket privé. Absente pour une commande par téléphone. |

### 2.3 Carte d'une commande (`RestaurantOrderCard`, partagée avec l'espace restaurant)
Articles, options, **précision par plat** (en rouge), emballages par libellé, total, mode de
paiement, porte-monnaie, nom et téléphone du client (le téléphone de l'adresse prime), repère,
**lien GPS** vers l'app de cartes (`getMapsNavigationUrl`) ou « Pas de GPS — appelle le client »
(commandes par téléphone), bouton d'appel, nom/téléphone du livreur.

### 2.4 Écran « Historique » (`history.tsx`)
Commandes `livree` du livreur, lecture seule. Aucune somme ni total du jour.

### 2.5 Navigation et en-tête
- `CourierHeader` : badge « Espace livreur », prénom, bouton **« ↔ App client »** (pose `mode = client`).
- Retour : Profil → « Mon espace partenaire ». `role-select` seulement si restaurant ET livreur actifs.
- Interface **en français seulement** (choix assumé pour les espaces pro).

### 2.6 Notifications push
- Fonction Edge `notify-order` : audience `livreur` = **livreurs disponibles** quand une commande
  passe `en_livraison` **sans** livreur (`course_disponible`). Route ouverte : `/(livreur)`.
- ⚠️ **Les jetons push sont rangés par COMPTE (`push_tokens.user_id`), pas par application.**
  Voir § 6.1 : c'est le premier point à régler pour une deuxième app.

### 2.7 Côté admin (`admin/`)
- **Temps réel** : livreurs disponibles, badge RETARD, **assignation / retrait** d'un livreur
  (`admin_assign_courier`, tracé dans `admin_actions`).
- **Rapport de clôture** : espèces encaissées par livreur.
- **Orange Money** : déclaration par le livreur, vérification par l'admin.
- **Messages** : vue admin des conversations.

### 2.8 Côté client (`app/app/order/[id].tsx`)
Sondage **15 s**. Bandeau qui distingue : en attente d'un livreur → livreur vers le restaurant
(nom affiché) → récupérée, en route → « arrive dans 5 min » → « devant chez toi ».
Estimation figée (`estimations_commande`) avec compte à rebours recalé sur `picked_up_at`.
**Aucune carte, aucune position du livreur.**

### 2.9 Ce qui n'existe PAS
- Aucune position du livreur, nulle part (`couriers` n'a que `is_available`, `zone`).
- Aucun horodatage de la **prise** (« Je la prends ») : `orders` a `accepted_at`, `ready_at`,
  `picked_up_at`, `arriving_at`, `arrived_at`, `delivered_at`, mais pas `claimed_at`.
- `expo-location` n'a que la permission « pendant l'utilisation » (texte destiné au client).
- La carte web (`MapSurface.web.tsx`) est une **image fixe** de tuiles OSM.
- Aucun récapitulatif « espèces à remettre » pour le livreur ; rémunération livreur : question
  ouverte depuis août.

---

## 3. Architecture de l'app livreur

### 3.1 Principe : **une variante du même projet Expo**, pas un second projet

- Même dossier `app/`, même `package.json`, même code partagé (`data/api.ts`, `lib/`,
  `components/`, `theme/`, `store/session`, connexion Supabase).
- `app.json` devient **`app.config.ts`**, qui lit `APP_VARIANT` (`client` par défaut, `livreur`) :

| | Taxi Food (client) | Taxi Food Livreur |
|---|---|---|
| Nom | Taxi Food | Taxi Food Livreur |
| iOS bundle | `com.chris97416.taxi-food-nosybe` | `com.chris97416.taxifood-livreur` (à confirmer) |
| Android package | `com.chris97416.taxifoodnosybe` | `com.chris97416.taxifoodlivreur` |
| Icône | actuelle | variante (bandeau « LIVREUR » ou scooter) |
| Routes | `app/` | **`app-livreur/`** via `EXPO_ROUTER_APP_ROOT` |
| Liens universels (`associatedDomains`, `intentFilters`) | oui | **NON** — sinon les liens partagés aux clients s'ouvriraient dans l'app livreur |
| Position | « pendant l'utilisation » | **« toujours »** + mode arrière-plan + service de premier plan Android |
| Projet EAS / canal OTA | actuel | **projet EAS distinct** (flux de mises à jour séparé) |

- **`EXPO_ROUTER_APP_ROOT`** : chaque variante a son propre arbre de routes ; Metro ne
  regroupe que ce que cet arbre importe → les écrans client n'entrent pas dans le paquet
  JavaScript de l'app livreur. ⚠️ Les **modules natifs**, eux, sont liés dans les deux binaires
  (Stripe, Facebook SDK…) : sans effet tant qu'ils ne sont pas appelés, mais à vérifier au lot 0
  (Facebook SDK initialisé avec un bundle inconnu, entitlement Apple Pay inutile).
- **Lot 0 = preuve de faisabilité** de ce montage (une variante qui compile, s'installe à côté
  de l'app client, se connecte, reçoit un push). Si elle échoue, repli : dossier `livreur/`
  séparé partageant le code par chemins — plus lourd (deux `node_modules`, risque de React en
  double).

### 3.2 Connexion
- **Google + Apple + e-mail/mot de passe.** Pas de Facebook ni de SMS dans l'app livreur.
  ⚠️ Apple exige « Se connecter avec Apple » dès qu'un fournisseur tiers (Google) est proposé.
- À créer : Client ID Google iOS **pour le nouveau bundle**, empreinte SHA-1 Android du nouveau
  package (clé Play App Signing **et** clé EAS), service « Sign in with Apple » activé sur le
  nouvel identifiant. Tous ajoutés dans Supabase → Auth → Providers.
- Un compte sans rôle livreur **actif** : écran « Ce compte n'est pas livreur » + lien vers la
  candidature + déconnexion. Jamais d'accès aux données.

### 3.3 Distribution (2 livreurs + le porteur du projet)
- **Android** : piste de **test interne** Play (compte d'organisation : pas de règle des 12
  testeurs), installation par lien. Déclarations Play à remplir : localisation en arrière-plan
  (+ vidéo), service de premier plan « location » (Android 14).
- **iPhone** : **TestFlight** pour démarrer (testeurs internes = utilisateurs App Store Connect ;
  ⚠️ chaque build expire à **90 jours**). Cible : **« Unlisted App Distribution »** d'Apple
  (examen une fois, installation par lien, pas d'expiration) — demande à déposer.
- Fiche de confidentialité : **Localisation précise**, liée à l'identité, fonctionnalité de l'app,
  pas de suivi publicitaire.

### 3.4 Transition
1. L'app livreur sort ; l'espace `(livreur)` **reste** dans l'app client.
2. Quand les 3 livreurs ont installé l'app livreur : l'espace livreur de l'app client affiche
   « Utilise l'app Taxi Food Livreur » + liens de téléchargement (OTA).
3. Plus tard : retrait du code `(livreur)` de l'app client.

---

## 4. L'app livreur — écrans

Tout l'existant du § 2.2 à 2.5 est **repris à l'identique** (mêmes RPC, mêmes règles), avec ces
ajouts :

### 4.1 Accueil « Livraisons »
- Interrupteur Disponible (existant).
- **Bandeau d'état GPS** permanent : « 📍 Position partagée · il y a 12 s » / « ⚠️ Position
  coupée — touche pour réactiver » / « Autorisation manquante → Réglages ».
- Ma tournée, file disponible, Je la prends, Abandonner, Récupérée, J'arrive, Je suis là,
  Marquer livrée, Messages : **existant**.
- **Naviguer** (nouveau) sur chaque carte :
  - avant récupération → vers le **restaurant** (tous les restaurants visibles ont une position) ;
  - après récupération → vers le **client** (lien GPS existant).
  Choix mémorisé : Google Maps, Waze ou Plans.
- **Écran allumé** pendant une tournée (`expo-keep-awake`, déjà dans Expo).

### 4.2 Historique
Existant + **récapitulatif du jour** : nombre de livraisons, **espèces encaissées à remettre**,
Orange Money à vérifier. (La rémunération livreur reste hors périmètre tant qu'elle n'est pas
tranchée.)

### 4.3 Réglages / Profil
Nom, téléphone, app de navigation préférée, état des autorisations, version (`Updates.createdAt`),
déconnexion, suppression de compte (exigence Apple).

### 4.4 Notifications
- « Nouvelle course disponible » avec **son distinct** (canal Android `courses`, priorité haute).
- Tap → ouvre la course. Plus de bascule de `mode` : l'app n'a qu'un espace.

---

## 5. Le suivi en temps réel

### 5.1 Côté livreur — émission de la position
- `expo-location` `startLocationUpdatesAsync` + `expo-task-manager` (tâche en arrière-plan).
  **Nouveaux modules natifs → binaire neuf (pas d'OTA).**
- **Quand** : seulement tant que le livreur tient **au moins une commande** `en_livraison`.
  Démarrage automatique au « Je la prends », arrêt automatique à la dernière livraison ou au
  dernier abandon. Disponible sans course = **aucune position** (vie privée — voir question Q3).
- **Cadence** : un point toutes les **15 s** OU dès **50 m** parcourus, précision « équilibrée ».
  Android : service de premier plan avec notification permanente « Taxi Food Livreur partage ta
  position pendant ta tournée ».
- **Envoi par lots** : les points sont mis en file sur le téléphone et envoyés ensemble
  (RPC unique) toutes les ~15–30 s. Réseau coupé (fréquent à Nosy Be) → la file attend, rien
  n'est perdu, horodatage du téléphone conservé.

### 5.2 Base
- **`orders.claimed_at`** (nouveau) : posé par le trigger de jalons `orders_jalons_statut` quand
  `courier_id` passe de NULL à une valeur (et remis à NULL au retrait/abandon). Sert à borner la
  trace et aux statistiques (délai d'attente d'un livreur).
- **Table `positions_livreur`** : `id`, `courier_id`, `latitude`, `longitude`, `precision_m`,
  `vitesse_kmh`, `cap`, `releve_le` (heure du téléphone), `recu_le` (heure serveur).
  RLS active, **aucune policy, aucun droit** : tout passe par RPC.
- **`couriers`** : `derniere_lat`, `derniere_lng`, `derniere_position_le` (lecture rapide).
- **RPC `livreur_envoyer_positions(p_points jsonb)`** (SECURITY DEFINER) : livreur actif,
  ≤ 100 points par appel, points dans le carré de Nosy Be, horodatages plausibles (pas dans le
  futur, pas plus vieux que 2 h), **refus si le livreur ne tient aucune commande `en_livraison`**.
  Met à jour `couriers.derniere_*`.
- **RPC `suivi_livreur(p_order_id)`** (SECURITY DEFINER) — la seule porte côté client :
  - appelant = **propriétaire de la commande** (ou admin) ;
  - commande `en_livraison` **et** livreur assigné ; sinon renvoie « pas de suivi » ;
  - rend : dernière position + son âge, **trace** de ce livreur depuis `claimed_at` (allégée à
    ~1 point / 50 m, 300 points max), position du restaurant et du client, phase
    (vers le restaurant / vers toi / arrive / devant chez toi), distance restante, estimation
    d'arrivée (modèle existant : 13,8 min + 1,69 min/km × 1,3 de coefficient route) ;
  - ⚠️ **jamais** la position du livreur après la livraison, ni celle d'une autre tournée que la
    sienne au-delà de ce qui est nécessaire (voir Q4 : tournée multi-clients).
- **Purge** : tâche pg_cron quotidienne, positions de plus de **7 jours** effacées.
- Admin : `admin_positions_livreurs()` → dernière position de chaque livreur en course
  (carte dans l'onglet Temps réel).
- ⚠️ Vérifier chaque droit **par PostgREST avec la clé publiable** (jamais par `execute_sql`, qui
  contourne la RLS) : anon refusé, autre client refusé, livreur non assigné refusé.

### 5.3 Côté client — la carte de suivi (`order/[id].tsx`)
- Carte affichée dès qu'un livreur a pris la commande, jusqu'à la livraison :
  marqueur **restaurant**, marqueur **client**, marqueur **livreur** (scooter), **trace** parcourue
  (trait plein), ligne pointillée livreur → prochaine étape.
- Texte : « Position il y a 40 s » · « ~8 min · 2,4 km ».
  Position de plus de **3 min** : « Signal du livreur perdu il y a 4 min (réseau) » — honnête,
  pas de point figé présenté comme frais.
- **Rafraîchissement (option 2)** :

| Situation | Automatique |
|---|---|
| Livreur vers le restaurant, ou à plus d'1 km | toutes les **60 s** |
| « J'arrive » appuyé, ou à moins d'1 km | toutes les **20 s** |
| App en arrière-plan / onglet caché | **arrêt**, relecture immédiate au retour (`useSondage`) |

  Bouton **« Actualiser »** : relit tout de suite, puis **grisé 15 s** (compte à rebours visible)
  pour éviter le martèlement.
- **Mobile** : `react-native-maps` déjà dans le binaire client (MapKit iOS, Google Maps Android —
  gratuits). Marqueurs + `Polyline` : **OTA possible** sur les binaires 1.2.x (à vérifier au
  lot 0 : rien de natif nouveau côté client).
- **Web** (`taxifood.distripro207.com`) : remplacer l'image fixe par **Leaflet** + tuiles OSM
  (avec attribution ; politique d'usage OSM compatible avec ce volume) dans
  `MapSurface.web.tsx` ou un composant `CarteSuivi.web.tsx`.
- Commandes par téléphone : pas de compte client → pas de suivi (inchangé).

### 5.4 Itinéraire prévu (facultatif — lot 6)
- La **V1 n'appelle pas Google** : trace réelle + ligne droite pointillée + estimation maison.
- V2 si souhaité : fonction Edge `itineraire-livraison` → Google **Routes API** avec une **clé
  serveur distincte** (jamais dans le binaire), résultat **mis en cache par commande et par
  étape**. Recalcul seulement si le livreur s'écarte de > 300 m **et** si le dernier calcul a
  plus de 2 min. **Plafond** : 10 appels par commande, compteur mensuel global ; au-delà, retour
  à la ligne droite.

### 5.5 Coût (rappel du diagnostic)
- Volume réel (30 j au 2026-10-16) : **77 livraisons, 2,6/jour, max 7/jour**, durée médiane
  prête → livrée **23 min** (90ᵉ centile 52 min).
- Carte native (iOS/Android) : **gratuite, illimitée**. Positions Supabase : ~30 000 écritures
  par mois au pire → dans le forfait. Leaflet/OSM : gratuit.
- Itinéraire Google (V2) : gratuit jusqu'à 10 000 appels/mois, puis 5 $ / 1 000. Avec le plafond
  du § 5.4 : **0 $** jusqu'à environ 30 livraisons par jour.

---

## 6. Points transverses à régler

### 6.1 ⚠️ Jetons push par APPLICATION (bloquant pour la 2ᵉ app)
`notify-order` envoie à **tous les jetons du compte**. Le porteur du projet, client ET livreur,
recevrait les « course disponible » dans l'app client et ses notifications de client dans l'app
livreur.
→ `push_tokens.app` (`client` | `livreur`, défaut `client` pour les apps déjà installées) ;
`register_push_token` reçoit l'app (**nouveau nom de fonction ou paramètre à défaut, jamais une
surcharge** — piège PGRST203) ; `notify-order` **et** `envoyer-annonce` **et**
`relancer-orange-money` filtrent : audience `livreur` → jetons `livreur` ; audiences `client` et
`restaurant` → jetons `client`. Les trois fonctions ne sont pas factorisées : corriger les trois.

### 6.2 Surfaces de livraison : on passe de 4 à 5
Base · app client (OTA ×3 runtimes) · web · admin · **app livreur (OTA sur son propre projet)**.
À ajouter à la section « Une correction se livre sur… » de `CLAUDE.md` le jour du premier build.

### 6.3 Clé Google Maps Android
Écrite en clair dans `app.json` (donc dans le dépôt). Vérifier dans Google Cloud qu'elle est
**restreinte** aux packages Android (client ET livreur, avec leurs empreintes) et à l'API
« Maps SDK for Android ».

### 6.4 Confidentialité
- Le livreur est informé (écran d'accueil de l'app + texte d'autorisation) que sa position est
  partagée **uniquement pendant ses courses**, avec le client concerné et Taxi Food.
- Aucune position hors course, aucune donnée gardée plus de 7 jours.
- Textes d'autorisation iOS (`NSLocationAlwaysAndWhenInUseUsageDescription`,
  `NSLocationWhenInUseUsageDescription`) rédigés en français, précis — Apple rejette les textes
  vagues.

---

## 7. Découpage en lots (un à la fois, vérifié avant le suivant)

| Lot | Contenu | Livraison | Dépend de |
|---|---|---|---|
| **0** | Preuve de faisabilité : `app.config.ts` + `APP_VARIANT` + `EXPO_ROUTER_APP_ROOT`, build de dev livreur installé **à côté** de l'app client sur l'iPhone du porteur et un Android | build de dev | — |
| **1** | Base : `orders.claimed_at`, `positions_livreur`, `couriers.derniere_*`, RPC `livreur_envoyer_positions` + `suivi_livreur`, purge pg_cron, `push_tokens.app` + filtres des 3 fonctions Edge. Recette SQL (transaction annulée) + PostgREST clé publique | migration + Edge | — |
| **2** | App livreur : reprise de l'existant (§ 2.2–2.5) dans `app-livreur/`, connexion Google/Apple/e-mail, écran « pas livreur », Naviguer, écran allumé, récap du jour | build | 0, 1 |
| **3** | App livreur : émission GPS en arrière-plan, file hors ligne, bandeau d'état GPS, notification permanente Android | build | 2 |
| **4** | App client : carte de suivi, rafraîchissement 60 s / 20 s, bouton Actualiser 15 s, signal perdu. Mobile (OTA ×3) + **web Leaflet** | OTA + Netlify | 1 |
| **5** | Admin : carte des livreurs en course dans Temps réel | Netlify admin | 1 |
| **6** (facultatif) | Itinéraire Google avec cache et plafond | Edge | 4 |
| **7** | Stores : Play test interne + déclarations, TestFlight puis demande « Unlisted », fiche confidentialité ; message dans l'app client « Utilise l'app Livreur » | stores + OTA | 2, 3 |

Les lots 1 et 4 peuvent avancer pendant que le lot 0 est validé. **Le lot 4 ne doit pas sortir
avant le lot 3** : une carte de suivi sans livreur qui émet n'affiche que « signal perdu ».

---

## 8. Recette (à passer sur appareils réels)

1. iPhone du porteur : app client ET app livreur installées, même compte → les push arrivent
   dans la **bonne** app.
2. Je la prends → la carte apparaît chez le client avec le livreur ; trace qui s'allonge.
3. Livreur sur Google Maps, écran verrouillé 10 min → la position continue d'arriver
   (iOS ET Android).
4. Mode avion 2 min puis retour → les points en file arrivent, la trace se comble.
5. Client : rafraîchissement 60 s loin, 20 s après « J'arrive » ; bouton grisé 15 s ;
   app en arrière-plan = aucune requête.
6. Livrée → la carte disparaît, `suivi_livreur` ne rend plus rien, aucune position émise.
7. Disponible sans course → aucune position émise.
8. Clé publique : `positions_livreur` illisible ; `suivi_livreur` refusé pour une commande
   d'autrui ; `livreur_envoyer_positions` refusé sans rôle livreur actif.
9. Web à 375 px : carte Leaflet lisible, pas de défilement horizontal.
10. Tournée de 3 commandes chez 2 restaurants : chaque client voit le livreur ; rien de plus
    que ce que la règle Q4 autorise.

---

## 9. Questions ouvertes (à trancher avant le lot concerné)

| # | Question | Proposition par défaut |
|---|---|---|
| Q1 | Identifiants des apps (bundle/package) et nom affiché | `com.chris97416.taxifood-livreur` / `com.chris97416.taxifoodlivreur`, « Taxi Food Livreur » |
| Q2 | Téléphones des 2 autres livreurs : Android ou iPhone ? | détermine l'ordre des lots 7 |
| Q3 | Position d'un livreur **disponible sans course** visible par l'admin (pour assigner le plus proche) ? | **non** en V1 (vie privée), à rediscuter |
| Q4 | Tournée multi-clients : le client B voit-il le livreur pendant qu'il livre le client A ? | **oui, position seulement**, avec « Il livre une autre commande avant la tienne » (jamais l'adresse de A) |
| Q5 | Itinéraire Google (lot 6) : on le fait ? | **non en V1**, trace + ligne droite |
| Q6 | Durée de conservation des positions | **7 jours** |
| Q7 | Récap « espèces à remettre » dans l'app livreur | **oui** (lot 2), sans rémunération |
| Q8 | `demo.livreur` pour la revue Apple de l'app livreur | à garder actif, une commande de test à préparer pendant la revue |

---

## 10. Hors périmètre

Rémunération des livreurs, attribution automatique (dispatch), zones de livraison par livreur
(`couriers.zone` existe mais n'est pas utilisé), notation du livreur, pourboire.
