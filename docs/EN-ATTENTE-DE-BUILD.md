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
| **Frais de livraison à 10 000 Ar.** Rien à compiler côté app : le montant vient de `restaurants.delivery_fee`, déjà passé à 10 000 en base — les versions installées l'affichent donc **déjà**. Ligne ici pour mémoire, et parce que la ligne de remise ci-dessous, elle, exige un build. | montant relu en base sur les 5 restaurants ✅ |
| **Code promo au récapitulatif** (`app/app/checkout.tsx`) : champ « Code promo », bouton Appliquer, retour immédiat (accepté avec le montant économisé / refusé avec la raison exacte et quoi faire), ligne `Code LALIE −5 000 Ar` au récapitulatif et sur le suivi de commande. Le client n'envoie que le **code** ; la base recalcule la remise et le total. Espaces restaurant et livreur : la ligne de remise apparaît aussi sur leur carte de commande, sinon le total ne tombe pas juste sous leurs yeux. | `tsc --noEmit` (app + admin) ✅ · parité des 3 fichiers de langue ✅ (296 clés) · **preuves en base** : code inconnu / expiré / inactif / pas encore ouvert refusés, même client refusé la 2ᵉ fois par la contrainte unique (`23505`), second client accepté, plafond global respecté, totaux relus depuis `orders` ✅ · résolution PostgREST des deux signatures de `create_order` vérifiée par appel HTTP réel ✅ · ⏳ **rendu de l'écran à voir sur appareil** |
| **Type de plat « Pâtes » ajouté aux deux constantes en dur** (`app/data/types.ts`) — `FOOD_TYPE_ORDER` et `FOOD_TYPE_ICON` (🍝), juste après `Pizza`. Nécessaire pour le nouveau partenaire **Les Siciliens** (Hell-Ville), dont `food_types` vaut `{Pizza, Pâtes, Burger}`. Sans cet ajout la puce « Pâtes » apparaît quand même sur l'accueil (les filtres sont l'union des `food_types` réellement en base) mais **sans emoji et reléguée en dernier**, après tous les types connus — `FOOD_TYPE_ORDER.indexOf` renvoie -1, poids 999. `Pizza` et `Burger` étaient déjà présents, rien à faire pour eux. | à vérifier au build : la puce « 🍝 Pâtes » se place bien en 2ᵉ position de la barre de filtres, après « Pizza » |
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

## ✅ Partage social des produits et restaurants (écrit et DÉPLOYÉ le 2026-09-05)

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

**✅ Fait et vérifié en production le 2026-09-05 :**

| | État |
|---|---|
| `landing/netlify/functions/partage.mjs` — pages `/p/<id>` et `/r/<id>` | ✅ en ligne, 200 avec les balises `og:` |
| `/.well-known/apple-app-site-association` | ✅ 200, `content-type: application/json` |
| `/.well-known/assetlinks.json` | ✅ 200, les **deux** empreintes |
| Variables `SUPABASE_URL` / `SUPABASE_ANON_KEY` sur Netlify | ✅ posées (contexte `production`) |
| `ios.associatedDomains` + `android.intentFilters` (`app/app.json`) | ✅ écrit — **actif seulement au prochain build** |
| Bouton de partage sur les deux fiches (`app/lib/partage.ts`) | ✅ écrit — **actif seulement au prochain build** |
| Routes d'arrivée `app/app/p/[id].tsx` et `app/app/r/[id].tsx` | ✅ écrit — **actif seulement au prochain build** |

⚠️ **Le site est en avance sur l'app, volontairement.** Aujourd'hui, un lien
`taxifood.rentanoo.com/p/<id>` partagé sur WhatsApp affiche déjà un bel aperçu et renvoie
vers le store — mais il s'ouvre dans le NAVIGATEUR même chez quelqu'un qui a l'app, parce
que la version installée ne déclare pas encore le domaine. Ce n'est pas une régression :
c'était un lien qui n'existait pas du tout avant. Le comportement « ça s'ouvre dans l'app »
n'arrive qu'avec le build groupé.

⚠️ **Deux pièges rencontrés pendant le déploiement, à ne pas revivre :**
- `netlify env:set --scope functions` **échoue en silence** (code de sortie 0, aucune
  variable posée). Sans `--scope`, la même commande fonctionne. Le symptôme est trompeur :
  la fonction se déploie, répond, et redirige simplement sur l'accueil.
- `netlify deploy` **réutilise un cache de fonctions** et peut publier une version vide
  (404 sur `/.netlify/functions/partage`). Utiliser `--skip-functions-cache`.

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

## 🕓 Reporté après la validation Google — décidé le 2026-09-05

Trois sujets sont volontairement mis de côté jusqu'à ce que Google valide la version
déposée. **Ne pas les relancer avant**, c'est une décision du porteur du projet, pas un
oubli :

1. **Horaires hebdomadaires et numéro de téléphone des Siciliens.** Le restaurant est donc
   créé en `auto_open = false`, sans aucune ligne dans `restaurant_hours`, et `phone` à
   `null`. ⚠️ Ne jamais basculer `auto_open` à `true` sans avoir inséré les 7 jours :
   `ouvert_maintenant()` renvoie `false` en l'absence de ligne, et le restaurant se
   retrouve fermé en permanence, sans le moindre message d'erreur.

2. **Comptes partenaires.** Sans compte, un restaurateur ne peut ni gérer ses horaires, ni
   changer son logo ou sa couverture, ni mettre un plat à l'affiche : `current_restaurant_id()`
   exige une ligne `restaurant_staff` **et** un rôle `restaurant` en statut `active`. Il faut
   une adresse e-mail ou un numéro pour qu'il s'inscrive lui-même dans l'app, puis
   `approve_role(...)` côté admin. Concerne **Les Siciliens, Angelo et Chez Bidul & Truc**
   — seuls Taxi Be et La Cabane ont un compte aujourd'hui.

3. **Le pitch « site web » à Chez Bidul & Truc** (second objectif commercial).


## ✅ Les Siciliens — APPLIQUÉ EN BASE le 2026-09-05

Le partenaire existe en production. **Créé FERMÉ**, donc pas commandable — mais
⚠️ **sa fiche est visible sur l'accueil dès maintenant** : la policy
`restaurants_select_public` est `using (true)`, ni `is_open` ni la présence d'un menu
ne filtrent l'affichage. Pour le masquer complètement il faudrait désactiver ses 4
catégories, ce qui n'a pas été fait.

`aee1c612-5ee0-402b-a7b4-aec9c6825b0b` · Hell-Ville · Pizzeria & Pâtes italiennes ·
`food_types = {Pizza, Pâtes, Burger}` · commission 0,05 · livraison 5 000 Ar.

Contrôles passés après application : 46 produits · 17 boîtes à pizza (2 000 Ar) ·
4 tagués porc · 2 sans visuel (assumé) · 14 groupes · 58 options dont 42 à 4 000 Ar ·
**0 groupe anormal** · 44 photos sur 44 répondent en 200.

**Reste à faire avant ouverture** : relire la carte à l'écran, puis
`update public.restaurants set is_open = true where name = 'Les Siciliens';`

### Le piège du dépôt de visuels, à ne pas revivre

Les 41 dépôts ont échoué en bloc sur `403 Invalid Compact JWS`. Le message fait
croire à un problème de DROITS ; c'est un problème de **format de clé**. Ce projet
utilise les clés Supabase de nouvelle génération (`sb_secret_…`), qui ne sont pas des
JWT : le Storage les refuse présentées en `Bearer` seul et exige **aussi** l'en-tête
`apikey`. Avec les deux, 41 sur 41 du premier coup.

La fenêtre de dépôt (`upload-visuel-partenaire`) a été rouverte puis **refermée**
(410 vérifié), le jeton du Vault et `public.jeton_depot()` supprimés. La frontière
avait été testée AVANT tout dépôt : sans jeton 403, hors du préfixe 400, `../` 400,
extension autre que `.png` 400.

## ✅ Version WEB de l'application — EN LIGNE le 2026-09-05

**https://taxi-food-commander.netlify.app**

Objectif : permettre aux clients de commander pendant l'attente des stores (iOS
validée, Android en revue). Ce n'est **pas un site séparé** : c'est le même code
que les apps, compilé pour le navigateur (`expo export --platform web`). Une
correction dans l'app corrige donc aussi le site, et les deux ne peuvent pas
diverger.

Découvert en le testant : **le projet compilait déjà pour le web sans aucune
modification** (11 Mo, un seul bundle), et `lib/auth.ts` gérait déjà le cas —
`googleNativeAvailable()` est faux hors iOS/Android, et `signInWithOAuth` a une
branche web qui fait la redirection navigateur pleine page. Rien n'a eu à être
réécrit côté connexion.

Vérifié en ligne : accueil, filtres (dont la nouvelle puce « 🍝 Pâtes »), fiche
restaurant avec photos et prix, `/login`, et le routage profond `/p/<id>` — zéro
erreur en console.

### ⚠️ Deux actions restent, et sans elles quelque chose casse en silence

1. ~~**Supabase → Redirect URLs**~~ ✅ **FAIT le 2026-09-05.**
   `https://taxi-food-commander.netlify.app` est dans la liste (7 entrées au total,
   relues sur la page). `signInWithOAuth` passe `redirectTo: window.location.origin`
   et l'entrée correspond exactement à cette origine — pas de joker, comme les
   autres entrées `.netlify.app` déjà en place.
   ⚠️ **Il faudra ajouter le domaine définitif** quand le sous-domaine sera posé :
   une origine absente de la liste fait revenir Google **sur l'accueil sans session
   et sans le moindre message d'erreur**.
   ⚠️ **Non vérifié de bout en bout** : Supabase ne contrôle l'origine qu'au RETOUR
   de Google, pas au départ — une requête de test ne permet donc pas de le prouver,
   et aller au bout demanderait de saisir de vrais identifiants Google. À confirmer
   par une vraie connexion.
2. **DNS** : `commander.taxifood.rentanoo.com` → CNAME vers
   `taxi-food-commander.netlify.app`, puis déclarer le domaine dans Netlify. Le
   badge « Powered by Netlify » visible en bas d'écran disparaît avec le domaine
   personnalisé.

### Ce qui ne marche pas sur le web, et c'est normal

- **Connexion Apple** : absente (iOS uniquement, par conception).
- **Google et Facebook** : passent par la redirection navigateur, pas le
  sélecteur natif — d'où le point 1 ci-dessus.
- **Notifications push** : `app/login.tsx` sort tôt sur `Platform.OS === 'web'`.
  Le client ne sera donc pas prévenu du changement de statut de sa commande
  autrement qu'en rouvrant l'écran. À évaluer si le web prend de l'ampleur.

### À redéployer après chaque changement d'écran

```
npm run build:web --prefix app
netlify deploy --prod --dir app/dist --site 1e13c535-fd25-4027-9188-2b8c178c7f60
```

## 🔜 Suivi de commande par e-mail sur le web (décidé le 2026-09-05, PAS ENCORE ÉCRIT)

Les notifications push n'existent pas sur la version web : `app/login.tsx` sort tôt
sur `Platform.OS === 'web'`, et un client qui commande depuis un navigateur ne serait
donc prévenu de rien.

**Décision du porteur du projet** : sur le web, remplacer la push par un **e-mail à
chaque étape de livraison**, envoyé par un workflow n8n. **L'e-mail du client devient
donc obligatoire pour commander depuis le web.**

Ce qu'il faudra regarder au moment de l'écrire — ce sont des questions ouvertes, pas
des décisions prises :

- ⚠️ **Tous les clients n'ont pas d'e-mail aujourd'hui.** Un compte créé par
  **WhatsApp OTP** n'en a aucun (`profiles` n'a que le téléphone), et une connexion
  Apple peut ne fournir qu'une adresse *private relay*. Il faudra donc soit demander
  l'e-mail au moment du paiement sur le web, soit bloquer la commande web pour les
  comptes qui n'en ont pas — le second est plus simple mais renvoie un client qui
  s'était déjà connecté.
- **Le déclencheur** : le plus robuste est un webhook Postgres sur le changement de
  `orders.status`, comme le fait déjà `notify_order_status`. Regarder ce trigger
  avant d'en inventer un autre — les règles métier vivent dans les triggers, pas
  dans le front.
- **Ne pas envoyer un e-mail par étape à un client qui a l'app** : il recevrait la
  push ET l'e-mail. Il faut savoir d'où vient la commande (une colonne
  `orders.source` = `web` | `ios` | `android`, à ajouter).
- Le workflow n8n est hors dépôt : consigner où il vit et qui peut le modifier.

---

## 💳 Paiement par carte Stripe (2026-09-06) — EXIGE UN BUILD NATIF

Document de référence : **[PAIEMENT-STRIPE.md](PAIEMENT-STRIPE.md)**.

Le socle base de données est appliqué (migrations `20260905213821` et `20260905214324`) et
l'Edge Function `creer-paiement` est en cours d'écriture. **Rien de tout cela n'exige de
build** : ce sont des changements serveur, effectifs immédiatement, y compris pour les
versions déjà installées sur les magasins.

⚠️ **Ce qui exige un build, en revanche : `@stripe/stripe-react-native`.** C'est un **module
natif**. Les mises à jour OTA activées le 2026-09-05 ne peuvent pas le livrer — elles ne
transportent que du JavaScript. Tant que ce build n'est pas sorti et validé par les deux
magasins, **aucun client ne peut payer par carte**, quel que soit l'état du serveur.

### Le garde-fou est déjà posé, et il faut s'en servir

`payment_config.carte_active` vaut **`false`**, et aucun secret Stripe n'est dans le Vault.
Le code doit rester **inerte et le dire** dans ce cas, jamais planter. **Ne pas passer
`carte_active` à `true` avant que le build soit disponible sur les deux magasins** : sinon
l'écran de validation proposerait la carte à des versions installées qui n'embarquent pas le
SDK.

```sql
select public.admin_set_carte_active(true);   -- le jour J, et pas avant
select public.admin_set_carte_active(false);  -- coupure d'urgence, sans déploiement
```

### À faire dans le build

- [ ] Installer `@stripe/stripe-react-native`. ⚠️ Piège maison déjà payé deux fois :
      **`npx expo install` ajoute le plugin natif SANS ses options** et route vers une branche
      de configuration qui peut faire échouer la compilation. Lire `node_modules/<pkg>/plugin/`
      avant de laisser l'entrée telle quelle dans `app.json`.
- [ ] `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` pour le `expo run:ios` qui suivra — un nouveau
      module natif relance `pod install`, qui plante sinon sur
      `Unicode Normalization not appropriate for ASCII-8BIT`.
- [ ] PaymentSheet dans `app/app/checkout.tsx`, **entre `createOrder` et `clear()`** : sur
      échec ou annulation, le panier ne doit **pas** être vidé et on ne va **pas** sur
      `/confirmation`.
- [ ] Montant en euros **et** taux affichés avant validation (obligation légale — voir
      PAIEMENT-STRIPE.md § 6).
- [ ] Orange Money non sélectionnable, badge « Bientôt disponible ».
- [ ] Conditionner `checkout.noCharge` (« aucun débit maintenant »), `confirmation.paymentValue`
      (« — à la livraison »), `tracking.payToCourier`, `tracking.steps.deliveredSub` et
      `tracking.refusedHint` (« Aucun montant ne te sera débité » devient faux dès qu'une carte
      est débitée). **Cinq clés × trois langues**, parité à revérifier.
- [ ] `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` dans les variables Netlify — sinon le bundle **web**
      sort sans configuration de paiement. Décider au passage du sort de la carte sur le web :
      le PaymentSheet natif n'y existe pas.

### À faire dans les consoles, AU MÊME MOMENT que l'envoi

⚠️ Une fiche App Privacy ou Data safety qui décrit un binaire différent de celui qu'on envoie
est un motif de rejet **à part entière**. Le détail et les citations sont dans les deux fiches ;
en résumé :

| Console | Ce qui change |
|---|---|
| **App Store Connect** → App Privacy | **ajouter deux lignes** : *Finances › Informations de paiement* et *Données d'utilisation › Interaction avec le produit*. Voir [FICHE-APP-STORE.md](FICHE-APP-STORE.md) § 2 |
| **App Store Connect** → App Review Information | remplacer les blocs `PAYMENT` et `EXTERNAL SERVICES` (Stripe nommé) — § 4 de la même fiche |
| **App Store Connect** → Description | basculer la section « PAIEMENT EN ESPÈCES OU PAR CARTE ». Champ modifiable **seulement** en soumettant une version : il tombe donc pile avec ce build |
| **App Store Connect** → Texte promotionnel | modifiable **sans** version : à basculer dès l'activation de la carte |
| **Play Console** → Data safety | ⚠️ **rien à changer.** L'exception « prestataire de paiement » de Google s'applique — [FICHE-PLAY-STORE.md](FICHE-PLAY-STORE.md) § 3 |
| **Play Console** → App content → Fonctionnalités financières | ⚠️ **reste « aucune »**. Ne pas cocher « paiements et transferts » par prudence : cela déclenche des exigences de licences impossibles à fournir |
| **Play Console** → IARC | inchangé. « Achat de biens numériques : non » — la réponse tient aux biens physiques, pas au moyen de paiement |

### Site public — déjà à jour, une phrase à retirer le jour J

`landing/confidentialite/`, `landing/suppression-compte/`, `landing/restaurants-partenaires/`
et `landing/devenir-livreur/` décrivent déjà le paiement par carte, dans les trois langues,
avec la mention **« en cours de déploiement »**. Le jour où `carte_active` passe à `true`,
c'est cette formule qu'il faut retirer — et elle seule.

⚠️ **`landing/tools/build-i18n.py` ne tourne plus** (29 clés `client.*` / `stores.*` absentes
des pages sources, cassé **avant** ce chantier — vérifié en le lançant sur l'arbre propre). Les
quatre pages EN/IT ont dû être modifiées à la main. Tant qu'il n'est pas réparé, plus rien ne
garantit que les trois langues restent alignées.

### Le point à trancher avant la mise en service

Le restaurant est notifié (push + e-mail + Telegram, avec un lien « Accepter ») **dès la
création de la commande**, donc **avant** le paiement. Un client qui abandonne le PaymentSheet
laisse un restaurateur prêt à cuisiner un repas que personne n'a payé. La correction demande de
toucher `notify_order_status()` — pas `create_order`. Détail et piège de la clause `OF` du
trigger : PAIEMENT-STRIPE.md § 9.

## 🧭 Un partenaire arrive dans SON espace (2026-09-06) — EXIGE UN BUILD

**Le déclencheur, constaté en vrai.** Le patron de « Chez Bidul & Truc »
(`marcantoine14000@yahoo.fr`) s'est connecté pour la première fois le 2026-09-06 à 05:41.
Il **est** bien entré dans son espace pro — à ce moment-là son compte ne portait que
`restaurant:active`. Puis il en est sorti par la double flèche `swap_horiz`, sans libellé, qui
**effaçait le mode** et le déposait sur `/role-select` ; il y a tapé « Devenir livreur »
(05:44:40) puis la grosse carte « Je commande » (05:44:49), qui a créé un `client:active`
définitif. À partir de là, `destination()` ne lui a plus jamais rendu son espace, et l'app lui
a redemandé son téléphone — il y a saisi le numéro de son **établissement**. Mot pour mot :
« on mélange le pro et le perso, ce n'est pas bon. »

**La règle, désormais.** *Un rôle pro ACTIF est une décision d'administrateur ; un rôle client
n'est qu'un tap.* `app/app/index.tsx` ne lit plus du tout le rôle client (il ne donne aucun
droit : aucune policy RLS ne le mentionne, commander est autorisé par
`orders.user_id = auth.uid()`). L'aiguillage tient en trois temps : le `mode` persisté
d'abord, puis les rôles pro actifs seuls, puis le parcours client.

| Ce qui change | Fichier |
|---|---|
| **Un restaurant/livreur actif entre dans son espace même s'il a aussi un rôle client.** Plus de détour par `/role-select` (réservé au seul cas restaurant **et** livreur actifs), plus de `/phone` | `app/app/index.tsx` |
| **Le mode déduit des rôles est ÉCRIT**, plus seulement calculé — un pro n'est plus suspendu à cette déduction à chaque lancement | `app/app/index.tsx` |
| **`/phone` ne barre plus la route à un compte qui a un espace pro.** Le numéro reste exigé d'un client (c'est le seul qu'on aura de lui) et, pour tout le monde, sur chaque adresse de livraison de `/address` | `app/app/index.tsx` |
| **La double flèche devient « ↔ App client »**, avec intitulé et `accessibilityLabel`. Elle **pose** `mode = 'client'` au lieu de l'effacer, et dépose sur les onglets — plus sur l'écran de choix | `components/RestaurantHeader.tsx`, `components/CourierHeader.tsx` |
| **Badge « ESPACE PARTENAIRE » / « ESPACE LIVREUR »** dans l'en-tête pro, donc sur les 4 écrans restaurant et les 2 écrans livreur | idem |
| **Profil → « Mon espace partenaire — <resto> », pastille PRO** : le chemin de retour, qui n'existait pas. La ligne « Devenir partenaire » s'affichait à quelqu'un qui EST déjà partenaire | `app/app/(tabs)/profile.tsx` |
| **La carte mise en avant de `/role-select` suit le compte** : pro d'abord pour un pro, « Je commande » sinon | `app/app/role-select.tsx` |

**Contrainte Apple préservée, et même consolidée.** `demo.resto@taxifood.mg`
(`restaurant:active` seul, `profiles.phone` **null**) et `demo.livreur@taxifood.mg`
(`livreur:active` seul) entrent toujours directement dans leur espace — mais cette garantie
ne dépend plus de l'**absence** d'un rôle client sur ces comptes, équilibre qui se cassait au
premier tap du relecteur. `demo.apple@taxifood.mg` (client seul) est inchangé, `/(tabs)` reste
libre sans session, et les gardes de rôle des deux layouts pro ne sont pas touchées.

Vérifié : `npx tsc --noEmit` ✅ · parité des 3 fichiers de langue ✅ (349 clés, 6 ajoutées dans
`profile.*`) · **navigateur** : catalogue visiteur et Profil visiteur inchangés, et les deux
en-têtes pro rendus à 375 pt (badge + « App client », rien ne déborde).

Recette restante, à passer sur appareil réel avec de vrais comptes :

1. **`demo.resto`, installation neuve** → l'espace restaurant s'ouvre directement, aucun
   écran intermédiaire, aucune demande de téléphone.
2. Depuis cet espace, **« App client »** → onglets client. Fermer et rouvrir l'app → on
   revient bien **côté client** (le mode est persisté, c'est voulu).
3. **Profil → « Mon espace partenaire — Taxi Be »** → retour dans l'espace pro. Fermer et
   rouvrir → l'espace pro s'ouvre à nouveau.
4. Le compte de Marc-Antoine (`client:active | livreur:pending | restaurant:active`) →
   **espace partenaire**, quel que soit le mode enregistré sur son téléphone, dès lors qu'il
   n'a pas lui-même choisi le mode client.
5. `techerchristopher@gmail.com` (restaurant **et** livreur actifs) → `/role-select`, dont la
   carte principale est maintenant **la carte restaurant**.
6. Un compte purement client : **rien ne doit changer**, `/phone` compris à la première
   connexion.
7. **Appuyer sur RETOUR** après « App client » : l'app doit se fermer, pas dévoiler un second
   jeu d'onglets (`retourOnglets`, pas `replace` — voir `lib/nav.ts`).

⚠️ **À trancher par le porteur du projet, aucune écriture faite en base.** Le compte de
Marc-Antoine porte toujours `client:active` et `livreur:pending`, et son `profiles.phone` vaut
`+261322664143` — c'est-à-dire `restaurants.phone` de Chez Bidul & Truc, pas son numéro
personnel. Les rôles ne sont plus gênants (l'aiguillage ne les lit plus), et un restaurateur a
le droit de commander comme client ; le numéro, lui, est celui qu'un livreur appellera.

## Visite guidée de l'espace partenaire (2026-09-06)

Suite directe du chantier ci-dessus. Le restaurateur arrive maintenant DANS son espace ;
encore faut-il qu'il comprenne ce qu'il y voit. Consigne du porteur du projet : « il faut
qu'il y ait au moins une commande de test […] une espèce de table de présentation lors de la
première connexion […] il faut qu'il comprenne comment fonctionne son application
rapidement. »

**Cinq étapes, jouées automatiquement à la première entrée dans l'espace partenaire** :
Commandes (avec une commande d'exemple) · En livraison · Historique · Réglages · le bouton
« App client ». Numérotation « 2 / 5 », bouton « Suivant », « Fermer la visite » à chaque
étape, case « Ne plus afficher cette visite » (cochée par défaut) à la dernière.

| Ce qui a été fait | Où |
|---|---|
| La visite elle-même : voile, contour, bulle, étapes, case à cocher | `app/components/VisiteGuidee.tsx` |
| Le repérage des cibles (les 4 onglets + le bouton « App client ») | `app/components/ZoneVisite.tsx`, `app/store/visiteGuidee.ts`, `app/app/(restaurant)/_layout.tsx`, `app/components/RestaurantHeader.tsx` |
| Déclenchement, fermeture, mémorisation | `app/app/(restaurant)/index.tsx` |
| « Découvrir votre espace / Revoir la visite », en TÊTE des Réglages | `app/app/(restaurant)/reglages.tsx` |
| `profiles.visite_pro_vue_le` + RPC `marquer_visite_pro_vue(p_vue boolean)` | `supabase/migrations/20260906_visite_guidee_espace_partenaire.sql` — **déjà appliquée en base** |
| 30 clés `visitePro.*` dans les trois langues | `app/locales/{fr,en,it}.json` |

**Quatre décisions à connaître avant d'y toucher :**

1. ⚠️ **Le repère ne masque jamais ce qu'il désigne.** Le voile est fait de QUATRE bandes
   posées AUTOUR de la cible, jamais d'un rectangle plein par-dessus ; la cible garde sa
   luminosité, un simple contour l'entoure, et la bulle se place À CÔTÉ (au-dessus d'une
   cible du bas, en dessous d'une cible du haut). L'erreur inverse a déjà été commise sur le
   guide restaurateur du site vitrine.
2. ⚠️ **La commande d'exemple n'existe pas en base.** C'est un objet en mémoire rendu par le
   vrai `RestaurantOrderCard` (composant purement présentatif), sous un badge « Exemple » et
   la phrase « Cette commande n'existe pas ». En créer une vraie polluerait le rapport
   journalier et les commissions, et déclencherait e-mail + Telegram + push chez un vrai
   restaurant. Ses **frais de livraison sont lus en base** (`restaurants.delivery_fee`) et
   non écrits en dur, pour que la démonstration ne mente pas le jour où le tarif bougera.
3. ⚠️ **On n'annonce que ce qui existe, avec les MOTS DE L'ÉCRAN.** Une promesse fausse dans
   une visite guidée est pire que pas de visite : le restaurateur cherchera un bouton absent.
   Ce qu'a corrigé la revue de vérité du 2026-09-06 :
   - **Le vocabulaire.** L'écran Réglages écrit « Couverture » et « À l'affiche », jamais
     « devanture » ni « plat du jour » ; la visite reprend désormais ses mots. Sur le fond,
     `save_featured_product` **crée bien un plat avec son prix**, mais en `in_menu = false`
     — il vit « à l'affiche », pas dans la carte permanente ; et le **prix d'un plat de la
     carte devient modifiable** dès qu'il est étoilé, puisqu'il rejoint « À l'affiche » et
     son bouton « Modifier ». Ne plus répéter que « l'app ne sait pas changer un prix ».
   - **Les libellés cités entre guillemets** sont interpolés depuis la clé réellement rendue
     (`{{lien}}` ← `profile.proRestaurantLabel`, ou `proChooseLabel` si le compte est aussi
     livreur actif), jamais recopiés : l'anglais et l'italien renvoyaient vers « My partner
     space » / « Il mio spazio partner » quand le Profil affiche « My partner area » /
     « La mia area partner » — le restaurateur cherchait une ligne qui n'existe pas.
   - **Ce qui n'est vrai qu'ENSUITE.** Une commande entre dans « En livraison » dès qu'elle
     est marquée prête, donc **avant** qu'un livreur l'ait prise (5 des 6 commandes
     `en_livraison` de la base n'ont aucun `courier_id`). La visite dit « dès qu'un livreur
     la prend », plus « vous y voyez quel livreur l'a prise ».
4. ⚠️ **La préférence est en BASE, pas en AsyncStorage** : elle suit la personne, pas
   l'appareil. Se reprendre la visite après un changement de téléphone, un soir de service,
   est exactement ce qu'il ne faut pas. L'écriture passe par une RPC `SECURITY DEFINER` qui
   fixe elle-même la valeur (`now()`), jamais par un UPDATE direct.

Fermer la visite en cours de route la mémorise aussi : elle ne doit pas se represser à chaque
lancement. Le repêchage, c'est **Réglages → « Découvrir votre espace »**, posé en TÊTE
d'écran — chercher ce bouton n'est pas le travail du restaurateur.

Vérifié : `npx tsc --noEmit` ✅ · parité des 3 fichiers de langue ✅ (377 clés, 30 ajoutées
dans `visitePro.*`) · **navigateur, connecté en `demo.resto` sur un gabarit 375 pt** : les
cinq étapes parcourues une à une, chaque cible (icône ET intitulé d'onglet, puis le bouton
« App client ») restée entièrement lisible dans son contour ; carte d'exemple rendue avec ses
10 000 Ar lus en base ; « Terminer » a bien écrit `visite_pro_vue_le` en base **par la RPC**,
et la même case décochée l'a bien remis à `null` ; rediffusion par Réglages → bascule sur
l'onglet Commandes et rouvre à l'étape 1 ; rendu italien contrôlé, aucun débordement.
Compte de démonstration remis à `null` après les essais — aucun compte ne porte de date.

**Revue de vérité du 2026-09-06, contrôlée en SQL et non sur parole.** Chaque affirmation des
cinq étapes a été confrontée à l'écran qu'elle décrit et aux fonctions de la base :

| Affirmation | Verdict |
|---|---|
| « chaque nouvelle commande s'affiche toute seule, sans rien rafraîchir » | vrai — `setInterval(reload, 12 000)` tant que l'écran est monté ; le délai peut atteindre 12 s |
| « vous la refusez avec un motif » | vrai — `RefuseSheet` exige un motif ou une précision, `set_order_status` refuse `annulee` sans motif |
| « en préparation », puis « prête » | vrai — « Démarrer la préparation » (`en_preparation`), « Marquer comme prête » (`en_livraison`) |
| « vous y voyez quel livreur l'a prise et son numéro » | **faux tant qu'aucun livreur n'a pris la commande** — 5 des 6 commandes `en_livraison` de la base n'ont pas de `courier_id`. **Corrigé** : « dès qu'un livreur la prend… » |
| historique « livrées comme refusées » | vrai — `['livree','annulee']`, et l'enum `order_status` n'a pas d'autre état terminal |
| logo · couverture · téléphone · horaires · ouverture · à l'affiche · étoile · rupture | vrai — les 8 RPC existent bien en base (`set_restaurant_photo`, `set_restaurant_week_hours`, `set_restaurant_phone`, `set_restaurant_open`, `set_restaurant_auto_open`, `save_featured_product`, `set_product_featured`, `set_product_available`) ; **mots corrigés** (« couverture », « à l'affiche ») |
| « Profil, puis “Mon espace partenaire” » | vrai en français, **faux en anglais et en italien** (libellés recopiés, désynchronisés). **Corrigé** par interpolation |
| « cette double flèche » | périmé — le bouton porte son intitulé « App client » depuis `12f3bd3`. **Corrigé** |

Preuve en base de la préférence, jouée avec le JWT de `demo.resto` et pas en lisant le code :
`marquer_visite_pro_vue(true)` → `visite_pro_vue_le = 2026-09-06 06:47:12+00`, relu tel quel
sous RLS par `select … where id = auth.uid()` ; `marquer_visite_pro_vue(false)` → `null`,
relu `null`. **Aucune vraie commande créée** : `orders` compte 33 lignes, la dernière du
2026-09-05 13:52 UTC — **zéro** ligne depuis le 6 septembre, et aucun produit nommé
« Pizza margherita ». La commande d'exemple n'a jamais touché la base.

Deux défauts corrigés au passage : l'indicateur de chargement de la carte d'exemple tournait
**indéfiniment** si `getMyRestaurant` échouait (réseau coupé à Nosy Be) — on renonce
désormais à l'exemple et la bulle reste seule ; et le libellé cité par la dernière étape est
interpolé, il ne peut plus se désynchroniser du Profil.

À passer sur appareil réel :

1. **Premier lancement d'un vrai partenaire** (Marc-Antoine, Chez Bidul & Truc) : la visite
   s'ouvre seule, la commande d'exemple s'affiche, et il comprend ses 4 onglets.
2. **Écran vide** : contrairement à `demo.resto` (qui a 3 commandes de démonstration), son
   écran Commandes est vide derrière la visite — vérifier que la carte d'exemple s'y lit bien.
3. **Petit écran** : la carte d'exemple doit rester **défilable** sous le doigt (elle est en
   `pointerEvents="none"` pour que la puce « Itinéraire » n'ouvre pas Google Maps en pleine
   visite ; les gestes traversent jusqu'à la `ScrollView`).
4. **Android** : les contours doivent tomber pile sur les onglets. Si tout est décalé vers le
   bas de la hauteur de la barre d'état, c'est `statusBarTranslucent` sur la `Modal` qu'il
   faut regarder — `measureInWindow` compte depuis le haut de la fenêtre.
5. **« Réduire les animations »** activé dans les réglages du téléphone : pas de fondu, pas de
   contour qui respire. Code relu, **jamais exécuté dans cet état**.
6. Fermer en cours de route, tuer l'app, la rouvrir → la visite **ne revient pas**, et
   Réglages → « Découvrir votre espace » la rejoue.
7. **Textes réécrits le 2026-09-06 (revue de vérité), non revus en navigateur** : l'étape
   « Réglages » a gagné une ligne environ. Vérifier que la bulle ne déborde pas sur un petit
   écran, dans les trois langues — c'est l'étape dont la cible est en bas, donc celle qui a le
   moins de place au-dessus d'elle.

## 🔒 Le partenaire ne voit plus les commandes de ses clients côté client (2026-09-06)

Trouvé en revue de régression du chantier ci-dessus, **corrigé** (`app/data/api.ts`). Le
défaut était latent depuis toujours ; c'est le bouton **« App client »** qui l'a mis à un
tap d'un partenaire.

`orders` porte **quatre** politiques SELECT permissives (propriétaire, staff du restaurant,
livreur, admin) et `addresses` **trois** : elles se cumulent en **OU**. Les deux lectures du
parcours client ne filtraient rien et s'en remettaient à la RLS. Mesuré avec de vrais jetons
avant correction :

| Compte | Onglet « Commandes » client | Adresses enregistrées |
|---|---|---|
| `demo.resto` | **4 commandes, aucune à lui** (celles de ses clients : nom, téléphone, adresse, lien d'itinéraire) | **2, aucune à lui** |
| `demo.livreur` | **5 commandes, aucune à lui** (toutes les courses en attente) | 0 |
| `demo.apple` (client pur) | 4, les siennes | 1, la sienne |

`listOrders()` et `listAddresses()` filtrent désormais sur `user_id`. Aux mêmes jetons après
correction : 0 / 0 pour les deux comptes pro, **4 / 1 inchangés** pour `demo.apple`.

**À passer sur appareil, dans le prochain build :**

1. `demo.resto` → **App client** → onglet **Commandes** : « Aucune commande » (et surtout
   pas TF-71 / TF-58 / TF-57 / TF-56).
2. `demo.resto` → **App client** → **Profil** → « Adresses enregistrées » : aucune.
3. `demo.livreur` → **App client** → **Commandes** : « Aucune commande ».
4. `demo.apple` : son historique et son adresse « Hell-Ville — Hôtel » sont **intacts**, et
   `/address` la propose toujours. C'est le contrôle de non-régression du parcours client.
5. Passer une commande de bout en bout avec un compte purement client : l'adresse
   enregistrée reste sélectionnable, la commande arrive bien chez le restaurant.

## 📵 Réseau coupé : l'espace pro ne dit plus « aucune commande » (2026-09-06)

Trouvé en revue de parcours du chantier partenaire, **corrigé**
(`app/app/(restaurant)/index.tsx`, `delivering.tsx`, `history.tsx`).

`lib/useLoad.ts` expose `error` depuis toujours. **Aucun écran de l'application ne le
lisait.** Sur les trois écrans de l'espace restaurant, une lecture qui échoue laisse
`orders` à `null`, donc `list` à `[]`, donc l'écran affirmait :

- « **Aucune commande en cours** — Les nouvelles commandes apparaissent ici automatiquement. »
- « **Aucune commande en livraison** »
- « **Pas encore d'historique** »

À Nosy Be la liaison tombe. Le restaurateur range son téléphone pendant que ses commandes
attendent — et l'application le lui a dit noir sur blanc. C'est la contre-vérité la plus
coûteuse que puisse produire cet écran.

Deux états distincts désormais :

| Situation | Avant | Après |
|---|---|---|
| Rien n'a **jamais** été lu | « Aucune commande en cours » | **« Liste indisponible »** + bouton **Réessayer** |
| Déjà lu, puis connexion perdue | liste (ou vide) muette | bandeau ambre **« Connexion perdue — cette liste date de votre dernier rafraîchissement réussi. »** |

⚠️ Le bandeau est posé **au-dessus** du branchement vide/liste, pas dans la liste : une
liaison qui tombe alors que la liste est vide affichait sinon « Aucune commande en cours »
tout seul, exactement le défaut qu'on corrige.

Vérifié en navigateur, connecté `marcantoine14000@yahoo.fr` (Chez Bidul & Truc), les appels
vers `supabase.co` rejetés : bandeau sur Commandes, état « Historique indisponible » avec
Réessayer sur un onglet jamais chargé. ⚠️ Compter ~10 s avant l'affichage de l'erreur :
`supabase-js` réessaie tout seul avant de rejeter.

**À passer sur appareil :** mode avion sur l'écran Commandes, puis relancer l'app en mode
avion. On doit lire « Liste indisponible », jamais « Aucune commande en cours ».

Les écrans **client** et **livreur** portent le même défaut (`(tabs)/index.tsx`,
`(tabs)/orders.tsx`, `(livreur)/index.tsx`, `(livreur)/history.tsx`, `restaurant/[id].tsx`,
`product/[id].tsx`) — **non corrigés**, hors périmètre de cette revue.

## 🎯 Le repère de la visite suit la fenêtre (2026-09-06)

Corrigé dans `app/components/ZoneVisite.tsx`. Le composant publie des coordonnées de
**fenêtre** (`measureInWindow`) mais ne se remesurait que sur `onLayout` — qui ne se
déclenche que si la vue bouge **dans son parent**. Une fenêtre qui change de hauteur sans
que la barre d'onglets change de taille laissait donc la zone périmée.

Reproduit en navigateur, visite ouverte, en passant de 360×640 à 375×667 : le contour
flottait ~45 px trop haut, sur une bande blanche vide, et l'onglet « Commandes » restait
dans l'ombre — l'inverse exact de la règle « le repère ne masque jamais sa cible ».

Concerne **taxifood.distripro207.com** (fenêtre redimensionnable), le **Split View de
l'iPad** et l'apparition du **clavier**. L'app native est verrouillée en portrait
(`app.json`), la rotation n'est donc pas un cas.

## ✅ Les deux points de la visite laissés à l'arbitrage — TRANCHÉS ET CORRIGÉS (2026-09-06)

**1. Sur un écran de 667 pt, la commande d'exemple est coupée avant ses boutons.**
Mesuré à 375×667 (iPhone SE 2/3, iPhone 8, et le mode compatibilité iPhone dans lequel le
relecteur Apple teste sur iPad) : la zone d'exemple fait **335 px**, la carte en réclame
**508**. Il manque 173 px. Ce qui disparaît sous la bulle : l'adresse, la puce
« Itinéraire », le téléphone, et surtout **« Refuser » / « Accepter »** — les deux boutons
dont l'étape 1 explique précisément l'usage. À 375×812 tout tient, c'est pourquoi ça n'a
pas été vu. La carte **est** défilable (`ScrollView`), mais rien ne le laisse deviner :
`showsVerticalScrollIndicator={false}`.
Effet de bord à mesurer avant de trancher : le restaurateur qui fait défiler pour atteindre
« Accepter » chasse du même geste le panneau **« EXEMPLE »** hors de l'écran — il lui reste
une commande #TF-000 d'apparence parfaitement réelle, dont les boutons ne font rien
(`pointerEvents="none"`).

**2. « Fermer la visite » à l'étape 1 la supprime définitivement, sans le dire.**
Vérifié en base : un tap sur « Fermer la visite » à 1/5 écrit `profiles.visite_pro_vue_le`
sur-le-champ. Or la case **« Ne plus afficher cette visite »** n'apparaît qu'à l'étape 5 :
sa seule présence enseigne le contraire — « je ferme sans cocher, donc elle reviendra ».
Le cas est concret : une vraie commande arrive pendant la visite, il ferme pour la servir,
et il ne reverra jamais la visite. Le repêchage existe (Réglages → « Découvrir votre
espace ») mais il est présenté à l'étape **4** — celle qu'il n'a pas vue.
L'arbitrage « fermer mémorise aussi » se défend (se la reprendre chaque soir de service
serait pire) ; c'est l'**affichage** qui ment. Deux voies : afficher la case à toutes les
étapes (coût : ~36 px de bulle en plus, ce qui aggrave le point 1), ou dire dans le lien
de fermeture qu'on la retrouve dans les Réglages.

---

### Ce qui a été fait, et pourquoi

**Point 1 — le panneau « EXEMPLE » est ÉPINGLÉ hors du `ScrollView`.**
La voie choisie est la troisième de la liste ci-dessus, et c'est la seule qui ne coûte rien
ailleurs : ni texte raccourci, ni bulle amputée, ni pixel de plus. Le cadre
(`styles.exempleCadre`) porte désormais la légende, fixe ; seule la carte défile dessous.
Le geste qui va chercher « Accepter » ne peut plus faire disparaître la mention
« Cette commande n'existe pas » — c'était le vrai danger, bien plus que le défilement
lui-même : une commande #TF-000 d'apparence réelle, sans son démenti à l'écran.
`showsVerticalScrollIndicator` est passé à **true** sur cette carte, et sur elle seule :
ailleurs dans l'app la barre est masquée par choix, mais ici rien d'autre ne dit qu'il faut
défiler pour voir les deux boutons dont la bulle parle.

**Vérifié en navigateur, pas déduit** : à 375×667, `clientHeight` = 190 px pour un
`scrollHeight` de 407 px — la carte défile bien de 217 px ; défilement poussé jusqu'en bas,
capture à l'appui : « Refuser » et « Accepter » sont atteints **et** le panneau « EXEMPLE »
est toujours là. À 375×812, rendu inchangé.

**Point 2 — le lien de fermeture dit maintenant où la retrouver.**
Voie retenue : la seconde. Le comportement ne change pas (fermer mémorise, c'est
l'arbitrage voulu) ; c'est l'affichage qui cesse de mentir par omission. Une ligne discrète
sous le texte de l'étape, sur les étapes **1 à 4 uniquement** — là où la case
« Ne plus afficher » est absente :

> Fermer maintenant met fin à la visite. Vous la retrouverez dans « Réglages », sous
> « Découvrir votre espace ».

Le libellé « Découvrir votre espace » est **interpolé** depuis `visitePro.revoirTitre`, la
clé que l'écran Réglages rend vraiment — jamais recopié (piège déjà payé en anglais et en
italien sur « Mon espace partenaire »).

La crainte d'aggraver le point 1 ne se matérialise pas : la ligne ne s'affiche jamais en
même temps que la case, donc la bulle ne dépasse pas la hauteur qu'elle atteignait déjà à
l'étape 5, dont la mise en page était éprouvée. Vérifié à 375×667 et 375×812 : les cinq
étapes tiennent, l'étape 5 affiche la case **sans** la ligne, la cible n'est jamais masquée.

`npx tsc --noEmit` ✅ · parité fr/en/it ✅ (**378 clés**, `visitePro.fermerNote` ajoutée).
Base **non touchée** pendant ces essais : 33 commandes, la dernière du 2026-09-05 13:52 UTC,
et `visite_pro_vue_le` à `null` sur les 12 profils (ni « Terminer » ni « Fermer » n'ont été
tapés — c'est ce qui écrit la colonne).

### Reste à voir sur un vrai téléphone

- Le panneau épinglé et la barre de défilement **sur appareil** : le web et le natif ne
  dessinent pas les indicateurs de défilement de la même façon, et sur iOS la barre
  n'apparaît qu'**au moment du geste**. Si elle ne se voit pas assez, l'affordance à
  ajouter est un dégradé de bas de carte, pas un texte de plus.
- La ligne de fermeture **en italien**, la plus longue des trois, sur un écran de 360 px.
