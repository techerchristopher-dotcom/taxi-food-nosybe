-- 20260825_commission_et_rapport_journalier.sql
-- Applique sur la base de production le 2026-08-25 via le connecteur MCP.
--
-- 1) create_order calcule et FIGE la commission a la creation.
-- 2) Vue rapport_journalier : ce qu'il faut reverser a chaque restaurant.
--
-- Avant : les colonnes orders.commission_rate et commission_amount existaient
-- mais personne ne les remplissait. Six commandes en portaient une, posee a la
-- main. Les autres etaient a NULL — impossible de savoir ce qu'on avait gagne.
--
-- Trois regles, dans l'ordre d'importance :
--
-- 1. LA COMMISSION PORTE SUR LA MARCHANDISE SEULE (subtotal), jamais sur le
--    total. La livraison n'est pas du chiffre d'affaires du restaurant : elle
--    revient integralement a Taxi Food. Prendre un pourcentage du total
--    reviendrait a se commissionner sur son propre revenu.
-- 2. LE TAUX EST FIGE SUR LA COMMANDE, pas lu au moment du calcul. Le jour ou
--    un taux est renegocie, l'historique ne se reecrit pas et les
--    reversements deja faits restent justes.
-- 3. Le montant est ARRONDI A L'ARIARY. Pas de centime a Madagascar.
--
-- Ce qui revient a chacun, pour une commande :
--   restaurant  = subtotal - commission_amount
--   Taxi Food   = commission_amount + delivery_fee
--
-- ⚠️ Le corps complet de create_order n'est pas recopie ici : voir la version
-- en base (elle fait 130 lignes, dont la validation des options). Seuls
-- changent la lecture de commission_rate au debut, et le calcul de
-- commission_amount dans l'UPDATE final.

create or replace view public.rapport_journalier as
select
  (o.created_at at time zone 'Indian/Antananarivo')::date as jour,
  r.id   as restaurant_id,
  r.name as restaurant,
  count(*)                                  as commandes,
  sum(o.subtotal)                           as ca_marchandise,
  sum(o.commission_amount)                  as commission_taxi_food,
  sum(o.subtotal - o.commission_amount)     as a_reverser_au_restaurant,
  sum(o.delivery_fee)                       as livraisons_taxi_food,
  sum(o.commission_amount + o.delivery_fee) as total_taxi_food,
  sum(o.total)                              as encaisse_par_les_livreurs
from public.orders o
join public.restaurants r on r.id = o.restaurant_id
where o.status = 'livree'      -- une commande refusee n'a rien encaisse
group by 1, 2, 3;

revoke all on public.rapport_journalier from public, anon, authenticated;

comment on view public.rapport_journalier is
  'Rapport du soir par restaurant et par jour (commandes livrees uniquement, heure de Nosy Be). '
  'a_reverser_au_restaurant = marchandise moins commission. '
  'total_taxi_food = commission + livraison.';
