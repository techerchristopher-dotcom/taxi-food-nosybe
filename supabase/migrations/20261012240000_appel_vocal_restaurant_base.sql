-- Appel vocal automatique au restaurant — partie BASE (2026-10-12).
--
-- Suite de la chaîne « commande sans réponse » (20261012210000 → 20261012233000) :
--   3 min : relance Telegram au restaurant + client prévenu + alerte admin
--   5 min : si toujours `recue`, APPEL TÉLÉPHONIQUE au restaurant (n8n → Twilio),
--           message lu en fr / it :  1 = accepter, 2 = refuser.
--
-- La touche passe par `repondre_commande_par_jeton()` : EXACTEMENT le chemin du bouton
-- Telegram. Accepter / refuser déclenche donc tout ce qui existe déjà (push et e-mail
-- client, préparation automatique, remboursement carte, porte-monnaie, code promo
-- rendu, alerte admin…). Rien n'est réécrit.
--
-- ⚠️ INERTE tant que le Vault ne porte pas `n8n_appel_url` (adresse du webhook n8n qui
-- passe l'appel). Les deux secrets sont générés ici, jamais affichés :
--   n8n_appel_secret   — en-tête `x-taxifood-secret` envoyé par la base à n8n
--   appel_hook_secret  — paramètre `p_secret` que n8n renvoie aux deux RPC de retour
--
-- Contrat avec n8n
--   Base → n8n (POST n8n_appel_url, en-tête x-taxifood-secret) : appel_id, order_id,
--     numero, restaurant, telephone (E.164), langue, voix, textes { intro, choix,
--     accepte, refuse, deja, invalide, sans_reponse }.
--   n8n → base, à la touche :   rpc appel_restaurant_touche(p_appel_id, p_secret, p_touche)
--     → { ok, resultat, texte }  (texte à lire avant de raccrocher)
--   n8n → base, fin d'appel :   rpc appel_restaurant_compte_rendu(p_appel_id, p_secret,
--     p_statut, p_duree_s, p_prix, p_devise, p_call_sid, p_erreur)
--
-- Pénalité restaurant : volontairement ABSENTE (décision du porteur du projet, à faire
-- plus tard sur les vrais coûts). On enregistre seulement le coût réel de chaque appel.

-- ------------------------------------------------------------------- secrets
do $s$
begin
  if not exists (select 1 from vault.secrets where name = 'n8n_appel_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'n8n_appel_secret',
      'En-tête x-taxifood-secret : base → workflow n8n d''appel vocal');
  end if;
  if not exists (select 1 from vault.secrets where name = 'appel_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'appel_hook_secret',
      'Secret que n8n renvoie aux RPC appel_restaurant_touche / _compte_rendu');
  end if;
end $s$;

-- ------------------------------------------------------------------- journal
create table if not exists public.appels_restaurant (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants(id),
  telephone      text not null,
  langue         text not null default 'fr',
  essai          boolean not null default false,       -- appel de test (numéro forcé)
  lance_le       timestamptz not null default now(),
  requete_n8n    bigint,                                -- id pg_net de l'appel à n8n
  statut         text not null default 'lance'
                 check (statut in ('lance', 'non_lance', 'termine')),
  resultat       text,                                  -- completed / no-answer / busy / failed / canceled
  touche         text check (touche in ('1', '2')),
  touche_le      timestamptz,
  action         text check (action in ('acceptee', 'refusee', 'deja_traitee')),
  duree_s        integer,
  cout           numeric(10, 5),                        -- coût réel facturé (valeur absolue)
  devise         text,
  call_sid       text,
  erreur         text,
  maj_le         timestamptz not null default now()
);
-- Un seul appel automatique par commande (les essais ne comptent pas).
create unique index if not exists appels_restaurant_un_par_commande
  on public.appels_restaurant (order_id) where not essai;
alter table public.appels_restaurant enable row level security;
revoke all on public.appels_restaurant from public, anon, authenticated;

-- ------------------------------------------------------------ outils internes
create or replace function public.telephone_e164_mg(p text)
returns text language sql immutable set search_path to 'public' as $$
  select case
    when d is null or d = '' then null
    when d like '261%' and length(d) = 12 then '+' || d
    when d like '0%' and length(d) = 10 then '+261' || substr(d, 2)
    when length(d) = 9 then '+261' || d
    when left(btrim(p), 1) = '+' then '+' || d
    else null
  end
  from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) x
$$;

create or replace function public.appel_textes(p_langue text, p_numero text, p_total integer, p_minutes integer)
returns jsonb language sql immutable set search_path to 'public' as $$
  select case when p_langue = 'it' then jsonb_build_object(
      'intro', 'Buongiorno, qui Taxi Food. L''ordine numero ' || n || ', di ' || m
               || ' ariary, aspetta la vostra risposta da ' || p_minutes || ' minuti.',
      'choix', 'Per accettare l''ordine, premete 1. Per rifiutarlo, premete 2.',
      'accepte', 'Grazie, l''ordine è accettato. Buon lavoro!',
      'refuse', 'L''ordine è rifiutato. Il cliente sarà avvisato. Grazie.',
      'deja', 'Questo ordine è già stato gestito. Grazie, arrivederci.',
      'invalide', 'Tasto non riconosciuto.',
      'sans_reponse', 'Nessuna risposta. Aprite Telegram per rispondere all''ordine. Arrivederci.')
    else jsonb_build_object(
      'intro', 'Bonjour, ici Taxi Food. La commande numéro ' || n || ', de ' || m
               || ' ariary, attend votre réponse depuis ' || p_minutes || ' minutes.',
      'choix', 'Pour accepter la commande, appuyez sur 1. Pour la refuser, appuyez sur 2.',
      'accepte', 'Merci, la commande est acceptée. Bonne préparation !',
      'refuse', 'La commande est refusée. Le client sera prévenu. Merci.',
      'deja', 'Cette commande a déjà été traitée. Merci, au revoir.',
      'invalide', 'Touche non reconnue.',
      'sans_reponse', 'Pas de réponse. Ouvrez Telegram pour répondre à la commande. Au revoir.')
    end
  from (select regexp_replace(coalesce(p_numero, ''), '^TF-', '') as n,
               replace(to_char(coalesce(p_total, 0), 'FM999,999,999'), ',', ' ') as m) x
$$;

-- --------------------------------------------- lancer un appel (interne)
create or replace function public.appel_restaurant_lancer(p_order_id uuid, p_telephone_force text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_url  text;
  v_sec  text;
  o      public.orders;
  rs     public.restaurants;
  v_tel  text;
  v_id   uuid;
  v_req  bigint;
  v_min  integer;
  v_lang text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'n8n_appel_url';
  select decrypted_secret into v_sec from vault.decrypted_secrets where name = 'n8n_appel_secret';
  if v_url is null or v_sec is null then
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

  insert into public.appels_restaurant (order_id, restaurant_id, telephone, langue, essai)
  values (o.id, o.restaurant_id, v_tel, v_lang, p_telephone_force is not null)
  on conflict do nothing
  returning id into v_id;
  if v_id is null then
    return null;                                   -- déjà appelé pour cette commande
  end if;

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
  update public.appels_restaurant set requete_n8n = v_req where id = v_id;

  perform public.telegram_admin_envoyer('📞 APPEL AUTOMATIQUE — ' || coalesce(rs.name, '?')
    || chr(10) || coalesce(o.order_number, '?') || ' sans réponse depuis ' || v_min || ' min'
    || chr(10) || 'Appel lancé vers ' || v_tel
    || case when p_telephone_force is not null then ' (ESSAI, numéro forcé)' else '' end);
  return v_id;
end $$;

-- ------------------------------------- tâche : qui appeler, et appels non partis
create or replace function public.appeler_restaurants_sans_reponse(p_minutes integer default 5)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r     record;
  v_n   integer := 0;
  v_rep record;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'n8n_appel_url') then
    return 0;
  end if;

  -- 1. Les appels confiés à n8n : n8n a-t-il accepté ?
  for r in
    select a.id, a.requete_n8n, a.lance_le, o.order_number, rs.name as resto
      from public.appels_restaurant a
      join public.orders o on o.id = a.order_id
      join public.restaurants rs on rs.id = a.restaurant_id
     where a.statut = 'lance' and a.requete_n8n is not null and a.resultat is null
       and a.lance_le > now() - interval '1 hour'
  loop
    select status_code, error_msg into v_rep from net._http_response where id = r.requete_n8n;
    if (found and (v_rep.status_code is null or v_rep.status_code >= 300))
       or (not found and r.lance_le < now() - interval '3 minutes') then
      update public.appels_restaurant
         set statut = 'non_lance', maj_le = now(),
             erreur = coalesce(v_rep.error_msg, 'n8n : code ' || v_rep.status_code, 'n8n : aucune réponse')
       where id = r.id;
      perform public.telegram_admin_envoyer('⚠️ APPEL NON LANCÉ — ' || coalesce(r.resto, '?')
        || chr(10) || coalesce(r.order_number, '?') || ' : le workflow d''appel n''a pas répondu correctement'
        || chr(10) || 'Appelle le restaurant toi-même.');
    end if;
  end loop;

  -- 2. Les commandes toujours sans réponse, déjà relancées sur Telegram.
  for r in
    select o.id
      from public.orders o
      join public.alertes_commande_sans_reponse al on al.order_id = o.id
     where o.status = 'recue'
       and o.created_at > now() - interval '3 hours'
       and public.commande_annoncee_le(o) <= now() - make_interval(mins => p_minutes)
       and not exists (select 1 from public.appels_restaurant a where a.order_id = o.id and not a.essai)
  loop
    if public.appel_restaurant_lancer(r.id) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $$;

-- ----------------------------------------------- retour n8n : la touche tapée
create or replace function public.appel_restaurant_touche(p_appel_id uuid, p_secret text, p_touche text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a       public.appels_restaurant;
  v_jeton uuid;
  v_rep   jsonb;
  v_txt   jsonb;
  o       public.orders;
  v_res   text;
begin
  if p_secret is null or p_secret is distinct from
     (select decrypted_secret from vault.decrypted_secrets where name = 'appel_hook_secret') then
    return jsonb_build_object('ok', false, 'raison', 'interdit');
  end if;

  select * into a from public.appels_restaurant where id = p_appel_id for update;
  if a.id is null then
    return jsonb_build_object('ok', false, 'raison', 'appel inconnu');
  end if;
  select * into o from public.orders where id = a.order_id;
  v_txt := public.appel_textes(a.langue, o.order_number, o.total, 0);

  if p_touche not in ('1', '2') then
    return jsonb_build_object('ok', false, 'resultat', 'touche_invalide', 'texte', v_txt->>'invalide');
  end if;

  select jeton into v_jeton from public.order_accept_jetons where order_id = a.order_id;
  perform set_config('taxifood.via_appel', 'on', true);
  if p_touche = '1' then
    v_rep := public.repondre_commande_par_jeton(a.order_id, v_jeton, 'accepter');
  else
    v_rep := public.repondre_commande_par_jeton(a.order_id, v_jeton, 'refuser', null, 'autre',
               'Refusée par le restaurant au téléphone');   -- lu par le CLIENT : toujours en français
  end if;
  perform set_config('taxifood.via_appel', '', true);

  v_res := case when coalesce((v_rep->>'ok')::boolean, false)
                then case when p_touche = '1' then 'acceptee' else 'refusee' end
                else 'deja_traitee' end;
  update public.appels_restaurant
     set touche = p_touche, touche_le = now(), action = v_res, maj_le = now()
   where id = a.id;

  return jsonb_build_object('ok', true, 'resultat', v_res,
    'texte', v_txt->>(case v_res when 'acceptee' then 'accepte' when 'refusee' then 'refuse' else 'deja' end));
end $$;

-- ------------------------------------------ retour n8n : fin d'appel et coût
create or replace function public.appel_restaurant_compte_rendu(
  p_appel_id uuid, p_secret text, p_statut text,
  p_duree_s integer default null, p_prix text default null, p_devise text default null,
  p_call_sid text default null, p_erreur text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  a      public.appels_restaurant;
  v_cout numeric;
  v_res  text;
begin
  if p_secret is null or p_secret is distinct from
     (select decrypted_secret from vault.decrypted_secrets where name = 'appel_hook_secret') then
    return jsonb_build_object('ok', false, 'raison', 'interdit');
  end if;
  select * into a from public.appels_restaurant where id = p_appel_id for update;
  if a.id is null then
    return jsonb_build_object('ok', false, 'raison', 'appel inconnu');
  end if;

  begin
    v_cout := abs(nullif(btrim(p_prix), '')::numeric);   -- Twilio renvoie un prix négatif
  exception when others then
    v_cout := null;
  end;

  -- Le prix arrive parfois plus tard : un 2ᵉ compte rendu le complète sans renvoyer d'alerte.
  update public.appels_restaurant
     set statut = 'termine', resultat = coalesce(nullif(btrim(p_statut), ''), resultat),
         duree_s = coalesce(p_duree_s, duree_s), cout = coalesce(v_cout, cout),
         devise = coalesce(nullif(btrim(p_devise), ''), devise),
         call_sid = coalesce(nullif(btrim(p_call_sid), ''), call_sid),
         erreur = coalesce(left(nullif(btrim(p_erreur), ''), 300), erreur), maj_le = now()
   where id = a.id;

  if a.statut <> 'termine' then
    v_res := case p_statut
      when 'completed' then 'décroché'
      when 'no-answer' then 'pas de réponse'
      when 'busy' then 'occupé'
      when 'failed' then 'échec'
      when 'canceled' then 'annulé'
      else coalesce(p_statut, '?') end;
    perform public.telegram_admin_envoyer('📞 COMPTE RENDU D''APPEL — '
      || coalesce((select name from public.restaurants where id = a.restaurant_id), '?')
      || chr(10) || coalesce((select order_number from public.orders where id = a.order_id), '?')
      || ' : ' || v_res
      || case a.action when 'acceptee' then ' → touche 1, commande ACCEPTÉE'
                       when 'refusee' then ' → touche 2, commande REFUSÉE'
                       when 'deja_traitee' then ' → déjà traitée entre-temps'
                       else case when p_statut = 'completed' then ' → aucune touche' else '' end end
      || coalesce(chr(10) || 'Durée : ' || p_duree_s || ' s', '')
      || chr(10) || 'Coût : ' || coalesce(v_cout::text || ' ' || coalesce(p_devise, ''), 'pas encore connu')
      || case when a.essai then chr(10) || '(appel d''ESSAI)' else '' end);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------ alerte admin : marquer une réponse donnée au téléphone
do $m$
declare v text;
  v_ancre constant text := $a$  perform public.telegram_admin_envoyer(v_texte);
  return new;$a$;
begin
  v := pg_get_functiondef('public.alerter_admin_statut()'::regprocedure);
  if v like '%via_appel%' then return; end if;
  if position(v_ancre in v) = 0 then raise exception 'ancre introuvable dans alerter_admin_statut'; end if;
  execute replace(v, v_ancre, $n$  if current_setting('taxifood.via_appel', true) = 'on' then
    v_texte := v_texte || chr(10) || '📞 Réponse donnée au téléphone (appel automatique)';
  end if;
  perform public.telegram_admin_envoyer(v_texte);
  return new;$n$);
end $m$;

-- ------------------------------------------------------------------ droits
revoke all on function public.telephone_e164_mg(text) from public, anon, authenticated;
revoke all on function public.appel_textes(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.appel_restaurant_lancer(uuid, text) from public, anon, authenticated;
revoke all on function public.appeler_restaurants_sans_reponse(integer) from public, anon, authenticated;
-- Les deux portes de retour sont appelées par n8n avec la clé publiable : le secret
-- `appel_hook_secret` (paramètre) est la seule autorisation.
revoke all on function public.appel_restaurant_touche(uuid, text, text) from public, authenticated;
revoke all on function public.appel_restaurant_compte_rendu(uuid, text, text, integer, text, text, text, text) from public, authenticated;
grant execute on function public.appel_restaurant_touche(uuid, text, text) to anon;
grant execute on function public.appel_restaurant_compte_rendu(uuid, text, text, integer, text, text, text, text) to anon;

-- ------------------------------------------------------------------ tâche
select cron.unschedule(jobid) from cron.job where jobname = 'appel-restaurant-sans-reponse';
select cron.schedule('appel-restaurant-sans-reponse', '* * * * *',
  $c$select public.appeler_restaurants_sans_reponse(5)$c$);
select cron.unschedule(jobid) from cron.job where jobname = 'appel-restaurant-sans-reponse-purge-journal';
select cron.schedule('appel-restaurant-sans-reponse-purge-journal', '29 3 * * *',
  $c$delete from cron.job_run_details
      where jobid = (select jobid from cron.job where jobname = 'appel-restaurant-sans-reponse')
        and end_time < now() - interval '2 days'$c$);
