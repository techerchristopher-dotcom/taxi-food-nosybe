-- Messagerie, lot 4 (2026-10-13) : traduction automatique, temps réel, conversation avec
-- Taxi Food hors commande.
--
-- 1. TRADUCTION. Chaque message porte `langue_source` et `traductions` ({fr, en, it}),
--    écrites par la fonction Edge `notifier-message` (Claude) juste après l'envoi. `maj_le`
--    (posé par trigger) permet à l'interrogation régulière de relire un message déjà reçu
--    dont la traduction vient d'arriver : `messagerie_lire(p_depuis)` rend désormais les
--    messages créés OU mis à jour après le curseur. Sans clé `anthropic_api_key` au Vault,
--    rien n'est traduit et tout continue de marcher.
-- 2. TEMPS RÉEL. Chaque message (et chaque traduction) émet un signal Realtime Broadcast
--    PRIVÉ sur `commande:<id>` (ou `support:<client>`), sans contenu : l'app relit alors
--    par la RPC habituelle. L'écoute est gardée par une politique sur realtime.messages
--    (participants seulement) ; personne ne peut émettre depuis l'app (aucune politique
--    d'insertion). L'interrogation régulière reste en filet de sécurité.
-- 3. CONVERSATION AVEC TAXI FOOD. Un fil par client (`messages_support`), hors commande :
--    le client écrit depuis Profil → « Écrire à Taxi Food », l'admin répond depuis l'onglet
--    💬 Messages. Même discipline : tables fermées, RPC seulement, photos dans le bucket
--    privé `messages` sous `support/<client>/<auteur>/…`.
--    Les notifications (Telegram admin, push au client) partent de `notifier-message`.
--
-- Le Telegram des messages de commande part désormais de `notifier-message` (et non plus
-- de la base) : il doit pouvoir porter la traduction.

-- ───────────── 1. Colonnes de traduction ─────────────
alter table public.messages_commande
  add column langue_source text check (langue_source is null or langue_source ~ '^[a-z]{2}$'),
  add column traductions jsonb,
  add column maj_le timestamptz;

create or replace function public.messagerie_poser_maj_le()
returns trigger language plpgsql
as $$
begin
  if new.traductions is distinct from old.traductions or new.photo_path is distinct from old.photo_path then
    new.maj_le := clock_timestamp();
  end if;
  return new;
end $$;

create trigger messages_commande_maj_le
  before update on public.messages_commande
  for each row execute function public.messagerie_poser_maj_le();

-- ───────────── 2. Lecture : messages créés OU mis à jour après le curseur ─────────────
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
           'texte', m.texte, 'photo_path', m.photo_path, 'created_at', m.created_at,
           'langue_source', m.langue_source, 'traductions', m.traductions,
           'curseur', coalesce(m.maj_le, m.created_at))
         order by m.created_at, m.id), '[]'::json),
         max(m.created_at)
    into v_msgs, v_dernier
    from public.messages_commande m
   where m.order_id = p_order_id
     and (p_depuis is null or coalesce(m.maj_le, m.created_at) > p_depuis);

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

-- ───────────── 3. Conversation avec Taxi Food (hors commande) ─────────────
create table public.messages_support (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references auth.users(id) on delete cascade,
  auteur_id     uuid references auth.users(id) on delete set null,
  auteur_role   text not null check (auteur_role in ('client','admin')),
  texte         text check (texte is null or char_length(texte) between 1 and 1000),
  photo_path    text,
  langue_source text check (langue_source is null or langue_source ~ '^[a-z]{2}$'),
  traductions   jsonb,
  maj_le        timestamptz,
  created_at    timestamptz not null default clock_timestamp(),
  constraint messages_support_contenu check (texte is not null or photo_path is not null)
);
create index messages_support_client_idx on public.messages_support (client_id, created_at);

create table public.messages_support_lectures (
  client_id   uuid not null references auth.users(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('client','admin')),
  lu_jusqu_au timestamptz not null default now(),
  primary key (client_id, user_id, role)
);

alter table public.messages_support enable row level security;
alter table public.messages_support_lectures enable row level security;
revoke all on public.messages_support from anon, authenticated, public;
revoke all on public.messages_support_lectures from anon, authenticated, public;

create trigger messages_support_maj_le
  before update on public.messages_support
  for each row execute function public.messagerie_poser_maj_le();

-- Écriture commune (client ou admin) ; p_client = le fil.
create or replace function public.support_ecrire_interne(p_client uuid, p_role text, p_texte text, p_photo_path text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_texte text := public.messagerie_nettoyer_texte(p_texte);
  v_photo text := nullif(btrim(coalesce(p_photo_path, '')), '');
  v_m public.messages_support;
begin
  if v_texte is null and v_photo is null then raise exception 'messagerie:vide' using errcode = '22023'; end if;
  if v_texte is not null and char_length(v_texte) > 1000 then raise exception 'messagerie:trop_long' using errcode = '22023'; end if;
  if v_photo is not null then
    if v_photo not like 'support/' || p_client::text || '/' || v_uid::text || '/%'
       or v_photo like '%..%'
       or not exists (select 1 from storage.objects where bucket_id = 'messages' and name = v_photo) then
      raise exception 'messagerie:photo_invalide' using errcode = '22023';
    end if;
  end if;
  if (select count(*) from public.messages_support
       where client_id = p_client and auteur_id = v_uid and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'messagerie:trop_rapide' using errcode = '22023';
  end if;

  insert into public.messages_support (client_id, auteur_id, auteur_role, texte, photo_path)
  values (p_client, v_uid, p_role, v_texte, v_photo)
  returning * into v_m;

  insert into public.messages_support_lectures (client_id, user_id, role, lu_jusqu_au)
  values (p_client, v_uid, p_role, v_m.created_at)
  on conflict (client_id, user_id, role) do update
    set lu_jusqu_au = greatest(messages_support_lectures.lu_jusqu_au, excluded.lu_jusqu_au);

  return json_build_object(
    'id', v_m.id, 'auteur_role', v_m.auteur_role, 'est_moi', true,
    'auteur_nom', case p_role when 'admin' then 'Taxi Food'
                   else public.messagerie_nom_auteur('client', v_uid, null) end,
    'texte', v_m.texte, 'photo_path', v_m.photo_path, 'created_at', v_m.created_at,
    'langue_source', null, 'traductions', null, 'curseur', v_m.created_at);
end $$;

create or replace function public.support_lire_interne(p_client uuid, p_role text, p_depuis timestamptz)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msgs json;
  v_dernier timestamptz;
begin
  select coalesce(json_agg(json_build_object(
           'id', m.id, 'auteur_role', m.auteur_role,
           'est_moi', (m.auteur_id = v_uid and m.auteur_role = p_role),
           'auteur_nom', case m.auteur_role when 'admin' then 'Taxi Food'
                          else public.messagerie_nom_auteur('client', m.auteur_id, null) end,
           'texte', m.texte, 'photo_path', m.photo_path, 'created_at', m.created_at,
           'langue_source', m.langue_source, 'traductions', m.traductions,
           'curseur', coalesce(m.maj_le, m.created_at))
         order by m.created_at, m.id), '[]'::json),
         max(m.created_at)
    into v_msgs, v_dernier
    from public.messages_support m
   where m.client_id = p_client
     and (p_depuis is null or coalesce(m.maj_le, m.created_at) > p_depuis);

  if v_dernier is not null then
    insert into public.messages_support_lectures (client_id, user_id, role, lu_jusqu_au)
    values (p_client, v_uid, p_role, v_dernier)
    on conflict (client_id, user_id, role) do update
      set lu_jusqu_au = greatest(messages_support_lectures.lu_jusqu_au, excluded.lu_jusqu_au);
  end if;

  return json_build_object(
    'peut_ecrire', true,
    'client', public.messagerie_nom_auteur('client', p_client, null),
    'messages', v_msgs);
end $$;

revoke all on function public.support_ecrire_interne(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.support_lire_interne(uuid, text, timestamptz) from public, anon, authenticated;

-- Côté client : son propre fil.
create or replace function public.support_envoyer(p_texte text default null, p_photo_path text default null)
returns json language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  return public.support_ecrire_interne(auth.uid(), 'client', p_texte, p_photo_path);
end $$;

create or replace function public.support_lire(p_depuis timestamptz default null)
returns json language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  return public.support_lire_interne(auth.uid(), 'client', p_depuis);
end $$;

create or replace function public.support_non_lus()
returns integer language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.messages_support m
   where m.client_id = auth.uid() and m.auteur_role = 'admin'
     and m.created_at > coalesce((select l.lu_jusqu_au from public.messages_support_lectures l
                                   where l.client_id = auth.uid() and l.user_id = auth.uid() and l.role = 'client'),
                                 '-infinity'::timestamptz)
$$;

-- Côté admin.
create or replace function public.admin_support_envoyer(p_client uuid, p_texte text default null, p_photo_path text default null)
returns json language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = p_client) then
    raise exception 'messagerie:acces_refuse' using errcode = '42501';
  end if;
  return public.support_ecrire_interne(p_client, 'admin', p_texte, p_photo_path);
end $$;

create or replace function public.admin_support_lire(p_client uuid, p_depuis timestamptz default null)
returns json language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'messagerie:acces_refuse' using errcode = '42501'; end if;
  return public.support_lire_interne(p_client, 'admin', p_depuis);
end $$;

create or replace function public.admin_support_conversations(p_jours integer default 60)
returns table (client_id uuid, client text, email text, telephone text, nb_messages integer,
               dernier_role text, dernier_texte text, dernier_photo boolean, dernier_le timestamptz, non_lus integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query
  select c.client_id,
         (select p.full_name from public.profiles p where p.id = c.client_id)::text,
         (select u.email from auth.users u where u.id = c.client_id)::text,
         (select p.phone from public.profiles p where p.id = c.client_id)::text,
         (select count(*)::int from public.messages_support m where m.client_id = c.client_id),
         d.auteur_role, d.texte, d.photo_path is not null, d.created_at,
         (select count(*)::int from public.messages_support m
           where m.client_id = c.client_id and m.auteur_role = 'client'
             and m.created_at > coalesce((select l.lu_jusqu_au from public.messages_support_lectures l
                                           where l.client_id = c.client_id and l.user_id = auth.uid() and l.role = 'admin'),
                                         '-infinity'::timestamptz))
    from (select distinct ms.client_id from public.messages_support ms) c
    join lateral (select m.* from public.messages_support m where m.client_id = c.client_id
                   order by m.created_at desc limit 1) d on true
   where d.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_jours, 60), 365)))
   order by d.created_at desc;
end $$;

revoke all on function public.support_envoyer(text, text) from public, anon;
revoke all on function public.support_lire(timestamptz) from public, anon;
revoke all on function public.support_non_lus() from public, anon;
revoke all on function public.admin_support_envoyer(uuid, text, text) from public, anon;
revoke all on function public.admin_support_lire(uuid, timestamptz) from public, anon;
revoke all on function public.admin_support_conversations(integer) from public, anon;
grant execute on function public.support_envoyer(text, text) to authenticated;
grant execute on function public.support_lire(timestamptz) to authenticated;
grant execute on function public.support_non_lus() to authenticated;
grant execute on function public.admin_support_envoyer(uuid, text, text) to authenticated;
grant execute on function public.admin_support_lire(uuid, timestamptz) to authenticated;
grant execute on function public.admin_support_conversations(integer) to authenticated;

-- Photos du fil Taxi Food : support/<client>/<auteur>/<fichier>.
create policy messages_support_depot on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'messages'
    and (storage.foldername(name))[1] = 'support'
    and (storage.foldername(name))[3] = auth.uid()::text
    and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
  );
create policy messages_support_lecture on storage.objects
  for select to authenticated
  using (
    bucket_id = 'messages'
    and (storage.foldername(name))[1] = 'support'
    and ((storage.foldername(name))[2] = auth.uid()::text or public.is_admin())
  );

-- ───────────── 4. Notifications et signal temps réel ─────────────
-- Le trigger ne fait plus que deux choses : appeler `notifier-message` (traduction, push,
-- Telegram) et émettre le signal Realtime. Toute erreur est avalée.
create or replace function public.messagerie_notifier()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_secret text;
  v_type text := case tg_table_name when 'messages_support' then 'support' else 'commande' end;
  v_topic text;
begin
  begin
    v_topic := case v_type when 'support' then 'support:' || (to_jsonb(new)->>'client_id')
                           else 'commande:' || (to_jsonb(new)->>'order_id') end;
    perform realtime.send(jsonb_build_object('id', new.id), case tg_op when 'INSERT' then 'nouveau' else 'maj' end,
                          v_topic, true);
    if tg_op = 'INSERT' then
      select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
      if v_secret is not null then
        perform net.http_post(
          url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notifier-message',
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
          body := jsonb_build_object('message_id', new.id, 'type', v_type),
          timeout_milliseconds := 30000);
      end if;
    end if;
  exception when others then
    raise warning 'messagerie_notifier : notification non envoyee (%)', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.messagerie_notifier() from public, anon, authenticated;

create trigger messages_commande_signal_maj
  after update of traductions on public.messages_commande
  for each row execute function public.messagerie_notifier();
create trigger messages_support_notifier
  after insert on public.messages_support
  for each row execute function public.messagerie_notifier();
create trigger messages_support_signal_maj
  after update of traductions on public.messages_support
  for each row execute function public.messagerie_notifier();

-- Écoute des signaux : participants de la commande, ou le client de son fil, ou l'admin.
create policy messagerie_ecoute on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (realtime.topic() like 'commande:%'
        and public.messagerie_participe(public.messagerie_uuid_ou_null(substr(realtime.topic(), 10))))
      or realtime.topic() = 'support:' || auth.uid()::text
      or (realtime.topic() like 'support:%' and public.is_admin())
    )
  );

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('messages_support','messages_support_lectures')) then
    raise exception 'garde: aucune politique attendue sur messages_support';
  end if;
  if has_table_privilege('authenticated', 'public.messages_support', 'select') then
    raise exception 'garde: messages_support ne doit etre lisible par personne';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'realtime' and cmd in ('INSERT','ALL')) then
    raise exception 'garde: personne ne doit pouvoir emettre sur realtime.messages';
  end if;
end $$;
