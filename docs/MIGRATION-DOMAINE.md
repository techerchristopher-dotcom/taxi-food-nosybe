# Migration vers `taxifoodnosybe.com` — étude d'impact

Étude menée le 2026-09-12, avant toute modification. Elle recense **tout** ce qui porte un
nom de domaine aujourd'hui, ce qui casse, ce qui ne casse pas, et dans quel ordre agir.

---

## 1. La décision à prendre AVANT tout le reste

Aujourd'hui, trois noms servent trois choses différentes :

| Nom actuel | Ce qu'il sert | Site Netlify |
|---|---|---|
| `taxifoodnosybe.distripro207.com` | **Le site public** (présentation, partage, boutons Telegram) | `taxi-food-nosybe-landing` |
| `taxifood.distripro207.com` | **L'app web** (commander, espace partenaire) | `taxi-food-commander` |
| `admin.distripro207.com` | Le tableau de bord patron | `taxi-food-admin-nosybe` |

`taxifood.rentanoo.com` est l'ancien nom du site public, **abandonné mais pas coupé** : il
renvoie ici en 301 depuis le 2026-09-06.

**Deux scénarios, et le coût n'est pas le même.**

### Scénario A — seul le site public déménage

`taxifoodnosybe.com` remplace `taxifoodnosybe.distripro207.com`. L'app web et l'admin ne
bougent pas.

C'est **le moins risqué** : rien de ce qui touche à l'authentification ne bouge. Mais le
client qui clique « Commander » atterrit toujours sur `taxifood.distripro207.com`, un nom
qui ne ressemble à rien pour lui.

### Scénario B — tout déménage

```
taxifoodnosybe.com              → site public
commander.taxifoodnosybe.com    → app web
admin.taxifoodnosybe.com        → tableau de bord
```

C'est cohérent de bout en bout, et c'est probablement ce qu'il faut viser. Mais **ça touche
l'authentification**, donc le risque de casser la connexion des clients existants.

> ⚠️ **Dans les deux scénarios, le point dur est le même** — voir §3.

---

## 2. Inventaire complet

### 2.1 Ce qui casse tout seul si on ne fait rien

| Endroit | Quoi | Combien | Gravité |
|---|---|---|---|
| `landing/**/*.html` | canonical, hreflang, og:url, og:image, JSON-LD (`@id`, `url`) | **~350 occurrences** sur 11 pages | 🟠 SEO |
| `landing/sitemap.xml` | 8 `<loc>` | 34 occurrences | 🟠 SEO |
| `landing/robots.txt` | `Sitemap:` + commentaires | 3 | 🟠 |
| `landing/netlify.toml` | commentaire du domaine canonique | 1 | 🟢 |
| `landing/_redirects` | règles de redirection absolues | 4 lignes | 🔴 à réécrire |
| `landing/js/partenaires.js` | `COMMANDE = 'https://taxifood.distripro207.com'` | 1 | 🟠 |
| `landing/mon-espace/index.html` | lien de connexion partenaire | 1 | 🟠 |
| `app/lib/partage.ts` | `SITE` — **base de tous les liens partagés** | 1 | 🔴 |
| `app/app.json` | `associatedDomains` + `intentFilters` | 3 + 7 | 🔴 **build natif** |
| Base : `notify_order_status` | `v_site` — liens de suivi, d'acceptation et de refus | 1 fonction | 🔴 |
| `n8n` | 2 workflows | 2 | 🟠 |
| `emails/*.html` | pointent sur `taxifood.rentanoo.com` | 3 | 🟠 **déjà faux** |

### 2.2 Ce qui ne casse PAS

- **`.well-known/apple-app-site-association` et `assetlinks.json`** ne contiennent aucun nom
  de domaine : ils déclarent seulement l'app. Il suffit de les **servir sur le nouveau nom**.
- **Les fonctions Netlify** (`/p/:id`, `/r/:id`, `/a/:id/:token`, `/r-refus/:id/:token`)
  déclarent des **chemins**, pas des domaines. Elles suivent le site.
- **Supabase** (base, stockage, fonctions Edge) : aucune URL de notre domaine. Le stockage
  sert sur `bmdveawomizjpiebgtkj.supabase.co`, inchangé.
- **Stripe** : le webhook pointe sur Supabase, pas sur nous.
- **Les identifiants d'app** (`com.chris97416.*`) ne changent pas : ce n'est **pas** une
  nouvelle app sur les magasins.

### 2.3 Ce que seul le scénario B touche

- **Supabase → Authentication → URL Configuration** : `Site URL` et la liste des
  `Redirect URLs` doivent accueillir `https://commander.taxifoodnosybe.com/**`.
  ⚠️ **Ne pas retirer les anciennes** avant que plus personne n'arrive dessus : un lien de
  validation d'e-mail déjà envoyé pointe sur l'ancien nom.
- **Google Cloud Console** (client OAuth web) : origines JavaScript autorisées.
- **Facebook Login** : domaines autorisés.
- **App Store Connect / Play Console** : URL d'assistance et de confidentialité.

---

## 3. Le point dur : les liens profonds ne se mettent PAS à jour par OTA

C'est **la** contrainte qui commande le calendrier.

`associatedDomains` (iOS) et `intentFilters` (Android) sont de la **configuration native**.
Ils sont figés dans le binaire à la compilation. Une mise à jour à distance ne peut pas les
changer — voir [[ota-ne-rejoint-que-la-meme-version-taxi-food]].

**Conséquences, à accepter telles quelles :**

1. Ajouter `taxifoodnosybe.com` aux liens profonds exige **un nouveau build et un nouveau
   passage en revue Apple**. Compter plusieurs jours.
2. D'ici là — et pour toujours sur les binaires que personne ne mettra à jour — un lien
   `https://taxifoodnosybe.com/p/<id>` **s'ouvrira dans le navigateur, pas dans l'app**.
3. Donc **le nouveau domaine doit se comporter correctement dans un navigateur** avant même
   d'être annoncé : la page de partage `/p/:id` existe déjà et fait ce travail (aperçu +
   renvoi vers le magasin). C'est déjà couvert.

**Il faut donc, dans l'ordre :** poser le domaine → sortir un build qui déclare les deux noms
→ attendre son approbation → seulement ensuite basculer les liens émis (`v_site`, `SITE`).

Basculer `v_site` avant que le build soit en ligne enverrait les restaurateurs vers le
navigateur au lieu de leur espace partenaire — exactement le défaut du 2026-09-09.

---

## 4. Ce qu'il ne faut JAMAIS faire

**Ne pas couper les anciens domaines.** Jamais, ni au DNS, ni chez Netlify.

Trois raisons, toutes déjà payées sur ce projet :

- Les **liens WhatsApp déjà partagés** par les clients pointent sur l'ancien nom.
- Les **boutons Telegram déjà envoyés** aux restaurateurs (`/a/<id>/<jeton>`) portent
  l'ancien nom dans des messages qu'on ne peut pas réécrire.
- Les **Universal Links des binaires en circulation** déclarent les anciens noms. Couper le
  domaine casse l'ouverture de l'app pour eux, définitivement.

C'est exactement pourquoi `taxifood.rentanoo.com` est encore debout aujourd'hui, en 301, un
mois après son abandon. Le même traitement s'applique à `distripro207`.

---

## 5. Ordre d'exécution recommandé

| # | Étape | Qui | Réversible ? |
|---|---|---|---|
| 1 | Acheter `taxifoodnosybe.com` | toi | — |
| 2 | Le rattacher au site Netlify du **site public**, le passer en *primary domain*, laisser les anciens en 301 | moi, si tu m'ouvres Netlify | oui |
| 3 | Vérifier que le certificat est émis et que `/.well-known/*` répond sur le nouveau nom | moi | — |
| 4 | Réécrire les ~350 URL absolues du site + sitemap + robots + `_redirects` | moi | oui (git) |
| 5 | Déployer le site public, vérifier les 301 et les balises canonical | moi | oui |
| 6 | `app.json` : **ajouter** le nouveau nom aux liens profonds, sans retirer les anciens | moi | oui |
| 7 | Nouveau build iOS + Android, soumission | toi (commandes) | non |
| 8 | **Attendre l'approbation Apple** | — | — |
| 9 | Basculer `SITE` (`app/lib/partage.ts`) puis publier en OTA | moi + toi | oui |
| 10 | Basculer `v_site` dans `notify_order_status` (migration) | moi | oui |
| 11 | n8n, e-mails, URL des fiches des magasins | moi + toi | oui |
| 12 | Google Search Console : déclarer le changement d'adresse | toi | — |

> Les étapes 1 à 5 se font **sans rien casser** et sans toucher aux apps. Elles peuvent être
> faites tout de suite. Tout ce qui suit dépend du délai de revue d'Apple.

---

## 6. À corriger en passant (défauts trouvés pendant l'étude)

- ⚠️ **Les trois gabarits d'e-mail pointent sur `taxifood.rentanoo.com`**, le domaine
  abandonné depuis le 2026-09-06. Ça fonctionne par la grâce du 301, mais les images
  (`/assets/icon-512.png`, `/og/taxi-food-nosy-be.jpg`) traversent une redirection à chaque
  ouverture, et certains clients de messagerie ne suivent pas les 301 sur les images.
- ⚠️ **La page Facebook n'est liée nulle part** sur le site : le bloc « Suis-nous » ne
  contient que YouTube et WhatsApp. À corriger avec l'ajout de TikTok.

---

## 7. Estimation

| Bloc | Charge | Risque |
|---|---|---|
| Site public (étapes 2 à 5) | ~1 h | 🟢 faible, réversible |
| Liens profonds + build (6 à 8) | ~30 min + délai Apple | 🟠 dépend d'un tiers |
| Bascule des liens émis (9 à 11) | ~1 h | 🟠 à faire APRÈS approbation |
| Scénario B, en plus : auth | ~1 h | 🔴 peut couper la connexion si mal fait |

**Total hors attente : une demi-journée.** Le vrai coût n'est pas le travail, c'est le délai
de revue d'Apple au milieu du chemin.
