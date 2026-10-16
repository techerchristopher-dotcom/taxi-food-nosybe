-- Commander pour PLUS TARD, le jour même (2026-10-16).
--
-- Décision du porteur du projet : un client peut commander même quand le restaurant est
-- fermé, en choisissant l'heure de livraison — AUJOURD'HUI seulement, jamais pour demain.
--
-- Le déroulé :
--   1. le client choisit « livré à 19h00 » ; la base calcule le LANCEMENT en cuisine
--      = 19h00 − (préparation + livraison estimées par estimer_delais) − 10 min de marge ;
--   2. le lancement doit tomber DANS un service du restaurant, aujourd'hui (sinon refus) ;
--   3. à la commande : message d'INFORMATION au restaurant (Telegram, FR/IT) et à ton canal ;
--   4. si le restaurant est fermé, la vraie commande (n8n, boutons Accepter/Refuser, push)
--      reste MUETTE jusqu'à l'ouverture du service : la tâche `commandes-programmees` pose
--      `transmise_le`, ce qui réveille notify_order_status ; les relances 3 min et l'appel
--      vocal partent de là (commande_annoncee_le lit transmise_le) ;
--      s'il est ouvert, elle part tout de suite, comme aujourd'hui ;
--   5. à l'heure du lancement : rappel « lancez la préparation » au restaurant, et la
--      préparation automatique n'agit pas avant ;
--   6. le client peut annuler tant que la commande est `recue` (annuler_ma_reservation) ;
--   7. restaurant toujours fermé 20 min après l'heure de transmission → annulée (motif
--      « fermeture »), client prévenu par le circuit habituel.
--
-- ⚠️ create_order N'A PAS CHANGÉ DE SIGNATURE (piège PGRST203) : la nouvelle porte
-- commander_programme() pose un drapeau de transaction `taxifood.lancement_prevu`, et
-- create_order (patchée par ancres) accepte un restaurant fermé si l'heure de lancement
-- est commandable, et vérifie les catégories servies À CETTE HEURE-LÀ.
-- Les apps en magasin ne connaissent pas cette porte : pour elles, rien ne change.
--
-- Colonnes nommées pour ne PAS entrer en collision avec l'alias `annoncee_le` utilisé
-- dans alerter_commandes_sans_reponse (select o.*, commande_annoncee_le(o) as annoncee_le).

alter table public.orders
  add column if not exists livraison_souhaitee_a timestamptz,
  add column if not exists lancement_prevu_a     timestamptz,
  add column if not exists transmission_prevue_a timestamptz,
  add column if not exists transmise_le          timestamptz,
  add column if not exists rappel_preparation_le timestamptz;

create index if not exists orders_programmees_a_traiter
  on public.orders (transmission_prevue_a)
  where livraison_souhaitee_a is not null and status in ('recue', 'confirmee', 'en_preparation');

-- La file du canal admin sait aussi viser un autre canal (restaurant). NULL = canal admin.
alter table public.telegram_admin_envois add column if not exists chat_id text;

create or replace function public.telegram_admin_emettre(p_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_jeton text;
  v_chat  text;
  v_texte text;
  v_req   bigint;
begin
  select decrypted_secret into v_jeton from vault.decrypted_secrets where name = 'telegram_bot_token';
  select texte, chat_id into v_texte, v_chat from public.telegram_admin_envois where id = p_id;
  if v_chat is null then
    select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  end if;
  if v_jeton is null or v_chat is null or v_texte is null then
    update public.telegram_admin_envois
       set statut = 'abandonne', erreur = 'secret ou texte absent'
     where id = p_id;
    return;
  end if;
  select net.http_post(
    url := 'https://api.telegram.org/bot' || v_jeton || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat, 'disable_web_page_preview', true, 'text', v_texte),
    timeout_milliseconds := 20000) into v_req;
  update public.telegram_admin_envois
     set request_id = v_req, tentatives = tentatives + 1, dernier_essai_le = now()
   where id = p_id;
end $$;

-- Message à un restaurant, avec renvoi automatique (même file que le canal admin).
create or replace function public.telegram_resto_envoyer(p_chat text, p_texte text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id bigint;
begin
  if p_chat is null or p_texte is null then return; end if;
  insert into public.telegram_admin_envois (texte, chat_id) values (p_texte, p_chat) returning id into v_id;
  perform public.telegram_admin_emettre(v_id);
exception when others then
  raise warning 'telegram_resto_envoyer : % ', sqlerrm;
end $$;

-- ------------------------------------------------------------------ outils d'heure
create or replace function public.heure_nb(p_t timestamptz, p_langue text default 'fr')
returns text language sql stable set search_path to 'public' as $$
  select case when p_langue = 'it'
              then to_char(p_t at time zone 'Indian/Antananarivo', 'HH24:MI')
              else to_char(p_t at time zone 'Indian/Antananarivo', 'HH24"h"MI') end
$$;

create or replace function public.lancement_programme()
returns timestamptz language sql stable as $$
  select nullif(current_setting('taxifood.lancement_prevu', true), '')::timestamptz
$$;

-- Le restaurant est-il ouvert, selon ses horaires, à l'instant t ?
create or replace function public.ouvert_a(r public.restaurants, p_t timestamptz)
returns boolean language sql stable set search_path to 'public' as $$
  select p_t is not null and r.auto_open and exists (
    select 1 from public.restaurant_hours h
     where h.restaurant_id = r.id
       and h.weekday = extract(dow from (p_t at time zone 'Indian/Antananarivo'))::smallint
       and not h.is_closed
       and public.heure_dans_plage(h.opens_at, h.closes_at, (p_t at time zone 'Indian/Antananarivo')::time))
$$;

-- Début du service qui contient l'instant t (pour savoir quand transmettre la commande).
create or replace function public.debut_service_a(r public.restaurants, p_t timestamptz)
returns timestamptz language sql stable set search_path to 'public' as $$
  select ((case when h.opens_at <= (p_t at time zone 'Indian/Antananarivo')::time
                then (p_t at time zone 'Indian/Antananarivo')::date
                else (p_t at time zone 'Indian/Antananarivo')::date - 1 end) + h.opens_at)
         at time zone 'Indian/Antananarivo'
    from public.restaurant_hours h
   where h.restaurant_id = r.id
     and h.weekday = extract(dow from (p_t at time zone 'Indian/Antananarivo'))::smallint
     and not h.is_closed
     and public.heure_dans_plage(h.opens_at, h.closes_at, (p_t at time zone 'Indian/Antananarivo')::time)
   order by h.service
   limit 1
$$;

-- Commandable pour un lancement à l'instant t : aujourd'hui, dans le futur, restaurant
-- visible, en ouverture automatique (des horaires connus) et ouvert à cette heure-là.
create or replace function public.commandable_a(r public.restaurants, p_t timestamptz)
returns boolean language sql stable set search_path to 'public' as $$
  select p_t is not null
     and p_t > now()
     and (p_t at time zone 'Indian/Antananarivo')::date = (now() at time zone 'Indian/Antananarivo')::date
     and r.listing_status = 'visible'
     and public.ouvert_a(r, p_t)
$$;

create or replace function public.categorie_servie_a(c public.categories, p_t timestamptz)
returns boolean language sql stable set search_path to 'public' as $$
  select case
    when c.serving_from is null or c.serving_to is null then true
    else public.heure_dans_plage(c.serving_from, c.serving_to, (p_t at time zone 'Indian/Antananarivo')::time)
  end
$$;

-- Délai à prévoir entre le lancement en cuisine et la livraison (minutes), marge comprise.
create or replace function public.delai_reservation_min(p_restaurant_id uuid, p_address_id uuid, p_produits uuid[])
returns integer
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_r  public.restaurants;
  v_a  public.addresses;
  v_km numeric;
  v_total int;
begin
  select * into v_r from public.restaurants where id = p_restaurant_id;
  if p_address_id is not null then
    select * into v_a from public.addresses where id = p_address_id and user_id = auth.uid();
  end if;
  if v_r.latitude is not null and v_a.latitude is not null then
    v_km := public.distance_vol_oiseau_km(v_r.latitude, v_r.longitude, v_a.latitude, v_a.longitude)
            * coalesce(v_r.livraison_coef_route, 1.3);
  end if;
  select e.total_min into v_total from public.estimer_delais(p_restaurant_id, v_km, p_produits) e;
  return coalesce(v_total, 45) + 10;
end $$;

-- Créneaux de livraison proposables AUJOURD'HUI, par quart d'heure.
create or replace function public.creneaux_livraison(p_restaurant_id uuid, p_address_id uuid default null,
                                                     p_produits uuid[] default null)
returns table(livraison timestamptz, lancement timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_r     public.restaurants;
  v_delai int;
  v_t     timestamptz;
  v_fin   timestamptz;
begin
  select * into v_r from public.restaurants where id = p_restaurant_id;
  if v_r.id is null or v_r.listing_status <> 'visible' or not v_r.auto_open then return; end if;
  v_delai := public.delai_reservation_min(p_restaurant_id, p_address_id, p_produits);
  -- Premier quart d'heure qui laisse le temps de tout faire (+1 min de battement).
  v_t := now() + make_interval(mins => v_delai + 1);
  v_t := date_trunc('hour', v_t) + make_interval(mins => (ceil(extract(minute from v_t) / 15.0) * 15)::int);
  v_fin := (((now() at time zone 'Indian/Antananarivo')::date + 1)::timestamp) at time zone 'Indian/Antananarivo';
  while v_t < v_fin loop
    if public.commandable_a(v_r, v_t - make_interval(mins => v_delai)) then
      livraison := v_t;
      lancement := v_t - make_interval(mins => v_delai);
      return next;
    end if;
    v_t := v_t + interval '15 minutes';
  end loop;
end $$;

-- ------------------------------------------------------------ la porte « plus tard »
create or replace function public.commander_programme(
  p_restaurant_id uuid, p_address_id uuid, p_payment_method text, p_items jsonb,
  p_code_promo text, p_utiliser_porte_monnaie boolean, p_livraison_souhaitee timestamptz)
returns public.orders
language plpgsql security definer set search_path to 'public' as $$
declare
  v_r          public.restaurants;
  v_produits   uuid[];
  v_delai      int;
  v_lancement  timestamptz;
  v_premier    timestamptz;
  v_o          public.orders;
  v_transm     timestamptz;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.restaurants where id = p_restaurant_id;
  if v_r.id is null or v_r.listing_status <> 'visible' or not v_r.auto_open then
    raise exception 'reservation:indisponible' using errcode = '22023';
  end if;
  if p_livraison_souhaitee is null
     or (p_livraison_souhaitee at time zone 'Indian/Antananarivo')::date
        <> (now() at time zone 'Indian/Antananarivo')::date then
    raise exception 'reservation:jour_meme' using errcode = '22023';
  end if;

  select array_agg((i->>'product_id')::uuid) into v_produits from jsonb_array_elements(p_items) i;
  v_delai := public.delai_reservation_min(p_restaurant_id, p_address_id, v_produits);
  v_lancement := p_livraison_souhaitee - make_interval(mins => v_delai);

  if not public.commandable_a(v_r, v_lancement) then
    select c.livraison into v_premier from public.creneaux_livraison(p_restaurant_id, p_address_id, v_produits) c limit 1;
    if v_lancement <= now() then
      raise exception 'reservation:trop_tot|%', coalesce(public.heure_nb(v_premier, 'it'), '') using errcode = '22023';
    end if;
    raise exception 'reservation:hors_service|%', coalesce(public.heure_nb(v_premier, 'it'), '') using errcode = '22023';
  end if;

  perform set_config('taxifood.lancement_prevu', v_lancement::text, true);
  begin
    v_o := public.create_order(p_restaurant_id, p_address_id, p_payment_method, p_items,
                               p_code_promo, coalesce(p_utiliser_porte_monnaie, false));
  exception when others then
    perform set_config('taxifood.lancement_prevu', '', true);
    raise;
  end;
  perform set_config('taxifood.lancement_prevu', '', true);

  -- Restaurant ouvert maintenant : la commande part tout de suite. Sinon, à l'ouverture
  -- du service qui contient le lancement.
  if not public.ouvert_maintenant(v_r) then
    v_transm := greatest(now(), public.debut_service_a(v_r, v_lancement));
  end if;

  update public.orders
     set livraison_souhaitee_a = p_livraison_souhaitee,
         lancement_prevu_a     = v_lancement,
         transmission_prevue_a = v_transm
   where id = v_o.id
  returning * into v_o;
  return v_o;
end $$;

-- ---------------------------------------------------------- annulation par le client
create or replace function public.annuler_ma_reservation(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path to 'public' as $$
declare
  v_o public.orders;
  v_resto text;
begin
  select * into v_o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if v_o.id is null or v_o.livraison_souhaitee_a is null then
    raise exception 'reservation:introuvable' using errcode = '22023';
  end if;
  if v_o.status <> 'recue' then
    raise exception 'reservation:deja_acceptee' using errcode = '22023';
  end if;
  update public.orders
     set status = 'annulee', status_updated_at = now(),
         cancellation_code = 'autre',
         cancellation_detail = 'Annulée par le client',
         cancellation_reason = public.composer_motif_refus('autre', 'Annulée par le client')
   where id = v_o.id
  returning * into v_o;
  if v_o.transmise_le is null then
    select name into v_resto from public.restaurants where id = v_o.restaurant_id;
    perform public.telegram_admin_envoyer('❌ RÉSERVATION ANNULÉE PAR LE CLIENT — ' || coalesce(v_resto, '?')
      || chr(10) || coalesce(v_o.order_number, '?') || ' · prévue pour ' || public.heure_nb(v_o.livraison_souhaitee_a));
  end if;
  return v_o;
end $$;

-- ------------------------------------------- message d'information à la réservation
create or replace function public.annoncer_reservation()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare
  v_o      public.orders;
  v_r      public.restaurants;
  v_it     boolean;
  v_plats  text;
  v_client text;
  v_texte  text;
begin
  select * into v_o from public.orders where id = new.id;
  if v_o.id is null or v_o.livraison_souhaitee_a is null then return null; end if;
  select * into v_r from public.restaurants where id = v_o.restaurant_id;
  v_it := v_r.langue = 'it';
  select string_agg('- ' || oi.quantity || ' x ' || oi.product_name_snapshot, chr(10) order by oi.id)
    into v_plats from public.order_items oi where oi.order_id = v_o.id;
  select coalesce(p.full_name, '-') into v_client from public.profiles p where p.id = v_o.user_id;

  if v_r.telegram_chat_id is not null then
    if v_it then
      v_texte := '📅 PRENOTAZIONE — ordine ' || v_o.order_number || chr(10)
        || 'Un cliente ha prenotato per una consegna alle ' || public.heure_nb(v_o.livraison_souhaitee_a, 'it') || ':' || chr(10)
        || coalesce(v_plats, '-') || chr(10) || chr(10)
        || case when v_o.transmission_prevue_a is not null
                then '🔔 Riceverete l''ordine da accettare all''apertura, alle '
                     || public.heure_nb(v_o.transmission_prevue_a, 'it') || '. Nulla da fare fino ad allora.'
                else '🔔 L''ordine da accettare vi viene inviato insieme a questo messaggio.' end || chr(10)
        || '👨‍🍳 Preparazione da avviare verso le ' || public.heure_nb(v_o.lancement_prevu_a, 'it') || '.';
    else
      v_texte := '📅 RÉSERVATION — commande ' || v_o.order_number || chr(10)
        || 'Un client a réservé pour une livraison à ' || public.heure_nb(v_o.livraison_souhaitee_a) || ' :' || chr(10)
        || coalesce(v_plats, '-') || chr(10) || chr(10)
        || case when v_o.transmission_prevue_a is not null
                then '🔔 Vous recevrez la commande à accepter à votre ouverture, à '
                     || public.heure_nb(v_o.transmission_prevue_a) || '. Rien à faire d''ici là.'
                else '🔔 La commande à accepter vous est envoyée en même temps.' end || chr(10)
        || '👨‍🍳 Préparation à lancer vers ' || public.heure_nb(v_o.lancement_prevu_a) || '.';
    end if;
    perform public.telegram_resto_envoyer(v_r.telegram_chat_id, v_texte);
  end if;

  perform public.telegram_admin_envoyer('📅 RÉSERVATION — ' || coalesce(v_r.name, '?') || chr(10)
    || v_o.order_number || ' · livraison souhaitée ' || public.heure_nb(v_o.livraison_souhaitee_a) || chr(10)
    || 'Préparation vers ' || public.heure_nb(v_o.lancement_prevu_a)
    || ' · transmise au restaurant ' || coalesce('à ' || public.heure_nb(v_o.transmission_prevue_a), 'maintenant') || chr(10)
    || coalesce(v_plats, '-') || chr(10)
    || 'Total : ' || public.alerte_ar(v_o.total) || ' (' || v_o.payment_method::text || ')' || chr(10)
    || 'Client : ' || v_client
    || case when v_r.telegram_chat_id is null then chr(10) || '⚠️ Restaurant sans Telegram : préviens-le toi-même' else '' end);
  return null;
exception when others then
  raise warning 'annoncer_reservation % : %', new.id, sqlerrm;
  return null;
end $$;

drop trigger if exists orders_reservation_info on public.orders;
create constraint trigger orders_reservation_info
  after insert on public.orders deferrable initially deferred
  for each row execute function public.annoncer_reservation();

-- ------------------------------------------------- tâche : transmission et rappels
create or replace function public.traiter_commandes_programmees()
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  o     record;
  v_n   int := 0;
  v_it  boolean;
begin
  -- 1. Transmettre au restaurant à son ouverture.
  for o in
    select ord.id, ord.order_number, ord.livraison_souhaitee_a, ord.lancement_prevu_a,
           ord.transmission_prevue_a, r.name as resto, r.telegram_chat_id as chat, r.langue,
           public.ouvert_maintenant(r) as ouvert
      from public.orders ord join public.restaurants r on r.id = ord.restaurant_id
     where ord.livraison_souhaitee_a is not null and ord.status = 'recue'
       and ord.transmission_prevue_a is not null and ord.transmise_le is null
       and ord.transmission_prevue_a <= now()
     for update of ord skip locked
  loop
    if o.ouvert then
      update public.orders set transmise_le = now() where id = o.id;
      v_it := o.langue = 'it';
      perform public.telegram_resto_envoyer(o.chat, case when v_it
        then '🔔 PROMEMORIA PRENOTAZIONE — ordine ' || o.order_number || chr(10)
             || 'Da consegnare alle ' || public.heure_nb(o.livraison_souhaitee_a, 'it')
             || '. L''ordine arriva tra un istante: accettatelo.' || chr(10)
             || '👨‍🍳 Preparazione da avviare verso le ' || public.heure_nb(o.lancement_prevu_a, 'it') || '.'
        else '🔔 RAPPEL RÉSERVATION — commande ' || o.order_number || chr(10)
             || 'À livrer à ' || public.heure_nb(o.livraison_souhaitee_a)
             || '. La commande arrive dans un instant : acceptez-la.' || chr(10)
             || '👨‍🍳 Préparation à lancer vers ' || public.heure_nb(o.lancement_prevu_a) || '.' end);
      perform public.telegram_admin_envoyer('🔔 Réservation transmise — ' || coalesce(o.resto, '?') || chr(10)
        || o.order_number || ' · livraison ' || public.heure_nb(o.livraison_souhaitee_a));
      v_n := v_n + 1;
    elsif o.transmission_prevue_a < now() - interval '20 minutes' then
      update public.orders
         set status = 'annulee', status_updated_at = now(),
             cancellation_code = 'fermeture',
             cancellation_detail = 'le restaurant n''était pas ouvert à l''heure prévue',
             cancellation_reason = public.composer_motif_refus('fermeture', 'le restaurant n''était pas ouvert à l''heure prévue')
       where id = o.id;
      perform public.telegram_admin_envoyer('❌ RÉSERVATION ANNULÉE — ' || coalesce(o.resto, '?') || chr(10)
        || o.order_number || ' : le restaurant n''était pas ouvert à '
        || public.heure_nb(o.transmission_prevue_a) || '. Client prévenu.');
      v_n := v_n + 1;
    end if;
  end loop;

  -- 2. Rappel « lancez la préparation » à l'heure du lancement (commande acceptée).
  for o in
    select ord.id, ord.order_number, ord.livraison_souhaitee_a, r.telegram_chat_id as chat, r.langue
      from public.orders ord join public.restaurants r on r.id = ord.restaurant_id
     where ord.livraison_souhaitee_a is not null and ord.status = 'confirmee'
       and ord.lancement_prevu_a <= now() and ord.rappel_preparation_le is null
     for update of ord skip locked
  loop
    update public.orders set rappel_preparation_le = now() where id = o.id;
    perform public.telegram_resto_envoyer(o.chat, case when o.langue = 'it'
      then '👨‍🍳 È L''ORA — ordine ' || o.order_number || chr(10)
           || 'Avviate la preparazione ora: consegna prevista alle ' || public.heure_nb(o.livraison_souhaitee_a, 'it') || '.'
      else '👨‍🍳 C''EST L''HEURE — commande ' || o.order_number || chr(10)
           || 'Lancez la préparation maintenant : livraison prévue à ' || public.heure_nb(o.livraison_souhaitee_a) || '.' end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- -------------------------------------------- date d'annonce = date de transmission
create or replace function public.commande_annoncee_le(p_o public.orders)
returns timestamptz
language sql stable security definer set search_path to 'public' as $$
  select case
    when coalesce((select carte_active from public.payment_config where id = 1), false)
         and p_o.payment_method = 'cb'
         and p_o.payment_status in ('non_requis', 'en_attente', 'echoue')
      then null
    when p_o.transmission_prevue_a is not null
      then p_o.transmise_le
    when p_o.payment_method = 'cb' and p_o.payment_status = 'paye'
      then greatest(p_o.created_at,
                    coalesce((select max(pi.captured_at) from public.payment_intents pi
                               where pi.order_id = p_o.id), p_o.created_at))
    else p_o.created_at
  end
$$;

-- ------------------------------------ préparation automatique : pas avant le lancement
create or replace function public.passer_en_preparation_automatiquement()
returns integer
language plpgsql security definer set search_path to 'public' as $$
declare
  v_carte boolean;
  v_n integer;
begin
  select coalesce(carte_active, false) into v_carte from public.payment_config where id = 1;
  v_carte := coalesce(v_carte, false);

  with cibles as (
    select o.id
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
     where o.status = 'confirmee'
       and r.preparation_auto
       and o.status_updated_at <= now() - interval '30 seconds'
       and greatest(o.status_updated_at, coalesce(o.lancement_prevu_a, o.status_updated_at)) > now() - interval '2 hours'
       and (o.lancement_prevu_a is null or o.lancement_prevu_a <= now())
       and not (v_carte and o.payment_method = 'cb'
                and o.payment_status is distinct from 'paye')
     for update of o skip locked
  )
  update public.orders o
     set status = 'en_preparation',
         status_updated_at = now()
    from cibles
   where o.id = cibles.id
     and o.status = 'confirmee';

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------- estimation figée : sans objet pour une réservation
create or replace function public.estimer_commande_a_la_creation()
returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.orders where id = new.id and livraison_souhaitee_a is not null) then
    return null;
  end if;
  begin
    insert into public.estimations_commande
      select * from public.estimer_commande(new.id)
    on conflict (order_id) do nothing;
  exception when others then
    raise warning 'estimation % non calculee : % (%)', new.id, sqlerrm, sqlstate;
  end;
  return null;
end $$;

-- ------------------------------------------------------------- patches par ancres
do $$
declare
  v_def text;
begin
  -- create_order : restaurant fermé accepté pour un lancement programmé valide,
  -- catégories vérifiées à l'heure du lancement.
  v_def := pg_get_functiondef('public.create_order(uuid,uuid,text,jsonb,text,boolean)'::regprocedure);
  if (length(v_def) - length(replace(v_def, E'  if not public.commandable_maintenant(v_resto) then', ''))) / length(E'  if not public.commandable_maintenant(v_resto) then') <> 1
  or (length(v_def) - length(replace(v_def, 'not public.categorie_servie_maintenant(v_categorie)', ''))) / length('not public.categorie_servie_maintenant(v_categorie)') <> 1 then
    raise exception 'create_order : ancres introuvables';
  end if;
  v_def := replace(v_def, E'  if not public.commandable_maintenant(v_resto) then',
    E'  if not public.commandable_maintenant(v_resto)\n     and not public.commandable_a(v_resto, public.lancement_programme()) then');
  v_def := replace(v_def, 'not public.categorie_servie_maintenant(v_categorie)',
    'not public.categorie_servie_a(v_categorie, coalesce(public.lancement_programme(), now()))');
  execute v_def;

  -- notify_order_status : la commande reste muette jusqu'à sa transmission.
  v_def := pg_get_functiondef('public.notify_order_status()'::regprocedure);
  if position(E'    if v_muette_new then return new; end if;\n    v_event := ''nouvelle'';' in v_def) = 0
  or position(E'    if v_muette_new then\n      return new;\n    elsif v_muette_old then' in v_def) = 0 then
    raise exception 'notify_order_status : ancres introuvables';
  end if;
  v_def := replace(v_def, E'    if v_muette_new then return new; end if;\n    v_event := ''nouvelle'';',
    E'    if v_muette_new then return new; end if;\n'
    || E'    if v_o.transmission_prevue_a is not null and v_o.transmise_le is null then return new; end if;\n'
    || E'    v_event := ''nouvelle'';');
  v_def := replace(v_def, E'    if v_muette_new then\n      return new;\n    elsif v_muette_old then',
    E'    if v_muette_new then\n      return new;\n'
    || E'    elsif v_o.transmission_prevue_a is not null and v_o.transmise_le is not null and old.transmise_le is null then\n'
    || E'      if v_o.status <> ''recue'' then return new; end if;\n'
    || E'      v_event := ''nouvelle'';\n'
    || E'    elsif v_o.transmission_prevue_a is not null and v_o.transmise_le is null\n'
    || E'          and v_o.status is not distinct from old.status then\n'
    || E'      return new;\n'
    || E'    elsif v_muette_old then');
  execute v_def;

  -- Relances 3 min et appel vocal : fenêtre de 3 h comptée depuis la transmission.
  v_def := pg_get_functiondef('public.alerter_commandes_sans_reponse(integer)'::regprocedure);
  if position(E'       and o.created_at > now() - interval ''3 hours''' in v_def) = 0 then
    raise exception 'alerter_commandes_sans_reponse : ancre introuvable';
  end if;
  execute replace(v_def, E'       and o.created_at > now() - interval ''3 hours''',
                         E'       and coalesce(o.transmise_le, o.created_at) > now() - interval ''3 hours''');

  v_def := pg_get_functiondef('public.appeler_restaurants_sans_reponse(integer)'::regprocedure);
  if position(E'       and o.created_at > now() - interval ''3 hours''' in v_def) = 0 then
    raise exception 'appeler_restaurants_sans_reponse : ancre introuvable';
  end if;
  execute replace(v_def, E'       and o.created_at > now() - interval ''3 hours''',
                         E'       and coalesce(o.transmise_le, o.created_at) > now() - interval ''3 hours''');
end $$;

-- La transmission réveille le trigger de notification.
drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status, picked_up_at, payment_status, payment_method, arriving_at, arrived_at, courier_id, transmise_le
  on public.orders for each row execute function public.notify_order_status();

-- ------------------------------------------------------------------------- droits
revoke all on function public.telegram_resto_envoyer(text, text) from public, anon, authenticated;
revoke all on function public.delai_reservation_min(uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.traiter_commandes_programmees() from public, anon, authenticated;
revoke all on function public.annoncer_reservation() from public, anon, authenticated;
revoke all on function public.commander_programme(uuid, uuid, text, jsonb, text, boolean, timestamptz) from public, anon;
grant execute on function public.commander_programme(uuid, uuid, text, jsonb, text, boolean, timestamptz) to authenticated;
revoke all on function public.annuler_ma_reservation(uuid) from public, anon;
grant execute on function public.annuler_ma_reservation(uuid) to authenticated;
grant execute on function public.creneaux_livraison(uuid, uuid, uuid[]) to anon, authenticated;

select cron.schedule('commandes-programmees', '* * * * *', 'select public.traiter_commandes_programmees()');
