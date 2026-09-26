# Trois nouveaux restaurants à mettre en ligne, et l'ordre du catalogue à reprendre

Dépôt `taxi-food-nosybe`, branche `main`. Trois livrables concernés : `app/`, `landing/`,
`admin/`. Projet Supabase `bmdveawomizjpiebgtkj`.

Lis `CLAUDE.md` avant de commencer. Ce qui suit a été **relu en base et dans le code le
2026-09-16** — ce ne sont pas des souvenirs.

---

## 1. Ce qu'il y a à faire, en trois phrases

Ajouter **Madame Oh**, **Oh Hazar** et **La Plage** au catalogue, en « bientôt disponible ».
Créer un **ordre d'affichage explicite** du catalogue, qui n'existe pas aujourd'hui, avec
La Cabane en tête, Chez Bidul & Truc ensuite, et tous les « bientôt disponible » rejetés à la
fin, Taxi Be en dernier. Le badge « Bientôt disponible », lui, **existe déjà et n'est pas à
construire**.

---

## 2. L'état réel du catalogue, relu en base

| Restaurant | id | `listing_status` | produits actifs |
|---|---|---|---|
| Taxi Be | `ac2766bb-c4d1-4f5e-9a40-3ea0febcb886` | `coming_soon` | 36 |
| La Cabane | `958faac6-61ab-4ff5-9226-b8adab46ed24` | `visible` | 45 |
| Angelo | `cb482596-b39e-4355-96a5-3dfdad75dcee` | `hidden` | 31 |
| Chez Bidul & Truc | `700e8f32-e966-476a-b371-02884d08dea1` | `visible` | 74 |
| Les Siciliens | `aee1c612-5ee0-402b-a7b4-aec9c6825b0b` | `coming_soon` | 46 |

Les réglages posés pour le relecteur Apple ont bien été défaits le 2026-09-08
(`docs/FICHE-APP-STORE.md` § 7) : **Taxi Be est légitimement en `coming_soon`**, il n'y a rien
à y toucher côté statut.

---

## 3. Le badge existe déjà — ne rien construire

`restaurants.listing_status` vaut `visible`, `coming_soon` ou `hidden`, et toute la mécanique
est en place :

- **Application** — `app/components/RestaurantCard.tsx` passe
  `comingSoon={r.listingStatus === 'coming_soon'}` à `OpenBadge`, aux deux endroits (carte
  vedette et ligne de liste), et `HorairesDuJour` se masque de lui-même dans ce cas.
- **Vitrine** — `landing/js/partenaires.js` affiche la pastille « Bientôt disponible » et
  applique `opacity:.78` sur la carte.
- **Commande** — `supabase/migrations/20260909170000_un_restaurant_bientot_disponible_ne_prend_pas_de_commande.sql`
  fait que `commandable_maintenant()` refuse une commande sur un `coming_soon`. La garde est
  en base, pas seulement à l'écran.

**Donc : il suffit de créer les trois restaurants avec `listing_status = 'coming_soon'`.**
N'ajoute ni champ, ni composant, ni libellé. Si tu te surprends à écrire « Bientôt
disponible » quelque part, tu es en train de dupliquer ce qui existe.

---

## 4. Les trois restaurants à créer

Tous en `listing_status = 'coming_soon'`, `auto_open = false`, `telegram_chat_id = null`
(aucun patron n'est branché), `commission_rate` par défaut.
Zone, horaires et frais de livraison **ne sont pas connus** : laisse les défauts et ne les
invente pas.

### Madame Oh — thaï, Hell-Ville
`cuisine_type` : *Cuisine thaïlandaise*. Enseigne : pastille bleu marine, façade vert jade.
14 plats, deux catégories.

**Entrées** — Nem au poulet 16 000 · Sambossa au zébu 22 000 · Rouleaux 21 000 ·
Satay de poulet 18 000 · Salade de papaye 20 000
**Plats** — Tom yam 28 000 · Tom kha gai 24 000 · Pad thaï royal 26 000 · Curry vert 30 000 ·
Curry rouge 32 000 · Curry jaune 32 000 · Curry panang 32 000 · Zébu sauté poivre noir 38 000 ·
Sauce aigre-douce 36 000

### Oh Hazar — marocain, Hell-Ville
`cuisine_type` : *Cuisine marocaine*. 8 plats, une seule catégorie.

Couscous royal pour 4 personnes 120 000 · Brochette kefta 30 000 · Brochette merguez 30 000 ·
Boulette kefta 35 000 · Tajine de poulet 58 000 · Tajine de zébu 58 000 ·
Tajine d'agneau 58 000 · Tajine de poisson 52 000

⚠️ Les tajines se commandent **au choix pruneaux OU citron confit**. C'est une option, pas
huit plats : modélise-le comme un choix sur le produit, comme les sauces de Chez Bidul & Truc.

⚠️ L'orthographe de l'enseigne n'est pas confirmée — le dossier du porteur dit `oazar`, lui
écrit « Oh Hazar ». **Demande-lui avant de figer le nom en base.**

### La Plage — bistrot-bar, Hell-Ville
`cuisine_type` : *Bistrot & bar*. 38 plats, cinq catégories. C'est la plus grosse carte.

**Nos traditions et entrées** — Nems viande 3 pièces 24 000 · Assiette de crudités 11 000 ·
Tartare de poisson 24 000 · Rouleaux de printemps 3 pièces 24 000 · Assiette de poisson fumé
24 000 · Beignets de crevettes 24 000 · Beignets de calamars 29 000 · Beignets de poisson 22 000

**Grillades au feu de bois** — Poisson entier grillé dès 29 000 · Côtes de zébu grillées
35 000 · Steak de zébu 34 000 · Poulet grillé 29 000 · Brochettes de thazard 27 000 ·
Brochettes de filet de zébu 34 000 · Brochettes de crevettes 31 000 · Brochettes de poulet 29 000

**Sandwichs demi baguette** — Poisson fumé 19 000 · Omelette 13 000 · Fromage 15 000

**Plats maison** — Poisson pané 27 000 · Poulet pané 31 000 · Poulet façon KFC 35 000 ·
Mi Xao à partir de 29 000 · Soupe chinoise à partir de 29 000 · Spaghetti bolognaise 25 000 ·
Poulet citronné 29 000 · Bol renversé 29 000 · Romazava poulet 29 000 · Romazava poisson
25 000 · Romazava viande 29 000 · Poulet coco 31 000 · Poisson coco 29 000

**Le coin douceur** — Ananas ou banane flambée 14 000 · Boule de glace 6 000 · Salade de fruits
14 000 · Crêpe banane 11 000 · Crêpe au chocolat 13 000 · Crêpe confiture ou sucre 11 000

**Accompagnements** — frites · pommes sautées · riz blanc · salade · légumes sautés · pâtes.
Supplément accompagnement 5 000. À modéliser comme option, pas comme produits.

⚠️ « Mi Xao » et « Soupe chinoise » sont annoncés **« à partir de »** sur sa carte papier : le
prix dépend d'une déclinaison qu'on ne connaît pas. Ne fige pas un prix ferme sans le demander.

---

## 5. Les photos des plats

**60 visuels PNG, 1792 × 2240, existent déjà** et attendent dans le dossier du porteur du
projet :

```
partenaire /mariamo/madame oh /visuels/        14 fichiers  plat-*.png, entree-*.png
partenaire /mariamo/oazar/visuels/              8 fichiers  plat-*.png
partenaire /mariamo/la plage/visuels/          38 fichiers  entree-*, grillade-*, plat-*, sandwich-*, dessert-*
```

⚠️ **`partenaire /` est git-ignoré** (`.gitignore` ligne 51). Ces fichiers ne sont pas dans le
dépôt et n'y entreront pas. Ils doivent partir dans le bucket Supabase `produits`, sous la
convention déjà en place — un dossier par restaurant, le nom du fichier repris tel quel :

```
produits/madame-oh/…    produits/oh-hazar/…    produits/la-plage/…
```

Les noms de fichiers sont déjà alignés sur les noms des plats, dans l'ordre de la carte. Le
`photo_url` de chaque produit pointe ensuite sur l'URL publique, comme pour les autres
restaurants.

⚠️ **La clé `service_role` vit dans `.secrets.local` et ne doit jamais apparaître dans un
message ni dans un commit.** Le dépôt a déjà un précédent de fonction Edge jetable pour ce
genre de dépôt en masse — s'il en faut une, elle est à **neutraliser puis supprimer** après
usage, pas à laisser en place.

⚠️ **Ces visuels sont des reconstitutions**, générés d'après les recettes canoniques, pas des
photos prises dans leurs cuisines. Même exception assumée que pour le « Poisson fumé » et les
plats du jour de Chez Bidul & Truc (`docs/PARTENAIRES.md`). Trois plats de La Plage reposent
sur des paris documentés mais non tranchés — **poulet citronné**, **mi xao**, **soupe
chinoise** — et le contenant choisi (assiette émaillée à liseré bleu) n'a pas été confirmé par
le restaurateur. Ça ne bloque pas la mise en ligne en « bientôt disponible », mais ça doit
être confirmé avant l'ouverture réelle des commandes.

---

## 6. L'ordre du catalogue — le vrai morceau

### Ce qui existe aujourd'hui

**Il n'y a aucune colonne d'ordre sur `restaurants`.** Vérifié : ni `sort_order`, ni
`display_order`, ni `position`. Les deux surfaces trient donc par date de création :

- `app/data/api.ts`, `listRestaurants()` → `.order('created_at', { ascending: true })`
- `landing/js/partenaires.js` ligne 244 → `order=listing_status.asc,created_at.asc`

Conséquence actuelle, dans l'application : **Taxi Be sort en tête**, parce qu'il est le plus
ancien — et c'est un « bientôt disponible ». La Cabane suit, Chez Bidul & Truc arrive
quatrième.

⚠️ Et sur la vitrine, `listing_status.asc` trie **alphabétiquement** : `coming_soon` passe
avant `visible`. La vitrine affiche donc **les partenaires pas encore disponibles en
premier**. C'est l'inverse de ce qu'on veut, et ce n'est probablement pas intentionnel.

### Ce qu'il faut obtenir

Un ordre unique, appliqué **identiquement dans l'application et sur la vitrine** :

1. **La Cabane** en tête
2. **Chez Bidul & Truc** ensuite
3. les autres restaurants **disponibles**
4. puis les **« bientôt disponible »**
5. **Taxi Be en dernier** de tous

### Comment

Ajoute une colonne d'ordre sur `restaurants` — `sort_order integer not null default 0` — et
trie dessus, **puis** sur `listing_status` de façon explicite (pas alphabétique), **puis** sur
`created_at` en dernier recours pour que deux restaurants non classés gardent un ordre stable.

Pose les valeurs pour les huit restaurants. Laisse un écart entre elles (10, 20, 30…) : insérer
un partenaire au milieu ne doit pas obliger à renuméroter toute la table.

**Deux exigences sur cette colonne :**

- **Elle doit être modifiable depuis `admin/`.** Sinon le porteur du projet devra revenir en
  SQL à chaque nouveau partenaire, et l'ordre redeviendra faux au premier oubli.
- **Le tri doit vivre au même endroit pour les deux surfaces.** Si l'application trie d'un
  côté et la vitrine de l'autre avec deux règles écrites séparément, elles divergeront. Le plus
  sûr est que la base porte l'ordre et que les deux requêtes se contentent de le suivre.

⚠️ N'utilise pas `created_at` pour forcer l'ordre. Antidater une ligne pour la faire remonter
casse l'historique et ne se voit pas.

⚠️ **Angelo est `hidden`** : il ne s'affiche nulle part, mais il garde des commandes dans
l'historique client. Donne-lui une valeur d'ordre quand même, ne le traite pas comme absent.

---

## 7. Ménage, si tu veux bien le faire au passage

`landing/js/partenaires.js` porte une constante `EN_NEGOCIATION = ['ac2766bb…']` (Taxi Be) et
un long commentaire expliquant qu'elle existe parce que **Taxi Be est `visible` en base pour le
relecteur Apple**. Ce n'est plus vrai depuis le 2026-09-08 : il est `coming_soon`. Le
commentaire est périmé et la substitution ne change plus que le libellé, « En négociation » au
lieu de « Bientôt disponible ».

**Demande au porteur du projet lequel des deux libellés il veut** avant de retirer quoi que ce
soit — c'est une décision commerciale, pas un nettoyage technique. S'il veut garder « En
négociation », corrige au moins le commentaire, qui dit aujourd'hui le contraire de la base.

---

## 8. Avant de dire que c'est fini

Vérifie, en base et à l'écran, pas de mémoire :

1. Les trois restaurants existent, en `coming_soon`, et **le compte de produits actifs** est
   bien 14, 8 et 38.
2. Chaque produit a un `photo_url` qui **répond en 200**. Un `photo_url` mort est pire qu'une
   absence de photo : la carte s'affiche avec un trou.
3. `commandable_maintenant()` renvoie **false** pour les trois. Si elle renvoie true, la garde
   ne les couvre pas et une vraie commande partirait dans le vide.
4. L'ordre demandé sort **dans l'application ET sur la vitrine**, avec La Cabane en tête et
   Taxi Be en queue. Compare les deux listes côte à côte : elles doivent être identiques.
5. Les quatre restaurants déjà en ligne n'ont pas bougé — ni statut, ni horaires, ni
   `auto_open`. La Cabane et Chez Bidul & Truc sont à `auto_open = true`, ne les touche pas.
6. Aucune clé ne s'est glissée dans un fichier suivi par git.

Écris les migrations avec des noms parlants, en français, comme le reste du dossier
`supabase/migrations/`, et un commentaire d'en-tête qui explique **pourquoi** la migration
existe — pas ce qu'elle fait, ça se lit dans le SQL.
