-- Appel vocal : la base appelle ROUNDED directement (2026-10-13).
--
-- Twilio n'a jamais joint un mobile malgache ; l'agent vocal est construit sur Rounded
-- (agent « Taxi Food - Relance commande », compte chrisrentanoo@gmail.com). Plus besoin de
-- n8n pour lancer l'appel : `appel_restaurant_lancer()` POSTe à l'API Rounded
--   POST https://api.callrounded.com/v1/calls/phone   (en-tête X-Api-Key)
--   { from_number, to_number, agent_id, dynamic_variables_values }
-- et l'agent rappelle la base pendant la conversation par ses deux outils :
--   accepter_commande / refuser_commande  →  rpc appel_restaurant_reponse(appel_id, action, motif)
--
-- Chemin choisi au lancement : Rounded si le Vault porte `rounded_api_key`,
-- `rounded_agent_id` ET `rounded_numero_appelant` ; sinon n8n si `n8n_appel_url` ; sinon
-- rien (inerte). Aujourd'hui : il manque la clé (geste du porteur) et le numéro appelant
-- (Rounded n'en a aucun de disponible, demande envoyée le 13/10).
--
-- `appel_restaurant_reponse` est appelée par Rounded avec la clé PUBLIABLE. Son autorisation
-- est l'identifiant de l'appel lui-même (uuid aléatoire, connu de Rounded seul), utilisable
-- UNE fois, dans les 30 minutes, et seulement tant que la commande est « reçue » — même
-- principe que le jeton des boutons Telegram. Aucun secret à recopier dans Rounded.

alter table public.appels_restaurant add column if not exists fournisseur text;
alter table public.appels_restaurant add column if not exists motif text;

-- Identifiant de l'agent (pas un secret : il apparaît dans l'URL de Rounded).
do $s$
begin
  if not exists (select 1 from vault.secrets where name = 'rounded_agent_id') then
    perform vault.create_secret('89d0d612-eccd-4eda-a76a-e98442c86215', 'rounded_agent_id',
      'Agent Rounded « Taxi Food - Relance commande »');
  end if;
end $s$;

-- ------------------------------------------------------------- lancer l'appel
create or replace function public.appel_restaurant_lancer(p_order_id uuid, p_telephone_force text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cle   text;
  v_agent text;
  v_de    text;
  v_url   text;
  v_sec   text;
  v_voie  text;
  o       public.orders;
  rs      public.restaurants;
  v_tel   text;
  v_id    uuid;
  v_req   bigint;
  v_min   integer;
  v_lang  text;
begin
  select decrypted_secret into v_cle   from vault.decrypted_secrets where name = 'rounded_api_key';
  select decrypted_secret into v_agent from vault.decrypted_secrets where name = 'rounded_agent_id';
  select decrypted_secret into v_de    from vault.decrypted_secrets where name = 'rounded_numero_appelant';
  select decrypted_secret into v_url   from vault.decrypted_secrets where name = 'n8n_appel_url';
  select decrypted_secret into v_sec   from vault.decrypted_secrets where name = 'n8n_appel_secret';
  v_voie := case when v_cle is not null and v_agent is not null and v_de is not null then 'rounded'
                 when v_url is not null and v_sec is not null then 'n8n' end;
  if v_voie is null then
    return null;                                   -- pas encore branché : on ne fait rien
  end if;

  select * into o from public.orders where id = p_order_id;
  select * into rs from public.restaurants where id = o.restaurant_id;
  if o.id is null or not exists (select 1 from public.order_accept_jetons j where j.order_id = o.id) then
    return null;
  end if;

  v_tel := public.telephone_e164_mg(coalesce(p_telephone_force, rs.phone));
  if v_tel is null then
    return null;
  end if;
  v_lang := case when rs.langue = 'it' then 'it' else 'fr' end;
  v_min := greatest(1, floor(extract(epoch from now() - coalesce(public.commande_annoncee_le(o), o.created_at)) / 60)::int);

  insert into public.appels_restaurant (order_id, restaurant_id, telephone, langue, essai, fournisseur)
  values (o.id, o.restaurant_id, v_tel, v_lang, p_telephone_force is not null, v_voie)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;                                   -- déjà appelé pour cette commande
  end if;

  if v_voie = 'rounded' then
    v_req := net.http_post(
      url := 'https://api.callrounded.com/v1/calls/phone',
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Api-Key', v_cle),
      body := jsonb_build_object(
        'from_number', v_de, 'to_number', v_tel, 'agent_id', v_agent,
        'dynamic_variables_values', jsonb_build_object(
          'appel_id', v_id::text,
          'restaurant', rs.name,
          'numero', regexp_replace(coalesce(o.order_number, ''), '^TF-', ''),
          'montant', public.nombre_en_lettres(coalesce(o.total, 0), v_lang),
          'minutes', public.nombre_en_lettres(v_min, v_lang))),
      timeout_milliseconds := 20000);
  else
    v_req := net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-taxifood-secret', v_sec),
      body := jsonb_build_object(
        'appel_id', v_id, 'order_id', o.id, 'numero', o.order_number,
        'restaurant', rs.name, 'telephone', v_tel, 'langue', v_lang,
        'voix', case when v_lang = 'it' then 'it-IT' else 'fr-FR' end,
        'essai', p_telephone_force is not null,
        'textes', public.appel_textes(v_lang, o.order_number, o.total, v_min)),
      timeout_milliseconds := 20000);
  end if;
  update public.appels_restaurant set requete_n8n = v_req where id = v_id;

  perform public.telegram_admin_envoyer('📞 APPEL AUTOMATIQUE — ' || coalesce(rs.name, '?')
    || chr(10) || coalesce(o.order_number, '?') || ' sans réponse depuis ' || v_min || ' min'
    || chr(10) || 'Appel lancé vers ' || v_tel || ' (' || v_voie || ')'
    || case when p_telephone_force is not null then ' — ESSAI, numéro forcé' else '' end);
  return v_id;
end $$;

-- ----------------------------- la tâche : le lancement passe par l'une ou l'autre voie
do $m$
declare v text;
  v_a constant text := $a$  if not exists (select 1 from vault.decrypted_secrets where name = 'n8n_appel_url') then
    return 0;
  end if;$a$;
begin
  v := pg_get_functiondef('public.appeler_restaurants_sans_reponse(integer)'::regprocedure);
  if v like '%rounded_api_key%' then return; end if;
  if position(v_a in v) = 0 then raise exception 'ancre introuvable (garde)'; end if;
  v := replace(v, v_a, $n$  if not exists (select 1 from vault.decrypted_secrets where name = 'n8n_appel_url')
     and not (exists (select 1 from vault.decrypted_secrets where name = 'rounded_api_key')
              and exists (select 1 from vault.decrypted_secrets where name = 'rounded_numero_appelant')) then
    return 0;
  end if;$n$);
  -- Rounded répond 201 + data.call_id : on le garde pour retrouver l'appel.
  if position($a$    select status_code, error_msg into v_rep from net._http_response where id = r.requete_n8n;$a$ in v) = 0 then
    raise exception 'ancre introuvable (reponse)';
  end if;
  v := replace(v, $a$    select status_code, error_msg into v_rep from net._http_response where id = r.requete_n8n;$a$,
    $n$    select status_code, error_msg, content into v_rep from net._http_response where id = r.requete_n8n;
    if found and v_rep.status_code between 200 and 299 then
      begin
        update public.appels_restaurant
           set call_sid = coalesce(call_sid, (v_rep.content::jsonb->'data'->>'call_id'))
         where id = r.id and call_sid is null;
      exception when others then null;
      end;
    end if;$n$);
  execute v;
end $m$;

-- -------------------------- l'agent répond : accepter / refuser (outils Rounded)
create or replace function public.appel_restaurant_reponse(p_appel_id uuid, p_action text, p_motif text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a       public.appels_restaurant;
  o       public.orders;
  v_jeton uuid;
  v_rep   jsonb;
  v_motif text;
  v_res   text;
begin
  select * into a from public.appels_restaurant where id = p_appel_id for update;
  if a.id is null or a.lance_le < now() - interval '30 minutes' then
    return jsonb_build_object('ok', false, 'message', 'Appel inconnu ou expiré. Dites au restaurant d''ouvrir Telegram.');
  end if;
  if a.action is not null then
    return jsonb_build_object('ok', false, 'message', 'La réponse a déjà été enregistrée.');
  end if;
  if p_action not in ('accepter', 'refuser') then
    return jsonb_build_object('ok', false, 'message', 'Action inconnue : utilisez accepter ou refuser.');
  end if;

  select * into o from public.orders where id = a.order_id;
  select jeton into v_jeton from public.order_accept_jetons where order_id = a.order_id;
  v_motif := nullif(left(btrim(regexp_replace(coalesce(p_motif, ''), '[[:cntrl:]<>]', ' ', 'g')), 120), '');

  perform set_config('taxifood.via_appel', 'on', true);
  if p_action = 'accepter' then
    v_rep := public.repondre_commande_par_jeton(a.order_id, v_jeton, 'accepter');
  else
    -- Lu par le CLIENT : en français, avec la raison donnée au téléphone si elle existe.
    v_rep := public.repondre_commande_par_jeton(a.order_id, v_jeton, 'refuser', null, 'autre',
               coalesce('Refusée par le restaurant au téléphone : ' || v_motif,
                        'Refusée par le restaurant au téléphone'));
  end if;
  perform set_config('taxifood.via_appel', '', true);

  v_res := case when coalesce((v_rep->>'ok')::boolean, false)
                then case when p_action = 'accepter' then 'acceptee' else 'refusee' end
                else 'deja_traitee' end;
  update public.appels_restaurant
     set action = v_res, touche_le = now(), motif = v_motif, maj_le = now()
   where id = a.id;

  return jsonb_build_object('ok', true, 'resultat', v_res,
    'message', case v_res
      when 'acceptee' then 'Commande acceptée et enregistrée.'
      when 'refusee'  then 'Commande refusée et enregistrée. Le client est prévenu.'
      else 'Cette commande avait déjà été traitée.' end);
end $$;

revoke all on function public.appel_restaurant_reponse(uuid, text, text) from public, authenticated;
grant execute on function public.appel_restaurant_reponse(uuid, text, text) to anon;
revoke all on function public.appel_restaurant_lancer(uuid, text) from public, anon, authenticated;

-- Un agent Rounded par langue : `rounded_agent_id_it` s'il existe, sinon l'agent français
-- et TOUT en français (montant compris) — jamais des nombres italiens lus par une voix française.
do $m$
declare v text;
  a1 constant text := $a$  v_lang := case when rs.langue = 'it' then 'it' else 'fr' end;$a$;
begin
  v := pg_get_functiondef('public.appel_restaurant_lancer(uuid,text)'::regprocedure);
  if v like '%rounded_agent_id_it%' then return; end if;
  if position(a1 in v) = 0 then raise exception 'ancre introuvable'; end if;
  v := replace(v, a1, a1 || $n$
  if v_voie = 'rounded' and v_lang = 'it' then
    if exists (select 1 from vault.decrypted_secrets where name = 'rounded_agent_id_it') then
      select decrypted_secret into v_agent from vault.decrypted_secrets where name = 'rounded_agent_id_it';
    else
      v_lang := 'fr';
    end if;
  end if;$n$);
  execute v;
end $m$;
