# La Plage — la fiche de lancement, remplie

Restaurant `eb10f338-fb78-4c16-82d5-810ae37b49fe`. Tout ce qui suit est **lu en base le
2026-09-17**, rien n'est inventé. À copier telle quelle, comme la fiche La Cabane de la charte.

## Le tableau des variables (§4 de la charte)

| Variable | Valeur | Source |
|---|---|---|
| `NOM` | La Plage | `restaurants.name` |
| `NATURE` | Bistrot & bar — grillades au feu de bois, poissons, cuisine malgache et chinoise | `cuisine_type`, réécrit court |
| `ZONE` | **Hell-Ville** | son logo ; `zone_served` dit « Nosy Be », à corriger en base |
| `HORAIRES` | 10 h – 15 h et 18 h – 22 h, fermé le lundi | `restaurant_hours`, 14 lignes |
| `LOGO` | `produits/la-plage/divers/logo.jpeg` | `restaurants.logo_url` |
| `PLAT SIGNATURE` | Côtes de zébu grillées — 35 000 Ar | le plus cher avec photo réelle |
| `PLAT 2 / 3 / 4` | Poulet citronné 29 000 · Soupe chinoise 29 000 · Poisson pané 27 000 | un par registre |
| `GAMME DE PRIX` | 6 000 à 35 000 Ar | min et max des 38 plats |
| `MOTS-CLÉS PROPRES` | `#HellVille` `#Grillades` `#LaPlage` | zone + spécialité + nom |
| `ÉTAT` | **`visible`** — commandable | `listing_status` |
| `PLATS COUPÉS CE JOUR` | Poisson entier grillé, Mi Xao, Soupe chinoise | `is_available = false` |

**Le restaurant est commandable.** `listing_status = visible`, `auto_open = true`, il a un
téléphone et un `telegram_chat_id` — les commandes arrivent quelque part. La signature du
visuel dit donc **NOUVEAU SUR TAXI FOOD**, et la pastille porte la remise, pas une annonce.

**Trois plats sont coupés en base aujourd'hui** (`is_available = false`) : poisson entier
grillé, mi xao, soupe chinoise. La charte est explicite — « on ne montre que ce qui est
commandable » — donc **la soupe chinoise a été retirée de la mosaïque** alors qu'elle y était,
et aucun des trois n'est nommé dans les légendes. À vérifier auprès du restaurateur si c'est
voulu ou un oubli : ce sont trois plats dont on vient d'installer les vraies photos.

**Aucun compte de plats sur le visuel.** `is_available` bouge tous les jours — 35 sur 38 ce
matin. Un chiffre gravé sur un visuel devient faux sans prévenir. La fourchette de prix, elle,
tient : « Sa carte entière · de 6 000 à 35 000 Ar ».

**Une chose à corriger en base :** `zone_served` vaut « Nosy Be » alors que le restaurant est à
Hell-Ville, et son enseigne le dit.

## Post 1 — l'annonce

Visuel : `PUB-laplage-annonce.png`, 1080 × 1350.

> **La Plage livre chez toi.**
>
> Grillades au feu de bois, poissons, romazava, poulet citronné. De 6 000 à 35 000 Ar.
>
> À Hell-Ville, de 10 h à 15 h et de 18 h à 22 h, fermé le lundi.
> Aucun minimum de commande. Espèces ou carte bancaire.
>
> Code `TAXIFOOD50` : la livraison à moitié prix sur ta première commande.
> Télécharge Taxi Food, lien en bio.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #HellVille #Grillades #LaPlage`

## Post 2 — le plat signature

> **Les côtes de zébu grillées. 35 000 Ar.**
>
> Au feu de bois, chez La Plage, à Hell-Ville. Salade, frites, et c'est tout ce qu'il faut.
>
> Dans l'appli. Code `TAXIFOOD50` pour la première commande.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #HellVille #Grillades #LaPlage`

## Post 3 — la carte

> **Il n'y a pas que les grillades.**
>
> Tartare de poisson, romazava, brochettes de zébu, poisson pané, crêpes.
> De 6 000 à 35 000 Ar.
>
> 10 h – 15 h et 18 h – 22 h, fermé le lundi. Hell-Ville.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar #HellVille #LaPlage`

## Post 4 — le mode d'emploi

> **Commander, c'est trois gestes.**
>
> Tu choisis. Tu poses ton adresse sur la carte. On te livre.
>
> Aucun minimum de commande. Espèces ou carte bancaire, au choix.
> Livraison 10 000 Ar — et 5 000 avec le code `TAXIFOOD50` sur ta première.
>
> `#TaxiFood #NosyBe #LivraisonNosyBe #Madagascar`

## Post 5 — la story du soir

> **Il est 18 h. La Plage rouvre pour le service du soir.**
> *(autocollant compte à rebours jusqu'à 22 h)*

---

## Ce que ce visuel a appris au gabarit

### La scène d'annonce peut être une mosaïque de vraies photos

La Plage est **le premier restaurant dont les visuels sont ses propres photos**, pas des
reconstitutions. La scène n'est donc pas une image générée : c'est une mosaïque de cinq de ses
assiettes, recadrées au pixel près à 1080 × 748 (jamais `object-fit`, comme la charte l'exige),
séparées par des filets or de 2 px.

### Le détourage a été tenté et rejeté, par la mesure

Premier essai : détourer les assiettes et les poser sur un plateau reconstitué. Deux échecs
mesurés, pas jugés à l'œil :

- la faïence et le bois se séparent mal. Le score de faïence `V × (1 − S)` n'est **pas
  bimodal** (p25 0,13 · médiane 0,24 · p95 0,68 sur les côtes de zébu) : Otsu y vidait le
  masque, et un balayage du seuil emportait **58 % du cadre**, soit le bois avec l'assiette ;
- ses photos sont prises de trois quarts à des angles différents. Même bien détourées, elles
  ne posent pas sur un même plan.

La mosaïque ne simule rien. Elle **montre** cinq photos réelles — ce qui est justement le
message.

### Les cinq photos se choisissent par mesure, pas au goût

Trois de ses photos sont prises sur fond noir : mi xao **29,8 %** de pixels noirs, rouleaux de
printemps **32,8 %**, poulet grillé **22,3 %**. Mélangées aux autres, elles cassent l'idée
d'**une** table. On ne garde que celles posées sur son bois, part de brun chaud mesurée :

| Photo | brun chaud | noir |
|---|---|---|
| Poulet citronné | 49,7 % | 0,1 % |
| Côtes de zébu | 41,1 % | 2,7 % |
| Poisson pané | 29,3 % | 0,9 % |
| Assiette de crudités | 38,8 % | 3,4 % |
| Soupe chinoise | 20,5 % | 0,3 % |
| Poisson fumé | 16,3 % | 0,3 % |

**La série retenue a changé trois fois, et chaque fois pour une raison mesurée ou vue :**

1. la **soupe chinoise** est sortie parce qu'elle est `is_available = false` en base ;
2. le **tartare de poisson** l'a remplacée, puis a été écarté : sa photo porte un sac plastique
   rose en arrière-plan, et **aucun recadrage ne l'en sort** — trois ancres essayées,
   l'assiette est trop large dans le cadre. L'assiette de crudités a pris sa place ;
3. le **poisson fumé** est sorti parce que sa laitue faisait la **troisième assiette verte** de
   la rangée du bas : la composition tournait au monochrome. Les **brochettes de filet de
   zébu** l'ont remplacé — elles sont sur un set gris et non sur le bois, seul écart assumé,
   mais elles apportent une forme que rien d'autre n'a.

La série finale : côtes de zébu laquées, poisson pané, brochettes, poulet citronné, crudités.
Cinq registres, cinq formes, et la fourchette de prix complète — les crudités à 11 000 Ar
justifient le « de 6 000 » de la ligne secondaire, les côtes à 35 000 le « à 35 000 ».

### L'assiette a une taille, pas la photo

Le défaut le plus visible de la première mosaïque, et le plus instructif. La version 1 prenait
l'échelle **minimale qui couvre la cellule** et centrait sur l'assiette. Conséquence : chaque
assiette sortait à la taille qu'elle avait dans sa photo source. Mesuré :

| Cellule | part de la cellule occupée par l'assiette | ce qu'on voyait |
|---|---|---|
| brochettes | **38 %** | une assiette perdue au milieu du set de table |
| poisson pané | **112 %** | une assiette coupée, la tuile « pas alignée » |

La version 2 mesure la **boîte de l'assiette** dans la source, puis choisit l'échelle pour
qu'elle occupe une part constante de la cellule, sans jamais descendre sous l'échelle de
couverture. C'est la règle « une série, c'est une BOÎTE, pas une largeur » de la charte,
appliquée à une mosaïque.

**La cible se balaie, elle ne se décrète pas.** 94 % a été essayé d'abord : toutes les assiettes
sortaient rognées jusqu'au bord, la table disparaissait et la mosaïque perdait son sujet.
Sous 72 %, l'échelle de couverture reprend la main et rien ne bouge plus. **72 % est le
réglage** : parts finales 72 à 93 %, aucune assiette coupée.

### Mesurer la boîte d'une assiette demande trois précautions, toutes payées

1. **Le seuil de clarté doit être relatif à l'image.** Fixé à 0,55, il ne rendait que la partie
   éclairée de l'assiette des brochettes — photo sombre, luminance médiane 51/255 : boîte
   mesurée **432 px** au lieu de ~900, donc échelle deux fois trop grande et assiette coupée.
2. **Il faut FERMER le masque avant de l'étiqueter.** La nourriture qui touche le bord de
   l'assiette coupe la faïence en plusieurs composantes : la plus grande ne faisait que 28 %
   de la largeur sur les brochettes, et sortait **plate** sur le poulet citronné
   (1216 × 192). Un noyau de 15 px sur l'image réduite au quart — 60 px en pleine résolution —
   franchit une brochette sans rejoindre la nappe.
3. **Percentiles 1/99, jamais min/max.** Une traînée claire sur la nappe suffit à étirer une
   boîte min/max de plusieurs centaines de pixels.

### La cellule sous le logo se choisit par mesure, pas par goût

La pastille du logo, imposée par la charte à `left: 62px`, recouvre les **242 × 94 px** du coin
bas-gauche. Sur les sept photos candidates, une seule tient **entière** dans cette cellule
presque carrée **et** garde son centre d'assiette hors du rectangle du logo :

| Photo | part de la cellule | centre de l'assiette | logo |
|---|---|---|---|
| **Poisson pané** | **93,2 %** | y 138 | **ok** |
| Brochettes | 72,0 % | y 206 | mord le centre |
| Crudités · poisson fumé · tartare · poulet citronné · côtes | 114 à 126 % | — | coupées |

L'ancre de recadrage ne pouvait pas sauver les brochettes : à leur échelle la photo ne fait que
**8 px** de plus que la cellule en hauteur — il n'y a aucune latitude à exploiter. C'est la
distribution des cellules qui règle le problème, pas un réglage.

### Les photos de La Plage sont cadrées serré, et ça contraint la géométrie

| Cellule | ratio | ce qui y tient |
|---|---|---|
| presque carrée 348 × 298 | 1,17 | **poisson pané et brochettes seulement** |
| allongée 380 × 230 | 1,65 | toutes — c'est le ratio de ses photos (1,78) |

Une assiette large ne tient pas dans une cellule presque carrée. Les deux qui tiennent vont donc
à gauche, les autres à droite. À retenir pour le prochain restaurant : **mesurer la boîte des
assiettes avant de dessiner la grille**, pas après.

### Le vide de la pastille se construit, il ne se trouve pas

Sur la scène milkshake, la charte **cherchait** le vide et y posait la pastille. Sur une
mosaïque il n'y a pas de vide : on en **réserve** un. La cellule bas-droite, 380 × 284, est
remplie d'un morceau du **bois de sa table**, choisi par variance locale minimale.

Deux erreurs payées et corrigées par la mesure :

1. sans exigence de couleur, la recherche renvoyait le **fond noir** d'une photo studio
   (écart-type local 4,06 — imbattable par du bois) ;
2. avec un créneau de teinte trop large (8–52°), elle renvoyait un gros plan de **macaronis**
   (34°, saturation 0,81). Son bois, mesuré sur deux zones nues : **13–18°, saturation
   0,40–0,64**. C'est la teinte qui sépare, pas la luminance — le bois est parfois plus clair
   que les pâtes (0,43 contre 0,35).

La cellule fait **284 px et non 248** : la pastille de 235 px, tournée de −7°, occupe une boîte
de 262 px. À 248 la cellule la refusait, mesuré.

### Le contrôle d'air de la charte ne s'applique pas tel quel à une mosaïque

`rendre_pub.py` mesure l'air autour de la pastille sur une **carte d'occupation** (écart-type
local > 6). Juste sur un fond en dégradé ; faux sur une mosaïque : le grain du bois de sa table
a un écart-type local de **13**, donc tout le cadre est « occupé » et le contrôle renvoyait
**−116,8 px** quelle que soit la position. Il mesurait la texture, pas le risque.

Ce que le contrôle protège vraiment, c'est qu'**aucune assiette ne soit mordue**. On mesure
donc cela, et **par la couleur** comme la charte l'exige : la faïence est claire et désaturée.
Résultat : **36,4 px** d'air jusqu'à la première assiette, minimum 20.

### L'ancre de recadrage existe pour une seule raison, et elle est nécessaire

La pastille du logo, imposée par la charte à `left: 62px` à cheval sur le filet, recouvre les
**242 × 94 px** du coin bas-gauche de la scène. Au premier rendu elle tombait sur le bol de
soupe. La cellule bas-gauche reçoit donc une ancre de recadrage (0,70 · 0,34) qui écarte
l'assiette de ce coin. C'est le seul réglage par cellule, et il n'est pas décoratif.

### « Se fait livrer » disait le contraire de ce qu'on voulait dire

Le premier titre était **« La Plage se fait livrer »**. Lu à froid, il dit que c'est *La Plage*
qui reçoit une livraison — l'inverse du sens voulu, et le porteur du projet l'a relevé
immédiatement. La charte donnait déjà la règle : *« le restaurant est le sujet »* et *« on
annonce qu'il livre, pas qu'il ouvre »*.

**« La Plage livre chez toi. »** met le restaurant en sujet, l'action au présent, le client en
destination — et c'est exactement la promesse de Taxi Food : *les restaurants que tu connais
déjà, livrés là où tu es*.

### Ce que le visuel d'un restaurant DISPONIBLE change

Trois écarts avec l'annonce milkshake, et un seul motif : La Plage est commandable.

1. **La signature dit NOUVEAU, pas « bientôt ».** La charte l'impose dans les deux sens : on ne
   montre pas comme disponible ce qui ne l'est pas, et on ne dit pas « bientôt » ce qui est
   déjà là.
2. **La pastille porte la remise, pas l'annonce.** C'est la pastille standard de la charte,
   `_badge_code(variante='remise')` : le −50 % en héros, le code `TAXIFOOD50` en pilule encre.
   Le « BIENTÔT / 38 PLATS » n'avait de sens que sur un restaurant à venir.
3. **Le QR est retiré.** Il sert à amener quelqu'un sur le site depuis un flyer ou un écran
   d'ordinateur ; sur un visuel qu'on croise en scrollant, il prenait 190 × 190 px pour un
   geste que personne ne fait.
4. **À sa place, le logo Taxi Food passe sous les deux badges de stores.** Les badges remontent
   donc de **213 px**, et c'est désormais le bas de la pastille du logo qui tombe sur le bas du
   bloc promo. La règle de charte — les deux colonnes finissent sur la même ligne horizontale —
   est conservée, seul l'élément sur lequel on la mesure change.

   **Le logo est le fichier officiel détouré, posé à nu sur le rouge.**
   `logo/logotaxifood/logo-taxi-food-transparent_2.png` (bucket `logo`, 392 × 403) : la
   transparence ne porte que sur les coins arrondis. Pas de cadre, pas de pastille, et **pas
   d'arrondi en CSS** — les coins sont déjà dans le fichier avec leur anticrénelage, exactement
   la règle que la charte pose pour les badges des stores. C'est aussi ce fichier, et non
   l'icône à fond plein, qui sert les 36 px de la signature.

   Une pastille blanche avait été essayée : elle montait le contraste de **2,06** à
   **4,36 : 1**, mais elle ajoutait autour du logo un cadre que la marque n'a pas, et le
   porteur du projet l'a refusée. La séparation vient donc d'une **ombre portée
   `drop-shadow`**, qui suit la forme du logo au lieu de dessiner une boîte autour. Le
   contraste reste sous le seuil de 3 : 1 des éléments graphiques — **c'est une décision de
   marque assumée, pas un oubli** : le logo est un carré orange sur une bande rouge, et le
   rouge de la charte est celui du logo.

   Le logo apparaît alors deux fois : 36 px dans la signature, où la charte l'impose, et 190 px
   au bas de la colonne. Les deux ne disent pas la même chose — le petit signe la ligne
   « NOUVEAU SUR TAXI FOOD », le grand ferme la colonne du geste « installer l'appli ».

Le code promo apparaît alors **deux fois, et c'est le standard de la charte** : la pastille est
le geste commercial qu'on lit avant le texte, le bloc trois lignes est le mode d'emploi
(« 1re commande » / « Tape le code » / « au moment de payer »). La troisième ligne est celle
qu'on est tenté de couper — elle reste.

### Les six contrôles du rendu

```
pastille (remise)              d=235 en (772, 488)
QR code                        absent     (attendu absent)
logo Taxi Food (détouré)       190 px de large, bas à 1289 px
badges remontés de             213 px     (Google Play finit à 1076)
écart promo / logo Taxi Food   +0 px      (attendu 0)
ligne secondaire               2 lignes, bord droit à 737 px (max 794)
air jusqu'à la 1re assiette    35,0 px    (mini 20)
pastille dans la cellule bois  oui        (marge de rotation 13 px)
débord du cadre                non
->  CONFORME

et, par cellule, au montage de la scène :

cellule      photo                  échelle  bornée par   assiette  coupée  logo
héros        côtes de zébu           0,50    couverture    85,6 %    non     ok
bas-gauche   poisson pané            0,33    couverture    93,2 %    non     ok
bas-milieu   brochettes              0,34    assiette      72,0 %    non     ok
droite-haut  poulet citronné         0,26    couverture    81,8 %    non     ok
droite-mil   crudités                0,26    couverture    89,8 %    non     ok
```

### Le feu de bois n'est plus exclusif à Chez Bidul & Truc

La charte écrivait que c'est « le seul argument que personne d'autre n'a sur l'île ». C'est
faux depuis La Plage : sa carte porte littéralement une catégorie **« Grillades au feu de
bois »**. On l'écrit donc pour les deux. À faire confirmer par le restaurateur que c'est bien
du feu de bois et pas un grill à gaz — c'est une affirmation vérifiable par un client.
