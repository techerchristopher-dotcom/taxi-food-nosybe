-- 📢 Bandeau d'annonce — visible en haut de l'accueil de l'APP et du SITE.
--
-- Décision du porteur du projet (2026-10-03) : un bandeau piloté depuis l'admin,
-- jamais écrit en dur, pour annoncer une promotion (« On casse les prix en
-- octobre ») sans republier l'app ni redéployer le site.
--
-- RÈGLES :
-- 1. UN SEUL BANDEAU À LA FOIS à l'écran : le plus récemment modifié parmi ceux
--    qui sont actifs ET dans leurs dates. Deux bandeaux empilés ne se lisent pas.
-- 2. LA DATE DE FIN EST UNE CONDITION D'AFFICHAGE, PAS UNE TÂCHE PLANIFIÉE : passé
--    `fin`, `bandeau_actif()` ne le renvoie plus, et il disparaît partout au
--    chargement suivant. Les dates se saisissent en JOURS, heure de Madagascar :
--    « jusqu'au 31 octobre » = jusqu'au 1er novembre 00:00 à Nosy Be.
-- 3. TRADUIT COMME LE MENU : le titre et le texte passent par le même dictionnaire
--    `traductions_catalogue` (et donc par la traduction automatique quand la clé
--    Claude est posée). Sans traduction, le français s'affiche — jamais de vide.
-- 4. TABLE FERMÉE (RLS sans policy) : lecture publique par `bandeau_actif()` seul,
--    écriture par les RPC admin seules.

create table if not exists public.bandeaux (
  id       uuid primary key default gen_random_uuid(),
  titre    text not null check (length(btrim(titre)) between 1 and 60),
  texte    text check (texte is null or length(btrim(texte)) between 1 and 140),
  route    text check (route is null or route = '/' or route ~ '^/restaurant/[0-9a-f-]{36}$'),
  actif    boolean not null default true,
  debut    timestamptz not null default now(),
  fin      timestamptz,
  cree_le  timestamptz not null default now(),
  maj_le   timestamptz not null default now(),
  check (fin is null or fin > debut)
);

alter table public.bandeaux enable row level security;
revoke all on public.bandeaux from anon, authenticated;

comment on table public.bandeaux is
  'Bandeau d''annonce en haut de l''accueil (app + site). Lu par bandeau_actif(), écrit par admin_enregistrer_bandeau().';

-- Lecture publique : LE bandeau du moment, dans la langue demandée.
-- `version` change à chaque modification : le client s'en sert pour réafficher
-- un bandeau qu'il avait fermé, si l'admin l'a réécrit depuis.
create or replace function public.bandeau_actif(p_langue text default 'fr')
returns table(id uuid, titre text, texte text, route text, fin timestamptz, version text)
language sql stable security definer set search_path to 'public' as $$
  select b.id,
         coalesce((select x.texte from public.traductions_catalogue x
                    where x.fr = b.titre and x.langue = p_langue), b.titre),
         case when b.texte is null then null else
           coalesce((select x.texte from public.traductions_catalogue x
                      where x.fr = b.texte and x.langue = p_langue), b.texte) end,
         coalesce(b.route, '/'),
         b.fin,
         b.id::text || ':' || extract(epoch from b.maj_le)::bigint::text
    from public.bandeaux b
   where b.actif and b.debut <= now() and (b.fin is null or b.fin > now())
   order by b.maj_le desc
   limit 1;
$$;

revoke all on function public.bandeau_actif(text) from public;
grant execute on function public.bandeau_actif(text) to anon, authenticated;

-- Admin : liste complète.
create or replace function public.admin_lister_bandeaux()
returns setof public.bandeaux
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query select * from public.bandeaux order by maj_le desc limit 50;
end $$;

-- Admin : créer (p_id null) ou modifier. Dates en JOURS, heure de Madagascar ;
-- `p_fin` est le DERNIER jour d'affichage, inclus.
create or replace function public.admin_enregistrer_bandeau(
  p_id uuid, p_titre text, p_texte text, p_route text,
  p_debut date, p_fin date, p_actif boolean)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_titre text := btrim(coalesce(p_titre, ''));
  v_texte text := nullif(btrim(coalesce(p_texte, '')), '');
  v_route text := nullif(btrim(coalesce(p_route, '')), '');
  v_debut timestamptz := coalesce(p_debut::timestamp at time zone 'Indian/Antananarivo', now());
  v_fin   timestamptz := case when p_fin is null then null
                              else (p_fin + 1)::timestamp at time zone 'Indian/Antananarivo' end;
  v_id    uuid;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  if length(v_titre) < 1 or length(v_titre) > 60 then raise exception 'bandeau:titre_invalide' using errcode = '22023'; end if;
  if v_texte is not null and length(v_texte) > 140 then raise exception 'bandeau:texte_invalide' using errcode = '22023'; end if;
  if v_route is not null and v_route <> '/' and v_route !~ '^/restaurant/[0-9a-f-]{36}$' then
    raise exception 'bandeau:route_invalide' using errcode = '22023';
  end if;
  if v_fin is not null and v_fin <= v_debut then raise exception 'bandeau:dates_invalides' using errcode = '22023'; end if;

  if p_id is null then
    insert into public.bandeaux (titre, texte, route, actif, debut, fin)
    values (v_titre, v_texte, v_route, coalesce(p_actif, true), v_debut, v_fin)
    returning id into v_id;
  else
    update public.bandeaux
       set titre = v_titre, texte = v_texte, route = v_route, actif = coalesce(p_actif, actif),
           debut = v_debut, fin = v_fin, maj_le = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'bandeau:introuvable' using errcode = '22023'; end if;
  end if;
  return v_id;
end $$;

-- Admin : allumer / éteindre sans retoucher le texte.
create or replace function public.admin_activer_bandeau(p_id uuid, p_actif boolean)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  update public.bandeaux set actif = p_actif, maj_le = now() where id = p_id;
end $$;

revoke all on function public.admin_lister_bandeaux() from public, anon;
revoke all on function public.admin_enregistrer_bandeau(uuid, text, text, text, date, date, boolean) from public, anon;
revoke all on function public.admin_activer_bandeau(uuid, boolean) from public, anon;
grant execute on function public.admin_lister_bandeaux() to authenticated;
grant execute on function public.admin_enregistrer_bandeau(uuid, text, text, text, date, date, boolean) to authenticated;
grant execute on function public.admin_activer_bandeau(uuid, boolean) to authenticated;

-- Traduction automatique : les textes du bandeau rejoignent la liste de ce qui
-- manque, et une écriture sur `bandeaux` déclenche la traduction comme le menu.
create or replace function public.textes_a_traduire_auto()
returns table(fr text, nature text, manque_en boolean, manque_it boolean)
language sql stable security definer set search_path to 'public' as $$
  with vis as (select id from public.restaurants where listing_status <> 'hidden'),
  t as (
    select 'plat' nature, p.name s from public.products p where p.restaurant_id in (select id from vis) and not p.is_archived
    union all select 'description', p.description from public.products p where p.restaurant_id in (select id from vis) and not p.is_archived and coalesce(btrim(p.description), '') <> ''
    union all select 'categorie', c.name from public.categories c where c.restaurant_id in (select id from vis)
    union all select 'groupe', g.name from public.product_option_groups g join public.products p on p.id = g.product_id where p.restaurant_id in (select id from vis)
    union all select 'option', o.name from public.product_options o join public.product_option_groups g on g.id = o.group_id join public.products p on p.id = g.product_id where p.restaurant_id in (select id from vis)
    union all select 'emballage', p.packaging_label from public.products p where p.restaurant_id in (select id from vis) and p.packaging_label is not null
    union all select 'affiche', p.featured_label from public.products p where p.restaurant_id in (select id from vis) and p.featured_label is not null
    union all select 'cuisine', r.cuisine_type from public.restaurants r where r.id in (select id from vis) and r.cuisine_type is not null
    union all select 'bandeau', b.titre from public.bandeaux b where b.actif and (b.fin is null or b.fin > now())
    union all select 'bandeau', b.texte from public.bandeaux b where b.actif and (b.fin is null or b.fin > now()) and b.texte is not null
  ),
  m as (
    select t.s fr, min(t.nature) nature,
           not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'en') manque_en,
           not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'it') manque_it
    from t where coalesce(btrim(t.s), '') <> ''
    group by t.s
  )
  select * from m where manque_en or manque_it order by fr limit 300;
$$;

revoke all on function public.textes_a_traduire_auto() from public, anon, authenticated;
grant execute on function public.textes_a_traduire_auto() to service_role;

drop trigger if exists traduction_auto on public.bandeaux;
create trigger traduction_auto
  after insert or update of titre, texte, actif on public.bandeaux
  for each statement execute function public.declencher_traduction();

-- Le premier bandeau : la promotion livraison d'octobre, jusqu'au 31 inclus.
insert into public.bandeaux (titre, texte, route, actif, debut, fin)
select '🛵 On casse les prix en octobre !',
       'Livraison à partir de 2 000 Ar tout le mois.',
       '/', true, now(),
       '2026-11-01 00:00'::timestamp at time zone 'Indian/Antananarivo'
where not exists (select 1 from public.bandeaux);

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('🛵 On casse les prix en octobre !', 'en', '🛵 Prices slashed all October!', 'manuel'),
  ('🛵 On casse les prix en octobre !', 'it', '🛵 Prezzi stracciati a ottobre!', 'manuel'),
  ('Livraison à partir de 2 000 Ar tout le mois.', 'en', 'Delivery from 2,000 Ar all month long.', 'manuel'),
  ('Livraison à partir de 2 000 Ar tout le mois.', 'it', 'Consegna da 2.000 Ar per tutto il mese.', 'manuel')
on conflict (fr, langue) do nothing;
