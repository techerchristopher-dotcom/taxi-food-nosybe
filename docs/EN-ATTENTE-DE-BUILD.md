# En attente de build

Ce qui est écrit et poussé mais **pas encore dans une app installable**. Décision prise le
2026-08-18 : on empile plusieurs chantiers et on ne fait qu'un seul build, la liaison de
Nosy Be rendant chaque envoi coûteux (~8 min rien que pour téléverser).

**À mettre à jour à chaque chantier, et à vider après chaque build.**

## Dernier build sorti

**n°13** — `1.0.0 (13)`, soumis à TestFlight le 2026-08-18. Construit à la main par
Christopher (`eas build -p ios --profile production`, interactif — nécessaire pour que EAS
ajoute la capability « Sign In with Apple » côté portail Apple). Un build n°12 a réussi juste
avant, sans conséquence.

Contient tout ce qui était en attente depuis le build 10 :
- iOS ne se déclare plus compatible iPad
- Suppression de compte depuis le Profil + anonymisation des commandes
- Sign in with Apple, natif
- Connexion Google native (compte Google déjà utilisé sur le téléphone → sélecteur système)
- Connexion Facebook native (bascule vers l'app Facebook si installée)
- Écran de choix de rôle avec vraies photos + optimisation du chargement des images
  (ces deux derniers étaient déjà dans le build 10)

Le n°11 a échoué (profil sans la capability Apple Sign In, lancé sans authentification Apple
réelle — voir l'historique du dépôt si besoin de le rejouer).

## Dans le prochain build

*(vide — rien en attente)*

## Encore à construire avant de lancer un futur build

- [ ] Politique de confidentialité et URL de support — ne demandent **aucun build**, déjà en
      ligne, mais notées ici pour mémoire de ce qui reste à faire avant la soumission finale.
- [ ] Connexion Facebook/Google native — jamais testée sur un vrai appareil (l'écran web ne
      peut pas le faire). À vérifier au prochain test TestFlight : bascule vers l'app
      installée, retrouve la session sans ressaisie.

## Ce qui n'a PAS besoin d'un build

À ne pas confondre : ces points sont bloqués, mais pas par la compilation.

| Sujet | Ce qui manque | Pourquoi aucun build n'est nécessaire |
|---|---|---|
| **Connexion par WhatsApp** | les 5 secrets Meta dans le Vault | le code est parti dans le build 9. Dès que les secrets sont posés, le bouton « Continuer avec un numéro » fonctionne sur les apps déjà installées |
| **Sign in with Apple côté serveur** | ✅ fait le 2026-08-18 | bundle ID renseigné dans *Authentication → Providers → Apple → Client IDs* |
| **Connexion Google native côté serveur** | ✅ fait le 2026-08-18 | Client ID iOS ajouté dans *Authentication → Providers → Google → Client IDs* |
| **Connexion Facebook native côté serveur** | ✅ fait le 2026-08-18 | App Secret posé dans *Authentication → Providers → Facebook* |
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
