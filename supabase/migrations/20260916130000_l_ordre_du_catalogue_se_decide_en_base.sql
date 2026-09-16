-- L'ordre du catalogue se décide en base.
--
-- POURQUOI. Rien ne disait dans quel ordre montrer les restaurants, et les deux
-- surfaces triaient chacune à leur façon — mal toutes les deux :
--   * l'application triait par date de création : Taxi Be, le plus ancien,
--     sortait EN TÊTE alors qu'on ne peut rien y commander ;
--   * la vitrine triait par `listing_status.asc`, un tri ALPHABÉTIQUE :
--     « coming_soon » précède « visible », si bien que les partenaires où l'on
--     ne peut pas commander passaient AVANT ceux où l'on peut.
-- Deux règles écrites séparément finissent toujours par diverger. L'ordre vit
-- donc ici, une seule fois, et les deux surfaces se contentent de le suivre.
--
-- DEUX COLONNES, ET POURQUOI PAS UNE SEULE.
--   sort_order     — le rang choisi à la main, modifiable depuis l'admin ;
--   rang_catalogue — ce que les surfaces trient réellement : le STATUT d'abord,
--                    le rang choisi ensuite. Colonne GÉNÉRÉE : elle ne peut pas
--                    se désynchroniser de ce qui la compose.
-- Le statut passe AVANT le rang choisi, et c'est délibéré. Avec un sort_order
-- seul, le jour où La Plage ouvre (rang 60), elle resterait derrière Les
-- Siciliens (rang 30) encore fermés : il faudrait penser à renuméroter, et
-- l'ordre redeviendrait faux au premier oubli. Ici, passer un restaurant en
-- `visible` suffit à le faire remonter parmi les disponibles.
--
-- ⚠️ PAS DE VUE. `restaurants` porte quatre colonnes calculées PostgREST
-- (commandable_maintenant, horaires_du_jour, ouvert_maintenant, services_du_jour)
-- qui prennent la LIGNE ENTIÈRE : une vue les perdrait, et les jointures
-- imbriquées PostgREST se nomment d'après la relation cible. Une colonne de plus
-- sur la table ne casse aucun appel existant.
--
-- ⚠️ Ne jamais antidater created_at pour faire remonter un restaurant : ça casse
-- l'historique, et ça ne se voit pas. created_at ne sert plus qu'à départager
-- deux restaurants de même rang.
--
-- Les rangs laissent de l'air (10, 20, 30…) : insérer un partenaire entre deux
-- autres ne doit pas obliger à renuméroter la table.


-- =====================================================================
-- 1. Les deux colonnes
-- =====================================================================
alter table public.restaurants
  add column if not exists sort_order integer not null default 0;

-- Borné pour que le statut domine TOUJOURS dans rang_catalogue : un rang choisi
-- de 150 000 ferait passer un « bientôt disponible » devant un restaurant ouvert.
alter table public.restaurants
  add constraint restaurants_sort_order_borne check (sort_order between 0 and 99999);

alter table public.restaurants
  add column if not exists rang_catalogue integer
  generated always as (
    (case listing_status when 'visible' then 0 when 'coming_soon' then 1 else 2 end) * 100000
    + sort_order
  ) stored;

comment on column public.restaurants.sort_order is
  'Rang choisi à la main dans le catalogue (10, 20, 30…). Modifiable par admin_ordonner_restaurant(). Ne pas trier dessus directement : trier sur rang_catalogue.';
comment on column public.restaurants.rang_catalogue is
  'Clé de tri du catalogue, générée : le statut d''abord (visible, puis coming_soon, puis hidden), le rang choisi ensuite. C''est LA colonne que l''application et la vitrine suivent.';


-- =====================================================================
-- 2. Les rangs des restaurants existants
-- =====================================================================
-- Angelo est `hidden` et ne s'affiche nulle part, mais il garde des commandes
-- dans l'historique des clients : il reçoit un rang comme les autres, il n'est
-- pas absent. Les trois nouveaux (40, 50, 60) sont posés par la migration qui
-- les crée.
update public.restaurants set sort_order = 10 where id = '958faac6-61ab-4ff5-9226-b8adab46ed24'; -- La Cabane
update public.restaurants set sort_order = 20 where id = '700e8f32-e966-476a-b371-02884d08dea1'; -- Chez Bidul & Truc
update public.restaurants set sort_order = 30 where id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b'; -- Les Siciliens
update public.restaurants set sort_order = 70 where id = 'cb482596-b39e-4355-96a5-3dfdad75dcee'; -- Angelo
update public.restaurants set sort_order = 90 where id = 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886'; -- Taxi Be, dernier de tous


-- =====================================================================
-- 3. L'admin peut changer un rang
-- =====================================================================
-- Sans cette porte, chaque nouveau partenaire obligerait à revenir en SQL, et
-- l'ordre redeviendrait faux au premier oubli.
--
-- ⚠️ Fonction À PART, et non un paramètre de plus sur admin_update_restaurant :
-- « create or replace » avec une signature différente AJOUTE une surcharge, et
-- PostgREST répond alors PGRST203 sur l'écran d'édition des restaurants.
create or replace function public.admin_ordonner_restaurant(
  p_restaurant_id uuid,
  p_sort_order    integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_avant integer;
  v_nom   text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  if p_sort_order is null or p_sort_order < 0 or p_sort_order > 99999 then
    raise exception 'Rang entre 0 et 99999';
  end if;

  select r.sort_order, r.name into v_avant, v_nom
    from public.restaurants r
   where r.id = p_restaurant_id
   for update;

  if v_nom is null then
    raise exception 'Restaurant introuvable';
  end if;

  update public.restaurants set sort_order = p_sort_order where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, avant, apres, motif)
  values (auth.uid(), 'restaurant_ordonne', v_avant::text, p_sort_order::text, v_nom);
end;
$$;

comment on function public.admin_ordonner_restaurant(uuid, integer) is
  'Change le rang d''un restaurant dans le catalogue. Réservée aux administrateurs, journalisée dans admin_actions.';

revoke all on function public.admin_ordonner_restaurant(uuid, integer) from public, anon;
grant execute on function public.admin_ordonner_restaurant(uuid, integer) to authenticated;


-- =====================================================================
-- 4. L'écran admin suit le même ordre que les clients
-- =====================================================================
-- Il triait par nom : le fondateur voyait un ordre, les clients un autre. Il
-- reçoit aussi sort_order (pour le modifier) et listing_status (pour comprendre
-- pourquoi un rang 30 passe derrière un rang 60).
--
-- ⚠️ DROP obligatoire : changer les colonnes rendues d'une fonction
-- « returns table » est refusé par « create or replace ». Les deux écrans qui
-- l'appellent (Restaurants.tsx, Report.tsx) lisent leurs colonnes par nom : les
-- deux colonnes ajoutées ne les dérangent pas.
drop function if exists public.admin_lister_restaurants();

create function public.admin_lister_restaurants()
returns table (
  id uuid,
  name text,
  cuisine_type text,
  delivery_fee integer,
  min_order integer,
  commission_rate numeric,
  zone_served text,
  is_open boolean,
  food_types text[],
  opens_at time without time zone,
  closes_at time without time zone,
  sort_order integer,
  listing_status text
)
language plpgsql
stable
security definer
set search_path = public
as $function$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  return query
  select r.id,
         r.name,
         r.cuisine_type,
         r.delivery_fee,
         r.min_order,
         r.commission_rate,
         r.zone_served,
         r.is_open,
         r.food_types,
         r.opens_at,
         r.closes_at,
         r.sort_order,
         r.listing_status
    from public.restaurants r
   order by r.rang_catalogue, r.created_at;
end;
$function$;

revoke all on function public.admin_lister_restaurants() from public, anon;
grant execute on function public.admin_lister_restaurants() to authenticated;

comment on function public.admin_lister_restaurants() is
  'Liste des restaurants pour l''admin, avec commission, rang et statut, dans l''ordre exact du catalogue client (rang_catalogue).';
