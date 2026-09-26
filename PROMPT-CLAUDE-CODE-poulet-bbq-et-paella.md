# Chez Bidul & Truc : le demi-poulet BBQ à créer, et la paella à réparer

Dépôt `taxi-food-nosybe`, branche `main`. Projet Supabase `bmdveawomizjpiebgtkj`.
Restaurant : **Chez Bidul & Truc**, `700e8f32-e966-476a-b371-02884d08dea1`.

Lis `CLAUDE.md` avant de commencer. Tout ce qui suit a été **relu en base et dans le bucket le
2026-09-19** — ce ne sont pas des souvenirs, et l'état a déjà changé une fois en cours de
route, donc **revérifie avant d'agir**.

---

## 1. L'état réel, relu ce matin

Sept plats du jour existent, tous à 30 000 Ar, tous à la bonne forme
(`category_id` null, `in_menu = false`, `featured_label = 'Plat du jour'`, `is_archived = false`) :

| # | Plat | `is_featured` | `diet_tags` | photo dans le bucket |
|---|---|---|---|---|
| 1 | Poulet basquaise | false | `{}` | ✅ |
| 2 | Blanquette de poisson | false | `{}` | ✅ |
| 3 | Tartare de zébu | false | `{}` | ✅ |
| 4 | Pot-au-feu | false | `{}` | ✅ |
| 5 | Boudin noir façon hachis | false | `{}` | ✅ |
| 6 | **Paella** | **false** ⚠️ | **`{}`** ⚠️ | ✅ déposée le 18/09 à 09:00 |
| 7 | Tripes à la mode de Caen | **true** | `{}` | ✅ déposée le 18/09 à 09:00 |

Les deux photos du 18/09 répondent **200** sur l'URL d'objet **et** sur l'URL de rendu
(`render/image/.../?width=296&height=296&resize=cover`). Vérifié une par une, pas supposé.

---

## 2. Ce qu'il y a à faire — trois choses, dans cet ordre de gravité

### a. Le badge porc manque sur la paella — c'est le plus important

**Cette paella contient du chorizo, donc du porc.** Sa ligne porte `diet_tags = '{}'` : aucun
badge. À Nosy Be, une part non négligeable de la clientèle ne mange pas de porc, et un plat qui
en contient sans le dire est le genre d'erreur qui coûte un client pour de bon.

Le mécanisme existe déjà et n'est pas à construire : **`products.diet_tags` est un tableau, et
la valeur `'porc'` est déjà portée par 16 produits** du catalogue. Il suffit de la poser :

```sql
diet_tags = array['porc']
```

**Va d'abord regarder comment ces 16 produits affichent leur badge** dans l'appli et sur le
site, et **vérifie à l'écran** que la paella l'affiche comme eux. Une valeur en base qui ne
s'affiche nulle part ne protège personne — c'est ce point-là qu'il faut constater, pas le SQL.

### b. La paella est dormante alors qu'elle devrait être à l'affiche

Elle a été créée avec `is_featured = false`. Le porteur du projet a validé les trois plats
(paella, tripes, demi-poulet) comme plats du jour : la paella doit donc être **à l'affiche**.

Passe-la par **`set_product_featured(p_product_id, true)`**, jamais par un `update` direct :
cette fonction est `SECURITY DEFINER` et porte les contrôles.

⚠️ **Si c'était délibéré** — quelqu'un l'a peut-être mise de côté exprès — dis-le plutôt que de
la rallumer en silence. Mais l'hypothèse par défaut est que c'est un oubli.

### c. Créer le demi-poulet grillé BBQ

| | |
|---|---|
| Nom | **1/2 poulet grillé BBQ** |
| Prix | **30 000 Ar** (confirmé par le porteur du projet : « c'est toujours le même prix ») |
| `sort_order` | 8 |
| `diet_tags` | `{}` — pas de porc, pas d'alcool |
| Photo | `visuels-reseaux/photos/plat-demi-poulet-grille-bbq.png`, 1024 × 1024, 1 735 052 octets |
| Chemin cible | `produits/chez-bidul-truc/plat-demi-poulet-grille-bbq.png` |

Forme du plat du jour, identique aux sept autres :
`category_id = null`, `in_menu = false`, `is_featured = true`,
`featured_label = 'Plat du jour'`, `is_available = true`, `stock_quantity = null`,
`is_archived = false`.

**Écris la migration idempotente**, sur le modèle exact de
`supabase/migrations/20260915082305_chez_bidul_trois_plats_du_jour.sql` :
`insert … select … where not exists`, en comparant sur `lower(name)` et `not is_archived`.
Rejouer la migration ne doit jamais créer un doublon.

---

## 3. Le dépôt de la photo — la voie est déjà là, ne la contourne pas

**N'écris pas de nouvelle fonction Edge.** La fonction **`deposer-visuel`** existe, elle est
active, elle est durcie, et c'est elle qui a déposé les six autres photos :

```
POST https://bmdveawomizjpiebgtkj.functions.supabase.co/deposer-visuel
en-tête : x-depot-secret: $DEPOT_VISUEL_SECRET
corps   : {"bucket":"produits","chemin":"chez-bidul-truc/plat-demi-poulet-grille-bbq.png",
           "contenu_base64":"…","ecraser":false}
```

- **Le secret vit dans `.secrets.local`**, à la racine du dépôt, sous le nom
  `DEPOT_VISUEL_SECRET`. Il ne doit **jamais** apparaître dans un message, un log ou un commit.
  La base ne contient que son empreinte SHA-256 ; c'est ce qui fait que quelqu'un qui lirait
  toute la base ne pourrait pas déposer. Ne casse pas cette propriété.
- **`ecraser: false`** : le dépôt refuse d'écraser un fichier existant. Garde-le à false.
- Si la fonction répond `depot_desarme`, l'empreinte a été retirée du Vault
  (`vault.secrets`, nom `depot_visuel_empreinte`) — c'est l'interrupteur. Signale-le, ne
  contourne pas.

⚠️ **Un piège déjà payé sur ce dépôt** : passer le base64 en argument de ligne de commande
échoue avec `Argument list too long` (le fichier fait 1,7 Mo, donc ~2,3 Mo en base64). Écris le
JSON dans un fichier temporaire et poste-le avec `curl --data-binary @fichier`.

⚠️ **Il reste une fonction Edge jetable à supprimer** : `upload-plats-du-jour-bidul`, encore
ACTIVE. Sa version en ligne est neutralisée (410, aucune clé), mais la version 1 portait la
`service_role` et reste dans l'historique du projet. L'API MCP ne sait pas supprimer une
fonction Edge : **à supprimer depuis le tableau de bord Supabase**. Même chose pour
`upload-visuel-partenaire`, neutralisée elle aussi.

---

## 4. Les pièges, dans l'ordre de gravité

**1. Ne jamais archiver, ne jamais supprimer les anciens plats du jour.**
`getFeaturedLibrary()` dans `app/data/api.ts` filtre sur `in_menu = false` **et**
`is_archived = false`. Archiver un plat du jour, c'est lui faire quitter la bibliothèque du
restaurateur et détruire le retour à l'affiche en un tap. `is_featured = false` suffit, et
c'est déjà l'état des cinq premiers.

**2. Ne donne pas de `category_id` au nouveau plat.** Une catégorie le ferait apparaître dans
la carte permanente **et** lui imposerait la plage horaire de cette catégorie — un plat du jour
deviendrait indisponible le soir sans que personne comprenne pourquoi. Sans catégorie, il est
commandable dès que le restaurant est ouvert, midi et soir.

**3. Passe par les fonctions, pas par des `update` directs.** `set_product_featured` et
`save_featured_product` sont `SECURITY DEFINER` et portent les contrôles.

**4. L'état bouge sous tes pieds.** Entre deux relectures ce matin, la paella et les tripes
sont apparues en base et leurs photos dans le bucket. **Relis l'état avant d'écrire, et
relis-le après.** Si tu trouves autre chose que le tableau du §1, c'est le tableau qui est
périmé, pas la base.

**5. Les visuels sont des reconstitutions**, pas des photos prises dans sa cuisine — exception
assumée et déjà documentée dans `docs/PARTENAIRES.md` pour les cinq précédents et le « Poisson
fumé ». Rien de neuf, mais la ligne du document doit couvrir les trois nouveaux.

---

## 5. Ce qui reste à faire confirmer par le restaurateur

Ce ne sont pas des blocages, mais ils doivent être posés :

1. **La paella est-elle bien au chorizo de porc ?** Tout le visuel et le badge en dépendent.
2. **Le demi-poulet est-il servi seul ?** Le visuel ne montre aucune garniture — volontairement,
   pour ne pas promettre des frites ou du riz qu'il ne sert peut-être pas. S'il y a une
   garniture, elle doit entrer dans la description du produit.
3. **La paëllera.** Le visuel montre le plat dans sa poêle à paella, pas dans le bol noir ni sur
   l'ardoise de la maison. C'est une exception assumée — sans elle, personne ne reconnaît une
   paella — mais elle suppose qu'il la sert bien ainsi.

---

## 6. Avant de dire que c'est fini

Vérifie en base **et à l'écran**, jamais de mémoire :

1. `1/2 poulet grillé BBQ` existe, `is_featured = true`, `category_id` null,
   `in_menu = false`, `is_archived = false`, prix 30 000.
2. Sa `photo_url` répond **200 sur l'URL d'objet ET sur l'URL de rendu**
   (`?width=296&height=296&resize=cover&quality=75`) — c'est la seconde que l'appli demande
   réellement. Un `photo_url` mort affiche un trou dans le bandeau, c'est pire qu'une absence.
3. La paella porte `diet_tags = {porc}` **et le badge s'affiche** sur la fiche produit, comme
   sur les 16 autres produits qui portent déjà cette valeur. Constate-le à l'écran.
4. La paella est `is_featured = true`.
5. Le bandeau « Offre du jour » de la fiche Chez Bidul & Truc montre **exactement trois plats** :
   paella, tripes à la mode de Caen, 1/2 poulet grillé BBQ. Rien de nouveau n'est apparu dans
   Entrée ni dans Plat.
6. Les cinq anciens sont toujours là, `is_featured = false`, `is_archived = false`, photo
   intacte, et ils apparaissent bien dans « créations dormantes » sur l'écran Réglages du
   restaurateur. **Ouvre l'écran**, ne te contente pas du SQL.
7. `commandable_maintenant()` du restaurant est inchangé, et les trois plats sont commandables
   aux heures d'ouverture, midi **et** soir.
8. Aucune clé ne s'est glissée dans un fichier suivi par git.

Nomme la migration en français, comme le reste de `supabase/migrations/`, avec un commentaire
d'en-tête qui explique **pourquoi** elle existe — pas ce qu'elle fait, ça se lit dans le SQL.
