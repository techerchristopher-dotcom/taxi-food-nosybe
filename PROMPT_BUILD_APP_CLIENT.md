# Prompt pour Claude Code — Scaffold de l'application cliente Taxi Food

Copie-colle ce fichier entier comme instruction à Claude Code (ou dis-lui « lis et exécute PROMPT_BUILD_APP_CLIENT.md »).

---

## Contexte

Nous construisons **Taxi Food**, une application de livraison de repas (pizza, tacos, burgers…) à Nosy Be, Madagascar. Ce dépôt (`taxi-food-nosybe`) contient déjà :

- `CAHIER-DES-CHARGES-MVP.md` — le cahier des charges fonctionnel complet de l'app cliente.
- `SCHEMA-TAXI-FOOD.md` — le schéma de données prévu (pas encore appliqué à un vrai backend).
- `design/taxi-food-deck/` — l'export de la maquette produite par Claude Design : `Taxi Food.dc.html`, `_parts.json`, `assets/logo/*.png`. **Lis `_parts.json`** (clé `parts` = 14 écrans en HTML/CSS inline, clé `comps` = bibliothèque de composants, clé `logic` = logique de démo du suivi de commande) pour extraire fidèlement : la palette de couleurs, la typographie (Archivo + JetBrains Mono via Google Fonts), les rayons de bordure, les ombres, et le layout exact de chaque écran. C'est la **référence visuelle exacte** à respecter à l'écran près — ne réinvente pas le design, extrais-le de ce fichier.

**Important :** ce dossier `design/taxi-food-deck/` est une maquette statique (HTML/CSS), **pas du code d'application réutilisable**. Ta mission est de reconstruire une vraie application à partir de cette référence visuelle, pas de l'importer telle quelle.

## Étape 0 — Ranger le design dans le dépôt

Si ce n'est pas déjà fait : crée `design/taxi-food-deck/`, place-y les fichiers de l'export Claude Design (`Taxi Food.dc.html`, `_parts.json`, `deck-stage.js`, `support.js`, `assets/logo/*`), commit (« Ajout de la maquette Claude Design (charte + 14 écrans) »).

## Étape 1 — Initialiser le projet Expo

Dans `taxi-food-nosybe/app/` (même convention de nommage que `addition-appli/app/`) :

```
npx create-expo-app@latest . --template blank-typescript
```

Ajoute : `expo-router` (navigation par fichiers) ou `@react-navigation/native` — à ton choix, mais reste cohérent sur tout le projet. Ajoute aussi `zustand` (ou React Context) pour l'état du panier, et `@react-native-async-storage/async-storage` pour la persistance locale légère.

## Étape 2 — Extraire le design system

Crée `app/theme/tokens.ts` avec, au minimum :

```ts
export const colors = {
  primary: '#E8342A',   // rouge
  secondary: '#FF8A1E', // orange
  accent: '#FFC72C',    // jaune
  // + les couleurs neutres/texte/fond que tu identifies dans _parts.json
};

export const fonts = {
  display: 'Archivo', // titres, boutons
  mono: 'JetBrainsMono', // labels techniques, prix, badges
};
```

Complète avec les rayons de bordure, tailles de police et espacements observés dans `_parts.json` (les valeurs sont dans les `style="..."` inline : rayons ~16-22px pour les cartes, ~999px pour les boutons pilule, etc.).

Charge les polices via `expo-font` (Archivo + JetBrains Mono, disponibles sur Google Fonts).

## Étape 3 — Construire les écrans

Reconstruis fidèlement, en composants React Native réels (pas de HTML), les 14 écrans/états présents dans `_parts.json` :

1. Connexion (bouton « Continuer avec Google »)
2. Saisie du numéro de téléphone (1ère connexion)
3. Accueil — liste des restaurants
4. Menu d'un restaurant
5. Détail d'un produit (feuille modale)
6. Panier
7. Panier vide / conflit de restaurant (changer de resto vide le panier en cours)
8. Adresse de livraison
9. Validation de commande (choix du mode de paiement CB / Espèces / Orange Money)
10. Confirmation de commande
11. Suivi de commande (les 5 statuts, réutilise la logique vue dans `logic` de `_parts.json`)
12. Historique des commandes
13. Historique vide
14. Profil

Découpe en composants réutilisables (carte restaurant, carte produit, bouton primaire/secondaire, badge de statut, barre de navigation basse) plutôt que de dupliquer du style écran par écran.

## Étape 4 — Données factices (mock)

Le backend n'est pas encore branché. Crée `app/data/mock.ts` avec 3-4 restaurants fictifs de Nosy Be (reprends les noms déjà utilisés dans la maquette : Pizzeria Papillon, Tacos du Boulevard, Burger Baobab, Chez Loulou), chacun avec un menu réaliste en ariary. Toute la navigation (accueil → menu → panier → commande → suivi) doit fonctionner de bout en bout avec ces données locales, sans réseau.

## Étape 5 — Connexion Google (scaffold uniquement, sans vrai backend)

Mets en place le flux d'écran et l'UI avec `expo-auth-session` (provider Google), mais **stocke la session localement** (AsyncStorage) pour l'instant — pas d'appel à un vrai backend. Isole toute la logique d'authentification derrière une interface claire dans `app/lib/auth.ts` (`signIn()`, `signOut()`, `getSession()`), pour que brancher Supabase Auth plus tard ne demande de modifier qu'un seul fichier.

## Étape 6 — Panier et navigation

- Un panier ne contient que des produits d'un seul restaurant (redemande confirmation sinon, comme sur l'écran « Panier vide / conflit »).
- Persiste le panier en local (AsyncStorage) pour survivre à la fermeture de l'app.
- Le parcours complet (accueil → resto → produit → panier → adresse → paiement → confirmation → suivi) doit être navigable et fonctionnel avec les données mock.

## Étape 7 — Vérification

Avant de commit :
- `npx expo start` doit lancer l'app sans erreur.
- Teste le parcours complet en local (mock).
- Vérifie que les 14 écrans respectent la palette et la typo extraites de `_parts.json`.

Commit (« Scaffold app cliente Expo — 14 écrans, données mock, auth Google en local »), pousse sur `origin main` (HTTPS, pas SSH — comme pour tout ce dépôt).

## Étape 8 — NE PAS FAIRE MAINTENANT

Ne branche pas encore de vrai backend. Le projet Supabase de Taxi Food sera créé séparément, et une prochaine étape reprendra `SCHEMA-TAXI-FOOD.md` pour l'appliquer, remplacera `app/data/mock.ts` par de vrais appels Supabase, et remplacera le `app/lib/auth.ts` local par Supabase Auth (Google OAuth). Signale simplement, à la fin, tout ce qui a été laissé en mock pour faciliter cette dernière étape.

## À la fin, confirme-moi :

- Le lien du commit / push.
- La liste des écrans effectivement implémentés vs restants.
- Tout point de la maquette que tu n'as pas pu reproduire fidèlement (et pourquoi).
