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

## B. Comptes externes — à créer par le porteur du projet

Aucun de ces trois points ne peut être fait par un agent : identité, paiement, ou compte
Google personnel.

| Compte | Coût | Pour quoi | État |
|---|---|---|---|
| **Compte développeur Google Play** | 25 $ US, paiement unique, vérification d'identité | Soumission en production sur le Play Store | ❌ pas encore créé (confirmé 2026-08-19) |
| **Clé API Google Maps** (Google Cloud Console) | Gratuit (Pay as you go) | Carte de l'écran d'adresse (A1) | ✅ créée et restreinte (2026-08-19) |
| **Client ID OAuth Android** (Google Cloud Console) | Gratuit | Connexion Google native (A2) | ✅ créé (2026-08-19) |
| **Projet Firebase** (ou clé serveur FCM) | Gratuit | Notifications push sur Android | ❌ pas encore créé |

Le compte Play Console est **le seul point restant strictement bloquant pour soumettre** ; le
projet Firebase bloque une fonctionnalité (notifications) mais pas un premier build de test
(`eas build --profile development --platform android`, qui marche déjà).

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
