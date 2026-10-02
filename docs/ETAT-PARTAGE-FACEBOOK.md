# État du partage Facebook — point de départ de toute session

> **Rotation, en une ligne (au 2026-10-02)** : rien n'est parti depuis le **29/09 à 22:00**
> (« Le coin sera Malagasy », `coinmalagasy`, programmé via Meta Business Suite —
> `PARTAGE-FACEBOOK-GROUPES.md` l. 600). Côté **profil**, la dernière session est celle du 28/09,
> qui s'arrête sur « Bizness Tout Sur Nosy Be » : **« Reprendre la rotation après « Bizness Tout
> Sur Nosy Be » »** (l. 540). Confirmé par la base : la dernière visite étiquetée date du
> 29/09 22:00 (`visites_partage`).

Établi le 2026-10-02 **en lecture seule** : `docs/PARTAGE-FACEBOOK-GROUPES.md` (« la procédure »),
`docs/agents/agent3-partage-groupes.md` (« le mode d'emploi »), `visuels-reseaux/
MESSAGES-ANNONCE-LA-PLAGE.md`, `visuels-reseaux/CHARTE_LANCEMENT_RESTAURANT.md`,
`landing/netlify/functions/partage.mjs`, `landing/js/mesure.js`, `git log` de ces fichiers, et les
tables `visites_partage` / `orders.etiquette_partage`. **Les chiffres de la base priment sur le
texte** : quand la procédure et la base se contredisent, c'est écrit.

---

## 1. Ce que disent les chiffres, en trois lignes

- **41 étiquettes ont produit au moins une ouverture**, 194 ouvertures au total
  (`grandmarche` 15, `sejour` 12, `bizness` 11, `venteenligne` 11 en tête).
- **3 passages vers l'application en tout** : `amici` 2, `business207` 1. Tous les autres : 0.
- **Aucune commande n'a jamais été attribuée à un groupe** (`orders.etiquette_partage` vide).
  Le critère de tri du § 7 de la procédure (« zéro vers l'app sur la semaine → sort de la
  rotation ») éliminerait aujourd'hui **tous les groupes sauf deux**.

## 2. La liste de travail, à jour

Voie : **P** = profil de Christopher (composeur du groupe) · **MBS** = Meta Business Suite, au nom
de la page. Ouvertures = `visites_partage`, toutes pages confondues, au 2026-10-02.

| # | Groupe | Membres | Slug | Dernière publication | Voie | Ouv. | État |
|---|---|---|---|---|---|---|---|
| 1 | Business Nosy-Be (Hell Ville 207) | 39 700 | `business207` | 28/09 | P | 3 (+1 app) | mesuré |
| 2 | TANY ALAFO SY TRANO AFONDRO… 207 | 25 400 | `tanyalafo` | 26/09 | P | 6 | mesuré |
| 3 | Zanaka nosy be mila tragno | 25 200 | `zanaka` | 28/09 | P | 7 | mesuré |
| 4 | INO VAOVAO NOSY BE HELL-VILLE | 21 600 | `inovaovao` | 28/09 | P | 6 | mesuré |
| 5 | AMBIANCE À NOSY BE | 20 700 | `ambiance` | 26/09 | P | **0** | publié marqué, zéro ouverture |
| 6 | NOSY-BE Petit Paris | 16 300 | `petitparis` | 26/09 | P | 6 | mesuré — **modère, mais a paru** (voir § 3) |
| 7 | TRAGNO AFONDRO ETO NOSY BE HELLE VILLE | 15 025 | `tragnoafondro` | 29/09 20:15 | MBS | 3 | mesuré |
| 8 | Nosy Bon Coins | 13 251 | `bonscoins` | 26/09 | MBS | **0** | publié marqué, zéro ouverture ; non retrouvé le 29/09 |
| 9 | Bizness nosy be hell ville | 12 385 | `bizness` | 28/09 | P | 11 | mesuré |
| 10 | Nosy be hell Mbizna | 10 100 | `mbizna` | 28/09 | P | 5 | mesuré |
| 11 | Le grand marché de nosy-be | 8 447 | `grandmarche` | 28/09 | P | 15 | mesuré |
| 12 | NosyBe Bonnes Affaires | 7 632 | `bonnesaffaires` | 29/09 21:30 | P puis MBS | 2 | mesuré |
| 13 | Séjour Nosybe et Nord Madagascar | 5 500 | `sejour` | 28/09 | P | 12 | mesuré |
| 14 | MADAGASCAR TOURIST INFO | 4 216 | `touristinfo` | 26/09 | MBS | 1 | mesuré ; non retrouvé le 29/09 |
| 15 | Amici italiani 🇮🇹🇲🇬 (Nosy be) | 3 132 | `amici` | 28/09 | P | 8 (+2 app) | mesuré — **le meilleur à ce jour** |
| 16 | BAZAR BE NOSY BE | 2 200 | `bazarbe` | 28/09 | P | 1 | mesuré |
| 17 | Have you been Nosy Be? | 725 | `haveyoubeen` | 28/09 | P | 9 | mesuré |
| 18 | Nosy be hell ville M bizna | 6 016 | `mbiznaville` | 26/09 | P | 7 | mesuré — **sauté le 28/09 (5 clones, voir § 5)** |
| 19 | NOSY-BE PUB | — | `nosybepub` | 28/09 | P | 6 | mesuré |
| 20 | Nosy be vente en ligne | — | `venteenligne` | 28/09 | P | 11 | mesuré |
| 21 | Nosybe Tsara Business \| Tany alafo & Trano afondro | — | `tsarabusiness` | 28/09 | P | 5 | mesuré |
| 22 | Nosy-Be Plaisirs de vacances | — | `plaisirs` | 28/09 | P | 8 | mesuré |
| 23 | Bizness Tout Sur Nosy Be | — | `toutsur` | 28/09 | P | 7 | mesuré |
| 24 | Le Bon coin Nosy be | 611 ? | `leboncoin` | 26/09 | P | 1 | mesuré |
| 25 | Bon prix Nosy be | 685 ? | `bonprix` | 26/09 | P | 4 | mesuré |
| 26 | NOSY BE HELL-VILLE | — | `hellville` | 26/09 | P | **0** | publié marqué, zéro ouverture |
| 27 | Le BonCoin et Plan de NosyBe | — | `boncoinplan` | 26/09 | P | 7 | mesuré |
| 28 | TOURISME - NOSY BE - MADAGASCAR | — | `tourisme` | 26/09 | P | **0** | **modère sans jamais publier** (3 en attente le 26/09) |
| 29 | Business Madio à Nosy-Be | — | `businessmadio` | 26/09 | P | 4 | mesuré |
| 30 | La Vie à Nosy-Be | — | `lavie` | 26/09 | P | **0** | publié marqué, zéro ouverture |
| 31 | zanaka Nosy be | 1 598 | `zanakanb` | 29/09 21:15 | MBS | 4 | mesuré |
| 32 | Bon Coin de Business à Nosy-Be | 115 | `boncoinbusiness` | 29/09 19:15 | MBS | 5 | mesuré |
| 33 | Le coin sera Malagasy Nosy Maurice sy andafy | 3 638 | `coinmalagasy` | 29/09 22:00 | MBS | 2 | mesuré — **dernier servi** |
| 34 | BON PLAN VACANCES À NOSY BE MADAGASCAR | 15 038 | `bonplanvacances` | 29/09 21:00 | MBS | 2 | mesuré |
| 35 | Bizness nosy be hell | 5 722 | `biznesshell` | — | — | — | **jamais servi** (non retrouvé le 29/09) |
| 36 | Annuaire des professionnels de Nosy Be — Nosy Be PRO | 7 519 | `nosybepro` | 29/09 20:00 | MBS | 4 | mesuré |
| 37 | camping nosy be | 1 027 | `campingnb` | 29/09 19:30 | MBS | 3 | mesuré |
| 38 | Résidence à Nosy be | 934 | `residence` | 29/09 20:45 | MBS | 1 | mesuré |
| 39 | Nosy-be mada découverte | 1 125 | `madadecouverte` | 29/09 21:45 | MBS | 1 | mesuré |
| 40 | 🛍️Coin de la mode à Nosy Be 🛍️👠👗 | 12 211 | `coindelamode` | 29/09 20:30 | MBS | 4 | mesuré |
| 41 | Nosy-be Madagascar | 3 768 | `nosybemada` | 29/09 19:45 | MBS | 4 | mesuré — **slug partagé, voir § 3** |
| 42 | JESOSY MAMONJY Nosy-be Hell ville | 3 789 | `jesosy` | 29/09 19:00 | MBS | 1 | mesuré |
| 43 | Top business Nosy be hell ville | 8 870 | `topbusiness` | 29/09 12:15 | MBS | 2 | mesuré |
| 44 | Annonces Express Nosy-Be | 2 151 | `annoncesexpress` | 29/09 13:31 | MBS | 1 | mesuré |
| 45 | BIZNA SY SERA ETO NOSY BE HELL VILLE (privé) | 11 947 | `biznasera` | 26/09 | MBS | 1 | mesuré — **absent du § 3 ter** |
| 46 | Visit Nosy be Madagascar Island | 6 249 | `visitnosybe` | 26/09 | MBS | 2 | mesuré — **absent du § 3 ter** |
| 47 | Nosy Be Madagascar '' | 4 865 | ~~`nosybemada`~~ → `nosybeisland` | 26/09 | MBS | **0** | publié avec un slug déjà pris — **absent du § 3 ter** |
| 48 | MADAGASCAR TRAVEL with Tour Guide | 4 589 | `madatravel` | 26/09 | MBS | **0** | publié marqué, zéro ouverture — **absent du § 3 ter** |
| 49 | Nosy be business | 4 404 | `nosybebusiness` | 26/09 | MBS | 2 | mesuré — **absent du § 3 ter** ; listé à tort comme « nouveau » le 29/09 (l. 612) |

🚫 Exclu : **Fitadiavana Asa eto Nosy Be** (groupe d'emploi).

**Vus mais jamais servis, sans slug** (journal l. 434-436, 563-567, 611-618) — à qualifier avant
toute publication : Nosy Be , Tiako (5 832-5 865) · bizna nosy be hell ville (18 594 — à ne pas
confondre avec `bizness` / `biznesshell`) · Nosy Be mora tany alafo | trano afondro · G- Zanatany_
Nosy-Be (12 262) · Nosy Be Vente rapide (11 221) · Groupe de vacance à Madagascar/Nosy be
(13 805) · Activités Touristiques Nosy be Madagascar (6 120) · Nosy be bizna (11 412) · Nosy
Bonnes Zaffaires (17 015) · Varotra rehetra eto Nosy Be (5 504) · Nosy Be Occasion (9 342) ·
Business Nosy bé Magnifique (non documenté : membres) · Actualité Nosy Be (non documenté). Et deux noms dont on ne sait
pas s'ils sont des doublons de lignes existantes : « Le Bon Prix De Nosy be hell Ville » (685,
= `bonprix` ?) et « Nosy be Lebon Coin » (611, = `leboncoin` ?).

**Décompte** : **49 groupes avec un slug** — **41 mesurés** (au moins une ouverture), **6 publiés
marqués à zéro ouverture** (`ambiance`, `bonscoins`, `hellville`, `lavie`, `madatravel`,
`nosybeisland`), **1 qui modère sans jamais publier** (`tourisme`), **1 jamais servi**
(`biznesshell`). **0 « partagé sans étiquette »** : les sept groupes de la vague 1 (25/09) ont tous
été republiés marqués le 26/09 (journal l. 402-403). **~15 groupes vus, sans slug, jamais servis.**

## 3. Ce que la procédure dit de faux aujourd'hui

### Slugs en double — « un groupe = un slug » violé quatre fois

| Groupe | Slugs en conflit | Celui qui porte des chiffres | Correction à écrire |
|---|---|---|---|
| Le Bon coin Nosy be | `boncoin` (§ 3 bis l. 183) · `leboncoin` (§ 3 ter l. 112, journal l. 402) | **`leboncoin`** — 1 ouverture le 26/09 ; `boncoin` : 0 | § 3 bis : `boncoin` → `leboncoin` |
| Business Madio à Nosy-Be | `madio` (§ 3 bis l. 188) · `businessmadio` (§ 3 ter l. 117, journal l. 402) | **`businessmadio`** — 4 ouvertures le 26/09 ; `madio` : 0 | § 3 bis : `madio` → `businessmadio` |
| Nosy-be Madagascar (3 768) **et** Nosy Be Madagascar '' (4 865) | `nosybemada` porté par les deux (§ 3 ter l. 129 + journal l. 591 ; journal l. 419) | **Nosy-be Madagascar** — les 4 ouvertures datent toutes du 29/09 19:45-19:59, juste après sa publication ; rien n'a été compté pour la publication du 26/09 | garder `nosybemada` pour « Nosy-be Madagascar » ; donner **`nosybeisland`** à « Nosy Be Madagascar '' ». Les deux noms et tailles diffèrent nettement, mais ce sont peut-être deux noms d'un même groupe : **non documenté**, à vérifier en ouvrant les deux |
| Top business Nosy be hell ville | `topbusinesscowork` **puis** `topbusiness` (§ 3 ter l. 131) | **`topbusiness`** — 2 ouvertures ; `topbusinesscowork` : 0 | § 3 ter : ne garder que `topbusiness` |

### États périmés dans le § 3 ter

- **Lignes 24 à 30 « ⚠️ partagé sans lien marqué »** : faux depuis le 26/09. Les sept ont été
  republiés avec leur lien marqué (journal l. 402-403) et quatre ont des ouvertures. La note du
  28/09 (l. 532-533 « donc toujours sans mesure ») contredit le journal du 26/09 **et** la base.
- **Ligne 6 `petitparis` « modéré, jamais paru »** : 6 ouvertures le 26/09 entre 11:52 et 12:16 —
  au moins une publication est sortie de modération.
- **Lignes 7, 8, 12, 14 « jamais servi »** : servis le 26/09 via MBS (journal l. 414-422) ;
  `tragnoafondro` et `bonnesaffaires` l'ont été une seconde fois le 29/09.
- **Lignes 31 à 44 « jamais servi »** : 13 d'entre elles ont été programmées le 29/09 au soir
  (l. 586-600), y compris `jesosy` (l. 130 parle d'un test bloqué — vrai pour le test co-work,
  mais la publication du soir est partie : 1 ouverture à 19:00).
- **Cinq groupes servis le 26/09 n'ont jamais été ajoutés au § 3 ter** : `biznasera`,
  `visitnosybe`, `madatravel`, `nosybebusiness`, et « Nosy Be Madagascar '' ».
- **Le § 3 bis se dit « la seule liste de slugs »** (l. 193) mais n'en contient que 7, dont 2 faux.
  Proposition : supprimer le tableau du § 3 bis et renvoyer au § 3 ter (ou à ce document).

## 4. Annonce de restaurant — pas les plats du jour

La procédure est écrite pour `/jour`. Une annonce de lancement a **un visuel fabriqué** et un
lien **`/r/<restaurant_id>`**. Réponses, ligne par ligne :

**a) `/r/<id>?g=<slug>` réinjecte-t-il l'étiquette dans `og:url` ? Oui.**
`partage.mjs` l. 654 lit l'étiquette (`const g = etiquetteGroupe(url)`, validée l. 186-190 par
`/^[a-z0-9][a-z0-9-]{0,23}$/`) ; l. 840 la remet dans le lien
(`` lien: `${SITE}/r/${id}${g ? `?g=${g}` : ''}` ``) ; l. 293 l'écrit dans `og:url`. Le canonical
reste sans étiquette (l. 841, émis l. 281). La page charge `mesure.js` (l. 372). Éprouvé en vrai
sur `/p/` les 28 et 29/09 (même code, commit `309c4d2`) ; **jamais encore sur `/r/`** —
non documenté en conditions réelles.

**b) Image JOINTE au post (la vignette du lien disparaît) : l'étiquette du texte est-elle comptée ?
Oui, si le visiteur clique le lien écrit dans le texte.** `mesure.js` ne regarde pas d'où vient le
clic, seulement l'adresse d'arrivée : l. 132 lit `g` dans l'URL (`q.get('g')`), l. 135 le mémorise
pour l'onglet, **l. 283 compte l'ouverture** (`compter('ouverture', groupeDansUrl)`), seulement
sur le domaine de production (l. 41, l. 61). `og:url` ne joue aucun rôle ici : il ne sert qu'à la
carte d'aperçu, absente quand une image est jointe. **Limite** : seuls les clics sur le lien
écrit comptent — un clic sur l'image ouvre l'image, pas la page. **Jamais éprouvé** (aucune ligne
du journal ne combine image jointe + lien marqué).

**c) PARTAGE natif d'un post de la page dans un groupe, avec un lien marqué collé dans le texte
d'accompagnement : compté ? Mécaniquement oui, en pratique presque rien.** La carte partagée est le
post de la page : son lien (et tous les clics sur sa carte) n'ont **pas** d'étiquette — la
procédure le dit l. 217-220, et c'est ce qui a rendu la vague 1 du 25/09 non mesurable. Un lien
`/r/<id>?g=<slug>` tapé dans le texte d'accompagnement serait compté s'il est cliqué (mêmes lignes
qu'en b), **mais** : (1) la grande carte du post partagé capte l'attention et ses clics ne sont pas
comptés ; (2) ce chemin n'a **jamais été testé** — non documenté. **Décision qui en découle** :
pour une annonce de restaurant, **on publie DANS le groupe** (composeur du groupe, ou MBS un groupe
par publication), jamais par partage natif, si l'on veut des chiffres.

### La procédure pour une annonce de restaurant

1. **Le lien** : `https://taxifoodnosybe.distripro207.com/r/<restaurant_id>?g=<slug>`, slug pris
   dans le tableau § 2 — jamais inventé en route, jamais recopié d'un autre groupe.
   Les Siciliens : `/r/aee1c612-5ee0-402b-a7b4-aec9c6825b0b?g=<slug>`.
2. **Deux formes possibles** :
   - **A — lien seul, aperçu automatique** (la forme éprouvée sur `/p/`). ⚠️ L'image de l'aperçu
     `/r/` est `cover_url`, sinon `logo_url`, sinon l'image par défaut (`partage.mjs` l. 839).
     **Les Siciliens n'ont ni l'un ni l'autre : leur aperçu montrerait l'image générique.**
   - **B — visuel de lancement joint + lien marqué dans le texte.** Plus beau, compté au clic sur
     le lien (§ 4 b), jamais éprouvé. À tester sur UN groupe, puis vérifier une ouverture dans
     `visites_partage` avant de généraliser.
3. **Le texte** : charte (tutoiement, « Nouveau : … livre chez toi », zéro emoji dans le corps,
   faits vérifiés en base). ⚠️ `MESSAGES-ANNONCE-LA-PLAGE.md` l. 96-98 dit « pas de lien écrit »
   — c'est vrai pour **la page** (lien en bio) ; **dans un groupe, le lien marqué est obligatoire**,
   sinon rien n'est mesuré. Un texte différent par groupe, langue du groupe, ASCII si saisie pilotée.
4. **Un groupe par publication** (MBS en autorise trois, mais elles partageraient le slug).
5. Journaliser : date, groupe, slug, forme A/B, résultat.

## 5. Les pièges déjà payés — et où ils sont écrits

| Piège | Contournement | Documenté ? |
|---|---|---|
| Toggle « Partager sur → Story Facebook » rallumé à **chaque** sélection de groupe (MBS) | choisir « Ne pas partager cette publication » à chaque publication | **journal seulement** (l. 551-552, 602-604) — absent du mode d'emploi § 4 |
| Sélecteur MBS = ~7 groupes **tournants** | recharger le composeur (`&r=1`, `&r=2`…), noter les nouveaux | documenté (mode d'emploi § 2 et § 4.5 ; procédure l. 147-164, 424-432) |
| Page cochée par défaut dans MBS | rouvrir « Publier dans », décocher la page | documenté (mode d'emploi § 4.3) |
| **5 clones** de « Nosy be hell ville M bizna » dans la recherche | ouvrir le groupe par son identifiant (`facebook.com/groups/302974809351919`, l. 480), jamais par la recherche | **journal seulement** (l. 526-529) |
| Groupes qui modèrent sans jamais publier | noter, continuer, sortir de la rotation | documenté (mode d'emploi § 6 ; procédure § 7) — `tourisme` est le seul cas avéré |
| Clic par coordonnées qui atterrit ailleurs | `find` puis clic par `ref` | documenté (mode d'emploi § 3) |
| Tri « Les plus pertinentes » cache une publication pourtant parue | relire le fil, pas ce tri | **journal seulement** (l. 517) |
| Facebook publie au nom de la PAGE sauf dans le 1er groupe de la session | aucun — à savoir | **journal seulement** (l. 438-440) |
| Groupes d'achat-vente sans composeur | `…/groups/<id>/buy_sell_discussion` | documenté (mode d'emploi § 3) |
| Accents mutilés en saisie pilotée | textes en ASCII | documenté (mode d'emploi § 5) |
| Un compte rendu « tous les groupes » faux | dire servis + vus non servis, jamais « tout » | documenté (mode d'emploi § 4 et § 7 ; journal l. 538) |

## 6. Sessions non journalisées

`git log --since=2026-09-29` sur la procédure, le mode d'emploi, `partage.mjs` et `mesure.js` :
**aucun commit**. Le dernier commit du journal est `55bafed` (29/09). La base confirme : aucune
visite étiquetée après le **29/09 22:00**. **Aucun partage marqué n'a eu lieu après le 29/09.**
Un partage **sans** étiquette (partage natif d'un post de la page) ne laisserait aucune trace en
base : on ne peut pas l'exclure — non documenté.

## 7. Ce qui reste à faire

1. **Corriger la procédure** : § 3 bis (`leboncoin`, `businessmadio`) ou suppression du tableau ;
   § 3 ter (états des lignes 6-8, 12, 14, 24-44 ; `topbusiness` seul ; ajout des lignes 45-49 ;
   `nosybeisland`). Ajouter au mode d'emploi les trois pièges « journal seulement ».
2. **Vérifier** si « Nosy Be Madagascar '' » et « Nosy-be Madagascar » sont deux groupes, et si
   « Le Bon Prix De Nosy be hell Ville » / « Nosy be Lebon Coin » sont des doublons de `bonprix` /
   `leboncoin`.
3. **Qualifier les ~15 groupes vus sans slug** (§ 2) et leur attribuer un slug avant publication.
4. **Servir `biznesshell`**, jamais touché.
5. **Les Siciliens** : poser une couverture ou un logo avant une annonce par lien seul (forme A),
   sinon l'aperçu `/r/` affiche l'image générique.
6. **Tester la forme B** (visuel joint + lien marqué) sur un seul groupe et vérifier l'ouverture
   dans `visites_partage` avant de l'étendre.
7. **Relire le critère de tri** : sur 194 ouvertures, 3 passages vers l'app et 0 commande. Juger
   les groupes sur les commandes n'est pas encore possible ; les ouvertures sont le seul signal.
