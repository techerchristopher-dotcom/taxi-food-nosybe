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
