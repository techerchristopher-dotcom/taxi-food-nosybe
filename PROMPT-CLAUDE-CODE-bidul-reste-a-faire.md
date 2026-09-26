# Chez Bidul & Truc : ce qui reste après la mise en ligne du camaron et du rôti

Dépôt `taxi-food-nosybe`, branche `main`. Projet Supabase `bmdveawomizjpiebgtkj`.
Restaurant : **Chez Bidul & Truc**, `700e8f32-e966-476a-b371-02884d08dea1`.

Lis `CLAUDE.md` avant de commencer. Tout ce qui suit a été **relu en base le 2026-09-20 à
18 h** — ce ne sont pas des souvenirs. L'état de ce restaurant a déjà changé sous mes pieds
deux fois cette semaine : **relis avant d'écrire, et relis après**.

---

## 1. Ce qui est déjà fait, et qu'il ne faut pas refaire

Trois migrations ont été appliquées cet après-midi. Elles sont dans `supabase/migrations/` :

| Migration | Ce qu'elle a fait |
|---|---|
| `20260920145419_chez_bidul_camaron_et_roti_de_porc_plats_du_jour.sql` | crée les deux plats du jour, à l'affiche, avec accompagnements et sauce au choix |
| `20260920150500_chez_bidul_retrouve_sa_semaine.sql` | rend les 14 lignes d'horaires (6 jours sur 7 étaient fermés) |
| `20260920151500_chez_bidul_is_open_residu_de_la_fermeture_ratee.sql` | solde `is_open = false`, résidu de la fermeture ratée du matin |

État vérifié à 18 h 02 : `is_open = true`, `auto_open = true`, `ouvert_maintenant = true`,
`commandable_maintenant = true`, **14 lignes d'horaires ouvertes**, deux plats à l'affiche
(camaron 55 000, rôti 30 000), huit dormants.

---

## 2. Le vrai sujet : cinq plats du jour n'ont aucun accompagnement

C'est le défaut le plus visible pour un client, et il est ancien.

| Plat du jour | Groupes d'options |
|---|---|
| Poulet basquaise | accompagnement inclus + 2ᵉ à +5 000 |
| Blanquette de poisson | accompagnement inclus + 2ᵉ à +5 000 |
| Tartare de zébu | accompagnement inclus + 2ᵉ à +5 000 |
| **Pot-au-feu** | **aucun** |
| **Boudin noir façon hachis** | **aucun** |
| **Paella** | **aucun** |
| **Tripes à la mode de Caen** | **aucun** |
| **1/2 poulet grillé BBQ** | **aucun** |
| Camaron grillé brasero | accompagnement inclus + 2ᵉ à +5 000 |
| Rôti de porc provençale ou miel | sauce au choix + accompagnement inclus + 2ᵉ à +5 000 |

Un client qui commande le poulet basquaise choisit entre frites, légumes sautés, pâtes, riz et
purée. Celui qui commande le demi-poulet BBQ ne choisit rien, et paie le même prix.

**Ce qu'il y a à faire : donner les deux groupes aux cinq qui ne les ont pas.** Le modèle
existe déjà, ne le réinvente pas — copie-le à l'identique depuis le poulet basquaise :

```
Accompagnement (1 au choix, inclus)   required, min 1, max 1, sort_order 30
  Frites 0 · Légumes sautés 0 · Pâtes 0 · Riz 0 · Purée 0   (sort_order 10,20,30,40,50)
2e accompagnement (+5 000 Ar)         optionnel, min 0, max 1, sort_order 40
  les cinq mêmes, price_delta 5000, mêmes sort_order
```

Les `photo_url` des options sont déjà en ligne et se réutilisent telles quelles :
`produits/chez-bidul-truc/accompagnement-{frites,legumes-sautes,pates,riz,puree}.png`.

La migration `20260920145419` contient exactement ces deux `insert` : recopie-les en changeant
la liste de plats. **Idempotent obligatoire** (`where not exists` sur le nom du groupe pour le
produit, sur le nom de l'option pour le groupe) : rejouer ne doit jamais créer de doublon.

⚠️ **Deux questions à poser au porteur du projet avant d'appliquer**, parce qu'elles ne se
déduisent pas :

1. **Le pot-au-feu et les tripes sont servis avec leurs propres pommes de terre** — elles sont
   dans le plat, visibles sur la photo. Leur proposer en plus « frites ou riz au choix » est
   peut-être absurde. Le boudin en hachis a déjà sa purée gratinée. Demande-lui plat par plat.
2. **Le prix ne bouge pas ?** Chez les trois anciens l'accompagnement est *inclus* à
   30 000 Ar. Si les cinq passent au même régime sans changer de prix, c'est de la marge en
   moins pour le restaurateur. C'est sa décision, pas la nôtre.

---

## 3. Les deux sauces du rôti n'ont pas de photo

Le groupe « Sauce au choix » du rôti porte **Provençale** et **Miel**, toutes deux avec
`photo_url` null. Le schéma l'accepte (cf. « Viande au choix » du Classique), mais **toutes les
autres options de sauce de ce restaurant en ont une** :
`produits/chez-bidul-truc/sauce-{combava,poivre-vert,curry,poireaux,3-poivres,champignon}.png`.
Dans l'écran de commande, deux sauces sans vignette au milieu d'options qui en ont toutes se
voient.

**Ne génère pas ces images toi-même.** Elles se produisent avec la chaîne visuelle du projet
(voir `visuels-reseaux/` et la compétence `taxi-food-visuels`), dans le registre de la maison :
fond brun très sombre, lumière chaude rasante venant du haut-droite, petit ramequin noir.
Signale-le au porteur du projet et attends ses fichiers, ou demande-les-lui.

---

## 4. Les pièges, dans l'ordre de gravité

**1. Ne jamais archiver, ne jamais supprimer un plat du jour.** `getFeaturedLibrary()` dans
`app/data/api.ts` filtre sur `in_menu = false` **et** `is_archived = false`. Archiver, c'est
faire sortir le plat de la bibliothèque du restaurateur et détruire le retour à l'affiche en un
tap. `is_featured = false` suffit.

**2. Ne donne pas de `category_id` à un plat du jour.** Il apparaîtrait dans la carte
permanente et hériterait de la plage horaire de sa catégorie — indisponible le soir sans que
personne comprenne pourquoi.

**3. `is_open` est un piège armé ailleurs.** `admin_set_restaurant_auto_open(id, false)`
n'écrit volontairement pas `is_open` : la valeur stockée reprend la main. Chez Bidul elle vaut
maintenant `true`, ce qui est cohérent. **Vérifie les autres restaurants** : un `is_open` périmé
à `false` sous `auto_open = true` est une fermeture silencieuse en attente. La Cabane et La
Plage sont à `true`, les autres n'ont pas été regardés.

**4. Les RPC d'admin exigent une vraie session.** `admin_set_restaurant_open` et
`admin_set_restaurant_auto_open` testent `is_admin()` et écrivent `auth.uid()` dans
`admin_actions`. Depuis un connecteur MCP, `auth.uid()` est nul : elles refusent. Si un geste
doit être tracé au nom d'un administrateur, **il se fait depuis l'écran admin**, pas par
migration.

**5. L'état bouge.** Cette semaine : les plats du jour sont apparus entre deux lectures, la
semaine d'ouverture a été vidée puis rendue, le badge porc est arrivé après coup. Ne fais
confiance à aucun tableau de ce document sans l'avoir revérifié.

---

## 5. Dette à solder, hors périmètre de ce lot

Elle traîne depuis plusieurs jours et personne ne l'a prise :

- **Trois fonctions Edge à supprimer depuis le tableau de bord Supabase** (l'API MCP ne sait
  pas supprimer une fonction, seulement la redéployer) :
  `upload-plats-du-jour-bidul` et `upload-visuel-partenaire`, toutes deux neutralisées en 410
  mais dont **la version 1 portait la clé `service_role`** et reste dans l'historique du
  projet ; et vérifier s'il en traîne d'autres du même genre.
- **`deposer-visuel` est la voie propre** et doit le rester : secret dans `.secrets.local`,
  empreinte SHA-256 seule en base, `ecraser: false`. N'écris pas de nouvelle fonction de dépôt.

---

## 6. Avant de dire que c'est fini

Vérifie en base **et à l'écran** :

1. Les cinq plats concernés ont bien les deux groupes, avec les cinq options et leurs photos,
   dans le même ordre que le poulet basquaise.
2. **Ouvre l'écran de commande** d'un de ces cinq plats et constate que le choix s'affiche et
   que le second accompagnement ajoute bien 5 000 Ar au total.
3. Rejoue la migration : aucun doublon.
4. Le bandeau « Offre du jour » montre toujours **exactement deux plats** — camaron et rôti.
   Rien n'est apparu dans Entrée ni dans Plat.
5. Les huit dormants sont intacts, `is_featured = false`, `is_archived = false`, photo en
   place, et visibles dans « créations dormantes » sur l'écran Réglages.
6. `commandable_maintenant()` du restaurant est inchangé.
7. Aucune clé dans un fichier suivi par git.

Nomme la migration en français, comme le reste de `supabase/migrations/`, avec un en-tête qui
explique **pourquoi** elle existe — pas ce qu'elle fait, ça se lit dans le SQL.
