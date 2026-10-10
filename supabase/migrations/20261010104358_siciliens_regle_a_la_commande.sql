-- Les Siciliens : « réglé à la commande », automatique (2026-10-10, demande du porteur du projet).
--
-- Le porteur du projet paie Les Siciliens SUR PLACE en passant la commande : il n'y a jamais rien
-- à leur reverser. Leur moyen de reversement devient `regle_a_la_commande`, et :
--
-- - à la LIVRAISON (passage à `livree`, quel que soit le chemin : livreur ou admin), la commande
--   est rattachée par `settlement_orders` à un versement de type `regle_a_la_commande` — sans
--   référence Orange Money, `telegram_statut = 'non_prevu'` : aucun message ne part ;
-- - elle sort donc de « à reverser » et du dû (la clé primaire de `settlement_orders` empêche
--   aussi tout versement Orange Money dessus), mais reste dans le rapport : chiffre d'affaires et
--   marge complets ;
-- - si la commande ressort de `livree`, son versement « réglé » est supprimé (il n'y a rien eu à
--   régler) ;
-- - si elle est CORRIGÉE (chantier 1), le net figé du rattachement suit. Une commande réglée à la
--   commande reste corrigeable : seul un versement Orange Money bloque une correction.
--
-- Un versement « réglé » par commande : c'est une écriture comptable, pas un paiement groupé.
-- Le trigger n'échoue JAMAIS : une erreur devient un WARNING, la livraison passe toujours.
--
-- `admin_commandes_a_reverser` et `admin_commandes_deja_reversees` gagnent une dernière colonne
-- `type_versement` (DROP + CREATE : le type de retour change ; mêmes calculs à l'octet).

insert into public.restaurant_reversement (restaurant_id, moyen)
values ('aee1c612-5ee0-402b-a7b4-aec9c6825b0b', 'regle_a_la_commande')
on conflict (restaurant_id) do update set moyen = 'regle_a_la_commande', maj_le = now();

create or replace function public.regler_commande_a_la_commande(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_net integer;
  v_jour date;
  v_id uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or o.status <> 'livree' then return null; end if;
  if (select m.moyen from public.moyen_reversement_de(o.restaurant_id) m) is distinct from 'regle_a_la_commande' then
    return null;
  end if;
  if exists (select 1 from public.settlement_orders so where so.order_id = o.id) then return null; end if;

  select (o.subtotal + (o.packaging_fee - o.emballage_taxifood)
          - coalesce(o.commission_amount,
                     greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                    * r.commission_rate)::integer, 0))
          - o.remise_charge_restaurant)::integer
    into v_net
  from public.restaurants r where r.id = o.restaurant_id;
  v_jour := (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date;

  insert into public.restaurant_settlements (
    restaurant_id, period_start, period_end, amount_due, paid_amount, paid_at, created_by,
    reference_versement, nb_commandes, numeros_commandes, telegram_statut,
    type_versement, moyen_reversement, destination_reversement)
  values (
    o.restaurant_id, v_jour, v_jour, v_net, v_net, coalesce(o.delivered_at, now()), auth.uid(),
    null, 1, array[o.order_number], 'non_prevu',
    'regle_a_la_commande', 'regle_a_la_commande', null)
  returning id into v_id;

  insert into public.settlement_orders (order_id, settlement_id, restaurant_id, net)
  values (o.id, v_id, o.restaurant_id, v_net);
  return v_id;
end $$;
revoke all on function public.regler_commande_a_la_commande(uuid) from public, anon, authenticated;

create or replace function public.orders_regle_a_la_commande()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return null; end if;
  begin
    if new.status = 'livree' then
      perform public.regler_commande_a_la_commande(new.id);
    elsif old.status = 'livree' then
      delete from public.restaurant_settlements s
       where s.type_versement = 'regle_a_la_commande'
         and s.id in (select so.settlement_id from public.settlement_orders so where so.order_id = new.id);
    end if;
  exception when others then
    raise warning 'reglement a la commande non pose pour % : %', new.order_number, sqlerrm;
  end;
  return null;
end $$;
revoke all on function public.orders_regle_a_la_commande() from public, anon, authenticated;
drop trigger if exists orders_regle_a_la_commande on public.orders;
create trigger orders_regle_a_la_commande after update of status on public.orders
  for each row execute function public.orders_regle_a_la_commande();

-- Une commande corrigée : le net figé de son rattachement « réglé » suit.
create or replace function public.orders_resynchroniser_net_regle()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_net integer;
  v_sid uuid;
begin
  select so.settlement_id into v_sid
  from public.settlement_orders so
  join public.restaurant_settlements s on s.id = so.settlement_id and s.type_versement = 'regle_a_la_commande'
  where so.order_id = new.id;
  if v_sid is null then return null; end if;
  v_net := (new.subtotal + (new.packaging_fee - new.emballage_taxifood)
            - coalesce(new.commission_amount, 0) - new.remise_charge_restaurant)::integer;
  update public.settlement_orders set net = v_net where order_id = new.id;
  update public.restaurant_settlements set amount_due = v_net, paid_amount = v_net where id = v_sid;
  return null;
end $$;
revoke all on function public.orders_resynchroniser_net_regle() from public, anon, authenticated;
drop trigger if exists orders_resynchroniser_net_regle on public.orders;
create trigger orders_resynchroniser_net_regle
  after update of subtotal, packaging_fee, emballage_taxifood, commission_amount, remise_charge_restaurant on public.orders
  for each row execute function public.orders_resynchroniser_net_regle();

-- Seul un versement Orange Money bloque une correction.
create or replace function public.commande_reversee_bloque_correction(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.settlement_orders so
                 join public.restaurant_settlements s on s.id = so.settlement_id
                 where so.order_id = p_order_id and s.type_versement <> 'regle_a_la_commande')
$$;
revoke all on function public.commande_reversee_bloque_correction(uuid) from public, anon, authenticated;

-- Les deux lectures du rapport disent le TYPE de rattachement.
drop function if exists public.admin_commandes_a_reverser(uuid, date, date);
create function public.admin_commandes_a_reverser(p_restaurant_id uuid, p_period_start date, p_period_end date)
returns table(order_id uuid, order_number text, livree_le timestamptz, montant integer, plats integer, emballage integer,
              commission integer, offert integer, net integer, deja_reverse boolean, settlement_id uuid,
              reverse_le timestamptz, reference_versement text, type_versement text)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  return query
  select o.id,
         o.order_number,
         coalesce(o.delivered_at, o.created_at),
         (o.subtotal + (o.packaging_fee - o.emballage_taxifood))::integer,
         o.subtotal::integer,
         (o.packaging_fee - o.emballage_taxifood)::integer,
         coalesce(o.commission_amount,
                  greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                 * r.commission_rate)::integer, 0))::integer,
         o.remise_charge_restaurant::integer,
         (o.subtotal + (o.packaging_fee - o.emballage_taxifood)
          - coalesce(o.commission_amount,
                     greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                    * r.commission_rate)::integer, 0))
          - o.remise_charge_restaurant)::integer,
         (so.order_id is not null),
         s.id,
         s.paid_at,
         s.reference_versement,
         s.type_versement
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  left join public.settlement_orders so on so.order_id = o.id
  left join public.restaurant_settlements s on s.id = so.settlement_id
  where o.restaurant_id = p_restaurant_id and o.status = 'livree'
    and (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end
  order by coalesce(o.delivered_at, o.created_at), o.order_number;
end;
$function$;
revoke all on function public.admin_commandes_a_reverser(uuid, date, date) from public, anon;
grant execute on function public.admin_commandes_a_reverser(uuid, date, date) to authenticated;

drop function if exists public.admin_commandes_deja_reversees(date, date);
create function public.admin_commandes_deja_reversees(p_period_start date, p_period_end date)
returns table(order_id uuid, order_number text, restaurant_id uuid, settlement_id uuid, reverse_le timestamptz,
              reference_versement text, net integer, type_versement text)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  return query
  select o.id, o.order_number, o.restaurant_id, s.id, s.paid_at, s.reference_versement, so.net, s.type_versement
  from public.settlement_orders so
  join public.orders o on o.id = so.order_id
  join public.restaurant_settlements s on s.id = so.settlement_id
  where (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end;
end;
$function$;
revoke all on function public.admin_commandes_deja_reversees(date, date) from public, anon;
grant execute on function public.admin_commandes_deja_reversees(date, date) to authenticated;

-- Reprise : les commandes livrées des Siciliens qui attendent (garde : exactement 4).
do $$
declare n int := 0; v uuid; r record;
begin
  for r in select o.id from public.orders o
           where o.restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b' and o.status = 'livree'
             and not exists (select 1 from public.settlement_orders so where so.order_id = o.id)
  loop
    v := public.regler_commande_a_la_commande(r.id);
    if v is not null then n := n + 1; end if;
  end loop;
  if n <> 4 then raise exception 'Reprise Siciliens : % commande(s) réglée(s), 4 attendues', n; end if;
end $$;
