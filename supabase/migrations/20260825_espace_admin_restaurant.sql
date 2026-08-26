-- 20260825_espace_admin_restaurant.sql
-- Applique sur la base de production le 2026-08-25 via le connecteur MCP.
--
-- Espace d'administration du restaurateur : ses horaires, son ouverture, et
-- la mise en rupture d'un produit.
--
-- Jusqu'ici le restaurateur ne pouvait RIEN modifier : restaurants, categories
-- et products n'avaient que des politiques de LECTURE. Tout passait par une
-- intervention en base.
--
-- On n'ouvre pas ces tables en ecriture pour autant. Chaque geste passe par une
-- RPC SECURITY DEFINER qui verifie que l'appelant est du personnel ACTIF du
-- restaurant concerne — meme principe que set_order_status. Verifie : un
-- restaurateur qui vise le produit d'un concurrent recoit « Produit introuvable
-- dans votre carte ».
--
-- ⚠️ Le corps complet des fonctions est en base. Points a retenir :
--
-- ouvert_maintenant(restaurants) : fonction SUR LA LIGNE, donc exposee par
-- PostgREST comme une colonne calculee — le client la demande dans son select,
-- sans qu'on duplique une vue. Elle gere le cas qui se rate : un horaire qui
-- PASSE MINUIT (18:00 -> 02:00) a une borne de fermeture INFERIEURE a celle
-- d'ouverture, et un simple « entre les deux » renverrait ferme toute la
-- soiree. Heure de Nosy Be.
--
-- set_restaurant_open() remet auto_open a false : laisser la bascule manuelle
-- active en mode automatique donnerait un bouton ecrase a la minute suivante.

alter table public.restaurants
  add column if not exists auto_open boolean not null default false;

comment on column public.restaurants.auto_open is
  'true : l''ouverture se deduit de opens_at/closes_at a l''heure de Nosy Be. '
  'false : c''est is_open qui fait foi, bascule a la main par le restaurateur.';

create or replace function public.ouvert_maintenant(r public.restaurants)
returns boolean
language sql
stable
as $$
  select case
    when not r.auto_open then r.is_open
    when r.opens_at is null or r.closes_at is null then r.is_open
    when r.opens_at <= r.closes_at then
      (now() at time zone 'Indian/Antananarivo')::time between r.opens_at and r.closes_at
    else
      (now() at time zone 'Indian/Antananarivo')::time >= r.opens_at
      or (now() at time zone 'Indian/Antananarivo')::time <= r.closes_at
  end;
$$;

comment on function public.ouvert_maintenant(public.restaurants) is
  'Ouverture effective : deduite des horaires si auto_open, sinon is_open. '
  'Gere les horaires qui passent minuit. Heure de Nosy Be.';

-- set_restaurant_hours(time, time, boolean)  -> restaurants
-- set_restaurant_open(boolean)               -> restaurants
-- set_product_available(uuid, boolean)       -> products
-- Voir la definition en base (pg_get_functiondef).
