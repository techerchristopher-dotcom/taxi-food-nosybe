-- Notation et avis clients — lot 1 (2026-09-30). Conception : docs/NOTATION-AVIS.md.
--
-- Trois notes de 1 à 5 (cuisine, préparation, livraison) + un commentaire, par
-- commande LIVRÉE, par le client de la commande, sous sept jours. La note d'un
-- restaurant = cuisine + préparation, SANS la livraison (la livraison juge le
-- livreur, pas la cuisine). Elle ne s'affiche qu'à partir de trois avis.
--
-- Au passage, ce qui manquait pour mesurer les délais : `orders.accepted_at` et
-- `orders.ready_at`, posés par un trigger à CHAQUE transition de statut, quel que
-- soit le chemin (restaurateur, pg_cron, admin). Et `delivered_at` se pose enfin
-- aussi quand l'admin passe une commande en « livrée ».
--
-- ⚠️ `notify_order_status()` n'est PAS touché : il est patché par ancres et le
-- dépôt n'en a pas la définition à jour. La relance « Comment c'était ? » appelle
-- l'Edge Function `notify-order` elle-même (event = 'noter'), depuis pg_cron.

-- =====================================================================
-- 1. Les jalons manquants sur les commandes
-- =====================================================================
alter table public.orders
  add column if not exists accepted_at        timestamptz,
  add column if not exists ready_at           timestamptz,
  add column if not exists invitation_avis_le timestamptz;

comment on column public.orders.accepted_at is
  'Quand le restaurant a accepté (passage en confirmee). Posé par le trigger orders_jalons_statut.';
comment on column public.orders.ready_at is
  'Quand la commande a été mise à disposition du livreur (passage en en_livraison). Posé par le trigger orders_jalons_statut.';
comment on column public.orders.invitation_avis_le is
  'Quand la relance « notez votre commande » est partie. Une seule, jamais deux.';

-- Un seul trigger, BEFORE, pour que le jalon parte dans la même écriture que le
-- statut : aucune RPC n'a à y penser, et le chemin admin est couvert.
create or replace function public.poser_jalons_statut()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('confirmee', 'en_preparation') and new.accepted_at is null then
      new.accepted_at := now();
    end if;
    if new.status = 'en_livraison' and new.ready_at is null then
      new.ready_at := now();
    end if;
    if new.status = 'livree' and new.delivered_at is null then
      new.delivered_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_jalons_statut on public.orders;
create trigger orders_jalons_statut
  before update of status on public.orders
  for each row execute function public.poser_jalons_statut();

-- =====================================================================
-- 2. La table des avis
-- =====================================================================
create table if not exists public.avis (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null unique references public.orders(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  restaurant_id            uuid not null references public.restaurants(id) on delete cascade,
  courier_id               uuid,
  note_cuisine             smallint not null check (note_cuisine between 1 and 5),
  note_preparation         smallint not null check (note_preparation between 1 and 5),
  note_livraison           smallint not null check (note_livraison between 1 and 5),
  -- La note du RESTAURANT : cuisine et préparation. Pas la livraison.
  note_restaurant          numeric(3,2) generated always as ((note_cuisine + note_preparation) / 2.0) stored,
  commentaire              text check (commentaire is null or length(commentaire) between 1 and 500),
  prenom_affiche           text not null,
  consentement_publication boolean not null default false,
  langue                   text not null default 'fr' check (langue in ('fr', 'en', 'it')),
  statut                   text not null default 'publie' check (statut in ('publie', 'masque')),
  reponse_restaurant       text check (reponse_restaurant is null or length(reponse_restaurant) between 1 and 500),
  reponse_le               timestamptz,
  utilise_reseaux_le       timestamptz,
  code_promo_id            uuid references public.promo_codes(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists avis_restaurant_idx on public.avis (restaurant_id, statut, created_at desc);
create index if not exists avis_user_idx on public.avis (user_id);
create index if not exists avis_courier_idx on public.avis (courier_id) where courier_id is not null;

comment on table public.avis is
  'Un avis par commande livrée : trois notes 1-5 + commentaire. Lecture et écriture par RPC uniquement (docs/NOTATION-AVIS.md).';

-- RLS sans aucune politique : tout passe par les RPC ci-dessous.
alter table public.avis enable row level security;
revoke all on table public.avis from public, anon, authenticated;

-- =====================================================================
-- 3. Le prénom affiché
-- =====================================================================
-- Le premier mot du nom complet, avec ses accents, première lettre en capitale.
-- Figé sur l'avis : renommer son profil ne réécrit pas les avis passés, et
-- aucune lecture publique de `profiles` n'est nécessaire.
create or replace function public.prenom_affiche(p_full_name text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select coalesce(
    nullif(left(initcap(split_part(btrim(coalesce(p_full_name, '')), ' ', 1)), 30), ''),
    'Client');
$$;

revoke all on function public.prenom_affiche(text) from public, anon, authenticated;

-- =====================================================================
-- 4. Déposer un avis
-- =====================================================================
-- Vérifie TOUT ici : l'écran n'est pas l'autorité. Renvoie le code promo de
-- remerciement (2 000 Ar sur la livraison, 30 jours, une utilisation, partout,
-- payé par Taxi Food) : `{"code": "AVISMARIE", "valeur": 2000, "expire_le": …}`.
create or replace function public.deposer_avis(
  p_order_id     uuid,
  p_cuisine      integer,
  p_preparation  integer,
  p_livraison    integer,
  p_commentaire  text default null,
  p_consentement boolean default false,
  p_langue       text default 'fr')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid      uuid := auth.uid();
  v_o        public.orders;
  v_nom      text;
  v_comm     text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_langue   text := case when p_langue in ('fr', 'en', 'it') then p_langue else 'fr' end;
  v_avis_id  uuid;
  v_base     text;
  v_candidat text;
  v_suffixe  integer := 1;
  v_code     public.promo_codes;
  v_expire   timestamptz := now() + interval '30 days';
  c_montant  constant integer := 2000;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_cuisine is null or p_preparation is null or p_livraison is null
     or p_cuisine not between 1 and 5 or p_preparation not between 1 and 5
     or p_livraison not between 1 and 5 then
    raise exception 'avis:notes_invalides' using errcode = '22023';
  end if;
  if v_comm is not null and length(v_comm) > 500 then
    raise exception 'avis:commentaire_trop_long' using errcode = '22023';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.user_id is distinct from v_uid then
    -- Même réponse qu'une commande absente : on ne révèle pas l'existence
    -- d'une commande qui n'est pas la sienne.
    raise exception 'avis:commande_introuvable' using errcode = '42501';
  end if;
  if v_o.status <> 'livree' then
    raise exception 'avis:commande_non_livree' using errcode = '22023';
  end if;
  if coalesce(v_o.delivered_at, v_o.status_updated_at) < now() - interval '7 days' then
    raise exception 'avis:trop_tard' using errcode = '22023';
  end if;
  -- Commande saisie par téléphone : le compte est celui de l'admin, pas du client.
  if exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then
    raise exception 'avis:commande_telephone' using errcode = '22023';
  end if;
  if exists (select 1 from public.avis a where a.order_id = v_o.id) then
    raise exception 'avis:deja_depose' using errcode = '23505';
  end if;

  select p.full_name into v_nom from public.profiles p where p.id = v_uid;

  insert into public.avis (order_id, user_id, restaurant_id, courier_id,
                           note_cuisine, note_preparation, note_livraison,
                           commentaire, prenom_affiche, consentement_publication, langue)
  values (v_o.id, v_uid, v_o.restaurant_id, v_o.courier_id,
          p_cuisine, p_preparation, p_livraison,
          v_comm, public.prenom_affiche(v_nom), coalesce(p_consentement, false), v_langue)
  returning id into v_avis_id;

  -- Le code de remerciement, sur le modèle des codes offerts (MERCI<PRENOM>) :
  -- AVIS<PRENOM>, suffixé en cas de collision.
  v_base := 'AVIS' || substr(public.code_offert_nom_de_base(v_nom), 6);
  loop
    v_candidat := case when v_suffixe = 1 then v_base else v_base || v_suffixe::text end;
    if not exists (select 1 from public.promo_codes pc where pc.code_normalise = v_candidat) then
      begin
        insert into public.promo_codes (
          code, type_remise, valeur, porte_sur, actif, commence_le, expire_le,
          max_utilisations, description, beneficiaire_id, restaurant_id,
          inclut_emballage, exclut_boissons, pris_en_charge_par, commande_origine_id)
        values (
          v_candidat, 'montant', c_montant, 'livraison', true, now(), v_expire,
          1, 'Merci pour votre avis', v_uid, null,
          false, false, 'taxi_food', v_o.id)
        returning * into v_code;
      exception when unique_violation then
        v_code := null;
      end;
    end if;
    exit when v_code.id is not null;
    v_suffixe := v_suffixe + 1;
    if v_suffixe > 999 then
      raise exception 'avis:code_introuvable';
    end if;
  end loop;

  update public.avis set code_promo_id = v_code.id where id = v_avis_id;

  return jsonb_build_object('code', v_code.code, 'valeur', v_code.valeur, 'expire_le', v_code.expire_le);
end $$;

-- =====================================================================
-- 5. Relire son avis
-- =====================================================================
create or replace function public.mon_avis(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
           'note_cuisine', a.note_cuisine,
           'note_preparation', a.note_preparation,
           'note_livraison', a.note_livraison,
           'commentaire', a.commentaire,
           'consentement_publication', a.consentement_publication,
           'created_at', a.created_at,
           'code', pc.code,
           'code_valeur', pc.valeur,
           'code_expire_le', pc.expire_le)
    from public.avis a
    left join public.promo_codes pc on pc.id = a.code_promo_id
   where a.order_id = p_order_id and a.user_id = auth.uid();
$$;

-- =====================================================================
-- 6. Les avis d'un restaurant (lecture publique)
-- =====================================================================
-- Rien d'autre que ce qui s'affiche : prénom figé, notes, texte, date, réponse.
-- Jamais user_id, jamais order_id.
create or replace function public.avis_restaurant(
  p_restaurant_id uuid,
  p_limite        integer default 20,
  p_decalage      integer default 0)
returns table (
  id uuid, prenom text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, created_at timestamptz,
  reponse_restaurant text, reponse_le timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le
    from public.avis a
   where a.restaurant_id = p_restaurant_id and a.statut = 'publie'
   order by a.created_at desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

-- =====================================================================
-- 7. La note du restaurant, en colonnes calculées PostgREST
-- =====================================================================
-- `select id, name, note_moyenne, nb_avis from restaurants` — comme ouvre_a(r).
-- SECURITY DEFINER : la table des avis ne se lit pas directement.
create or replace function public.nb_avis(r public.restaurants)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer from public.avis a where a.restaurant_id = r.id and a.statut = 'publie';
$$;

create or replace function public.note_moyenne(r public.restaurants)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select round(avg(a.note_restaurant), 1)
    from public.avis a
   where a.restaurant_id = r.id and a.statut = 'publie'
  having count(*) >= 3;
$$;

comment on function public.note_moyenne(public.restaurants) is
  'Moyenne des notes restaurant (cuisine + préparation), sur une décimale. Null sous trois avis.';
comment on function public.nb_avis(public.restaurants) is
  'Nombre d''avis publiés du restaurant.';

-- =====================================================================
-- 8. La relance « Comment c'était ? »
-- =====================================================================
-- Toutes les 10 minutes : les commandes livrées il y a 40 min à 6 h, sans avis,
-- jamais relancées. Pose `invitation_avis_le` AVANT d'appeler l'Edge Function :
-- un appel HTTP raté ne provoque jamais une seconde relance.
create or replace function public.relancer_avis_a_donner()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
  v_id     uuid;
  v_n      integer := 0;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_secret is null then
    raise warning 'push_hook_secret absent du Vault : relance avis non envoyee';
    return 0;
  end if;

  for v_id in
    with cibles as (
      select o.id
        from public.orders o
       where o.status = 'livree'
         and o.user_id is not null
         and o.invitation_avis_le is null
         and o.delivered_at between now() - interval '6 hours' and now() - interval '40 minutes'
         and not exists (select 1 from public.avis a where a.order_id = o.id)
         and not exists (select 1 from public.commandes_telephone ct where ct.order_id = o.id)
       order by o.delivered_at
       limit 50
         for update of o skip locked
    )
    update public.orders o
       set invitation_avis_le = now()
      from cibles
     where o.id = cibles.id
     returning o.id
  loop
    perform net.http_post(
      url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notify-order',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
      body := jsonb_build_object('order_id', v_id, 'status', 'livree', 'event', 'noter'),
      timeout_milliseconds := 5000);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

select cron.schedule(
  'relance-avis',
  '*/10 * * * *',
  $cmd$select public.relancer_avis_a_donner()$cmd$
);

-- =====================================================================
-- 9. Droits
-- =====================================================================
revoke all on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text) from public;
revoke all on function public.mon_avis(uuid) from public;
revoke all on function public.avis_restaurant(uuid, integer, integer) from public;
revoke all on function public.nb_avis(public.restaurants) from public;
revoke all on function public.note_moyenne(public.restaurants) from public;
revoke all on function public.relancer_avis_a_donner() from public, anon, authenticated;
revoke all on function public.poser_jalons_statut() from public, anon, authenticated;

grant execute on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text) to authenticated;
grant execute on function public.mon_avis(uuid) to authenticated;
grant execute on function public.avis_restaurant(uuid, integer, integer) to anon, authenticated;
grant execute on function public.nb_avis(public.restaurants) to anon, authenticated;
grant execute on function public.note_moyenne(public.restaurants) to anon, authenticated;

-- =====================================================================
-- 10. Contrôles
-- =====================================================================
do $$
declare v_n integer;
begin
  if not exists (select 1 from pg_trigger where tgname = 'orders_jalons_statut') then
    raise exception 'trigger orders_jalons_statut absent';
  end if;
  if not exists (select 1 from cron.job where jobname = 'relance-avis') then
    raise exception 'tâche relance-avis absente';
  end if;
  -- Les colonnes calculées répondent (null : aucun avis encore).
  select count(*) into v_n from public.restaurants r where public.nb_avis(r) <> 0;
  if v_n <> 0 then
    raise exception 'nb_avis non nul avant tout avis : %', v_n;
  end if;
  if public.prenom_affiche('marie-claire rakoto') <> 'Marie-Claire'
     or public.prenom_affiche('') <> 'Client' then
    raise exception 'prenom_affiche : résultat inattendu';
  end if;
end $$;
