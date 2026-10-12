-- Le canal Telegram admin suit la vie de la commande (2026-10-12).
--
-- Constat du porteur du projet : il reçoit la copie de chaque NOUVELLE commande,
-- mais rien quand le restaurant l'accepte. Il ne sait donc jamais si elle a été
-- prise. Trois messages s'ajoutent dans le canal admin (`telegram_admin_chat_id`) :
--
--   ✅ ACCEPTÉE      recue → confirmee (ou en_preparation), avec le délai de réponse
--   ❌ REFUSÉE        → annulee, avec le motif (« ANNULÉE (admin) » si l'admin l'a fait)
--   ⏰ PAS DE RÉPONSE  toujours `recue` 5 min après que le restaurant a été prévenu
--                     (tâche pg_cron `alerte-commande-sans-reponse`, chaque minute,
--                     UNE seule alerte par commande — table `alertes_commande_sans_reponse`)
--
-- ⚠️ `notify_order_status()` N'EST PAS TOUCHÉE : elle porte la commande carte muette,
-- la relecture différée et les jalons livreur. Tout vit dans des fonctions à part,
-- qu'on coupe sans rien risquer :
--   drop trigger orders_alerte_admin_statut on public.orders;
--   select cron.unschedule('alerte-commande-sans-reponse');
--
-- Même règle que `notify_order_status()` : une commande carte non encaissée n'a pas
-- été annoncée au restaurant, elle n'est ni « sans réponse » ni suivie. Pour une
-- commande carte payée, le délai part de la capture (`payment_intents.captured_at`),
-- c'est-à-dire du moment où le restaurant a réellement été prévenu.
--
-- Envoi : pg_net, jeton et canal lus dans le Vault, délai 20 s (cf. 20261009153000).
-- Inerte si l'un des deux secrets manque.

-- --------------------------------------------------------------- envoi au canal
create or replace function public.telegram_admin_envoyer(p_texte text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_jeton text;
  v_chat  text;
begin
  select decrypted_secret into v_jeton from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat  from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  if v_jeton is null or v_chat is null or p_texte is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_jeton || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat, 'disable_web_page_preview', true, 'text', p_texte),
    timeout_milliseconds := 20000);
end $$;

-- ------------------------------------------------------------------ petits outils
create or replace function public.alerte_ar(p_montant integer)
returns text language sql immutable set search_path to 'public' as $$
  select replace(to_char(coalesce(p_montant, 0), 'FM999,999,999'), ',', ' ') || ' Ar'
$$;

create or replace function public.alerte_duree(p_duree interval)
returns text language sql immutable set search_path to 'public' as $$
  select case
    when p_duree is null then '?'
    when extract(epoch from p_duree) < 60 then floor(extract(epoch from p_duree))::int || ' s'
    when extract(epoch from p_duree) < 600 then floor(extract(epoch from p_duree) / 60)::int || ' min '
         || lpad((floor(extract(epoch from p_duree))::int % 60)::text, 2, '0') || ' s'
    else floor(extract(epoch from p_duree) / 60)::int || ' min'
  end
$$;

-- Moment où le restaurant a été prévenu : création, ou capture pour une carte payée.
-- NULL = pas encore prévenu (carte non encaissée alors que le canal carte est ouvert).
create or replace function public.commande_annoncee_le(p_o public.orders)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when coalesce((select carte_active from public.payment_config where id = 1), false)
         and p_o.payment_method = 'cb'
         and p_o.payment_status in ('non_requis', 'en_attente', 'echoue')
      then null
    when p_o.payment_method = 'cb' and p_o.payment_status = 'paye'
      then greatest(p_o.created_at,
                    coalesce((select max(pi.captured_at) from public.payment_intents pi
                               where pi.order_id = p_o.id), p_o.created_at))
    else p_o.created_at
  end
$$;

-- ------------------------------------------------------- ✅ acceptée / ❌ refusée
create or replace function public.alerter_admin_statut()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto   text;
  v_debut   timestamptz;
  v_relance boolean;
  v_texte   text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select name into v_resto from public.restaurants where id = new.restaurant_id;
  v_debut := public.commande_annoncee_le(new);
  v_relance := exists (select 1 from public.alertes_commande_sans_reponse where order_id = new.id);

  if old.status = 'recue' and new.status in ('confirmee', 'en_preparation') then
    if v_debut is null then return new; end if;   -- carte non encaissée : jamais annoncée
    v_texte := '✅ ACCEPTÉE — ' || coalesce(v_resto, '?')
      || chr(10) || coalesce(new.order_number, '?') || ' · en '
      || public.alerte_duree(now() - v_debut)   -- pas accepted_at : il garde l'heure d'une acceptation ANTÉRIEURE si la commande a été rouverte
      || case when v_relance then ' (après alerte « pas de réponse »)' else '' end
      || chr(10) || 'Total : ' || public.alerte_ar(new.total) || ' (' || new.payment_method::text || ')';

  elsif new.status = 'annulee' and old.status <> 'livree' then
    if v_debut is null then return new; end if;
    v_texte := case when public.is_admin() then '❌ ANNULÉE (admin) — ' else '❌ REFUSÉE — ' end
      || coalesce(v_resto, '?')
      || chr(10) || coalesce(new.order_number, '?') || ' · après '
      || public.alerte_duree(now() - v_debut)
      || chr(10) || 'Motif : ' || coalesce(nullif(btrim(new.cancellation_reason), ''), '(aucun)')
      || chr(10) || 'Total : ' || public.alerte_ar(new.total) || ' (' || new.payment_method::text || ')'
      || case when new.payment_status = 'paye'
              then chr(10) || 'Carte : remboursement lancé automatiquement' else '' end;
  else
    return new;
  end if;

  perform public.telegram_admin_envoyer(v_texte);
  return new;
exception when others then
  -- Une alerte ratée ne doit JAMAIS empêcher d'accepter ou de refuser une commande.
  raise warning 'alerter_admin_statut % : %', new.order_number, sqlerrm;
  return new;
end $$;

drop trigger if exists orders_alerte_admin_statut on public.orders;
create trigger orders_alerte_admin_statut
  after update of status on public.orders
  for each row execute function public.alerter_admin_statut();

-- ------------------------------------------------------------- ⏰ pas de réponse
create table if not exists public.alertes_commande_sans_reponse (
  order_id    uuid primary key references public.orders(id) on delete cascade,
  envoyee_le  timestamptz not null default now(),
  attente_min integer not null
);
alter table public.alertes_commande_sans_reponse enable row level security;
revoke all on public.alertes_commande_sans_reponse from public, anon, authenticated;

create or replace function public.alerter_commandes_sans_reponse(p_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r       record;
  v_n     integer := 0;
  v_texte text;
begin
  for r in
    select o.*, public.commande_annoncee_le(o) as annoncee_le,
           rs.name as resto, rs.phone as resto_tel, rs.telegram_chat_id as resto_chat
      from public.orders o
      join public.restaurants rs on rs.id = o.restaurant_id
     where o.status = 'recue'
       and o.created_at > now() - interval '3 hours'
       and not exists (select 1 from public.alertes_commande_sans_reponse a where a.order_id = o.id)
  loop
    continue when r.annoncee_le is null or r.annoncee_le > now() - make_interval(mins => p_minutes);

    insert into public.alertes_commande_sans_reponse (order_id, attente_min)
    values (r.id, floor(extract(epoch from now() - r.annoncee_le) / 60)::int)
    on conflict do nothing;
    continue when not found;

    v_texte := '⏰ PAS DE RÉPONSE — ' || coalesce(r.resto, '?')
      || chr(10) || coalesce(r.order_number, '?') || ' reçue il y a '
      || public.alerte_duree(now() - r.annoncee_le) || ', toujours pas acceptée'
      || chr(10) || 'Total : ' || public.alerte_ar(r.total) || ' (' || r.payment_method::text || ')'
      || chr(10) || 'Appeler le restaurant : ' || coalesce(nullif(btrim(r.resto_tel), ''), 'numéro non renseigné')
      || case when r.resto_chat is null then chr(10) || '⚠️ Ce restaurant n''a AUCUN canal Telegram' else '' end;

    perform public.telegram_admin_envoyer(v_texte);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Fonctions internes : personne ne les appelle par l'API.
revoke all on function public.telegram_admin_envoyer(text) from public, anon, authenticated;
revoke all on function public.commande_annoncee_le(public.orders) from public, anon, authenticated;
revoke all on function public.alerter_admin_statut() from public, anon, authenticated;
revoke all on function public.alerter_commandes_sans_reponse(integer) from public, anon, authenticated;
revoke all on function public.alerte_ar(integer) from public, anon, authenticated;
revoke all on function public.alerte_duree(interval) from public, anon, authenticated;

-- Tâche chaque minute + purge de son journal (1 440 passages par jour).
select cron.unschedule(jobid) from cron.job
 where jobname in ('alerte-commande-sans-reponse', 'alerte-commande-sans-reponse-purge-journal');
select cron.schedule('alerte-commande-sans-reponse', '* * * * *',
  $c$select public.alerter_commandes_sans_reponse(5)$c$);
select cron.schedule('alerte-commande-sans-reponse-purge-journal', '23 3 * * *',
  $c$delete from cron.job_run_details
      where jobid = (select jobid from cron.job where jobname = 'alerte-commande-sans-reponse')
        and end_time < now() - interval '2 days'$c$);
