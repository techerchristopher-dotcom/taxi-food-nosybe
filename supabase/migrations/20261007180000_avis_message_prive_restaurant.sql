-- Message privé au restaurant (2026-10-07)
--
-- Quand il note sa commande, le client a désormais DEUX champs :
--   🌍 « Ton avis public »            → avis.commentaire (inchangé, affiché sur la fiche)
--   🔒 « Message privé au restaurant » → avis_messages_prives.message (jamais publié)
--
-- Le message privé vit dans une TABLE À PART, et non dans une colonne de `avis` :
-- aucune des RPC publiques existantes (avis_restaurant, texte de publication admin,
-- visuel citation…) ne peut le renvoyer par mégarde, puisqu'aucune ne lit cette table.
-- RLS activée SANS AUCUNE policy + revoke all : lecture uniquement par les RPC
-- `security definer` ci-dessous (client auteur, staff du restaurant, admin).
--
-- Le restaurant est prévenu par Telegram dans SA langue (restaurants.langue fr/it),
-- par pg_net avec le jeton du Vault, comme alerter_nouvel_avis(). Copie à l'admin.
-- Sans telegram_chat_id : rien ne part, rien ne casse. Le workflow n8n T7uX n'est pas touché.

-- ---------------------------------------------------------------------------
-- 1. La table
-- ---------------------------------------------------------------------------
create table if not exists public.avis_messages_prives (
  avis_id       uuid primary key references public.avis(id) on delete cascade,
  order_id      uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id       uuid not null,
  message       text not null check (length(message) between 1 and 500),
  lu_le         timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.avis_messages_prives is
  'Message privé du client au restaurant, déposé avec l''avis. JAMAIS publié. Lecture : client auteur (mon_avis), staff du restaurant (avis_de_mon_restaurant), admin (admin_avis_lister). RLS sans policy, tout par RPC.';

create index if not exists avis_messages_prives_restaurant_idx
  on public.avis_messages_prives (restaurant_id, created_at desc);

alter table public.avis_messages_prives enable row level security;
revoke all on public.avis_messages_prives from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Le nettoyage (même esprit que nettoyer_precision_refus, mais 500 car. et
--    sauts de ligne conservés)
-- ---------------------------------------------------------------------------
create or replace function public.nettoyer_message_prive(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(
    regexp_replace(                                   -- 3 sauts de ligne ou plus → 2
      regexp_replace(                                 -- espaces/tabulations répétés → 1
        regexp_replace(                               -- chevrons retirés
          regexp_replace(                             -- contrôles (sauf \n) → espace
            replace(coalesce(p, ''), chr(13), ''),
            '[\x01-\x09\x0B-\x1F\x7F]', ' ', 'g'),
          '[<>]', '', 'g'),
        '[ \t]+', ' ', 'g'),
      '\n[ \n]*\n', E'\n\n', 'g'),
    E' \n'), '')
$$;
revoke all on function public.nettoyer_message_prive(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. deposer_avis : 9ᵉ paramètre facultatif p_message_prive.
--    DROP de la version à 8 paramètres + CREATE (pas de surcharge : PGRST203).
--    L'app installée appelle avec 8 clés nommées : elle résout sur celle-ci.
--    Corps repris de pg_get_functiondef (version porte-monnaie du 2026-10-07),
--    seuls ajouts : v_prive, son contrôle de longueur, son insertion.
-- ---------------------------------------------------------------------------
drop function if exists public.deposer_avis(uuid, integer, integer, integer, text, boolean, text, text);

create function public.deposer_avis(
  p_order_id uuid, p_cuisine integer, p_preparation integer, p_livraison integer,
  p_commentaire text default null, p_consentement boolean default false,
  p_langue text default 'fr', p_photo_url text default null,
  p_message_prive text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid      uuid := auth.uid();
  v_o        public.orders;
  v_nom      text;
  v_comm     text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_photo    text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_prive    text := public.nettoyer_message_prive(p_message_prive);
  v_langue   text := case when p_langue in ('fr', 'en', 'it') then p_langue else 'fr' end;
  v_avis_id  uuid;
  c_credit   constant integer := 1000;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_cuisine is null or p_preparation is null or p_livraison is null
     or p_cuisine not between 1 and 5 or p_preparation not between 1 and 5
     or p_livraison not between 1 and 5 then
    raise exception 'avis:notes_invalides' using errcode = '22023';
  end if;
  if v_comm is not null and length(v_comm) > 500 then
    raise exception 'avis:commentaire_trop_long' using errcode = '22023';
  end if;
  if v_prive is not null and length(v_prive) > 500 then
    raise exception 'avis:message_prive_trop_long' using errcode = '22023';
  end if;
  if v_photo is not null and v_photo not like
     'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/avis/' || v_uid::text || '/%' then
    raise exception 'avis:photo_invalide' using errcode = '22023';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.user_id is distinct from v_uid then
    raise exception 'avis:commande_introuvable' using errcode = '42501';
  end if;
  if v_o.status <> 'livree' then
    raise exception 'avis:commande_non_livree' using errcode = '22023';
  end if;
  if coalesce(v_o.delivered_at, v_o.status_updated_at) < now() - interval '7 days' then
    raise exception 'avis:trop_tard' using errcode = '22023';
  end if;
  if exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then
    raise exception 'avis:commande_telephone' using errcode = '22023';
  end if;
  if exists (select 1 from public.avis a where a.order_id = v_o.id) then
    raise exception 'avis:deja_depose' using errcode = '23505';
  end if;

  select p.full_name into v_nom from public.profiles p where p.id = v_uid;

  insert into public.avis (order_id, user_id, restaurant_id, courier_id,
                           note_cuisine, note_preparation, note_livraison,
                           commentaire, prenom_affiche, consentement_publication, langue, photo_url)
  values (v_o.id, v_uid, v_o.restaurant_id, v_o.courier_id,
          p_cuisine, p_preparation, p_livraison,
          v_comm, public.prenom_affiche(v_nom), coalesce(p_consentement, false), v_langue, v_photo)
  returning id into v_avis_id;

  -- Message privé : table à part, jamais publiée. Son trigger prévient le restaurant.
  if v_prive is not null then
    insert into public.avis_messages_prives (avis_id, order_id, restaurant_id, user_id, message)
    values (v_avis_id, v_o.id, v_o.restaurant_id, v_uid, v_prive);
  end if;

  -- Remerciement : +1 000 Ar dans le porte-monnaie, quelle que soit la note.
  -- Index unique (avis_id) : un avis ne crédite jamais deux fois.
  insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id, avis_id)
  values (v_uid, c_credit, 'avis', v_o.id, v_avis_id);

  -- `code`, `valeur`, `expire_le` restent pour l'app déjà installée : code nul,
  -- son écran masque l'encart du code et garde le remerciement.
  return jsonb_build_object(
    'code', null,
    'valeur', c_credit,
    'expire_le', null,
    'credit_porte_monnaie', c_credit,
    'solde_porte_monnaie', public.solde_porte_monnaie(v_uid),
    'message_prive', v_prive is not null);
end $function$;

revoke all on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text, text, text) from public, anon;
grant execute on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Telegram : le restaurant (dans sa langue) + copie admin
-- ---------------------------------------------------------------------------
create or replace function public.alerter_message_prive()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_token  text;
  v_admin  text;
  v_resto  public.restaurants;
  v_avis   public.avis;
  v_num    text;
  v_note   text;
  v_texte  text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_token is null then return new; end if;
  select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  select * into v_resto from public.restaurants where id = new.restaurant_id;
  select * into v_avis  from public.avis where id = new.avis_id;
  select order_number into v_num from public.orders where id = new.order_id;

  -- Note du restaurant (cuisine + préparation) / 5, virgule décimale, sans ,0 inutile.
  v_note := replace(trim_scale(v_avis.note_restaurant)::text, '.', ',');

  if v_resto.telegram_chat_id is not null then
    if v_resto.langue = 'it' then
      v_texte := '🔒 Messaggio privato di un cliente — ordine ' || coalesce(v_num, '?')
              || ' (★ ' || v_note || '/5)' || chr(10) || chr(10)
              || '« ' || new.message || ' »' || chr(10) || chr(10)
              || 'Solo voi potete leggerlo: non è mai pubblicato.';
    else
      v_texte := '🔒 Message privé d''un client — commande ' || coalesce(v_num, '?')
              || ' (★ ' || v_note || '/5)' || chr(10) || chr(10)
              || '« ' || new.message || ' »' || chr(10) || chr(10)
              || 'Vous seul le lisez : il n''est jamais publié.';
    end if;
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_resto.telegram_chat_id, 'disable_web_page_preview', true, 'text', v_texte),
      timeout_milliseconds := 5000);
  end if;

  if v_admin is not null then
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_admin, 'disable_web_page_preview', true,
        'text', '🔒 Message privé au restaurant — ' || coalesce(v_resto.name, '?') || chr(10)
             || 'Commande ' || coalesce(v_num, '?') || ' · ' || coalesce(v_avis.prenom_affiche, '?')
             || ' (★ ' || v_note || '/5)' || chr(10)
             || '« ' || new.message || ' »'
             || case when v_resto.telegram_chat_id is null
                     then chr(10) || '(restaurant sans Telegram : il le verra dans l''app)' else '' end),
      timeout_milliseconds := 5000);
  end if;
  return new;
end $function$;
revoke all on function public.alerter_message_prive() from public, anon, authenticated;

drop trigger if exists avis_message_prive_telegram on public.avis_messages_prives;
create trigger avis_message_prive_telegram
  after insert on public.avis_messages_prives
  for each row execute function public.alerter_message_prive();

-- ---------------------------------------------------------------------------
-- 5. Lecture : le client auteur (mon_avis), le restaurant, l'admin
-- ---------------------------------------------------------------------------
create or replace function public.mon_avis(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select jsonb_build_object(
           'note_cuisine', a.note_cuisine,
           'note_preparation', a.note_preparation,
           'note_livraison', a.note_livraison,
           'commentaire', a.commentaire,
           'photo_url', a.photo_url,
           'consentement_publication', a.consentement_publication,
           'created_at', a.created_at,
           'code', pc.code,
           'code_valeur', pc.valeur,
           'code_expire_le', pc.expire_le,
           'credit_porte_monnaie', (select coalesce(sum(m.montant), 0)
                                      from public.porte_monnaie_mouvements m
                                     where m.avis_id = a.id and m.motif = 'avis'),
           'message_prive', mp.message)
    from public.avis a
    left join public.promo_codes pc on pc.id = a.code_promo_id
    left join public.avis_messages_prives mp on mp.avis_id = a.id
   where a.order_id = p_order_id and a.user_id = auth.uid();
$function$;

-- Type de retour élargi (message_prive en DERNIÈRE colonne) : DROP + CREATE.
-- Les écrans déjà en service lisent les colonnes par nom : une de plus ne gêne pas.
drop function if exists public.avis_de_mon_restaurant(uuid);
create function public.avis_de_mon_restaurant(p_restaurant_id uuid)
returns table(id uuid, order_id uuid, order_number text, prenom text,
              note_cuisine smallint, note_preparation smallint, note_livraison smallint,
              note_restaurant numeric, commentaire text, created_at timestamptz,
              reponse_restaurant text, reponse_le timestamptz, statut text, photo_url text,
              message_prive text)
language sql
stable
security definer
set search_path = public
as $function$
  select a.id, a.order_id, o.order_number, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le, a.statut,
         a.photo_url,
         mp.message
    from public.avis a
    join public.orders o on o.id = a.order_id
    left join public.avis_messages_prives mp on mp.avis_id = a.id
   where a.restaurant_id = p_restaurant_id
     and public.is_active_restaurant_staff_of(p_restaurant_id)
   order by a.created_at desc
   limit 200;
$function$;
revoke all on function public.avis_de_mon_restaurant(uuid) from public, anon;
grant execute on function public.avis_de_mon_restaurant(uuid) to authenticated;

drop function if exists public.admin_avis_lister(text);
create function public.admin_avis_lister(p_filtre text default 'tous')
returns table(id uuid, created_at timestamptz, restaurant_id uuid, restaurant text,
              order_id uuid, order_number text, prenom text, client text,
              note_cuisine smallint, note_preparation smallint, note_livraison smallint,
              note_restaurant numeric, commentaire text, langue text, consentement boolean,
              statut text, reponse_restaurant text, reponse_le timestamptz,
              utilise_reseaux_le timestamptz, code text, photo_url text,
              message_prive text)
language sql
stable
security definer
set search_path = public
as $function$
  select a.id, a.created_at,
         a.restaurant_id, r.name,
         a.order_id, o.order_number,
         a.prenom_affiche, p.full_name,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.langue, a.consentement_publication, a.statut,
         a.reponse_restaurant, a.reponse_le,
         a.utilise_reseaux_le, pc.code,
         a.photo_url,
         mp.message
    from public.avis a
    join public.restaurants r on r.id = a.restaurant_id
    join public.orders o on o.id = a.order_id
    left join public.profiles p on p.id = a.user_id
    left join public.promo_codes pc on pc.id = a.code_promo_id
    left join public.avis_messages_prives mp on mp.avis_id = a.id
   where public.is_admin()
     and case coalesce(p_filtre, 'tous')
           when 'consentis_non_utilises'
             then (a.consentement_publication and a.utilise_reseaux_le is null
                   and a.statut = 'publie' and a.commentaire is not null)
           when 'masques' then a.statut = 'masque'
           when 'faibles' then (a.note_restaurant <= 2 or a.note_livraison <= 2)
           when 'messages_prives' then mp.avis_id is not null
           else true
         end
   order by a.created_at desc
   limit 300;
$function$;
revoke all on function public.admin_avis_lister(text) from public, anon;
grant execute on function public.admin_avis_lister(text) to authenticated;

notify pgrst, 'reload schema';
