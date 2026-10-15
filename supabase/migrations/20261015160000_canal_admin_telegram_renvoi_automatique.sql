-- Le canal Telegram admin ne perd plus de message (2026-10-15).
--
-- Constat : le « ✅ ACCEPTÉE » de TF-412 (La Cabane, 15/10 18 h 00) n'est jamais arrivé.
-- net._http_response : « Timeout of 20000 ms reached … TCP/SSL handshake time: 19998 ms ».
-- Telegram n'a pas répondu à la connexion ; pg_net n'émet qu'UNE fois, le message était perdu.
--
-- Désormais chaque message du canal admin passe par une file :
--   telegram_admin_envoyer(texte)  → ligne dans telegram_admin_envois + 1er envoi pg_net
--   tâche pg_cron `telegram-admin-relance` (chaque minute) → lit la réponse de Telegram ;
--     ok  → 'envoye' ; échec réseau / 429 / 5xx → renvoi (5 essais au plus) ; autre 4xx → 'abandonne'.
--
-- Couvre : copie « nouvelle commande » (notify_order_status, patchée par ancres : seul son
-- envoi direct vers Telegram est remplacé par un appel à telegram_admin_envoyer), ACCEPTÉE /
-- REFUSÉE (alerter_admin_statut) et PAS DE RÉPONSE (alerter_commandes_sans_reponse), qui
-- appelaient déjà telegram_admin_envoyer.
-- Ne couvre PAS (inchangés) : copies d'avis, messages privés, « Me prévenir », annonces programmées.
--
-- ⚠️ Un échec après envoi (Telegram a reçu mais la réponse s'est perdue) peut donner un DOUBLON.
-- Assumé : un doublon vaut mieux qu'un message perdu.
--
-- Couper : select cron.unschedule('telegram-admin-relance');  (les 1ers envois continuent).

create table if not exists public.telegram_admin_envois (
  id               bigserial primary key,
  texte            text not null,
  request_id       bigint,
  tentatives       int not null default 0,
  statut           text not null default 'en_cours'
                     check (statut in ('en_cours', 'envoye', 'abandonne')),
  erreur           text,
  cree_le          timestamptz not null default now(),
  dernier_essai_le timestamptz,
  envoye_le        timestamptz
);
create index if not exists telegram_admin_envois_en_cours
  on public.telegram_admin_envois (dernier_essai_le) where statut = 'en_cours';
alter table public.telegram_admin_envois enable row level security;
revoke all on public.telegram_admin_envois from public, anon, authenticated;

-- ------------------------------------------------------------- un envoi (ou renvoi)
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
  select decrypted_secret into v_chat  from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  select texte into v_texte from public.telegram_admin_envois where id = p_id;
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

-- ------------------------------------------- point d'entrée (signature inchangée)
create or replace function public.telegram_admin_envoyer(p_texte text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id    bigint;
  v_jeton text;
  v_chat  text;
begin
  if p_texte is null then return; end if;
  begin
    insert into public.telegram_admin_envois (texte) values (p_texte) returning id into v_id;
    perform public.telegram_admin_emettre(v_id);
  exception when others then
    -- Jamais faire échouer une commande pour un message : repli sur l'envoi simple d'avant.
    raise warning 'telegram_admin_envoyer : file indisponible (%), envoi direct', sqlerrm;
    select decrypted_secret into v_jeton from vault.decrypted_secrets where name = 'telegram_bot_token';
    select decrypted_secret into v_chat  from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
    if v_jeton is null or v_chat is null then return; end if;
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_jeton || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('chat_id', v_chat, 'disable_web_page_preview', true, 'text', p_texte),
      timeout_milliseconds := 20000);
  end;
end $$;

-- --------------------------------------------------------- relance chaque minute
create or replace function public.telegram_admin_relancer(p_max_essais int default 5)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  e      record;
  r      record;
  v_nb   int := 0;
begin
  for e in
    select * from public.telegram_admin_envois
     where statut = 'en_cours' and dernier_essai_le < now() - interval '30 seconds'
     order by id
     for update skip locked
  loop
    select status_code, timed_out, error_msg, content::text as contenu
      into r from net._http_response where id = e.request_id;

    if not found then
      -- Réponse pas encore là (file pg_net) ; au-delà de 10 min, on la considère perdue.
      if e.dernier_essai_le < now() - interval '10 minutes' then
        if e.tentatives < p_max_essais then
          perform public.telegram_admin_emettre(e.id); v_nb := v_nb + 1;
        else
          update public.telegram_admin_envois set statut = 'abandonne', erreur = 'réponse introuvable' where id = e.id;
        end if;
      end if;
    elsif r.status_code = 200 and r.contenu like '%"ok":true%' then
      update public.telegram_admin_envois set statut = 'envoye', envoye_le = now(), erreur = null where id = e.id;
    elsif r.status_code is null or r.timed_out or r.status_code = 429 or r.status_code >= 500 then
      if e.tentatives < p_max_essais then
        update public.telegram_admin_envois
           set erreur = left(coalesce(r.error_msg, 'HTTP ' || r.status_code), 300) where id = e.id;
        perform public.telegram_admin_emettre(e.id); v_nb := v_nb + 1;
      else
        update public.telegram_admin_envois
           set statut = 'abandonne', erreur = left(coalesce(r.error_msg, 'HTTP ' || r.status_code), 300)
         where id = e.id;
      end if;
    else
      -- 4xx (texte refusé, canal invalide…) : renvoyer ne changerait rien.
      update public.telegram_admin_envois
         set statut = 'abandonne', erreur = left('HTTP ' || r.status_code || ' ' || coalesce(r.contenu, ''), 300)
       where id = e.id;
    end if;
  end loop;

  delete from public.telegram_admin_envois where cree_le < now() - interval '14 days';
  return v_nb;
end $$;

revoke all on function public.telegram_admin_emettre(bigint)  from public, anon, authenticated;
revoke all on function public.telegram_admin_envoyer(text)    from public, anon, authenticated;
revoke all on function public.telegram_admin_relancer(int)    from public, anon, authenticated;

-- --------------------------- copie « nouvelle commande » : passe par la file (ancres)
do $$
declare
  v_def  text;
  v_new  text;
  a_deb  constant text := E'    perform net.http_post(\n      url := ''https://api.telegram.org/bot''\n             || (select decrypted_secret from vault.decrypted_secrets where name = ''telegram_bot_token'')\n             || ''/sendMessage'',\n      headers := jsonb_build_object(''Content-Type'', ''application/json''),\n      body := jsonb_build_object(\n        ''chat_id'', (select decrypted_secret from vault.decrypted_secrets\n                     where name = ''telegram_admin_chat_id''),\n        ''disable_web_page_preview'', true,\n        ''text'',\n';
  a_fin  constant text := E'''longitude''), '''')),\n      timeout_milliseconds := 20000);';
begin
  select pg_get_functiondef('public.notify_order_status()'::regprocedure) into v_def;
  if (length(v_def) - length(replace(v_def, a_deb, ''))) / length(a_deb) <> 1 then
    raise exception 'notify_order_status : ancre de début introuvable ou multiple';
  end if;
  if (length(v_def) - length(replace(v_def, a_fin, ''))) / length(a_fin) <> 1 then
    raise exception 'notify_order_status : ancre de fin introuvable ou multiple';
  end if;
  v_new := replace(v_def, a_deb, E'    perform public.telegram_admin_envoyer(\n');
  v_new := replace(v_new, a_fin, E'''longitude''), ''''));');
  execute v_new;
end $$;

select cron.schedule('telegram-admin-relance', '* * * * *', 'select public.telegram_admin_relancer()');
