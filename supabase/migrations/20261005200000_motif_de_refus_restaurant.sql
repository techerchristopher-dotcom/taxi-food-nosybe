-- Motif de refus choisi par le restaurant (2026-10-05)
--
-- Constat : TF-320 refusée depuis Telegram par Chez Bidule & Truc (plus de poulet). La cliente
-- a reçu « Refusée par le restaurant depuis Telegram » : elle ignore pourquoi.
--
-- Désormais le restaurant choisit un motif prédéfini (code) + une précision libre facultative.
--   orders.cancellation_code   : code stable, pour les statistiques et la traduction côté client
--   orders.cancellation_detail : précision libre nettoyée (200 caractères au plus)
--   orders.cancellation_reason : texte lisible, composé EN BASE (lu tel quel par l'e-mail n8n
--                                T7uX, le Telegram du restaurant, la copie admin, les anciennes
--                                versions de l'app)
--
-- Compatibilité : un refus SANS code fonctionne exactement comme avant (p_reason / p_motif).
-- Les deux RPC gardent leurs paramètres d'origine, aux mêmes noms ; les nouveaux ont une valeur
-- par défaut. On remplace la fonction (DROP + CREATE dans la même transaction) plutôt que
-- d'ajouter une surcharge : deux surcharges se recouvrant = PGRST203 côté PostgREST.


-- 1. Colonnes ----------------------------------------------------------------------------
alter table public.orders
  add column if not exists cancellation_code text,
  add column if not exists cancellation_detail text;

alter table public.orders drop constraint if exists orders_cancellation_code_check;
alter table public.orders add constraint orders_cancellation_code_check
  check (cancellation_code is null
         or cancellation_code in ('rupture','trop_de_commandes','fermeture','livraison_impossible','autre'));

alter table public.orders drop constraint if exists orders_cancellation_detail_longueur;
alter table public.orders add constraint orders_cancellation_detail_longueur
  check (cancellation_detail is null or char_length(cancellation_detail) <= 200);

comment on column public.orders.cancellation_code is
  'Motif de refus choisi par le restaurant : rupture | trop_de_commandes | fermeture | livraison_impossible | autre. NULL = refus ancien, annulation admin ou client.';
comment on column public.orders.cancellation_detail is
  'Précision libre du restaurant sur son refus (nettoyée, 200 car. max). Montrée telle quelle au client.';

-- 2. Fonctions utilitaires ------------------------------------------------------------------
-- Nettoyage de la précision libre : caractères de contrôle et chevrons retirés, espaces
-- resserrés, 200 caractères, sans point final (l'e-mail écrit « Motif : <texte>. Tu n'as… »).
create or replace function public.nettoyer_precision_refus(p text)
returns text language sql immutable set search_path = public as $$
  select nullif(
    rtrim(left(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
      '[[:cntrl:]]', ' ', 'g'), '[<>]', '', 'g'), '\s+', ' ', 'g')), 200), ' .'),
    '')
$$;

-- Libellé français destiné au client (l'e-mail et le Telegram restent en français).
-- Les traductions EN/IT vivent dans l'app (app/locales) et dans notify-order.
create or replace function public.libelle_motif_refus(p_code text)
returns text language sql immutable set search_path = public as $$
  select case p_code
    when 'rupture'              then 'Un ou plusieurs plats ne sont plus disponibles'
    when 'trop_de_commandes'    then 'Trop de commandes en ce moment'
    when 'fermeture'            then 'Le restaurant ferme ou est fermé'
    when 'livraison_impossible' then 'Adresse trop éloignée ou non desservie'
    when 'autre'                then 'Le restaurant n''a pas pu accepter la commande'
  end
$$;

-- Texte complet : « <libellé> : <précision> », ou la précision seule pour « autre ».
-- NULL si le code est inconnu (l'appelant refuse alors le refus).
create or replace function public.composer_motif_refus(p_code text, p_precision text)
returns text language sql immutable set search_path = public as $$
  select case
    when public.libelle_motif_refus(p_code) is null then null
    when p_code = 'autre' then coalesce(public.nettoyer_precision_refus(p_precision),
                                        public.libelle_motif_refus('autre'))
    else public.libelle_motif_refus(p_code)
         || coalesce(' : ' || public.nettoyer_precision_refus(p_precision), '')
  end
$$;

revoke all on function public.nettoyer_precision_refus(text) from public, anon, authenticated;
revoke all on function public.libelle_motif_refus(text) from public, anon, authenticated;
revoke all on function public.composer_motif_refus(text, text) from public, anon, authenticated;

-- 3. set_order_status : refus depuis l'espace restaurant de l'app ----------------------------
drop function if exists public.set_order_status(uuid, order_status, text);

create function public.set_order_status(
  p_order_id uuid,
  p_new_status order_status,
  p_reason text default null,
  p_code text default null,
  p_precision text default null)
returns public.orders
language plpgsql security definer set search_path = public
as $function$
declare
  v_order public.orders;
  v_current order_status;
  v_reason text;
  v_code text;
  v_detail text;
begin
  if auth.uid() is null then
    raise exception 'Non authentifie';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'Commande introuvable';
  end if;

  if not public.is_active_restaurant_staff_of(v_order.restaurant_id) then
    raise exception 'Acces refuse a cette commande';
  end if;

  v_current := v_order.status;

  if v_current = 'en_preparation' and p_new_status = 'en_preparation' then
    return v_order;
  end if;

  if not (
    (v_current = 'recue'          and p_new_status in ('confirmee','annulee')) or
    (v_current = 'confirmee'      and p_new_status in ('en_preparation','annulee')) or
    (v_current = 'en_preparation' and p_new_status = 'en_livraison')
  ) then
    raise exception 'Transition invalide: % -> %', v_current, p_new_status;
  end if;

  if p_new_status = 'annulee' then
    v_code := nullif(btrim(coalesce(p_code, '')), '');
    if v_code is not null then
      v_reason := public.composer_motif_refus(v_code, p_precision);
      if v_reason is null then
        raise exception 'Motif de refus inconnu: %', v_code;
      end if;
      v_detail := public.nettoyer_precision_refus(p_precision);
    else
      -- Ancien chemin (versions de l'app sans code) : texte libre obligatoire.
      v_reason := nullif(btrim(coalesce(p_reason, '')), '');
      if v_reason is null then
        raise exception 'Un motif est obligatoire pour refuser une commande';
      end if;
    end if;
  end if;

  update public.orders
    set status = p_new_status,
        status_updated_at = now(),
        cancellation_reason = case when p_new_status = 'annulee' then v_reason else cancellation_reason end,
        cancellation_code   = case when p_new_status = 'annulee' then v_code   else cancellation_code end,
        cancellation_detail = case when p_new_status = 'annulee' then v_detail else cancellation_detail end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$function$;

grant execute on function public.set_order_status(uuid, order_status, text, text, text)
  to anon, authenticated, service_role;

-- 4. repondre_commande_par_jeton : refus depuis le lien Telegram ------------------------------
drop function if exists public.repondre_commande_par_jeton(uuid, uuid, text, text);

create function public.repondre_commande_par_jeton(
  p_order_id uuid,
  p_token uuid,
  p_action text,
  p_motif text default null,
  p_code text default null,
  p_precision text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $function$
declare v_order public.orders; v_resto text; v_jeton uuid; v_auto boolean; v_langue text;
        v_code text; v_reason text; v_detail text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;

  if v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;

  select langue into v_langue from public.restaurants where id = v_order.restaurant_id;

  if v_order.status <> 'recue' then
    return jsonb_build_object('ok', false, 'raison', 'deja traitee',
                              'statut', v_order.status::text, 'langue', coalesce(v_langue, 'fr'));
  end if;

  if p_action = 'accepter' then
    update public.orders set status = 'confirmee', status_updated_at = now()
     where id = p_order_id returning * into v_order;
  elsif p_action = 'refuser' then
    v_code := nullif(btrim(coalesce(p_code, '')), '');
    if v_code is not null then
      v_reason := public.composer_motif_refus(v_code, p_precision);
      if v_reason is null then
        return jsonb_build_object('ok', false, 'raison', 'motif inconnu', 'langue', coalesce(v_langue, 'fr'));
      end if;
      v_detail := public.nettoyer_precision_refus(p_precision);
    else
      v_reason := nullif(btrim(coalesce(p_motif, '')), '');
      if v_reason is null then
        return jsonb_build_object('ok', false, 'raison', 'motif obligatoire');
      end if;
    end if;
    update public.orders set status = 'annulee', status_updated_at = now(),
           cancellation_reason = v_reason,
           cancellation_code = v_code,
           cancellation_detail = v_detail
     where id = p_order_id returning * into v_order;
  else
    return jsonb_build_object('ok', false, 'raison', 'action inconnue');
  end if;

  select name, preparation_auto into v_resto, v_auto
    from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto,
                            'preparation_auto', coalesce(v_auto, false),
                            'langue', coalesce(v_langue, 'fr'),
                            'motif', v_order.cancellation_reason);
end $function$;

grant execute on function public.repondre_commande_par_jeton(uuid, uuid, text, text, text, text)
  to anon, authenticated, service_role;

-- 5. Lecture SANS effet, pour afficher le formulaire de refus ---------------------------------
-- La page /r-refus/… ne refuse plus au GET (un robot d'aperçu de lien ne doit jamais annuler
-- une commande) : elle affiche le formulaire, et il lui faut le numéro et la langue.
create or replace function public.consulter_commande_par_jeton(p_order_id uuid, p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $function$
declare v_order public.orders; v_jeton uuid; v_langue text; v_resto text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;
  if v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;
  select langue, name into v_langue, v_resto from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto,
                            'langue', coalesce(v_langue, 'fr'));
end $function$;

revoke all on function public.consulter_commande_par_jeton(uuid, uuid) from public;
grant execute on function public.consulter_commande_par_jeton(uuid, uuid)
  to anon, authenticated, service_role;


notify pgrst, 'reload schema';
