-- L'admin voit QUI attend l'ouverture d'un restaurant, pas seulement combien
-- (demande du 27/09/2026). Réservé aux administrateurs : ce sont des données
-- personnelles. Les alertes d'abord, puis les simples visiteurs (dernière visite).
create or replace function public.admin_interet_restaurant_detail(p_restaurant_id uuid)
returns table (user_id uuid, nom text, email text, telephone text, kind text, quand timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select i.user_id,
         coalesce(nullif(btrim(p.full_name), ''), '—'),
         coalesce(nullif(btrim(p.email), ''), u.email),
         p.phone,
         i.kind,
         max(i.created_at)
    from public.restaurant_interest i
    left join public.profiles p on p.id = i.user_id
    left join auth.users u on u.id = i.user_id
   where public.is_admin()
     and i.restaurant_id = p_restaurant_id
   group by i.user_id, p.full_name, p.email, u.email, p.phone, i.kind
   order by (i.kind = 'alerte') desc, max(i.created_at) desc;
$$;
revoke all on function public.admin_interet_restaurant_detail(uuid) from public;
grant execute on function public.admin_interet_restaurant_detail(uuid) to authenticated;
