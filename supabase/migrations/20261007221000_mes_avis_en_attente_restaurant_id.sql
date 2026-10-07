-- `mes_avis_en_attente()` renvoie aussi `restaurant_id` : la fiche d'un restaurant propose
-- « Note ta commande TF-xxx » quand le client a une commande à noter CHEZ CE restaurant.
-- Changer le type de retour impose drop + create (droits remis à l'identique).
drop function if exists public.mes_avis_en_attente();
create function public.mes_avis_en_attente()
returns table(order_id uuid, numero text, restaurant text, livree_le timestamptz, limite_le timestamptz, restaurant_id uuid)
language sql stable security definer set search_path to 'public' as $$
  select o.id, o.order_number, r.name,
         coalesce(o.delivered_at, o.status_updated_at),
         coalesce(o.delivered_at, o.status_updated_at) + interval '7 days',
         r.id
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
   where auth.uid() is not null
     and o.user_id = auth.uid()
     and o.status = 'livree'
     and coalesce(o.delivered_at, o.status_updated_at) > now() - interval '7 days'
     and not exists (select 1 from public.avis a where a.order_id = o.id)
     and not exists (select 1 from public.commandes_telephone ct where ct.order_id = o.id)
   order by coalesce(o.delivered_at, o.status_updated_at) desc;
$$;
revoke all on function public.mes_avis_en_attente() from public, anon;
grant execute on function public.mes_avis_en_attente() to authenticated;
