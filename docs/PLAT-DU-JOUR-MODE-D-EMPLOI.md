# Le plat du jour — comment ça marche vraiment

Relevé en base le 2026-10-05, parce que ce n'était écrit nulle part et qu'il a fallu le
reconstituer en lisant les données. À lire avant de toucher à un plat du jour.

## Ce n'est pas une catégorie, c'est un VIVIER plus un interrupteur

Un plat du jour est un `products` qui porte :

| Colonne | Valeur | Pourquoi |
|---|---|---|
| `category_id` | **NULL** | il n'appartient à aucune catégorie de la carte |
| `in_menu` | **false** | il ne s'affiche pas dans la carte permanente |
| `listing_status` | `visible` | |
| `featured_label` | `Plat du jour` | posé **une fois pour toutes** sur tout le vivier |
| `is_featured` | **l'interrupteur du jour** | `true` = à l'affiche aujourd'hui |
| `sort_order` | 1, 2, 3… | l'ordre dans le vivier, stable |
| `photo_url` | `produits/<slug-resto>/plat-<slug-plat>.png` | |

⚠️ **`featured_label` n'allume rien.** Tout le vivier le porte, y compris les plats éteints.
C'est `is_featured` seul que lit `plats_du_jour_publics()`, avec `is_available`,
`not is_archived` et `coalesce(stock_quantity, 1) <> 0`.

**Changer le plat du jour = éteindre tout le vivier du restaurant, puis rallumer ceux du jour.**
On ne crée pas un produit par jour : on rallume un plat déjà dans le vivier. On n'en crée un
que si le restaurateur annonce un plat qui n'y est pas encore.

```sql
-- 1. éteindre
update products set is_featured = false
where restaurant_id = '<resto>' and category_id is null and is_featured;
-- 2. rallumer ceux du jour
update products set is_featured = true, is_available = true
where id in ('<plat1>', '<plat2>');
```

## L'état des viviers au 2026-10-05

| Restaurant | Plats au vivier | Allumés |
|---|---|---|
| Chez Bidule & Truc | 14 | 2 (couscous royal, médaillon de zébu) |
| La Plage | 11 | 8 |

⚠️ **Chez Bidule & Truc avait 12 plats au vivier et AUCUN allumé** avant ce matin : leur plat
du jour n'apparaissait nulle part depuis on ne sait quand, alors que Marco en envoie un par
Telegram chaque matin. À surveiller : un vivier à zéro allumé est un restaurant invisible sur
la page `/jour`.

## Les visuels

Série Chez Bidule & Truc, à reproduire pour tout nouveau plat : **1024 × 1024**, fond de pierre
brun sombre avec une lueur ambrée en haut à gauche et les coins qui tombent au noir, vaisselle
**noire mate** (bol creux ou ardoise), prise de vue en trois quarts surélevé, filet de vapeur,
brin de thym et gros sel (parfois des grains de poivre) posés sur la pierre en bas de cadre,
lumière chaude venant du haut-gauche, faible profondeur de champ. Aucun texte, aucun logo.

Modèle : `gpt_image_2`, `resolution: 1k`, `quality: high`, `aspect_ratio: 1:1`.

Le fichier se nomme `plat-<slug>.png` et va dans le bucket `produits/<slug-resto>/`.
Les sources restent dans `visuels-reseaux/plats-du-jour/<slug-resto>/`.
