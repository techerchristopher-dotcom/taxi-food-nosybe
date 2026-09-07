# Labels alimentaires — porc

À Nosy Be une part importante de la clientèle ne mange pas de porc. La composition en
toutes lettres ne suffit pas : il faut un repère visible **sans ouvrir la fiche**. D'où le
badge « Contient du porc » sur la ligne produit.

## La règle, à ne jamais contourner

> **On ne tague que ce qui est confirmé. Jamais de déduction.**

Un label alimentaire est un **label de confiance** : se tromper une fois coûte le client
définitivement. Ne rien afficher vaut mieux qu'afficher une supposition.

⚠️ **Le piège concret, déjà rencontré** : les pizzas « Reine » et « Pepperoni » d'Angelo et
de Taxi Be sont au **jambon de volaille**. Les taguer porc par ressemblance de nom avec
celles de Chez Bidul & Truc aurait fait fuir exactement les clients que le label doit
servir. Toujours lire la composition, jamais le nom.

⚠️ **Le piège inverse, confirmé le 2026-09-06** : la « Terrine foie gras » de Chez Bidul &
Truc ne contient **pas** de porc, alors que la déduction courante (« une terrine de foie
gras contient souvent de la gorge de porc ») l'aurait taguée. La déduction se trompe dans
les deux sens.

## Procédure convenue avec le porteur du projet (2026-09-05)

1. Il fait le point **avec chaque restaurateur**.
2. Il me demande la liste ; je ressors les tableaux ci-dessous, **à jour**.
3. Il me répond **produit par produit** : porc / pas de porc.
4. J'applique via `set_product_diet_tags`, et je mets ce document à jour.

**Tant que ce point n'a pas eu lieu, la colonne B reste sans label.**

**Où en est-on** : la carte de **Chez Bidul & Truc est entièrement passée en revue**
(point des 2026-09-06 / 07) — plus aucune ligne en attente chez ce restaurant. Restent
ouverts : **Taxi Be** (Pepperoni au chorizo, Planche de charcuterie) et **La Cabane**
(supplément + Bacon).

---

## A. Tagués « porc » en base — vérifié le 2026-09-07

| Restaurant | Catégorie | Produit | Ce qui le prouve |
|---|---|---|---|
| Chez Bidul & Truc | Entrée | Terrine de campagne maison | **confirmé par le restaurateur le 2026-09-06** (aucune composition à la carte) |
| Chez Bidul & Truc | Pizza | Toscane | lardon |
| Chez Bidul & Truc | Pizza | Reine | jambon **de porc** |
| Chez Bidul & Truc | Pizza | Paysanne | jambon **de porc** |
| Chez Bidul & Truc | Pizza | Savoyarde | lardon |
| Chez Bidul & Truc | Plat | Omelette campagnarde | lardon |
| Chez Bidul & Truc | Plat | Cordon bleu | **confirmé par le restaurateur le 2026-09-06/07** — le « jambon » de la composition est bien du porc |
| Chez Bidul & Truc | Plat | Croque-monsieur | **confirmé par le restaurateur le 2026-09-06/07** |
| Chez Bidul & Truc | Plat | Croque-madame | **confirmé par le restaurateur le 2026-09-06/07** (croque-monsieur + œuf) |
| Chez Bidul & Truc | Hamburger | Le patron | bacon — **reconfirmé par le restaurateur le 2026-09-06** |
| La Cabane | Burgers | Burger Bleu Cheese | bacon |
| Les Siciliens | Pâtes | Carbonara | bacon |
| Les Siciliens | Pâtes | Amatriciana | bacon |
| Les Siciliens | Pizza | Carbonara | bacon frit |
| Les Siciliens | Burger | Big cheeseburger | bacon |

## B. À CONFIRMER — la carte ne permet pas de trancher

**Produits :**

| Restaurant | Catégorie | Produit | Pourquoi le doute | Porc ? |
|---|---|---|---|---|
| Taxi Be | Pizza | Pepperoni | garni de **chorizo** — porc en Europe, pas forcément à Madagascar | ☐ |
| Taxi Be | Tapas | Planche de Charcuterie | « assortiment de charcuterie », contenu inconnu | ☐ |

**Suppléments** (options ajoutables, pas des plats) :

| Restaurant | Supplément | Proposé sur | Porc ? |
|---|---|---|---|
| Taxi Be | + Chorizo | Pizza Pepperoni | ☐ |
| La Cabane | + Bacon | Burger Bleu Cheese | ☐ (bacon = porc a priori, à confirmer quand même) |

⚠️ **Limite technique connue, toujours d'actualité** : `diet_tags` existe sur `products`,
**pas sur `product_options`**. Un supplément au porc **ne peut donc pas porter le badge** :
un client peut ajouter « + Bacon » ou « + Chorizo » à un plat sans porc sans qu'aucun
repère visuel ne l'en avertisse. À ajouter (`product_options.diet_tags` + affichage dans la
puce d'option) si la réponse du restaurateur le rend nécessaire — c'est une petite
migration, mais elle n'a pas de sens tant qu'on ne sait pas quoi taguer.

### Point des 2026-09-06 / 07 avec Chez Bidul & Truc — carte entièrement revue

Six réponses obtenues, et elles ne vont PAS toutes dans le même sens — ce qui justifie
après coup d'avoir refusé de taguer par déduction :

- **Terrine de campagne maison → porc.** Confirmée. Elle n'avait aucune composition à
  la carte : elle serait restée sans label indéfiniment.
- **Terrine foie gras → PAS de porc.** La déduction « une terrine de foie gras contient
  souvent de la gorge de porc » aurait été **fausse ici**, et aurait écarté un plat à
  29 000 Ar d'une partie de la clientèle sans raison.
- **Foie gras poêlé → PAS de porc.**
- **Cordon bleu → porc.** Le « jambon » de la composition n'indiquait pas l'espèce.
- **Croque-monsieur et Croque-madame → porc.** Le croque-monsieur n'avait aucune
  composition à la carte ; la croque-madame en dérive.
- **Le patron → porc.** Reconfirmé (bacon déjà à la composition).

**Plus aucune ligne en attente chez Chez Bidul & Truc.**

## C. Confirmés SANS porc — ne jamais taguer

| Restaurant | Produit | D'où vient la certitude |
|---|---|---|
| Angelo | Reine, Pepperoni, Cucaracha, Impériale, Spécial Chef | composition explicite « jambon **de volaille** » |
| Taxi Be | Reine | composition explicite « jambon **de volaille** » |
| Angelo & Taxi Be | supplément « + Jambon de volaille » | libellé explicite |
| Chez Bidul & Truc | Terrine foie gras | **tranché par le restaurateur le 2026-09-06** |
| Chez Bidul & Truc | Foie gras poêlé | **tranché par le restaurateur le 2026-09-06/07** |

Pour Angelo et Taxi Be, c'est un **argument commercial**, pas seulement une absence de
risque.

---

## Comment appliquer une réponse

```sql
-- taguer
select public.set_product_diet_tags('<product_id>', array['porc']);
-- retirer le label
select public.set_product_diet_tags('<product_id>', '{}');
```

La RPC exige d'être personnel actif du restaurant concerné (`current_restaurant_id()`), donc
elle est aussi utilisable par le partenaire depuis son espace — c'est d'ailleurs lui qui
devrait la piloter à terme, puisque lui seul connaît sa recette.

La colonne est un **tableau de libellés** : elle accueillera « piquant », « végétarien »,
« sans gluten » sans nouvelle migration.
