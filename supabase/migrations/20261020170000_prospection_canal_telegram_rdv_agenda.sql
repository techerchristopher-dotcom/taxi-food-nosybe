-- 20/10 (demande du porteur du projet) :
--   1. un CANAL TELEGRAM À PART pour la prospection : « ça ne doit pas arriver dans toutes les
--      commandes, c'est en train de polluer » ;
--   2. les créneaux déjà pris restent visibles sur la page /pro, GRISÉS, avec « RDV avec <restaurant> »
--      (le prospect voit que ça marche ; double rendez-vous impossible, la garde est déjà en base) ;
--   3. chaque rendez-vous part dans son AGENDA GOOGLE, rappel 1 h avant (via n8n) ;
--   4. à 8 h, tous les rendez-vous du jour dans le canal prospection.

-- ─────────────────────────────────────────────── 1. le canal Telegram prospection
-- Le chat_id vit au Vault (`telegram_prospection_chat_id`). Tant qu'il n'existe pas, les messages
-- attendent dans la file et partent dès qu'il est posé (telegram_prospection_vider()).
create table if not exists public.telegram_prospection_envois (
  id          bigint generated always as identity primary key,
  texte       text not null,
  cree_le     timestamptz not null default now(),
  envoye_le   timestamptz,
  request_id  bigint
);
alter table public.telegram_prospection_envois enable row level security;
revoke all on public.telegram_prospection_envois from anon, authenticated;

create or replace function public.telegram_prospection_vider()
returns int language plpgsql security definer set search_path = public as $$
declare v_jeton text; v_chat text; r record; v_req bigint; n int := 0;
begin
  select decrypted_secret into v_chat  from vault.decrypted_secrets where name = 'telegram_prospection_chat_id';
  select decrypted_secret into v_jeton from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_chat is null or v_jeton is null then return 0; end if;
  for r in select id, texte from public.telegram_prospection_envois
            where envoye_le is null order by id limit 20 for update skip locked loop
    select net.http_post(
      url := 'https://api.telegram.org/bot' || v_jeton || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('chat_id', v_chat, 'disable_web_page_preview', true, 'text', left(r.texte, 4000)),
      timeout_milliseconds := 20000) into v_req;
    update public.telegram_prospection_envois set envoye_le = now(), request_id = v_req where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.telegram_prospection_envoyer(p_texte text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_texte is null or trim(p_texte) = '' then return; end if;
  insert into public.telegram_prospection_envois (texte) values (p_texte);
  perform public.telegram_prospection_vider();
exception when others then
  raise warning 'telegram_prospection_envoyer : %', sqlerrm;   -- jamais faire échouer un rendez-vous pour un message
end $$;
revoke all on function public.telegram_prospection_vider() from public, anon, authenticated;
revoke all on function public.telegram_prospection_envoyer(text) from public, anon, authenticated;

-- Toutes les alertes de prospection passent dans ce canal, plus dans celui des commandes.
do $$
declare f text; d text;
begin
  foreach f in array array['public.pro_compter_ouverture(text)',
                           'public.pro_reserver(text,timestamptz,text,text,text)',
                           'public.pro_etre_rappele(text,text,text,text)',
                           'public.prospect_whatsapp_reponse(uuid,text,text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('telegram_admin_envoyer(' in d) = 0 then raise exception 'ancre absente dans %', f; end if;
    execute replace(d, 'telegram_admin_envoyer(', 'telegram_prospection_envoyer(');
  end loop;
end $$;
revoke all on function public.pro_compter_ouverture(text) from public;
grant execute on function public.pro_compter_ouverture(text) to anon, authenticated;
revoke all on function public.pro_reserver(text, timestamptz, text, text, text) from public;
grant execute on function public.pro_reserver(text, timestamptz, text, text, text) to anon, authenticated;
revoke all on function public.pro_etre_rappele(text, text, text, text) from public;
grant execute on function public.pro_etre_rappele(text, text, text, text) to anon, authenticated;
revoke all on function public.prospect_whatsapp_reponse(uuid, text, text) from public, anon, authenticated;

-- ─────────────────────────────── 2. les créneaux déjà pris, visibles sur la page
create or replace function public.rdv_creneaux_pris(p_jours int default 12)
returns table (debut timestamptz, nom text)
language sql stable security definer set search_path = public as $$
  select r.debut, public.nom_affiche(p.nom)
    from public.rdv_prospects r join public.prospects_restaurant p on p.id = r.prospect_id
   where r.statut = 'confirme' and r.debut > now() + interval '3 hours'
     and r.debut < (now() at time zone 'Indian/Antananarivo')::date + greatest(1, least(p_jours, 30)) + 1
   order by r.debut
$$;
revoke all on function public.rdv_creneaux_pris(int) from public, anon, authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.pro_page(text)'::regprocedure);
  if position('''creneaux'',' in d) = 0 then raise exception 'ancre creneaux absente'; end if;
  execute replace(d, '''creneaux'',',
    '''creneaux_pris'', coalesce((select jsonb_agg(jsonb_build_object(''debut'', c.debut, ''nom'', c.nom) order by c.debut) from public.rdv_creneaux_pris(12) c), ''[]''::jsonb), ''creneaux'',');
end $$;
revoke all on function public.pro_page(text) from public;
grant execute on function public.pro_page(text) to anon, authenticated;

-- ─────────────────────────────────────────── 3. l'agenda Google (via n8n)
-- Un rendez-vous confirmé crée l'événement ; annulé / absent le supprime. L'identifiant de
-- l'événement Google est DÉDUIT du rendez-vous ('tf' + uuid sans tirets : base32hex valide),
-- donc rien à mémoriser pour le supprimer. Webhook et secret au Vault :
-- `n8n_agenda_rdv_url` (posée une fois le workflow activé) et `n8n_annonce_email_secret` (en-tête
-- x-taxifood-secret, même credential Header Auth que l'annonce par e-mail).
alter table public.rdv_prospects add column if not exists agenda_envoye_le timestamptz;
alter table public.rdv_prospects add column if not exists agenda_request_id bigint;

create or replace function public.rdv_agenda_charge(p_rdv uuid, p_action text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'action', p_action,
    'event_id', 'tf' || replace(r.id::text, '-', ''),
    'titre', 'RDV Taxi Food — ' || public.nom_affiche(p.nom),
    'debut', to_char(r.debut at time zone 'Indian/Antananarivo', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'fin', to_char((r.debut + make_interval(mins => r.duree_min)) at time zone 'Indian/Antananarivo', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'fuseau', 'Indian/Antananarivo',
    'lieu', coalesce(p.adresse, p.zone, 'Nosy Be'),
    'description', 'Contact : ' || r.contact_nom || ' · ' || r.contact_telephone
      || coalesce(E'\n« ' || r.message || ' »', '')
      || coalesce(E'\nCarte : ' || p.google_maps_url, '')
      || E'\nPage : https://taxifoodnosybe.distripro207.com/pro/' || p.slug || '?apercu=1')
  from public.rdv_prospects r join public.prospects_restaurant p on p.id = r.prospect_id
  where r.id = p_rdv
$$;
revoke all on function public.rdv_agenda_charge(uuid, text) from public, anon, authenticated;

create or replace function public.rdv_agenda_envoyer(p_rdv uuid, p_action text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_req bigint;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'n8n_agenda_rdv_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'n8n_annonce_email_secret';
  if v_url is null or v_secret is null then return null; end if;   -- pas encore branché : rattrapé par rdv_agenda_rattraper()
  select net.http_post(url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-taxifood-secret', v_secret),
    body := public.rdv_agenda_charge(p_rdv, p_action), timeout_milliseconds := 20000) into v_req;
  if p_action = 'creer' then
    update public.rdv_prospects set agenda_envoye_le = now(), agenda_request_id = v_req where id = p_rdv;
  end if;
  return v_req;
end $$;
revoke all on function public.rdv_agenda_envoyer(uuid, text) from public, anon, authenticated;

create or replace function public.rdv_agenda_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.statut = 'confirme' then
    perform public.rdv_agenda_envoyer(new.id, 'creer');
  elsif tg_op = 'UPDATE' and old.statut = 'confirme' and new.statut in ('annule') then
    perform public.rdv_agenda_envoyer(new.id, 'supprimer');
  end if;
  return null;
exception when others then
  raise warning 'rdv_agenda_trigger : %', sqlerrm;
  return null;
end $$;
drop trigger if exists rdv_prospects_agenda on public.rdv_prospects;
create trigger rdv_prospects_agenda after insert or update of statut on public.rdv_prospects
  for each row execute function public.rdv_agenda_trigger();

-- Rattrapage : tout rendez-vous confirmé à venir pas encore envoyé (au branchement, puis chaque matin).
create or replace function public.rdv_agenda_rattraper()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'n8n_agenda_rdv_url') then return 0; end if;
  for r in select id from public.rdv_prospects
            where statut = 'confirme' and debut > now() and agenda_envoye_le is null loop
    perform public.rdv_agenda_envoyer(r.id, 'creer'); n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.rdv_agenda_rattraper() from public, anon, authenticated;

-- RDV pris hors de la page (par téléphone, en direct, comme Miss Stella) : même chemin.
create or replace function public.admin_rdv_ajouter(p_prospect uuid, p_debut timestamptz, p_contact_nom text,
                                                    p_contact_telephone text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nom text;
begin
  -- Par l'API (rôle authenticator) : administrateur exigé. En connexion d'exploitation (SQL direct) : permis.
  if session_user = 'authenticator' and not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select nom into v_nom from public.prospects_restaurant where id = p_prospect;
  if v_nom is null then raise exception 'prospect inconnu'; end if;
  insert into public.rdv_prospects (prospect_id, debut, contact_nom, contact_telephone, message)
  values (p_prospect, p_debut, p_contact_nom, p_contact_telephone, p_note) returning id into v_id;
  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, interlocuteur, note)
  values (p_prospect, 'appel', 'entrant', 'rdv', p_contact_nom,
          'Rendez-vous noté à la main pour le ' || to_char(p_debut at time zone 'Indian/Antananarivo', 'DD/MM à HH24"h"MI')
          || coalesce(' · « ' || p_note || ' »', ''));
  update public.prospects_restaurant set statut = 'rdv' where id = p_prospect and statut <> 'partenaire';
  perform public.telegram_prospection_envoyer('📅 RENDEZ-VOUS (noté à la main) — ' || public.nom_affiche(v_nom) || E'\n'
    || (array['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'])[extract(isodow from p_debut at time zone 'Indian/Antananarivo')::int]
    || ' ' || to_char(p_debut at time zone 'Indian/Antananarivo', 'DD/MM à HH24"h"MI') || E'\n'
    || p_contact_nom || ' · ' || p_contact_telephone);
  return v_id;
end $$;
revoke all on function public.admin_rdv_ajouter(uuid, timestamptz, text, text, text) from public, anon;
grant execute on function public.admin_rdv_ajouter(uuid, timestamptz, text, text, text) to authenticated;

-- ───────────────────────────────────────── 4. 8 h : les rendez-vous du jour
create or replace function public.prospection_rdv_du_jour()
returns text language sql stable security definer set search_path = public as $$
  with j as (select (now() at time zone 'Indian/Antananarivo')::date as d),
  du_jour as (
    select r.*, p.nom, p.adresse, p.zone, p.google_maps_url
      from public.rdv_prospects r join public.prospects_restaurant p on p.id = r.prospect_id, j
     where r.statut = 'confirme' and (r.debut at time zone 'Indian/Antananarivo')::date = j.d),
  suivants as (
    select r.debut, p.nom from public.rdv_prospects r join public.prospects_restaurant p on p.id = r.prospect_id, j
     where r.statut = 'confirme' and (r.debut at time zone 'Indian/Antananarivo')::date > j.d
     order by r.debut limit 3)
  select '☀️ Rendez-vous de prospection — '
    || (array['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'])[extract(isodow from (select d from j))::int]
    || ' ' || to_char((select d from j), 'DD/MM') || E'\n\n'
    || coalesce((select string_agg('🕘 ' || to_char(debut at time zone 'Indian/Antananarivo', 'HH24"h"MI') || ' — ' || public.nom_affiche(nom)
         || E'\n   ' || contact_nom || ' · ' || contact_telephone
         || coalesce(E'\n   📍 ' || coalesce(adresse, zone), '')
         || coalesce(E'\n   ' || google_maps_url, '')
         || coalesce(E'\n   « ' || message || ' »', ''), E'\n\n' order by debut) from du_jour),
       'Aucun rendez-vous aujourd''hui.')
    || coalesce(E'\n\nEnsuite : ' || (select string_agg(to_char(debut at time zone 'Indian/Antananarivo', 'DD/MM HH24"h"MI') || ' ' || public.nom_affiche(nom), ' · ' order by debut) from suivants), '')
$$;
revoke all on function public.prospection_rdv_du_jour() from public, anon, authenticated;

select cron.schedule('prospection-rdv-du-jour', '0 5 * * *',
  $c$select public.telegram_prospection_envoyer(public.prospection_rdv_du_jour()); select public.rdv_agenda_rattraper(); select public.telegram_prospection_vider();$c$);
