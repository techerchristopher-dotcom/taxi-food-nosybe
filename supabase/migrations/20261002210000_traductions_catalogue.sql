-- Traduction des MENUS (noms de plats, descriptions, catégories, options, types de cuisine,
-- libellés d'emballage) en anglais et en italien — demande du porteur du projet, 2026-10-02 :
-- « quand je passe l'appli en anglais, les menus des restaurants sont toujours en français ».
--
-- UN DICTIONNAIRE, pas des colonnes par table : « Frites » apparaît 1 340 fois dans les options
-- mais ne se traduit qu'une fois (785 textes distincts pour 2 435 occurrences). Rien ne change
-- dans les tables des restaurants ; le restaurateur saisit en français comme avant.
--
-- Lecture PUBLIQUE (c'est du contenu de catalogue), écriture réservée à l'admin. Une traduction
-- manquante n'est pas une erreur : l'app et la vitrine retombent sur le français.
-- ⚠️ Les messages Telegram aux restaurants restent dans LEUR langue (restaurants.langue) et avec
-- les noms de LEUR carte : ce dictionnaire ne sert qu'à l'affichage côté client.

create table if not exists public.traductions_catalogue (
  fr       text not null,
  langue   text not null check (langue in ('en', 'it')),
  texte    text not null check (length(btrim(texte)) > 0),
  maj_le   timestamptz not null default now(),
  primary key (fr, langue)
);

alter table public.traductions_catalogue enable row level security;
drop policy if exists traductions_catalogue_lecture on public.traductions_catalogue;
create policy traductions_catalogue_lecture on public.traductions_catalogue
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.traductions_catalogue from anon, authenticated;
grant select on public.traductions_catalogue to anon, authenticated;

-- Le dictionnaire d'une langue, d'un seul appel (≈ 800 lignes, quelques dizaines de ko).
create or replace function public.traductions_catalogue_langue(p_langue text)
 returns table(fr text, texte text)
 language sql
 stable
as $function$
  select t.fr, t.texte from public.traductions_catalogue t where t.langue = p_langue;
$function$;

-- Ce qui reste à traduire : tout texte affiché au client (restaurants non masqués) sans
-- traduction dans l'une des deux langues. Pour l'onglet admin et pour les lots de traduction.
create or replace function public.admin_textes_a_traduire()
 returns table(fr text, nature text, occurrences bigint, manque_en boolean, manque_it boolean)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
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
  )
  select t.s, min(t.nature), count(*),
         not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'en'),
         not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'it')
  from t
  where public.is_admin()
  group by t.s
  having not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'en')
      or not exists (select 1 from public.traductions_catalogue x where x.fr = t.s and x.langue = 'it')
  order by count(*) desc, t.s;
$function$;

revoke all on function public.admin_textes_a_traduire() from public, anon;
grant execute on function public.admin_textes_a_traduire() to authenticated;
