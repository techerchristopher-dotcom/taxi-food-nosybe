-- =============================================================================
-- Le restaurateur coupe un supplément en un geste (2026-10-22).
--
-- Déclencheur : TF-454 (L'escale Créole, 21/10), commandée avec « + Frites (+10 000 Ar) »
-- alors que le restaurant n'avait pas de frites. `product_options.is_available` existait
-- et `create_order` le respecte déjà (« Option invalide ou indisponible ») — mais aucun
-- écran ni aucune RPC ne permettait au restaurateur de le basculer : seulement du SQL.
--
-- set_options_available(ids[], dispo) : un TABLEAU, parce que l'écran regroupe les options
-- par NOM — « Frites » existe sur 15 plats, le restaurateur coupe les frites UNE fois.
-- Sécurité : current_restaurant_id() (le restaurant ACTIF du compte, comme
-- set_product_available) ; toute option qui n'est pas de ce restaurant fait tout échouer
-- (rien n'est écrit à moitié).
-- =============================================================================

create or replace function public.set_options_available(p_option_ids uuid[], p_available boolean)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_ids uuid[];
  v_n integer;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_option_ids) x where x is not null;
  if cardinality(v_ids) = 0 then
    raise exception 'option:aucune';
  end if;
  if cardinality(v_ids) > 500 then
    raise exception 'option:trop_nombreuses';
  end if;

  select count(*) into v_n
  from public.product_options o
  join public.product_option_groups g on g.id = o.group_id
  join public.products p on p.id = g.product_id
  where o.id = any(v_ids) and p.restaurant_id = v_resto_id;
  if v_n <> cardinality(v_ids) then
    raise exception 'option:introuvable — option introuvable dans votre carte';
  end if;

  update public.product_options set is_available = coalesce(p_available, false)
  where id = any(v_ids);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.set_options_available(uuid[], boolean) from public, anon;
grant execute on function public.set_options_available(uuid[], boolean) to authenticated;
