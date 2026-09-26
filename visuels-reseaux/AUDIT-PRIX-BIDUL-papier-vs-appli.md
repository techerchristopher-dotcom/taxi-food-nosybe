# Chez Bidul & Truc — la carte papier contre l'appli

Relevé sur les 3 photos du 24/09/2026, confronté à la base le même jour, ligne à ligne.

## Réponse courte

**Oui, l'appli est plus chère. De 1 000 Ar par plat, exactement, sur les 48 lignes
comparables. Et c'est voulu : c'est la hausse que tu as demandée le 20/09.**

| | Lignes comparées | Écart |
|---|---|---|
| Nourriture | **48 sur 48** | **+1 000 Ar, sans une seule exception** |
| Boissons | **19 sur 19** | **0 Ar** |

Migration `chez_bidul_hausse_de_1000_ariary_sur_la_nourriture`, appliquée le 21/09 à
10 h 57. Elle ne touchait que les catégories non-boisson, avec un garde-fou qui refusait
de tourner si le nombre de lignes visées n'était pas celui attendu. Les boissons n'ont
pas bougé d'un ariary, et la mesure le confirme.

---

## Ce que les deux dernières commandes prouvent

### TF-269 — 23/09, livrée, espèces

| Ligne | Facturé | Catalogue appli | Carte papier |
|---|---:|---:|---:|
| Terrine foie gras | 30 000 | 30 000 | 29 000 |
| Crevettes croustillantes | 18 000 | 18 000 | 17 000 |
| Caprice Grenadine 33 cl | 5 000 | 5 000 | 5 000 |
| **Sous-total** | **53 000** | | **51 000** |
| Livraison | 10 000 | | |
| **Total payé** | **63 000** | | |

Deux plats, deux fois 1 000 Ar. **2 000 Ar d'écart, et pas un de plus.** Le soda est
au même prix des deux côtés.

### TF-268 — 23/09, livrée, espèces

| Ligne | Facturé | Détail |
|---|---:|---|
| Émincé de poulet sauce estragon | **37 000** | 32 000 (catalogue) + *Frites* à 0 + **2ᵉ accompagnement *Légumes sautés* à 5 000** |
| Beignets crevettes, calamar ou poisson | 18 000 | option *Crevettes* à 0 ; papier 17 000 |
| **Sous-total** | **55 000** | |
| Livraison | 10 000 | |
| **Total payé** | **65 000** | |

**C'est cette commande qui a dû déclencher la remarque du client.** 37 000 Ar pour un
plat affiché 31 000 sur la carte papier, ça fait 6 000 d'écart et ça saute aux yeux.
Mais il n'y a pas d'erreur : 1 000 de hausse, plus 5 000 parce qu'il a pris **deux**
accompagnements au lieu d'un. Le premier était compris, le second facturé.

---

## En revanche, j'ai trouvé trois vrais écarts, qui ne sont pas la hausse

### 1. Le 2ᵉ accompagnement coûte 1 000 de plus que ce que dit sa carte

| | Carte papier | Appli |
|---|---|---|
| Supplément **riz ou rougail tomate** | **4 000 Ar** | **5 000 Ar** |
| 2ᵉ accompagnement frites / légumes / pâtes / purée | *non chiffré* | 5 000 Ar |

Dans l'appli, le groupe s'appelle littéralement « 2ᵉ accompagnement (+5 000 Ar) » et les
six garnitures y sont toutes à 5 000. Aucune migration n'a jamais touché
`product_options` — le 5 000 était là dès la construction du catalogue. Ce n'est donc
pas la hausse du 21/09 qui l'a créé, c'est un écart plus ancien.

**Un client qui prend un 2ᵉ riz paie 5 000 dans l'appli et 4 000 à table.**

### 2. Deux suppléments de sa carte n'existent pas dans l'appli

| | Carte papier | Appli |
|---|---|---|
| Supplément sauce | 5 000 Ar | **absent** |
| Supplément fromage (pâtes) | 6 000 Ar | **absent** |

Là c'est l'inverse : le client ne peut pas les commander en livraison.

### 3. Deux desserts sont coupés

**Mousse au chocolat** (13 000) et **crème brûlée** (16 000) sont à `is_available = false`
dans l'appli. Ils sont sur sa carte papier. À vérifier avec lui : rupture ou oubli ?

---

## Est-ce que j'ai bien tout son menu sur ces 3 photos ? Non.

Les 3 photos couvrent **67 lignes**. Le catalogue en compte **97**. Il manque
**30 lignes**, et ce n'est pas une anomalie : sa carte papier les renvoie ailleurs.

| Ce qui manque | Lignes | Pourquoi |
|---|---|---|
| **Brasero** | 9 | La carte dit « **Voir tableau** » en face de chaque ligne. Le tableau est un support séparé — celui que tu m'avais photographié le 21/09. |
| **Pizzas** | 13 | Aucune trace sur ces 3 pages. Carte séparée, servie le soir. |
| **Bières** | 4 | Fresh, THB, Beaufort, Gold Blanche. La page « BOISSON SANS ALCOOL » ne les porte pas, par définition. |
| **Energy drinks** | 2 | XXL et Fosa 50 cl. |
| **Plats du jour** | 2 | Camaron et rôti de porc, hors carte permanente. |

Donc : **oui j'ai bien la totalité de son menu et de ses tarifs**, mais parce que je
les ai en base et que tu m'avais déjà envoyé le tableau du brasero. Sur ces 3 photos
seules, non — il manque les pizzas, le brasero et les bières.

---

## Ce que je te propose de répondre au client

> Les tarifs de l'appli sont ceux que le restaurant a fixés : ils ont augmenté de
> 1 000 Ar par plat le 21 septembre, sur toute la carte. Les boissons n'ont pas bougé.
> Si ta carte papier date d'avant, elle affiche l'ancien tarif.

Et si c'est bien TF-268 qui l'a fait tiquer, le détail à lui donner :

> Sur ta commande, l'émincé de poulet à 37 000 Ar, c'est 32 000 Ar le plat plus 5 000 Ar
> parce que tu as pris deux accompagnements — frites **et** légumes sautés. Le premier
> est compris, le second est en supplément.

---

## Trois choses à trancher

1. **Le 2ᵉ accompagnement** : on l'aligne sur sa carte papier (4 000 pour riz et rougail)
   ou on met sa carte papier à jour à 5 000 ?
2. **Supplément sauce (5 000) et supplément fromage (6 000)** : on les crée dans l'appli ?
3. **Mousse au chocolat et crème brûlée** : rupture ou à remettre en ligne ?
