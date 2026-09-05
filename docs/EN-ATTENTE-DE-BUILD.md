# En attente de build

Ce qui est écrit et poussé mais **pas encore dans une app installable**. Décision prise le
2026-08-18 : on empile plusieurs chantiers et on ne fait qu'un seul build, la liaison de
Nosy Be rendant chaque envoi coûteux (~8 min rien que pour téléverser).

**À mettre à jour à chaque chantier, et à vider après chaque build.**

## Dernier build sorti

**n°17** — `1.0.0 (17)`, soumis à TestFlight le 2026-08-19, traitement Apple **terminé** le
jour même (build lancé en interactif par Christopher après passage au plan payant EAS, le
quota gratuit ayant été épuisé). **C'est le build de soumission App Store.**

Contient tout ce qui suit, chacun vérifié avant l'envoi :

| Chantier | Vérifié |
|---|---|
| **Facebook en Limited Login** — corrigé et **confirmé sur appareil réel** (identité `provider='facebook'` créée en base). Librairie remise en 13.4.3 | testé sur appareil |
| **Diagnostic `[diag]` retiré** de l'écran de connexion — « Bad ID token » ne veut rien dire pour un client ; le message brut reste en console | relu, aucune trace résiduelle |
| **Bouton « Continuer avec un numéro » masqué** — les secrets WhatsApp ne sont pas posés, le bouton échouait (rejet Apple règle 2.1). Piloté par `EXPO_PUBLIC_PHONE_LOGIN_ENABLED`, absent = masqué | tsc + export web + **rendu vérifié dans un navigateur** : « E-mail » prend toute la largeur, aucun trou |
| **Commandes mortes du Profil** — « Ajouter » (adresses) et « … » retirés ; « Modifier » (téléphone) branché sur `/phone`. C'étaient des `<Text>` sans gestionnaire (règle 2.1) | tsc + **build simulateur installé et parcouru** : les deux affordances mortes ont disparu, « Modifier » ouvre bien l'écran téléphone avec son bouton retour |
| **Tiret solitaire à la place des horaires** sur la fiche restaurant — `hoursLabel()` renvoie une chaîne vide quand `opens_at`/`closes_at` manquent, et l'élément est masqué | tsc + **vérifié à l'écran** sur La Cabane, avant/après |
| **Correctif polices** (n°16 déjà) — attente des polices sur natif avant le 1er rendu, évite « TAXI FOO » tronqué | vérifié à l'écran |

Historique des tentatives Facebook, toutes fondées sur un diagnostic erroné avant le n°16 :
n°15 figeait la librairie en 12.2.0 pour forcer le flux classique ; n°14 posait
`loginTrackingIOS: 'enabled'` (sans effet sur la 13.x). Avant : n°13 construit à la main en
interactif (capability Sign In with Apple) ; n°12 réussi sans conséquence ; n°11 échoué
(profil sans cette capability).

## Dans le prochain build

| Chantier | Vérifié |
|---|---|
| **Navigation libre du catalogue — réponse au rejet Apple 5.1.1(v) du 2026-08-23.** L'app s'ouvrait sur l'écran de connexion ; elle s'ouvre désormais sur la liste des restaurants. Parcourir les restaurants, un menu, une fiche produit et remplir son panier ne demande plus de compte. Le compte n'est exigé qu'à l'entrée du tunnel de commande (`/address`), qui porte l'unique garde de l'app. Écran de connexion doté d'une croix de sortie (il n'en avait aucune), onglets Commandes et Profil dotés d'un état visiteur explicite, espaces pro (`(restaurant)`, `(livreur)`) dotés de leur propre garde de rôle — `app/index.tsx` était jusque-là leur seule protection. | `tsc --noEmit` ✅ · parité des 3 fichiers de langue ✅ (272 clés) · **parcours anonyme complet vérifié dans un navigateur** : accueil → menu → fiche produit → panier (36 000 Ar) → « Commander » → connexion → croix → retour au panier intact ; onglets Commandes et Profil visiteur ; liens profonds `/(restaurant)`, `/(livreur)`, `/role-select`, `/address` tous refermés. ⚠️ **Les parcours CONNECTÉS restent à vérifier sur appareil** (compte SMS neuf sans nom ni téléphone, compte multi-rôle, espaces pro) — voir la recette ci-dessous |
| **Revue adversariale du chantier ci-dessus (2026-08-23), six défauts corrigés.** (1) **Boucle sur `/role-select`** : le Profil visiteur y envoyait via « Devenir partenaire », mais l'intention n'était jamais consommée — « Continuer comme client » repassait par `/`, qui relisait la même intention et y renvoyait aussitôt. L'écran n'ayant ni onglets ni retour, la seule sortie était la déconnexion. (2) **Second `(tabs)` empilé à chaque connexion** : depuis que la connexion est *posée par-dessus* le catalogue, `replace('/(tabs)')` créait un `(tabs)` NEUF et laissait l'original dessous — le retour Android / le glissé iOS dévoilaient un deuxième navigateur d'onglets (et, si l'inscription avait été empilée, rouvraient la connexion). (3) **Fausse barre de recherche** sur l'écran d'atterrissage : `<View>` + `<Text>` déguisés en champ de saisie — remplacée par une **vraie recherche** (nom, cuisine, zone, types de plats ; insensible aux accents ; filtrage local, aucune requête de plus). (4) **Trois `<Pressable>` sans gestionnaire** : cœur « favori » de la fiche restaurant retiré (pas de favoris au MVP), lignes « Aide & contact » des deux Profils branchées sur la page d'assistance en ligne. (5) **`/login-phone` court-circuitait l'écran du NOM** : `session.phone` retombe sur le numéro d'authentification, donc toujours renseigné pour un compte WhatsApp — le compte entrait sans nom et restait « Client » sur la commande. (6) **`/checkout` sans garde** : `taxifood:///checkout` ouvrait le paiement à un visiteur ; second verrou posé. Plus deux durcissements : hydratations session/panier en `try/finally` + délai maximal de 8 s sur le splash (une app figée au lancement = rejet 2.1), et liste **fermée et typée** des retours possibles (`RETOURS` dans `store/authIntent.ts`) — renommer une route casse désormais le build au lieu du parcours. | `tsc --noEmit` ✅ · `expo export -p web` ✅ · parité des 3 fichiers de langue ✅ (274 clés) · **navigateur** : recherche « crepe » → La Cabane (accents ignorés), croix d'effacement, compteur cohérent ; fiche menu sans cœur mort ; Profil visiteur « Aide & contact » exposé en lien ; `taxifood:///checkout` → connexion puis croix → catalogue · **preuves hors interface** (parcours connectés impossibles à piloter sans identifiants) : la boucle `/role-select` est reproduite puis résolue en rejouant la vraie fonction `destination()` extraite de `app/index.tsx` sur six scénarios ; la duplication de `(tabs)` est reproduite puis résolue contre le réducteur `StackRouter` d'expo-router 57 lui-même |

Recette restante, à passer sur appareil réel avant l'envoi :

1. Connexion avec un compte Google existant depuis « Commander » → on doit arriver sur
   **`/address`**, panier intact (et pas sur l'accueil).
2. Compte SMS **neuf** (sans nom, sans téléphone) depuis « Commander » → nom → téléphone →
   **`/address`**. C'est le cas le plus dur : l'intention de retour doit traverser les deux
   écrans intermédiaires.
3. Profil connecté → « Modifier » le téléphone → enregistrer → retour aux **onglets**
   (et surtout pas `/address`).
4. Comptes pro : restaurant, livreur, et multi-rôle avec mode persisté → espaces inchangés.
5. Déconnexion depuis le Profil → l'accueil reste parcourable (plus de mur de connexion).
6. **Après connexion, appuyer sur RETOUR** (bouton Android, glissé iOS) : l'app doit se
   fermer, et surtout pas dévoiler un second jeu d'onglets ni rouvrir la connexion. À
   refaire après un cycle déconnexion / reconnexion, c'est là que les copies s'empilaient.
7. Profil visiteur → « Devenir partenaire » → se connecter avec un compte **client simple** →
   « Continuer comme client » : on doit sortir sur les onglets. C'était la boucle sans issue.
8. Compte multi-rôle **avec un panier en cours** : « Commander » → connexion → sélection de
   rôle → « Continuer comme client » → on doit atterrir sur **`/address`**, pas sur l'accueil.

⚠️ Piège connu, à ne pas « nettoyer » : `app/index.tsx` lit l'intention de retour **une
seule fois** (`useState(() => …)`), ne navigue **qu'une fois** (`navigated`), et n'efface
l'intention que lorsqu'elle SERT de destination (`href === intent`). Rendre cette lecture
réactive, effacer plus tôt, ou effacer sur une simple liste d'écrans « de transit » : les
trois ont déjà cassé le parcours (le dernier a produit la boucle `/role-select`).

⚠️ Piège connu : ne pas remettre `router.replace('/(tabs)')` là où le code appelle
`retourOnglets()` (`lib/nav.ts`). `(tabs)` est la RACINE de la pile depuis l'ouverture du
catalogue ; un `replace` en pose une seconde copie au lieu de revenir à la première.

⚠️ Reste connu, volontairement NON corrigé : les gardes de `(restaurant)/_layout.tsx` et
`(livreur)/_layout.tsx` sortent par `<Redirect href="/(tabs)" />`, donc par un `replace` —
elles peuvent encore laisser un `(tabs)` de trop. Le cas est étroit (un rôle pro retiré
pendant qu'on est DANS l'espace pro) et ces deux gardes ont déjà produit un
« Maximum update depth exceeded » quand on y a touché : à ne reprendre que manette en main,
avec un compte pro pour vérifier.

⚠️ Piège rencontré et corrigé : dans `(restaurant)/_layout.tsx` et `(livreur)/_layout.tsx`,
la garde sort vers `/(tabs)` et **non** vers `/`. Depuis l'intérieur d'un groupe, `/` se
résout sur l'`index` de ce même groupe : la garde se redéclenchait à l'infini
(« Maximum update depth exceeded », reproduit puis corrigé).

⚠️ Voir [SOUMISSION-APPLE.md](SOUMISSION-APPLE.md) et [FICHE-APP-STORE.md](FICHE-APP-STORE.md)
pour la suite : choisir ce build dans App Store Connect, remplir la fiche, App Privacy et le
classement d'âge, puis Submit for Review.

## Ce qui n'a PAS besoin d'un build

À ne pas confondre : ces points sont bloqués, mais pas par la compilation.

| Sujet | Ce qui manque | Pourquoi aucun build n'est nécessaire |
|---|---|---|
| **Connexion par WhatsApp** | les 5 secrets Meta dans le Vault | ⚠️ nuance depuis le 2026-08-19 : le **bouton est désormais masqué** (`EXPO_PUBLIC_PHONE_LOGIN_ENABLED`), donc poser les secrets ne suffit plus à le faire réapparaître — il faudra aussi un build. La chaîne serveur, elle, reste prête |
| **Sign in with Apple côté serveur** | ✅ fait le 2026-08-18 | bundle ID renseigné dans *Authentication → Providers → Apple → Client IDs* |
| **Connexion Google native côté serveur** | ✅ fait le 2026-08-18 | Client ID iOS ajouté dans *Authentication → Providers → Google → Client IDs*, **et** « Skip nonce check » activé (les SDK natifs mobiles ne savent pas satisfaire le nonce que Supabase attend par défaut — recommandation officielle de leur doc) |
| **Connexion Facebook native côté serveur** | ✅ fait le 2026-08-18 | App Secret posé, permission `email` ajoutée côté Meta (Use Cases → Authentication and Account Creation — absente du prompt Cowork d'origine), « Allow users without an email » activé en filet de sécurité |
| **Prix réels** | le vrai catalogue | ils viennent de la base, pas du bundle |
| **Fiche App Store** | ✅ textes rédigés le 2026-08-19 ([FICHE-APP-STORE.md](FICHE-APP-STORE.md)) ; restent les captures et le classement d'âge à trancher | métadonnées App Store Connect |
| **Politique de confidentialité et page d'aide** | ✅ en ligne le 2026-08-18 | pages statiques dans `app/public/`, servies par la PWA |

### ⚠️ Le site Netlify n'est PAS relié au dépôt

Constaté le 2026-08-18 : le déploiement de production porte `deploy_source: cli`, sans
commit ni branche. **Pousser sur `main` ne déploie rien.** Le site public était resté deux
jours en retard sans que personne ne le voie.

Tant que le dépôt n'est pas relié dans l'interface Netlify (*Site configuration → Build &
deploy → Link repository*, base directory `app`), toute modification du web doit être
publiée à la main :

```bash
cd app && npx expo export -p web && npx netlify deploy --prod --dir dist --site 7a0f7a83-425b-4b90-a11f-9a16d291121b
```

Les URL publiques :
- https://taxi-food-nosybe.netlify.app/confidentialite.html
- https://taxi-food-nosybe.netlify.app/support.html

## ⚠️ Rappel pour le prochain build qui touche aux capabilities Apple

S'il faut un jour ajouter une nouvelle capability côté portail Apple (Push, Sign In with
Apple, etc.), le build **doit être lancé par Christopher lui-même dans son propre terminal**,
en interactif (`eas build -p ios --profile production`, sans `--non-interactive`). Un agent
ne peut pas taper un identifiant Apple — lancé depuis un outil sans terminal réel, EAS
détecte l'absence de TTY et bascule silencieusement en mode non-interactif, réutilisant
l'ancien profil sans jamais contacter Apple. C'est exactement ce qui a fait échouer les
builds 7, 8 et 11.

Google et Facebook natifs n'ont besoin d'aucune capability côté portail Apple — seuls des
schémas d'URL dans Info.plist, gérés par leurs plugins de config sans jamais toucher aux
serveurs Apple. Un build non-interactif suffit pour ces deux-là.

## Registre tu/vous unifie (2026-08-24)

37 chaines de l'application changees, non encore compilees.

- `app/locales/fr.json` : 36 chaines. L'espace client passe de 21 tutoiements
  contre 28 vouvoiements a **49 tutoiements et zero vouvoiement**.
- `app/components/RefuseSheet.tsx` : ecran restaurant, passe au vouvoiement.

Regle appliquee : **on tutoie les personnes, on vouvoie les entreprises.**
Client et livreur au « tu », restaurateur au « vous ». L'espace livreur
tutoyait deja et n'a pas ete touche.

⚠️ A verifier sur appareil au prochain build : les titres sur deux lignes,
dont le saut de ligne a ete conserve a la meme place — `phone.askTitle`,
`phone.loginTitle` (« Ton numero\nde telephone ») et `authEmail.askNameTitle`
(« Comment\nt'appelles-tu ? »). Un titre qui deborde ne se voit qu'a l'ecran.

## Tournée du livreur : jusqu'à 3 commandes (2026-08-25)

Le livreur ne pouvait tenir qu'**une** commande à la fois. Il peut désormais en
tenir **trois**, à condition qu'elles viennent **toutes du même restaurant**.

- Base : RPC `claim_order` — la règle est côté serveur, pas côté écran.
- App : `data/api.ts` (`listMyActiveDeliveries` remplace `getMyActiveDelivery`,
  la file des disponibles se filtre sur le restaurant en cours) et
  `app/(livreur)/index.tsx` (section « Ma tournée · n/3 »).

⚠️ **À vérifier sur appareil au prochain build :**
- prendre trois commandes du même restaurant, la quatrième doit être refusée ;
- après la première prise, la file ne doit plus montrer que ce restaurant ;
- abandonner une commande doit libérer une place ;
- livrer une commande doit libérer une place et faire réapparaître la file.

## Écran de validation : marchandise et livraison séparées (2026-08-25)

Le panier montrait déjà les trois lignes. L'écran de **validation** n'affichait
qu'un total unique — `app/checkout.tsx` affiche maintenant marchandise,
livraison, puis total.

⚠️ **À vérifier sur appareil** : que le bas d'écran reste lisible avec trois
lignes au lieu d'une, notamment sur un petit téléphone.

## Espace réglages du restaurateur (2026-08-25)

Nouvel onglet **Réglages** dans l'espace restaurant : horaires, ouverture
automatique, bascule manuelle, et mise en rupture produit par produit.

- Base : `restaurants.auto_open`, fonction `ouvert_maintenant()`, RPC
  `set_restaurant_hours` / `set_restaurant_open` / `set_product_available`.
  Tout est déjà actif — seul l'écran attend le build.
- App : `app/(restaurant)/reglages.tsx`, `data/api.ts`, `data/types.ts`.
- Le badge produit passe de « Indisponible » à « **Bientôt de retour** ».

⚠️ **À vérifier sur appareil :**
- saisir « 8h30 » et « 22h » — les formes libres doivent être acceptées ;
- basculer l'ouverture automatique, vérifier que la bascule manuelle disparaît ;
- mettre un produit en rupture, puis le retrouver grisé côté client avec la
  mention « Bientôt de retour », toujours visible mais non commandable.

## Pied de page : version et date (2026-08-25)

`app/lib/version.ts` remplace le « v1.0 MVP » codé en dur.

⚠️ **`DATE_MISE_A_JOUR` est à remonter À CHAQUE BUILD envoyé aux magasins.**
C'est une ligne, et c'est le seul geste de sortie manuel du projet.

## Mises à jour OTA activées (2026-09-05)

`expo-updates` installé, `runtimeVersion` en politique `appVersion`, URL `updates`
vers le projet EAS existant, et un `channel` par profil dans `eas.json`.

⚠️ **Ce build-ci doit encore passer par les magasins** — c'est lui qui embarque le
client de mise à jour dans le binaire. **Après** lui, tout changement purement JS
(libellés, écrans, logique) pourra partir par `eas update --branch production`, sans
revue Apple. Les changements natifs (nouveau module, permission, icône) continueront
d'exiger un vrai build.

## Horaires par jour de la semaine (2026-09-05)

Remplace le créneau unique `opens_at`/`closes_at` valable tous les jours.

- Base : table `restaurant_hours` (une ligne par jour, 0 = dimanche), fonction
  `ouvert_maintenant()` réécrite pour lire le planning du jour, `horaires_du_jour()`
  pour l'affichage, RPC `set_restaurant_week_hours` / `set_restaurant_auto_open`.
  `set_restaurant_hours` a été **supprimée**.
- App : `reglages.tsx` (liste des 7 jours), `data/api.ts`, `data/types.ts`,
  `RestaurantCard.tsx`, `restaurant/[id].tsx`.

✅ Déjà vérifié : les 3 cas de calcul en SQL (jour ouvert, jour fermé, créneau à
cheval sur l'heure courante), les RPC avec un vrai jeton partenaire, et le rendu
des 7 jours sur simulateur.

⚠️ **À vérifier sur appareil :**
- saisir des horaires différents lundi et samedi, enregistrer, puis activer
  l'ouverture automatique et vérifier le badge Ouvert/Fermé côté client ;
- marquer un jour « Fermé » et vérifier qu'il ferme bien ce jour-là.

⚠️ **Aucun restaurant existant ne change de comportement** tant qu'il n'active pas
l'ouverture automatique : `auto_open` est à `false` partout.

## Logo et couverture déposés par le partenaire (2026-09-05)

Le partenaire choisit ses visuels depuis son téléphone ; le recadrage est fait par
l'OS (1:1 pour le logo, 16:9 pour la couverture), donc pas de cropper maison.

- Base : bucket `partenaires` (lecture publique, **écriture réservée au personnel
  actif du restaurant et limitée à son propre dossier**), RPC `set_restaurant_photo`.
- App : `expo-image-picker` (**nouveau module natif** — d'où la nécessité du build),
  `reglages.tsx`.

✅ Déjà vérifié côté serveur : dépôt dans son dossier accepté, dans celui d'un autre
restaurant refusé, dépôt anonyme refusé.

⚠️ **À vérifier sur appareil :** changer le logo puis la couverture, et les retrouver
correctement cadrés sur la fiche restaurant et la carte d'accueil.

## Mise à l'affiche : plats du jour réutilisables (2026-09-05)

« À l'affiche » est un état d'un produit. Retirer un plat du jour ne l'efface pas :
il retourne en bibliothèque, prêt à être remis en un tap avec son formulaire
pré-rempli. N'importe quel produit de la carte peut aussi être mis en avant, avec un
libellé libre (« Pizza de la semaine », « Suggestion du chef »).

- Base : `products.is_featured` / `featured_label` / `in_menu` / `is_archived` /
  `stock_quantity`, RPC `save_featured_product` / `set_product_featured` /
  `set_product_stock` / `archive_product`.
- App : `reglages.tsx` (section À l'affiche + bibliothèque + étoile sur la carte),
  `restaurant/[id].tsx` (carrousel client), `data/api.ts`, `data/types.ts`.

✅ Déjà vérifié en transaction annulée : cycle complet créer → retirer → remettre à
l'affiche photo intacte → ajuster le prix, mise en avant d'un plat de la carte, et
les refus attendus. Rendu de l'écran partenaire vérifié sur simulateur.

⚠️ **À vérifier sur appareil, jamais fait faute de pouvoir écrire sur un restaurant
en activité :**
- créer un plat à l'affiche avec photo depuis l'écran, et le voir apparaître dans le
  carrousel en haut de la fiche restaurant ;
- le retirer, vérifier qu'il tombe en bibliothèque **sans perdre sa photo**, puis le
  remettre à l'affiche en un tap ;
- mettre la quantité à 0 et vérifier qu'il passe grisé côté client ;
- mettre une pizza de la carte en avant par l'étoile : elle doit apparaître dans le
  carrousel **et** rester dans sa catégorie.

⚠️ La quantité est un compteur **annoncé**, décrémenté à la main : `create_order`
n'a pas été touché, il n'y a donc aucune réservation atomique.

## Emoji sur les filtres de l'accueil (2026-09-05)

Les puces de type de plat affichent désormais 🍕 Pizza, 🌮 Tacos, 🥙 Kebab, 🍔 Burger,
🌭 Américain, 🥪 Panini, 🥞 Crêpe, 🥤 Milkshake, 🍢 Tapas.

- App uniquement : `FOOD_TYPE_ICON` dans `data/types.ts`, rendu dans `app/(tabs)/index.tsx`.
  Rien en base.
- Le vocabulaire reprend celui déjà utilisé dans `categories.icon`.

✅ Vérifié sur simulateur.

## Label « Contient du porc » (2026-09-05)

Badge ambre sur la ligne produit. À Nosy Be une part importante de la clientèle ne
mange pas de porc : la composition en toutes lettres ne suffit pas, il faut le voir
sans ouvrir la fiche.

- Base : `products.diet_tags` (tableau de libellés, extensible à « piquant » /
  « végétarien » plus tard), RPC `set_product_diet_tags`. **Déjà actif** — seul le
  badge attend le build.
- App : `components/ProductRow.tsx`, `data/api.ts`, `data/types.ts`.

⚠️ **Seul ce qui est explicite est tagué.** Les pizzas d'Angelo et de Taxi Be sont au
jambon **de volaille** : les taguer porc par similarité de nom (« Reine »,
« Pepperoni ») aurait été un contresens coûteux.

⚠️ **La liste complète de ce qui reste à confirmer est dans
[docs/LABELS-ALIMENTAIRES.md](LABELS-ALIMENTAIRES.md)** — 5 produits et 2 suppléments,
répartis sur trois restaurants. Le porteur du projet fait le point avec chaque
restaurateur, puis répond produit par produit ; rien n'est tagué avant.
Sur un label de confiance, ne rien afficher vaut mieux qu'une supposition.

## Carte pizzas Chez Bidul & Truc + frais d'emballage (2026-09-05)

13 pizzas au feu de bois, avec visuels, compositions et prix.

- Base : catégorie `Pizza`, 13 produits, `food_types` complété. **Déjà actif.**
- Base : `products.packaging_fee` / `packaging_label`, `orders.packaging_fee`, et
  `create_order` qui ajoute l'emballage au total. **Déjà actif.**
- App : ligne « Boîte à pizza » dans le panier, le récapitulatif de commande, le
  détail d'une commande passée et la carte commande côté restaurant.

✅ Vérifié : calcul serveur en transaction annulée (2 pizzas + 1 dessert →
marchandise 62 000, emballage 4 000, livraison 5 000, total 71 000, commission sur
la marchandise seule) **et** affichage réel dans le panier du simulateur.

⚠️ **La boîte n'est PAS une option que le client coche.** Une première version la
modélisait en groupe d'options obligatoire : complication inutile, corrigée. C'est
un frais porté par le produit, comme la livraison est portée par le restaurant.
Une boîte par pizza — deux pizzas, deux boîtes.

⚠️ **Décalage à connaître :** les colonnes et `create_order` sont déjà actives, donc
**l'app installée facture déjà l'emballage** ; mais elle ne sait pas encore
l'AFFICHER (la ligne attend le build). Le client verrait donc un total supérieur à
la somme qu'il calcule de tête. **Si le build tarde, remettre `packaging_fee` à 0
sur les 13 pizzas** et le repositionner au moment de la sortie.

⚠️ **Deux points tranchés faute de réponse, à confirmer :** « fromage montage » de la
carte papier a été écrit « fromage de **montagne** » ; `cuisine_type` est resté
« Bar & Tapas » alors qu'un four à bois justifierait « Restaurant, Bar & Pizzeria ».

## Deux pièges rencontrés le 2026-09-05, à ne pas refaire

1. **Sélecteur Zustand renvoyant un nouveau tableau** → « Maximum update depth
   exceeded », écran panier en boucle infinie. Une fonction qui construit un tableau
   se consomme avec `useMemo` dans l'écran, jamais dans `useCart((s) => ...)`.
2. **Liste de colonnes écrite à la main** dans `getProductDetail` au lieu de
   `PRODUCT_COLS` : le produit arrivait sans `packaging_fee`, donc la ligne
   n'apparaissait pas au panier alors que la base était juste. Toute requête sur
   `products` passe par `PRODUCT_COLS`.

## 🔜 Partage social des produits et restaurants (cadré le 2026-09-05, PAS ENCORE ÉCRIT)

Bouton de partage sur une fiche produit et sur une fiche restaurant : le destinataire
reçoit un lien WhatsApp avec aperçu (photo, nom, prix). S'il a l'app, elle s'ouvre
**directement sur la fiche** ; sinon une page web s'ouvre et le renvoie vers le store
correspondant à son téléphone.

⚠️ **Le schéma `taxifood://` ne peut pas servir à ça** : collé dans WhatsApp il n'est pas
cliquable, et ne fait rien chez qui n'a pas l'app. Il faut de vrais liens `https://`
(Universal Links iOS / App Links Android) sur `taxifood.rentanoo.com` — domaine déjà en
ligne sur Netlify.

**Éléments identifiés :**

| | Valeur |
|---|---|
| Team ID Apple | `CV2FA6NJ75` |
| Bundle iOS | `com.chris97416.taxi-food-nosybe` |
| Package Android | `com.chris97416.taxifoodnosybe` |
| Empreinte SHA-256 **de dépôt** (EAS, `Default`) | `02:05:17:F9:C3:DD:6E:15:1F:20:08:EC:C6:9E:85:9A:41:77:68:1A:DA:20:26:6A:FB:D4:10:9E:93:95:03:D4` |
| Empreinte SHA-256 **de signature Google** (Play App Signing) | `9E:83:EC:47:51:33:B9:01:63:15:63:25:6D:E0:AD:55:DE:EF:FE:81:00:1D:F3:5C:7D:94:7B:AE:BB:CA:8C:74` |

⚠️ **Ne pas confondre les deux empreintes Android.** Google re-signe l'app avec SA clé
(Play App Signing). C'est **son** empreinte que vérifient les App Links, pas celle d'EAS.
Ne mettre que celle d'EAS ferait tomber tous les liens partagés dans le navigateur au lieu
de l'app — symptôme pénible à diagnostiquer. `assetlinks.json` accepte **plusieurs**
empreintes : on met les deux.

✅ **Récupérée le 2026-09-05** en Play Console (*Protected with Play → App signing*) : elle
existait déjà, puisqu'elle est générée dès le premier dépôt du bundle et non à la validation.
Le fichier est donc écrivable dès maintenant, sans attendre le retour de Google :

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.chris97416.taxifoodnosybe",
    "sha256_cert_fingerprints": [
      "9E:83:EC:47:51:33:B9:01:63:15:63:25:6D:E0:AD:55:DE:EF:FE:81:00:1D:F3:5C:7D:94:7B:AE:BB:CA:8C:74",
      "02:05:17:F9:C3:DD:6E:15:1F:20:08:EC:C6:9E:85:9A:41:77:68:1A:DA:20:26:6A:FB:D4:10:9E:93:95:03:D4"
    ]
  }
}]
```

⚠️ À servir sur `https://taxifood.rentanoo.com/.well-known/assetlinks.json`, en
`Content-Type: application/json`, **sans redirection** — Android refuse de suivre une
redirection sur ce fichier, et l'échec est silencieux.

**À faire :**
1. Page produit + page restaurant sur le site, avec balises Open Graph **rendues côté
   serveur** (fonction Netlify lisant Supabase). WhatsApp et Facebook n'exécutent pas le
   JavaScript : un aperçu généré en JS ne s'afficherait jamais.
2. `/.well-known/apple-app-site-association` et `/.well-known/assetlinks.json`.
3. `ios.associatedDomains` + `android.intentFilters` dans `app.json`.
4. Bouton de partage sur les deux fiches, et bascule vers le store côté web.

⚠️ **Limite assumée** : après INSTALLATION, l'app s'ouvre sur l'accueil, pas sur le produit
partagé. Le *deferred deep linking* n'est fourni ni par iOS ni par Android ; il demande un
service tiers payant (Branch, AppsFlyer) ou un bricolage fragile. À rouvrir seulement si le
besoin se confirme à l'usage.

⚠️ **Ce build DOIT être lancé par Christopher lui-même, en interactif.** « Associated
Domains » est une capability Apple — voir le rappel plus haut : c'est ce qui a fait échouer
les builds 7, 8 et 11.

## 🎯 Consigne du 2026-09-05 : aligner les deux plateformes

L'app est **validée sur l'App Store** et **en attente de revue sur le Play Store** (déposée
vers le 2026-08-29). **Objectif fixé par le porteur du projet : dès que Google valide, on
lance le build** qui embarque tout ce qui est listé dans ce document, pour que les deux
plateformes proposent exactement les mêmes fonctionnalités.

Ordre de sortie à respecter :
1. ~~Récupérer l'empreinte de signature Google~~ ✅ fait le 2026-09-05, sans attendre.
2. Écrire le partage social + `assetlinks.json` + `apple-app-site-association`, mettre le
   site en ligne. **Rien n'empêche de le faire dès maintenant.**
3. Google valide la version déposée.
4. Lancer le build **en interactif** (capability Apple), soumettre aux deux stores.

⚠️ **La version actuellement en revue chez Google ne contient AUCUN chantier de ce document**
— elle date d'environ une semaine. L'alignement des deux plateformes se fera donc au build
**suivant**. Si Google valide vite, l'Android sera brièvement en retard sur l'iOS : c'est
attendu, ce n'est pas une régression.
