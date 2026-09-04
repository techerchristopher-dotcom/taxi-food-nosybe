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
| **Chez Bidul & Truc** | **Dar es Salam** | **actif, carte partielle** | 1 produit (Tapas → Poisson fumé, 18 000 Ar) |

⚠️ **La carte de Chez Bidul & Truc n'est pas terminée.** La photo reçue ne couvrait que
boissons, apéritifs et tapas — un seul plat a été saisi (celui dont le visuel a été validé).
Le reste de la carte (et les autres pages, si elles existent) reste à transmettre.

⚠️ **Aucun compte de connexion n'a été créé** pour ce restaurant (pas de ligne
`restaurant_staff`) — il n'a donc pas encore d'accès à son espace de gestion. À faire quand
le porteur du projet le demande.

⚠️ **Logo et bannière absents** (`logo_url`, `cover_url` restés `null`) — pas demandés à ce
stade.
