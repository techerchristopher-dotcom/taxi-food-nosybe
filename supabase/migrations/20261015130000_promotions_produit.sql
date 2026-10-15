-- Promotions sur un plat, avec fin automatique (2026-10-15).
--
-- Demande du porteur du projet : « demain, choisir un produit et le mettre en promo, et que ça
-- apparaisse à la une dans les offres de la semaine ». Première utilisation : le Tacos de La Cabane
-- à 27 000 Ar au lieu de 30 000 jusqu'à lundi 0 h (La Cabane est fermée le lundi).
--
-- Décisions :
--  * La remise est PAYÉE PAR LE RESTAURANT (décision du 2026-10-15 pour La Cabane) : le prix promo
--    est simplement le prix du plat pendant la période. Le sous-total, la commission et le
--    reversement se calculent dessus comme pour une vente normale — aucune formule ne bouge.
--  * La fin n'est PAS une tâche planifiée : `prix_effectif()` compare l'heure. À la seconde où la
--    période se termine, toutes les surfaces repassent au prix normal.
--  * Une seule fonction décide du prix : `prix_effectif(products)`. `create_order` et les deux
--    aperçus (code promo, porte-monnaie) sont patchés PAR ANCRE (remplacement exact de la ligne qui
--    lisait `price`, contrôlé), jamais retapés : pas de nouvelle signature, donc pas de PGRST203.
--  * Les apps déjà installées lisent encore `price` : elles AFFICHENT 30 000 mais la base FACTURE
--    27 000 — on facture moins qu'annoncé, jamais plus. L'OTA affiche le prix barré.

create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  prix_promo  integer not null check (prix_promo > 0),
  debut       timestamptz not null default now(),
  fin         timestamptz not null,
  libelle     text check (libelle is null or char_length(libelle) <= 60),
  actif       boolean not null default true,
  cree_par    uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  check (fin > debut)
);
create index promotions_produit_idx on public.promotions (product_id, debut, fin) where actif;

alter table public.promotions enable row level security;
-- Une promo est publique par nature (elle s'affiche à tous les clients).
create policy promotions_select_public on public.promotions for select to anon, authenticated using (true);
revoke all on public.promotions from anon, authenticated;
grant select on public.promotions to anon, authenticated;

-- Le prix promo en cours (null s'il n'y en a pas). Plus bas prix si deux promos se chevauchent.
create or replace function public.prix_promo(p public.products)
returns integer language sql stable set search_path = public as $$
  select min(pr.prix_promo) from public.promotions pr
   where pr.product_id = p.id and pr.actif and now() >= pr.debut and now() < pr.fin
     and pr.prix_promo < p.price;
$$;

create or replace function public.promo_fin(p public.products)
returns timestamptz language sql stable set search_path = public as $$
  select pr.fin from public.promotions pr
   where pr.product_id = p.id and pr.actif and now() >= pr.debut and now() < pr.fin
     and pr.prix_promo < p.price
   order by pr.prix_promo, pr.fin limit 1;
$$;

-- LE prix qui fait foi, partout.
create or replace function public.prix_effectif(p public.products)
returns integer language sql stable set search_path = public as $$
  select coalesce(public.prix_promo(p), p.price);
$$;

grant execute on function public.prix_promo(public.products), public.promo_fin(public.products),
  public.prix_effectif(public.products) to anon, authenticated;

-- ── Patch par ancre : create_order (6 arguments), apercu_code_promo, apercu_porte_monnaie ──
do $$
declare
  v_def text;
  v_oid oid;
begin
  -- create_order
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'create_order'
     and pg_get_function_identity_arguments(p.oid) like '%p_utiliser_porte_monnaie%';
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def) - length(replace(v_def, 'v_unit_price := v_product.price + v_options_delta;', '')))
       / length('v_unit_price := v_product.price + v_options_delta;') <> 1 then
    raise exception 'ancre create_order introuvable ou multiple';
  end if;
  execute replace(v_def, 'v_unit_price := v_product.price + v_options_delta;',
                         'v_unit_price := public.prix_effectif(v_product) + v_options_delta;');

  -- apercu_code_promo
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'apercu_code_promo';
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def) - length(replace(v_def, '(p.price + coalesce(o.delta, 0)) * q.qty', '')))
       / length('(p.price + coalesce(o.delta, 0)) * q.qty') <> 1 then
    raise exception 'ancre apercu_code_promo introuvable ou multiple';
  end if;
  execute replace(v_def, '(p.price + coalesce(o.delta, 0)) * q.qty',
                         '(public.prix_effectif(p) + coalesce(o.delta, 0)) * q.qty');

  -- apercu_porte_monnaie
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'apercu_porte_monnaie';
  v_def := pg_get_functiondef(v_oid);
  if (length(v_def) - length(replace(v_def, '(p.price + coalesce(o.delta, 0)) * q.qty', '')))
       / length('(p.price + coalesce(o.delta, 0)) * q.qty') <> 1 then
    raise exception 'ancre apercu_porte_monnaie introuvable ou multiple';
  end if;
  execute replace(v_def, '(p.price + coalesce(o.delta, 0)) * q.qty',
                         '(public.prix_effectif(p) + coalesce(o.delta, 0)) * q.qty');
end $$;

-- ── La rubrique « Offres de la semaine » de l'accueil ──
create or replace function public.offres_semaine_publiques()
returns table (
  promotion_id uuid, product_id uuid, nom text, photo_url text, prix integer, prix_promo integer,
  fin timestamptz, libelle text, restaurant_id uuid, restaurant_nom text, restaurant_logo text,
  ouvert boolean, ouvre_a time, ouvre_dans_jours integer
)
language sql stable security invoker set search_path = public as $$
  select pr.id, p.id, p.name, p.photo_url, p.price, pr.prix_promo, pr.fin, pr.libelle,
         r.id, r.name, r.logo_url,
         public.ouvert_maintenant(r), public.ouvre_a(r), public.ouvre_dans_jours(r)
    from public.promotions pr
    join public.products p on p.id = pr.product_id
    join public.restaurants r on r.id = p.restaurant_id
   where pr.actif and now() >= pr.debut and now() < pr.fin and pr.prix_promo < p.price
     and p.is_available and not coalesce(p.is_archived, false)
     and r.listing_status = 'visible'
   order by public.ouvert_maintenant(r) desc, (p.price - pr.prix_promo)::numeric / p.price desc, pr.fin;
$$;
grant execute on function public.offres_semaine_publiques() to anon, authenticated;

-- ── Admin ──
create or replace function public.admin_creer_promotion(
  p_product_id uuid, p_prix_promo integer, p_debut timestamptz, p_fin timestamptz, p_libelle text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prix integer; v_id uuid;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select price into v_prix from public.products where id = p_product_id;
  if v_prix is null then raise exception 'promo:produit_introuvable'; end if;
  if p_prix_promo is null or p_prix_promo <= 0 or p_prix_promo >= v_prix then
    raise exception 'promo:prix_invalide' using detail = 'Le prix promo doit être inférieur au prix normal (' || v_prix || ' Ar).';
  end if;
  if p_fin is null or p_fin <= coalesce(p_debut, now()) or p_fin <= now() then
    raise exception 'promo:dates_invalides';
  end if;
  if exists (select 1 from public.promotions where product_id = p_product_id and actif
               and tstzrange(debut, fin) && tstzrange(coalesce(p_debut, now()), p_fin)) then
    raise exception 'promo:chevauchement' using detail = 'Ce plat a déjà une promo sur cette période : arrête-la d''abord.';
  end if;
  insert into public.promotions (product_id, prix_promo, debut, fin, libelle, cree_par)
  values (p_product_id, p_prix_promo, coalesce(p_debut, now()), p_fin, nullif(btrim(p_libelle), ''), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_arreter_promotion(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  update public.promotions set actif = false where id = p_id;
  if not found then raise exception 'promo:introuvable'; end if;
end $$;

create or replace function public.admin_lister_promotions()
returns table (id uuid, product_id uuid, produit text, restaurant text, prix integer, prix_promo integer,
               debut timestamptz, fin timestamptz, libelle text, actif boolean, en_cours boolean,
               commandes bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query
  select pr.id, p.id, p.name, r.name, p.price, pr.prix_promo, pr.debut, pr.fin, pr.libelle, pr.actif,
         (pr.actif and now() >= pr.debut and now() < pr.fin),
         (select count(distinct oi.order_id) from public.order_items oi join public.orders o on o.id = oi.order_id
           where oi.product_id = p.id and o.created_at >= pr.debut and o.created_at < pr.fin and o.status <> 'annulee')
    from public.promotions pr join public.products p on p.id = pr.product_id
    join public.restaurants r on r.id = p.restaurant_id
   order by pr.created_at desc;
end $$;

revoke all on function public.admin_creer_promotion(uuid, integer, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.admin_arreter_promotion(uuid) from public, anon;
revoke all on function public.admin_lister_promotions() from public, anon;
grant execute on function public.admin_creer_promotion(uuid, integer, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.admin_arreter_promotion(uuid) to authenticated;
grant execute on function public.admin_lister_promotions() to authenticated;
