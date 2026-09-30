# Notation et avis clients

Chantier ouvert le 2026-09-30. Décisions prises avec le porteur du projet ce jour-là,
après diagnostic du code (voir § 6 pour ce que le diagnostic a révélé).

## 1. Ce que ça fait

Après une livraison, le client est invité à noter sa commande : **trois notes de 1 à 5
étoiles** (la cuisine, le délai de préparation, la livraison) et un **commentaire libre**.
Les avis nourrissent une **note par restaurant** visible dans le catalogue et sur la fiche,
un écran « les avis » par restaurant, et — avec le consentement du client — un vivier
d'avis **réutilisables sur les réseaux sociaux**.

## 2. Les décisions, et pourquoi

| Décision | Pourquoi |
|---|---|
| **1 à 5 étoiles**, jamais 0 | 0 étoile n'existe nulle part ailleurs (App Store, Google, Uber) ; 0 = « pas noté ». |
| **La note du restaurant = cuisine + préparation, SANS la livraison** | La livraison juge le livreur et Taxi Food, pas le restaurant. Un excellent restaurant ne doit pas être pénalisé par une course lente. La note livraison se rattache au `courier_id` : elle donnera une note par livreur, gratuitement. |
| **Une note ne s'affiche qu'à partir de 3 avis** | Un seul mécontent = 1★ affiché sur la carte pendant des semaines. |
| **Un avis par commande**, par le client de la commande, commande `livree`, dans les **7 jours** | Un avis sans commande livrée derrière est un faux avis. La fenêtre évite les notes « de mémoire » six mois plus tard. |
| **Commandes téléphone et commandes du compte admin exclues** | Le « client » de ces commandes est l'admin (voir `20260917150000…sql`). |
| **Publication immédiate dans l'app, l'admin peut masquer** | Confiance par défaut, modération a posteriori. |
| **Réutilisation réseaux sociaux UNIQUEMENT si le client a coché la case** | Consentement explicite, prénom seulement. `profiles` n'a ni pseudo ni consentement : c'est l'avis qui les porte. |
| **Prénom figé à la création** (`prenom_affiche`) | Renommer son profil ne réécrit pas les avis passés ; et aucune policy de lecture publique sur `profiles` n'est nécessaire. |
| **Relance push unique ~40 min après la livraison** | Le temps de manger. Une seule, jamais deux : `orders.invitation_avis_le`. |
| **Code promo de remerciement : 2 000 Ar sur la livraison, 30 jours, une utilisation** | Fait bondir le taux de réponse. Payé par Taxi Food, valable partout (pas de `restaurant_id`). Nom `AVIS<PRENOM>`, sur le modèle des `MERCI<PRENOM>`. |
| **Droit de réponse du restaurateur** | Lot 2. C'est ce qui rend l'avis utile côté partenaire. |
| **Photo du plat par le client** | Lot 3. C'est ce qui vaut de l'or sur Facebook. |

## 3. Le modèle

Toutes les règles vivent **en base** (RPC `security definer`), comme partout dans le projet.

### `avis`

| Colonne | Rôle |
|---|---|
| `order_id` **unique** | un avis par commande |
| `user_id`, `restaurant_id`, `courier_id` | dénormalisés depuis la commande, figés |
| `note_cuisine`, `note_preparation`, `note_livraison` | `smallint` 1..5 |
| `note_restaurant` | **générée** : `(note_cuisine + note_preparation) / 2.0` |
| `commentaire` | texte libre, 500 caractères, nettoyé (`btrim`), null si vide |
| `prenom_affiche` | premier mot de `profiles.full_name`, figé |
| `consentement_publication` | le client accepte que son avis (prénom + texte) soit republié |
| `langue` | `fr` / `en` / `it`, pour trier avant réutilisation |
| `statut` | `publie` / `masque` (admin) |
| `reponse_restaurant`, `reponse_le` | lot 2 |
| `utilise_reseaux_le` | posé par l'admin quand l'avis a servi |

RLS activée **sans aucune policy** + `revoke all` : lecture et écriture par RPC.

### Ce qui manquait sur `orders` et qui est comblé en même temps

`accepted_at`, `ready_at` (posés par un **trigger** à chaque transition de statut, quel que
soit le chemin — restaurateur, pg_cron, admin), `delivered_at` désormais posé aussi quand
l'admin passe une commande en `livree`, et `invitation_avis_le`. On peut enfin croiser le
**ressenti** (l'avis) et le **réel** (`ready_at − accepted_at`, `delivered_at − picked_up_at`),
et mesurer le temps d'attente du livreur (`picked_up_at − ready_at`).

### Les RPC

| Fonction | Qui | Quoi |
|---|---|---|
| `deposer_avis(p_order_id, p_cuisine, p_preparation, p_livraison, p_commentaire, p_consentement)` | client | vérifie tout, insère, crée le code promo, renvoie `{code, expire_le}` |
| `mon_avis(p_order_id)` | client | l'avis déjà déposé sur cette commande, ou null |
| `avis_restaurant(p_restaurant_id, p_limite, p_decalage)` | public | les avis `publie` d'un restaurant : prénom, notes, commentaire, date, réponse |
| `note_moyenne(r)`, `nb_avis(r)` | colonnes calculées PostgREST sur `restaurants` | moyenne de `note_restaurant`, `null` sous 3 avis |
| `relancer_avis_a_donner()` | pg_cron, toutes les 10 min | les commandes livrées il y a 40 min à 6 h, sans avis, sans relance : pose `invitation_avis_le` et appelle `notify-order` avec `event = 'noter'` |

### La notification

La push « Commande livrée 🎉 » existante ne change pas. La relance est un **nouvel événement
`noter`** dans `notify-order` (trois langues), route `/order/{id}?noter=1` : l'écran de suivi
s'ouvre directement sur le bloc de notation.

⚠️ `notify_order_status()` (le trigger) n'est **pas touché** : il est patché par ancres et le
dépôt n'en a pas la définition à jour. La relance appelle l'Edge Function elle-même, par
`net.http_post`, avec le même secret du Vault.

## 4. Les écrans

**Client** — composant `Etoiles` (lecture et saisie) ; bloc « Notez votre commande » dans le
suivi de commande dès que `livree` (trois lignes d'étoiles, commentaire, case de consentement,
puis le code promo affiché en remerciement) ; bouton « Noter » sur les commandes passées ;
« ★ 4,6 (32) » sur la carte du catalogue et la fiche restaurant ; écran `/restaurant/[id]/avis`.

**Restaurateur** (lot 2) — ses avis dans l'onglet Historique, réponse, alerte Telegram sur
un avis ≤ 2★.

**Admin** (lot 2) — onglet « Avis » : liste, masquer, marquer « utilisé sur les réseaux »,
copier, filtre « consentis non utilisés ».

## 5. Les lots

1. **Base + app client + relance push** — ce document, migration `20260930…notation_avis`.
2. **Restaurateur + admin + Telegram**.
3. **Photo client + visuel citation + branchement au calendrier éditorial** (quand il
   existera pour Taxi Food : `docs/AGENTS-CALENDRIER-EDITORIAL.md`, § 9).

Chaque lot se livre sur les **quatre surfaces** (CLAUDE.md, « Une correction se livre sur
QUATRE surfaces »).

## 6. Ce que le diagnostic avait révélé (2026-09-30)

- Aucune table, RPC, écran, composant ni clé i18n de notation ; `SCHEMA-TAXI-FOOD.md:142`
  l'avait mis hors périmètre MVP.
- **Les délais n'étaient pas mesurables** : ni acceptation, ni « prête » horodatées ;
  `status_updated_at` écrasé à chaque transition, pas d'historique.
- `admin_set_order_status` posait `livree` sans `delivered_at`.
- Aucun champ commande test / réelle ; commandes téléphone au nom de l'admin.
- `profiles` sans pseudo ni consentement.
- Textes de push dupliqués hors i18n (`notify-order/index.ts`).
- Le calendrier éditorial est dans le projet Rentanoo, pas ici.
