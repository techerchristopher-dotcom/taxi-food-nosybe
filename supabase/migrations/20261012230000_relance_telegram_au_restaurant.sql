-- Relance Telegram AU RESTAURANT quand une commande reste sans réponse (2026-10-12).
--
-- À 3 min (tâche `alerte-commande-sans-reponse`), en plus de l'alerte au canal admin :
--   • un rappel part dans le groupe Telegram du restaurant, dans SA langue (fr / it),
--     avec les mêmes boutons « J'accepte / Je refuse » que le message d'origine
--     (liens /a/ et /r-refus/ portant le jeton de `order_accept_jetons`) ;
--   • le message admin dit « 📣 Relance envoyée au restaurant », ou qu'aucune relance
--     n'est possible (pas de canal Telegram) ;
--   • l'identifiant pg_net de la relance est gardé : au passage suivant on lit la
--     réponse de Telegram, et si elle n'est pas `ok` (robot retiré du groupe, groupe
--     supprimé…) ou n'arrive pas en 3 min, le canal admin reçoit
--     « ⚠️ RELANCE NON REMISE ». Une remise réussie ne fait pas de bruit.

alter table public.alertes_commande_sans_reponse
  add column if not exists relance_requete bigint,
  add column if not exists relance_statut  text
    check (relance_statut in ('remise', 'echec'));

create or replace function public.telegram_envoyer(p_chat text, p_texte text, p_boutons jsonb default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_jeton text;
  v_corps jsonb;
begin
  select decrypted_secret into v_jeton from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_jeton is null or p_chat is null or p_texte is null then
    return null;
  end if;
  v_corps := jsonb_build_object('chat_id', p_chat, 'disable_web_page_preview', true, 'text', p_texte);
  if p_boutons is not null then
    v_corps := v_corps || jsonb_build_object('reply_markup', jsonb_build_object('inline_keyboard', p_boutons));
  end if;
  return net.http_post(
    url := 'https://api.telegram.org/bot' || v_jeton || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := v_corps,
    timeout_milliseconds := 20000);
end $$;

create or replace function public.alerter_commandes_sans_reponse(p_minutes integer default 3)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r        record;
  v_n      integer := 0;
  v_texte  text;
  v_relance text;
  v_jeton  text;
  v_site   constant text := 'https://taxifoodnosybe.distripro207.com';
  v_req    bigint;
  v_it     boolean;
  v_rep    record;
  v_json   jsonb;
begin
  -- 1. Les relances déjà parties : Telegram les a-t-il acceptées ?
  for r in
    select a.order_id, a.relance_requete, a.envoyee_le, o.order_number, rs.name as resto
      from public.alertes_commande_sans_reponse a
      join public.orders o on o.id = a.order_id
      join public.restaurants rs on rs.id = o.restaurant_id
     where a.relance_requete is not null and a.relance_statut is null
  loop
    select status_code, content, error_msg into v_rep
      from net._http_response where id = r.relance_requete;
    if found then
      begin
        v_json := v_rep.content::jsonb;            -- une page d'erreur HTML ne doit pas tout casser
      exception when others then
        v_json := null;
      end;
      if v_rep.status_code = 200 and coalesce((v_json->>'ok')::boolean, false) then
        update public.alertes_commande_sans_reponse set relance_statut = 'remise' where order_id = r.order_id;
      else
        update public.alertes_commande_sans_reponse set relance_statut = 'echec' where order_id = r.order_id;
        perform public.telegram_admin_envoyer('⚠️ RELANCE NON REMISE — ' || coalesce(r.resto, '?')
          || chr(10) || coalesce(r.order_number, '?') || ' : Telegram a refusé le rappel'
          || chr(10) || coalesce(left(coalesce(v_json->>'description', v_rep.error_msg,
                                               'code ' || v_rep.status_code), 200), '')
          || chr(10) || 'Appelle le restaurant.');
      end if;
    elsif r.envoyee_le < now() - interval '3 minutes' then
      update public.alertes_commande_sans_reponse set relance_statut = 'echec' where order_id = r.order_id;
      perform public.telegram_admin_envoyer('⚠️ RELANCE NON REMISE — ' || coalesce(r.resto, '?')
        || chr(10) || coalesce(r.order_number, '?') || ' : aucune réponse de Telegram'
        || chr(10) || 'Appelle le restaurant.');
    end if;
  end loop;

  -- 2. Les nouvelles commandes sans réponse.
  for r in
    select o.*, public.commande_annoncee_le(o) as annoncee_le,
           rs.name as resto, rs.phone as resto_tel, rs.telegram_chat_id as resto_chat,
           rs.langue as resto_langue
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

    -- Relance au restaurant
    v_req := null;
    if r.resto_chat is not null then
      v_it := r.resto_langue = 'it';
      select j.jeton::text into v_jeton from public.order_accept_jetons j where j.order_id = r.id;
      v_relance := case when v_it
        then '⏰ PROMEMORIA — ordine ' || coalesce(r.order_number, '?') || ' in attesa da '
             || floor(extract(epoch from now() - r.annoncee_le) / 60)::int || ' min'
             || chr(10) || 'Il cliente aspetta la vostra risposta. Premete un pulsante qui sotto.'
        else '⏰ RAPPEL — commande ' || coalesce(r.order_number, '?') || ' en attente depuis '
             || floor(extract(epoch from now() - r.annoncee_le) / 60)::int || ' min'
             || chr(10) || 'Le client attend votre réponse. Appuyez sur un bouton ci-dessous.'
        end
        || chr(10) || 'Total : ' || public.alerte_ar(r.total);
      v_req := public.telegram_envoyer(r.resto_chat, v_relance,
        case when v_jeton is not null then jsonb_build_array(jsonb_build_array(
          jsonb_build_object('text', case when v_it then '✅ Accetto' else '✅ J''accepte' end,
                             'url', v_site || '/a/' || r.id::text || '/' || v_jeton),
          jsonb_build_object('text', case when v_it then '❌ Rifiuto' else '❌ Je refuse' end,
                             'url', v_site || '/r-refus/' || r.id::text || '/' || v_jeton))) end);
      update public.alertes_commande_sans_reponse set relance_requete = v_req where order_id = r.id;
    end if;

    v_texte := '⏰ PAS DE RÉPONSE — ' || coalesce(r.resto, '?')
      || chr(10) || coalesce(r.order_number, '?') || ' reçue il y a '
      || public.alerte_duree(now() - r.annoncee_le) || ', toujours pas acceptée'
      || chr(10) || 'Total : ' || public.alerte_ar(r.total) || ' (' || r.payment_method::text || ')'
      || chr(10) || case
           when v_req is not null then '📣 Relance envoyée au restaurant sur Telegram'
           when r.resto_chat is null then '⚠️ Ce restaurant n''a AUCUN canal Telegram : pas de relance possible'
           else '⚠️ Relance impossible (jeton du robot absent)' end
      || chr(10) || 'Appeler le restaurant : ' || coalesce(nullif(btrim(r.resto_tel), ''), 'numéro non renseigné');

    perform public.telegram_admin_envoyer(v_texte);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.telegram_envoyer(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.alerter_commandes_sans_reponse(integer) from public, anon, authenticated;
