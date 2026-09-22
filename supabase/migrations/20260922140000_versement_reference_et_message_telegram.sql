-- Versement au restaurant : détail des commandes, référence Orange Money
-- OBLIGATOIRE, anti-doublon, et message Telegram au restaurant (2026-09-22).
--
-- POURQUOI. « Marquer reversé » enregistrait un montant, et c'est tout : le
-- restaurant n'était prévenu de rien, l'admin ne voyait pas quelles commandes
-- il payait, et rien n'empêchait de payer deux fois la même semaine. À la
-- question « vous m'avez payé quand ? », il n'y avait ni date ni référence.
--
-- CE QUI NE CHANGE PAS : `record_settlement` (4 arguments). Elle garde son
-- corps et ses appelants (l'admin déjà déployé tant qu'il n'est pas rechargé).
-- Le nouveau chemin a un NOM NOUVEAU — jamais une surcharge (PGRST203 : deux
-- fonctions du même nom, PostgREST refuse de choisir et TOUS les appels
-- tombent).
--
-- UNE SEULE SOURCE POUR LE CALCUL. `admin_commandes_a_reverser` rend les
-- commandes retenues, une par ligne, avec la formule de `record_settlement` à
-- l'identique (dû = plats + emballage − commission − part offerte ; commission
-- figée, sinon calcul de secours au taux actuel ; jour local
-- Indian/Antananarivo). Le détail affiché dans l'admin ET le montant enregistré
-- par `admin_enregistrer_versement` sortent de cette fonction : ils ne peuvent
-- pas diverger. Le test de recette vérifie en plus que sa somme égale celle de
-- `record_settlement` sur des périodes réelles.
--
-- LE MESSAGE TELEGRAM part d'une fonction Edge (`notifier-versement`), pas de
-- la base : il faut la RÉPONSE de Telegram pour dire honnêtement « envoyé ».
-- pg_net est asynchrone et ne la rend pas au moment de l'écriture. Le jeton du
-- robot reste dans le Vault (`telegram_bot_token`) : seule la clé service_role
-- le lit, par `lire_jeton_telegram()`. Le workflow n8n T7uX n'est pas touché.

-- ---------------------------------------------------------------- 1. Colonnes
alter table public.restaurant_settlements
  add column if not exists reference_versement text,
  add column if not exists nb_commandes integer,
  add column if not exists numeros_commandes text[],
  -- non_prevu : reversement enregistré avant cette migration, ou par l'ancien
  --             `record_settlement` — aucun message n'était prévu.
  -- en_attente : à envoyer (le restaurant a un canal).
  -- en_cours   : envoi pris par la fonction Edge, réponse de Telegram attendue.
  -- envoye     : Telegram a CONFIRMÉ (ok: true + message_id). Seul cas « envoyé ».
  -- echec      : Telegram a refusé, ou n'a pas répondu (voir telegram_erreur).
  -- sans_canal : le restaurant n'a pas de telegram_chat_id.
  add column if not exists telegram_statut text not null default 'non_prevu',
  add column if not exists telegram_erreur text,
  add column if not exists telegram_message_id bigint,
  add column if not exists telegram_envoye_at timestamptz,
  add column if not exists telegram_tente_at timestamptz,
  add column if not exists telegram_tentatives integer not null default 0;

alter table public.restaurant_settlements
  drop constraint if exists restaurant_settlements_telegram_statut_check;
alter table public.restaurant_settlements
  add constraint restaurant_settlements_telegram_statut_check
  check (telegram_statut in ('non_prevu', 'en_attente', 'en_cours', 'envoye', 'echec', 'sans_canal'));

-- Une référence Orange Money ne sert qu'une fois. Comparée sans espaces et sans
-- casse : « pp 2309 » et « PP2309 » sont la même transaction.
create unique index if not exists restaurant_settlements_reference_unique
  on public.restaurant_settlements (upper(regexp_replace(reference_versement, '\s', '', 'g')))
  where reference_versement is not null;

-- ------------------------------------------- 2. Les commandes d'un reversement
create or replace function public.admin_commandes_a_reverser(
  p_restaurant_id uuid, p_period_start date, p_period_end date)
returns table (
  order_id uuid,
  order_number text,
  livree_le timestamptz,
  montant integer,      -- plats + emballage : la base du restaurant
  plats integer,
  emballage integer,
  commission integer,
  offert integer,       -- part offerte par le restaurant (code offert)
  net integer           -- ce que Taxi Food lui doit pour cette commande
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  -- ⚠️ Formule et filtre recopiés de `record_settlement` À L'OCTET. Toute
  -- évolution de l'une se porte dans l'autre (le test de recette compare).
  return query
  select o.id,
         o.order_number,
         coalesce(o.delivered_at, o.created_at),
         (o.subtotal + o.packaging_fee)::integer,
         o.subtotal::integer,
         o.packaging_fee::integer,
         coalesce(o.commission_amount,
                  greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                 * r.commission_rate)::integer, 0))::integer,
         o.remise_charge_restaurant::integer,
         (o.subtotal + o.packaging_fee
          - coalesce(o.commission_amount,
                     greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                    * r.commission_rate)::integer, 0))
          - o.remise_charge_restaurant)::integer
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.restaurant_id = p_restaurant_id and o.status = 'livree'
    and (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end
  order by coalesce(o.delivered_at, o.created_at), o.order_number;
end;
$$;

-- ------------------------------------------------------ 3. Le texte du message
-- Fonction PURE (aucune lecture de table) : l'admin s'en sert pour montrer le
-- message AVANT de confirmer, et la fonction Edge pour l'envoyer. Même texte.
create or replace function public.texte_message_versement(
  p_montant integer, p_nb integer, p_debut date, p_fin date,
  p_numeros text[], p_reference text)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  mois constant text[] := array['janvier','février','mars','avril','mai','juin','juillet',
                                'août','septembre','octobre','novembre','décembre'];
  v_montant text;
  v_periode text;
  v_jour_debut text;
  v_jour_fin text;
  v_commandes text;
  v_liste text := '';
begin
  -- 185000 -> « 185 000 », espace insécable : le nombre ne se coupe pas.
  v_montant := replace(to_char(p_montant, 'FM999,999,999,990'), ',', chr(160));

  v_jour_debut := case when extract(day from p_debut) = 1 then '1er'
                       else extract(day from p_debut)::int::text end;
  v_jour_fin := case when extract(day from p_fin) = 1 then '1er'
                     else extract(day from p_fin)::int::text end;

  if p_debut = p_fin then
    v_periode := 'du ' || v_jour_debut || ' ' || mois[extract(month from p_debut)::int];
  elsif extract(year from p_debut) <> extract(year from p_fin) then
    v_periode := 'du ' || v_jour_debut || ' ' || mois[extract(month from p_debut)::int]
              || ' ' || extract(year from p_debut)::int
              || ' au ' || v_jour_fin || ' ' || mois[extract(month from p_fin)::int]
              || ' ' || extract(year from p_fin)::int;
  elsif extract(month from p_debut) <> extract(month from p_fin) then
    v_periode := 'du ' || v_jour_debut || ' ' || mois[extract(month from p_debut)::int]
              || ' au ' || v_jour_fin || ' ' || mois[extract(month from p_fin)::int];
  else
    v_periode := 'du ' || v_jour_debut || ' au ' || v_jour_fin || ' '
              || mois[extract(month from p_fin)::int];
  end if;

  v_commandes := case when p_nb = 1 then 'votre commande' else 'vos ' || p_nb || ' commandes' end;

  -- La liste des numéros seulement en dessous de 10 : au-delà, elle noie le message.
  if p_nb < 10 and coalesce(array_length(p_numeros, 1), 0) > 0 then
    v_liste := chr(10) || array_to_string(p_numeros, ', ');
  end if;

  return '💸 Versement Taxi Food envoyé'
      || chr(10) || v_montant || ' Ar pour ' || v_commandes || ' ' || v_periode
      || v_liste
      || chr(10) || 'Référence Orange Money : ' || p_reference
      || chr(10) || 'Merci pour votre travail 🙏';
end;
$$;

-- ------------------------------------------- 4. Enregistrer un versement payé
create or replace function public.admin_enregistrer_versement(
  p_restaurant_id uuid, p_period_start date, p_period_end date,
  p_paid_amount integer, p_reference text, p_du_attendu integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_cle text;
  v_du integer;
  v_nb integer;
  v_numeros text[];
  v_chat text;
  v_exist public.restaurant_settlements;
  v_nom text;
  v_row public.restaurant_settlements;
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;

  if p_restaurant_id is null or p_period_start is null or p_period_end is null then
    raise exception 'Restaurant et période obligatoires';
  end if;
  if p_period_start > p_period_end then
    raise exception 'Période invalide : le début est après la fin';
  end if;

  v_ref := btrim(regexp_replace(coalesce(p_reference, ''), '\s+', ' ', 'g'));
  if v_ref = '' then
    raise exception 'Référence du versement obligatoire (ID de transaction Orange Money)';
  end if;
  if length(v_ref) < 4 or length(v_ref) > 64 then
    raise exception 'Référence du versement invalide : entre 4 et 64 caractères';
  end if;
  v_cle := upper(regexp_replace(v_ref, '\s', '', 'g'));

  if p_paid_amount is null or p_paid_amount <= 0 then
    raise exception 'Montant versé invalide';
  end if;

  select name, telegram_chat_id into v_nom, v_chat from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  -- Deux clics, deux onglets : un seul passe. Le verrou tient jusqu'à la fin
  -- de la transaction, le second appel relit alors le premier reversement.
  perform pg_advisory_xact_lock(hashtextextended('versement:' || p_restaurant_id::text, 0));

  -- Une période qui en CHEVAUCHE une déjà payée est refusée, pas seulement la
  -- même : payer le 15–21 puis le 18–24 reverserait deux fois le 18–21.
  select * into v_exist
  from public.restaurant_settlements s
  where s.restaurant_id = p_restaurant_id
    and daterange(s.period_start, s.period_end, '[]') && daterange(p_period_start, p_period_end, '[]')
  order by s.created_at desc
  limit 1;
  if found then
    -- (Deux % collés font un % littéral en RAISE : la référence est accolée
    -- à la date de fin dans un seul argument.)
    raise exception 'Déjà reversé : % a été payé pour la période du % au %, le %. Aucun deuxième versement enregistré.',
      v_nom,
      to_char(v_exist.period_start, 'DD/MM/YYYY'),
      to_char(v_exist.period_end, 'DD/MM/YYYY')
        || coalesce(' (référence ' || v_exist.reference_versement || ')', ''),
      to_char(v_exist.paid_at at time zone 'Indian/Antananarivo', 'DD/MM/YYYY');
  end if;

  select * into v_exist
  from public.restaurant_settlements s
  where upper(regexp_replace(s.reference_versement, '\s', '', 'g')) = v_cle
  limit 1;
  if found then
    raise exception 'Référence déjà utilisée : % sert déjà au versement du % au % (enregistré le %).',
      v_ref,
      to_char(v_exist.period_start, 'DD/MM/YYYY'),
      to_char(v_exist.period_end, 'DD/MM/YYYY'),
      to_char(v_exist.paid_at at time zone 'Indian/Antananarivo', 'DD/MM/YYYY');
  end if;

  -- Le dû et la liste viennent de LA fonction qui alimente le détail à l'écran.
  select coalesce(sum(c.net), 0)::integer, count(*)::integer,
         coalesce(array_agg(c.order_number order by c.livree_le, c.order_number), '{}')
    into v_du, v_nb, v_numeros
  from public.admin_commandes_a_reverser(p_restaurant_id, p_period_start, p_period_end) c;

  if v_nb = 0 then
    raise exception 'Aucune commande livrée pour % sur cette période : rien à reverser', v_nom;
  end if;

  -- L'écran a montré un montant ; si une commande a bougé entre-temps, on ne
  -- l'enregistre pas en silence.
  if p_du_attendu is distinct from v_du then
    raise exception 'Le dû a changé depuis l''affichage (% Ar affichés, % Ar en base). Recharge le rapport.',
      p_du_attendu, v_du;
  end if;

  begin
    insert into public.restaurant_settlements (
      restaurant_id, period_start, period_end, amount_due, paid_amount, created_by,
      reference_versement, nb_commandes, numeros_commandes, telegram_statut)
    values (
      p_restaurant_id, p_period_start, p_period_end, v_du, p_paid_amount, auth.uid(),
      v_ref, v_nb, v_numeros,
      case when nullif(btrim(coalesce(v_chat, '')), '') is null then 'sans_canal' else 'en_attente' end)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Référence déjà utilisée : % sert déjà à un autre versement.', v_ref;
  end;

  return v_row;
end;
$$;

-- ------------------------------------ 5. Côté fonction Edge (service_role seul)
create or replace function public.lire_jeton_telegram()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token';
$$;

-- Prend l'envoi d'un versement : verrouille la ligne, refuse un deuxième
-- envoi confirmé, et rend le canal ACTUEL du restaurant avec le texte.
create or replace function public.versement_prendre_envoi(p_settlement_id uuid)
returns table (chat_id text, texte text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.restaurant_settlements;
  v_chat text;
begin
  select * into v from public.restaurant_settlements where id = p_settlement_id for update;
  if not found then raise exception 'versement_introuvable'; end if;
  if v.telegram_statut = 'envoye' then raise exception 'deja_envoye'; end if;
  if v.telegram_statut = 'non_prevu' or v.reference_versement is null then
    raise exception 'versement_sans_reference';
  end if;
  if v.telegram_statut = 'en_cours' and v.telegram_tente_at > now() - interval '2 minutes' then
    raise exception 'envoi_en_cours';
  end if;

  select nullif(btrim(coalesce(r.telegram_chat_id, '')), '') into v_chat
  from public.restaurants r where r.id = v.restaurant_id;

  -- Pas de canal (retiré depuis, ou jamais posé) : on l'écrit et on rend une
  -- ligne vide — pas d'exception, qui annulerait cette mise à jour.
  if v_chat is null then
    update public.restaurant_settlements
       set telegram_statut = 'sans_canal', telegram_erreur = null
     where id = p_settlement_id;
    return query select null::text, null::text;
    return;
  end if;

  update public.restaurant_settlements
     set telegram_statut = 'en_cours', telegram_tente_at = now(),
         telegram_tentatives = telegram_tentatives + 1, telegram_erreur = null
   where id = p_settlement_id;

  return query select v_chat,
    public.texte_message_versement(coalesce(v.paid_amount, v.amount_due), v.nb_commandes,
      v.period_start, v.period_end, v.numeros_commandes, v.reference_versement);
end;
$$;

create or replace function public.versement_noter_envoi(
  p_settlement_id uuid, p_ok boolean, p_message_id bigint, p_erreur text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.restaurant_settlements
     set telegram_statut = case when p_ok and p_message_id is not null then 'envoye' else 'echec' end,
         telegram_message_id = case when p_ok then p_message_id else telegram_message_id end,
         telegram_envoye_at = case when p_ok and p_message_id is not null then now() else telegram_envoye_at end,
         telegram_erreur = case when p_ok and p_message_id is not null then null
                                else left(coalesce(p_erreur, 'Telegram n''a pas confirmé l''envoi'), 500) end
   where id = p_settlement_id;
end;
$$;

-- Essai : le message d'exemple part sur le canal ADMIN (telegram_admin_chat_id),
-- qui n'est celui d'aucun restaurant. Aucun versement n'est créé.
create or replace function public.versement_essai_telegram()
returns table (chat_id text, texte text)
language sql
security definer
set search_path = public
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_admin_chat_id'),
         '🧪 ESSAI — aucun versement réel, message d''exemple' || chr(10) || chr(10)
         || public.texte_message_versement(185000, 3, date '2026-09-15', date '2026-09-21',
              array['TF-101', 'TF-102', 'TF-103'], 'EXEMPLE-0000');
$$;

-- ------------------------------------------------------------------ 6. Droits
-- ⚠️ `revoke from public` ne retire PAS anon / authenticated (ALTER DEFAULT
-- PRIVILEGES de Supabase) : chaque rôle est révoqué nommément.
revoke all on function public.admin_commandes_a_reverser(uuid, date, date) from public, anon, authenticated;
revoke all on function public.admin_enregistrer_versement(uuid, date, date, integer, text, integer) from public, anon, authenticated;
revoke all on function public.texte_message_versement(integer, integer, date, date, text[], text) from public, anon, authenticated;
revoke all on function public.lire_jeton_telegram() from public, anon, authenticated;
revoke all on function public.versement_prendre_envoi(uuid) from public, anon, authenticated;
revoke all on function public.versement_noter_envoi(uuid, boolean, bigint, text) from public, anon, authenticated;
revoke all on function public.versement_essai_telegram() from public, anon, authenticated;

-- L'admin connecté (authenticated + is_admin() dans le corps).
grant execute on function public.admin_commandes_a_reverser(uuid, date, date) to authenticated, service_role;
grant execute on function public.admin_enregistrer_versement(uuid, date, date, integer, text, integer) to authenticated, service_role;
grant execute on function public.texte_message_versement(integer, integer, date, date, text[], text) to authenticated, service_role;
-- La fonction Edge seule.
grant execute on function public.lire_jeton_telegram() to service_role;
grant execute on function public.versement_prendre_envoi(uuid) to service_role;
grant execute on function public.versement_noter_envoi(uuid, boolean, bigint, text) to service_role;
grant execute on function public.versement_essai_telegram() to service_role;
