-- Traduction automatique du menu (EN/IT) dès qu'un texte est mis en ligne.
--
-- DÉCISION (2026-10-02) : PAS DE TÂCHE PLANIFIÉE. La traduction part d'un
-- trigger, au moment même où un plat, une catégorie, une option, un libellé ou
-- un type de cuisine est créé ou modifié.
--
-- CIRCUIT :
--   INSERT/UPDATE sur le menu
--     -> trigger `traduction_auto` (niveau INSTRUCTION : un import de 40 plats
--        = un seul appel)
--     -> s'il manque au moins une traduction, pg_net met en file un POST vers
--        la fonction Edge `traduire-catalogue` (en-tête x-hook-secret)
--     -> la fonction RELIT la liste en base, fait traduire par Claude, écrit
--        dans `traductions_catalogue` avec source = 'auto', sans jamais écraser.
--
-- ⚠️ INERTE TANT QUE `anthropic_api_key` EST ABSENTE DU VAULT : le trigger ne
-- met même pas d'appel en file. La clé se pose depuis le poste par la fonction
-- `deposer-secret` (liste blanche élargie ci-dessous) — jamais dans un commit,
-- un message ou un tableau de bord. Rien n'est perdu entre-temps : le premier
-- appel traduit TOUT ce qui manque, pas seulement le dernier texte modifié.
--
-- ⚠️ `net.http_post` met la requête en file DANS la transaction : un test joué
-- dans une transaction annulée ne prouve rien sur l'envoi réel.

-- 1. Traçabilité : qui a écrit la traduction.
alter table public.traductions_catalogue
  add column if not exists source text not null default 'manuel'
  check (source in ('manuel', 'auto'));

comment on column public.traductions_catalogue.source is
  '''manuel'' = posée ou corrigée par un humain ; ''auto'' = écrite par traduire-catalogue (à relire). Corriger une ligne auto : la mettre à jour avec source = ''manuel''.';

-- 2. Secret d'appel base -> fonction, généré ici et que personne ne voit.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'traduction_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'),
                                'traduction_hook_secret',
                                'appel trigger traduction_auto -> fonction traduire-catalogue');
  end if;
end $$;

create or replace function public.traduction_hook_secret()
returns text language sql security definer set search_path to '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'traduction_hook_secret';
$$;

create or replace function public.anthropic_api_key()
returns text language sql security definer set search_path to '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'anthropic_api_key';
$$;

revoke all on function public.traduction_hook_secret() from public, anon, authenticated;
revoke all on function public.anthropic_api_key() from public, anon, authenticated;
grant execute on function public.traduction_hook_secret() to service_role;
grant execute on function public.anthropic_api_key() to service_role;

-- 3. La clé Claude peut être déposée par `deposer-secret`.
create or replace function public.poser_secret_exploitation(p_nom text, p_valeur text)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare v_id uuid;
begin
  if p_nom not in ('asc_private_key', 'asc_issuer_id', 'asc_key_id', 'asc_vendor_number',
                   'umami_api_key_vitrine', 'umami_api_key_app', 'anthropic_api_key') then
    raise exception 'secret_non_autorise';
  end if;
  if p_valeur is null or length(p_valeur) < 8 then
    raise exception 'valeur_invalide';
  end if;
  select id into v_id from vault.secrets where name = p_nom;
  if v_id is null then
    perform vault.create_secret(p_valeur, p_nom, 'pose depuis le poste par deposer-secret');
    return 'cree';
  end if;
  perform vault.update_secret(v_id, p_valeur, p_nom);
  return 'remplace';
end $function$;

-- 4. Ce qui manque — même périmètre que admin_textes_a_traduire(), sans le
--    contrôle is_admin (appelant : service_role), plafonné par appel.
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

-- 5. Le déclencheur.
create or replace function public.declencher_traduction()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_secret text;
begin
  -- Inerte sans clé Claude : inutile de mettre un appel en file qui échouera.
  if not exists (select 1 from vault.secrets where name = 'anthropic_api_key') then
    return null;
  end if;
  if not exists (select 1 from public.textes_a_traduire_auto()) then
    return null;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'traduction_hook_secret';
  if v_secret is null then
    raise warning 'traduction_auto: traduction_hook_secret absent du Vault';
    return null;
  end if;
  perform net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/traduire-catalogue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  return null;
end $$;

revoke all on function public.declencher_traduction() from public, anon, authenticated;

drop trigger if exists traduction_auto on public.products;
create trigger traduction_auto
  after insert or update of name, description, packaging_label, featured_label, is_archived
  on public.products for each statement execute function public.declencher_traduction();

drop trigger if exists traduction_auto on public.categories;
create trigger traduction_auto
  after insert or update of name on public.categories
  for each statement execute function public.declencher_traduction();

drop trigger if exists traduction_auto on public.product_option_groups;
create trigger traduction_auto
  after insert or update of name on public.product_option_groups
  for each statement execute function public.declencher_traduction();

drop trigger if exists traduction_auto on public.product_options;
create trigger traduction_auto
  after insert or update of name on public.product_options
  for each statement execute function public.declencher_traduction();

drop trigger if exists traduction_auto on public.restaurants;
create trigger traduction_auto
  after insert or update of cuisine_type, listing_status on public.restaurants
  for each statement execute function public.declencher_traduction();

-- 6. Relance à la main (admin), sans attendre une modification du menu.
create or replace function public.admin_lancer_traduction()
returns boolean language plpgsql security definer set search_path to '' as $$
declare v_secret text;
begin
  if not public.is_admin() then raise exception 'reserve_admin'; end if;
  if not exists (select 1 from vault.secrets where name = 'anthropic_api_key') then return false; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'traduction_hook_secret';
  perform net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/traduire-catalogue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  return true;
end $$;

revoke all on function public.admin_lancer_traduction() from public, anon;
grant execute on function public.admin_lancer_traduction() to authenticated;
