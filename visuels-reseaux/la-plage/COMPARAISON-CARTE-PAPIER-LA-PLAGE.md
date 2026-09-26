# La Plage — sa carte papier confrontée à la base

Relevé sur les deux photos du 23/09/2026 (`IMG_2077` carte cuisine, `IMG_2078` carte
boissons), ligne à ligne, contre la base au 24/09/2026.

**Le résultat en une phrase : les 38 plats sont justes, au prix près. Il manque les
accompagnements, et la carte des boissons n'existe pas du tout en base — 39 lignes.**

---

## 1. La carte cuisine : 38 plats sur 38, aucun écart de prix

| Section papier | Papier | Base | Écart |
|---|---|---|---|
| Nos traditions et entrées | 8 | 8 | aucun |
| Grillades au feu de bois | 8 | 8 | aucun |
| **Accompagnements** | **7 lignes** | **0** | **absent** |
| Sandwichs demi-baguette | 3 | 3 | aucun |
| Plats maison | 13 | 13 | aucun |
| Le coin douceur | 6 | 6 | aucun |

Les 38 prix correspondent un à un. Les trois « à partir de » du papier — Poisson entier
grillé *dès* 29 000, Mi Xao *à partir de* 29 000, Soupe chinoise *à partir de* 29 000 — sont
bien reportés en base dans le champ `description`. Ce n'était donc pas une approximation de
saisie : **c'est sa carte qui est ouverte sur ces trois lignes.** Pour une carte imprimée il
faudra soit la vraie fourchette, soit garder la mention « dès ».

### Ce qui manque : le bloc ACCOMPAGNEMENTS

```
Frites  ·  pommes sautées  ·  riz blanc
Salade  ·  légumes sautés  ·  pâtes
Supplément accompagnement ....... 5 000 Ar
```

Six garnitures au choix, comprises dans le plat, et un supplément à 5 000 Ar. Rien de tout
cela n'est en base : ni les six accompagnements comme groupe d'options, ni le supplément.
C'est exactement la même chose qu'on a réglée chez Bidul avec ses accompagnements de brasero.

---

## 2. La carte boissons : 39 lignes, zéro en base

Aucune catégorie `est_boisson` n'existe chez La Plage. Voici ce qu'il y a sur le carton.

### Boissons fraîches — 10

| | Ar |
|---|---|
| Jus de fruits de saison | 7 000 |
| Sirop à l'eau | 3 000 |
| Diabolo menthe ou grenadine | 4 000 |
| Eau Vive 50 cl | 4 000 |
| Eau Vive 150 cl | 5 000 |
| Coca-Cola 33 cl | 5 000 |
| Coca-Cola 50 cl | 7 000 |
| Boisson sucrée 30 cl | 4 000 |
| Boisson sucrée 100 cl | 9 000 |
| Boisson énergétique | 8 000 |

### Boissons chaudes — 2

| | Ar |
|---|---|
| Thé ou café | 3 000 |
| Espresso | 4 000 |

### Les bières — 16

| | Ar |
|---|---|
| THB 65 cl | 7 000 |
| THB 33 cl | 6 000 |
| THB boîte 33 cl | 7 000 |
| THB boîte 50 cl | 10 000 |
| Gold 65 cl | 8 000 |
| Gold blanche boîte 50 cl | 11 000 |
| Gold boîte 50 cl | 10 000 |
| Beaufort 33 cl | 7 000 |
| Beaufort boîte 50 cl | 11 000 |
| Queen's 65 cl | 9 000 |
| Booster 50 cl | 8 000 |
| Racine 30 cl | 7 000 |
| Cody's Bière 5,4 % 50 cl | 12 000 |
| Cody's Bière 7,5 % 50 cl | 12 000 |
| Cody's Bière Citron Vodka 5,9 % 50 cl | 12 000 |
| Cody's Vody Energy Vodka 18 % 25 cl | 12 000 |

### Rhums et cocktails — 6

| | Ar |
|---|---|
| Rhum blanc 5 cl | 6 000 |
| Rhum arrangé 5 cl | 7 000 |
| Mangoustan 5 cl | 7 000 |
| Punch coco 5 cl | 7 000 |
| Caipirinha | 8 000 |
| Mojito | 9 000 |

### Le vin — 2

| | Ar |
|---|---|
| Ballon de vin 12 cl | 12 000 |
| Pichet de vin 50 cl | 35 000 |

### Les spiritueux 5 cl — 3

| | Ar |
|---|---|
| Pastis local | 7 000 |
| Vodka · gin · tequila · whisky local | 8 000 |
| Alcool importé — whisky, pastis… | 20 000 |

---

## 3. Ce que la base a et que le papier n'a pas

Deux plats du jour, hors carte permanente, et c'est normal : ils tournent.

| | Ar | |
|---|---|---|
| Calamar au pesto | 35 000 | `is_featured`, libellé « Plat du jour » |
| Salade Parisienne | 22 000 | idem |

Ils n'ont rien à faire sur une carte imprimée.

---

## 4. L'état des visuels

38 plats, 38 visuels. Mais deux origines, et ça se voit à l'impression :

| Origine | Nombre | Ce que c'est |
|---|---|---|
| Photo réelle du restaurant | 14 | fichiers `*-reel.jpg` |
| Packshot studio généré | 24 | fichiers `*.png` |

Sur la carte de Bidul, tous les visuels venaient de la même série, ce qui donnait une page
homogène. Ici, 14 vraies photos prises au restaurant et 24 packshots studio ne se mélangent
pas sans qu'on le remarque — ils n'ont ni le même fond, ni la même lumière, ni le même
cadrage. À mesurer avant de composer, comme on l'a fait pour le fond de la série Bidul.

Et **zéro visuel pour les 39 boissons.**

---

## 5. Ce qu'il reste à trancher avant de composer

1. **Les prix bougent-ils ?** Chez Bidul, toute la nourriture a pris +1 000 Ar et les boissons
   n'ont pas bougé. Rien d'équivalent n'a été demandé ici.
2. **Les ingrédients et la ligne de présentation.** Zéro description utilisable sur 38 plats.
   Chez Bidul, chaque plat avait ses ingrédients plus une ligne. Soit je les recherche comme
   pour lui, soit elle les donne.
3. **Les trois prix ouverts** — Poisson entier grillé, Mi Xao, Soupe chinoise. Fourchette
   réelle, ou on garde « dès 29 000 Ar » sur la carte imprimée ?
4. **Les accompagnements**, à créer en base comme groupe d'options + le supplément à 5 000.
5. **Les boissons en ligne.** Chez Bidul, on avait tranché : pas de canette sur la carte
   papier, canette commandable en livraison uniquement. Même règle ici ? Et les 6 cocktails
   et 3 spiritueux, livrables ou sur place seulement ?
