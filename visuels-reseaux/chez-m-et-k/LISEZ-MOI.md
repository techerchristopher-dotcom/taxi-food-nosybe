# Chez M&K — dossier visuel

Restaurant chinois, Djabala Honko, Nosy Be. Partenaire Taxi Food depuis le 22/09/2026.
Tout ce qui sert à produire ses visuels vit ici. Rien n'est à refaire à la main.

## Les livrables

| Fichier | Ce que c'est |
|---|---|
| `LOGO-M-ET-K-A-ecuelle.png` | **Le logo validé.** 1000 × 1000, fond transparent hors du disque. |
| `LOGO-M-ET-K-B-sceau.png` | La proposition écartée, gardée pour mémoire. |
| `PLANCHE-LOGOS-M-ET-K.png` | Les deux propositions aux quatre tailles réelles (180 / 96 / 48 px, une encre). |
| `PUB-mk-annonce.png` | Son annonce, 1080 × 1350. |
| `PUB-partenaires-annonce.png` | L'annonce des quatre restos, badge NOUVEAU sur M&K. |
| `scene-mk.png` | La mosaïque 1080 × 748 qui alimente son annonce. |
| `logo-mk.png` | Copie du logo A, sous le nom que les scripts appellent. |
| `CARTE-CHEZ-M-ET-K.md` | Ses 28 plats, avec l'horodatage WhatsApp de chaque photo. |
| `photos-source/` | Ses 29 photos, renommées par plat. |

## Le logo, en deux phrases

**Il n'a pas été généré, il a été construit** — règle 1 de la charte : le modèle ne dessine
jamais de lettres ni de logo. La géométrie est calculée dans `logos_mk.py`, les lettres sont
des contours de vraies fontes (Poiret One, Jura, OFL).

**La palette vient de son propre matériel**, pas d'un nuancier :

| Couleur | Valeur | D'où elle sort |
|---|---|---|
| or | `#FDC567` | le lettrage de son enseigne, top 1 % de luminance, 39 804 px mesurés |
| braise | `#0A0705` | son noir `#040300`, réchauffé de 6 points |
| laque | `#981A02` | les 10 861 pixels rouges les plus saturés de ses 28 plats (85ᵉ percentile) |

Contrastes mesurés : or/braise **12,8 : 1**, braise/rouge charte **4,74 : 1**, énergie de
contour à 48 px **12,1**.

## Refaire un visuel

```bash
python3 logos_mk.py && python3 rendre_logos.py     # les deux sceaux + 7 contrôles
python3 mk_scene_mosaique.py                        # la mosaïque + 5 contrôles
python3 rendre_mk_annonce.py disponible             # son annonce + 7 contrôles
python3 rendre_partenaires.py                       # les quatre restos + 8 contrôles
```

Chaque script imprime CONFORME ou A CORRIGER. Aucun n'est validé à l'œil.

Dépendances dans le dossier parent : `gabarit.py`, `mesure.py`, `pub_laplage.py`,
`laplage_remplir_cellule.py`, et les images `taxifood-transparent.png`, `appstore.png`,
`googleplay.png`, `p-cabane.png`, `p-bidul.png`, `p-laplage.png`.

## Ce que la mesure a corrigé, et qui ne se voyait pas

- **Le sauté de porc** passait lettrage et cadrage, et sortait en bouillie : netteté 3,9
  contre 440 de médiane. Photo floue agrandie 1,77 fois.
- **Le mi sao** était net et sans lettrage — c'est un plan large de la salle. Il ne remplit
  que 33,8 % du cadre. Plancher posé à 55 %.
- **Le cerne des pastilles** à 26 % plafonnait à 2,02 : 1. Recalculé : 246 − 227α = 137,
  donc α = 0,55, mesuré 3,81 : 1. Sans lui, La Plage tombait à **1,14 : 1** sur le crème.
- **La pastille promo** ne pouvait aller sur aucune de ses 28 photos : la meilleure laissait
  −42,5 px, elle aurait mordu une assiette. D'où la plaque de braise.
- **Le cœur de l'annonce est jaune** parce que du cœur rouge, 4,1 % seulement se distinguent
  du rouge charte. Le jaune ressort à 58,4 %, et sa couleur mesurée `#FDC72F` tombe à deux
  points de l'or maison.

## Ce qui reste à obtenir de lui

- La photo du **bol renversé fruits de mer** (40 000 Ar) — en ligne sans visuel.
- Les visuels des **3 boissons** : Coca petit modèle, Sprite petit modèle, bière en canette.
- Les **ingrédients** des 28 plats.
- Le **ti pan mixte** contient-il du porc ?
- Le **délai et le minimum** de la fondue terre et mer (100 000 Ar, sur commande).
- L'**adresse exacte** à Djabala Honko.
