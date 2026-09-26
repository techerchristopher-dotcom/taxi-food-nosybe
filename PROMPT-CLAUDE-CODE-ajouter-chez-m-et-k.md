# Ajouter Chez M&K au catalogue Taxi Food

Projet Supabase `bmdveawomizjpiebgtkj`. Nouveau partenaire, restaurant chinois à Nosy Be.

---

## 0. La source, et ce qu'il ne faut pas inventer

Tout vient de `partenaire /M&K/` (attention à l'espace final dans `partenaire `) :

- **`CARTE-CHEZ-M-ET-K.md`** — la carte relevée le 21/09/2026 sur la conversation
  WhatsApp du restaurateur (Mad Mk Kenny, 0371 986 196). Les prix sont les siens,
  tels qu'il les a écrits.
- **`photos/`** — 29 visuels renommés au nom de leur plat, numérotés dans l'ordre
  de la carte. Ce sont ses vraies photos, pas des images générées.

**Ne rien inventer.** En particulier :

- **Aucun plat n'a d'ingrédients connus.** Laisser `description` à NULL. Ne pas
  déduire une composition depuis le nom : « ti pan » ou « tsa siou » ont des
  recettes qui varient d'une maison à l'autre, et une fiche produit fausse se
  paie en commande annulée.
- **L'adresse est « Djabala Honko »**, un quartier, pas un point précis.
- **Aucune boisson** n'a été communiquée.
- **Pas de logo détouré.** `00-enseigne-chez-m-et-k.jpg` est un visuel de
  communication doré, pas un logo sur fond transparent.

À cause de ces trous, le restaurant entre en **`listing_status = 'coming_soon'`**
et `auto_open = false`. Il ne passe `visible` que quand l'exploitant a tranché.

---

## 1. La fiche restaurant

| Champ | Valeur |
|---|---|
| `name` | `Chez M&K` |
| `cuisine_type` | `Restaurant chinois` |
| `zone_served` | `Djabala Honko` |
| `phone` | `+261371986196` |
| `delivery_fee` | `10000` |
| `min_order` | `0` |
| `commission_rate` | `0.0500` |
| `listing_status` | `coming_soon` |
| `auto_open` | `false` |
| `is_open` | `false` |
| `sort_order` | `80` *(libre : La Plage 60, Angelo 70, Taxi Be 90)* |
| `food_types` | `{Chinois, Nouilles, Riz, Grillades}` |
| `logo_url` | NULL — à remplir quand il fournira un vrai logo |
| `cover_url` | NULL |

Aligner `delivery_fee` et `commission_rate` sur La Cabane, Bidul et Les Siciliens :
10 000 Ar et 5 %.

## 2. Les horaires

**9h00 – 22h00, sept jours sur sept, en service continu.** Donc UNE seule ligne
par jour dans `restaurant_hours`, pas deux.

Rappel du piège déjà payé sur Bidul : `extract(dow)` en PostgreSQL donne
**0 = dimanche, 1 = lundi**. Insérer les weekday 0 à 6, `service = 1`,
`opens_at = '09:00'`, `closes_at = '22:00'`, `is_closed = false`.

Vérifier après coup que `ouvert_maintenant()` répond correctement — mais comme
`auto_open = false`, c'est `is_open` qui commande tant que le restaurant n'est
pas validé.

## 3. Les catégories

Proposition, à valider par l'exploitant. Sept catégories, aucune au-delà de huit
lignes. `est_boisson = false` partout : il n'y a aucune boisson pour l'instant.

| sort_order | Nom | icône | Plats |
|---|---|---|---|
| 10 | Entrées & à partager | 🥟 | 8 |
| 20 | Soupes | 🍜 | 2 |
| 30 | Ti pan — à la plancha | 🔥 | 4 |
| 40 | Wok & sautés | 🥘 | 2 |
| 50 | Viandes | 🥩 | 6 |
| 60 | Riz, nouilles & bols | 🍚 | 5 |
| 70 | Sur commande | 🍲 | 1 |

## 4. Les 28 plats

`description` reste NULL partout. `photo_url` pointe vers
`produits/chez-m-et-k/<fichier>.jpg` une fois les visuels déposés (§6).

### Entrées & à partager

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Van tan frit | 15 000 | `{}` | 18-van-tan-frit |
| 20 | Assiette de nem cocktail | 15 000 | `{}` | 27-assiette-de-nem-cocktail |
| 30 | Nem porc ou poulet ou zébu | 20 000 | *voir §5* | 04-nem-porc-poulet-ou-zebu |
| 40 | Bouchon porc ou poulet ou bœuf | 20 000 | *voir §5* | 21-bouchon-porc-poulet-ou-boeuf |
| 50 | Croustillant de crevette | 20 000 | `{}` | 11-croustillant-de-crevette |
| 60 | Rouleaux de grosses crevettes | 25 000 | `{}` | 17-rouleaux-de-grosses-crevettes |
| 70 | Rouleaux de printemps aux crevettes | 30 000 | `{}` | 16-rouleaux-de-printemps-aux-crevettes |
| 80 | Assiette de friture | 40 000 | `{}` | 24-assiette-de-friture-b |

*L'assiette de friture a deux photos, `23-assiette-de-friture-a` et `-b`. Prendre
la `-b` : c'est celle que la légende accompagnait. Garder l'autre en réserve.*

### Soupes

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Soupe garnie | 25 000 | `{}` | 14-soupe-garnie |
| 20 | Soupe spéciale MK | 30 000 | `{}` | 13-soupe-speciale-mk |

### Ti pan — à la plancha

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Ti pan poulet | 30 000 | `{}` | 15-ti-pan-poulet |
| 20 | Ti pan de steak de zébu | 30 000 | `{}` | 28-ti-pan-de-steak-de-zebu |
| 30 | Ti pan porc | 35 000 | `{porc}` | 07-ti-pan-porc |
| 40 | Ti pan mixte | 40 000 | ⚠️ *voir §7* | 26-ti-pan-mixte |

### Wok & sautés

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Crevettes sautées aux pousses de maïs | 35 000 | `{}` | 10-crevettes-sautees-pousses-de-mais |
| 20 | Sauté de porc aux légumes | 35 000 | `{porc}` | 20-saute-de-porc-aux-legumes |

### Viandes

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Assiette de tsa siou | 20 000 | `{porc}` | 25-assiette-de-tsa-siou |
| 20 | Côte d'échine de porc | 45 000 | `{porc}` | 01-cote-d-echine-de-porc |
| 30 | Poitrine de porc | 50 000 | `{porc}` | 02-poitrine-de-porc |
| 40 | Beignet de porc sauce aigre-douce | 50 000 | `{porc}` | 03-beignet-de-porc-sauce-aigre-douce |
| 50 | Ribs laqué | 50 000 | `{porc}` | 12-ribs-laque |
| 60 | Magret de canard sauce poivre vert | 70 000 | `{}` | 06-magret-de-canard-sauce-poivre-vert |

### Riz, nouilles & bols

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Riz cantonais | 25 000 | *voir §5* | 08-riz-cantonais |
| 20 | Mi sao | 25 000 | *voir §5* | 09-mi-sao |
| 30 | Bol renversé bœuf, poulet ou porc | 30 000 | *voir §5* | 22-bol-renverse-boeuf-poulet-ou-porc |
| 40 | Bol renversé fruits de mer | 40 000 | `{}` | ⚠️ **AUCUNE PHOTO** |
| 50 | Pâtes fraîches épicées aux crevettes | 40 000 | `{}` | 05-pates-fraiches-epicees-aux-crevettes |

### Sur commande

| sort | Plat | Prix | `diet_tags` | Fichier |
|---|---|---|---|---|
| 10 | Fondue chinoise terre et mer | 100 000 **par personne** | `{}` | 19-fondue-chinoise-terre-et-mer |

**Le plat le plus cher du catalogue Taxi Food**, devant la langouste de Bidul à
60 000. Il est « sur commande » : ni le délai ni le minimum de couverts ne sont
connus. Le créer avec `is_available = false` tant que ce n'est pas tranché,
plutôt que de laisser passer une commande qu'il ne pourra pas honorer.

## 5. Les plats à options — ne PAS les dupliquer

Cinq plats se déclinent. Chacun reste **un seul produit** avec un
`product_option_groups` ; surtout pas trois produits séparés.

**Trois plats au choix de viande** — `min_select = 1, max_select = 1,
required = true, sort_order = 10` :

| Plat | Groupe | Options (`price_delta = 0`) |
|---|---|---|
| Nem porc ou poulet ou zébu | `Viande au choix` | Porc · Poulet · Zébu |
| Bouchon porc ou poulet ou bœuf | `Viande au choix` | Porc · Poulet · Bœuf |
| Bol renversé bœuf, poulet ou porc | `Viande au choix` | Bœuf · Poulet · Porc |

⚠️ **Le tag `porc` ne doit PAS être posé sur ces trois produits.** Le porc n'est
qu'une option parmi trois ; taguer le produit entier ferait disparaître le plat
pour un client qui filtre le porc, alors que deux versions sur trois lui
conviennent. Si l'application ne sait pas tagger une option, le signaler plutôt
que de contourner — c'est une limite produit à remonter, pas à masquer.

**Deux plats à deux formats** — `min_select = 1, max_select = 1, required = true` :

| Plat | Groupe | Options |
|---|---|---|
| Riz cantonais | `Format` | Simple (+0) · Spécial (+5 000) |
| Mi sao | `Format` | Simple (+0) · Spécial (+5 000) |

Le prix de base est celui du simple, 25 000 ; le spécial est à 30 000, d'où
l'écart de 5 000.

## 6. Déposer les 29 visuels

Bucket `produits`, dossier `chez-m-et-k/`, via la fonction Edge
**`deposer-visuel`** — c'est la seule route autorisée depuis la faille d'août 2026.

Le secret vit dans **`.secrets.local` à la racine du dépôt**, sur le poste de
l'exploitant. **Il ne doit apparaître ni dans un message, ni dans un commit, ni
dans un fichier versionné.** Le lire dans le script, jamais l'afficher.

```bash
SECRET=$(grep -E '^DEPOT_VISUEL_SECRET=' .secrets.local | cut -d= -f2- | tr -d '"'"'"'\r')
URL="https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/deposer-visuel"
for f in "partenaire /M&K/photos/"*.jpg; do
  n=$(basename "$f")
  python3 -c "
import base64,json,sys
json.dump({'bucket':'produits','chemin':'chez-m-et-k/'+sys.argv[2],
           'contenu_base64':base64.b64encode(open(sys.argv[1],'rb').read()).decode(),
           'ecraser':False}, open('/tmp/c.json','w'))" "$f" "$n"
  curl -sS -X POST "$URL" -H "x-depot-secret: $SECRET" \
       -H "Content-Type: application/json" --data-binary @/tmp/c.json
done
```

Le base64 passe par un **fichier**, jamais en argument de shell : à 1,4 Mo on
tombe sur `Argument list too long`. Piège déjà payé.

Vérifier ensuite que les 29 URL publiques répondent 200 avant d'écrire les
`photo_url` en base.

## 7. Les six points à faire trancher par l'exploitant

Les créer comme commentaires dans la migration, et les lui remonter :

1. **« Bol renversé fruits de mer » n'a aucune photo.** Le restaurateur a envoyé
   la légende seule. Il en faut une, ou le plat sort de la carte.
2. **Les ingrédients des 28 plats.** Aucun n'est décrit.
3. **Le ti pan mixte contient-il du porc ?** « Mixte » n'est pas défini. Tant que
   ce n'est pas répondu, ne pas poser le tag — mais ne pas l'oublier non plus :
   un client qui évite le porc doit pouvoir se fier au badge.
4. **La fondue** : délai de commande et minimum de couverts.
5. **Les boissons** : aucune communiquée.
6. **L'adresse exacte** et **un logo détouré**.

## 8. Contrôles avant de rendre la main

- `select count(*)` sur les produits de M&K → **28**.
- Chaque produit a une `photo_url` qui répond 200, **sauf** le bol renversé
  fruits de mer.
- Les cinq plats à options ont bien **un** produit et **un** groupe chacun,
  pas trois produits.
- Aucun `description` renseigné (c'est voulu).
- `restaurant_hours` : **7 lignes**, une par jour, aucune `is_closed`.
- `listing_status = 'coming_soon'` et `auto_open = false`.
- Le secret de dépôt n'apparaît nulle part dans le diff : `git diff | grep -i depot_visuel`
  ne doit rien renvoyer d'autre que le nom de la variable.

Migration nommée dans le style du dépôt, en français, avec un en-tête qui
explique **pourquoi** chaque décision a été prise — pas seulement ce qu'elle fait.
