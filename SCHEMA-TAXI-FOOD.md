# Schéma de données — Taxi Food (MVP, app client)

**Statut :** schéma préparé à l'avance, **pas encore appliqué** à un projet Supabase (le backend sera créé et branché en dernière étape, une fois l'app scaffoldée). Ce fichier sert de base à la migration SQL que Claude Code appliquera au moment de brancher le backend.

Conventions reprises du projet frère `addition-appli` : RLS activé sur toutes les tables, migrations numérotées, commentaires en français.

---

## Tables

### `profiles`
Étend `auth.users` (Supabase Auth, connexion Google).

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | = auth.users.id |
| full_name | text | récupéré de Google à la 1ère connexion |
| email | text | récupéré de Google |
| phone | text | saisi obligatoirement après la 1ère connexion |
| created_at | timestamptz | |

RLS : un utilisateur ne lit/modifie que sa propre ligne.

### `addresses`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| user_id | uuid → profiles.id | |
| label | text | ex. « Maison », « Bureau » |
| zone | text | quartier de Nosy Be |
| landmark | text | point de repère |
| phone | text | téléphone de contact pour cette adresse |
| instructions | text | optionnel |
| is_default | boolean | |
| created_at | timestamptz | |

RLS : un utilisateur ne voit/modifie que ses propres adresses.

### `restaurants`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| name | text | |
| cuisine_type | text | ex. « Pizza », « Tacos », « Burgers » |
| logo_url | text | |
| cover_url | text | |
| is_open | boolean | |
| opens_at / closes_at | time | |
| delivery_fee | integer | en ariary, forfait simple |
| min_order | integer | en ariary, optionnel |
| zone_served | text | |
| created_at | timestamptz | |

RLS : lecture publique (tout le monde peut voir les restaurants). Écriture réservée à un rôle back-office (hors périmètre client).

### `categories`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| restaurant_id | uuid → restaurants.id | |
| name | text | ex. « Pizzas », « Tacos », « Boissons » |
| sort_order | integer | |

RLS : lecture publique.

### `products`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| restaurant_id | uuid → restaurants.id | |
| category_id | uuid → categories.id | |
| name | text | |
| description | text | |
| price | integer | en ariary |
| photo_url | text | |
| is_available | boolean | |

RLS : lecture publique.

### `orders`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| order_number | text | numéro affiché au client, ex. `TF-2418` |
| user_id | uuid → profiles.id | |
| restaurant_id | uuid → restaurants.id | |
| address_id | uuid → addresses.id | |
| payment_method | enum (`cb`, `especes`, `orange_money`) | déclaratif uniquement |
| subtotal | integer | |
| delivery_fee | integer | |
| total | integer | |
| status | enum (`recue`, `confirmee`, `en_preparation`, `en_livraison`, `livree`, `annulee`) | |
| created_at | timestamptz | |
| status_updated_at | timestamptz | |

RLS : un utilisateur ne voit que ses propres commandes. Statut modifiable uniquement côté back-office (hors périmètre client).

### `order_items`
| Colonne | Type | Notes |
|---|---|---|
| id | uuid | |
| order_id | uuid → orders.id | |
| product_id | uuid → products.id | |
| product_name_snapshot | text | copie du nom au moment de la commande |
| quantity | integer | |
| unit_price | integer | copie du prix au moment de la commande |
| comment | text | ex. « sans oignons » |

RLS : visible seulement via la commande parente (donc indirectement filtré par `orders`).

---

## Règles métier à coder dans le back-end

- Un panier (donc une commande) ne peut contenir des produits que d'**un seul restaurant**.
- `orders.status` ne peut avancer que dans l'ordre (pas de retour en arrière), sauf `annulee`.
- Le téléphone (`profiles.phone`) doit être renseigné avant qu'un utilisateur puisse créer une commande.
- `order_number` généré par une séquence/format simple (ex. `TF-` + compteur), à la manière du compteur `order_counters` déjà utilisé sur addition-appli.

---

## Ce qui reste volontairement hors de ce schéma (MVP)

- Pas de table de paiement/transaction (paiement déclaratif seulement).
- Pas de table de géolocalisation temps réel.
- Pas de table d'avis/notes, de codes promo, ni de programme de fidélité.
- Pas de compte livreur dédié (statuts avancés par un futur back-office, à cadrer séparément).
