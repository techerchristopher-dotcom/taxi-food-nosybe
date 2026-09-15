# Les éléments Higgsfield — Taxi Food

Un élément se référence dans un prompt par `<<<id>>>` : le moteur injecte la vraie image, il
n'invente rien. C'est la seule façon d'obtenir un rendu fidèle, pour un personnage comme pour
une canette.

## Les boissons — onze canettes, photographiées le 10/09/2026

Trois à quatre angles réels par produit. **Aucune n'est dessinée** : ce sont des marques tierces,
seules les photos font foi.

| Boisson | id |
|---|---|
| Fosa Energy 50 cl | `906d308a-de11-44ce-b9aa-e674c351474f` |
| Gold Blonde | `46e2e7e8-ae07-476e-b8ad-693b249f760f` |
| Gold Blanche | `d623f45a-3ccd-40d5-9622-6716f58cd121` |
| THB Pilsener | `d98a246d-de38-40cc-9b05-c3a8306cf333` |
| Beaufort Lager | `a0548760-8858-4e88-a7c1-7ce0235ff014` |
| XXL Energy | `2644105d-333e-422e-9cb9-e24d9adc40bf` |
| World Cola 33 cl | `348f3ab3-8475-4a52-8f9d-04f6fa04ab7b` |
| Caprice Bonbon Anglais | `927e536a-174f-4eda-992b-e21f386f8801` |
| Caprice Grenadine | `b3437ce4-a4cb-46d6-8a02-65eb9ad2f220` |
| Caprice Orange | `a05dadf1-606d-4752-84a4-2d15f79fbdfb` |
| Fresh Panaché | `ec64cb10-a4c0-40a4-bab9-b89059e5e0e0` |

**Deux éléments remplacent des données fausses**, et il faudra suivre :

`Caprice-Bonbon-Anglais` remplace l'ancien `Caprice-BonbonAnglais-canette` (`789f8e91`), qui était
une photo floue tenue à la main au-dessus d'une assiette.

`Caprice-Grenadine-canette` corrige le fichier `caprice-grenadine.png` du bucket, **qui montre une
bouteille de sirop** — un autre produit. Ce fichier illustre aujourd'hui le Caprice Grenadine en
vente chez Angelo et La Cabane.

Reste aussi à corriger `thb-pm.jpg`, **qui est un verre vide**, en vente chez trois restaurants.

## Les milkshakes de La Cabane — huit parfums, 10/09/2026

Un parfum = un element. C'est la seule facon d'obtenir huit gobelets qu'on
distingue a l'oeil : sans eux, le moteur redessine huit fois le meme beige et
deforme le sticker. Le gobelet ne change jamais, seuls la couleur du shake, la
garniture et l'ingredient au pied changent.

| Element | id |
|---|---|
| LaCabane-logo | `2ff4df25-1701-463a-aaa8-816ae0cf9923` |
| LaCabane-gobelet-milkshake | `4e840637-5f65-44de-823b-77ffadad0099` |
| Milkshake-Fraise-LaCabane | `202b6eb0-1056-46de-9a1d-9fcb4a635200` |
| Milkshake-Vanille-LaCabane | `a21897e1-6135-4228-a4f6-178645aceccd` |
| Milkshake-Chocolat-LaCabane | `0e5c06cb-9802-4978-bce0-f552a3474931` |
| Milkshake-Oreo-LaCabane | `0fdb9699-0a77-4286-b346-6c6112cb190c` |
| Milkshake-Twix-LaCabane | `7d75da60-b3e4-4165-82d0-75c3eeefaf41` |
| Milkshake-Speculoos-LaCabane | `9d481493-f5ca-4f87-9e61-96a5f287d5a3` |
| Milkshake-KinderBueno-LaCabane | `f8185445-92a4-45ad-8361-e3a05c62f4db` |
| Milkshake-Snickers-LaCabane | `b23f2a96-e55e-43ee-8604-37c96c59f1f5` |

**Les parfums qui portent un nom de marque se representent par la MATIERE seule** :
morceaux de biscuit, eclats de chocolat, cacahuetes, brisures noires. Aucun
emballage, aucun logo tiers, aucun lettrage. Le seul lettrage autorise dans
l'image est le sticker rond LA CABANE, qui vient de l'element, jamais du modele.

### Ce qui rate quand on demande huit gobelets en une image

Mesure sur cinq generations : **le moteur en produit neuf des que la scene se
charge** — vague, creme, decor. Sur les cinq essais, une seule a rendu huit
gobelets. La parade n'est pas de reformuler : c'est de **compter sur le rendu**
avant de valider, et de garder celle qui compte juste.

Corollaire : quand une generation est bonne mais rognee au bord, on ne la
relance pas — on l'**outpaint** (`outpaint_image`, 5:4). L'image validee est
conservee telle quelle et le moteur ne rajoute que du fond. Relancer, c'est
rejouer la loterie des neuf gobelets.

## La série Maki

| Élément | id |
|---|---|
| Maki-livreur | `9e73f050-9a9c-4c96-8205-63386bb198d2` |
| Famille-Nosy-Be | `fe8e3103-69c5-4945-ae5d-4ea2bf094b37` |
| taxifood-topcase | `c4fcac30-b6d8-4a76-9cdc-8d6081ade6cf` |
| taxifood-sticker | `7b76b4ed-4dcb-4d4d-aca1-fdcd2f17ded9` |
| taxifood-scooter-sr | `f2384e9b-891c-49fe-9aa8-0b5673a1a60c` |

## La recette du packshot

Prouvée sur le Fosa : on part de photos prises sur une table de bar, on obtient un packshot
publicitaire sur fond blanc en 2048 px, sans détourage manuel.

Modèle `gpt_image_2`, 1:1, résolution 2k, qualité medium. Le prompt appelle l'élément, exige de
**recopier** l'étiquette plutôt que de la redessiner, et énumère ce qui doit disparaître : la
table, les autres canettes, l'ordinateur, les mains, les gens.

## Le modèle vidéo

**Wan 3.0**, pas MiniMax H3. MiniMax a échoué deux fois de suite le 10/09 sur des rendus
identiques ; Wan 3.0 a réussi du premier coup, en 1080p vertical, avec image de début et image de
fin. Les deux images se génèrent **en chaîne** — la seconde à partir de la première — sinon le
décor morphe entre les deux.

## Le décor pizza — Chez Bidul & Truc (12/09/2026)

Cinq éléments, pensés pour se recombiner : le four et le plan de travail font le lieu, le
carton, la pizza et la pelle font l'action.

| Élément | id | ce que c'est |
|---|---|---|
| `carton-pizza-taxifood` | `3b215647-d052-4c13-b7d1-2e09f700b0a0` | la photo du vrai carton, kraft vierge |
| `TF-four-a-bois` | `afec4ce8-e57e-481a-911f-8a068635052d` | le four validé, feu à droite |
| `TF-decor-plan-four` | `216cc47e-5a61-4864-b7b2-c2a7ff25cf25` | plan de travail marbre + bouche du four |
| `TF-Pizza-Reine-Bidul` | `e5e17d66-e4e4-4f79-9346-0c5d2c80cc04` | la Reine, fond transparent |
| `TF-pelle-a-pizza` | `9a639ad7-406a-431b-994f-9d462702d401` | la pelle, fond transparent |

## Le piège des `<<<élément>>>` — corrigé le 12/09/2026

La documentation dit d'écrire `<<<id-de-l-élément>>>` dans le prompt, le serveur étant censé
y substituer l'image. **Il ne le fait pas sur cette route.** La réponse de Higgsfield le prouve :

```
"prompt": "... inside the pizzeria <<<216cc47e-5a61-...>>> ..."
"aspect_ratio": "9:16"          <-- aucun champ reference_images
```

Le modèle reçoit les UUID comme du texte brut et fabrique un décor de son invention à partir
de la description écrite autour. C'est ce qui a produit un four industriel là où on avait
validé un four à coupole, et un carton sans couvercle.

**La règle : on passe les éléments en `medias` / `image_references`, jamais en placeholder.**
Et on vérifie, dans la réponse du serveur, que `reference_images` est bien rempli avant
d'attendre quoi que ce soit du résultat. Un prompt qui part sans ses images ne rate pas
bruyamment : il rend une belle image du mauvais sujet.

## Étendre plutôt que régénérer

Pour passer le four validé du 16:9 au 9:16, `outpaint_image` coûte **2 crédits** et garde les
pixels d'origine — le modèle n'invente que ce qu'il ajoute. Ici il a prolongé la sole en terre
cuite du four vers l'avant : le plan de travail est harmonieux parce qu'il sort littéralement
du four, ce qu'aucune génération séparée n'obtenait.

Mesure de contrôle : écart moyen de **6/255** entre la plaque validée et le rendu final sur la
zone du four. Une régénération donnait 30 à 90.

## Le fond transparent se génère, il ne se découpe pas

`seedream_v5_pro` avec `remove_bg: true` sort directement la pizza détourée, sans ardoise ni
assiette. Le détourage a posteriori (`remove_background` sur la photo) gardait le support noir
sous la croûte et demandait une reprise au masque.

## Les trois plats du jour — Chez Bidul & Truc (15/09/2026)

Générés dans le style de sa carte (ardoise ou bol noir, fond quasi noir, lueur radiale), puis
déposés dans `produits/chez-bidul-truc/` et pointés par `products.photo_url`.

| Élément | id | ce que c'est |
|---|---|---|
| `TF-Poulet-Basquaise-Bidul` | `d9fa4fc8-81ae-49a1-81d9-04b054d7f29e` | cuisse + pilon sur ardoise ronde, lanières de poivron |
| `TF-Blanquette-Poisson-Bidul` | `23bfc5ec-e382-43ae-bba7-df63dd0d4d03` | bol noir, légumes identifiables un par un |
| `TF-Tartare-Zebu-Bidul` | `acc6560e-faf5-479b-be37-518960214dc8` | dôme haut sur ardoise, jaune d'œuf en demi-coquille |

**Un doublon à supprimer à la main :** `TF-Tartare-Zebu-Bidul-1`
(`1bfdb5e5-1b49-4cbc-97fd-9af0cf9d5de6`). La création avait renvoyé un 502 de la passerelle
alors que le serveur l'avait déjà enregistrée ; la reprise en a donc créé une seconde. L'API
Elements n'expose pas de suppression — **relire la liste avant de rejouer une création qui a
échoué sur un 5xx**, l'échec peut être seulement celui de la réponse.

### Ce qui sépare un plat de son voisin

Chaque description porte le signe qui empêche la confusion avec un plat déjà à la carte, parce
que le modèle, laissé libre, converge vers le plat le plus banal du lot :

- **Tartare de zébu** — un **volume** : dôme haut, jaune d'œuf en demi-coquille au sommet.
  À plat en tranches, c'est le *Carpaccio de zébu*, qui existe déjà.
- **Blanquette de poisson** — les **légumes sortent de la sauce** et se comptent : carotte
  orange, champignon brun, oignon blanc. Sans eux, c'est l'*Émincé de poulet estragon*.
- **Poulet basquaise** — les **lanières larges de poivron** rouge et vert, jamais fondues.

### La règle de contenant, mesurée sur la carte existante

Chez Bidul, **ce qui a du liquide va dans le bol noir, ce qui se dresse va sur l'ardoise.**
Elle n'est écrite nulle part : elle se lit sur les photos déjà en ligne. La blanquette part
donc au bol, la basquaise et le tartare à l'ardoise.
