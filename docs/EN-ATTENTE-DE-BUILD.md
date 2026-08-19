# En attente de build

Ce qui est écrit et poussé mais **pas encore dans une app installable**. Décision prise le
2026-08-18 : on empile plusieurs chantiers et on ne fait qu'un seul build, la liaison de
Nosy Be rendant chaque envoi coûteux (~8 min rien que pour téléverser).

**À mettre à jour à chaque chantier, et à vider après chaque build.**

## Dernier build sorti

**n°14** — `1.0.0 (14)`, soumis à TestFlight le 2026-08-18. Construit et soumis en
`--non-interactive` : aucune nouvelle capability Apple n'était nécessaire (Google/Facebook
natifs n'en réclament aucune, et Sign In with Apple était déjà acquis depuis le build 13).

Contient, en plus de tout ce qui était dans le n°13 :
- Écran de connexion : clarifie que Google/Facebook/Apple/téléphone créent le compte tout
  autant que l'e-mail
- Tentative de correctif Facebook natif (`loginTrackingIOS: 'enabled'`) — **insuffisante**,
  voir ci-dessous.

⚠️ **Retesté sur appareil réel : Facebook échoue toujours sur le n°14.** `loginTrackingIOS:
'enabled'` n'a aucun effet sur `react-native-fbsdk-next` 13.4.3 : à partir de la 13.0.0, la
librairie adopte le SDK iOS natif de Meta v17 et **impose** le mode « Limited Login » sans
exception. Cause identifiée dans le changelog GitHub de la librairie elle-même. Vrai correctif
dans le prochain build : version figée à `12.2.0` — voir ci-dessous.

Historique : n°13 construit à la main par Christopher en interactif (capability Sign In with
Apple) ; n°12 a réussi juste avant sans conséquence ; n°11 a échoué (profil sans cette
capability, lancé sans authentification Apple réelle).

## Dans le prochain build

| Commit | Chantier | Vérifié |
|---|---|---|
| *(à committer)* | **`react-native-fbsdk-next` figé à `12.2.0`** (`--save-exact`), dernière version avant que la 13.0.0 n'impose le Limited Login iOS — et première à supporter la New Architecture RN, donc aucun recul de compatibilité. Le correctif du build 14 (`loginTrackingIOS: 'enabled'`) redevient effectif sur cette version | tsc + export web + chargement réel du bundle. **Pas encore testé sur appareil réel** |

## Ce qui n'a PAS besoin d'un build

À ne pas confondre : ces points sont bloqués, mais pas par la compilation.

| Sujet | Ce qui manque | Pourquoi aucun build n'est nécessaire |
|---|---|---|
| **Connexion par WhatsApp** | les 5 secrets Meta dans le Vault | le code est parti dans le build 9. Dès que les secrets sont posés, le bouton « Continuer avec un numéro » fonctionne sur les apps déjà installées |
| **Sign in with Apple côté serveur** | ✅ fait le 2026-08-18 | bundle ID renseigné dans *Authentication → Providers → Apple → Client IDs* |
| **Connexion Google native côté serveur** | ✅ fait le 2026-08-18 | Client ID iOS ajouté dans *Authentication → Providers → Google → Client IDs*, **et** « Skip nonce check » activé (les SDK natifs mobiles ne savent pas satisfaire le nonce que Supabase attend par défaut — recommandation officielle de leur doc) |
| **Connexion Facebook native côté serveur** | ✅ fait le 2026-08-18 | App Secret posé, permission `email` ajoutée côté Meta (Use Cases → Authentication and Account Creation — absente du prompt Cowork d'origine), « Allow users without an email » activé en filet de sécurité |
| **Prix réels** | le vrai catalogue | ils viennent de la base, pas du bundle |
| **Fiche App Store** | captures, description | métadonnées App Store Connect |
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
