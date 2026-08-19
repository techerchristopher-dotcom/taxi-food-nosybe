# Captures d'écran App Store

Les six captures à téléverser dans App Store Connect, prises le 2026-08-19.

**Deux formats, un dossier chacun :**

| Dossier | Format | Zone de dépôt App Store Connect |
|---|---|---|
| `./` (racine) | 1320 × 2868 px | « iPhone — 6,9 pouces » |
| `6.5-pouces/` | 1284 × 2778 px | « iPhone — 6,5 pouces » |

⚠️ **Constaté le 2026-08-19 en déposant réellement dans App Store Connect** : l'interface a
demandé la zone « Écran de 6,5 pouces » (tailles acceptées 1242×2688 ou 1284×2778), **pas**
1320×2868 comme documenté ici initialement. La doc d'origine («&nbsp;6,9 pouces, le seul
format obligatoire, App Store Connect décline automatiquement&nbsp;») était fausse — ou du
moins ne correspond plus à ce que montre l'interface pour cette app. D'où les deux dossiers :
inutile de deviner quelle zone apparaîtra, les deux tailles sont prêtes. Si une zone « 6,9
pouces » apparaît aussi (clic sur « Afficher toutes les tailles dans le gestionnaire des
visuels »), les fichiers de la racine lui correspondent déjà.

Le dossier `6.5-pouces/` est un simple redimensionnement des captures d'origine (`sips -z 2778
1284`), pas une reprise de zéro : l'écart de proportion entre les deux formats est inférieur à
0,5 %, imperceptible à l'œil (vérifié sur la capture 1).

Prises dans le **simulateur iOS** (iPhone 17 Pro Max, `xcrun simctl io … screenshot`) : un
iPhone 14 Pro rend en 1179 × 2556, une taille qu'Apple n'accepte dans aucune des deux zones.

À téléverser **dans cet ordre** — les deux premières sont celles que la plupart des visiteurs
verront :

| Fichier | Écran | Légende suggérée |
|---|---|---|
| `01-accueil.png` | Liste des trois restaurants, filtres par type | « Vos restaurants préférés, livrés chez vous » |
| `02-menu.png` | Carte de La Cabane, photos et prix réels | « Les vraies cartes, les vraies photos » |
| `03-options.png` | Configurateur du Tacos, viande et sauce choisies | « Composez exactement ce que vous voulez » |
| `04-panier.png` | Deux articles, sous-total, frais et total | « Aucune surprise sur le prix » |
| `05-adresse-gps.png` | Position captée, carte, précisions livreur | « Livré où vous êtes, même sans adresse postale » |
| `06-suivi.png` | Commande TF-44 à l'étape « en route vers vous » | « Suivez votre repas en direct » |

Tout est réel : compte de démonstration `demo.apple@taxifood.mg`, catalogue et prix des vrais
restaurants, position GPS posée sur Hell-Ville (−13,40560 / 48,26220).

## Aussi en ligne, pour le marketing

Les mêmes fichiers sont déposés dans le **bucket Storage `marketing`**, sous `app-store/`,
en lecture publique — utilisables tels quels dans un site, un dossier de presse ou un post,
sans jeton :

```
https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/marketing/app-store/01-accueil.png
```

… et de même pour `02-menu.png`, `03-options.png`, `04-panier.png`, `05-adresse-gps.png`,
`06-suivi.png`.

Le bucket est **séparé des buckets métier** (`produits`, `logo`, `MENU`, `boissons`) exprès :
ceux-là alimentent l'app, celui-ci ne sert qu'à la communication. Il accueillera le reste des
visuels marketing (presse, réseaux sociaux, site) dans d'autres préfixes.

Redimensionnement à la volée par Supabase, pratique pour le web — une vignette de 400 px de
large en WebP :

```
…/render/image/public/marketing/app-store/01-accueil.png?width=400&quality=80
```

⚠️ **L'écriture est réservée aux administrateurs** (`public.is_admin()`). Pour déposer un
nouveau visuel : le tableau de bord Supabase (*Storage → marketing*), qui passe par la clé
`service_role`. Voir `CLAUDE.md` § Buckets Storage.

## Ce qui reste perfectible

Rien ne bloque la soumission, mais deux points se voient :

1. **Aucun restaurant n'a de photo de bannière** (`restaurants.cover_url` est NULL pour les
   trois). Le bandeau de la carte vedette (capture 1) et celui de la fiche restaurant
   (capture 2) sont donc des aplats de couleur vides. Une seule photo par établissement les
   remplirait — c'est le meilleur rapport effort/résultat sur ces deux captures. Rien n'a été
   inventé à la place : une photo approximative tromperait le client.
2. Quelques produits n'ont pas de visuel (les softs de La Cabane, le Sirop visible en
   suggestion sur la capture 4) et affichent le pictogramme couverts. Même règle : pas de
   photo sans le vrai produit.

## Pour en reprendre une

```bash
xcrun simctl io <udid-du-simulateur> screenshot 0X-nom.png
```

Le simulateur doit être un **iPhone 17 Pro Max**. Poser la position avant la capture 5 :

```bash
xcrun simctl location <udid-du-simulateur> set -13.4056,48.2622
```

⚠️ La saisie de texte du simulateur est mappée en AZERTY : `text` tape `qzerty` pour
`azerty`. Passer par le presse-papiers (`xcrun simctl pbcopy`), appui long, « Tout
sélectionner », « Coller ».

Pour régénérer `6.5-pouces/` après une nouvelle prise à la racine :

```bash
for f in 01-accueil 02-menu 03-options 04-panier 05-adresse-gps 06-suivi; do
  sips -z 2778 1284 "$f.png" --out "6.5-pouces/$f.png"
done
```
