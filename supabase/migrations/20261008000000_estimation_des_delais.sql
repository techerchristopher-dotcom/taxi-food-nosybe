-- ⏱️ Estimation des délais (2026-10-07).
--
-- Besoin du porteur du projet : donner au client, à chaque commande, une ESTIMATION
-- INDICATIVE décomposée (préparation, livraison, total, « prête vers », « livrée vers »),
-- l'enregistrer FIGÉE pour la comparer plus tard au réel, et remplacer le « 25–40 min »
-- écrit en dur sur les cartes par la vraie durée médiane de chaque restaurant.
-- À terme (préparé, pas construit) : trier les restaurants « le plus rapide » / « le mieux
-- noté » — `delais_restaurants()` expose les deux côte à côte.
--
-- Rétrocompatibilité : `create_order` n'est PAS touchée (piège PGRST203). L'estimation est
-- posée par un CONSTRAINT TRIGGER DIFFÉRÉ, comme `orders_notify_new` : au COMMIT, quand les
-- articles sont insérés. Le trigger avale toute erreur (WARNING) : une estimation ratée ne
-- doit JAMAIS empêcher une commande de passer.

-- ---------------------------------------------------------------------------
-- 1. Les faits réels (interne) : une ligne par commande livrée exploitable.
--    Exclus : compte admin (commandes test ET téléphone), restaurants masqués (Taxi Be),
--    commandes de plus de 180 min (ex. 349 min), et chaque composante aberrante.
-- ---------------------------------------------------------------------------
create or replace function public.delais_reels_commandes(p_depuis timestamptz default now() - interval '90 days')
returns table (
  order_id uuid,
  restaurant_id uuid,
  created_at timestamptz,
  heure_locale int,
  distance_km numeric,
  acceptation_min numeric,         -- created → accepted
  prete_min numeric,               -- created → ready (acceptation comprise)
  prise_en_charge_min numeric,     -- created → picked_up (repli quand ready_at manque)
  attente_livreur_min numeric,     -- ready → picked_up
  trajet_min numeric,              -- picked_up → delivered
  livraison_min numeric,           -- ready → delivered
  total_min numeric                -- created → delivered
)
language sql stable security definer set search_path to public as $$
  with b as (
    select o.id, o.restaurant_id, o.created_at,
           extract(hour from o.created_at at time zone 'Indian/Antananarivo')::int as h,
           case when r.latitude is not null and r.longitude is not null
                 and a.latitude is not null and a.longitude is not null
                then public.distance_vol_oiseau_km(r.latitude, r.longitude, a.latitude, a.longitude) end as km,
           extract(epoch from o.accepted_at - o.created_at) / 60 as acc,
           extract(epoch from o.ready_at - o.created_at) / 60 as prete,
           extract(epoch from o.picked_up_at - o.created_at) / 60 as pec,
           extract(epoch from o.picked_up_at - o.ready_at) / 60 as att,
           extract(epoch from o.delivered_at - o.picked_up_at) / 60 as traj,
           extract(epoch from o.delivered_at - o.ready_at) / 60 as livr,
           extract(epoch from o.delivered_at - o.created_at) / 60 as tot
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      left join public.addresses a on a.id = o.address_id
     where o.status = 'livree'
       and o.user_id <> '9ca91352-d36d-4500-87fd-68d0f696640d'::uuid
       and r.listing_status <> 'hidden'
       and o.created_at >= p_depuis
       and o.delivered_at is not null
       and o.delivered_at - o.created_at between interval '5 minutes' and interval '180 minutes'
  )
  select id, restaurant_id, created_at, h, km,
         case when acc   between 0 and 90  then acc   end,
         case when prete between 1 and 150 then prete end,
         case when pec   between 1 and 170 then pec   end,
         case when att   between 0 and 60  then att   end,
         case when traj  between 1 and 120 then traj  end,
         case when livr  between 1 and 150 then livr  end,
         tot
    from b;
$$;
revoke all on function public.delais_reels_commandes(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le calcul (interne). Utilisable pour une commande comme pour une simulation.
-- ---------------------------------------------------------------------------
create or replace function public.estimer_delais(
  p_restaurant_id uuid,
  p_km numeric,
  p_produits uuid[],
  p_exclure_commande uuid default null,
  p_a timestamptz default now()
)
returns table (
  preparation_min int,
  preparation_source text,
  produit_reference_id uuid,
  charge_commandes int,
  charge_min int,
  attente_livreur_min int,
  attente_source text,
  trajet_min int,
  trajet_source text,
  distance_km numeric,
  livraison_min int,
  total_min int,
  heure_prete_estimee timestamptz,
  heure_livree_estimee timestamptz
)
language plpgsql stable security definer set search_path to public as $$
#variable_conflict use_column
declare
  -- Réglages du modèle (version 1). Bornes = garde-fous contre un historique bizarre.
  c_min_occurrences constant int := 3;
  c_prepa_defaut    constant numeric := 25;
  c_attente_defaut  constant numeric := 5;
  c_trajet_base_def constant numeric := 14;
  c_trajet_pente_def constant numeric := 2;
  c_min_par_commande constant int := 5;
  c_charge_max      constant int := 6;      -- au-delà de 6 commandes en cuisine, +30 min plafonné
  v_attente numeric; v_attente_src text;
  v_prepa numeric; v_prepa_src text; v_produit uuid;
  v_charge int;
  v_base numeric; v_pente numeric; v_n int; v_km numeric; v_trajet numeric; v_trajet_src text;
  v_prepa_i int; v_attente_i int; v_trajet_i int;
begin
  -- Attente du livreur : médiane du restaurant, sinon globale, sinon défaut.
  select percentile_cont(0.5) within group (order by f.attente_livreur_min), count(f.attente_livreur_min)
    into v_attente, v_n
    from public.delais_reels_commandes() f where f.restaurant_id = p_restaurant_id;
  if v_n >= c_min_occurrences then
    v_attente_src := 'restaurant';
  else
    select percentile_cont(0.5) within group (order by f.attente_livreur_min), count(f.attente_livreur_min)
      into v_attente, v_n from public.delais_reels_commandes() f;
    if v_n >= c_min_occurrences then v_attente_src := 'global';
    else v_attente := c_attente_defaut; v_attente_src := 'defaut'; end if;
  end if;

  -- Préparation, niveau 1 : le MÊME plat dans ce restaurant (≥ 3 commandes avec ready_at) ;
  -- plusieurs plats → le plus long.
  select m.med, m.product_id into v_prepa, v_produit
    from (
      select oi.product_id, percentile_cont(0.5) within group (order by f.prete_min) as med
        from public.delais_reels_commandes() f
        join lateral (select distinct i.product_id from public.order_items i where i.order_id = f.order_id) oi on true
       where f.restaurant_id = p_restaurant_id
         and f.prete_min is not null
         and oi.product_id = any (coalesce(p_produits, '{}'::uuid[]))
       group by oi.product_id
      having count(*) >= c_min_occurrences
    ) m
   order by m.med desc
   limit 1;
  if v_prepa is not null then
    v_prepa_src := 'plat';
  else
    -- Niveau 2 : le restaurant (created → ready ; à défaut created → picked_up − attente médiane).
    select percentile_cont(0.5) within group (order by x), count(x) into v_prepa, v_n
      from (
        select coalesce(f.prete_min,
                        case when f.prise_en_charge_min - v_attente >= 5 then f.prise_en_charge_min - v_attente end) as x
          from public.delais_reels_commandes() f where f.restaurant_id = p_restaurant_id
      ) s;
    if v_n >= c_min_occurrences then v_prepa_src := 'restaurant';
    else v_prepa := c_prepa_defaut; v_prepa_src := 'defaut'; v_produit := null; end if;
  end if;

  -- Charge en cuisine : commandes du restaurant pas encore parties (hors celle-ci),
  -- des 3 dernières heures (une commande oubliée en « reçue » ne pèse pas éternellement).
  select count(*) into v_charge
    from public.orders o
   where o.restaurant_id = p_restaurant_id
     and o.status in ('recue', 'confirmee', 'en_preparation')
     and o.id is distinct from p_exclure_commande
     and o.created_at <= p_a
     and o.created_at > p_a - interval '3 hours';

  -- Trajet : base + pente × km, calibré sur l'historique global (moindres carrés), borné.
  select regr_intercept(f.trajet_min, f.distance_km), regr_slope(f.trajet_min, f.distance_km), regr_count(f.trajet_min, f.distance_km)
    into v_base, v_pente, v_n
    from public.delais_reels_commandes() f;
  if v_n >= 8 and v_base is not null and v_pente is not null then
    v_base := least(greatest(v_base, 5), 25);
    v_pente := least(greatest(v_pente, 0.5), 4);
    v_trajet_src := 'historique';
  else
    v_base := c_trajet_base_def; v_pente := c_trajet_pente_def; v_trajet_src := 'defaut';
  end if;
  -- Distance inconnue (restaurant ou adresse sans GPS) : km médian de l'historique.
  v_km := p_km;
  if v_km is null then
    select percentile_cont(0.5) within group (order by f.distance_km) into v_km from public.delais_reels_commandes() f;
    v_km := coalesce(v_km, 2.5);
  end if;
  v_trajet := v_base + v_pente * v_km;

  v_prepa_i   := round(v_prepa)::int + c_min_par_commande * least(v_charge, c_charge_max);
  v_attente_i := round(v_attente)::int;
  v_trajet_i  := round(v_trajet)::int;

  preparation_min      := v_prepa_i;
  preparation_source   := v_prepa_src;
  produit_reference_id := v_produit;
  charge_commandes     := v_charge;
  charge_min           := c_min_par_commande * least(v_charge, c_charge_max);
  attente_livreur_min  := v_attente_i;
  attente_source       := v_attente_src;
  trajet_min           := v_trajet_i;
  trajet_source        := v_trajet_src;
  distance_km          := round(p_km, 2);
  livraison_min        := v_attente_i + v_trajet_i;
  total_min            := v_prepa_i + v_attente_i + v_trajet_i;
  heure_prete_estimee  := p_a + make_interval(mins => v_prepa_i);
  heure_livree_estimee := p_a + make_interval(mins => v_prepa_i + v_attente_i + v_trajet_i);
  return next;
end $$;
revoke all on function public.estimer_delais(uuid, numeric, uuid[], uuid, timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. La table figée.
-- ---------------------------------------------------------------------------
create table if not exists public.estimations_commande (
  order_id uuid primary key references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  calculee_le timestamptz not null default now(),
  version_modele int not null default 1,
  preparation_min int not null,
  preparation_source text not null check (preparation_source in ('plat', 'restaurant', 'defaut')),
  produit_reference_id uuid,
  charge_commandes int not null default 0,
  charge_min int not null default 0,
  attente_livreur_min int not null,
  attente_source text not null check (attente_source in ('restaurant', 'global', 'defaut')),
  trajet_min int not null,
  trajet_source text not null check (trajet_source in ('historique', 'defaut')),
  distance_km numeric,
  livraison_min int not null,
  total_min int not null,
  heure_prete_estimee timestamptz not null,
  heure_livree_estimee timestamptz not null
);
create index if not exists estimations_commande_restaurant_idx on public.estimations_commande (restaurant_id, calculee_le);

alter table public.estimations_commande enable row level security;
revoke all on public.estimations_commande from anon, authenticated;
grant select on public.estimations_commande to authenticated;

-- Lecture = « je peux lire la commande » : client (la sienne), restaurant, livreur, admin.
-- La sous-requête s'exécute sous la RLS de `orders` de l'appelant.
drop policy if exists estimations_select_si_commande_lisible on public.estimations_commande;
create policy estimations_select_si_commande_lisible on public.estimations_commande
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = estimations_commande.order_id));
-- Aucune policy d'écriture : seul le trigger (SECURITY DEFINER) insère.

-- Figée : jamais recalculée, même par une fonction DEFINER.
create or replace function public.estimations_commande_figee()
returns trigger language plpgsql set search_path to public as $$
begin
  raise exception 'estimation:figee' using errcode = '42501';
end $$;
revoke all on function public.estimations_commande_figee() from public, anon, authenticated;
drop trigger if exists estimations_commande_figee on public.estimations_commande;
create trigger estimations_commande_figee before update on public.estimations_commande
  for each row execute function public.estimations_commande_figee();

-- ---------------------------------------------------------------------------
-- 4. Le calcul pour une commande + le trigger DIFFÉRÉ.
-- ---------------------------------------------------------------------------
create or replace function public.estimer_commande(p_order_id uuid)
returns setof public.estimations_commande
language sql stable security definer set search_path to public as $$
  select o.id, o.restaurant_id, now(), 1,
         e.preparation_min, e.preparation_source, e.produit_reference_id, e.charge_commandes, e.charge_min,
         e.attente_livreur_min, e.attente_source, e.trajet_min, e.trajet_source, e.distance_km,
         e.livraison_min, e.total_min, e.heure_prete_estimee, e.heure_livree_estimee
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    left join public.addresses a on a.id = o.address_id
   cross join lateral public.estimer_delais(
     o.restaurant_id,
     case when r.latitude is not null and r.longitude is not null and a.latitude is not null and a.longitude is not null
          then public.distance_vol_oiseau_km(r.latitude, r.longitude, a.latitude, a.longitude) end,
     array(select i.product_id from public.order_items i where i.order_id = o.id and i.product_id is not null),
     o.id,
     o.created_at
   ) e
   where o.id = p_order_id;
$$;
revoke all on function public.estimer_commande(uuid) from public, anon, authenticated;

create or replace function public.estimer_commande_a_la_creation()
returns trigger language plpgsql security definer set search_path to public as $$
begin
  begin
    insert into public.estimations_commande
      select * from public.estimer_commande(new.id)
    on conflict (order_id) do nothing;
  exception when others then
    -- Jamais bloquer une commande pour une estimation.
    raise warning 'estimation % non calculee : % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;
revoke all on function public.estimer_commande_a_la_creation() from public, anon, authenticated;

drop trigger if exists orders_estimation_delais on public.orders;
create constraint trigger orders_estimation_delais
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.estimer_commande_a_la_creation();

-- ---------------------------------------------------------------------------
-- 5. Public : durée médiane par restaurant (cartes) + liste prête pour le tri futur.
--    ⚠️ Aucun privilège de colonne touché sur `restaurants` (piège « colonne calculée
--    contre privilèges de colonne ») : on ajoute une colonne calculée, c'est tout.
-- ---------------------------------------------------------------------------
create or replace function public.duree_mediane_min(r public.restaurants)
returns int language sql stable security definer set search_path to public as $$
  select round(percentile_cont(0.5) within group (order by f.total_min))::int
    from public.delais_reels_commandes() f
   where f.restaurant_id = r.id
  having count(*) >= 3;
$$;
revoke all on function public.duree_mediane_min(public.restaurants) from public;
grant execute on function public.duree_mediane_min(public.restaurants) to anon, authenticated;

create or replace function public.delais_restaurants()
returns table (
  restaurant_id uuid,
  nom text,
  nb_commandes int,
  duree_mediane_min int,
  preparation_mediane_min int,
  livraison_mediane_min int,
  note_moyenne numeric,
  nb_avis int
)
language sql stable security definer set search_path to public as $$
  select r.id, r.name,
         count(f.order_id)::int,
         case when count(f.order_id) >= 3 then round(percentile_cont(0.5) within group (order by f.total_min))::int end,
         case when count(f.prete_min) >= 3 then round(percentile_cont(0.5) within group (order by f.prete_min))::int end,
         case when count(f.livraison_min) >= 3 then round(percentile_cont(0.5) within group (order by f.livraison_min))::int end,
         public.note_moyenne(r),
         public.nb_avis(r)::int
    from public.restaurants r
    left join public.delais_reels_commandes() f on f.restaurant_id = r.id
   where r.listing_status <> 'hidden'
   group by r.id;
$$;
revoke all on function public.delais_restaurants() from public;
grant execute on function public.delais_restaurants() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Admin : estimé vs réel, par restaurant et par tranche horaire.
--    Une ligne « Toutes » (tranche null) par restaurant, et une ligne globale (restaurant null).
-- ---------------------------------------------------------------------------
create or replace function public.admin_delais_estime_vs_reel(p_jours int default 90)
returns table (
  restaurant_id uuid,
  restaurant text,
  tranche text,
  nb_commandes int,
  prepa_reel_med numeric,
  attente_reel_med numeric,
  trajet_reel_med numeric,
  livraison_reel_med numeric,
  total_reel_med numeric,
  nb_estimees int,
  prepa_estime_med numeric,
  livraison_estime_med numeric,
  total_estime_med numeric,
  ecart_prepa_med numeric,
  ecart_livraison_med numeric,
  ecart_total_med numeric,
  pct_dans_les_temps numeric
)
language plpgsql stable security definer set search_path to public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'admin uniquement' using errcode = '42501';
  end if;
  return query
  with f as (
    select d.*,
           case when d.heure_locale < 11 then '1 · matin (< 11 h)'
                when d.heure_locale < 15 then '2 · midi (11 h – 15 h)'
                when d.heure_locale < 18 then '3 · après-midi (15 h – 18 h)'
                when d.heure_locale < 22 then '4 · soir (18 h – 22 h)'
                else '5 · nuit (≥ 22 h)' end as tr,
           e.preparation_min as e_prepa, e.livraison_min as e_livr, e.total_min as e_tot,
           o.delivered_at <= e.heure_livree_estimee + interval '5 minutes' as a_l_heure
      from public.delais_reels_commandes(now() - make_interval(days => greatest(p_jours, 1))) d
      join public.orders o on o.id = d.order_id
      left join public.estimations_commande e on e.order_id = d.order_id
  )
  select f.restaurant_id, max(r.name), f.tr,
         count(*)::int,
         round(percentile_cont(0.5) within group (order by f.prete_min)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.attente_livreur_min)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.trajet_min)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.livraison_min)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.total_min)::numeric, 1),
         count(f.e_tot)::int,
         round(percentile_cont(0.5) within group (order by f.e_prepa)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.e_livr)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.e_tot)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.prete_min - f.e_prepa)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.livraison_min - f.e_livr)::numeric, 1),
         round(percentile_cont(0.5) within group (order by f.total_min - f.e_tot)::numeric, 1),
         round(100.0 * count(*) filter (where f.a_l_heure) / nullif(count(f.e_tot), 0), 0)
    from f
    left join public.restaurants r on r.id = f.restaurant_id
   group by grouping sets ((f.restaurant_id, f.tr), (f.restaurant_id), ())
   order by max(r.name) nulls last, f.tr nulls first;
end $$;
revoke all on function public.admin_delais_estime_vs_reel(int) from public, anon;
grant execute on function public.admin_delais_estime_vs_reel(int) to authenticated;
