# Un registre visuel par restaurant

Taxi Food livre pour plusieurs maisons à la fois. Si leurs visuels se ressemblent, le flux
devient une bouillie et plus personne ne reconnaît qui cuisine. Chaque restaurant a donc son
**registre** : un fond, une lumière, un contenant, un jeu d'accessoires. On le fixe une fois,
au premier visuel, et toute sa carte s'y tient ensuite.

## La méthode, en quatre temps

**1. On ne choisit pas la couleur, on la lit sur sa façade.**
Un k-means sur une photo du lieu donne le vrai mur, pas une idée du pays. C'est ce qui rend le
registre *spécifique* au restaurant et pas seulement *typique* de sa cuisine. Deux zones
suffisent : une à la lumière, une à l'ombre.

```python
from sklearn.cluster import KMeans
a = np.asarray(photo.crop(zone).resize((140,140))).reshape(-1,3).astype(float)
KMeans(n_clusters=2, n_init=10, random_state=0).fit(a).cluster_centers_
```

**2. On compare en teinte et en valeur, jamais en distance RGB.**
La distance euclidienne confond « plus sombre » et « autre couleur ». Ce qui compte, c'est
l'écart de **teinte** (est-ce la même famille ?) et l'écart de **valeur** (est-ce la même
lumière ?). Deux maisons se distinguent quand les deux écarts sont grands.

**3. Deux maisons voisines s'opposent, elles ne se nuancent pas.**
Si l'une est froide et sombre, l'autre est chaude et claire. Un écart de teinte de 30° ne
protège de rien ; on vise l'opposition franche.

**4. Le moteur dérive, on mesure et on corrige.**
On demande un hex, le moteur en rend un autre — la dérive est reproductible mais pas
constante. On ne suppose donc pas l'écart : on le mesure sur chaque rendu, sur une fenêtre de
fond, et on corrige de cet écart-là. `madame-oh/caler_serie.py` fait ça : masque du fond,
rotation de teinte mesurée, gamma calé sur une valeur cible.

**Le contrôle qui prouve que la correction est propre :** la dérive sur les pixels *hors
masque* doit être de **0,0000/255**. Si elle ne l'est pas, le masque a mordu sur le plat.

## Ce qui fait un registre, et ce qui n'en fait pas partie

Appartiennent au registre, donc identiques sur toute la carte d'une maison :

- le **fond** (matière et couleur, mesurée sur sa façade),
- la **lumière** (direction, dureté, température),
- l'**ombre signature** (palme, moucharabieh, claustra — un motif porté, pas un objet),
- le **contenant** (la règle vaisselle, voir plus bas),
- la **prise de vue** (angle, hauteur, profondeur de champ).

N'en font pas partie et changent à chaque plat : les aromates posés à côté, la protéine, la
garniture. Ce sont eux qui empêchent la série d'être monotone.

## La règle de contenant

Chaque maison a une logique de vaisselle qu'on lit sur ses photos existantes plutôt que de
l'inventer. Elle n'est écrite nulle part mais elle tient sur toute la carte.

| Maison | La règle |
|---|---|
| Chez Bidul & Truc | ce qui a du liquide va dans le **bol noir**, ce qui se dresse va sur l'**ardoise** |
| Madame Oh | bouillons au **bol céladon à pied**, currys au **bol large avec le riz à côté**, sautés et entrées sur l'**assiette céladon** |

## Chaque plat porte le signe qui le sépare de son voisin

C'est la leçon la plus chère de la série. Laissé libre, le modèle converge vers le plat le plus
banal du lot, et deux plats voisins de la carte sortent identiques. Chaque description doit
donc porter **le détail visuel unique** qui interdit la confusion.

| Plat | Le signe, et le plat qu'il évite |
|---|---|
| Tartare de zébu | un **volume** : dôme haut, jaune d'œuf en demi-coquille — sinon c'est le carpaccio |
| Blanquette de poisson | les **légumes sortent de la sauce** et se comptent — sinon c'est l'émincé estragon |
| Curry panang | sauce **épaisse qui nappe** + combava en cheveux d'ange — le curry rouge, lui, nage |
| Curry jaune | les **pommes de terre**, ingrédient signature qu'on oublie toujours |
| Tom kha gai | bouillon **blanc opaque** — le tom yam est rouge-orangé |
| Rouleaux | galette de riz **translucide** — le nem est opaque et frit |

**Vérifier les ingrédients sur le web avant de générer.** Une recherche sourcée a corrigé deux
plats sur la carte de Madame Oh — sans elle, le panang et le curry rouge sortaient identiques.
Chercher ce qu'on **voit** dans l'assiette, pas la recette.

## Imperfection n'est pas saleté

Piège payé le 16/09. La compétence `photo-ia-realiste` demande une « imperfection commandée »
et donne en exemple des gobelets en plastique, des assiettes sales empilées, un gâteau de
supermarché. J'ai transposé ça tel quel sur un plat et commandé une coulée de bouillon le long
du bol, des éclaboussures, une trace de pouce gras, de la peinture écaillée et des ronds de
verre. Refusé, à raison : **« je veux un truc propre, pas parfait mais propre ».**

Ces exemples valent pour une **fin de soirée**, où le désordre est la vérité du moment. Pour un
plat qu'on vient de servir, la vérité est l'inverse : la cuisine vient de le dresser, la table
est essuyée. Une assiette sale ne dit pas « vraie photo », elle dit « restaurant sale ».

**Ce qui fait vrai tient en quatre points, et aucun ne salit :**

- le **cadrage** — le plat posé légèrement décentré et pas d'équerre, comme posé par un serveur
  et non placé par un styliste ;
- la **mise au point** — pris à main levée et assez ouvert, le bord proche part doucement ;
- la **lumière** — directionnelle et un peu dure, une tache chaude et une vraie chute dans
  l'ombre, jamais l'enveloppe régulière d'une boîte à lumière ;
- le **désordre naturel des ingrédients** — deux feuilles de coriandre et un tronçon de
  citronnelle tombés là où ils sont tombés, pas disposés.

**Et la liste d'interdits va dans le prompt, explicitement :** aucune coulée le long du
contenant, aucune éclaboussure, aucune goutte sur la table, aucune trace de doigt, aucune
tache, aucune peinture écaillée, aucun rond de verre, aucune miette.

**Mesure du décentrement** (centroïde du sujet, 0,500 = pile au centre) : studio **−0,7 %**,
version propre **−3,0 %** et **−7,5 %**. On garde donc tout l'écart au catalogue sans une
seule salissure.

## Deux registres par maison, pas un

- **Packshot propre** pour la carte et l'application, à côté du prix. C'est la convention des
  90 photos déjà en ligne ; y injecter du désordre jurerait avec le catalogue.
- **Registre argentique propre** pour les pubs réseaux, là où il faut croire qu'un vrai
  restaurant existe derrière.

Même couleur mesurée, même règle de contenant, deux mises en lumière.

## Les registres arrêtés

### Madame Oh — thaï, Hell-Ville

Mesuré sur la façade (IMG_1459) : **teinte 168°, saturation 53 %, valeur 39 %**, soit `#2F6459`
— #22554B à l'ombre, #4E7F7B en pleine lumière. Un vert jade, qui se trouve être le céladon
thaï : sa façade *est* déjà un registre thaï.

- Fond : plâtre peint mat vert jade `#2F6459`, patiné, irrégulier.
- Ombre signature : **palme** en travers du tiers haut, nervures lisibles.
- Lumière : une seule source large à gauche, rasante, midi tropical ; ombres courtes et nettes.
- Prise de vue : trois quarts en plongée à 40°, faible profondeur de champ, grain argentique.
- Accessoires : **uniquement des aromates crus** posés à côté — citronnelle, combava, piments
  oiseau, citron vert. Jamais de couvert, de nappe ni d'emballage.
- Enseigne : pastille **bleu marine** à lettres blanches en relief (bleu exact non confirmé,
  la seule vue disponible est à contre-jour).

Dérive mesurée du moteur sur cette série : teinte rendue entre **153° et 168°** quand on
demande 168°, valeur entre 25 % et 47 %. Corrigée image par image, 14 sur 14 à 168°.

### Oh Hazar — marocain, Hell-Ville

Mesuré sur le mur au-dessus de la frise (IMG_1456) : **teinte 40°, saturation 20 %,
valeur 82 %**, soit `#D2C4A9` — une chaux sable chaude. Et la frise arabesque peinte au-dessus
de l'ardoise est un **bleu-gris ardoise `#4E5256`, teinte 210°**.

L'écart avec Madame Oh est de **128° de teinte et 43 points de valeur**. C'est ce qui garantit
qu'on ne confondra jamais les deux maisons dans un fil : l'une est froide, sombre, saturée ;
l'autre est chaude, claire, désaturée.

## Ce qui reste à faire pour chaque nouvelle maison

1. Une photo nette de la façade et de l'enseigne — la mesure ne vaut que ce que vaut la photo.
   Les deux relevés ci-dessus viennent de photos d'ardoise où le mur n'est qu'un arrière-plan.
2. De vraies photos des plats. Tout ce qui est généré est **reconstitué d'après les recettes
   canoniques**, pas photographié chez eux. Le registre est validé, les assiettes non.
3. Un élément Higgsfield pour le logo, dès qu'une image propre existe : le modèle ne dessine
   jamais une enseigne.
