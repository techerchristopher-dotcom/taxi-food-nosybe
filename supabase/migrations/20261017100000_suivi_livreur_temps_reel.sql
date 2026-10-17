-- Suivi du livreur en temps réel (2026-10-17) — cahier des charges :
-- docs/APP-LIVREUR-CAHIER-DES-CHARGES.md § 5.
--
-- 1. `orders.claimed_at` : l'heure du « Je la prends ». N'existait pas (seuls
--    picked_up_at, arriving_at… étaient horodatés). Posée par un trigger BEFORE
--    sur courier_id, quel que soit le chemin (claim_order, admin_assign_courier,
--    release_order). Sert à borner la trace et les statistiques.
-- 2. `positions_livreur` : les points GPS envoyés par l'app livreur, PENDANT une
--    course seulement. RLS active, aucune policy, aucun droit : tout passe par RPC.
-- 3. `couriers.derniere_*` : la dernière position, pour une lecture rapide.
-- 4. `livreur_envoyer_positions(points)` : la seule porte d'écriture (livreur
--    actif, au moins une commande en_livraison, points dans Nosy Be, horodatages
--    plausibles). Refus doux (`aucune_course`) : l'app arrête alors le suivi.
-- 5. `suivi_livreur(commande)` : la seule porte de lecture côté client. Le
--    propriétaire de la commande (ou un admin), commande en_livraison avec livreur,
--    jamais après la livraison.
-- 6. `admin_positions_livreurs()` : carte de l'admin.
-- 7. Purge quotidienne : positions de plus de 7 jours effacées.
--
-- ⚠️ Vie privée, tournée multi-clients : quand le livreur tient d'autres commandes
-- non livrées que celle du client, `suivi_livreur` ne rend QUE la position, pas la
-- trace — la trace dessinerait le chemin vers l'adresse d'un autre client.

-- 1. Heure de la prise ----------------------------------------------------------
alter table public.orders add column if not exists claimed_at timestamptz;

create or replace function public.poser_heure_de_prise()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.courier_id is null then
    new.claimed_at := null;
  elsif old.courier_id is distinct from new.courier_id then
    new.claimed_at := now();
  end if;
  return new;
end $$;

revoke all on function public.poser_heure_de_prise() from public, anon, authenticated;

drop trigger if exists orders_heure_de_prise on public.orders;
create trigger orders_heure_de_prise
  before update of courier_id on public.orders
  for each row execute function public.poser_heure_de_prise();

-- Reprise : les commandes en cours déjà prises reçoivent une heure approchée
-- (la meilleure disponible), pour que leur suivi ait un point de départ.
update public.orders
   set claimed_at = coalesce(picked_up_at, ready_at, status_updated_at)
 where status = 'en_livraison' and courier_id is not null and claimed_at is null;

-- 2. Positions ------------------------------------------------------------------
create table if not exists public.positions_livreur (
  id bigint generated always as identity primary key,
  courier_id uuid not null references auth.users (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  precision_m real,
  vitesse_kmh real,
  cap real,
  releve_le timestamptz not null,
  recu_le timestamptz not null default now(),
  constraint positions_livreur_dans_nosy_be check (public.dans_nosy_be(latitude, longitude))
);

create index if not exists positions_livreur_courier_releve_idx
  on public.positions_livreur (courier_id, releve_le);

alter table public.positions_livreur enable row level security;
revoke all on table public.positions_livreur from public, anon, authenticated;

-- 3. Dernière position ----------------------------------------------------------
alter table public.couriers
  add column if not exists derniere_lat double precision,
  add column if not exists derniere_lng double precision,
  add column if not exists derniere_precision_m real,
  add column if not exists derniere_position_le timestamptz;

-- 4. Écriture -------------------------------------------------------------------
create or replace function public.livreur_envoyer_positions(p_points jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_recus int;
  v_gardes int;
  v_dernier record;
begin
  if v_uid is null or not public.is_active_courier() then
    raise exception 'Acces livreur requis' using errcode = '42501';
  end if;
  if p_points is null or jsonb_typeof(p_points) <> 'array' then
    raise exception 'suivi:points_invalides' using errcode = '22023';
  end if;
  v_recus := jsonb_array_length(p_points);
  if v_recus > 100 then
    raise exception 'suivi:trop_de_points' using errcode = '22023';
  end if;

  -- Hors course : rien n'est enregistré. Refus DOUX, l'app arrête son suivi.
  if not exists (
    select 1 from public.orders
     where courier_id = v_uid and status = 'en_livraison' and delivered_at is null
  ) then
    return jsonb_build_object('ok', false, 'raison', 'aucune_course', 'recus', v_recus, 'gardes', 0);
  end if;

  with pts as (
    select (e->>'lat')::double precision as lat,
           (e->>'lng')::double precision as lng,
           nullif(e->>'precision', '')::real as prec,
           nullif(e->>'vitesse', '')::real as vit,
           nullif(e->>'cap', '')::real as cap,
           (e->>'le')::timestamptz as le
      from jsonb_array_elements(p_points) e
     where jsonb_typeof(e) = 'object'
  ), valides as (
    select * from pts
     where public.dans_nosy_be(lat, lng)
       and le is not null
       and le between now() - interval '2 hours' and now() + interval '2 minutes'
       and (prec is null or prec between 0 and 5000)
  ), ins as (
    insert into public.positions_livreur (courier_id, latitude, longitude, precision_m, vitesse_kmh, cap, releve_le)
    select v_uid, lat, lng, prec,
           case when vit between 0 and 200 then vit end,
           case when cap between 0 and 360 then cap end,
           least(le, now())
      from valides
    returning 1
  )
  select count(*)::int into v_gardes from ins;

  if v_gardes > 0 then
    select latitude, longitude, precision_m, releve_le into v_dernier
      from public.positions_livreur
     where courier_id = v_uid
     order by releve_le desc, id desc
     limit 1;
    insert into public.couriers (user_id, is_available, derniere_lat, derniere_lng, derniere_precision_m, derniere_position_le)
    values (v_uid, true, v_dernier.latitude, v_dernier.longitude, v_dernier.precision_m, v_dernier.releve_le)
    on conflict (user_id) do update
       set derniere_lat = excluded.derniere_lat,
           derniere_lng = excluded.derniere_lng,
           derniere_precision_m = excluded.derniere_precision_m,
           derniere_position_le = excluded.derniere_position_le;
  end if;

  return jsonb_build_object('ok', true, 'recus', v_recus, 'gardes', v_gardes);
end $$;

revoke all on function public.livreur_envoyer_positions(jsonb) from public, anon;
grant execute on function public.livreur_envoyer_positions(jsonb) to authenticated;

-- 5. Lecture client ---------------------------------------------------------------
create or replace function public.suivi_livreur(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  o record;
  c record;
  v_depuis timestamptz;
  v_autres int;
  v_trace jsonb := '[]'::jsonb;
  v_pos jsonb := null;
  v_cible_lat double precision;
  v_cible_lng double precision;
  v_km numeric;
  v_eta int;
  v_phase text;
begin
  if v_uid is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;

  select ord.id, ord.user_id, ord.status, ord.courier_id, ord.claimed_at, ord.picked_up_at,
         ord.arriving_at, ord.arrived_at, ord.ready_at, ord.delivered_at,
         r.latitude as r_lat, r.longitude as r_lng,
         a.latitude as a_lat, a.longitude as a_lng
    into o
    from public.orders ord
    join public.restaurants r on r.id = ord.restaurant_id
    left join public.addresses a on a.id = ord.address_id
   where ord.id = p_order_id;

  if o.id is null or (o.user_id is distinct from v_uid and not public.is_admin()) then
    -- Même réponse pour « inconnue » et « pas à toi » : rien ne fuit.
    return jsonb_build_object('suivi', false, 'raison', 'introuvable');
  end if;
  if o.status <> 'en_livraison' or o.courier_id is null or o.delivered_at is not null then
    return jsonb_build_object('suivi', false, 'raison',
      case when o.status = 'livree' then 'livree'
           when o.status = 'en_livraison' then 'sans_livreur'
           else 'pas_en_livraison' end);
  end if;

  select c2.derniere_lat, c2.derniere_lng, c2.derniere_precision_m, c2.derniere_position_le,
         split_part(coalesce(p.full_name, ''), ' ', 1) as prenom
    into c
    from public.couriers c2
    left join public.profiles p on p.id = c2.user_id
   where c2.user_id = o.courier_id;

  v_depuis := coalesce(o.claimed_at, o.picked_up_at, o.ready_at, now() - interval '2 hours');

  select count(*)::int into v_autres
    from public.orders x
   where x.courier_id = o.courier_id and x.status = 'en_livraison'
     and x.delivered_at is null and x.id <> o.id;

  -- Une position antérieure à la prise n'est pas « la position du livreur pour ta
  -- commande » (ce peut être celle de la veille) : on ne la montre pas.
  if c.derniere_position_le is not null and c.derniere_position_le >= v_depuis - interval '2 minutes' then
    v_pos := jsonb_build_object(
      'lat', c.derniere_lat, 'lng', c.derniere_lng,
      'precision', c.derniere_precision_m,
      'le', c.derniere_position_le,
      'age_s', greatest(0, extract(epoch from now() - c.derniere_position_le))::int);
  end if;

  if v_autres = 0 then
    with pts as (
      select latitude, longitude, releve_le,
             row_number() over (order by releve_le) as rn,
             count(*) over () as n
        from public.positions_livreur
       where courier_id = o.courier_id and releve_le >= v_depuis
    )
    select coalesce(jsonb_agg(jsonb_build_array(round(latitude::numeric, 6), round(longitude::numeric, 6)) order by rn), '[]'::jsonb)
      into v_trace
      from pts
     where rn % greatest(1, ceil(n / 300.0)::int) = 0 or rn = n or rn = 1;
  end if;

  v_phase := case when o.arrived_at is not null then 'devant_chez_toi'
                  when o.arriving_at is not null then 'arrive'
                  when o.picked_up_at is not null then 'vers_toi'
                  else 'vers_restaurant' end;

  -- Distance restante (vol d'oiseau × 1,3, comme le tarif) et estimation maison :
  -- ~1,7 min par km de route (pente mesurée sur l'historique) + 2 min de marge,
  -- + 3 min d'attente au restaurant s'il n'a pas encore récupéré.
  if v_pos is not null and public.dans_nosy_be(o.a_lat, o.a_lng) then
    if o.picked_up_at is null and public.dans_nosy_be(o.r_lat, o.r_lng) then
      v_km := (public.distance_vol_oiseau_km(c.derniere_lat, c.derniere_lng, o.r_lat, o.r_lng)
             + public.distance_vol_oiseau_km(o.r_lat, o.r_lng, o.a_lat, o.a_lng)) * 1.3;
      v_eta := ceil(v_km * 1.7 + 5)::int;
    else
      v_km := public.distance_vol_oiseau_km(c.derniere_lat, c.derniere_lng, o.a_lat, o.a_lng) * 1.3;
      v_eta := ceil(v_km * 1.7 + 2)::int;
    end if;
    if o.arrived_at is not null then v_eta := 0; end if;
  end if;

  return jsonb_build_object(
    'suivi', true,
    'phase', v_phase,
    'livreur', nullif(c.prenom, ''),
    'position', v_pos,
    'trace', v_trace,
    'autres_commandes', v_autres,
    'restaurant', case when public.dans_nosy_be(o.r_lat, o.r_lng) then jsonb_build_object('lat', o.r_lat, 'lng', o.r_lng) end,
    'client', case when public.dans_nosy_be(o.a_lat, o.a_lng) then jsonb_build_object('lat', o.a_lat, 'lng', o.a_lng) end,
    'km_restants', case when v_km is not null then round(v_km, 1) end,
    'eta_min', v_eta,
    'maintenant', now());
end $$;

revoke all on function public.suivi_livreur(uuid) from public, anon;
grant execute on function public.suivi_livreur(uuid) to authenticated;

-- 6. Admin ------------------------------------------------------------------------
create or replace function public.admin_positions_livreurs()
returns table (
  user_id uuid, nom text, is_available boolean,
  latitude double precision, longitude double precision,
  position_le timestamptz, age_s int, commandes_en_cours int)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  return query
    select c.user_id, p.full_name, c.is_available,
           c.derniere_lat, c.derniere_lng, c.derniere_position_le,
           case when c.derniere_position_le is not null
                then greatest(0, extract(epoch from now() - c.derniere_position_le))::int end,
           (select count(*)::int from public.orders o
             where o.courier_id = c.user_id and o.status = 'en_livraison' and o.delivered_at is null)
      from public.couriers c
      left join public.profiles p on p.id = c.user_id
     order by c.derniere_position_le desc nulls last;
end $$;

revoke all on function public.admin_positions_livreurs() from public, anon;
grant execute on function public.admin_positions_livreurs() to authenticated;

-- 7. Purge --------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'positions-livreur-purge') then
    perform cron.unschedule('positions-livreur-purge');
  end if;
  perform cron.schedule('positions-livreur-purge', '47 3 * * *',
    $q$delete from public.positions_livreur where releve_le < now() - interval '7 days'$q$);
end $$;
