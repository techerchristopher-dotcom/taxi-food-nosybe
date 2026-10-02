-- ✨ « Nouveau sur Taxi Food » (demande du porteur du projet, 2026-10-02) : un restaurant qui
-- rejoint l'aventure est mis en avant pendant 14 JOURS — rangée en tête de l'accueil, badge
-- « Nouveau », et en tête de liste parmi les restaurants ouverts. Valable pour 1, 2 ou 3
-- restaurants arrivés le même jour.
--
-- 1. restaurants.visible_depuis : la PREMIÈRE fois qu'il devient `visible`. Ce n'est pas
--    created_at : Les Siciliens ont été créés le 5 septembre et ouverts le 2 octobre.
--    restaurants.nouveau_jusqu_au : fin de la mise en avant (visible_depuis + 14 j), modifiable
--    par l'admin (`admin_set_nouveau`) pour prolonger ou arrêter.
-- 2. Posés par un TRIGGER, pas par admin_set_listing_status : le 2026-10-02 Les Siciliens ont été
--    ouverts par un UPDATE direct, et tout ce qui ne vivait que dans la RPC n'a pas eu lieu.
--    Un restaurant qui revient après un passage en hidden/coming_soon N'EST PAS nouveau
--    (visible_depuis déjà posé).
-- 3. est_nouveau(r) : colonne calculée publique (PostgREST), seule définition de « nouveau ».
-- 4. rang_ouverture(r) : statut × 200 000, ouvert 0 / fermé 100 000, PUIS nouveau 0 / ancien
--    50 000, puis sort_order. Un nouveau FERMÉ ne passe jamais devant un ancien OUVERT ; un
--    « en négociation » jamais devant un visible.
-- 5. plats_du_jour_publics() : mêmes règles (ouverts, puis nouveaux).
-- 6. nouveautes_publiques() : la rangée de l'accueil — une ligne par restaurant nouveau, avec 4
--    plats en photo. SECURITY INVOKER, colonnes déjà publiques uniquement.

alter table public.restaurants
  add column if not exists visible_depuis timestamptz,
  add column if not exists nouveau_jusqu_au timestamptz;

create or replace function public.marquer_arrivee_restaurant()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.listing_status = 'visible'
     and (tg_op = 'INSERT' or old.listing_status is distinct from 'visible')
     and new.visible_depuis is null then
    new.visible_depuis := now();
    new.nouveau_jusqu_au := coalesce(new.nouveau_jusqu_au, now() + interval '14 days');
  end if;
  return new;
end $function$;

drop trigger if exists restaurants_marquer_arrivee on public.restaurants;
create trigger restaurants_marquer_arrivee
  before insert or update of listing_status on public.restaurants
  for each row execute function public.marquer_arrivee_restaurant();

-- Rattrapage : les restaurants déjà visibles ne sont pas « nouveaux » (date = création) ;
-- Les Siciliens, ouverts le 2026-10-02 vers 12 h (heure de Nosy Be), le sont pour 14 jours.
update public.restaurants
   set visible_depuis = '2026-10-02 09:05:00+00', nouveau_jusqu_au = '2026-10-16 09:05:00+00'
 where id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b';
update public.restaurants
   set visible_depuis = created_at
 where listing_status = 'visible' and visible_depuis is null;

create or replace function public.est_nouveau(r public.restaurants)
 returns boolean
 language sql
 stable
as $function$
  select r.listing_status = 'visible' and coalesce(r.nouveau_jusqu_au > now(), false);
$function$;

create or replace function public.rang_ouverture(r public.restaurants)
 returns integer
 language sql
 stable
as $function$
  select (case r.listing_status
            when 'visible' then 0
            when 'coming_soon' then 1
            else 2
          end) * 200000
       + (case when public.ouvert_maintenant(r) then 0 else 100000 end)
       + (case when public.est_nouveau(r) then 0 else 50000 end)
       + r.sort_order;
$function$;

-- Plats du jour : ouverts d'abord, puis les restaurants nouveaux. Réécriture ciblée.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.plats_du_jour_publics()'::regprocedure);
  if position('est_nouveau' in d) = 0 then
    if position('public.ouvert_maintenant(r) as ouvert,' in d) = 0
       or (length(d) - length(replace(d, 'order by (not x.ouvert), x.rang_catalogue', ''))) / length('order by (not x.ouvert), x.rang_catalogue') <> 2 then
      raise exception 'plats_du_jour_publics : motifs introuvables — à reprendre à la main';
    end if;
    d := replace(d, 'public.ouvert_maintenant(r) as ouvert,',
                    'public.ouvert_maintenant(r) as ouvert, public.est_nouveau(r) as nouveau,');
    d := replace(d, 'order by (not x.ouvert), x.rang_catalogue', 'order by (not x.ouvert), (not x.nouveau), x.rang_catalogue');
    execute d;
  end if;
end $$;

create or replace function public.nouveautes_publiques()
 returns table(restaurant_id uuid, nom text, cuisine text, zone text, logo_url text, cover_url text,
               ouvert boolean, ouvre_dans_jours smallint, ouvre_a text,
               visible_depuis timestamptz, nouveau_jusqu_au timestamptz, plats jsonb)
 language sql
 stable
as $function$
  -- 4 plats en photo, UN PAR CATÉGORIE d'abord (rang_cat) : sinon on montrait quatre entrées.
  -- Les plats à l'affiche passent devant ; jamais une boisson.
  select r.id, r.name, r.cuisine_type, r.zone_served, r.logo_url, r.cover_url,
         public.ouvert_maintenant(r),
         o.jours,
         substring(o.ouvre::text from 1 for 5),
         r.visible_depuis, r.nouveau_jusqu_au,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.name, 'prix', p.price, 'photo_url', p.photo_url)
                            order by p.n)
             from (select q.*, row_number() over (order by q.is_featured desc, q.rang_cat, q.cat_ordre, q.sort_order) n
                     from (select p.*, c2.sort_order cat_ordre,
                                  row_number() over (partition by p.category_id
                                                     order by p.is_featured desc, p.sort_order) rang_cat
                             from public.products p
                             join public.categories c2 on c2.id = p.category_id and c2.is_active
                            where p.restaurant_id = r.id and p.photo_url is not null
                              and p.is_available and not p.is_archived
                              and coalesce(p.stock_quantity, 1) <> 0
                              and (p.in_menu or p.is_featured)
                              and not c2.est_boisson) q) p
            where p.n <= 4), '[]'::jsonb)
  from public.restaurants r
  left join lateral public.prochaine_ouverture(r) o on true
  where public.est_nouveau(r)
  order by (not public.ouvert_maintenant(r)), r.visible_depuis desc, r.sort_order;
$function$;

-- Admin : prolonger ou arrêter la mise en avant (null = arrêter tout de suite).
create or replace function public.admin_set_nouveau(p_id uuid, p_jusqu_au timestamptz)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  update public.restaurants
     set nouveau_jusqu_au = case when p_jusqu_au is null then now() else p_jusqu_au end
   where id = p_id;
  if not found then raise exception 'Restaurant introuvable'; end if;
  return case when p_jusqu_au is null then now() else p_jusqu_au end;
end $function$;

revoke all on function public.admin_set_nouveau(uuid, timestamptz) from public, anon;
grant execute on function public.admin_set_nouveau(uuid, timestamptz) to authenticated;
