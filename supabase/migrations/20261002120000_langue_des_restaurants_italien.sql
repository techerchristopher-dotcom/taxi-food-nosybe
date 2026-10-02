-- Une langue par restaurant pour les messages AUTOMATIQUES qu'il reçoit (Telegram, page
-- après le bouton Accepter/Refuser). Demande du porteur du projet le 2026-10-02 : Les
-- Siciliens doivent être servis en italien. L'espace restaurateur de l'app reste en français.
--
-- Valeurs : 'fr' (défaut, tous les autres) et 'it'. Ajouter une langue = étendre le CHECK
-- ET écrire ses textes partout où `langue` est lue : n8n « Taxi Food — notifications de
-- commande », landing/netlify/functions/repondre-commande.mjs, alerter_nouvel_avis(),
-- texte_message_versement_it() / versement_prendre_envoi().

alter table public.restaurants
  add column if not exists langue text not null default 'fr'
  constraint restaurants_langue_check check (langue in ('fr', 'it'));

update public.restaurants set langue = 'it' where id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b'; -- Les Siciliens

-- 1. La charge envoyée à n8n porte la langue du restaurant. Réécriture ciblée de la
--    définition en place (une seule clé ajoutée), idempotente, qui échoue bruyamment si le
--    motif a changé plutôt que de laisser partir des commandes sans langue.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.notify_order_status()'::regprocedure);
  if position('''langue'',r.langue' in d) = 0 then
    if position('''zone'',r.zone_served,' in d) = 0 then
      raise exception 'notify_order_status : motif ''zone'',r.zone_served, introuvable — à reprendre à la main';
    end if;
    d := replace(d, '''zone'',r.zone_served,', '''zone'',r.zone_served,''langue'',r.langue,');
    execute d;
  end if;
end $$;

-- 2. Alerte « client pas satisfait » (note restaurant ≤ 2), dans la langue du restaurant.
--    Le message au patron de Taxi Food (v_admin) reste en français.
create or replace function public.alerter_nouvel_avis()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_token  text;
  v_admin  text;
  v_resto  public.restaurants;
  v_num    text;
  v_notes  text;
  v_comm   text;
  v_texte  text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'telegram_bot_token';
  if v_token is null then return new; end if;
  select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  select * into v_resto from public.restaurants where id = new.restaurant_id;
  select order_number into v_num from public.orders where id = new.order_id;

  v_notes := 'Cuisine ' || new.note_cuisine || '/5 · Préparation ' || new.note_preparation
          || '/5 · Livraison ' || new.note_livraison || '/5';
  v_comm  := coalesce('« ' || new.commentaire || ' »', '(sans commentaire)');

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

  if v_resto.telegram_chat_id is not null and new.note_restaurant <= 2 then
    if v_resto.langue = 'it' then
      v_texte := '⚠️ Un cliente non è rimasto soddisfatto — ordine ' || coalesce(v_num, '?') || chr(10)
              || 'Cucina ' || new.note_cuisine || '/5 · Preparazione ' || new.note_preparation || '/5' || chr(10)
              || coalesce('« ' || new.commentaire || ' »', '(senza commento)') || chr(10) || chr(10)
              || 'Potete rispondergli dall''app Taxi Food, scheda « Historique ».';
    else
      v_texte := '⚠️ Un client n''a pas été satisfait — commande ' || coalesce(v_num, '?') || chr(10)
              || 'Cuisine ' || new.note_cuisine || '/5 · Préparation ' || new.note_preparation || '/5' || chr(10)
              || v_comm || chr(10) || chr(10)
              || 'Vous pouvez lui répondre depuis l''app Taxi Food, onglet Historique.';
    end if;
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', v_resto.telegram_chat_id, 'disable_web_page_preview', true, 'text', v_texte),
      timeout_milliseconds := 5000);
  end if;
  return new;
end $function$;

-- 3. Message de versement en italien. Fonction SŒUR plutôt qu'un paramètre de langue
--    ajouté à texte_message_versement : changer sa signature créerait une surcharge
--    (PGRST203) et casserait versement_essai_telegram().
create or replace function public.texte_message_versement_it(p_montant integer, p_nb integer, p_debut date, p_fin date, p_numeros text[], p_reference text)
 returns text
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  mesi constant text[] := array['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio',
                                'agosto','settembre','ottobre','novembre','dicembre'];
  v_montant text;
  v_periode text;
  v_g1 text;
  v_g2 text;
  v_ordini text;
  v_liste text := '';
begin
  v_montant := replace(to_char(p_montant, 'FM999,999,999,990'), ',', chr(160));
  v_g1 := case when extract(day from p_debut) = 1 then '1°' else extract(day from p_debut)::int::text end;
  v_g2 := case when extract(day from p_fin) = 1 then '1°' else extract(day from p_fin)::int::text end;

  if p_debut = p_fin then
    v_periode := 'del ' || v_g1 || ' ' || mesi[extract(month from p_debut)::int];
  elsif extract(year from p_debut) <> extract(year from p_fin) then
    v_periode := 'dal ' || v_g1 || ' ' || mesi[extract(month from p_debut)::int] || ' ' || extract(year from p_debut)::int
              || ' al ' || v_g2 || ' ' || mesi[extract(month from p_fin)::int] || ' ' || extract(year from p_fin)::int;
  elsif extract(month from p_debut) <> extract(month from p_fin) then
    v_periode := 'dal ' || v_g1 || ' ' || mesi[extract(month from p_debut)::int]
              || ' al ' || v_g2 || ' ' || mesi[extract(month from p_fin)::int];
  else
    v_periode := 'dal ' || v_g1 || ' al ' || v_g2 || ' ' || mesi[extract(month from p_fin)::int];
  end if;

  v_ordini := case when p_nb = 1 then 'il vostro ordine' else 'i vostri ' || p_nb || ' ordini' end;

  if p_nb < 10 and coalesce(array_length(p_numeros, 1), 0) > 0 then
    v_liste := chr(10) || array_to_string(p_numeros, ', ');
  end if;

  return '💸 Pagamento Taxi Food inviato'
      || chr(10) || v_montant || ' Ar per ' || v_ordini || ' ' || v_periode
      || v_liste
      || chr(10) || 'Riferimento Orange Money: ' || p_reference
      || chr(10) || 'Grazie per il vostro lavoro 🙏';
end;
$function$;

create or replace function public.versement_prendre_envoi(p_settlement_id uuid)
 returns table(chat_id text, texte text)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v public.restaurant_settlements;
  v_chat text;
  v_langue text;
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

  select nullif(btrim(coalesce(r.telegram_chat_id, '')), ''), r.langue into v_chat, v_langue
  from public.restaurants r where r.id = v.restaurant_id;

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
    case when v_langue = 'it'
      then public.texte_message_versement_it(coalesce(v.paid_amount, v.amount_due), v.nb_commandes,
             v.period_start, v.period_end, v.numeros_commandes, v.reference_versement)
      else public.texte_message_versement(coalesce(v.paid_amount, v.amount_due), v.nb_commandes,
             v.period_start, v.period_end, v.numeros_commandes, v.reference_versement)
    end;
end;
$function$;

revoke all on function public.texte_message_versement_it(integer, integer, date, date, text[], text) from public, anon, authenticated;
