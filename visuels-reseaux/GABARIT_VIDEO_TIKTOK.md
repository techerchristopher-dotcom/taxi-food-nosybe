# Gabarit vidéo TikTok — Taxi Food

**Une structure unique, pour toutes les vidéos produit.** Seuls changent le plat, son geste,
le prix et le restaurant. Comme pour les visuels : la série est une boîte, pas une
improvisation.

Validé le 2026-09-11. Test de référence : **l'Oriental, Chez Bidul & Truc, 31 000 Ar**
(`produits/chez-bidul-truc/pizza-oriental.png`).

---

## 1. Le format de sortie

| | |
|---|---|
| Résolution | **1080 × 1920** (9:16) |
| Durée | **13 s** en production · 11 s pour le test sans main |
| Images/s | 30 |
| Codec | H.264, AAC, `.mp4` |
| Son | **audio natif du modèle**, ASMR. Aucune musique ajoutée. |

---

## 2. La zone sûre TikTok — la contrainte qui commande la mise en page

L'interface recouvre les bords. Ce qui est dessous n'est pas « un peu caché », il est illisible.

| Bord | Recouvert par | Marge |
|---|---|---|
| Haut | recherche, LIVE, onglets | **200 px** |
| Bas | pseudo, légende, hashtags, bandeau son | **334 px** |
| Droite | avatar, cœur, commentaire, partage | **140 px** |
| Gauche | marge d'écran | **86 px** |

**Rectangle sûr : x 86 → 940, y 200 → 1586.**

C'est l'erreur commise sur la couverture Facebook, où la photo de profil recouvrait le
lettrage du top-case. Ici la sanction serait pire : **la légende TikTok tomberait sur le prix.**

Règle : **l'image déborde jusqu'aux bords, le contenu jamais.**

---

## 3. La mise en page — trois bandes

C'est `SERIE_TIKTOK` dans `gabarit.py` — troisième série, même logique que les deux autres :
**une boîte, pas une largeur.** Valeurs mesurées, pas estimées.

| Bande | y | Contenu |
|---|---|---|
| **Scène** | 0 → 880 | Le plat. Déborde en haut ; rien d'essentiel au-dessus de y = 200. |
| **Filet or** | 880 → 888 | 8 px, `#FFC72C`. |
| **Bande rouge** | 888 → 1920 | `#E8342A`, déborde jusqu'en bas, **mais le contenu s'arrête à 1586**. |

Boîte du plat : `larg=700, haut=760, cx=540, bas=900`. La contrainte vient **du haut** : avec
`bas=900`, une hauteur de 700 pose le sommet à y = 202. Deux pixels de marge sur la zone sûre —
c'est ce qui dimensionne la série, et c'est vérifié à chaque rendu.

Boîte de contenu : **x 86 → 940**. Le `PAD_H = 62` de la charte image ne s'applique pas : la
colonne de boutons TikTok mange 140 px à droite.

Trois écarts assumés avec le carré :

- **Pas de QR.** Le spectateur tient déjà le téléphone, il ne peut pas le scanner avec
  lui-même. Sa place va au prix.
- **L'URL est promue** — 28 px, blanc, gras, à côté des badges stores. Sur TikTok aucun lien
  n'est cliquable : `taxifoodnosybe.distripro207.com` est la **seule** porte d'entrée. On la
  tape, on arrive sur le site, on télécharge de là.
- **Le badge fait 310 px** au lieu de 184. Le geste commercial se lit avant le texte.

La bande est **une seule colonne qui coule**. Deux blocs posés indépendamment en absolu
finissent toujours par se rencontrer : la ligne du restaurant avait déjà disparu sous le bloc
promo dès que la composition passait à deux lignes.

---

## 4. Le pivot : le plat ne bouge pas

**L'image de fin donnée au modèle n'est pas la photo produit : c'est la carte finale sans son
texte** — le plat déjà posé à sa place définitive, sur le fond de la carte.

La dernière image du clip **est** donc la première image de la carte. Il n'y a rien à
raccorder : le décor change, le texte arrive, le plat ne bouge pas d'un pixel. La transition
n'est pas réussie, elle est supprimée.

---

## 5. La carte est une SURIMPRESSION, pas une suite

Elle arrive **par-dessus la vidéo qui tourne encore**. C'est ce qui permet à la main d'entrer
après le prix sans payer un second clip.

---

## 6. Le déroulé

| Temps | Ce qui se passe |
|---|---|
| **0 → 3,5 s** | Très gros plan, légère rotation. Caméra **basse, regardant vers le haut**. Contre-jour sur la vapeur. Profondeur de champ très courte. Son : grésillement, croûte. |
| **3,5 → 5,5 s** | **Le geste sonore**, propre à la pizza (table §7). Son : l'étirement, la coulée. |
| **5,5 → 8 s** | La caméra recule. Le plat se pose exactement dans le cadre de la carte. |
| **8 → 8,4 s** | La bande rouge monte du bas, le filet or avec elle. |
| **8,4 → 9,0 s** | La pastille du restaurant se pose, le badge −50 % tombe. |
| **9,0 → 10,0 s** | Le titre, puis le prix, puis le bloc promo — dans cet ordre, jamais ensemble. |
| **10,0 → 11,0 s** | **La main entre par le bas-droite et emporte une part.** Le prix est lu depuis une seconde. |
| **11,0 → 13 s** | On tient. Le son ASMR continue sous la carte, en retrait. |

**La main : à moitié hors cadre, toujours.** Des doigts et un bout de paume, entrant par le
bas-droite, en mouvement — le flou couvre les défauts. Jamais une main entière, jamais un
visage. C'est le pire échec des modèles vidéo et elle arrive juste après le prix.

---

## 7. Un geste par pizza

Dicté par la garniture. C'est ce qui évite de tourner quatre fois le même film.

| Pizza | Prix | Le geste sonore |
|---|---|---|
| **4 Fromages** | 32 000 Ar | le fromage qui s'étire |
| **Oriental** | 31 000 Ar | le jaune d'œuf qui se perce et coule sur la merguez |
| **Gargantua** | 35 000 Ar | la rotation chargée, la croûte qui craque sous la pression |
| **Océane** | 29 000 Ar | la vapeur marine, les crevettes luisantes |

---

## 8. Qui fabrique quoi, et à quel prix

| Élément | Origine | Coût |
|---|---|---|
| Le clip | Seedance 2.0 Mini, 9:16, **720 × 1280**, audio natif | 20 cr (8 s) · ~25 cr (10 s) |
| L'image de fin | **composée**, pas générée | 0 |
| La carte | gabarit HTML, rendu à 1080 × 1920 | 0 |
| Le montage | ffmpeg | 0 |

**Le clip est en 720p et c'est assumé.** Le 1080p natif coûte 45 cr — 3,6 fois plus. **La carte
est rendue nativement en 1080 × 1920** : la définition se voit sur le texte, jamais sur une
garniture. **L'audio natif ne coûte rien de plus.**

**Aucun texte n'est généré par le modèle.** Tout le lettrage vient du gabarit HTML — mêmes
couleurs, mêmes mesures, même badge que les visuels réseaux.

---

## 9. Les contrôles automatiques

La conformité se mesure, elle ne s'apprécie pas.

`rendre_tiktok.py` refuse de dire CONFORME sans ces quatre-là, à chaque rendu de carte :

1. **Le contenu tient dans la zone sûre** — la boîte réelle de la colonne, lue dans le DOM,
   dans x 86 → 940 et au-dessus de y = 1586. Pas la boîte théorique : un texte qui passe à
   deux lignes déplace tout ce qui est dessous.
2. **Le plat ne monte pas au-dessus de y = 200**, sinon il passe sous la barre de recherche.
3. **≥ 20 px d'air entre la croûte et la pastille**, mesurés sur l'alpha du PNG détouré. Un
   cercle équivalent se trompe de 100 px dès que le plat n'est pas rond.
4. **Cadre exactement 1080 × 1920.**

État mesuré sur l'Oriental : gauche 86/86 · droite 940/940 · bas 1579/1586 · sommet du plat
201,9 · air pastille 76,9. **CONFORME.**

Et deux contrôles propres au montage, à la sortie de la vidéo :

5. **Le plat n'a pas bougé** entre la dernière image du clip et la première de la carte.
   **Tolérance 12 px.** Au-delà, le clip est rejeté.
6. **Format exact** : 1080 × 1920, 30 i/s, durée ± 0,2 s.

---

## 10. Le test : une seule nouveauté à la fois

Le premier clip se fait **sur l'Oriental, sans main, en 8 s**. On valide le pivot seul. La main
arrive sur la deuxième vidéo.

Deux nouveautés dans le même essai, et un échec ne dit pas laquelle a échoué.

Si le plat dérive de plus de 12 px, plan B : on gèle la dernière image du clip et on fond vers
la carte. Moins beau, mais sûr.

---

## 11. Ce qui reste ouvert

- **Le compte TikTok** reste à créer. Le connecteur « tiktok » actif côté Higgsfield depuis le
  6 août pointe ailleurs — à vérifier avant toute publication.
- **L'image de fin** doit être composée avant le test. Elle exige la photo du bucket, que ma
  session ne peut plus télécharger : à faire dans le bac à sable Higgsfield, qui a internet.
