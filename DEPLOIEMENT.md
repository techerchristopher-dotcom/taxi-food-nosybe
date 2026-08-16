# Déploiement — Taxi Food (Nosy Be)

## ✅ En ligne (déployé via la CLI Netlify)

- **App (PWA)** : https://taxi-food-nosybe.netlify.app — à ouvrir sur ton téléphone → « Ajouter à l'écran d'accueil ».
- **Dashboard admin** : https://taxi-food-admin-nosybe.netlify.app — réservé au compte rôle `admin`.

⚠️ **Dernière étape pour que le login Google marche sur ces URLs** — dans Supabase :
*Authentication → URL Configuration → Redirect URLs*, ajouter :
`https://taxi-food-nosybe.netlify.app` et `https://taxi-food-admin-nosybe.netlify.app`.
Tant que ce n'est pas fait, « Continuer avec Google » échoue au retour.

**Redéployer** (après un changement) : `cd app && npx expo export -p web && netlify deploy --prod --dir=dist --site=taxi-food-nosybe`
pour l'app ; `cd admin && npm run build && netlify deploy --prod --dir=out --site=taxi-food-admin-nosybe` pour l'admin.

---

Deux surfaces web, **même dépôt**, **même projet Supabase** (`bmdveawomizjpiebgtkj`), deux
sites Netlify distincts (chacun avec son *base directory*). Aucune des deux ne dépend du
compte Apple/Google Developer : elles tournent dans le navigateur (ordinateur **et téléphone**).

## 1. App cliente / restaurant / livreur (PWA) — dossier `app/`

Expo Router exporté en site statique (SPA). Config : [`app/netlify.toml`](app/netlify.toml).

1. Netlify → **Add new site → Import from Git** → ce dépôt.
2. **Base directory** : `app` · Build : `npx expo export -p web` · Publish : `dist` (déjà dans `netlify.toml`).
3. **Environment variables** (Site settings → Environment variables) :
   - `EXPO_PUBLIC_SUPABASE_URL` = `https://bmdveawomizjpiebgtkj.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = *(clé publishable/anon, cf. `app/.env`)*
   - `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` = *(cf. `app/.env`)*
4. Déployer → tu obtiens une URL (ex. `https://taxi-food-nosybe.netlify.app`).
5. **Sur ton téléphone** : ouvre l'URL dans le navigateur → « Ajouter à l'écran d'accueil » → tu testes le vrai parcours (login Google + GPS du navigateur) **sans passer par le store**.

## 2. Dashboard admin — dossier `admin/`

Next.js. Config : [`admin/netlify.toml`](admin/netlify.toml). Netlify détecte Next et installe son plugin.

1. Netlify → **Add new site** → même dépôt, **Base directory** : `admin`.
2. **Environment variables** :
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://bmdveawomizjpiebgtkj.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = *(même clé anon)*
3. Déployer → URL du dashboard (ex. `https://taxi-food-admin.netlify.app`). Réservé : seul un compte **rôle `admin`** peut voir les données (RLS) ; les autres voient « Accès refusé ».

## 3. Config Supabase (indispensable pour le login) ⚠️

Le flux Google renvoie vers l'origine du site ; cette origine doit être **autorisée**.

- **Authentication → URL Configuration → Redirect URLs** — ajouter :
  - `http://localhost:3000` (admin en dev) et l'URL Netlify de l'admin
  - `http://localhost:8081` (app en dev web) et l'URL Netlify de l'app
  - (natif, déjà là) `taxifood://*`, `exp://*`
- **Authentication → Sign In / Providers → Email → décocher « Allow new users to sign up »** (l'app ne crée jamais de compte).

## 4. Avant le premier vrai client

- Régler les **vrais taux de commission** par restaurant (dashboard → Restaurants) — actuellement 0,15 placeholder.
- Remplacer le **catalogue de test** (prix inventés) par les vrais menus/prix/photos (dashboard → Menu).
- Créer les **vrais comptes** restaurant/livreur : ils se connectent, « Demander l'accès », tu valides dans le dashboard (Demandes de rôle).
