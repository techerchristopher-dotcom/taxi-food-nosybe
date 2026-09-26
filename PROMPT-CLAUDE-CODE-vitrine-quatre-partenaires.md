# Mettre le site vitrine à jour : quatre partenaires, pas un

## Le problème, en une ligne

`landing/index.html` annonce **« Les restos qui bossent déjà avec nous »** et ne montre que
**La Cabane** (plus Angelo, en négociation). Chez Bidul & Truc, La Plage et Chez M&K sont en
ligne et commandables depuis des semaines, et n'y figurent pas. Les posts Facebook renvoient
sur cette page : un client clique, ne trouve pas le restaurant annoncé, et repart.

Le bloc est **du HTML statique écrit à la main**, il n'est alimenté par aucune requête. Il
faut donc y ajouter trois cartes, et les assets qui vont avec, dans les **trois langues**.

## État vérifié en base le 22/09/2026

```
name                 listing_status  is_open  auto_open  zone_served
La Cabane            visible         true     true       Ambatoloaka
Chez Bidul & Truc    visible         true     true       Dar es Salam
La Plage             visible         true     true       Nosy Be      (afficher « Hell-Ville »)
Chez M&K             visible         true     true       Djabala Honko
```

`zone_served` de La Plage dit encore « Nosy Be » — c'est une correction en attente depuis son
lancement. Sur le site, afficher **HELL-VILLE**, qui est son enseigne.

---

## 1. Les fichiers à modifier

| Fichier | Ce qu'il contient |
|---|---|
| `landing/index.html` | le bloc `<div id="partenaires">`, ligne ~484 |
| `landing/en/index.html` | même bloc, mêmes lignes, textes en anglais |
| `landing/it/index.html` | même bloc, mêmes lignes, textes en italien |
| `landing/restaurants-partenaires/index.html` | 16 occurrences de noms de restos — **relire et corriger si la liste y est reprise** |
| `landing/en/restaurant-partners/index.html` | idem |
| `landing/it/ristoranti-partner/index.html` | idem |

Les trois `index.html` sont structurellement identiques **à la ligne près** : seuls les textes
changent. Ne pas reformater, ne pas réindenter, ne pas passer un prettier dessus — le fichier
est en styles inline sur une ligne par élément, garder exactement cette forme.

**Ne pas toucher** au bloc « Passe une commande, pour de vrai » (~ligne 604) : son simulateur
utilise des captures d'écran de La Cabane, c'est voulu.

---

## 2. L'ordre des cartes

```
1. La Cabane            (existe déjà, ne pas la toucher)
2. Chez Bidul & Truc    ← à ajouter
3. La Plage             ← à ajouter
4. Chez M&K             ← à ajouter, avec une pastille NOUVEAU en plus
5. Angelo               (existe déjà, la DÉPLACER en dernier)
```

C'est l'ordre `rang_catalogue` de la base (10, 20, 60, 80), avec le seul non-partenaire à la
fin. Aujourd'hui Angelo est en 2ᵉ position, juste après La Cabane : déplacer son `<div>` sans
en modifier le contenu.

---

## 3. Le gabarit d'une carte

Copier **exactement** la structure de la carte La Cabane (lignes ~486 à ~524 de
`landing/index.html`). Elle se compose de :

1. le `<div>` conteneur — `flex:1 1 300px;min-width:min(260px,100%);background:#fff;border-radius:20px;padding:22px;box-shadow:0 2px 8px rgba(26,26,26,.06);border:1px solid #E9E5E0;display:flex;flex-direction:column;gap:14px`
2. l'en-tête : `<img>` du logo 56 × 56 (`srcset` 64w / 128w) + la zone en mono capitales + le nom en Archivo 800/20px
3. la pastille d'état
4. le `<p>` de description
5. le ruban de plats qui défile : un conteneur masqué en dégradé, puis `<div style="display:flex;gap:10px;width:max-content;animation:menuScroll 42s linear infinite">` contenant **les 12 plats, puis les mêmes 12 en double** avec `alt=""` et `aria-hidden="true"` — c'est ce doublon qui rend la boucle continue.

### Les pastilles

```html
<!-- déjà partenaire -->
<div style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:999px;background:#E7F6EC;color:#157F3C;font:700 11px/1 Archivo,sans-serif;letter-spacing:.04em">DÉJÀ DANS L'AVENTURE ✅</div>

<!-- Chez M&K seulement : une SECONDE pastille, juste après la verte -->
<div style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:999px;background:#FFC72C;color:#1A1A1A;font:700 11px/1 Archivo,sans-serif;letter-spacing:.04em">NOUVEAU</div>
```

Les deux pastilles de M&K doivent être **sur la même ligne** : les envelopper dans
`<div style="display:flex;gap:8px;align-self:flex-start;flex-wrap:wrap">` et retirer
`align-self:flex-start` de chacune.

---

## 4. Le contenu des trois cartes

### Chez Bidul & Truc

- logo : `/img/logo/chez-bidul-truc-64.webp` + `-128.webp`
- zone : `DAR ES SALAM`
- nom : `Chez Bidul & Truc` (échapper l'esperluette : `Chez Bidul &amp; Truc`)
- FR : `Pizzas au feu de bois, brasero et poissons — la grande table de Dar es Salam.`
- EN : `Wood-fired pizzas, grilled meats and fresh fish — the big table in Dar es Salam.`
- IT : `Pizze al forno a legna, griglia e pesce fresco — la grande tavola di Dar es Salam.`

| # | `alt` (FR) | fichier local (sans suffixe) | source Supabase (bucket `produits`) |
|---|---|---|---|
| 1 | Langouste grillée Chez Bidul & Truc | `bidul-langouste-grillee` | `chez-bidul-truc/brasero-langouste-grillee.jpg` |
| 2 | Pizza Gargantua Chez Bidul & Truc | `bidul-pizza-gargantua` | `chez-bidul-truc/pizza-gargantua.png` |
| 3 | Côte de zébu Chez Bidul & Truc | `bidul-cote-de-zebu` | `chez-bidul-truc/brasero-cote-de-zebu-extra-maturee.jpg` |
| 4 | Marmite du pêcheur Chez Bidul & Truc | `bidul-marmite-du-pecheur` | `chez-bidul-truc/plat-marmite-du-pecheur.png` |
| 5 | Pizza 4 fromages Chez Bidul & Truc | `bidul-pizza-4-fromages` | `chez-bidul-truc/pizza-4-fromages.png` |
| 6 | Magret de canard Chez Bidul & Truc | `bidul-magret-de-canard` | `chez-bidul-truc/brasero-magret-de-canard.jpg` |
| 7 | Foie gras poêlé Chez Bidul & Truc | `bidul-foie-gras-poele` | `chez-bidul-truc/entree-foie-gras-poele.png` |
| 8 | Pâtes fruits de mer Chez Bidul & Truc | `bidul-pates-fruit-de-mer` | `chez-bidul-truc/pates-pates-fruit-de-mer.png` |
| 9 | Burger Le Patron Chez Bidul & Truc | `bidul-burger-le-patron` | `chez-bidul-truc/hamburger-le-patron.png` |
| 10 | Carpaccio de zébu Chez Bidul & Truc | `bidul-carpaccio-de-zebu` | `chez-bidul-truc/entree-carpaccio-de-zebu.png` |
| 11 | Brochette de filet mignon Chez Bidul & Truc | `bidul-brochette-filet-mignon` | `chez-bidul-truc/brasero-brochette-de-filet-mignon.jpg` |
| 12 | Banane flambée Chez Bidul & Truc | `bidul-banane-flambee` | `chez-bidul-truc/dessert-banane-flambee.png` |

### La Plage

- logo : `/img/logo/la-plage-64.webp` + `-128.webp`
- zone : `HELL-VILLE`
- nom : `La Plage`
- FR : `Grillades au feu de bois, romazava et poissons frais — La Plage, face à la mer.`
- EN : `Wood-fired grills, romazava and fresh fish — La Plage, facing the sea.`
- IT : `Griglie a legna, romazava e pesce fresco — La Plage, di fronte al mare.`

| # | `alt` (FR) | fichier local | source Supabase |
|---|---|---|---|
| 1 | Côtes de zébu grillées La Plage | `laplage-cotes-de-zebu` | `la-plage/grillade-cotes-de-zebu-reel.jpg` |
| 2 | Poulet citronné La Plage | `laplage-poulet-citronne` | `la-plage/plat-poulet-citronne-reel.jpg` |
| 3 | Romazava viande La Plage | `laplage-romazava-viande` | `la-plage/plat-romazava-viande.png` |
| 4 | Brochettes de filet de zébu La Plage | `laplage-brochettes-filet-zebu` | `la-plage/grillade-brochettes-filet-de-zebu-reel.jpg` |
| 5 | Poulet façon KFC La Plage | `laplage-poulet-facon-kfc` | `la-plage/plat-poulet-facon-kfc-reel.jpg` |
| 6 | Tartare de poisson La Plage | `laplage-tartare-de-poisson` | `la-plage/entree-tartare-de-poisson-reel.jpg` |
| 7 | Bol renversé La Plage | `laplage-bol-renverse` | `la-plage/plat-bol-renverse.png` |
| 8 | Brochettes de crevettes La Plage | `laplage-brochettes-crevettes` | `la-plage/grillade-brochettes-crevettes.png` |
| 9 | Rouleaux de printemps La Plage | `laplage-rouleaux-de-printemps` | `la-plage/entree-rouleaux-de-printemps-reel.jpg` |
| 10 | Poisson coco La Plage | `laplage-poisson-coco` | `la-plage/plat-poisson-coco.png` |
| 11 | Assiette de poisson fumé La Plage | `laplage-poisson-fume` | `la-plage/entree-assiette-de-poisson-fume-reel.jpg` |
| 12 | Ananas flambé La Plage | `laplage-ananas-flambe` | `la-plage/dessert-ananas-banane-flambee.png` |

### Chez M&K

- logo : `/img/logo/chez-m-et-k-64.webp` + `-128.webp`
- zone : `DJABALA HONKO`
- nom : `Chez M&K` (`Chez M&amp;K`)
- FR : `Bols renversés, ti pan à la plancha et ribs laqués — le chinois de Djabala Honko.`
- EN : `Upside-down rice bowls, sizzling-plate ti pan and glazed ribs — the Chinese kitchen in Djabala Honko.`
- IT : `Bol renversé, ti pan alla piastra e ribs laccate — il cinese di Djabala Honko.`

| # | `alt` (FR) | fichier local | source Supabase |
|---|---|---|---|
| 1 | Bol renversé Chez M&K | `mk-bol-renverse` | `chez-m-et-k/22-bol-renverse-boeuf-poulet-ou-porc.jpg` |
| 2 | Magret de canard Chez M&K | `mk-magret-de-canard` | `chez-m-et-k/06-magret-de-canard-sauce-poivre-vert.jpg` |
| 3 | Ribs laqué Chez M&K | `mk-ribs-laque` | `chez-m-et-k/12-ribs-laque.jpg` |
| 4 | Assiette de tsa siou Chez M&K | `mk-tsa-siou` | `chez-m-et-k/25-assiette-de-tsa-siou.jpg` |
| 5 | Van tan frit Chez M&K | `mk-van-tan-frit` | `chez-m-et-k/18-van-tan-frit.jpg` |
| 6 | Rouleaux de printemps aux crevettes Chez M&K | `mk-rouleaux-de-printemps` | `chez-m-et-k/16-rouleaux-de-printemps-aux-crevettes.jpg` |
| 7 | Ti pan porc Chez M&K | `mk-ti-pan-porc` | `chez-m-et-k/07-ti-pan-porc.jpg` |
| 8 | Riz cantonais Chez M&K | `mk-riz-cantonais` | `chez-m-et-k/08-riz-cantonais.jpg` |
| 9 | Nems Chez M&K | `mk-nems` | `chez-m-et-k/04-nem-porc-poulet-ou-zebu.jpg` |
| 10 | Pâtes fraîches épicées aux crevettes Chez M&K | `mk-pates-fraiches-crevettes` | `chez-m-et-k/05-pates-fraiches-epicees-aux-crevettes.jpg` |
| 11 | Crevettes sautées aux pousses de maïs Chez M&K | `mk-crevettes-sautees` | `chez-m-et-k/10-crevettes-sautees-pousses-de-mais.jpg` |
| 12 | Soupe spéciale MK Chez M&K | `mk-soupe-speciale` | `chez-m-et-k/13-soupe-speciale-mk.jpg` |

**Les `alt` sont à traduire** dans `en/` et `it/`, comme c'est déjà le cas pour La Cabane
(`alt="Kebab La Cabane"` en FR devient `alt="La Cabane kebab"` en EN).

**Pourquoi les fichiers locaux sont préfixés** (`bidul-`, `laplage-`, `mk-`) alors que ceux de
La Cabane ne le sont pas : « magret de canard » existe chez Bidul ET chez M&K, « bol renversé »
chez La Plage ET chez M&K. Sans préfixe, deux plats différents écrasent le même fichier. Ne pas
renommer les fichiers existants de La Cabane pour autant — ce serait un changement gratuit sur
un HTML qui marche.

---

## 5. Générer les assets

Tous les fichiers vont dans `landing/img/logo/` et `landing/img/produits/`, au format **webp**,
**carrés**, recadrés au centre.

- logos : `<slug>-64.webp` (64 × 64) et `<slug>-128.webp` (128 × 128)
- plats : `<slug>-128.webp` (128 × 128) et `<slug>-256.webp` (256 × 256)

Les logos se téléchargent depuis `restaurants.logo_url` :

```
Chez Bidul & Truc  produits/chez-bidul-truc/divers/logo.jpeg
La Plage           produits/la-plage/divers/logo.jpeg
Chez M&K           produits/chez-m-et-k/divers/logo.png
```

Préfixe commun : `https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/`

Script suggéré (Pillow, aucune clé nécessaire, les buckets sont publics en lecture) :

```python
import io, urllib.request
from PIL import Image

BASE = "https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/"

def carre(im, n):
    # recadrage centré au plus grand carré, puis LANCZOS. Pas de déformation.
    c = min(im.size)
    g, h = (im.width - c) // 2, (im.height - c) // 2
    return im.crop((g, h, g + c, h + c)).resize((n, n), Image.LANCZOS)

def produire(source, slug, dossier, tailles):
    b = urllib.request.urlopen(BASE + source).read()
    im = Image.open(io.BytesIO(b)).convert("RGB")   # RGB : le webp du site est opaque
    for n in tailles:
        carre(im, n).save(f"landing/img/{dossier}/{slug}-{n}.webp",
                          "WEBP", quality=82, method=6)
```

`quality=82, method=6` : c'est le réglage qui donne des fichiers du même ordre que les webp
existants de La Cabane. **Vérifier** après génération que les nouveaux `-128.webp` pèsent dans
la même fourchette que `landing/img/produits/kebab-128.webp` ; un écart d'un facteur 3 veut
dire que le réglage est à revoir, pas que « ça passe quand même ».

⚠️ Le logo de Chez M&K est un **PNG 2000 × 2000 avec transparence**, un disque doré sur fond
braise très sombre. Le `convert("RGB")` aplatit la transparence sur du **noir**, ce qui est
exactement ce qu'il faut ici — le disque du logo est déjà cerné de braise. Mais la carte le
pose en `border-radius:15px` : vérifier à l'œil que le disque ne se retrouve pas rogné dans un
carré à coins arrondis. Si c'est laid, aplatir sur `#0A0705` plutôt que sur noir pur, et
ajouter 6 % de marge autour du disque avant la réduction.

---

## 6. Les contrôles à passer avant de considérer que c'est fini

Ne rien déclarer terminé sans avoir fait tourner ces sept vérifications.

1. **Tous les `src` et `srcset` pointent sur un fichier qui existe.** Extraire chaque chemin
   `/img/...` des trois `index.html` et vérifier la présence sur le disque. Zéro manquant.
2. **Les trois langues ont le même nombre de cartes** dans `#partenaires` : 5. Et dans le même
   ordre.
3. **Le ruban a bien 24 images par carte** (12 + 12 doublons), et les 12 derniers portent
   `alt=""` et `aria-hidden="true"`.
4. **Aucun `&` nu** dans le HTML ajouté : `Chez Bidul &amp; Truc`, `Chez M&amp;K`. Passer le
   fichier dans un parseur HTML et vérifier qu'il ne remonte aucune erreur nouvelle.
5. **Poids de la page.** Mesurer le total des assets `#partenaires` avant / après. On passe de
   12 à 48 vignettes : si le total dépasse ~600 Ko, baisser `quality` à 75 et remesurer. Les
   images sont déjà en `loading="lazy"`, ne pas l'enlever.
6. **Rendu réel à trois largeurs** — 390 px, 768 px, 1440 px. Capture d'écran du bloc
   `#partenaires` à chaque largeur. Ce qu'on regarde : les cartes ne se chevauchent pas, les
   noms ne débordent pas (« Chez Bidul & Truc » est le plus long), les deux pastilles de M&K
   tiennent sur une ligne ou passent proprement à la ligne, et les rubans défilent.
7. **Les liens des posts Facebook aboutissent.** Ouvrir `https://taxifoodnosybe.distripro207.com/`
   après déploiement et confirmer que les quatre restaurants y sont nommés. C'est le but de
   toute l'opération.

---

## 7. Pendant que tu y es — deux choses hors périmètre, à signaler et non à faire

- `restaurants.zone_served` de La Plage vaut `Nosy Be` au lieu de `Hell-Ville`. Correction en
  base, pas sur le site. Ne pas la faire dans cette tâche, juste la rappeler.
- 4 produits de Chez M&K sont `listing_status = 'visible'` **sans photo** : Bol renversé fruits
  de mer (40 000), Coca petit modèle, Sprite petit modèle, bière en canette. Ils n'entrent pas
  dans les rubans, mais ils sont visibles dans l'appli.

## 8. Commit

Un seul commit, message :

```
Site vitrine : les quatre partenaires, plus seulement La Cabane

La page annoncait « les restos qui bossent deja avec nous » et n'en montrait
qu'un. Chez Bidul & Truc, La Plage et Chez M&K sont commandables depuis des
semaines : les posts Facebook renvoyaient sur une page qui ne les nommait pas.

Trois cartes ajoutees dans les trois langues, Angelo repasse en dernier
(seul non-partenaire), 72 vignettes webp generees depuis le bucket produits.
```
