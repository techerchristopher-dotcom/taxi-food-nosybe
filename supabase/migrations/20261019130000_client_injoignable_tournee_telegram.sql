-- (2026-10-19) Trois chantiers demandés ensemble par le porteur du projet :
--   A. ⏸ CLIENT INJOIGNABLE — « souvent on tente de joindre un client, il ne répond ni par
--      appel, ni par message, ni par la messagerie » : la commande passe « bloquée en attente
--      du client », le client est relancé (push répété + e-mail), l'admin est alerté, puis
--      prévenu s'il faut trancher. Un ÉTAT posé sur la commande, pas une nouvelle valeur de
--      `order_status` : les apps déjà installées filtrent leurs listes sur des statuts connus,
--      une valeur nouvelle y ferait disparaître la commande. Le statut ne bouge donc pas.
--   B. 🛵 FIN DE TOURNÉE (lot 3 de la clôture) : le livreur déclare les espèces qu'il a sur
--      lui ; la base calcule ce qu'il devrait avoir ; l'écart part dans le groupe Telegram des
--      clôtures.
--   C. 🤖 TELEGRAM /cloture et /etat (lot 2) : la base répond aux commandes tapées dans le
--      groupe des clôtures (webhook du robot → fonction Edge `telegram-webhook`). Le robot
--      n'avait AUCUN webhook : il remplace `getUpdates` — les groupes que le robot voit sont
--      désormais notés dans `telegram_chats_vus` (pour brancher un nouveau restaurant).

-- ── Briques d'envoi ──────────────────────────────────────────────────────────────────
-- Push par la fonction notify-order (même porte que les triggers).
create or replace function public.pousser_notification_commande(p_order_id uuid, p_event text, p_extra jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_secret is null then return null; end if;
  return net.http_post(
    url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notify-order',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('order_id', p_order_id, 'status', 'attente_client', 'event', p_event) || coalesce(p_extra, '{}'::jsonb),
    timeout_milliseconds := 15000);
end $$;
revoke all on function public.pousser_notification_commande(uuid, text, jsonb) from public, anon, authenticated;

-- E-mail au client par le workflow n8n des annonces (même chemin que la relance Orange Money).
create or replace function public.envoyer_email_client_commande(p_order_id uuid, p_titre text, p_corps text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_url text; v_secret text; v_email text; v_user uuid; v_jeton uuid;
begin
  select o.user_id, coalesce(p.email, u.email) into v_user, v_email
    from orders o left join profiles p on p.id = o.user_id left join auth.users u on u.id = o.user_id
   where o.id = p_order_id;
  if v_email is null then return 'sans_adresse'; end if;
  select w.url, w.secret into v_url, v_secret from lire_webhook_annonce_email() w;
  if v_url is null then return 'webhook_absent'; end if;
  select j.jeton into v_jeton from annonces_jetons(array[v_user]) j;
  if v_jeton is null then return 'jeton_manquant'; end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-taxifood-secret', v_secret),
    body := jsonb_build_object('evenement', 'annonce', 'destinataire', v_email, 'titre', p_titre, 'corps', p_corps,
                               'route', '/order/' || p_order_id, 'desinscription', 'https://taxifoodnosybe.distripro207.com/d/' || v_jeton,
                               'test', false),
    timeout_milliseconds := 30000);
  return 'envoye';
end $$;
revoke all on function public.envoyer_email_client_commande(uuid, text, text) from public, anon, authenticated;

-- ── A. Client injoignable ────────────────────────────────────────────────────────────
alter table public.orders add column if not exists attente_client_depuis timestamptz;
alter table public.orders add column if not exists attente_client_signale_le timestamptz;  -- 1er signalement, jamais efface (statistiques)
alter table public.orders add column if not exists attente_client_par text
  check (attente_client_par is null or attente_client_par in ('livreur', 'restaurant', 'admin'));
alter table public.orders add column if not exists attente_client_note text check (attente_client_note is null or char_length(attente_client_note) <= 300);
alter table public.orders add column if not exists attente_client_relances int not null default 0;
alter table public.orders add column if not exists attente_client_derniere_relance timestamptz;
alter table public.orders add column if not exists attente_client_levee_le timestamptz;
alter table public.orders add column if not exists attente_client_levee_par text;

-- Qui agit sur une commande : son livreur, le personnel de son restaurant, l'admin.
create or replace function public.role_sur_commande(o public.orders)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_admin() then 'admin'
    when o.courier_id is not null and o.courier_id = auth.uid() then 'livreur'
    when public.is_active_restaurant_staff_of(o.restaurant_id) then 'restaurant'
  end
$$;
revoke all on function public.role_sur_commande(public.orders) from public, anon, authenticated;

create or replace function public.signaler_client_injoignable(p_order_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o public.orders;
  v_role text;
  v_qui text;
  v_client text;
  v_tel text;
  v_resto text;
  v_note text := nullif(left(btrim(regexp_replace(coalesce(p_note, ''), '[\x00-\x1F<>]', ' ', 'g')), 300), '');
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_o from orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'Commande introuvable'; end if;
  v_role := role_sur_commande(v_o);
  if v_role is null then raise exception 'Acces refuse a cette commande'; end if;
  if v_o.status in ('livree', 'annulee') then raise exception 'Commande deja terminee'; end if;
  if v_o.attente_client_depuis is not null then
    return jsonb_build_object('ok', true, 'deja', true);
  end if;

  update orders set attente_client_depuis = now(),
                    attente_client_signale_le = coalesce(attente_client_signale_le, now()),
                    attente_client_par = v_role,
                    attente_client_note = v_note,
                    attente_client_relances = 1,
                    attente_client_derniere_relance = now(),
                    attente_client_levee_le = null,
                    attente_client_levee_par = null
   where id = p_order_id;

  -- 1re relance : push + e-mail tout de suite
  perform pousser_notification_commande(p_order_id, 'attente_client', jsonb_build_object('relance', 1));
  perform envoyer_email_client_commande(p_order_id,
    'Ta commande ' || v_o.order_number || ' attend ta réponse',
    'Bonjour, on n''arrive pas à te joindre pour ta commande ' || v_o.order_number
      || '. Ouvre l''appli Taxi Food (ou réponds au livreur) pour qu''on puisse te la livrer. Merci !');

  select full_name into v_qui from profiles where id = auth.uid();
  select coalesce(nullif(btrim(p.full_name), ''), 'Client'), coalesce(a.phone, p.phone) into v_client, v_tel
    from orders o left join profiles p on p.id = o.user_id left join addresses a on a.id = o.address_id where o.id = p_order_id;
  select name into v_resto from restaurants where id = v_o.restaurant_id;
  perform telegram_admin_envoyer('⏸ CLIENT INJOIGNABLE — ' || coalesce(v_resto, '?') || chr(10)
    || v_o.order_number || ' · signalé par ' || v_role || coalesce(' (' || nullif(btrim(v_qui), '') || ')', '') || chr(10)
    || 'Client : ' || v_client || coalesce(' · ' || v_tel, '') || chr(10)
    || coalesce('Note : ' || v_note || chr(10), '')
    || 'Relances automatiques au client (push + e-mail) pendant 15 min.');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.signaler_client_injoignable(uuid, text) from public, anon, authenticated;
grant execute on function public.signaler_client_injoignable(uuid, text) to authenticated;

-- Levee : par le client (« Je suis là ») ou par le livreur / restaurant / admin.
create or replace function public.lever_attente_client_core(p_order_id uuid, p_par text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_o public.orders; v_resto text;
begin
  update orders set attente_client_depuis = null, attente_client_levee_le = now(), attente_client_levee_par = p_par
   where id = p_order_id and attente_client_depuis is not null
   returning * into v_o;
  if v_o.id is null then return; end if;
  if p_par = 'client' then
    -- le livreur (s'il y en a un) est prevenu que le client repond
    perform pousser_notification_commande(p_order_id, 'client_a_repondu');
  end if;
  select name into v_resto from restaurants where id = v_o.restaurant_id;
  perform telegram_admin_envoyer('✅ CLIENT JOINT — ' || coalesce(v_resto, '?') || ' · ' || v_o.order_number
    || case p_par when 'client' then ' : le client a répondu dans l''appli' else ' : levé par ' || p_par end);
end $$;
revoke all on function public.lever_attente_client_core(uuid, text) from public, anon, authenticated;

create or replace function public.client_repondre_attente(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from orders where id = p_order_id and user_id = auth.uid()) then
    raise exception 'Commande introuvable';
  end if;
  perform lever_attente_client_core(p_order_id, 'client');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.client_repondre_attente(uuid) from public, anon, authenticated;
grant execute on function public.client_repondre_attente(uuid) to authenticated;

create or replace function public.lever_attente_client(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_o public.orders; v_role text;
begin
  select * into v_o from orders where id = p_order_id;
  if v_o.id is null then raise exception 'Commande introuvable'; end if;
  v_role := role_sur_commande(v_o);
  if v_role is null then raise exception 'Acces refuse a cette commande'; end if;
  perform lever_attente_client_core(p_order_id, v_role);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lever_attente_client(uuid) from public, anon, authenticated;
grant execute on function public.lever_attente_client(uuid) to authenticated;

-- Une commande livree ou annulee n'attend plus personne.
create or replace function public.clore_attente_client_fin()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('livree', 'annulee') and new.attente_client_depuis is not null then
    new.attente_client_depuis := null;
    new.attente_client_levee_le := now();
    new.attente_client_levee_par := 'fin_' || new.status;
  end if;
  return new;
end $$;
drop trigger if exists orders_clore_attente_client on public.orders;
create trigger orders_clore_attente_client before update of status on public.orders
  for each row execute function public.clore_attente_client_fin();

-- Relances : toutes les 5 min (push), e-mail a la 3e, alerte admin « a trancher » a la 4e.
create or replace function public.relancer_clients_injoignables()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare r record; n int := 0;
begin
  for r in
    select o.id, o.order_number, o.attente_client_relances, o.attente_client_depuis, rs.name as resto
      from orders o join restaurants rs on rs.id = o.restaurant_id
     where o.attente_client_depuis is not null
       and o.status not in ('livree', 'annulee')
       and o.attente_client_relances < 4
       and o.attente_client_derniere_relance < now() - interval '5 minutes'
     for update of o skip locked
  loop
    update orders set attente_client_relances = attente_client_relances + 1, attente_client_derniere_relance = now()
     where id = r.id;
    if r.attente_client_relances + 1 <= 3 then
      perform pousser_notification_commande(r.id, 'attente_client', jsonb_build_object('relance', r.attente_client_relances + 1));
    end if;
    if r.attente_client_relances + 1 = 3 then
      perform envoyer_email_client_commande(r.id, 'Toujours pas de nouvelles pour ta commande ' || r.order_number,
        'On essaie toujours de te joindre pour ta commande ' || r.order_number
          || '. Sans réponse de ta part, elle risque d''être annulée. Ouvre l''appli Taxi Food pour nous répondre.');
    end if;
    if r.attente_client_relances + 1 = 4 then
      perform telegram_admin_envoyer('⏸ À TRANCHER — ' || r.resto || ' · ' || r.order_number || chr(10)
        || 'Client injoignable depuis ' || alerte_duree(now() - r.attente_client_depuis)
        || ', 3 push + 2 e-mails restés sans réponse.' || chr(10)
        || 'Annuler (« client injoignable ») ou garder depuis l''admin, onglet Temps réel.');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.relancer_clients_injoignables() from public, anon, authenticated;
select cron.schedule('clients-injoignables', '*/2 * * * *', $$select public.relancer_clients_injoignables()$$);

-- Le rapport de cloture compte les clients injoignables.
do $patch$
declare d text; d2 text;
begin
  d := pg_get_functiondef('public.rapport_service(timestamptz, timestamptz)'::regprocedure);
  d2 := replace(d, $a$  'programmees_a_venir', $a$,
    $b$  'clients_injoignables', (select count(*) from o where attente_client_signale_le is not null),
  'programmees_a_venir', $b$);
  if d2 = d then raise exception 'ancre rapport_service introuvable'; end if;
  execute d2;
  d := pg_get_functiondef('public.texte_rapport_service(jsonb, text, jsonb, text)'::regprocedure);
  d2 := replace(d, $a$  if (p_r->>'programmees_a_venir')::int > 0 then$a$,
    $b$  if coalesce((p_r->>'clients_injoignables')::int, 0) > 0 then
    t := t || '⏸ Clients injoignables signalés : ' || (p_r->>'clients_injoignables') || chr(10);
  end if;
  if (p_r->>'programmees_a_venir')::int > 0 then$b$);
  if d2 = d then raise exception 'ancre texte_rapport_service introuvable'; end if;
  execute d2;
end $patch$;

-- ── B. Fin de tournée du livreur ─────────────────────────────────────────────────────
create table if not exists public.tournees_livreur (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references auth.users(id) on delete cascade,
  debut timestamptz not null,
  fin timestamptz not null default now(),
  courses int not null,
  especes_dues bigint not null,
  especes_declarees bigint not null check (especes_declarees >= 0),
  ecart bigint generated always as (especes_declarees - especes_dues) stored,
  om_a_verifier bigint not null default 0,
  numeros text[] not null default '{}',
  note text check (note is null or char_length(note) <= 300),
  telegram_requete bigint,
  created_at timestamptz not null default now()
);
create index if not exists tournees_livreur_courier_idx on public.tournees_livreur (courier_id, fin desc);
alter table public.tournees_livreur enable row level security;
revoke all on public.tournees_livreur from public, anon, authenticated;

create or replace function public.apercu_tournee_core(p_courier uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select greatest(coalesce((select max(fin) from tournees_livreur where courier_id = p_courier), now() - interval '18 hours'),
                    now() - interval '18 hours') as debut
  ),
  l as (
    select o.* from orders o, b
     where o.courier_id = p_courier and o.status = 'livree' and o.delivered_at > b.debut
  )
  select jsonb_build_object(
    'debut', (select debut from b),
    'courses', (select count(*) from l),
    'especes_dues', (select coalesce(sum(total), 0) from l where payment_method = 'especes'),
    'om_a_verifier', (select coalesce(sum(total), 0) from l where payment_method = 'orange_money' and not om_en_ligne),
    'numeros', (select coalesce(jsonb_agg(order_number order by delivered_at), '[]'::jsonb) from l),
    'en_cours', (select count(*) from orders where courier_id = p_courier and status = 'en_livraison')
  )
$$;
revoke all on function public.apercu_tournee_core(uuid) from public, anon, authenticated;

create or replace function public.livreur_apercu_tournee()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_active_courier() then raise exception 'Reserve aux livreurs'; end if;
  return apercu_tournee_core(auth.uid());
end $$;
revoke all on function public.livreur_apercu_tournee() from public, anon, authenticated;
grant execute on function public.livreur_apercu_tournee() to authenticated;

create or replace function public.livreur_fin_tournee(p_especes_declarees bigint, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a jsonb;
  v_id uuid;
  v_nom text;
  v_ecart bigint;
  v_texte text;
  v_note text := nullif(left(btrim(regexp_replace(coalesce(p_note, ''), '[\x00-\x1F<>]', ' ', 'g')), 300), '');
begin
  if not is_active_courier() then raise exception 'Reserve aux livreurs'; end if;
  if p_especes_declarees is null or p_especes_declarees < 0 then raise exception 'Montant invalide'; end if;
  perform pg_advisory_xact_lock(hashtext('tournee_' || auth.uid()));
  v_a := apercu_tournee_core(auth.uid());
  if (v_a->>'courses')::int = 0 and p_especes_declarees = 0 then
    return jsonb_build_object('ok', false, 'raison', 'aucune_course');
  end if;

  insert into tournees_livreur (courier_id, debut, courses, especes_dues, especes_declarees, om_a_verifier, numeros, note)
  values (auth.uid(), (v_a->>'debut')::timestamptz, (v_a->>'courses')::int, (v_a->>'especes_dues')::bigint,
          p_especes_declarees, (v_a->>'om_a_verifier')::bigint,
          array(select jsonb_array_elements_text(v_a->'numeros')), v_note)
  returning id, ecart into v_id, v_ecart;

  select coalesce(nullif(btrim(full_name), ''), 'Livreur') into v_nom from profiles where id = auth.uid();
  v_texte := '🛵 Fin de tournée — ' || coalesce(v_nom, 'Livreur') || chr(10)
    || (v_a->>'courses') || ' course(s) livrée(s) depuis '
    || to_char((v_a->>'debut')::timestamptz at time zone 'Indian/Antananarivo', 'HH24"h"MI') || chr(10)
    || 'Espèces dues : ' || ar((v_a->>'especes_dues')::numeric) || chr(10)
    || 'Espèces déclarées : ' || ar(p_especes_declarees) || chr(10)
    || case when v_ecart = 0 then '✅ Caisse juste'
            when v_ecart > 0 then '➕ Écart : +' || ar(v_ecart) || ' (en trop)'
            else '⚠️ Écart : −' || ar(-v_ecart) || ' (manquant)' end || chr(10)
    || case when (v_a->>'om_a_verifier')::bigint > 0 then '📱 OM à vérifier : ' || ar((v_a->>'om_a_verifier')::numeric) || chr(10) else '' end
    || case when (v_a->>'en_cours')::int > 0 then '⏳ Encore ' || (v_a->>'en_cours') || ' course(s) en cours' || chr(10) else '' end
    || case when jsonb_array_length(v_a->'numeros') > 0 and jsonb_array_length(v_a->'numeros') <= 12
            then 'Commandes : ' || (select string_agg(x, ', ') from jsonb_array_elements_text(v_a->'numeros') x) || chr(10) else '' end
    || coalesce('📝 ' || v_note, '');
  update tournees_livreur set telegram_requete = envoyer_telegram_cloture(v_texte) where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'ecart', v_ecart, 'texte', v_texte);
end $$;
revoke all on function public.livreur_fin_tournee(bigint, text) from public, anon, authenticated;
grant execute on function public.livreur_fin_tournee(bigint, text) to authenticated;

-- ── C. Telegram : commandes dans le groupe des clotures ──────────────────────────────
create table if not exists public.telegram_chats_vus (
  chat_id bigint primary key,
  titre text,
  type text,
  premier_vu timestamptz not null default now(),
  dernier_vu timestamptz not null default now(),
  dernier_auteur text
);
alter table public.telegram_chats_vus enable row level security;
revoke all on public.telegram_chats_vus from public, anon, authenticated;

create or replace function public.telegram_noter_chat(p_chat_id bigint, p_titre text, p_type text, p_auteur text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into telegram_chats_vus (chat_id, titre, type, dernier_auteur) values (p_chat_id, left(p_titre, 200), p_type, left(p_auteur, 100))
  on conflict (chat_id) do update set titre = excluded.titre, type = excluded.type, dernier_vu = now(), dernier_auteur = excluded.dernier_auteur
$$;
revoke all on function public.telegram_noter_chat(bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.telegram_noter_chat(bigint, text, text, text) to service_role;

-- Repond a une commande tapee dans le groupe des clotures. Rend le texte a renvoyer
-- (vide = rien a renvoyer, la cloture a deja poste son rapport). Ignore tout autre groupe.
create or replace function public.telegram_commande(p_chat_id bigint, p_texte text, p_auteur text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat text;
  v_cmd text;
  v_reste text;
  v_forcer boolean;
  v_note text;
  v_r jsonb;
  v_debut timestamptz;
  x jsonb;
  v_liste text := '';
begin
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_cloture_chat_id';
  if v_chat is null or p_chat_id::text <> v_chat then return ''; end if;

  v_cmd := lower(split_part(split_part(btrim(coalesce(p_texte, '')), ' ', 1), '@', 1));
  v_reste := btrim(substr(btrim(p_texte), length(split_part(btrim(p_texte), ' ', 1)) + 1));

  if v_cmd = '/etat' then
    select max(fin) into v_debut from clotures_service where service in ('midi', 'soir');
    v_debut := greatest(coalesce(v_debut, now() - interval '18 hours'), now() - interval '18 hours');
    v_r := rapport_service(v_debut, now());
    return replace(texte_rapport_service(v_r, 'État du service en cours — pas encore clôturé', null, null), '🏁 ', '📊 ');
  elsif v_cmd = '/cloture' or v_cmd = '/clôture' then
    v_forcer := v_reste ~* '^(force|forcer)\y';
    v_note := nullif(btrim(regexp_replace(v_reste, '^(force|forcer)\s*', '', 'i')), '');
    v_note := case when v_note is null then 'Clôturé depuis Telegram par ' || coalesce(nullif(btrim(p_auteur), ''), '?')
                   else v_note || ' — ' || coalesce(nullif(btrim(p_auteur), ''), '?') end;
    v_r := cloturer_service_core('telegram', null, v_note, v_forcer);
    if (v_r->>'ok')::boolean then
      return '';  -- le rapport vient d'etre poste dans le groupe
    end if;
    if v_r->>'raison' = 'commandes_en_cours' then
      for x in select * from jsonb_array_elements(v_r->'en_cours') loop
        v_liste := v_liste || '   ⏳ ' || (x->>'numero') || ' (' || (x->>'resto') || ', ' || (x->>'statut') || ')' || chr(10);
      end loop;
      return '⚠️ Pas encore clôturé : il reste des commandes en cours' || chr(10) || v_liste
          || chr(10) || 'Envoie « /cloture force » pour clôturer quand même.';
    end if;
    return 'Rien à clôturer.';
  elsif v_cmd in ('/aide', '/start', '/help') then
    return '🤖 Commandes du groupe des clôtures' || chr(10)
        || '/etat — le point du service en cours, sans clôturer' || chr(10)
        || '/cloture — clôture le service et poste le rapport' || chr(10)
        || '/cloture force — clôture même s''il reste des commandes en cours' || chr(10)
        || '/cloture <note> — ajoute une note au rapport (ex. /cloture pluie forte)';
  end if;
  return '';
end $$;
revoke all on function public.telegram_commande(bigint, text, text) from public, anon, authenticated;
grant execute on function public.telegram_commande(bigint, text, text) to service_role;

-- Secret du webhook (en-tete X-Telegram-Bot-Api-Secret-Token), genere en base.
do $s$
begin
  if not exists (select 1 from vault.secrets where name = 'telegram_webhook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'telegram_webhook_secret',
      'Secret du webhook Telegram (setWebhook secret_token), lu par la fonction Edge telegram-webhook');
  end if;
end $s$;

create or replace function public.lire_telegram_webhook_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'telegram_webhook_secret' $$;
revoke all on function public.lire_telegram_webhook_secret() from public, anon, authenticated;
grant execute on function public.lire_telegram_webhook_secret() to service_role;
