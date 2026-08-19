# En attente de build

Ce qui est écrit et poussé mais **pas encore dans une app installable**. Décision prise le
2026-08-18 : on empile plusieurs chantiers et on ne fait qu'un seul build, la liaison de
Nosy Be rendant chaque envoi coûteux (~8 min rien que pour téléverser).

**À mettre à jour à chaque chantier, et à vider après chaque build.**

## Dernier build sorti

**n°16** — `1.0.0 (16)`, soumis à TestFlight le 2026-08-19. Contient un **diagnostic
temporaire** : le message d'erreur brut de la connexion sociale est affiché à l'écran sous le
message traduit (ligne `[diag]`), les journaux Supabase étant en panne prolongée côté serveur.

C'est ce build qui a livré l'information décisive sur Facebook : **« Bad ID token »**.

Historique des tentatives Facebook, toutes fondées sur un diagnostic erroné : n°15 figeait la
librairie en 12.2.0 pour forcer le flux classique ; n°14 posait `loginTrackingIOS: 'enabled'`
(sans effet sur la 13.x). Avant : n°13 construit à la main en interactif (capability Sign In
with Apple) ; n°12 réussi sans conséquence ; n°11 échoué (profil sans cette capability).

## Dans le prochain build

| Chantier | Vérifié |
|---|---|
| **Facebook en Limited Login** — corrigé et **confirmé sur appareil réel** (identité `provider='facebook'` créée en base). Librairie remise en 13.4.3 | testé sur appareil |
| **Diagnostic `[diag]` retiré** de l'écran de connexion — « Bad ID token » ne veut rien dire pour un client ; le message brut reste en console | relu, aucune trace résiduelle |
| **Bouton « Continuer avec un numéro » masqué** — les secrets WhatsApp ne sont pas posés, le bouton échouait (rejet Apple règle 2.1). Piloté par `EXPO_PUBLIC_PHONE_LOGIN_ENABLED`, absent = masqué | tsc + export web + **rendu vérifié dans un navigateur** : « E-mail » prend toute la largeur, aucun trou |

⚠️ Ce build est celui qui part à la soumission App Store. Voir
[SOUMISSION-APPLE.md](SOUMISSION-APPLE.md) et [FICHE-APP-STORE.md](FICHE-APP-STORE.md).

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
