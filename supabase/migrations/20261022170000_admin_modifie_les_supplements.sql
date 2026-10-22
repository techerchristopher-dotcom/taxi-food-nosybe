-- =============================================================================
-- L'admin modifie les suppléments et accompagnements (2026-10-22).
--
-- Avant : aucun écran, aucune RPC pour les groupes d'options et les options — tout
-- passait par des migrations SQL écrites à la main. Demande du porteur du projet.
--
--   admin_upsert_option_group(id|null, produit, nom, min, max, obligatoire, ordre)
--   admin_upsert_option(id|null, groupe, nom, prix, dispo, ordre, emballage)
--   admin_delete_option(id) / admin_delete_option_group(id)
--   admin_set_options_available(restaurant, ids[], dispo) — même geste que le restaurateur
--
-- Supprimer est sans risque pour l'historique : order_item_options garde sa copie
-- (nom, prix) et son option_id passe à NULL (ON DELETE SET NULL).
-- Toutes : is_admin(), tracées dans admin_actions. Jamais exécutables par anon.
-- =============================================================================

create or replace function public.admin_upsert_option_group(
  p_id uuid, p_product_id uuid, p_name text, p_min_select integer, p_max_select integer,
  p_required boolean, p_sort_order integer default 0)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid; v_nom text := btrim(coalesce(p_name, '')); v_min int := greatest(coalesce(p_min_select, 0), 0);
  v_max int := coalesce(p_max_select, 1); v_req boolean := coalesce(p_required, false); v_resto uuid;
  v_avant jsonb;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  if length(v_nom) < 2 then raise exception 'option:nom_groupe_trop_court'; end if;
  if v_req and v_min < 1 then v_min := 1; end if;
  if v_max < v_min then raise exception 'option:max_inferieur_au_min'; end if;
  if p_id is null then
    select restaurant_id into v_resto from products where id = p_product_id;
    if v_resto is null then raise exception 'option:produit_introuvable'; end if;
    insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (p_product_id, v_nom, v_min, v_max, v_req, coalesce(p_sort_order, 0)) returning id into v_id;
  else
    select to_jsonb(g), p.restaurant_id into v_avant, v_resto
      from product_option_groups g join products p on p.id = g.product_id where g.id = p_id;
    if v_resto is null then raise exception 'option:groupe_introuvable'; end if;
    update product_option_groups set name = v_nom, min_select = v_min, max_select = v_max,
           required = v_req, sort_order = coalesce(p_sort_order, sort_order)
     where id = p_id returning id into v_id;
  end if;
  insert into admin_actions (admin_id, action, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'groupe_options', v_resto, v_avant::text,
          (select to_jsonb(g) from product_option_groups g where g.id = v_id)::text, null);
  return v_id;
end $$;

create or replace function public.admin_upsert_option(
  p_id uuid, p_group_id uuid, p_name text, p_price_delta integer, p_is_available boolean,
  p_sort_order integer default 0, p_packaging_fee integer default 0)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_id uuid; v_nom text := btrim(coalesce(p_name, '')); v_resto uuid; v_groupe uuid := p_group_id; v_avant jsonb;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  if length(v_nom) < 1 then raise exception 'option:nom_vide'; end if;
  if coalesce(p_price_delta, 0) < 0 then raise exception 'option:prix_negatif'; end if;
  if coalesce(p_packaging_fee, 0) < 0 then raise exception 'option:emballage_negatif'; end if;
  if p_id is not null then
    select to_jsonb(o), o.group_id into v_avant, v_groupe from product_options o where o.id = p_id;
    if v_avant is null then raise exception 'option:introuvable'; end if;
  end if;
  select p.restaurant_id into v_resto from product_option_groups g join products p on p.id = g.product_id where g.id = v_groupe;
  if v_resto is null then raise exception 'option:groupe_introuvable'; end if;
  if p_id is null then
    insert into product_options (group_id, name, price_delta, is_available, sort_order, packaging_fee)
    values (v_groupe, v_nom, coalesce(p_price_delta, 0), coalesce(p_is_available, true),
            coalesce(p_sort_order, 0), coalesce(p_packaging_fee, 0)) returning id into v_id;
  else
    update product_options set name = v_nom, price_delta = coalesce(p_price_delta, 0),
           is_available = coalesce(p_is_available, true), sort_order = coalesce(p_sort_order, sort_order),
           packaging_fee = coalesce(p_packaging_fee, 0)
     where id = p_id returning id into v_id;
  end if;
  insert into admin_actions (admin_id, action, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'option', v_resto, v_avant::text,
          (select to_jsonb(o) from product_options o where o.id = v_id)::text, null);
  return v_id;
end $$;

create or replace function public.admin_delete_option(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_avant jsonb; v_resto uuid;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select to_jsonb(o), p.restaurant_id into v_avant, v_resto
    from product_options o join product_option_groups g on g.id = o.group_id join products p on p.id = g.product_id
   where o.id = p_id;
  if v_avant is null then raise exception 'option:introuvable'; end if;
  delete from product_options where id = p_id;
  insert into admin_actions (admin_id, action, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'option_supprimee', v_resto, v_avant::text, null, null);
end $$;

create or replace function public.admin_delete_option_group(p_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_avant jsonb; v_resto uuid;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select to_jsonb(g) || jsonb_build_object('options', (select coalesce(jsonb_agg(to_jsonb(o)), '[]') from product_options o where o.group_id = g.id)),
         p.restaurant_id into v_avant, v_resto
    from product_option_groups g join products p on p.id = g.product_id where g.id = p_id;
  if v_avant is null then raise exception 'option:groupe_introuvable'; end if;
  delete from product_option_groups where id = p_id;
  insert into admin_actions (admin_id, action, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'groupe_options_supprime', v_resto, v_avant::text, null, null);
end $$;

create or replace function public.admin_set_options_available(p_restaurant_id uuid, p_option_ids uuid[], p_available boolean)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_ids uuid[]; v_n int;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_option_ids) x where x is not null;
  if cardinality(v_ids) = 0 then raise exception 'option:aucune'; end if;
  select count(*) into v_n from product_options o join product_option_groups g on g.id = o.group_id
    join products p on p.id = g.product_id where o.id = any(v_ids) and p.restaurant_id = p_restaurant_id;
  if v_n <> cardinality(v_ids) then raise exception 'option:introuvable — option hors de ce restaurant'; end if;
  update product_options set is_available = coalesce(p_available, false) where id = any(v_ids);
  get diagnostics v_n = row_count;
  insert into admin_actions (admin_id, action, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'options_disponibilite', p_restaurant_id, null,
          jsonb_build_object('ids', v_ids, 'disponible', p_available)::text, null);
  return v_n;
end $$;

revoke all on function public.admin_upsert_option_group(uuid, uuid, text, integer, integer, boolean, integer) from public, anon;
revoke all on function public.admin_upsert_option(uuid, uuid, text, integer, boolean, integer, integer) from public, anon;
revoke all on function public.admin_delete_option(uuid) from public, anon;
revoke all on function public.admin_delete_option_group(uuid) from public, anon;
revoke all on function public.admin_set_options_available(uuid, uuid[], boolean) from public, anon;
grant execute on function public.admin_upsert_option_group(uuid, uuid, text, integer, integer, boolean, integer) to authenticated;
grant execute on function public.admin_upsert_option(uuid, uuid, text, integer, boolean, integer, integer) to authenticated;
grant execute on function public.admin_delete_option(uuid) to authenticated;
grant execute on function public.admin_delete_option_group(uuid) to authenticated;
grant execute on function public.admin_set_options_available(uuid, uuid[], boolean) to authenticated;
