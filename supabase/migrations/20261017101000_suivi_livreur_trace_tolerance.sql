-- La trace prend la même tolérance de 2 minutes que la position (points envoyés
-- juste avant le « Je la prends », horloges du téléphone légèrement en avance).
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
       where courier_id = o.courier_id and releve_le >= v_depuis - interval '2 minutes'
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

