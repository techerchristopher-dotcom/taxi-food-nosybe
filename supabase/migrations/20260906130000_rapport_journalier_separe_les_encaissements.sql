-- ############################################################################
-- ⚠️⚠️  MIGRATION NON APPLIQUEE — A PASSER A LA MAIN  ⚠️⚠️
--
-- L'application par MCP a ete refusee par le systeme de permissions de la
-- session qui a ecrit ce fichier. Le SQL ci-dessous n'a donc JAMAIS tourne :
-- la base porte encore l'ancienne vue, celle qui compte les commandes
-- orange_money et carte comme du cash livreur.
--
-- A PASSER depuis le tableau de bord Supabase (SQL Editor), puis renommer ce
-- fichier avec la version que `supabase_migrations.schema_migrations`
-- attribuera reellement — l'horodatage vient du SERVEUR (UTC), pas de la
-- machine qui ecrit le fichier. Meme piege que 20260905213821 et 20260906090000.
--
-- CONTROLE APRES APPLICATION (doit rendre 227000 / 0 / 0 / 140000 / 0 / 367000) :
--   select sum(encaisse_par_les_livreurs), sum(encaisse_par_stripe),
--          sum(carte_non_encaissee),       sum(encaisse_hors_app),
--          sum(emballage_a_arbitrer),      sum(facture_aux_clients)
--     from public.rapport_journalier;
-- ############################################################################

-- ============================================================================
-- Rapport du soir : separer l'argent SELON QUI L'A ENCAISSE
-- ============================================================================
--
-- LE DEFAUT, MESURABLE AUJOURD'HUI.
-- `encaisse_par_les_livreurs` valait `sum(o.total)` sur TOUTES les commandes
-- livrees, sans regarder `payment_method`. Un livreur qui n'a jamais touche un
-- Ariary etait donc credite du total de la commande. Constate en base ce jour :
--   especes      6 commandes  227 000 Ar   <- reellement remis par les livreurs
--   orange_money 2 commandes  140 000 Ar   <- jamais passe par leurs mains
--   la vue annoncait                367 000 Ar
-- Soit 140 000 Ar de caisse fantome a reclamer a des livreurs, AVANT meme que
-- la carte soit allumee. Le jour ou `carte_active` passe a true, chaque commande
-- « cb » livree ajoute son total a cette colonne alors que l'argent est chez
-- Stripe : sur le panier moyen constate (46 697 Ar + 10 000 Ar de livraison),
-- c'est 56 697 Ar de faux cash par commande carte.
--
-- L'ecran admin (`admin/components/Report.tsx`, bloc `courierCash`) filtrait
-- deja `payment_method !== 'especes'`. La vue et l'ecran se contredisaient donc
-- sur la meme question ; c'est la vue qui avait tort.
--
-- DEUXIEME DEFAUT, LATENT JUSQU'A CE MOIS-CI : LA REMISE PROMO.
-- `livraisons_taxi_food` et `total_taxi_food` sommaient `delivery_fee` brut. Or
-- une remise promo sort de la marge de livraison (`create_order` :
-- total = subtotal + packaging + delivery - remise). Sans la deduire, le rapport
-- annonce un revenu de livraison qu'on n'a pas encaisse. Aucune commande ne
-- porte encore de remise (0 sur 33), mais `TAXIFOOD50` est actif et offre 50 %
-- de la livraison, soit 5 000 Ar surestimes par commande des la premiere.
--
-- TROISIEME DEFAUT : LES FRAIS D'EMBALLAGE N'ETAIENT NULLE PART.
-- `total = subtotal + packaging + delivery - remise`, mais la vue partageait
-- seulement `subtotal - commission` (restaurant) et `commission + delivery`
-- (Taxi Food). Les frais d'emballage (2 000 Ar la boite a pizza, 13 produits)
-- disparaissaient du rapport : encaisses aupres du client, attribues a personne.
-- ⚠️ JE NE TRANCHE PAS a qui ils reviennent — c'est une decision du porteur du
-- projet, pas une correction technique. Ils sortent donc dans leur propre
-- colonne, et `facture_aux_clients` permet de verifier que le compte tombe
-- juste : facture = a_reverser + total_taxi_food + emballage.
--
-- Les colonnes existantes gardent leur nom et leur position (contrainte de
-- `create or replace view`) ; les nouvelles sont ajoutees a la fin.

create or replace view public.rapport_journalier as
select
  (o.created_at at time zone 'Indian/Antananarivo')::date as jour,
  r.id   as restaurant_id,
  r.name as restaurant,
  count(*)                              as commandes,
  sum(o.subtotal)                       as ca_marchandise,
  sum(o.commission_amount)              as commission_taxi_food,
  sum(o.subtotal - o.commission_amount) as a_reverser_au_restaurant,

  -- Net de remise : c'est ce qui rentre vraiment sur la livraison.
  sum(o.delivery_fee - coalesce(o.promo_discount, 0))                       as livraisons_taxi_food,
  sum(o.commission_amount + o.delivery_fee - coalesce(o.promo_discount, 0)) as total_taxi_food,

  -- ⚠️ ESPECES SEULEMENT. C'est le cash que les livreurs doivent remettre, et
  -- rien d'autre. `coalesce` parce qu'un `filter` sans ligne rend NULL, et un
  -- rapport ne doit pas afficher « — » la ou la reponse est « zero ».
  coalesce(sum(o.total) filter (where o.payment_method = 'especes'), 0) as encaisse_par_les_livreurs,

  -- Encaisse en ligne. `payment_status = 'paye'` et pas seulement
  -- `payment_method = 'cb'` : une commande carte livree sans paiement confirme
  -- ne doit surtout pas etre comptee comme encaissee.
  coalesce(sum(o.total) filter (where o.payment_method = 'cb'
                                  and o.payment_status = 'paye'), 0) as encaisse_par_stripe,

  -- Commande carte livree SANS paiement capture : un trou de caisse. Doit
  -- rester a zero ; toute valeur non nulle est une anomalie a instruire.
  coalesce(sum(o.total) filter (where o.payment_method = 'cb'
                                  and o.payment_status is distinct from 'paye'), 0) as carte_non_encaissee,

  -- Orange Money : ni cash livreur, ni Stripe. Regle hors application.
  coalesce(sum(o.total) filter (where o.payment_method = 'orange_money'), 0) as encaisse_hors_app,

  -- ⚠️ A ARBITRER : ni reverse au restaurant, ni compte dans la marge Taxi Food.
  sum(o.packaging_fee) as emballage_a_arbitrer,

  -- Le controle : facture = a_reverser + total_taxi_food + emballage.
  sum(o.total) as facture_aux_clients

from public.orders o
join public.restaurants r on r.id = o.restaurant_id
where o.status = 'livree'      -- une commande refusee n'a rien encaisse
group by 1, 2, 3;

revoke all on public.rapport_journalier from public, anon, authenticated;

comment on view public.rapport_journalier is
  'Rapport du soir par restaurant et par jour (commandes livrees uniquement, heure de Nosy Be). '
  'a_reverser_au_restaurant = marchandise moins commission. '
  'total_taxi_food = commission + livraison NETTE de remise promo. '
  'encaisse_par_les_livreurs = ESPECES uniquement : c''est le cash a rendre. '
  'carte_non_encaissee doit rester a zero. '
  'emballage_a_arbitrer n''est attribue a personne : decision a prendre.';

-- ============================================================================
-- Garde-fou de devise : le facteur 100 n'est pas universel
-- ============================================================================
--
-- `montant_eur_centimes` multiplie en dur par 100 parce que l'euro a deux
-- decimales. `payment_config.devise_paiement` n'etait contrainte qu'a etre en
-- minuscules : y ecrire 'jpy' (zero decimale) ferait facturer CENT FOIS le prix,
-- sans qu'aucun controle ne proteste. La colonne du taux s'appelle
-- `fx_ar_per_eur` : la devise est de fait l'euro, autant que la base le dise.
alter table public.payment_config
  drop constraint if exists payment_config_devise_supportee;
alter table public.payment_config
  add constraint payment_config_devise_supportee
  check (devise_paiement = 'eur');
