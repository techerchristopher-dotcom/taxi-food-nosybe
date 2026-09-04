-- Horaires par jour de la semaine, en remplacement du couple opens_at/closes_at
-- unique valable "tous les jours pareil". restaurants.is_open/auto_open restent
-- la bascule manuelle/automatique existante, inchangee.

create table public.restaurant_hours (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- aligne sur extract(dow from ...) : 0=dimanche .. 6=samedi
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  primary key (restaurant_id, weekday)
);

alter table public.restaurant_hours enable row level security;

-- Lecture publique necessaire : ouvert_maintenant() en depend via PostgREST/le client.
create policy "restaurant_hours_lecture_publique" on public.restaurant_hours
  for select using (true);
-- Aucune policy insert/update/delete : uniquement via les RPC SECURITY DEFINER ci-dessous,
-- meme principe que le reste du projet (set_restaurant_open, set_product_available, ...).

create or replace function public.ouvert_maintenant(r restaurants)
returns boolean
language sql
stable
as $$
  select case
    when not r.auto_open then r.is_open
    else coalesce((
      select case
        when h.is_closed then false
        when h.opens_at is null or h.closes_at is null then false
        when h.opens_at <= h.closes_at then
          (now() at time zone 'Indian/Antananarivo')::time between h.opens_at and h.closes_at
        else
          (now() at time zone 'Indian/Antananarivo')::time >= h.opens_at
          or (now() at time zone 'Indian/Antananarivo')::time <= h.closes_at
      end
      from public.restaurant_hours h
      where h.restaurant_id = r.id
        and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
    ), false)
  end;
$$;

create or replace function public.set_restaurant_week_hours(p_days jsonb)
returns setof public.restaurant_hours
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;

  insert into public.restaurant_hours (restaurant_id, weekday, opens_at, closes_at, is_closed)
  select v_resto_id, d.weekday, d.opens_at, d.closes_at, coalesce(d.is_closed, false)
  from jsonb_to_recordset(p_days) as d(weekday smallint, opens_at time, closes_at time, is_closed boolean)
  on conflict (restaurant_id, weekday)
  do update set opens_at = excluded.opens_at, closes_at = excluded.closes_at, is_closed = excluded.is_closed;

  return query select * from public.restaurant_hours where restaurant_id = v_resto_id order by weekday;
end;
$$;

create or replace function public.set_restaurant_auto_open(p_auto_open boolean)
returns public.restaurants
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_r public.restaurants;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  update public.restaurants set auto_open = p_auto_open where id = v_resto_id returning * into v_r;
  return v_r;
end;
$$;

-- Remplace set_restaurant_hours : les horaires ne sont plus un couple unique
-- opens_at/closes_at mais un planning par jour (set_restaurant_week_hours).
drop function if exists public.set_restaurant_hours(time, time, boolean);

-- Colonne calculee exposant l'horaire du jour courant (utile pour l'affichage
-- client : "Aujourd'hui : 8h30-22h" / "Ferme aujourd'hui"), meme principe que
-- ouvert_maintenant(restaurants). restaurants.opens_at/closes_at (colonnes
-- historiques, encore utilisees par admin_create_restaurant/admin_update_restaurant)
-- restent en base sans modification — seul le nouveau planning par jour pilote
-- desormais l'affichage et le calcul d'ouverture cote client.
create or replace function public.horaires_du_jour(r restaurants)
returns public.restaurant_hours
language sql
stable
as $$
  select h.* from public.restaurant_hours h
  where h.restaurant_id = r.id
    and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
  limit 1;
$$;
