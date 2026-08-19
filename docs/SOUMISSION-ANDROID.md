# Soumission Android — état des lieux et plan

Démarré le 2026-08-19, une fois la soumission iOS envoyée à Apple. Même logique que
[SOUMISSION-APPLE.md](SOUMISSION-APPLE.md) : ce document distingue ce qui est fait, ce qui
est bloqué par du code, et ce qui est bloqué par un compte externe que seul le porteur du
projet peut créer (paiement, identité).

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

### A1. Clé Google Maps manquante — À FAIRE

`react-native-maps` est déjà utilisé pour l'écran d'adresse (`components/MapSurface.tsx`),
mais `android.config.googleMaps.apiKey` est absent d'`app.json`. Sans elle, la carte ne
s'affichera pas sur Android — écran d'adresse dégradé au moment précis où Nosy Be en a le
plus besoin (pas d'adressage postal fiable). iOS n'a pas ce problème : MapKit d'Apple est
gratuit et ne demande aucune clé.

**Bloqué sur** : création d'une clé API dans Google Cloud Console (Maps SDK for Android),
restreinte au package `com.chris97416.taxifoodnosybe` + à l'empreinte SHA-1 du certificat de
signature. Gratuit avec quota généreux, mais Google peut demander une carte bancaire pour
activer la facturation du projet (au cas où le quota gratuit serait dépassé).

### A2. Connexion Google native désactivée par un verrou en dur — CORRIGEABLE UNE FOIS LA CLÉ ANDROID CRÉÉE

`googleNativeAvailable()` dans `lib/auth.ts` :
```ts
return Platform.OS === 'ios' && Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
```
Le code de connexion (`signInWithGoogleNative`) est déjà générique — aucune dépendance iOS à
l'intérieur, il utilise `webClientId` (déjà en place) et `iosClientId` (optionnel selon la
plateforme). Une fois un **Client ID OAuth Android** créé dans Google Cloud Console (type
« Android », avec le package et le SHA-1 du keystore EAS), il suffira de :
1. l'ajouter en `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` dans `app/.env` et les profils
   `eas.json` concernés (actuellement vide dans `.env`, colonne déjà prévue) ;
2. passer `androidClientId` à `GoogleSignin.configure` (actuellement absent, à ajouter à côté
   de `webClientId`/`iosClientId`) ;
3. élargir `googleNativeAvailable()` aux deux plateformes.

**Bloqué sur** : récupérer l'empreinte SHA-1 du keystore que EAS gère (`eas credentials
--platform android`, interactif — à lancer par Christopher dans son propre terminal, même
règle que pour iOS), puis créer le Client ID Android dans Google Cloud Console avec cette
empreinte.

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
| **Clé API Google Maps** (Google Cloud Console) | Gratuit avec quota, carte bancaire parfois demandée | Carte de l'écran d'adresse (A1) | ❌ pas encore créée |
| **Client ID OAuth Android** (Google Cloud Console) | Gratuit | Connexion Google native (A2) | ❌ pas encore créé |
| **Projet Firebase** (ou clé serveur FCM) | Gratuit | Notifications push sur Android | ❌ pas encore créé |

Le compte Play Console est **le seul strictement bloquant pour soumettre** ; les trois autres
bloquent des fonctionnalités (carte, Google natif, notifications) mais pas un premier build
de test (`eas build --profile development --platform android`, qui marche déjà).

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
