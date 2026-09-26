# Chez Bidul & Truc : deux nouveaux plats du jour, les trois anciens en bibliothèque

Dépôt `taxi-food-nosybe`, branche `main`. Projet Supabase `bmdveawomizjpiebgtkj`.
Restaurant : **Chez Bidul & Truc**, `700e8f32-e966-476a-b371-02884d08dea1`.

Lis `CLAUDE.md` avant de commencer. Tout ce qui suit a été **relu en base et dans le code le
2026-09-16** — ce ne sont pas des souvenirs.

---

## 1. Ce qu'il y a à faire

Mettre à l'affiche **Pot-au-feu** et **Boudin noir façon hachis**, et laisser les trois plats
du jour actuels — Poulet basquaise, Blanquette de poisson, Tartare de zébu — **dormants dans la
bibliothèque du restaurateur**, prêts à revenir en un tap.

---

## 2. Comment marche un plat du jour ici — lis ça avant de toucher à quoi que ce soit

La mécanique existe déjà en entier. Un plat du jour est une ligne de `products` avec :

```
category_id    = null          -- hors carte permanente, donc aucune plage horaire
in_menu        = false         -- il vit dans la bibliothèque, pas dans la carte
is_featured    = true          -- il est À L'AFFICHE en ce moment
featured_label = 'Plat du jour'
is_archived    = false         -- ⚠️ voir le piège n°1 plus bas
```

Conséquences voulues, documentées dans
`supabase/migrations/20260915082305_chez_bidul_trois_plats_du_jour.sql` :

- il n'apparaît **que** dans le bandeau « Offre du jour » de la fiche restaurant
  (`getMenu` → `featured`), jamais dans Entrée ni dans Plat ;
- **aucune plage horaire ne s'applique** puisqu'il n'a pas de catégorie : commandable dès que
  le restaurant est ouvert, midi et soir ;
- le restaurateur le gère seul depuis Réglages → « À l'affiche ».

**La bibliothèque** est `getFeaturedLibrary()` dans `app/data/api.ts` : tout produit avec
`in_menu = false` et `is_archived = false`. L'écran `app/app/(restaurant)/reglages.tsx` en
extrait les « **créations dormantes** » — `bibliotheque.filter((p) => !p.isFeatured)` — et les
remet à l'affiche d'un seul tap.

**Retirer de l'affiche** se fait par `set_product_featured(p_product_id, false)`. La ligne
reste, avec sa photo, son prix, sa description et son libellé. Rien n'est perdu.

**Remettre à l'affiche** passe par `save_featured_product` avec le `p_product_id` existant, et
cette fonction est écrite exprès pour ça — son propre commentaire le dit : *« une photo vide ne
doit pas effacer celle déjà en place : c'est tout l'intérêt de la bibliothèque (on remet à
l'affiche sans re-uploader) »*.

---

## 3. L'état réel, relu en base

| Plat | prix | `is_featured` | `in_menu` | `category_id` | `is_archived` | photo | `sort_order` |
|---|---|---|---|---|---|---|---|
| Poulet basquaise | 30 000 | **false** | false | null | false | ✅ | 1 |
| Blanquette de poisson | 30 000 | **false** | false | null | false | ✅ | 2 |
| Tartare de zébu | 30 000 | **false** | false | null | false | ✅ | 3 |

**Les trois sont déjà dormants.** Ils ne s'affichent plus nulle part, mais ils sont bien dans
la bibliothèque, avec leur photo et leur libellé « Plat du jour ». Le retrait demandé est donc
**déjà fait** : ton travail sur eux consiste à **vérifier et ne rien casser**, pas à les
retirer une deuxième fois.

Si tu constates qu'un des trois est repassé `is_featured = true` entre-temps, remets-le à
`false` par `set_product_featured`, jamais par un `update` direct.

---

## 4. Les deux nouveaux plats

Mêmes valeurs que les trois précédents, à la suite dans l'ordre :

| Plat | prix | `sort_order` | fichier photo |
|---|---|---|---|
| Pot-au-feu | 30 000 Ar | 4 | `plat-pot-au-feu.png` |
| Boudin noir façon hachis | 30 000 Ar | 5 | `plat-boudin-noir-facon-hachis.png` |

`category_id = null`, `in_menu = false`, `is_featured = true`,
`featured_label = 'Plat du jour'`, `is_available = true`, `stock_quantity = null`.

⚠️ **Le prix de 30 000 Ar est repris des trois précédents, il n'est pas confirmé pour ces
deux-là.** Le pot-au-feu demande trois morceaux de viande et un os à moelle, le boudin en
hachis est plus économique : ils n'ont probablement pas le même coût matière. **Demande le prix
au porteur du projet avant de figer.** S'il ne répond pas, pose 30 000 et dis-le-lui.

**Écris la migration idempotente**, sur le modèle exact de
`20260915082305_chez_bidul_trois_plats_du_jour.sql` : `insert … select … where not exists`, en
comparant sur `lower(name)` et `not is_archived`. Rejouer la migration ne doit jamais créer un
doublon.

---

## 5. Les photos

Les deux visuels sont **déjà dans le dépôt**, 1024 × 1024, au format de la série Bidul :

```
visuels-reseaux/photos/plat-pot-au-feu.png
visuels-reseaux/photos/plat-boudin-noir-facon-hachis.png
```

À déposer dans le bucket `produits`, sous la convention en place :

```
produits/chez-bidul-truc/plat-pot-au-feu.png
produits/chez-bidul-truc/plat-boudin-noir-facon-hachis.png
```

Puis renseigner `photo_url` sur l'URL publique, exactement comme
`20260915083553_chez_bidul_plats_du_jour_photos.sql` l'a fait pour les trois précédents — cette
migration est ton modèle, y compris pour la clause de garde qui ne touche que les plats du jour
non archivés.

⚠️ **La clé `service_role` vit dans `.secrets.local` et ne doit jamais apparaître dans un
message ni dans un commit.**

⚠️ **Il reste une fonction Edge jetable à supprimer** : `upload-plats-du-jour-bidul`, encore
ACTIVE. Sa version en ligne est neutralisée — elle ne renvoie qu'un 410 et ne contient aucune
clé — mais la version 1, qui portait la `service_role`, reste dans l'historique du projet.
L'API MCP ne sait pas supprimer une fonction : **à supprimer depuis le tableau de bord
Supabase**. Si tu as besoin du même mécanisme pour ces deux photos, réutilise le motif, mais
neutralise ET fais supprimer, ne laisse pas une deuxième fonction traîner.

---

## 6. Les pièges, dans l'ordre de gravité

**1. `is_archived = true` sort le plat de la bibliothèque.** `getFeaturedLibrary()` filtre sur
`is_archived = false`. Archiver un plat du jour, c'est exactement perdre le retour en un tap
que le porteur du projet veut garder. **Ne jamais archiver, ne jamais supprimer les trois
anciens.** `is_featured = false` suffit et c'est déjà en place.

**2. Ne donne pas de `category_id` aux nouveaux.** Une catégorie les ferait apparaître dans la
carte permanente ET leur imposerait la plage horaire de cette catégorie — un plat du jour
deviendrait indisponible le soir sans que personne comprenne pourquoi.

**3. Passe par les fonctions, pas par des `update` directs.** `set_product_featured` et
`save_featured_product` sont `SECURITY DEFINER` et portent les contrôles. Un `update` direct
sur `products` contourne la logique et divergera au prochain changement.

**4. Vérifie l'ordre du bandeau.** Les trois précédents portent `sort_order` 1, 2, 3 et je
donne 4 et 5 par cohérence, mais **je n'ai pas vérifié que `getMenu` trie le bandéau
« featured » sur `sort_order`** — regarde `app/data/api.ts` autour de
`featuredRows = allRows.filter((p) => p.is_featured)` et confirme. Si le tri se fait autrement,
dis-le plutôt que de poser des valeurs qui ne servent à rien.

**5. Les visuels sont des reconstitutions**, pas des photos prises dans sa cuisine — même
exception assumée que pour les trois précédents et le « Poisson fumé » (`docs/PARTENAIRES.md`).
Deux points restent non confirmés par le restaurateur : le **contenant du boudin en hachis**
(servi sur ardoise dans le visuel, alors qu'un hachis se sert souvent en plat à gratin
individuel) et la **structure exacte des couches**, qui n'a pas de canon — plusieurs versions
coexistent dans les sources. À valider avant l'ouverture réelle des commandes.

---

## 7. Avant de dire que c'est fini

Vérifie en base et à l'écran, pas de mémoire :

1. `Pot-au-feu` et `Boudin noir façon hachis` existent, `is_featured = true`,
   `category_id` null, `in_menu = false`, `is_archived = false`.
2. Leurs deux `photo_url` **répondent en 200**. Un `photo_url` mort affiche un trou dans le
   bandeau, c'est pire qu'une absence de photo.
3. Les trois anciens sont toujours là, `is_featured = false`, `is_archived = false`, **photo
   intacte** — et ils apparaissent bien dans « créations dormantes » sur l'écran Réglages du
   restaurateur. Ouvre l'écran pour le constater, ne te contente pas du SQL.
4. Le bandeau « Offre du jour » de la fiche Chez Bidul & Truc montre **exactement deux plats**,
   et rien de nouveau n'est apparu dans Entrée ni dans Plat.
5. `commandable_maintenant()` du restaurant est inchangé, et les deux nouveaux plats sont
   commandables aux heures d'ouverture, midi **et** soir.
6. Aucune clé ne s'est glissée dans un fichier suivi par git.

Nomme les migrations en français, comme le reste de `supabase/migrations/`, avec un commentaire
d'en-tête qui explique **pourquoi** elles existent — pas ce qu'elles font, ça se lit dans le
SQL.
