# Nouveaux partenaires — procédure et suivi

## Comment un restaurant apparaît dans l'app

Aucun redéploiement nécessaire : l'app lit `restaurants` / `categories` / `products` en
direct. Un restaurant est visible dès que `is_open = true` et qu'il a au moins une catégorie
active avec un produit disponible.

Colonnes utiles sur `restaurants` : `zone_served` (texte libre, ex. « Hell-Ville »,
« Ambatoloaka »), `food_types` (tableau, pour les filtres), `delivery_fee` et
`commission_rate` (5 % partout à ce jour, voir `docs/SCHEMA-SQL.md`).

## ⚠️ ADR-007, et l'exception posée le 2026-09-04

La règle par défaut du projet reste : **jamais de photo produit approximative**. Sans une
vraie photo du plat tel qu'il est réellement servi, on laisse vide et l'app affiche les
initiales — le personnel s'en sert pour contrôler ce qu'il sert.

**Chez Bidul & Truc fait exception, sciemment.** Le porteur du projet a explicitement demandé
et validé une image générée par IA (Higgsfield, modèle `marketing_studio_image`) pour le
« Poisson fumé », après avoir été informé que ça revenait à écarter ADR-007 pour ce
partenaire. Ce n'est **pas** une réécriture de la règle pour les prochains partenaires — à
reposer la question au cas par cas, pas à supposer acquis.

### Comment le style a été reproduit

Trois photos existantes de la même famille (tapas) ont été relues avant de générer :
fond gris-noir en dégradé radial, assiette en ardoise noire, éclairage studio dramatique en
trois-quarts, cadrage carré 1:1, aucun texte ni logo dans l'image. Le prompt décrit
explicitement ces éléments pour que le nouveau visuel se fonde dans la carte existante.

### Comment l'image a été déposée dans le bucket

Le chemin `produits/{slug-restaurant}/{categorie}-{plat}.png` suit la convention déjà en
place (`produits/taxi-be/…`, `produits/la-cabane/…`, `produits/angelo/…`).

Aucun outil MCP ne dépose des octets directement dans le Storage Supabase. Suivi le même
principe que `import-visuels` / `montage-visuels` : une **fonction Edge jetable**
(`upload-visuel-partenaire`) qui récupère une image depuis une URL publique et l'écrit dans
le bucket avec la clé `service_role` — jamais exposée en dehors de l'environnement de la
fonction. **Neutralisée (410) juste après usage**, comme les deux précédentes.
⚠️ **À supprimer depuis le tableau de bord Supabase** quand quelqu'un y pense — l'API MCP ne
sait pas supprimer une fonction, seulement la neutraliser.

## État des partenaires

| Restaurant | Zone | Statut | Carte |
|---|---|---|---|
| Taxi Be | Hell-Ville | actif | complète |
| La Cabane | Ambatoloaka | actif | complète |
| Angelo | — | actif | complète |
| **Chez Bidul & Truc** | **Dar es Salam** | **actif, carte quasi complète** | 48 produits sur 6 catégories |

### Carte du 2026-09-04 — tous les plats avec un prix écrit

| Catégorie | Produits | Fourchette |
|---|---|---|
| Tapas | 5 (dont Poisson fumé) | 10 000 – 18 000 Ar |
| Entrée | 12 | 8 000 – 29 000 Ar |
| Hamburger | 3 | 24 000 – 28 000 Ar |
| Plat | 18 | 14 000 – 33 000 Ar |
| Pâtes | 4 | 14 000 – 30 000 Ar |
| Dessert | 6 | 9 000 – 15 000 Ar |

⚠️ **Grillade Brasero (9 plats) volontairement absente.** La carte papier renvoie à
« voir tableau » pour chaque prix — aucun montant écrit, donc aucune fiche produit possible
(`price` est obligatoire). **Les visuels sont déjà générés et prêts** (Higgsfield, même
style) ; dès que les prix arrivent, l'ajout est rapide.

⚠️ **Les apéritifs et boissons alcoolisées sont exclus sur demande du porteur du projet**,
« pour le moment » — pas de date de reprise fixée.

### Choix de modélisation retenus

Plusieurs lignes de la carte proposent un choix (protéine, sauce) sur **une seule ligne, un
seul prix** — ex. *« Le classique (…zébu ou poulet) »*, *« Filet de poisson sauce au choix
(curry, poireaux, poivre vert) »*. Modélisées comme **un seul produit**, le choix décrit dans
`description`, plutôt que par de vrais groupes d'options (`product_option_groups`) comme le
fait le système de suppléments pizza. Plus simple, mais un peu moins riche pour le client au
moment de composer sa commande — à améliorer plus tard si ça vaut le coup.

Les **suppléments de la carte** (riz/rougail 4 000 Ar, sauce 5 000 Ar, fromage 6 000 Ar) n'ont
**pas** été saisis comme produits indépendants — ce sont des modificateurs, pas des plats
commandables seuls.

### Erreurs de suivi pendant la génération — pour la prochaine fois

Compiler 56 générations en parallèle à la main a produit deux types d'erreur, corrigées avant
publication mais qui valent d'être notées : **deux doublons** (beignets, foie gras poêlé —
générés deux fois sans le vouloir) et **quatre oublis** (crevettes croustillantes, salade de
légumes, carpaccio de zébu, crevette/calamar sauce combava — jamais repris après leur premier
échec). Un tableau de suivi explicite (nom → job_id → statut) plutôt qu'un suivi de tête
aurait évité les deux.

⚠️ **Le forfait Higgsfield plafonne à 8 générations simultanées.** Au-delà,
`generate_image_batch` échoue entièrement (0 soumis), pas partiellement — down-grader à des
lots de 8 dès le départ plutôt que de découvrir la limite en cours de route.

⚠️ **Aucun compte de connexion n'a été créé** pour ce restaurant (pas de ligne
`restaurant_staff`) — il n'a donc pas encore d'accès à son espace de gestion. À faire quand
le porteur du projet le demande.

⚠️ **Logo et bannière absents** (`logo_url`, `cover_url` restés `null`) — pas demandés à ce
stade.

## Accompagnements et suppléments (2026-09-04)

Sur demande explicite du porteur du projet, chaque produit a — **dans la mesure du possible**
— un mécanisme d'accompagnement et un mécanisme de supplément, comme le fait déjà le système
de suppléments pizza/tacos.

### Accompagnement (Entrée, Plat, Pâtes, Tapas, Hamburger)

Deux groupes d'options par produit concerné (41 sur 48) :
- **« Accompagnement (1 au choix, inclus) »** — obligatoire, 1 choix, prix +0 Ar
- **« 2e accompagnement (+5 000 Ar) »** — optionnel, 1 choix, prix +5 000 Ar

Les deux groupes proposent les 5 mêmes choix, visuels générés par IA (Higgsfield, même
exception ADR-007 que le reste de la carte) : Frites, Légumes sautés, Pâtes, Riz, Purée.

**Exclus du mécanisme** : Dessert (6 produits, non pertinent) et Pommes frites (1 produit,
un accompagnement-de-l'accompagnement n'aurait pas de sens).

### Suppléments (tous les 48 produits)

Un groupe **« Suppléments »** par produit, optionnel, +5 000 Ar par option (prix plat, comme
demandé — volontairement différent des suppléments variables de La Cabane/Tacos qui vont de
3 000 à 5 000 Ar selon l'ingrédient). Le choix des 2 ou 3 suppléments proposés dépend de la
composition du plat, regroupée en 8 familles :

| Famille | Suppléments proposés | Exemple de plat |
|---|---|---|
| Poisson / fruits de mer | Fromage, Crevettes, Avocat | Poisson fumé, Marmite du pêcheur |
| Viande rouge (zébu) | Fromage, Bacon, Champignons | Steak haché, Filet de zébu |
| Volaille | Fromage, Champignons, Oignons confits | Cuisse de poulet, Cordon bleu |
| Œufs et plats gratinés | Fromage, Bacon, Champignons | Croque-monsieur, Camembert pané |
| Salade | Avocat, Fromage, Crevettes | Salade tomate crevettes |
| Pâtes | Fromage, Champignons, Bacon | Pâtes carbonara, bolognaise |
| Frites seules | Fromage, Bacon | Pommes frites (frites façon « loaded ») |
| Dessert | Chantilly, Coulis chocolat, Glace vanille | Les 6 desserts |

Visuels générés pour les 9 suppléments salés/sucrés du vocabulaire (Fromage, Bacon,
Champignons, Crevettes, Avocat, Oignons confits, Chantilly, Coulis chocolat, Glace vanille) —
réutilisés d'un produit à l'autre selon la famille, pas un visuel par produit.

### Mise en œuvre technique

Plutôt que 683 instructions SQL générées une par une (une par option par produit), la
migration `accompagnements_et_supplements_chez_bidul_et_truc` utilise un bloc PL/pgSQL avec
des tables temporaires (plan produit → famille, photothèque accompagnement, photothèque
supplément, famille → suppléments) puis quatre `insert...select` — même résultat, 7 500
caractères au lieu de 320 000. Vérifié après coup : 41 produits avec accompagnement (2
groupes, 5 options chacun), 48 avec suppléments (1 groupe, 2 ou 3 options), aucune photo
manquante.
