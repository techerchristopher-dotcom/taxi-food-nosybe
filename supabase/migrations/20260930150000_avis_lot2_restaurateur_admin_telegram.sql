-- Notation et avis clients — lot 2 (2026-09-30). Conception : docs/NOTATION-AVIS.md.
--
--   1. Le restaurateur lit les avis de SON restaurant et y répond (droit de réponse).
--   2. Telegram : chaque avis part au patron (copie, comme les commandes) ; le
--      restaurant n'est prévenu QUE quand sa note (cuisine + préparation) est ≤ 2 —
--      la note de livraison ne le concerne pas.
--   3. L'admin liste, masque / republie, marque « utilisé sur les réseaux » — ce
--      dernier geste est REFUSÉ sans le consentement du client.
--
-- Comme au lot 1 : la table `avis` n'a aucune policy, tout passe par ces RPC.

-- =====================================================================
-- 1. Restaurateur
-- =====================================================================
create or replace function public.avis_de_mon_restaurant(p_restaurant_id uuid)
returns table (
  id uuid, order_id uuid, order_number text, prenom text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, created_at timestamptz,
  reponse_restaurant text, reponse_le timestamptz, statut text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.order_id, o.order_number, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le, a.statut
    from public.avis a
    join public.orders o on o.id = a.order_id
   where a.restaurant_id = p_restaurant_id
     and public.is_active_restaurant_staff_of(p_restaurant_id)
   order by a.created_at desc
   limit 200;
$$;

-- Réponse publique du restaurant (500 caractères). Texte vide = retirer la réponse.
create or replace function public.repondre_avis(p_avis_id uuid, p_reponse text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto uuid;
  v_rep   text := nullif(btrim(coalesce(p_reponse, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  select restaurant_id into v_resto from public.avis where id = p_avis_id;
  if v_resto is null or not public.is_active_restaurant_staff_of(v_resto) then
    raise exception 'avis:introuvable' using errcode = '42501';
  end if;
  if v_rep is not null and length(v_rep) > 500 then
    raise exception 'avis:reponse_trop_longue' using errcode = '22023';
  end if;
  update public.avis
     set reponse_restaurant = v_rep,
         reponse_le = case when v_rep is null then null else now() end,
         updated_at = now()
   where id = p_avis_id;
end $$;

-- =====================================================================
-- 2. Telegram
-- =====================================================================
create or replace function public.alerter_nouvel_avis()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_token  text;
  v_admin  text;
  v_resto  public.restaurants;
  v_num    text;
  v_notes  text;
  v_comm   text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_token is null then return new; end if;
  select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  select * into v_resto from public.restaurants where id = new.restaurant_id;
  select order_number into v_num from public.orders where id = new.order_id;

  v_notes := 'Cuisine ' || new.note_cuisine || '/5 · Préparation ' || new.note_preparation
          || '/5 · Livraison ' || new.note_livraison || '/5';
  v_comm  := coalesce('« ' || new.commentaire || ' »', '(sans commentaire)');

  -- Le patron : tous les avis, les faibles signalés.
  if v_admin is not null then
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_admin, 'disable_web_page_preview', true,
        'text',
          (case when new.note_restaurant <= 2 or new.note_livraison <= 2 then '⚠️ ' else '⭐ ' end)
          || 'Nouvel avis — ' || coalesce(v_resto.name, '?') || chr(10)
          || 'Commande ' || coalesce(v_num, '?') || ' · ' || new.prenom_affiche || chr(10)
          || v_notes || chr(10) || v_comm
          || case when new.consentement_publication then chr(10) || '✅ Publication autorisée' else '' end),
      timeout_milliseconds := 5000);
  end if;

  -- Le restaurant : seulement quand SA note est ≤ 2 (la livraison ne le juge pas).
  if v_resto.telegram_chat_id is not null and new.note_restaurant <= 2 then
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_resto.telegram_chat_id, 'disable_web_page_preview', true,
        'text',
          '⚠️ Un client n''a pas été satisfait — commande ' || coalesce(v_num, '?') || chr(10)
          || 'Cuisine ' || new.note_cuisine || '/5 · Préparation ' || new.note_preparation || '/5' || chr(10)
          || v_comm || chr(10) || chr(10)
          || 'Vous pouvez lui répondre depuis l''app Taxi Food, onglet Historique.'),
      timeout_milliseconds := 5000);
  end if;
  return new;
end $$;

drop trigger if exists avis_alerte_telegram on public.avis;
create trigger avis_alerte_telegram
  after insert on public.avis
  for each row execute function public.alerter_nouvel_avis();

-- =====================================================================
-- 3. Admin
-- =====================================================================
create or replace function public.admin_avis_lister(p_filtre text default 'tous')
returns table (
  id uuid, created_at timestamptz,
  restaurant_id uuid, restaurant text,
  order_id uuid, order_number text,
  prenom text, client text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, langue text, consentement boolean, statut text,
  reponse_restaurant text, reponse_le timestamptz,
  utilise_reseaux_le timestamptz, code text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.created_at,
         a.restaurant_id, r.name,
         a.order_id, o.order_number,
         a.prenom_affiche, p.full_name,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.langue, a.consentement_publication, a.statut,
         a.reponse_restaurant, a.reponse_le,
         a.utilise_reseaux_le, pc.code
    from public.avis a
    join public.restaurants r on r.id = a.restaurant_id
    join public.orders o on o.id = a.order_id
    left join public.profiles p on p.id = a.user_id
    left join public.promo_codes pc on pc.id = a.code_promo_id
   where public.is_admin()
     and case coalesce(p_filtre, 'tous')
           when 'consentis_non_utilises'
             then (a.consentement_publication and a.utilise_reseaux_le is null
                   and a.statut = 'publie' and a.commentaire is not null)
           when 'masques' then a.statut = 'masque'
           when 'faibles' then (a.note_restaurant <= 2 or a.note_livraison <= 2)
           else true
         end
   order by a.created_at desc
   limit 300;
$$;

create or replace function public.admin_avis_statut(p_avis_id uuid, p_statut text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_a public.avis;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_statut not in ('publie', 'masque') then
    raise exception 'avis:statut_inconnu' using errcode = '22023';
  end if;
  select * into v_a from public.avis where id = p_avis_id;
  if v_a.id is null then raise exception 'avis:introuvable'; end if;
  if v_a.statut = p_statut then return; end if;
  update public.avis set statut = p_statut, updated_at = now() where id = p_avis_id;
  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'avis_statut', v_a.order_id, v_a.restaurant_id, v_a.statut, p_statut, null);
end $$;

-- « Utilisé sur les réseaux » : refusé sans consentement — c'est la seule règle
-- qui protège vraiment le client, elle vit ici et pas dans l'écran.
create or replace function public.admin_avis_utilise(p_avis_id uuid, p_utilise boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_a public.avis;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  select * into v_a from public.avis where id = p_avis_id;
  if v_a.id is null then raise exception 'avis:introuvable'; end if;
  if coalesce(p_utilise, false) and not v_a.consentement_publication then
    raise exception 'avis:sans_consentement' using errcode = '22023';
  end if;
  update public.avis
     set utilise_reseaux_le = case when coalesce(p_utilise, false) then now() else null end,
         updated_at = now()
   where id = p_avis_id;
end $$;

-- =====================================================================
-- 4. Droits
-- =====================================================================
revoke all on function public.avis_de_mon_restaurant(uuid) from public;
revoke all on function public.repondre_avis(uuid, text) from public;
revoke all on function public.admin_avis_lister(text) from public;
revoke all on function public.admin_avis_statut(uuid, text) from public;
revoke all on function public.admin_avis_utilise(uuid, boolean) from public;
revoke all on function public.alerter_nouvel_avis() from public, anon, authenticated;

grant execute on function public.avis_de_mon_restaurant(uuid) to authenticated;
grant execute on function public.repondre_avis(uuid, text) to authenticated;
grant execute on function public.admin_avis_lister(text) to authenticated;
grant execute on function public.admin_avis_statut(uuid, text) to authenticated;
grant execute on function public.admin_avis_utilise(uuid, boolean) to authenticated;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'avis_alerte_telegram') then
    raise exception 'trigger avis_alerte_telegram absent';
  end if;
end $$;
