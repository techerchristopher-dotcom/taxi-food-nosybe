-- ⏱️ Délais, correctif de l'analyse admin (2026-10-07).
-- La ligne globale (grouping set vide) portait max(r.name) = « Les Siciliens » au lieu de
-- null : le nom est désormais nul sur la ligne globale, rangée en dernier.

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
  select f.restaurant_id,
         case when grouping(f.restaurant_id) = 1 then null else max(r.name) end,
         f.tr,
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
   order by grouping(f.restaurant_id), max(r.name), f.tr nulls first;
end $$;
revoke all on function public.admin_delais_estime_vs_reel(int) from public, anon;
grant execute on function public.admin_delais_estime_vs_reel(int) to authenticated;
