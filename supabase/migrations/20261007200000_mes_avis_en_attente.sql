-- Avis en attente du client (2026-10-07).
--
-- Demande du porteur du projet : depuis la page Porte-monnaie, un bouton « Laisser un avis »
-- avec le NOMBRE d'avis en attente, qui liste les commandes que le client peut encore
-- noter — pour qu'il rattrape et gagne ses 1 000 Ar par avis.
--
-- ⚠️ Mêmes règles que `deposer_avis`, sinon la liste promettrait un avis que la base
-- refuserait : commande du client, `livree`, livrée depuis MOINS DE 7 JOURS (délai gardé
-- tel quel, décision du 2026-10-07), pas d'avis déjà déposé, pas une commande prise par
-- téléphone. `limite_le` = fin du délai, pour afficher « encore N jours ».

create or replace function public.mes_avis_en_attente()
returns table(order_id uuid, numero text, restaurant text, livree_le timestamptz, limite_le timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select o.id, o.order_number, r.name,
         coalesce(o.delivered_at, o.status_updated_at),
         coalesce(o.delivered_at, o.status_updated_at) + interval '7 days'
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
