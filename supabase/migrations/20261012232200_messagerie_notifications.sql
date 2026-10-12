-- Messagerie de commande, lot 3 : notifications, Telegram du restaurant, purge des photos,
-- liste des conversations pour l'admin (2026-10-13).
--
-- * Chaque message déclenche `messagerie_notifier()` (AFTER INSERT) :
--     - push aux autres participants, par la fonction Edge `notifier-message` (pg_net) ;
--     - Telegram au RESTAURANT quand le client ou le livreur écrit — c'est là qu'il regarde
--       (il ne garde pas l'app ouverte), dans SA langue (`restaurants.langue`) ;
--     - copie Telegram admin des messages du client et du restaurant (le livreur, c'est
--       aujourd'hui le porteur du projet lui-même : il les reçoit déjà en push).
--   Telegram : un seul envoi par minute et par auteur sur une commande — un client qui écrit
--   trois lignes d'affilée ne réveille pas trois fois le restaurant (le push, lui, part à
--   chaque message).
--   Toute erreur est avalée (WARNING) : une notification ratée n'empêche jamais un message.
-- * Purge : chaque nuit à 03:41 UTC, `notifier-message` supprime les photos de plus de
--   90 jours par l'API Storage.
-- * `admin_messagerie_conversations(p_jours)` : les conversations récentes pour l'onglet
--   admin « 💬 Messages ».

create or replace function public.messagerie_notifier()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_secret text;
  v_token  text;
  v_admin  text;
  v_o      public.orders;
  v_resto  public.restaurants;
  v_contenu text;
  v_texte  text;
  v_recent boolean;
begin
  begin
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
    if v_secret is not null then
      perform net.http_post(
        url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notifier-message',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
        body := jsonb_build_object('message_id', new.id),
        timeout_milliseconds := 20000);
    end if;

    select exists (select 1 from public.messages_commande m
                    where m.order_id = new.order_id and m.auteur_role = new.auteur_role
                      and m.id <> new.id and m.created_at > new.created_at - interval '1 minute')
      into v_recent;
    if v_recent then return new; end if;

    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
    if v_token is null then return new; end if;
    select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
    select * into v_o from public.orders where id = new.order_id;
    select * into v_resto from public.restaurants where id = v_o.restaurant_id;

    v_contenu := coalesce('« ' || new.texte || ' »', '')
              || case when new.photo_path is not null
                      then case when new.texte is not null then chr(10) else '' end
                           || case when v_resto.langue = 'it' then '📷 Foto (visibile nell''app)'
                                   else '📷 Photo (visible dans l''app)' end
                      else '' end;

    if new.auteur_role in ('client', 'livreur') and v_resto.telegram_chat_id is not null then
      if v_resto.langue = 'it' then
        v_texte := '💬 Messaggio ' || case new.auteur_role when 'client' then 'del cliente' else 'del fattorino' end
                || ' — ordine ' || coalesce(v_o.order_number, '?') || chr(10) || chr(10)
                || v_contenu || chr(10) || chr(10)
                || 'Per rispondere: app Taxi Food → ordini in corso → pulsante « Messages ».';
      else
        v_texte := '💬 Message ' || case new.auteur_role when 'client' then 'du client' else 'du livreur' end
                || ' — commande ' || coalesce(v_o.order_number, '?') || chr(10) || chr(10)
                || v_contenu || chr(10) || chr(10)
                || 'Pour répondre : app Taxi Food → Commandes en cours → bouton « Messages ».';
      end if;
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('chat_id', v_resto.telegram_chat_id, 'disable_web_page_preview', true, 'text', v_texte),
        timeout_milliseconds := 20000);
    end if;

    if new.auteur_role in ('client', 'restaurant') and v_admin is not null then
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_admin, 'disable_web_page_preview', true,
          'text', '💬 ' || coalesce(v_o.order_number, '?') || ' · ' || coalesce(v_resto.name, '?') || ' — '
               || case new.auteur_role when 'client' then 'le client' else 'le restaurant' end || ' écrit :'
               || chr(10) || v_contenu),
        timeout_milliseconds := 20000);
    end if;
  exception when others then
    raise warning 'messagerie_notifier : notification non envoyee (%)', sqlerrm;
  end;
  return new;
end $$;

revoke all on function public.messagerie_notifier() from public, anon, authenticated;

create trigger messages_commande_notifier
  after insert on public.messages_commande
  for each row execute function public.messagerie_notifier();

-- ───────────── Purge nocturne des photos (90 jours) ─────────────
create or replace function public.messagerie_lancer_purge()
returns void
language plpgsql security definer set search_path = public
as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notifier-message',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body := jsonb_build_object('action', 'purge'),
    timeout_milliseconds := 60000);
end $$;
revoke all on function public.messagerie_lancer_purge() from public, anon, authenticated;

select cron.schedule('messagerie-purge-photos', '41 3 * * *', 'select public.messagerie_lancer_purge()');

-- ───────────── Liste des conversations (admin) ─────────────
create or replace function public.admin_messagerie_conversations(p_jours integer default 14)
returns table (
  order_id uuid, order_number text, restaurant text, client text, statut text,
  nb_messages integer, dernier_role text, dernier_texte text, dernier_photo boolean,
  dernier_le timestamptz, non_lus integer)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query
  select o.id, o.order_number::text, r.name::text,
         public.messagerie_nom_auteur('client', o.user_id, o.restaurant_id),
         o.status::text,
         (select count(*)::int from public.messages_commande m where m.order_id = o.id),
         d.auteur_role, d.texte, d.photo_path is not null, d.created_at,
         (select count(*)::int from public.messages_commande m
           where m.order_id = o.id and m.auteur_role <> 'admin'
             and m.created_at > coalesce((select l.lu_jusqu_au from public.messages_lectures l
                                           where l.order_id = o.id and l.user_id = auth.uid() and l.role = 'admin'),
                                         '-infinity'::timestamptz))
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    join lateral (select m.* from public.messages_commande m where m.order_id = o.id
                   order by m.created_at desc limit 1) d on true
   where d.created_at > now() - make_interval(days => greatest(1, least(coalesce(p_jours, 14), 120)))
   order by d.created_at desc;
end $$;
revoke all on function public.admin_messagerie_conversations(integer) from public, anon;
grant execute on function public.admin_messagerie_conversations(integer) to authenticated;
