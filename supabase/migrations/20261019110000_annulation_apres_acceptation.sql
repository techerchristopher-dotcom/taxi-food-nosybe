-- ❌ Le circuit d'annulation (2026-10-19) — après l'incident TF-439.
--
-- TF-439 (La Cabane, 18/10) : acceptée à 19 h 49, marquée « prête » 9 s plus tard (trois
-- appuis au même endroit), puis restée en « en_livraison » sans livreur TOUTE LA NUIT : le
-- restaurant ne pouvait plus l'annuler (set_order_status n'acceptait l'annulation que depuis
-- recue / confirmee — et la préparation automatique fait quitter « confirmee » en 30 s),
-- le lien Telegram répondait « Déjà traitée, rien de plus à faire », et rien ne prévenait
-- personne. Annulée par l'admin le lendemain à 9 h 19.
--
-- Ce que change cette migration :
--  1. `commande_annulable_par_restaurant(o)` : LA règle — tant que le livreur n'a pas
--     RÉCUPÉRÉ la commande (picked_up_at vide), le restaurant peut l'annuler.
--  2. `set_order_status` : annulation depuis confirmee / en_preparation / en_livraison non
--     récupérée ; et retour « pas encore prête » (en_livraison → en_preparation) tant
--     qu'aucun livreur ne l'a prise.
--  3. `repondre_commande_par_jeton` : le lien « Refuser » de Telegram marche selon la même
--     règle (l'acceptation, elle, reste réservée à « recue ») ; `consulter_commande_par_jeton`
--     dit si la commande est encore annulable (la page affiche alors le formulaire).
--  4. `orders.annulee_par` (restaurant | admin | client | systeme) : le client ne lira plus
--     « le restaurant n'a pas pu honorer ta commande » quand c'est Taxi Food qui annule.
--  5. Alerte « commande coincée » au canal Telegram admin (toutes les 5 min, répétée
--     chaque heure tant que rien ne bouge).

-- 1. ─────────────────────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists annulee_par text
  check (annulee_par is null or annulee_par in ('restaurant', 'admin', 'client', 'systeme'));
alter table public.orders add column if not exists alerte_coincee_le timestamptz;

create or replace function public.commande_annulable_par_restaurant(o public.orders)
returns boolean
language sql
stable
as $$
  select o.status in ('recue', 'confirmee', 'en_preparation')
      or (o.status = 'en_livraison' and o.picked_up_at is null)
$$;

-- Qui a annulé : posé par la fonction qui annule ; à défaut, déduit de l'appelant.
-- Une commande qui ressort de l'annulation (réactivation admin) perd l'information.
create or replace function public.poser_annulee_par()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'annulee' and old.status is distinct from 'annulee' and new.annulee_par is null then
    new.annulee_par := case
      when public.is_admin() then 'admin'
      when auth.uid() is not null and auth.uid() = new.user_id then 'client'
      when auth.uid() is not null and public.is_active_restaurant_staff_of(new.restaurant_id) then 'restaurant'
      else 'systeme' end;
  elsif new.status <> 'annulee' and old.status = 'annulee' then
    new.annulee_par := null;
  end if;
  return new;
end $$;
drop trigger if exists orders_annulee_par on public.orders;
create trigger orders_annulee_par before update of status on public.orders
  for each row execute function public.poser_annulee_par();

-- 2. ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.set_order_status(p_order_id uuid, p_new_status order_status, p_reason text default null,
                                                   p_code text default null, p_precision text default null)
returns orders
language plpgsql
security definer
set search_path = public
as $$
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

  -- appui tardif sur « Demarrer » alors que la preparation automatique est passee
  if v_current = 'en_preparation' and p_new_status = 'en_preparation' then
    return v_order;
  end if;

  if p_new_status = 'annulee' then
    if not public.commande_annulable_par_restaurant(v_order) then
      raise exception using message = case
        when v_current = 'en_livraison' then 'Le livreur a deja recupere cette commande : contacte Taxi Food pour l annuler'
        else 'Cette commande ne peut plus etre annulee (' || v_current || ')' end;
    end if;
  elsif not (
    (v_current = 'recue'          and p_new_status = 'confirmee') or
    (v_current = 'confirmee'      and p_new_status = 'en_preparation') or
    (v_current = 'en_preparation' and p_new_status = 'en_livraison') or
    -- « Pas encore prete » : marquee prete par erreur, aucun livreur ne l'a prise
    (v_current = 'en_livraison'   and p_new_status = 'en_preparation' and v_order.courier_id is null and v_order.picked_up_at is null)
  ) then
    raise exception using message = case
      when v_current = 'en_livraison' and p_new_status = 'en_preparation'
        then 'Un livreur a deja pris cette commande : elle ne peut plus revenir en preparation'
      else 'Transition invalide: ' || v_current || ' -> ' || p_new_status end;
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
      v_reason := nullif(btrim(coalesce(p_reason, '')), '');
      if v_reason is null then
        raise exception 'Un motif est obligatoire pour refuser une commande';
      end if;
    end if;
  end if;

  update public.orders
    set status = p_new_status,
        status_updated_at = now(),
        -- retour en preparation : la commande n'est plus « prete »
        ready_at = case when v_current = 'en_livraison' and p_new_status = 'en_preparation' then null else ready_at end,
        cancellation_reason = case when p_new_status = 'annulee' then v_reason else cancellation_reason end,
        cancellation_code   = case when p_new_status = 'annulee' then v_code   else cancellation_code end,
        cancellation_detail = case when p_new_status = 'annulee' then v_detail else cancellation_detail end,
        annulee_par         = case when p_new_status = 'annulee' then 'restaurant' else annulee_par end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

-- 3. ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.repondre_commande_par_jeton(p_order_id uuid, p_token uuid, p_action text,
  p_motif text default null, p_code text default null, p_precision text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  -- Accepter : seulement une commande encore « recue ».
  -- Refuser  : tant que le livreur ne l'a pas recuperee (meme regle que l'app).
  if (p_action = 'accepter' and v_order.status <> 'recue')
     or (p_action = 'refuser' and not public.commande_annulable_par_restaurant(v_order)) then
    return jsonb_build_object('ok', false, 'raison', 'deja traitee',
                              'statut', v_order.status::text, 'langue', coalesce(v_langue, 'fr'),
                              'recuperee', v_order.picked_up_at is not null);
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
           cancellation_detail = v_detail,
           annulee_par = 'restaurant'
     where id = p_order_id returning * into v_order;
  else
    return jsonb_build_object('ok', false, 'raison', 'action inconnue');
  end if;

  select name, preparation_auto into v_resto, v_auto
    from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto,
                            'lancement_prevu', case when v_order.lancement_prevu_a > now()
                              then to_char(v_order.lancement_prevu_a at time zone 'Indian/Antananarivo', 'HH24:MI') end,
                            'preparation_auto', coalesce(v_auto, false),
                            'langue', coalesce(v_langue, 'fr'),
                            'motif', v_order.cancellation_reason);
end $$;

create or replace function public.consulter_commande_par_jeton(p_order_id uuid, p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
                            'langue', coalesce(v_langue, 'fr'),
                            'annulable', public.commande_annulable_par_restaurant(v_order),
                            'recuperee', v_order.picked_up_at is not null);
end $$;

-- L'admin : meme fonction, l'origine « admin » est posee par le trigger (is_admin()).
-- Garde-fou : une commande LIVREE ne s'annule plus par ce chemin (elle rembourserait la
-- carte en totalite sans rendre ni porte-monnaie ni code — incoherent).
create or replace function public.admin_set_order_status(p_order_id uuid, p_new_status order_status, p_reason text default null)
returns orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_avant public.order_status;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  v_avant := v_order.status;

  if p_new_status = 'annulee' and nullif(btrim(coalesce(p_reason,'')), '') is null then
    raise exception 'Un motif est obligatoire pour annuler une commande';
  end if;
  if p_new_status = 'annulee' and v_avant = 'livree' then
    raise exception 'Commande deja livree : utilise un remboursement (onglet Remboursements), pas une annulation';
  end if;

  update public.orders
     set status = p_new_status,
         status_updated_at = now(),
         cancellation_reason = case when p_new_status = 'annulee'
                                    then btrim(p_reason) else cancellation_reason end,
         annulee_par = case when p_new_status = 'annulee' then 'admin' else annulee_par end
   where id = p_order_id
   returning * into v_order;

  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'statut_commande', p_order_id, v_order.restaurant_id,
          v_avant::text, p_new_status::text, nullif(btrim(coalesce(p_reason,'')), ''));

  return v_order;
end $$;

-- 5. ─────────────────────────────────────────────────────────────────────────────────
-- Commande « coincée » : prete sans livreur depuis 15 min ; prise par un livreur mais pas
-- recuperee depuis 25 min ; en preparation depuis 60 min. Alerte au canal admin, repetee
-- chaque heure tant que rien ne bouge (le soir du 18/10, une seule alerte aurait suffi).
create or replace function public.alerter_commandes_coincees()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  v_texte text;
begin
  for r in
    select o.id, o.order_number, o.total, o.payment_method, o.status, o.courier_id, o.ready_at, o.claimed_at,
           o.status_updated_at, rs.name as resto, p.full_name as livreur,
           case
             when o.status = 'en_livraison' and o.courier_id is null then 'prête sans livreur depuis ' || alerte_duree(now() - coalesce(o.ready_at, o.status_updated_at))
             when o.status = 'en_livraison' and o.picked_up_at is null then 'prise par ' || coalesce(nullif(btrim(p.full_name), ''), 'un livreur') || ' mais pas récupérée depuis ' || alerte_duree(now() - coalesce(o.claimed_at, o.status_updated_at))
             else 'en préparation depuis ' || alerte_duree(now() - o.status_updated_at)
           end as situation
      from orders o
      join restaurants rs on rs.id = o.restaurant_id
      left join profiles p on p.id = o.courier_id
     where o.created_at > now() - interval '24 hours'
       and (o.alerte_coincee_le is null or o.alerte_coincee_le < now() - interval '60 minutes')
       and (
            (o.status = 'en_livraison' and o.courier_id is null and coalesce(o.ready_at, o.status_updated_at) < now() - interval '15 minutes')
         or (o.status = 'en_livraison' and o.courier_id is not null and o.picked_up_at is null
             and coalesce(o.claimed_at, o.status_updated_at) < now() - interval '25 minutes')
         or (o.status = 'en_preparation' and o.status_updated_at < now() - interval '60 minutes'))
  loop
    v_texte := '⏳ COMMANDE COINCÉE — ' || r.resto || chr(10)
      || r.order_number || ' : ' || r.situation || chr(10)
      || 'Total : ' || alerte_ar(r.total) || ' (' || r.payment_method::text || ')' || chr(10)
      || 'À faire : appeler le restaurant / un livreur, ou annuler depuis l''admin (Temps réel).';
    perform telegram_admin_envoyer(v_texte);
    update orders set alerte_coincee_le = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.alerter_commandes_coincees() from public, anon, authenticated;
revoke all on function public.poser_annulee_par() from public, anon, authenticated;

select cron.schedule('commandes-coincees', '*/5 * * * *', $$select public.alerter_commandes_coincees()$$);
