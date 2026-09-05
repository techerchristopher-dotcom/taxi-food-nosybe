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

## Procédure convenue avec le porteur du projet (2026-09-05)

1. Il fait le point **avec chaque restaurateur**.
2. Il me demande la liste ; je ressors les tableaux ci-dessous, **à jour**.
3. Il me répond **produit par produit** : porc / pas de porc.
4. J'applique via `set_product_diet_tags`, et je mets ce document à jour.

**Tant que ce point n'a pas eu lieu, la colonne B reste sans label.**

---

## A. Déjà tagués « porc » — composition explicite

| Restaurant | Catégorie | Produit | Ce qui le prouve |
|---|---|---|---|
| Chez Bidul & Truc | Pizza | Toscane | lardon |
| Chez Bidul & Truc | Pizza | Reine | jambon **de porc** |
| Chez Bidul & Truc | Pizza | Paysanne | jambon **de porc** |
| Chez Bidul & Truc | Pizza | Savoyarde | lardon |
| Chez Bidul & Truc | Plat | Omelette campagnarde | lardon |
| Chez Bidul & Truc | Hamburger | Le patron | bacon |
| La Cabane | Burgers | Burger Bleu Cheese | bacon |

## B. À CONFIRMER — la carte ne permet pas de trancher

**Produits :**

| Restaurant | Catégorie | Produit | Pourquoi le doute | Porc ? |
|---|---|---|---|---|
| Chez Bidul & Truc | Entrée | Terrine de campagne maison | aucune composition ; une terrine de campagne est classiquement au porc, mais « classiquement » ne suffit pas | ☐ |
| Chez Bidul & Truc | Entrée | Terrine foie gras | foie gras = canard/oie, mais les terrines contiennent souvent de la gorge de porc | ☐ |
| Chez Bidul & Truc | Plat | Cordon bleu | « jambon » sans préciser l'espèce | ☐ |
| Taxi Be | Pizza | Pepperoni | garni de **chorizo** — porc en Europe, pas forcément à Madagascar | ☐ |
| Taxi Be | Tapas | Planche de Charcuterie | « assortiment de charcuterie », contenu inconnu | ☐ |

**Suppléments** (options ajoutables, pas des plats) :

| Restaurant | Supplément | Proposé sur | Porc ? |
|---|---|---|---|
| Taxi Be | + Chorizo | Pizza Pepperoni | ☐ |
| La Cabane | + Bacon | Burger Bleu Cheese | ☐ (bacon = porc a priori, à confirmer quand même) |

⚠️ **Limite technique connue** : `diet_tags` existe sur `products`, **pas sur
`product_options`**. Un supplément au porc ne peut donc pas encore porter le badge. À
ajouter (`product_options.diet_tags` + affichage dans la puce d'option) si la réponse du
restaurateur le rend nécessaire — c'est une petite migration, mais elle n'a pas de sens
tant qu'on ne sait pas quoi taguer.

## C. Confirmés SANS porc — ne jamais taguer

Composition explicite « jambon **de volaille** ». C'est un argument commercial, pas
seulement une absence de risque.

| Restaurant | Produit |
|---|---|
| Angelo | Reine, Pepperoni, Cucaracha, Impériale, Spécial Chef |
| Taxi Be | Reine |
| Angelo & Taxi Be | supplément « + Jambon de volaille » |

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
