-- 🥤 Vente additionnelle — la mesure (2026-10-22).
--
-- Constat du porteur du projet : la plupart des commandes partent sans boisson. L'app propose
-- désormais boissons et desserts à trois moments (fiche plat après « Ajouter », panier,
-- récapitulatif). Cette fonction dit si ça marche : par restaurant et par semaine, la part des
-- commandes LIVRÉES qui contiennent une boisson / un dessert, et ce qu'elles ont rapporté.
--
-- Classement d'une ligne, le même que l'app (`app/data/venteAdditionnelle.ts`) :
--   boisson = `categories.est_boisson` OU nom de catégorie boisson/soft/bière/cocktail/jus/milkshake… ;
--   dessert = nom de catégorie dessert/glace/crêpe/gâteau/pâtisserie/gaufre/tarte.
-- Taxi Be (restaurant de test) est exclu. Semaine = lundi, heure de Nosy Be.
-- Montant d'une ligne = unit_price × quantity (options comprises, emballage/consigne NON compris :
-- la consigne n'est pas du chiffre d'affaires boisson).

create or replace function public.admin_vente_additionnelle(p_semaines int default 12)
returns table (
  restaurant_id uuid,
  restaurant text,
  semaine date,
  nb_commandes int,
  nb_avec_boisson int,
  nb_avec_dessert int,
  ca_plats bigint,
  ca_boissons bigint,
  ca_desserts bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;

  return query
  with lignes as (
    select
      o.id as order_id,
      o.restaurant_id,
      (date_trunc('week', (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')))::date as semaine,
      (oi.unit_price * oi.quantity)::bigint as montant,
      case
        when coalesce(c.est_boisson, false)
          or translate(lower(coalesce(c.name, '')), 'éèêàâîïôûùç', 'eeeaaiiouuc')
             ~ '(boisson|drink|soft|biere|cocktail|milkshake|jus|soda|cafe|smoothie|limonade)'
          then 'boisson'
        when translate(lower(coalesce(c.name, '')), 'éèêàâîïôûùç', 'eeeaaiiouuc')
             ~ '(dessert|glace|crepe|gateau|patisserie|gaufre|tarte)'
          then 'dessert'
        else 'plat'
      end as genre
    from orders o
    join order_items oi on oi.order_id = o.id
    left join products p on p.id = oi.product_id
    left join categories c on c.id = p.category_id
    where o.status = 'livree'
      and o.restaurant_id <> 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886'  -- Taxi Be (tests)
      and coalesce(o.delivered_at, o.created_at) >= now() - make_interval(weeks => greatest(1, least(p_semaines, 104)))
  ),
  par_commande as (
    select
      l.order_id, l.restaurant_id, l.semaine,
      bool_or(l.genre = 'boisson') as a_boisson,
      bool_or(l.genre = 'dessert') as a_dessert,
      sum(l.montant) filter (where l.genre = 'plat') as m_plats,
      sum(l.montant) filter (where l.genre = 'boisson') as m_boissons,
      sum(l.montant) filter (where l.genre = 'dessert') as m_desserts
    from lignes l
    group by l.order_id, l.restaurant_id, l.semaine
  )
  select
    pc.restaurant_id,
    r.name,
    pc.semaine,
    count(*)::int,
    count(*) filter (where pc.a_boisson)::int,
    count(*) filter (where pc.a_dessert)::int,
    coalesce(sum(pc.m_plats), 0)::bigint,
    coalesce(sum(pc.m_boissons), 0)::bigint,
    coalesce(sum(pc.m_desserts), 0)::bigint
  from par_commande pc
  join restaurants r on r.id = pc.restaurant_id
  group by pc.restaurant_id, r.name, pc.semaine
  order by pc.semaine desc, r.name;
end;
$$;

revoke all on function public.admin_vente_additionnelle(int) from public;
revoke all on function public.admin_vente_additionnelle(int) from anon;
grant execute on function public.admin_vente_additionnelle(int) to authenticated;
