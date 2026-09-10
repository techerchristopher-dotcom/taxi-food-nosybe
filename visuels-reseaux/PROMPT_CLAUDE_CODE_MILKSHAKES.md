# Brancher les milkshakes de La Cabane — prompt pour Claude Code

## Le contexte, en cinq lignes

Huit packshots de milkshakes viennent d'être produits : gobelet officiel La Cabane, sticker
rond, dôme, paille orange, et pour chaque parfum sa couleur et son ingrédient au pied. Ils
remplacent les visuels ChatGPT du 13 août, que le patron ne veut plus voir.

Les huit produits **existent déjà en base**, au bon nom, dans la bonne catégorie, avec le bon
prix. Il n'y a **rien à créer et rien à renommer** : juste des fichiers à écraser, un état à
poser, et un trou à boucher dans l'appli.

Je n'ai pas pu téléverser moi-même : l'écriture du bucket exige `is_admin()`, et je ne manipule
pas d'identifiants. C'est le seul morceau qui te revient côté stockage.

## Où sont les fichiers

```
~/Desktop/1-DEV CLAUDE /taxi-food-nosybe/partenaire /la cabane/milkshakes/
```

Attention aux **espaces finals dans les noms de dossiers** — `1-DEV CLAUDE `, `partenaire `.
Utilise des guillemets.

Huit PNG, 2048 × 2048, fond blanc, 3 à 4,7 Mo chacun :

```
milkshake-chocolat.png       milkshake-oreo.png        milkshake-twix.png
milkshake-fraise.png         milkshake-snickers.png    milkshake-vanille.png
milkshake-kinderbueno.png    milkshake-speculoos.png
```

Ignore `_gabarit-gobelet.png`, `_planche-des-8.jpg` et le dossier `pub/` : ce sont les pièces
de travail et le visuel réseaux, ils n'ont rien à faire dans le bucket produits.

---

## Étape 1 — téléverser (et rien d'autre)

Projet Supabase `bmdveawomizjpiebgtkj`, bucket **`produits`**, dossier **`la-cabane/`**,
**sans renommer**, en écrasement (`upsert`).

**Il n'y a aucun SQL à passer pour les images.** Les huit `photo_url` pointent déjà exactement
sur ces noms de fichiers :

```
https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/la-cabane/milkshake-<parfum>.png
```

Écraser le fichier suffit. C'est le cas favorable, ne le complique pas.

Les sources font 3 à 4,7 Mo. **Réduis-les à 1024 × 1024 avant d'envoyer** — les fichiers
actuels font ~1,2 Mo et sont servis en webp par le CDN ; garde le PNG et le fond blanc. Clé
`service_role`, elle est dans `.secrets.local` à la racine du dépôt : ne la fais jamais
apparaître dans un message ni dans un commit.

**Vérifie après coup** que les huit URL répondent en 200 et que la taille servie a bien changé
(sinon tu as écrasé dans le vide ou le CDN sert encore l'ancien cache).

---

## Étape 2 — « Bientôt disponible », visible mais non commandable

### Ce que fait la base aujourd'hui

```sql
select name, is_available, in_menu, is_archived from products p
join restaurants r on r.id = p.restaurant_id
join categories c on c.id = p.category_id
where r.name = 'La Cabane' and c.name = 'Milkshakes' order by p.sort_order;
```

Résultat au 10/09 : **`is_available` vaut `false` pour Vanille et Spéculoos, `true` pour les
six autres.** L'état est incohérent, personne ne l'a posé exprès.

### Ce que fait l'appli aujourd'hui

`is_available = false` donne déjà **exactement le comportement voulu** — et c'est important, ça
veut dire qu'il n'y a presque rien à écrire :

- `ProductRow.tsx` : ligne grisée, vignette atténuée, prix en gris, **pas de bouton d'ajout**,
  `onPress` non câblé — le produit est visible et non commandable.
- `restaurant/[id].tsx:178` : même chose dans le carrousel « à l'affiche ».

**Le seul défaut, c'est le mot.** Le badge affiche `restaurantCard.unavailable`, soit
**« Bientôt de retour »** — ce qui raconte un plat en rupture, un plat qui *revient*. Les
milkshakes n'ont jamais été là. Il faut **« Bientôt disponible »**.

### La clé existe déjà, ne la recrée pas

`restaurantCard.comingSoon` est déjà traduite dans les trois langues :

| fichier | valeur |
|---|---|
| `app/locales/fr.json` | Bientôt disponible |
| `app/locales/en.json` | Coming soon |
| `app/locales/it.json` | Presto disponibile |

Elle ne sert aujourd'hui qu'au **restaurant** (`OpenBadge`, via `listing_status`). On la
descend au **produit**.

### La forme à suivre : refaire au produit ce qui existe au restaurant

`restaurants.listing_status text default 'visible'` avec `visible | coming_soon | hidden` est
déjà le vocabulaire de la maison. Mets le même sur `products`, et **ne touche pas à la
mécanique de commande** : elle reste portée par `is_available`. Le nouveau champ ne change
qu'un libellé.

```sql
-- supabase/migrations/<horodatage>_les_milkshakes_de_la_cabane_s_annoncent.sql
alter table products
  add column if not exists listing_status text not null default 'visible'
  check (listing_status in ('visible', 'coming_soon'));

comment on column products.listing_status is
  'visible = plat normal. coming_soon = annonce : le plat se voit mais ne se commande pas, '
  'et le badge dit « Bientôt disponible » au lieu de « Bientôt de retour ». '
  'La commande reste coupee par is_available — ce champ ne porte que le mot.';

with r as (select id from restaurants where name = 'La Cabane'),
     c as (select id from categories where restaurant_id = (select id from r) and name = 'Milkshakes')
update products
   set is_available = false,
       listing_status = 'coming_soon'
 where restaurant_id = (select id from r)
   and category_id  = (select id from c);
```

Attendu : **8 lignes modifiées.** Un autre nombre = un nom a bougé, arrête-toi et signale-le.

### Les cinq endroits à toucher dans l'appli

1. `app/data/api.ts` — ajoute `listing_status` à la liste de colonnes du select produits
   (la constante des colonnes, vers la ligne 105) **et** au mapper produit (vers la ligne 197) :
   `listingStatus: (p.listing_status as Product['listingStatus']) ?? 'visible'`.
   ⚠️ Oublier la liste de colonnes est l'erreur silencieuse type : le mapper lira `undefined`
   et tout retombera sur `'visible'` sans lever la moindre erreur.
2. `app/data/types.ts` — sur `Product`, `listingStatus?: 'visible' | 'coming_soon'`, commenté.
3. `app/components/ProductRow.tsx` — le badge :
   `t(product.listingStatus === 'coming_soon' ? 'restaurantCard.comingSoon' : 'restaurantCard.unavailable')`.
4. `app/app/restaurant/[id].tsx` (~ligne 196) — la même chose dans le carrousel.
5. `app/app/product/[id].tsx` — **le trou**, voir juste en dessous.

### Le trou à boucher, et il compte

```
app/app/product/[id].tsx:97   const commandable = restaurant?.isOpen ?? false;
```

`commandable` ne regarde **que si le restaurant est ouvert**. Il ignore complètement
`product.isAvailable`. La fiche produit n'est pas atteignable depuis la carte quand le produit
est indisponible — mais **elle l'est par un lien de partage**, et l'appli en fabrique
(`PartageSheet`, `lienProduit`). Aujourd'hui, un lien vers un milkshake permet donc de
**l'ajouter au panier**.

Tant que ce n'est pas corrigé, « non commandable » est faux dès que quelqu'un partage le lien.

```ts
const commandable = (restaurant?.isOpen ?? false) && product.isAvailable;
```

et le libellé du bouton doit dire pourquoi : produit en `coming_soon` → « Bientôt disponible »,
produit simplement indisponible → « Bientôt de retour », restaurant fermé → le message existant.
Ajoute les clés `product.*` manquantes dans les **trois** locales.

**Vérifie-le pour de vrai** : ouvre `/product/<id d'un milkshake>` et regarde que le bouton est
mort. C'est le seul contrôle qui prouve quelque chose.

---

## Étape 3 — que le restaurateur puisse le rendre disponible tout seul

Le jour du lancement, personne ne doit avoir besoin de nous. Dans
`admin/components/MenuManager.tsx`, à côté de l'interrupteur de disponibilité existant, ajoute
le choix `visible / coming_soon`. Passer un plat en `visible` doit aussi remettre
`is_available = true` — sinon le patron bascule le libellé et se demande pourquoi son milkshake
reste gris.

Si l'écran Réglages du partenaire (`app/app/(restaurant)/reglages.tsx`, la section ruptures)
est le vrai endroit où il travaille, mets-le plutôt là. Regarde lequel des deux il utilise
avant de choisir.

---

## Ce que tu ne touches pas

- **Les prix.** 15 000 Ar pour Fraise, Vanille, Chocolat ; 20 000 Ar pour les cinq autres.
- **`in_menu`** reste à `true` : c'est ce qui les garde dans la carte.
- **`is_archived`** reste à `false`.
- **`is_featured`** reste à `false` : huit milkshakes dans le carrousel « à l'affiche »
  noieraient les vrais plats du jour. L'annonce se fait sur les réseaux, pas en écrasant la
  carte.
- **Aucun autre restaurant.** La migration est cadrée par nom de restaurant *et* de catégorie.
- **Ne supprime aucun fichier du bucket.**

## Ce que tu me renvoies

1. Le nombre de fichiers téléversés et les huit codes HTTP.
2. Le nombre de lignes modifiées par la migration (attendu : 8).
3. Le résultat de :
   ```sql
   select p.name, p.price, p.is_available, p.listing_status,
          regexp_replace(p.photo_url, '^.*/', '') as image
   from products p
   join restaurants r on r.id = p.restaurant_id
   join categories  c on c.id = p.category_id
   where r.name = 'La Cabane' and c.name = 'Milkshakes'
   order by p.sort_order;
   ```
4. **Une capture de la carte La Cabane** montrant les huit lignes grisées avec
   « Bientôt disponible », et **une capture d'une fiche produit atteinte par son lien direct**
   montrant le bouton d'ajout mort. Sans ces deux-là, on ne sait pas si ça marche — on croit.
