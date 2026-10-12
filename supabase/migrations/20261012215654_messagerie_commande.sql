-- Messagerie de commande (lot 1 : la base) — 2026-10-13
--
-- Une conversation par commande, partagée entre le client, le livreur assigné et le
-- restaurant (décision du porteur du projet : « inclus aussi le resto »). Taxi Food
-- (admin) lit tout et peut écrire : c'est la porte du futur support client.
--
-- Règles, toutes en base (l'écran n'est jamais l'autorité) :
--   * personne n'écrit ni ne lit la table directement : RLS sans politique, aucun droit,
--     tout passe par des fonctions SECURITY DEFINER ;
--   * l'appelant dit EN TANT QUE QUI il parle (client / livreur / restaurant / admin) et la
--     base vérifie qu'il tient ce rôle SUR CETTE commande. Un même compte peut porter
--     plusieurs rôles (le porteur du projet est client, livreur, staff d'Angelo et admin) :
--     deviner le rôle se tromperait ;
--   * le livreur n'a accès qu'à la commande qui lui est assignée ; s'il la relâche, il perd
--     l'accès (y compris à l'historique) ;
--   * on écrit jusqu'à 2 h après la livraison ou l'annulation, ensuite lecture seule ;
--   * commande saisie par téléphone : pas de messagerie (le client n'a pas l'app, la
--     commande appartient au compte admin) ;
--   * photos dans le bucket PRIVÉ `messages`, chemin `<commande>/<auteur>/<fichier>`, lues
--     par liens signés : une photo de portail ou de maison ne doit jamais être publique ;
--   * plafond : 12 messages par minute et par auteur sur une commande.
--
-- Conservation des photos : 90 jours (décision du 2026-10-13). La purge passe par l'API
-- Storage (une suppression SQL dans storage.objects laisse le fichier) : elle arrive au
-- lot 3 avec la fonction Edge des notifications.

-- ───────────────────────────── Tables ─────────────────────────────

create table public.messages_commande (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  auteur_id   uuid references auth.users(id) on delete set null,
  auteur_role text not null check (auteur_role in ('client','livreur','restaurant','admin')),
  texte       text check (texte is null or char_length(texte) between 1 and 500),
  photo_path  text,
  created_at  timestamptz not null default now(),
  constraint messages_commande_contenu check (texte is not null or photo_path is not null)
);
create index messages_commande_order_idx on public.messages_commande (order_id, created_at);
create index messages_commande_auteur_idx on public.messages_commande (auteur_id, created_at);

-- Jusqu'où chacun a lu, par commande et par rôle (un compte peut lire en deux rôles).
create table public.messages_lectures (
  order_id      uuid not null references public.orders(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('client','livreur','restaurant','admin')),
  lu_jusqu_au   timestamptz not null default now(),
  primary key (order_id, user_id, role)
);

alter table public.messages_commande enable row level security;
alter table public.messages_lectures enable row level security;
revoke all on public.messages_commande from anon, authenticated, public;
revoke all on public.messages_lectures from anon, authenticated, public;

-- ───────────────────────────── Briques ─────────────────────────────

-- Qui l'appelant peut-il être sur cette commande, et peut-il encore écrire ?
-- Rend null si l'appelant ne tient pas ce rôle sur la commande (ou si elle n'existe pas).
create or replace function public.messagerie_acces(p_order_id uuid, p_role text)
returns table (peut_lire boolean, peut_ecrire boolean, ferme_le timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_o public.orders;
  v_uid uuid := auth.uid();
  v_ok boolean := false;
  v_ferme timestamptz;
begin
  if v_uid is null or p_order_id is null then return; end if;
  select * into v_o from public.orders where id = p_order_id;
  if v_o.id is null then return; end if;
  -- Commande par téléphone : pas de conversation possible.
  if exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then return; end if;

  v_ok := case p_role
    when 'client'     then v_o.user_id = v_uid
    when 'livreur'    then v_o.courier_id = v_uid and public.is_active_courier()
    when 'restaurant' then public.is_active_restaurant_staff_of(v_o.restaurant_id)
    when 'admin'      then public.is_admin()
    else false end;
  if not coalesce(v_ok, false) then return; end if;

  v_ferme := case v_o.status
    when 'livree'  then coalesce(v_o.delivered_at, v_o.status_updated_at, now()) + interval '2 hours'
    when 'annulee' then coalesce(v_o.status_updated_at, now()) + interval '2 hours'
    else null end;

  peut_lire := true;
  peut_ecrire := v_ferme is null or now() < v_ferme;
  ferme_le := v_ferme;
  return next;
end $$;

-- Identifiant de commande lu dans un chemin de Storage, sans jamais lever d'erreur.
create or replace function public.messagerie_uuid_ou_null(p text)
returns uuid language sql immutable
as $$
  select case when p ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then p::uuid end
$$;

-- Le compte connecté participe-t-il à cette commande, à quelque titre que ce soit ?
-- Sert aux politiques du bucket : une photo se lit par tout participant.
create or replace function public.messagerie_participe(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from unnest(array['client','livreur','restaurant','admin']) r
    where exists (select 1 from public.messagerie_acces(p_order_id, r) a where a.peut_lire)
  )
$$;

create or replace function public.messagerie_peut_deposer(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from unnest(array['client','livreur','restaurant','admin']) r
    where exists (select 1 from public.messagerie_acces(p_order_id, r) a where a.peut_ecrire)
  )
$$;

-- Texte : caractères de contrôle retirés (sauf saut de ligne), espaces resserrés,
-- trois sauts de ligne et plus ramenés à deux, vide → null.
create or replace function public.messagerie_nettoyer_texte(p text)
returns text language sql immutable
as $$
  select nullif(btrim(regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(p, ''), E'[\\x00-\\x09\\x0B-\\x1F\\x7F]', '', 'g'),
             E'[ \\t]+', ' ', 'g'),
           E'\\n{3,}', E'\n\n', 'g')), '')
$$;

-- Nom affiché d'un participant : prénom pour une personne, nom du restaurant, « Taxi Food ».
create or replace function public.messagerie_nom_auteur(p_role text, p_auteur uuid, p_restaurant uuid)
returns text language sql stable security definer set search_path = public
as $$
  select case p_role
    when 'restaurant' then (select name from public.restaurants where id = p_restaurant)
    when 'admin' then 'Taxi Food'
    else nullif(split_part(btrim((select full_name from public.profiles where id = p_auteur)), ' ', 1), '')
  end
$$;

-- ───────────────────────────── RPC ─────────────────────────────

create or replace function public.messagerie_envoyer(
  p_order_id uuid, p_en_tant_que text, p_texte text default null, p_photo_path text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_acces record;
  v_uid uuid := auth.uid();
  v_texte text := public.messagerie_nettoyer_texte(p_texte);
  v_photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  v_m public.messages_commande;
  v_o public.orders;
begin
  select * into v_acces from public.messagerie_acces(p_order_id, p_en_tant_que);
  if not found then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  if not v_acces.peut_ecrire then raise exception 'messagerie:fermee' using errcode = '22023'; end if;

  if v_texte is null and v_photo is null then raise exception 'messagerie:vide' using errcode = '22023'; end if;
  if v_texte is not null and char_length(v_texte) > 500 then
    raise exception 'messagerie:trop_long' using errcode = '22023';
  end if;

  if v_photo is not null then
    -- La photo doit être dans le dossier de CETTE commande et de CET auteur, et exister.
    if v_photo not like p_order_id::text || '/' || v_uid::text || '/%'
       or v_photo like '%..%'
       or not exists (select 1 from storage.objects where bucket_id = 'messages' and name = v_photo) then
      raise exception 'messagerie:photo_invalide' using errcode = '22023';
    end if;
  end if;

  if (select count(*) from public.messages_commande
       where order_id = p_order_id and auteur_id = v_uid
         and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'messagerie:trop_rapide' using errcode = '22023';
  end if;

  insert into public.messages_commande (order_id, auteur_id, auteur_role, texte, photo_path)
  values (p_order_id, v_uid, p_en_tant_que, v_texte, v_photo)
  returning * into v_m;

  -- Écrire vaut avoir lu jusque-là.
  insert into public.messages_lectures (order_id, user_id, role, lu_jusqu_au)
  values (p_order_id, v_uid, p_en_tant_que, v_m.created_at)
  on conflict (order_id, user_id, role) do update set lu_jusqu_au = greatest(messages_lectures.lu_jusqu_au, excluded.lu_jusqu_au);

  select * into v_o from public.orders where id = p_order_id;
  return json_build_object(
    'id', v_m.id, 'auteur_role', v_m.auteur_role, 'est_moi', true,
    'auteur_nom', public.messagerie_nom_auteur(v_m.auteur_role, v_uid, v_o.restaurant_id),
    'texte', v_m.texte, 'photo_path', v_m.photo_path, 'created_at', v_m.created_at);
end $$;

-- Lit la conversation (et la marque comme lue pour ce rôle).
-- p_depuis : ne rendre que les messages postérieurs (interrogation régulière légère).
create or replace function public.messagerie_lire(
  p_order_id uuid, p_en_tant_que text, p_depuis timestamptz default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_acces record;
  v_uid uuid := auth.uid();
  v_o public.orders;
  v_msgs json;
  v_dernier timestamptz;
begin
  select * into v_acces from public.messagerie_acces(p_order_id, p_en_tant_que);
  if not found then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  select * into v_o from public.orders where id = p_order_id;

  select coalesce(json_agg(json_build_object(
           'id', m.id, 'auteur_role', m.auteur_role,
           'est_moi', (m.auteur_id = v_uid and m.auteur_role = p_en_tant_que),
           'auteur_nom', public.messagerie_nom_auteur(m.auteur_role, m.auteur_id, v_o.restaurant_id),
           'texte', m.texte, 'photo_path', m.photo_path, 'created_at', m.created_at)
         order by m.created_at, m.id), '[]'::json),
         max(m.created_at)
    into v_msgs, v_dernier
    from public.messages_commande m
   where m.order_id = p_order_id
     and (p_depuis is null or m.created_at > p_depuis);

  if v_dernier is not null then
    insert into public.messages_lectures (order_id, user_id, role, lu_jusqu_au)
    values (p_order_id, v_uid, p_en_tant_que, v_dernier)
    on conflict (order_id, user_id, role) do update
      set lu_jusqu_au = greatest(messages_lectures.lu_jusqu_au, excluded.lu_jusqu_au);
  end if;

  return json_build_object(
    'order_number', v_o.order_number,
    'peut_ecrire', v_acces.peut_ecrire,
    'ferme_le', v_acces.ferme_le,
    'participants', json_build_object(
      'client', public.messagerie_nom_auteur('client', v_o.user_id, v_o.restaurant_id),
      'livreur', case when v_o.courier_id is not null
                      then public.messagerie_nom_auteur('livreur', v_o.courier_id, v_o.restaurant_id) end,
      'restaurant', public.messagerie_nom_auteur('restaurant', null, v_o.restaurant_id)),
    'messages', v_msgs);
end $$;

-- Badges : messages non lus (écrits par les AUTRES rôles) par commande, pour un rôle.
-- p_orders vide = toutes les commandes récentes (7 jours) où l'appelant tient ce rôle.
create or replace function public.messagerie_non_lus(p_en_tant_que text, p_orders uuid[] default null)
returns table (order_id uuid, non_lus integer, dernier_le timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;
  return query
  with candidates as (
    select o.id
      from public.orders o
     where (p_orders is null or o.id = any(p_orders))
       and o.created_at > now() - interval '7 days'
       and exists (select 1 from public.messages_commande m where m.order_id = o.id)
       and case p_en_tant_que
             when 'client'     then o.user_id = v_uid
             when 'livreur'    then o.courier_id = v_uid
             when 'restaurant' then public.is_active_restaurant_staff_of(o.restaurant_id)
             when 'admin'      then public.is_admin()
             else false end
       and exists (select 1 from public.messagerie_acces(o.id, p_en_tant_que) a where a.peut_lire)
  )
  select c.id,
         (select count(*)::int from public.messages_commande m
           where m.order_id = c.id
             and m.auteur_role <> p_en_tant_que
             and m.created_at > coalesce((select l.lu_jusqu_au from public.messages_lectures l
                                           where l.order_id = c.id and l.user_id = v_uid
                                             and l.role = p_en_tant_que), '-infinity'::timestamptz)),
         (select max(m.created_at) from public.messages_commande m where m.order_id = c.id)
    from candidates c;
end $$;

-- ───────────────────────────── Droits ─────────────────────────────

revoke all on function public.messagerie_acces(uuid, text) from public, anon, authenticated;
revoke all on function public.messagerie_participe(uuid) from public, anon;
revoke all on function public.messagerie_peut_deposer(uuid) from public, anon;
revoke all on function public.messagerie_nom_auteur(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.messagerie_nettoyer_texte(text) from public, anon, authenticated;
revoke all on function public.messagerie_uuid_ou_null(text) from public, anon;
revoke all on function public.messagerie_envoyer(uuid, text, text, text) from public, anon;
revoke all on function public.messagerie_lire(uuid, text, timestamptz) from public, anon;
revoke all on function public.messagerie_non_lus(text, uuid[]) from public, anon;

-- Les politiques Storage s'évaluent avec le rôle de l'appelant : il lui faut EXECUTE.
grant execute on function public.messagerie_participe(uuid) to authenticated;
grant execute on function public.messagerie_peut_deposer(uuid) to authenticated;
grant execute on function public.messagerie_uuid_ou_null(text) to authenticated;
grant execute on function public.messagerie_envoyer(uuid, text, text, text) to authenticated;
grant execute on function public.messagerie_lire(uuid, text, timestamptz) to authenticated;
grant execute on function public.messagerie_non_lus(text, uuid[]) to authenticated;

-- ───────────────────────────── Bucket privé ─────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('messages', 'messages', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Dépôt : dans le dossier <commande>/<moi>/, et seulement tant que la conversation est ouverte.
create policy messages_depot_participant on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messages'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.messagerie_peut_deposer(public.messagerie_uuid_ou_null((storage.foldername(name))[1]))
  );

-- Lecture (liens signés) : tout participant de la commande.
create policy messages_lecture_participant on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and public.messagerie_participe(public.messagerie_uuid_ou_null((storage.foldername(name))[1]))
  );

-- Garde : la migration refuse de passer si quelque chose a été rouvert.
do $$
begin
  if (select public from storage.buckets where id = 'messages') then
    raise exception 'garde: le bucket messages doit etre prive';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('messages_commande','messages_lectures')) then
    raise exception 'garde: aucune politique attendue sur les tables de messagerie';
  end if;
  if has_table_privilege('anon', 'public.messages_commande', 'select')
     or has_table_privilege('authenticated', 'public.messages_commande', 'select') then
    raise exception 'garde: la table messages_commande ne doit etre lisible par personne';
  end if;
end $$;
