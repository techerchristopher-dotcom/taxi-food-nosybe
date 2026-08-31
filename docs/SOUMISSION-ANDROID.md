# Soumission Android — état des lieux et plan

Démarré le 2026-08-19, une fois la soumission iOS envoyée à Apple. Même logique que
[SOUMISSION-APPLE.md](SOUMISSION-APPLE.md) : ce document distingue ce qui est fait, ce qui
est bloqué par du code, et ce qui est bloqué par un compte externe que seul le porteur du
projet peut créer (paiement, identité).

## ✅ Premier vrai test réussi (2026-08-19)

Build `development` compilé par EAS, installé et testé — d'abord sur l'émulateur (Pixel 8,
Android 34) : app fonctionnelle, écran de connexion correct pour Android (Google, Facebook,
Email — pas Apple, pas téléphone), Facebook bascule bien sur le flux web
(`redirectTo` déclenché dans les logs), Google natif se déclenche réellement (bloqué
uniquement par l'absence de compte Google sur l'émulateur, cause identifiée, pas un bug).
⚠️ Émulateur instable sur cette machine (8 Go de RAM au total, en dessous des 5 Go que
demande l'émulateur à lui seul) — plusieurs ANR pendant le test, sans rapport avec l'app.

**Confirmé ensuite par Christopher directement, en conditions réelles (parcours client
complet)** : connexion Google native ✅, connexion Facebook ✅, position GPS ✅. Les trois
briques posées aujourd'hui (keystore EAS, Client ID OAuth Android, clé Google Maps)
fonctionnent bout en bout.

## Déjà en place

- `app.json` : package `com.chris97416.taxifoodnosybe` (Android interdit les tirets, d'où la
  différence avec le bundle iOS `com.chris97416.taxi-food-nosybe`)
- Icône adaptative Android configurée (`android-icon-foreground.png`, `-background.png`,
  `-monochrome.png`)
- Permissions de localisation déclarées (`ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`)
- Plugin `expo-notifications` déjà paramétré pour Android (icône, couleur, canal `commandes`)
- Pas de dossier `android/` natif — build géré proprement par prebuild EAS
- `eas build --profile development --platform android` fonctionne déjà tel quel (APK de dev,
  aucun compte payant requis) — jamais buildé en profil `production` à ce jour

## A. Blocages réels dans le code

### A1. Clé Google Maps — ✅ FAIT (2026-08-19)

`react-native-maps` est déjà utilisé pour l'écran d'adresse (`components/MapSurface.tsx`).
Clé créée dans le même projet Google Cloud (`227662072769` / `taxifoodnosybe`), API « Maps
SDK for Android » activée (acceptation des conditions EEE au passage, formalité standard
sans rapport avec la zone réelle de l'app), et posée dans
`android.config.googleMaps.apiKey` (`app.json`).

**Restreinte des deux côtés**, vérifié à l'écran :
- Application restrictions → Android apps → `com.chris97416.taxifoodnosybe` +
  `6D:15:C4:4F:F6:B1:9E:A5:6E:BA:17:11:1E:1F:C4:1A:CC:87:E8:F5`
- API restrictions → Maps SDK for Android uniquement (sur 35 API activées dans le projet)

⚠️ Plan Google Cloud resté sur **Pay as you go** (gratuit avec quota généreux) — les offres
d'abonnement proposées (Starter 100 $/mois, Essentials 275 $/mois, Pro 1200 $/mois) ne sont
pas nécessaires pour ce volume d'usage, volontairement ignorées.

### A2. Connexion Google native sur Android — ✅ FAIT (2026-08-19)

Fait en trois étapes, ensemble, dans l'ordre :

1. **Keystore Android généré par EAS** (`eas credentials --platform android`, lancé par
   Christopher dans son propre terminal, profil `production`) → empreinte SHA-1 :
   `6D:15:C4:4F:F6:B1:9E:A5:6E:BA:17:11:1E:1F:C4:1A:CC:87:E8:F5`. ⚠️ Deux jeux de
   « Build Credentials » ont été créés par erreur (double passage sur « Set up a new
   keystore ») ; seul le second (marqué **Default**) sera utilisé pour signer l'app, le
   premier reste inutilisé mais inoffensif.
2. **Client ID OAuth Android créé dans Google Cloud Console** (même projet que iOS/web,
   `227662072769`), type « Android », avec le package `com.chris97416.taxifoodnosybe` et
   l'empreinte ci-dessus → `227662072769-l51ks9oq7g6q02f4ah12ptbqfhrv12a2.apps.googleusercontent.com`,
   posé dans `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (`app/.env` + les 4 profils `eas.json`).
3. **Code** : `googleNativeAvailable()` dans `lib/auth.ts` élargi aux deux plateformes.
   `signInWithGoogleNative()` lui-même n'a **pas changé** : vérifié que
   `GoogleSignin.configure` n'a pas de paramètre `androidClientId` — sur Android, c'est
   l'empreinte SHA-1 enregistrée côté Google (étape 2), pas une valeur dans le code, qui fait
   reconnaître l'app. La variable d'env ne sert que de drapeau « configuration faite »,
   comme son équivalent iOS.

⚠️ **À vérifier au premier build Android** : que le sélecteur de compte système s'ouvre bien
et que la connexion aboutit (le keystore de signature doit être celui utilisé pour le build,
sinon l'empreinte ne correspond plus à ce que Google Cloud attend).

### A3. Connexion Facebook native — ✅ RÉSOLU, AUCUN CODE À CHANGER (2026-08-19)

Recherché en détail avant de coder quoi que ce soit. Conclusion, confirmée par la doc Meta et
par des rapports de bug Supabase reproduisant le même symptôme que celui rencontré ici côté
iOS avant la bascule en Limited Login (« Bad ID token ») :

**Le mode Limited Login (jeton OIDC dont `signInWithIdToken` a besoin) n'existe pas côté SDK
Facebook Android**, quelle que soit la version de `react-native-fbsdk-next` (vérifié : 13.4.3
est la dernière, aucune version plus récente ne comble ce manque). C'est lié à l'App Tracking
Transparency d'Apple, qui n'a pas d'équivalent Android — le SDK Android ne renvoie qu'un
jeton d'accès Graph API classique (chaîne opaque, pas un JWT), que Supabase ne sait pas
vérifier par cette voie.

**Décision prise avec le porteur du projet** : Facebook reste disponible sur Android via le
flux web classique (option A), plutôt que de masquer le bouton sur cette plateforme (option
B). `facebookNativeAvailable()` étant déjà limité à `Platform.OS === 'ios'`, et le routage
dans `app/login.tsx` (`handleOAuth`) basculant déjà sur `signInWithOAuth('facebook')` — déjà
générique, déjà utilisé sur web — **rien à coder**. Juste le commentaire de
`facebookNativeAvailable()` mis à jour pour documenter que c'est une limite de plateforme
permanente, pas un chantier en attente.

⚠️ **À vérifier au premier build Android** : que le flux web (feuille de navigateur système)
s'ouvre et se referme correctement sur un vrai retour de session, comme sur web.

## ⛔ Le vrai calendrier : 12 testeurs pendant 14 jours

**Vérifié le 2026-08-24 sur la page officielle de Google**
([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)).
Ce point manquait à ce dossier, et il commande tout le reste.

Tout compte de développeur **personnel** créé **après le 13 novembre 2023** ne peut pas
publier directement en production. Le nôtre a été créé le **2026-08-19** : la règle
s'applique.

| Exigence | Valeur |
|---|---|
| Testeurs inscrits au test fermé | **12 minimum** |
| Durée d'inscription **continue** | **14 jours sans interruption** |
| Ce qu'on attend d'eux | **un usage réel** — Google vérifie depuis 2026 que les testeurs ont effectivement utilisé l'app, pas seulement accepté l'invitation |
| Puis | demander l'accès à la production, examen « une semaine ou moins » |

**Conséquence : il faut compter trois semaines entre le premier build et la publication**,
et ça ne se raccourcit pas. Le compte à rebours des 14 jours ne démarre qu'une fois les
12 testeurs inscrits — un treizième qui se désinscrit au jour 10 ne remet pas le compteur
à zéro, mais descendre sous 12 le fait.

⚠️ **Ce qu'il faut préparer MAINTENANT, en parallèle du reste** : réunir 12 personnes avec
un téléphone Android et un compte Google. À Nosy Be c'est faisable — le personnel des trois
restaurants partenaires, les livreurs qu'on recrute, l'entourage — mais ça se prépare, ça ne
s'improvise pas le jour du build. Les invitations se font par adresse Gmail ou par groupe
Google.

⚠️ **Ne pas confondre avec TestFlight.** Côté Apple, le test interne était facultatif et
instantané. Ici il est **obligatoire, minuté, et vérifié**.


### ⛔ L'ordre est imposé : les vérifications d'abord

Constaté dans le Play Console le **2026-08-24** : le bouton **« Create app » est verrouillé**,
avec la mention *« Complete account verifications to create new apps »*. Tant que les
vérifications de compte ne sont pas terminées, **rien** n'avance — ni la création d'une
application, ni le changement de type de compte.

Google enchaîne les trois vérifications dans cet ordre, chacune bloquant la suivante. Elles
sont **toutes les trois terminées au 2026-08-31** — ce paragraphe est conservé parce qu'il
explique l'ordre imposé, qui vaut pour toute reprise du dossier :

| # | Vérification | État au 2026-08-31 | Ce qu'il fallait |
|---|---|---|---|
| 1 | **Accès à un appareil Android** | ✅ faite | app **Play Console** installée sur l'Android, connexion réussie |
| 2 | **Identité** | ✅ approuvée | documents envoyés le 2026-08-19, approuvés par Google |
| 3 | **Numéro de téléphone** | ✅ confirmée le **2026-08-31** | exigeait que l'identité soit approuvée — son déblocage le prouve |

✅ **Les trois vérifications sont passées.** Le verrou « Complete account verifications to
create new apps » est levé : la création d'application et le changement de type de compte
sont désormais accessibles.

**Le compte a un identifiant : `6682410097385681985`.** Page « À propos de vous » :
`https://play.google.com/console/u/0/developers/6682410097385681985/account-details`

⚠️ **La conversion en compte organisation vient APRÈS ces trois vérifications**, pas avant.
Elles sont faites : la conversion est donc **l'étape en cours**. Ne pas s'y attaquer en
premier était l'erreur que ce dossier induisait ; l'ordre a été respecté.

### 👉 Le geste suivant (au 2026-08-31)

**Faire valider `rentanoo.com`** sur la page
[À propos de vous](https://play.google.com/console/u/0/developers/6682410097385681985/account-details) :
renseigner le site, enregistrer, puis **envoyer la demande de validation**. C'est l'étape 3
de la procédure ci-dessous, et elle bloque tout le reste — « Modifier le type de compte »
reste inaccessible tant que Google n'a pas validé le domaine.

### ✅ La sortie retenue : convertir le compte en « organisation »

La règle des 12 testeurs ne vise que les comptes **personnels**. Un compte
**organisation** y échappe. Christopher a une société — **Rentanoo, SAS, RCS Saint-Pierre
de La Réunion 100 000 926** — **et elle a déjà un numéro D-U-N-S** (confirmé le
2026-08-24). Le seul vrai péage de cette voie est donc déjà payé.

**La conversion est officiellement possible**, et elle ne demande NI nouveau compte, NI
nouveaux 25 $, NI transfert d'application. Ce qui change, c'est le **profil de paiement** :
le pays, le type de compte et le D-U-N-S ne peuvent pas être modifiés sur un profil
existant, il faut donc en créer un nouveau et le rattacher.

Procédure officielle, dans l'ordre
([Play Console Help](https://support.google.com/googleplay/android-developer/answer/16260648)) :

1. **Compte de développeur → À propos de vous**
2. Renseigner et enregistrer le **site web officiel de l'organisation**
3. **Envoyer une demande de validation** pour ce site — étape bloquante, à lancer en premier
4. Une fois le site validé : **Modifier le type de compte**
5. **Créer un nouveau profil de paiement** (l'ancien ne peut pas changer de type)
6. Renseigner les informations de l'organisation : type, taille, téléphone
7. Coordonnées de contact
8. Vérification d'identité si Google la demande
9. Associer le profil au compte développeur
10. **Confirmer**, puis **Enregistrer**
11. ⏳ **Attendre 72 heures** avant de soumettre une nouvelle application

Aucun frais supplémentaire n'est mentionné : les 25 $ sont des frais d'inscription uniques,
déjà réglés.

### ⚠️ Le piège de l'étape 5 : « D-U-N-S for a different organization »

Rencontré le **2026-08-31**. En saisissant le D-U-N-S de Rentanoo (**286027231**, vérifié
chez Dun & Bradstreet), le Play Console répond :

> *The D-U-N-S number you entered was for a different organization.*

**Le numéro n'est pas en cause.** Google l'a bien résolu — sinon il dirait « introuvable ».
Ce qu'il compare, c'est le **profil de paiement rattaché au compte**, pas le nom saisi dans
le formulaire :

| | Nom | Pays |
|---|---|---|
| Profil de paiement existant (personnel) | Jean Christopher TECHER | Mayotte (**YT**) |
| Enregistrement D-U-N-S | RENTANOO | La Réunion (**RE**) |

Nom différent, **pays différent** : le rapprochement échoue nécessairement. Et le pays d'un
profil de paiement **ne peut pas être modifié** — c'est précisément pour ça que la procédure
impose d'en créer un nouveau (étape 5), et pourquoi la deuxième suggestion du message
d'erreur est « Select a different payments profile ».

**La sortie** : revenir en arrière par la **flèche ←** (pas « Cancel », qui fait tout
reperdre), choisir **créer un nouveau profil** au lieu de réutiliser l'existant, type
*Organisation*, pays *La Réunion* — puis ressaisir le D-U-N-S. ✅ Résolu de cette façon le
2026-08-31.

⚠️ **Le nombre d'essais du D-U-N-S est limité** (« You have a limited number of tries »).
Ne jamais retenter le même numéro en espérant que ça passe : chercher la cause d'abord.

⚠️ **L'adresse du nouveau profil doit être celle de l'enregistrement D-U-N-S**, au caractère
près, car c'est elle que Google rapproche de Dun & Bradstreet :

```
RENTANOO
38 CHEMIN DE LA SOURCE
LA CHALOUPE SAINT LEU LE CAP
97416 SAINT-LEU
La Réunion (RE)
```

Si l'erreur persiste malgré un profil neuf, la doc Google renvoie au **support Play
Console** — y aller plutôt qu'insister, vu la limite d'essais.

### ✅ Conversion faite le 2026-08-31 — compte ORGANISATION

Le Play Console affiche désormais **« Organization account »** (ID `6682410097385681985`).

**La règle des 12 testeurs pendant 14 jours ne s'applique plus.** C'était le seul vrai
obstacle de calendrier côté Android ; le chemin court est ouvert.

⏳ **72 heures** entre la conversion et la possibilité de soumettre une application. Créer
l'application et remplir les formulaires reste possible pendant ce délai — c'est le moment
de le faire, il y a plusieurs heures de saisie.

#### Le « Developer name » reste un champ libre — réponse à la question laissée ouverte

Ce dossier annonçait que le nom public deviendrait forcément celui de l'entité du D-U-N-S.
**C'est faux, vérifié après conversion** : le champ est resté sur `christopher techer`,
inchangé, et modifiable (50 caractères, « It can be different to your name »). Google ne
force pas le nom vérifié.

⚠️ **À changer avant toute publication.** `christopher techer` est ce que les clients
verront comme éditeur sous le nom de l'application. Sur une place de marché où l'on commande
à manger et où l'on paie en espèces à un livreur, un prénom en minuscules ne rassure pas.
Valeur retenue : **`Rentanoo`** — cohérent avec l'entité vérifiée et avec ce que le site
annonce déjà.

## B. Comptes externes — à créer par le porteur du projet

Aucun de ces trois points ne peut être fait par un agent : identité, paiement, ou compte
Google personnel.

| Compte | Coût | Pour quoi | État |
|---|---|---|---|
| **Compte développeur Google Play** | 25 $ US, payés le 2026-08-19 | Soumission en production sur le Play Store | 🕓 créé, **en attente de vérification d'identité par Google** (délai annoncé : plusieurs jours) |
| **Clé API Google Maps** (Google Cloud Console) | Gratuit (Pay as you go) | Carte de l'écran d'adresse (A1) | ✅ créée et restreinte (2026-08-19) |
| **Client ID OAuth Android** (Google Cloud Console) | Gratuit | Connexion Google native (A2) | ✅ créé (2026-08-19) |
| **Projet Firebase** | Gratuit (plan Blaze déjà actif) | Notifications push sur Android | ✅ configuré (2026-08-19), voir plus bas |

### Compte Play Console — état détaillé (2026-08-19)

Compte individuel créé (« Personal account », `techerchristopher@gmail.com`). Trois vérifications
demandées par Google avant de pouvoir publier :

1. **Vérification d'identité** — documents envoyés, **en cours de traitement par Google**
   (« may take a few days »). Rien à faire de plus, juste attendre l'e-mail de confirmation.
2. **Vérification du numéro de téléphone** — ⏳ **bloquée derrière la vérification d'identité**,
   ne pas essayer avant que le point 1 soit validé.
3. **Vérification d'accès à un appareil Android réel** — installer l'app « Google Play
   Console » depuis le Play Store sur un vrai téléphone et s'y connecter. ⚠️ Nécessite un
   appareil Android physique ; Google bloque généralement cette vérification depuis un
   émulateur (détection anti-fraude). ✅ **Un appareil Android est disponible depuis le
   2026-08-24** — ce blocage est levé, la vérification peut être faite.

**Plus rien à faire côté code ou configuration pour Android tant que ces trois points ne
sont pas validés par Google.** Le compte étant en cours de vérification, aucun build
`production` Android ne devrait être soumis avant que ça débloque — l'app resterait bloquée
en attente de toute façon.

### Notifications push (FCM) — ✅ FAIT (2026-08-19)

Projet Firebase ajouté au même projet Google Cloud (`taxifoodnosybe`), plan **Blaze**
(paiement à l'usage, déjà actif — pas de coût pour ce volume). App Android enregistrée dans
Firebase (package `com.chris97416.taxifoodnosybe`).

Deux fichiers distincts, traités différemment :

- **`google-services.json`** — pas un secret (équivalent public de la config Firebase web,
  protégé par les restrictions déjà posées sur les clés, pas par sa confidentialité). Copié
  dans `app/google-services.json`, référencé via `android.googleServicesFile` dans
  `app.json`, **commité normalement**.
- **Clé de compte de service Firebase Admin SDK** (`taxifoodnosybe-firebase-adminsdk-*.json`)
  — un vrai secret, accès complet au projet Firebase. **Jamais copiée dans le dépôt** :
  téléversée directement dans le coffre-fort d'identifiants EAS
  (`eas credentials --platform android` → Google Service Account → Upload → assignée au
  rôle **Push Notifications (FCM V1)**), reste uniquement sur la machine de Christopher.

Confirmé dans le résumé EAS : *"Google Service Account Key assigned to
com.chris97416.taxifoodnosybe for FCM V1"*.

## C. À faire une fois les comptes créés

- [ ] Notifications push Android (FCM) : générer les identifiants (clé serveur historique
  dépréciée par Google, prévoir directement le format « compte de service » FCM V1),
  téléverser dans les credentials EAS
- [ ] `eas.json` : ajouter `submit.production.android` avec la clé de compte de service
  Google Play une fois le compte Play Console prêt
- [ ] Fiche Play Store : adapter les textes de [FICHE-APP-STORE.md](FICHE-APP-STORE.md)
  (réutilisables tels quels — nom, description, mots-clés ne sont pas spécifiques à iOS),
  mais **refaire les visuels** aux formats Google Play (icône 512×512, graphique de
  couverture 1024×500, captures dans des proportions différentes de l'iPhone 6,9")
- [ ] Questionnaire **Data Safety** (l'équivalent Google d'App Privacy) — mêmes faits que la
  fiche iOS (§2 de FICHE-APP-STORE.md), formulaire différent
- [ ] Classement de contenu **IARC** (différent du système Apple) — même donnée de fond :
  présence d'alcool au catalogue, à déclarer
- [ ] Premier build `production` Android, jamais fait à ce jour — lancé en interactif par
  Christopher, même règle que pour iOS (`docs/EN-ATTENTE-DE-BUILD.md`)


---

## ✅ Application créée et test interne en ligne — 2026-08-31

| | |
|---|---|
| ID application Play | `4972795001003481903` |
| Package | `com.chris97416.taxifoodnosybe` |
| Nom, langue, type | Taxi Food · Français (France) · Application · **Gratuite** |
| Canal test interne | `4700730027165144358` — **actif** |
| Release | **4 (1.1.0)**, publiée le 2026-08-31 |
| Lien d'inscription | https://play.google.com/apps/internaltest/4700730027165144358 |
| Liste de testeurs | « Equipe Taxi Food » — `techerchristopher@gmail.com` |

**Le test interne ne passe par AUCUNE revue** (« Release your app early for internal testing
without review », jusqu'à 100 testeurs) et **n'attend pas les 72 h** de la conversion en
compte organisation. C'est donc la voie la plus courte pour installer l'app sur un appareil.

Taille annoncée à l'installation : **33,6 Mo** (le `.aab` en fait 82 — c'est le découpage par
appareil du format App Bundle qui fait la différence).

⚠️ Tant que la fiche n'est pas complétée et validée, les testeurs voient le nom temporaire
`com.chris97416.taxifoodnosybe (unreviewed)`. Ce n'est pas un défaut de configuration.

⚠️ Un avertissement subsiste au dépôt : **pas de fichier de désobfuscation** joint au bundle.
Sans conséquence sur l'installation ni le fonctionnement — seuls les rapports de plantage
sont moins lisibles.

### Le sideload d'APK, à ne pas retenter

Avant d'en arriver là, plusieurs heures ont été perdues à installer l'APK à la main sur un
Blackview : téléchargement bloqué en affichage alors que le fichier était complet, fichier
introuvable dans le gestionnaire de fichiers, autorisation « sources inconnues » à débusquer.
**Le test interne règle tout ça d'un coup** : c'est le Play Store qui installe, il est déjà
autorisé, et il n'y a aucun fichier à manipuler. À réflexe pour toute prochaine vérification
sur appareil.

### Ce qui reste

- [ ] Fiche du magasin (textes prêts dans FICHE-PLAY-STORE.md), Data Safety, IARC
- [ ] Clé de compte de service → `app/google-play-service-account.json`, pour que
      `eas submit -p android` remplace le dépôt manuel du `.aab`
- [ ] Refaire les captures d'écran (celles en stock montrent l'ancien vouvoiement)
