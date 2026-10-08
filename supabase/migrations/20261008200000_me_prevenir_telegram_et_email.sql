-- « Me prévenir à l'ouverture » : Telegram au porteur du projet + e-mail de confirmation
-- au client (2026-10-08, demande du porteur du projet).
--
-- Déclencheur : chaque NOUVELLE demande (`restaurant_interest`, kind = 'alerte'). L'insertion
-- de noter_interet_restaurant est `on conflict do nothing` : un client qui appuie deux fois
-- ne déclenche rien la seconde fois.
--
-- 1. Telegram, canal administrateur (`telegram_admin_chat_id`, celui qui reçoit la copie de
--    chaque commande) : restaurant, client (nom, e-mail, téléphone), et combien de personnes
--    attendent désormais ce restaurant.
-- 2. E-mail au client par le workflow n8n des annonces (même expéditeur, même gabarit, même
--    secret `x-taxifood-secret`) : « C'est noté, on te prévient dès que X ouvre ». Le workflow
--    exige un lien de désinscription : c'est celui des annonces (`/d/<jeton>`), le même que
--    reçoit le client pour toute annonce.
--
-- ⚠️ Rien de tout ça ne doit empêcher la demande d'être enregistrée : tout est dans un bloc
-- `exception`, et pg_net n'attend aucune réponse.

create or replace function public.alerter_demande_prevenir()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_token text; v_admin text; v_resto record; v_nom text; v_email text; v_tel text;
  v_nb int; v_hook record; v_jeton uuid; v_prenom text;
begin
  begin
    select id, name, listing_status into v_resto from public.restaurants where id = new.restaurant_id;
    select p.full_name, p.phone into v_nom, v_tel from public.profiles p where p.id = new.user_id;
    select u.email into v_email from auth.users u where u.id = new.user_id;
    select count(*) into v_nb from public.restaurant_interest
     where restaurant_id = new.restaurant_id and kind = 'alerte';

    -- 1. Telegram admin
    select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
    select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
    if v_token is not null and v_admin is not null then
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_admin, 'disable_web_page_preview', true,
          'text',
            '🔔 « Me prévenir » — ' || coalesce(v_resto.name, '?') || chr(10)
            || 'Client : ' || coalesce(nullif(trim(v_nom), ''), '(sans nom)') || chr(10)
            || coalesce('E-mail : ' || v_email || chr(10), '')
            || coalesce('Téléphone : ' || v_tel || chr(10), '')
            || v_nb || ' personne(s) attendent ce restaurant.'),
        timeout_milliseconds := 5000);
    end if;

    -- 2. E-mail de confirmation au client
    if v_email is not null and position('@' in v_email) > 0 then
      select * into v_hook from public.lire_webhook_annonce_email() limit 1;
      select j.jeton into v_jeton from public.annonces_jetons(array[new.user_id]) j limit 1;
      if v_hook.url is not null and v_hook.secret is not null and v_jeton is not null then
        v_prenom := nullif(split_part(trim(coalesce(v_nom, '')), ' ', 1), '');
        perform net.http_post(
          url := v_hook.url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-taxifood-secret', v_hook.secret),
          body := jsonb_build_object(
            'evenement', 'confirmation_me_prevenir',
            'destinataire', v_email,
            'titre', 'C''est noté : on te prévient pour ' || v_resto.name,
            'corps', 'Merci' || coalesce(' ' || v_prenom, '') || ' ! Ta demande est bien enregistrée. '
                     || 'Dès que ' || v_resto.name || ' ouvre sur Taxi Food, tu reçois une notification '
                     || 'et un e-mail. En attendant, découvre sa carte.',
            'route', '/restaurant/' || new.restaurant_id,
            'desinscription', 'https://taxifoodnosybe.distripro207.com/d/' || v_jeton,
            'test', false),
          timeout_milliseconds := 20000);
      end if;
    end if;
  exception when others then
    raise warning 'alerte « me prevenir » % non envoyee : %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.alerter_demande_prevenir() from public, anon, authenticated;

drop trigger if exists restaurant_interest_alerte on public.restaurant_interest;
create trigger restaurant_interest_alerte
  after insert on public.restaurant_interest
  for each row when (new.kind = 'alerte')
  execute function public.alerter_demande_prevenir();
