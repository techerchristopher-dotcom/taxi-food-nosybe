-- Le restaurant voit ses reversements (2026-10-12).
--
-- Dans l'Historique de l'espace restaurateur, chaque commande livrée dit si Taxi Food l'a
-- déjà reversée (date, référence Orange Money, montant de CETTE commande et du versement
-- entier), si elle est « réglée à la commande » (Les Siciliens) ou encore « à reverser », avec
-- le détail du calcul : plats + emballage − commission − part offerte = reversé. Écran
-- « Mes versements » : un versement par ligne et ses commandes.
--
-- `settlement_orders` et `restaurant_settlements` restent fermées : deux RPC SECURITY DEFINER,
-- gardées par `is_active_restaurant_staff_of(restaurant)`. Le montant d'une commande déjà
-- reversée est le `net` FIGÉ dans `settlement_orders` ; sinon la formule de
-- `admin_commandes_a_reverser`, recopiée à l'identique. Ni le numéro destinataire du versement
-- (`destination_reversement`) ni l'auteur ne sortent.

create or replace function public.mes_reversements_commandes(p_restaurant_id uuid)
returns table (
  order_id uuid, plats integer, emballage integer, commission integer, taux numeric,
  offert integer, net integer, etat text, reverse_le timestamptz, reference text,
  moyen text, versement_montant integer, versement_nb integer, langue text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_active_restaurant_staff_of(p_restaurant_id) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return query
  select o.id,
         o.subtotal::integer,
         (o.packaging_fee - o.emballage_taxifood)::integer,
         coalesce(o.commission_amount,
                  greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                 * r.commission_rate)::integer, 0))::integer,
         coalesce(o.commission_rate, r.commission_rate)::numeric,
         o.remise_charge_restaurant::integer,
         coalesce(so.net,
           (o.subtotal + (o.packaging_fee - o.emballage_taxifood)
            - coalesce(o.commission_amount,
                       greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                      * r.commission_rate)::integer, 0))
            - o.remise_charge_restaurant))::integer,
         case when s.id is null then 'a_reverser'
              when s.type_versement = 'regle_a_la_commande' then 'regle_a_la_commande'
              else 'reverse' end,
         s.paid_at, s.reference_versement, s.moyen_reversement,
         s.paid_amount, s.nb_commandes, coalesce(r.langue, 'fr')::text
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    left join public.settlement_orders so on so.order_id = o.id
    left join public.restaurant_settlements s on s.id = so.settlement_id
   where o.restaurant_id = p_restaurant_id and o.status = 'livree'
   order by coalesce(o.delivered_at, o.created_at) desc
   limit 500;
end $$;
revoke all on function public.mes_reversements_commandes(uuid) from public, anon;
grant execute on function public.mes_reversements_commandes(uuid) to authenticated;

create or replace function public.mes_versements(p_restaurant_id uuid)
returns table (
  id uuid, paye_le timestamptz, reference text, montant integer, nb_commandes integer,
  numeros text[], moyen text, du date, au date, langue text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_active_restaurant_staff_of(p_restaurant_id) then
    raise exception 'Acces refuse' using errcode = '42501';
  end if;
  return query
  select s.id, s.paid_at, s.reference_versement, s.paid_amount, s.nb_commandes,
         coalesce(s.numeros_commandes::text[],
                  array(select o.order_number::text from public.settlement_orders so
                          join public.orders o on o.id = so.order_id
                         where so.settlement_id = s.id order by o.order_number)),
         s.moyen_reversement, s.period_start, s.period_end, coalesce(r.langue, 'fr')::text
    from public.restaurant_settlements s
    join public.restaurants r on r.id = s.restaurant_id
   where s.restaurant_id = p_restaurant_id
     and s.type_versement is distinct from 'regle_a_la_commande'
   order by s.paid_at desc nulls last
   limit 200;
end $$;
revoke all on function public.mes_versements(uuid) from public, anon;
grant execute on function public.mes_versements(uuid) to authenticated;
