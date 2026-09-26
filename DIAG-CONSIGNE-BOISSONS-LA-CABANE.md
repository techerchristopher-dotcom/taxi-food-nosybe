# Diagnostic — mettre les boissons de La Cabane en ligne avec une consigne

Relevé le 24/09/2026 sur `bmdveawomizjpiebgtkj`, code du dépôt à `main` (54c40be).
Tout ce qui suit est lu en base ou dans le code, rien n'est supposé.

---

## 1. Pourquoi les boissons ne sont pas en ligne — ce n'est pas ce qu'on croit

Les 14 boissons sont **déjà** `listing_status = visible`, `in_menu = true`,
`is_available = true`. Le produit n'est pas le problème.

Ce qui les cache, ce sont **leurs deux catégories** :

| Catégorie | `sort_order` | `is_active` | `est_boisson` |
|---|---|---|---|
| Bières | 30 | **false** | true |
| Softs | 40 | **false** | true |
| Milkshakes | 50 | true | false |
| Crêpes | 60 | true | false |

`getMenu()` (`app/data/api.ts:345`) filtre `categories.is_active = true`, puis ne garde
que les produits dont la catégorie figure dans cette liste (`api.ts:370`). Et
`create_order` refuse un produit de catégorie inactive (« Produit indisponible ou
introuvable »). Les deux portes sont fermées, celle de l'écran et celle du serveur.

**Donc : une bascule de deux lignes met les 14 boissons en ligne.** Aucun déploiement,
aucune version d'app : l'appli iOS, Android et le web lisent la base en direct.

À noter au passage : les **8 milkshakes** sont, eux, en `listing_status = coming_soon`
et `is_available = false` — catégorie active, produits bloqués. Personne ne peut en
commander depuis leur création.

---

## 2. La consigne : le mécanisme existe déjà, et il est bon

Il ne faut **rien inventer**. Le « frais d'emballage » construit le 05/09 pour la boîte
à pizza est exactement une consigne qui ne dit pas son nom :

- `products.packaging_fee` (entier, ≥ 0) et `products.packaging_label` (texte) ;
- `orders.packaging_fee` (le total encaissé) ;
- `create_order` recalcule **côté serveur** : `v_packaging += packaging_fee × quantité`,
  puis `total = subtotal + packaging + livraison − remise`. Le client ne peut pas
  contourner la consigne en bricolant sa requête ;
- le panier et le paiement affichent une ligne par libellé, regroupée
  (`app/store/cart.ts:52`, `packagingLines()`) ;
- le reversement rend l'emballage au restaurant :
  `dû = subtotal + emballage − commission − offert` (`admin/lib/reversement.ts:120`).

Trente produits s'en servent déjà (13 pizzas Bidul + 17 Les Siciliens, libellé
« Boîte à pizza », 2 000 Ar). **Aucun produit de La Cabane n'a de `packaging_fee`** :
poser « Consigne » chez elle ne touche rien d'existant.

> ⚠️ « Consigne remplace emballage » ne peut pas vouloir dire *renommer partout*. Une
> boîte à pizza est un emballage qu'on ne rend pas ; une bouteille se rend. Les deux
> doivent cohabiter sous le même mécanisme, avec **leur** libellé chacun.

---

## 3. Les quatre défauts si on pose la consigne telle quelle

### A. Taxi Food prend une commission sur la consigne — c'est faux comptablement

`create_order` :
```
commission_amount = greatest(round((v_subtotal + v_packaging − v_remise_resto) × v_commission_rate), 0)
```
`record_settlement` applique la même base, et `admin/lib/reversement.ts:95` la retient
comme règle courante.

La Cabane est à **5 %**. Sur une consigne de 1 000 Ar :

| | Sans correction | Consigne hors commission |
|---|---|---|
| 2 THB PM (6 000) + consigne 2 × 1 000 | | |
| Commission | 5 % × 14 000 = **700** | 5 % × 12 000 = **600** |
| Reversé au restaurant | 13 300 | 13 400 |
| Consigne réellement récupérée | **950 / bouteille** | 1 000 / bouteille |

Le restaurant doit rendre 1 000 Ar par bouteille et n'en récupère que 950. **Il perd
50 Ar par bouteille**, et la perte grandit avec le taux. Une consigne n'est pas un
chiffre d'affaires : elle ne doit pas être commissionnée.

### B. Le mot « Emballage » est écrit en dur sur la commande

`orders` ne garde que le **montant**, pas le libellé. Résultat, le client lit :

- dans le panier et au paiement → « **Consigne** 2 000 » (lu sur `products.packaging_label`) ;
- une fois la commande passée → « **Emballage** 2 000 » (`app/app/order/[id].tsx:204`, chaîne littérale) ;
- côté restaurant → « **Emballage** » aussi (`app/components/RestaurantOrderCard.tsx:42`).

Deux mots différents pour la même ligne, entre l'écran d'avant et l'écran d'après
paiement. Et aucune clé i18n : la chaîne n'est même pas traduite en EN/IT.

### C. Le restaurant ne voit pas la consigne dans sa commande

`supabase/functions/notify-order/index.ts` ne contient **pas une seule occurrence** de
`packaging`. Le message Telegram qui part en cuisine liste les plats et la livraison,
jamais l'emballage. Le restaurant — celui qui doit rendre l'argent contre la bouteille —
n'apprend nulle part qu'une consigne a été encaissée, ni combien de bouteilles.

### D. Rien ne rend la consigne

Aucun modèle de retour de bouteille : ni champ, ni statut, ni écran. Le client paie
1 000 Ar, et le remboursement se fait **à la main**, hors appli. Si la commande a été
payée par carte, c'est un remboursement Stripe partiel, à la main lui aussi.

C'est une question d'exploitation avant d'être une question de code : **qui rend
l'argent, et contre quoi ?** Le livreur qui reprend la bouteille à la livraison
suivante ? Le restaurant au comptoir ? Tant que ce n'est pas tranché, la consigne est
un supplément de prix, pas une consigne.

---

## 4. Ce qui va bien et qu'il ne faut pas casser

- `est_boisson = true` sur Bières et Softs. Un code « repas offert » n'englobe donc pas
  les boissons, et **MERCISULLI** (`inclut_emballage = true`, `exclut_boissons = true`)
  ne mordra pas sur la consigne : `create_order` tient `v_packaging_hors_boissons` à part.
- **TAXIFOOD50** porte sur la livraison : aucun effet sur la consigne.
- La consigne se compte **par bouteille** (`× v_qty`), pas par commande.
- Le total est recalculé côté serveur : la consigne est inéludable.

---

## 5. Trois décisions à prendre avant d'écrire une ligne

1. **Commission sur la consigne : oui ou non ?**
   Recommandation : **non**. Elle demande un drapeau `products.packaging_est_consigne`
   pour distinguer une boîte à pizza (commissionnable, c'est une vraie vente
   d'emballage) d'une consigne (un dépôt qu'on rend).

2. **Quelles références sont en verre consigné ?** Proposition, à confirmer :

   | Produit | Prix | Consigne 1 000 ? |
   |---|---|---|
   | Fresh PM, THB PM, THB GM, Beaufort, Gold | 6 000 – 10 000 | **oui** (5) |
   | Tonic | 5 000 | **oui** |
   | Bonbon Anglais, Caprice Orange, Caprice Grenadine, World Cola | 5 000 | **oui ?** (verre STAR) |
   | Cristal | 5 000 | **?** |
   | Eau Vive PM, Eau Vive GM | 6 000 / 7 000 | non (PET) |
   | Sirop | 4 000 | hors ligne |

3. **Les 8 milkshakes** : on les ouvre en même temps ou ils restent « bientôt » ?

---

## 6. Ce qui reste à faire côté contenu

- **4 boissons sans photo** parmi celles qui passeraient en ligne : Fresh PM,
  Eau Vive PM, Eau Vive GM, Tonic. (Sirop non plus, mais il reste hors ligne.)
- **Aucune boisson n'a de description** — les 14 lignes sont à `description = null`.

---

## 7. Plan d'exécution — brief Claude Code

> À lancer **après** les trois décisions du § 5. Le projet est `bmdveawomizjpiebgtkj`.
> Chaque migration est **gardée** : elle compte les lignes touchées et lève une
> exception si le compte n'est pas celui annoncé. Aucune donnée de production n'est
> modifiée en dehors des lignes désignées ici.

### Étape 1 — schéma : distinguer une consigne d'un emballage

```sql
alter table public.products
  add column if not exists packaging_est_consigne boolean not null default false;

-- Le libellé et le montant doivent suivre la commande, pas seulement le produit :
-- si la consigne passe un jour de 1 000 à 1 500, les anciennes commandes doivent
-- rester lisibles telles qu'elles ont été payées.
alter table public.order_items
  add column if not exists packaging_fee_snapshot   integer not null default 0,
  add column if not exists packaging_label_snapshot text,
  add column if not exists packaging_est_consigne_snapshot boolean not null default false;
```

### Étape 2 — `create_order`

Trois changements, rien d'autre :

1. remplir les trois colonnes `*_snapshot` à l'insertion de chaque `order_items` ;
2. tenir un `v_packaging_commissionnable` qui **exclut** les produits
   `packaging_est_consigne` ; la commission devient
   `round((v_subtotal + v_packaging_commissionnable − v_remise_resto) × v_commission_rate)` ;
3. exclure de même la consigne de la base de remise (`v_base`) quand
   `inclut_emballage = true` : on ne solde pas un dépôt.

`total` ne bouge pas : `subtotal + v_packaging (entier) + livraison − remise`.
Le client paie la consigne en totalité, c'est le but.

### Étape 3 — `record_settlement` et l'admin

- `record_settlement` : même base de commission que `create_order`. La somme des
  `order_items.packaging_fee_snapshot` où `packaging_est_consigne_snapshot` est faux.
- `admin/lib/reversement.ts` : ajouter cette base à `commissionsAdmises()` **sans
  retirer les trois anciennes** — TF-161 et TF-162 portent encore la première règle, et
  les rejeter lèverait une alerte sur des commandes justes.

### Étape 4 — les écrans

- `app/app/order/[id].tsx:203-208` et `app/components/RestaurantOrderCard.tsx:41-46` :
  remplacer la chaîne littérale `Emballage` par les lignes regroupées reconstruites
  depuis les `order_items` (même regroupement par libellé que `packagingLines()`).
- Ajouter les clés i18n manquantes en FR/EN/IT — il n'y en a **aucune** aujourd'hui
  pour cette ligne.
- Vérifier `app/data/api.ts` (`ORDER_COLS`, `mapOrder`) pour remonter les nouveaux
  champs de ligne.

### Étape 5 — `notify-order`

Ajouter au message Telegram du restaurant une ligne par libellé d'emballage, avec le
**nombre de bouteilles** : « Consigne — 3 bouteilles × 1 000 = 3 000 Ar ». Sans elle, le
restaurant ne peut pas rendre l'argent.

### Étape 6 — les données La Cabane

```sql
-- a) les deux catégories s'allument (attendu : 2 lignes)
update public.categories c set is_active = true
  from public.restaurants r
 where r.id = c.restaurant_id and r.name = 'La Cabane'
   and c.name in ('Bières', 'Softs') and c.is_active = false;

-- b) le sirop reste hors ligne (attendu : 1 ligne)
update public.products p set in_menu = false, is_available = false
  from public.restaurants r
 where r.id = p.restaurant_id and r.name = 'La Cabane' and p.name = 'Sirop';

-- c) la consigne, sur la liste ARRÊTÉE au § 5.2 (attendu : le compte exact de cette liste)
update public.products p
   set packaging_fee = 1000,
       packaging_label = 'Consigne',
       packaging_est_consigne = true
  from public.restaurants r
 where r.id = p.restaurant_id and r.name = 'La Cabane'
   and p.name in ( /* … liste validée … */ );
```

### Étape 7 — contrôles, avant de dire que c'est fait

1. Une commande d'essai **en transaction annulée** (`begin; … rollback;`) : 2 THB PM +
   1 Tonic → `subtotal = 17 000`, `packaging_fee = 3 000`, `total = 30 000` avec 10 000
   de livraison, `commission_amount = 850` (5 % de 17 000, **pas** de 20 000).
2. `select count(*) from products where packaging_est_consigne and packaging_fee <> 1000`
   → 0.
3. Les 30 pizzas : `packaging_est_consigne = false`, `packaging_label = 'Boîte à pizza'`,
   commission inchangée. **Comparer une commande pizza avant/après migration** : le
   montant doit être identique à l'ariary près.
4. Ouvrir la fiche La Cabane dans l'app web : Bières et Softs visibles, Sirop absent,
   ligne « Consigne » au panier, au paiement **et** sur la commande une fois passée.

### Étape 8 — mise en ligne

- Les points 6 (données) sont **immédiats** : appli et web lisent la base en direct.
- Les points 2 à 5 (schéma, fonctions, écrans, Telegram) demandent :
  `cd app && npx expo export --platform web && netlify deploy --prod --dir=dist`
  (site `1e13c535-fd25-4027-9188-2b8c178c7f60`), puis un build EAS pour iOS/Android si
  on veut que les écrans corrigés arrivent sur les stores.
- Le dépôt a **66 fichiers non suivis** et un `.git/index.lock` orphelin à déplacer vers
  `.git/_orphelins/` avant tout commit.
