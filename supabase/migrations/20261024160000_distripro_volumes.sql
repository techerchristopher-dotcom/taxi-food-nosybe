-- LOT 5 — Volumes réels d'un restaurant, par catégorie, pour le conseil emballage DistriPro.
-- Appelée par la fonction Edge `distripro` (service_role), APRÈS vérification que
-- l'appelant est bien staff actif de ce restaurant. Commandes livrées seulement ;
-- `forfait` = emballage moyen facturé au client par plat de la catégorie.
create or replace function public.distripro_volumes(p_restaurant uuid, p_jours integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('categorie', categorie, 'plats', plats, 'forfait', forfait)
                            order by plats desc), '[]'::jsonb)
  from (
    select c.name as categorie,
           sum(oi.quantity)::int as plats,
           round(avg(coalesce(oi.packaging_fee_snapshot, 0)))::int as forfait
    from orders o
    join order_items oi on oi.order_id = o.id and oi.retire_le is null
    join products p on p.id = oi.product_id
    join categories c on c.id = p.category_id
    where o.restaurant_id = p_restaurant
      and o.status = 'livree'
      and o.created_at > now() - make_interval(days => greatest(least(coalesce(p_jours, 30), 90), 7))
    group by c.name
  ) t
$$;
revoke all on function public.distripro_volumes(uuid, integer) from public, anon, authenticated;
grant execute on function public.distripro_volumes(uuid, integer) to service_role;
