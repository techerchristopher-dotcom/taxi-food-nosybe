# En attente de build

Ce qui est écrit et poussé mais **pas encore dans une app installable**. Décision prise le
2026-08-18 : on empile plusieurs chantiers et on ne fait qu'un seul build, la liaison de
Nosy Be rendant chaque envoi coûteux (~8 min rien que pour téléverser).

**À mettre à jour à chaque chantier, et à vider après chaque build.**

## Dernier build sorti

**n°10** — `1.0.0 (10)`, construit sur le commit `4b6c19b`.

## Dans le prochain build

| Commit | Chantier | Vérifié |
|---|---|---|
| `f231e8d` | iOS ne se déclare plus compatible iPad (`supportsTablet: false`) | config relue |
| `c0d31f6` | Suppression de compte depuis le Profil + anonymisation des commandes | testé sur la vraie base, 2 comptes jetables |
| `370262a` | Sign in with Apple, natif | tsc + export web |

`498a0a2` ne contient que de la documentation, rien à compiler.

## Encore à construire avant de lancer

- [ ] **Connexion Facebook native** — bloqué : il manque l'App ID et le Client Token Meta.
      Ajoute un module natif, donc **exige un build**.
- [ ] Politique de confidentialité et URL de support — ne demandent **aucun build**, mais
      sont obligatoires pour la soumission.

## ⚠️ Ce build devra être INTERACTIF

```bash
cd app && eas build -p ios --profile production
```

**Sans `--non-interactive`.** L'entitlement « Sign In with Apple » doit être ajouté à l'App
ID côté portail Apple, et EAS ne sait le faire qu'authentifié — exactement le blocage
rencontré avec la capability Push, qui avait fait échouer les builds 7 et 8.

## Ce qui n'a PAS besoin d'un build

À ne pas confondre : ces points sont bloqués, mais pas par la compilation.

| Sujet | Ce qui manque | Pourquoi aucun build n'est nécessaire |
|---|---|---|
| **Connexion par WhatsApp** | les 5 secrets Meta dans le Vault | le code est parti dans le build 9. Dès que les secrets sont posés, le bouton « Continuer avec un numéro » fonctionne sur les apps déjà installées |
| **Sign in with Apple côté serveur** | ✅ fait le 2026-08-18 | bundle ID renseigné dans *Authentication → Providers → Apple → Client IDs* |
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
