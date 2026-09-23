-- Une commande n'appartient qu'à UN reversement (2026-09-23).
--
-- POURQUOI. Jusqu'ici le lien entre une commande et le versement qui l'a payée
-- n'était qu'IMPLICITE : restaurant + période. « Voir les 8 commandes » d'un
-- restaurant affichait ensemble des commandes déjà payées et des commandes qui
-- restaient dues, sans rien pour les distinguer. Le seul garde-fou était le
-- refus de toute période CHEVAUCHANT un versement existant : grossier (il
-- interdisait aussi de rattraper une commande livrée en retard) et facile à
-- contourner (une période décalée d'un jour).
--
-- CE QUE FAIT CETTE MIGRATION. Une table de liaison `settlement_orders` dont la
-- CLÉ PRIMAIRE est `order_id` : la base elle-même rend impossible qu'une
-- commande soit payée deux fois. Elle est remplie par `admin_enregistrer_versement`
-- dans la MÊME transaction que le versement.
--
-- CONSÉQUENCE : le refus par chevauchement de période DISPARAÎT, remplacé par
-- un contrôle bien plus fin. Un versement ne retient désormais que les
-- commandes NON ENCORE RATTACHÉES de la période. Cela couvre enfin :
--   - le reversement partiel d'une période, puis le solde ;
--   - la commande livrée tardivement, rattrapée dans la période suivante ;
--   - la commande sans `delivered_at` (passée « livrée » depuis l'admin, cf.
--     TF-248) : elle est datée par `created_at`, comme partout ailleurs, donc
--     elle reste rattachable et visible.
--
-- RÈGLE DE PÉRIODE RETENUE POUR LA REPRISE DE L'EXISTANT. Celle que le calcul
-- applique aujourd'hui, lue dans `record_settlement` et recopiée à l'octet dans
-- `admin_commandes_a_reverser` (et dans `admin/lib/reversement.ts` côté écran) :
--     status = 'livree'
--     ET (coalesce(delivered_at, created_at) AT TIME ZONE 'Indian/Antananarivo')::date
--         BETWEEN period_start AND period_end
--     ET restaurant_id = celui du reversement
-- Rien d'autre : ni le montant, ni la référence n'entrent dans le rattachement.
-- Si deux reversements d'un même restaurant revendiquaient la même commande
-- (aucun cas aujourd'hui : les trois périodes enregistrées sont disjointes),
-- c'est le PLUS ANCIEN qui la garde (`order by s.created_at`), parce que c'est
-- lui qui a été payé le premier.

-- ------------------------------------------------------------ 1. La liaison

-- Adossée à (id, restaurant_id) : la base refuse de rattacher une commande à un
-- reversement qui n'est pas celui de SON restaurant. Sans cet index, la
-- cohérence ne tiendrait qu'au code de la RPC.
create unique index if not exists orders_id_restaurant_id_key
  on public.orders (id, restaurant_id);

create table if not exists public.settlement_orders (
  -- LA garantie anti-double-paiement : une commande, une ligne, un reversement.
  order_id uuid primary key,
  settlement_id uuid not null references public.restaurant_settlements(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  -- Le net figé au moment du versement : ce qu'on a effectivement payé pour
  -- cette commande, même si la commande bougeait après coup.
  net integer not null,
  created_at timestamptz not null default now(),
  constraint settlement_orders_order_fk
    foreign key (order_id, restaurant_id) references public.orders (id, restaurant_id) on delete cascade
);

create index if not exists settlement_orders_settlement_idx
  on public.settlement_orders (settlement_id);
create index if not exists settlement_orders_restaurant_idx
  on public.settlement_orders (restaurant_id);

comment on table public.settlement_orders is
  'Quelle commande a été payée par quel reversement. Clé primaire sur order_id : une commande ne peut appartenir qu''à UN reversement. Remplie par admin_enregistrer_versement, dans la même transaction.';

-- RLS active SANS AUCUNE POLITIQUE : rien n'est lisible ni écrivable par la clé
-- publique ni par un compte connecté. Tout passe par les RPC `is_admin()`.
alter table public.settlement_orders enable row level security;
revoke all on public.settlement_orders from public, anon, authenticated;

-- --------------------------------------- 2. Reprise des reversements existants

insert into public.settlement_orders (order_id, settlement_id, restaurant_id, net)
select distinct on (o.id)
       o.id,
       s.id,
       s.restaurant_id,
       (o.subtotal + o.packaging_fee
        - coalesce(o.commission_amount,
                   greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                  * r.commission_rate)::integer, 0))
        - o.remise_charge_restaurant)::integer
from public.restaurant_settlements s
join public.orders o
  on o.restaurant_id = s.restaurant_id
 and o.status = 'livree'
 and (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
     between s.period_start and s.period_end
join public.restaurants r on r.id = o.restaurant_id
order by o.id, s.created_at
on conflict (order_id) do nothing;

-- ------------------------------- 3. Le détail dit désormais ce qui est payé

-- Le type de retour change : il faut supprimer avant de recréer (create or
-- replace ne sait pas changer une colonne de sortie). Une seule signature
-- existe, donc aucun risque de PGRST203.
drop function if exists public.admin_commandes_a_reverser(uuid, date, date);

create function public.admin_commandes_a_reverser(
  p_restaurant_id uuid, p_period_start date, p_period_end date)
returns table (
  order_id uuid,
  order_number text,
  livree_le timestamptz,
  montant integer,      -- plats + emballage : la base du restaurant
  plats integer,
  emballage integer,
  commission integer,
  offert integer,       -- part offerte par le restaurant (code offert)
  net integer,          -- ce que Taxi Food lui doit pour cette commande
  -- Depuis le 2026-09-23 : ce que ce détail ne disait pas.
  deja_reverse boolean,
  settlement_id uuid,
  reverse_le timestamptz,
  reference_versement text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  -- ⚠️ Formule et filtre recopiés de `record_settlement` À L'OCTET. Toute
  -- évolution de l'une se porte dans l'autre (le test de recette compare).
  -- Les commandes DÉJÀ RATTACHÉES restent dans la liste — les cacher ferait
  -- disparaître de l'écran des commandes bien réelles. Elles sont marquées, et
  -- c'est `admin_enregistrer_versement` qui les écarte du montant.
  return query
  select o.id,
         o.order_number,
         coalesce(o.delivered_at, o.created_at),
         (o.subtotal + o.packaging_fee)::integer,
         o.subtotal::integer,
         o.packaging_fee::integer,
         coalesce(o.commission_amount,
                  greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                 * r.commission_rate)::integer, 0))::integer,
         o.remise_charge_restaurant::integer,
         (o.subtotal + o.packaging_fee
          - coalesce(o.commission_amount,
                     greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                    * r.commission_rate)::integer, 0))
          - o.remise_charge_restaurant)::integer,
         (so.order_id is not null),
         s.id,
         s.paid_at,
         s.reference_versement
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.settlement_orders so on so.order_id = o.id
  left join public.restaurant_settlements s on s.id = so.settlement_id
  where o.restaurant_id = p_restaurant_id and o.status = 'livree'
    and (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end
  order by coalesce(o.delivered_at, o.created_at), o.order_number;
end;
$$;

-- Les commandes déjà reversées d'une période, tous restaurants : ce que le
-- Rapport de clôture doit soustraire de ce qu'il propose de payer.
create or replace function public.admin_commandes_deja_reversees(
  p_period_start date, p_period_end date)
returns table (
  order_id uuid,
  order_number text,
  restaurant_id uuid,
  settlement_id uuid,
  reverse_le timestamptz,
  reference_versement text,
  net integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  return query
  select o.id, o.order_number, o.restaurant_id, s.id, s.paid_at, s.reference_versement, so.net
  from public.settlement_orders so
  join public.orders o on o.id = so.order_id
  join public.restaurant_settlements s on s.id = so.settlement_id
  where (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end;
end;
$$;

-- --------------------------- 4. Le versement ne paie que ce qui reste à payer

create or replace function public.admin_enregistrer_versement(
  p_restaurant_id uuid, p_period_start date, p_period_end date,
  p_paid_amount integer, p_reference text, p_du_attendu integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_cle text;
  v_du integer;
  v_nb integer;
  v_deja integer;
  v_numeros text[];
  v_chat text;
  v_exist public.restaurant_settlements;
  v_nom text;
  v_row public.restaurant_settlements;
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;

  if p_restaurant_id is null or p_period_start is null or p_period_end is null then
    raise exception 'Restaurant et période obligatoires';
  end if;
  if p_period_start > p_period_end then
    raise exception 'Période invalide : le début est après la fin';
  end if;

  v_ref := btrim(regexp_replace(coalesce(p_reference, ''), '\s+', ' ', 'g'));
  if v_ref = '' then
    raise exception 'Référence du versement obligatoire (ID de transaction Orange Money)';
  end if;
  if length(v_ref) < 4 or length(v_ref) > 64 then
    raise exception 'Référence du versement invalide : entre 4 et 64 caractères';
  end if;
  v_cle := upper(regexp_replace(v_ref, '\s', '', 'g'));

  if p_paid_amount is null or p_paid_amount <= 0 then
    raise exception 'Montant versé invalide';
  end if;

  select name, telegram_chat_id into v_nom, v_chat from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  -- Deux clics, deux onglets : un seul passe. Le verrou tient jusqu'à la fin
  -- de la transaction ; le second appel relit alors les rattachements du premier.
  perform pg_advisory_xact_lock(hashtextextended('versement:' || p_restaurant_id::text, 0));

  -- ⚠️ Le refus par CHEVAUCHEMENT DE PÉRIODE a disparu le 2026-09-23. Il
  -- interdisait de solder une période entamée et de rattraper une commande
  -- livrée en retard, et il ne protégeait rien qu'une période décalée d'un jour
  -- ne contournait. Ce qui protège désormais, c'est `settlement_orders` :
  -- commande par commande, avec une clé primaire pour l'imposer.

  select * into v_exist
  from public.restaurant_settlements s
  where upper(regexp_replace(s.reference_versement, '\s', '', 'g')) = v_cle
  limit 1;
  if found then
    raise exception 'Référence déjà utilisée : % sert déjà au versement du % au % (enregistré le %).',
      v_ref,
      to_char(v_exist.period_start, 'DD/MM/YYYY'),
      to_char(v_exist.period_end, 'DD/MM/YYYY'),
      to_char(v_exist.paid_at at time zone 'Indian/Antananarivo', 'DD/MM/YYYY');
  end if;

  -- Le dû et la liste viennent de LA fonction qui alimente le détail à l'écran,
  -- et NE RETIENNENT QUE les commandes non encore rattachées à un reversement.
  select coalesce(sum(c.net) filter (where not c.deja_reverse), 0)::integer,
         (count(*) filter (where not c.deja_reverse))::integer,
         (count(*) filter (where c.deja_reverse))::integer,
         coalesce(array_agg(c.order_number order by c.livree_le, c.order_number)
                    filter (where not c.deja_reverse), '{}')
    into v_du, v_nb, v_deja, v_numeros
  from public.admin_commandes_a_reverser(p_restaurant_id, p_period_start, p_period_end) c;

  if v_nb = 0 then
    if v_deja > 0 then
      raise exception 'Rien à reverser : les % commande(s) livrée(s) de % sur cette période ont déjà été reversées. Aucun deuxième versement enregistré.',
        v_deja, v_nom;
    end if;
    raise exception 'Aucune commande livrée pour % sur cette période : rien à reverser', v_nom;
  end if;

  -- L'écran a montré un montant ; si une commande a bougé entre-temps, on ne
  -- l'enregistre pas en silence.
  if p_du_attendu is distinct from v_du then
    raise exception 'Le dû a changé depuis l''affichage (% Ar affichés, % Ar en base). Recharge le rapport.',
      p_du_attendu, v_du;
  end if;

  begin
    insert into public.restaurant_settlements (
      restaurant_id, period_start, period_end, amount_due, paid_amount, created_by,
      reference_versement, nb_commandes, numeros_commandes, telegram_statut)
    values (
      p_restaurant_id, p_period_start, p_period_end, v_du, p_paid_amount, auth.uid(),
      v_ref, v_nb, v_numeros,
      case when nullif(btrim(coalesce(v_chat, '')), '') is null then 'sans_canal' else 'en_attente' end)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Référence déjà utilisée : % sert déjà à un autre versement.', v_ref;
  end;

  -- MÊME TRANSACTION que le versement : soit les deux, soit ni l'un ni l'autre.
  begin
    insert into public.settlement_orders (order_id, settlement_id, restaurant_id, net)
    select c.order_id, v_row.id, p_restaurant_id, c.net
    from public.admin_commandes_a_reverser(p_restaurant_id, p_period_start, p_period_end) c
    where not c.deja_reverse;
  exception when unique_violation then
    -- Filet : le verrou consultatif rend ce cas très improbable, mais la clé
    -- primaire reste la dernière autorité, et elle annule tout le versement.
    raise exception 'Une commande de cette période vient d''être reversée par ailleurs. Recharge le rapport ; aucun versement n''a été enregistré.';
  end;

  return v_row;
end;
$$;

-- ------------------------------------------------------------ 5. L'ancienne voie

-- `record_settlement` (4 arguments) écrit un reversement SANS rattacher la
-- moindre commande : elle rouvrirait le double paiement par la porte de
-- derrière. Son corps ne bouge pas — le test de recette compare toujours son
-- montant à celui du détail — mais plus personne ne peut l'appeler depuis
-- l'application : ni la clé publique, ni un compte connecté, fût-il admin.
revoke all on function public.record_settlement(uuid, date, date, integer) from public, anon, authenticated;

-- ------------------------------------------------------------------ 6. Droits
-- ⚠️ `revoke from public` ne retire PAS anon / authenticated (ALTER DEFAULT
-- PRIVILEGES de Supabase) : chaque rôle est révoqué nommément.
revoke all on function public.admin_commandes_a_reverser(uuid, date, date) from public, anon, authenticated;
revoke all on function public.admin_commandes_deja_reversees(date, date) from public, anon, authenticated;
revoke all on function public.admin_enregistrer_versement(uuid, date, date, integer, text, integer) from public, anon, authenticated;

grant execute on function public.admin_commandes_a_reverser(uuid, date, date) to authenticated, service_role;
grant execute on function public.admin_commandes_deja_reversees(date, date) to authenticated, service_role;
grant execute on function public.admin_enregistrer_versement(uuid, date, date, integer, text, integer) to authenticated, service_role;
