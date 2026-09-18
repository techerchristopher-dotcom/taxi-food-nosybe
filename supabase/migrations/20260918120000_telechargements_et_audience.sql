-- Suivi des telechargements des magasins, et ecran Audience (2026-09-18).
--
-- Jusqu'ici, le nombre de telechargements ne se lisait que dans les consoles
-- Apple et Google, a la main. On le releve desormais tous les jours et on le
-- garde.
--
-- ⚠️ CE QU'APPLE REND, ET CE QUE CA VEUT DIRE. Le rapport SALES/SUMMARY/DAILY
-- est un TSV gzippe dont chaque ligne porte un `Product Type Identifier` :
-- « 1 » = premier telechargement iPhone, « 1F » = premier telechargement iPad,
-- « 1T » = premier telechargement Apple TV, « 3 » / « 3F » = re-telechargement,
-- « 7 » / « 7F » = mise a jour... **On ne les additionne pas** : une mise a jour
-- n'est pas un nouveau client. Le type est donc stocke tel quel, et c'est
-- l'ecran qui decide ce qu'il montre.
--
-- ⚠️ 404 = AUCUN RAPPORT CE JOUR-LA, pas une panne. Apple ne publie rien pour
-- une journee sans la moindre vente ni le moindre telechargement. On l'inscrit
-- comme un releve « vide », sans quoi le rattrapage repasserait indefiniment sur
-- les memes journees.

create table if not exists public.telechargements_magasins (
  jour        date not null,
  magasin     text not null check (magasin in ('app_store', 'play')),
  pays        text not null,
  type_produit text not null,
  unites      integer not null check (unites >= 0),
  releve_le   timestamptz not null default now(),
  primary key (jour, magasin, pays, type_produit)
);
create index if not exists telechargements_jour_idx on public.telechargements_magasins (jour desc);

-- Journal des executions : on doit pouvoir dire « le 17, la collecte a bien eu
-- lieu, et il n'y avait rien », ce qui n'est pas la meme chose que « on n'a pas
-- regarde ».
create table if not exists public.releves_magasins (
  id       bigint generated always as identity primary key,
  magasin  text not null check (magasin in ('app_store', 'play')),
  jour     date not null,
  statut   text not null check (statut in ('ok', 'vide', 'echec')),
  lignes   integer not null default 0,
  message  text,
  fait_le  timestamptz not null default now()
);
-- ⚠️ Index unique COMPLET, pas partiel : PostgREST n'envoie pas de clause WHERE
-- avec `on_conflict`, et un index partiel ne peut donc pas servir a l'inference.
-- Un index partiel (magasin, jour, statut) a fait echouer EN SILENCE toutes les
-- ecritures du journal le 2026-09-18 (voir migration 20260918124000).
create unique index if not exists releves_magasins_magasin_jour_idx
  on public.releves_magasins (magasin, jour);
create index if not exists releves_magasins_fait_le_idx on public.releves_magasins (fait_le desc);

-- Aucune policy, aucun grant : la fonction Edge ecrit avec la cle service_role
-- (hors RLS), l'admin lit par les RPC ci-dessous.
alter table public.telechargements_magasins enable row level security;
alter table public.releves_magasins enable row level security;
revoke all on public.telechargements_magasins from public, anon, authenticated;
revoke all on public.releves_magasins from public, anon, authenticated;

-- ------------------------------------------------------- lecture par l'admin
create or replace function public.admin_telechargements(p_jours integer default 30)
returns table (jour date, magasin text, premiers integer, mises_a_jour integer, autres integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return query
  select t.jour,
         t.magasin,
         -- « 1 » et ses variantes de plateforme : un appareil qui installe l'app
         -- pour la premiere fois. C'est le seul chiffre qui compte un client.
         sum(t.unites) filter (where t.type_produit ~ '^1')::integer,
         sum(t.unites) filter (where t.type_produit ~ '^7')::integer,
         sum(t.unites) filter (where t.type_produit !~ '^(1|7)')::integer
    from public.telechargements_magasins t
   where t.jour >= current_date - greatest(coalesce(p_jours, 30), 1)
   group by t.jour, t.magasin
   order by t.jour;
end $$;

revoke all on function public.admin_telechargements(integer) from public, anon;
grant execute on function public.admin_telechargements(integer) to authenticated;

/**
 * Le resume de l'ecran Audience : ce que les magasins disent, et ce que la base
 * sait deja. Les deux dans la meme reponse — sinon l'ecran multiplie les appels
 * sur une liaison lente.
 */
create or replace function public.admin_audience_resume()
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v json;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  select json_build_object(
    'premiers_telechargements_total',
      (select coalesce(sum(unites), 0) from public.telechargements_magasins
        where magasin = 'app_store' and type_produit ~ '^1'),
    'premiers_telechargements_30j',
      (select coalesce(sum(unites), 0) from public.telechargements_magasins
        where magasin = 'app_store' and type_produit ~ '^1' and jour >= current_date - 30),
    'dernier_releve',
      (select json_build_object('jour', jour, 'statut', statut, 'fait_le', fait_le)
         from public.releves_magasins where magasin = 'app_store'
        order by jour desc, fait_le desc limit 1),
    'releves_recents',
      (select coalesce(json_agg(x order by x.jour desc), '[]'::json) from (
         select jour, statut, lignes, message, fait_le from public.releves_magasins
          where magasin = 'app_store' order by jour desc, fait_le desc limit 10) x),
    'comptes', (select count(*) from public.profiles),
    'comptes_30j', (select count(*) from public.profiles where created_at >= now() - interval '30 days'),
    'commandes', (select count(*) from public.orders),
    'commandes_30j', (select count(*) from public.orders where created_at >= now() - interval '30 days'),
    'commandes_livrees', (select count(*) from public.orders where status = 'livree'),
    'clients_ayant_commande', (select count(distinct user_id) from public.orders where user_id is not null),
    'appareils_notifiables', (select count(*) from public.push_tokens)
  ) into v;
  return v;
end $$;

revoke all on function public.admin_audience_resume() from public, anon;
grant execute on function public.admin_audience_resume() to authenticated;

-- ------------------------------------------------- secrets lus par les Edge
-- Meme patron que `push_hook_secret` : reserve a `service_role`, jamais
-- executable par un utilisateur.
create or replace function public.config_app_store()
returns json
language sql
stable
security definer
set search_path to ''
as $$
  select json_build_object(
    'cle_privee', (select decrypted_secret from vault.decrypted_secrets where name = 'asc_private_key'),
    'issuer_id',  (select decrypted_secret from vault.decrypted_secrets where name = 'asc_issuer_id'),
    'key_id',     (select decrypted_secret from vault.decrypted_secrets where name = 'asc_key_id'),
    'vendeur',    (select decrypted_secret from vault.decrypted_secrets where name = 'asc_vendor_number'));
$$;

revoke all on function public.config_app_store() from public, anon, authenticated;
grant execute on function public.config_app_store() to service_role;

create or replace function public.collecte_hook_secret()
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'collecte_hook_secret';
$$;

revoke all on function public.collecte_hook_secret() from public, anon, authenticated;
grant execute on function public.collecte_hook_secret() to service_role;

-- ---------------------------------------------- depot d'un secret par le poste
/**
 * Pose un secret du Vault DEPUIS LE POSTE, sans qu'il transite par une
 * conversation ni par un commit.
 *
 * ⚠️ LISTE BLANCHE. Cette fonction ne peut ecrire que les quelques secrets
 * nommes ici : la cle privee App Store Connect et ses identifiants, et les cles
 * Umami. Elle ne peut pas ecraser `stripe_secret_key`, `push_hook_secret` ni
 * l'empreinte du depot — sans quoi elle serait une porte d'entree generale.
 *
 * Reservee a `service_role` : seule la fonction Edge `deposer-secret` l'appelle,
 * et celle-ci verifie d'abord le secret de depot du poste (meme empreinte que
 * `deposer-visuel`, dont la suppression desarme les deux).
 */
create or replace function public.poser_secret_exploitation(p_nom text, p_valeur text)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare v_id uuid;
begin
  if p_nom not in ('asc_private_key', 'asc_issuer_id', 'asc_key_id', 'asc_vendor_number',
                   'umami_api_key_vitrine', 'umami_api_key_app') then
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
end $$;

revoke all on function public.poser_secret_exploitation(text, text) from public, anon, authenticated;
grant execute on function public.poser_secret_exploitation(text, text) to service_role;

-- Le secret partage entre la base (pg_cron -> pg_net) et la fonction Edge de
-- collecte. Genere ICI : sa valeur ne passe par aucun message.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'collecte_hook_secret') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'collecte_hook_secret',
                                'x-hook-secret de collecter-telechargements');
  end if;
end $$;
