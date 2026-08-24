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
