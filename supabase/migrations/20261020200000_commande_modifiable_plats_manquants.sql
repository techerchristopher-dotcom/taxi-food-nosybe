-- =============================================================================
-- Commande modifiable : le restaurant signale un plat manquant, le client choisit
-- (2026-10-20, lot 1).
--
-- Déclencheur : TF-442, La Cabane, 20/10 à 17 h 47. Abbas commande crêpe Nutella +
-- assiette de frites + 5 nuggets. Acceptée en 51 s depuis Telegram, puis annulée
-- 4 min plus tard (« plus de nuggets »). Deux plats sur trois étaient là ; la
-- commande entière est perdue, et le client (fidèle, 4e commande) n'a pas recommandé.
--
-- Ce que fait cette migration :
--   1. ÉTAT « à modifier » posé sur la commande (orders.modif_*), PAS un statut :
--      une valeur nouvelle de order_status ferait disparaître la commande des listes
--      des apps déjà installées (même raisonnement que « client injoignable »).
--   2. order_items.manquant_le : le restaurant coche les plats qu'il n'a plus.
--   3. Le plat coché passe en RUPTURE JUSQU'AU LENDEMAIN 5 h (heure de Nosy Be) :
--      products.rupture_jusqu_au + tâche pg_cron qui le remet en vente. Décision du
--      porteur du projet. Un plat déjà éteint à la main n'est pas touché (il ne
--      doit pas se rallumer tout seul le lendemain).
--   4. Le client choisit : RETIRER les plats manquants (la base recalcule tout :
--      plats, emballage, code promo, porte-monnaie, commission) ou ANNULER.
--      Retirer = la ligne est SUPPRIMÉE (copie dans modifications_commande) et non
--      marquée : une app restaurant pas encore à jour afficherait sinon encore le
--      plat retiré, et la cuisine le préparerait.
--      Retirer sur une commande encore « reçue » l'ACCEPTE : le restaurant a déjà
--      vérifié que tout le reste était là.
--   5. Le restaurant (ou l'admin) peut répondre à la place du client après l'avoir
--      eu au téléphone — c'est aussi le filet pour un client dont l'app n'est pas
--      encore à jour.
--   6. Pas de réponse en 5 min : alerte Telegram au restaurant (avec le numéro du
--      client) et à l'admin, 2e push au client. La base n'annule JAMAIS seule
--      (décision du porteur du projet).
--   7. Pendant l'attente : ni relance « sans réponse », ni appel vocal, ni passage
--      automatique en préparation ; « Accepter » et « Prête » sont refusés.
--
-- ⚠️ Commande déjà payée EN LIGNE (carte, Orange Money appli) : « retirer » est
-- refusé (le verrou orders_verrou_montants interdit de changer le total, et le
-- remboursement partiel est au lot 3). Le client peut annuler (remboursement
-- intégral automatique) ou le restaurant l'appelle.
-- =============================================================================

-- 1. Colonnes ---------------------------------------------------------------------
alter table public.orders
  add column if not exists modif_attente_depuis timestamptz,
  add column if not exists modif_signalee_le    timestamptz,
  add column if not exists modif_signalee_par   text,
  add column if not exists modif_resolue_le     timestamptz,
  add column if not exists modif_resolution     text,
  add column if not exists modif_resolue_par    text,
  add column if not exists modif_alerte_le      timestamptz;

alter table public.orders drop constraint if exists orders_modif_signalee_par_check;
alter table public.orders add constraint orders_modif_signalee_par_check
  check (modif_signalee_par is null or modif_signalee_par in ('restaurant', 'admin'));
alter table public.orders drop constraint if exists orders_modif_resolution_check;
alter table public.orders add constraint orders_modif_resolution_check
  check (modif_resolution is null or modif_resolution in ('retire', 'annule'));
alter table public.orders drop constraint if exists orders_modif_resolue_par_check;
alter table public.orders add constraint orders_modif_resolue_par_check
  check (modif_resolue_par is null or modif_resolue_par in ('client', 'restaurant', 'admin'));

comment on column public.orders.modif_attente_depuis is
  'Non nul = un plat manque, on attend le choix du client (retirer ou annuler). Etat, pas statut.';

alter table public.order_items add column if not exists manquant_le timestamptz;
comment on column public.order_items.manquant_le is
  'Le restaurant a signale ce plat comme manquant (commande modifiable, 2026-10-20).';

alter table public.products add column if not exists rupture_jusqu_au timestamptz;
comment on column public.products.rupture_jusqu_au is
  'Rupture posee par un plat manquant : le plat revient en vente tout seul a cette heure (lendemain 5 h).';

-- 2. Journal ------------------------------------------------------------------------
create table if not exists public.modifications_commande (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  cree_le    timestamptz not null default now(),
  action     text not null check (action in ('manquants_signales', 'lignes_retirees', 'commande_annulee')),
  par        text not null check (par in ('client', 'restaurant', 'admin')),
  auteur     uuid,
  lignes     jsonb not null default '[]'::jsonb,
  avant      jsonb,
  apres      jsonb
);
create index if not exists modifications_commande_order_idx on public.modifications_commande (order_id, cree_le);
alter table public.modifications_commande enable row level security;
revoke all on public.modifications_commande from public, anon, authenticated;

-- 3. Rupture jusqu'au lendemain -------------------------------------------------------
create or replace function public.lendemain_matin_nosy_be()
returns timestamptz language sql stable set search_path = public as $$
  select (((now() at time zone 'Indian/Antananarivo')::date + 1) + time '05:00')
         at time zone 'Indian/Antananarivo'
$$;

-- Remis en vente (à la main ou par la tâche) : la rupture programmée n'a plus d'objet.
create or replace function public.products_effacer_rupture_programmee()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_available and not old.is_available then
    new.rupture_jusqu_au := null;
  end if;
  return new;
end $$;
drop trigger if exists products_effacer_rupture on public.products;
create trigger products_effacer_rupture before update of is_available on public.products
  for each row execute function public.products_effacer_rupture_programmee();

create or replace function public.lever_ruptures_programmees()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.products set is_available = true
   where rupture_jusqu_au is not null and rupture_jusqu_au <= now() and not is_available;
  get diagnostics v_n = row_count;
  update public.products set rupture_jusqu_au = null
   where rupture_jusqu_au is not null and rupture_jusqu_au <= now();
  return v_n;
end $$;

-- 4. Briques ---------------------------------------------------------------------------
-- « 2× Nuggets × 5 (Sauce barbecue) » : une ligne lisible, options comprises.
create or replace function public.texte_ligne_commande(p_item_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select i.quantity || '× ' || i.product_name_snapshot
         || coalesce(' (' || (select string_agg(case when oo.quantity > 1 then oo.quantity || '× ' else '' end
                                                || oo.option_name_snapshot, ', ' order by oo.option_name_snapshot)
                                from public.order_item_options oo where oo.order_item_id = i.id) || ')', '')
    from public.order_items i where i.id = p_item_id
$$;

create or replace function public.commande_payee_en_ligne(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.payment_intents pi
                  where pi.order_id = p_order_id and pi.status not in ('echoue', 'annule'))
$$;

-- Lignes d'une commande pour les écrans (Telegram, page /a/) : id, texte, manquant.
create or replace function public.lignes_commande_json(p_order_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'texte', public.texte_ligne_commande(i.id),
           'precision', i.comment, 'manquant', i.manquant_le is not null)
         order by i.manquant_le nulls first, i.product_name_snapshot), '[]'::jsonb)
    from public.order_items i where i.order_id = p_order_id
$$;

-- 5. Recalcul après retrait des lignes manquantes ------------------------------------------
-- Même logique que admin_corriger_commande (code promo, porte-monnaie, part offerte),
-- mais AVANT la livraison : commission à la formule de create_order (la livraison la
-- refige), et la ligne est supprimée au lieu d'être marquée retirée.
create or replace function public.retirer_lignes_manquantes_core(p_order_id uuid, p_apercu boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  v_promo public.promo_codes;
  v_rate numeric;
  v_dplats integer; v_dpack integer;
  v_plats integer; v_pack integer; v_base integer;
  v_remise integer; v_resto integer; v_remise_plats integer;
  v_pm integer; v_rendu integer; v_commission integer; v_total integer;
  v_lignes jsonb;
  v_avant jsonb; v_apres jsonb;
begin
  if coalesce(p_apercu, true) then
    select * into o from public.orders where id = p_order_id;
  else
    select * into o from public.orders where id = p_order_id for update;
  end if;
  if o.id is null then raise exception 'modif:introuvable'; end if;

  select coalesce(-sum(i.quantity * i.unit_price), 0)::integer,
         coalesce(-sum(i.quantity * coalesce(i.packaging_fee_snapshot, 0)), 0)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'texte', public.texte_ligne_commande(i.id), 'product_id', i.product_id,
           'nom', i.product_name_snapshot, 'quantite', i.quantity, 'prix_unitaire', i.unit_price,
           'emballage', i.packaging_fee_snapshot, 'precision', i.comment,
           'options', (select coalesce(jsonb_agg(jsonb_build_object('option_id', oo.option_id,
                          'nom', oo.option_name_snapshot, 'delta', oo.price_delta_snapshot, 'quantite', oo.quantity)), '[]'::jsonb)
                         from public.order_item_options oo where oo.order_item_id = i.id))), '[]'::jsonb)
    into v_dplats, v_dpack, v_lignes
    from public.order_items i where i.order_id = o.id and i.manquant_le is not null;

  if jsonb_array_length(v_lignes) = 0 then raise exception 'modif:aucun_plat_manquant'; end if;
  if not exists (select 1 from public.order_items i where i.order_id = o.id and i.manquant_le is null) then
    raise exception 'modif:tout_manque';
  end if;

  v_plats := o.subtotal + v_dplats;
  v_pack  := coalesce(o.packaging_fee, 0) + v_dpack;
  if v_plats < 0 or v_pack < 0 then raise exception 'modif:montant_negatif'; end if;

  v_remise := coalesce(o.promo_discount, 0);
  v_resto  := coalesce(o.remise_charge_restaurant, 0);
  if v_remise > 0 and coalesce(o.promo_porte_sur, 'sous_total') <> 'livraison' then
    select * into v_promo from public.promo_codes where code_normalise = o.promo_code;
    if found then
      select coalesce(sum(case when not v_promo.exclut_boissons or not coalesce(c.est_boisson, false)
                               then i.quantity * i.unit_price else 0 end), 0)
           + case when v_promo.inclut_emballage
                  then coalesce(sum(case when not v_promo.exclut_boissons or not coalesce(c.est_boisson, false)
                                         then i.quantity * coalesce(i.packaging_fee_snapshot, 0) else 0 end), 0)
                  else 0 end
        into v_base
        from public.order_items i
        left join public.products pr on pr.id = i.product_id
        left join public.categories c on c.id = pr.category_id
       where i.order_id = o.id and i.manquant_le is null;
      v_remise := least(v_remise, public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base));
    else
      v_remise := least(v_remise, v_plats + v_pack);
    end if;
    v_resto := least(v_resto, v_remise);
  end if;
  v_remise := greatest(v_remise, 0);

  v_remise_plats := case when coalesce(o.promo_porte_sur, '') = 'livraison' then 0 else v_remise end;
  v_pm := least(coalesce(o.remise_porte_monnaie, 0), greatest(v_plats - v_remise_plats, 0));
  v_rendu := coalesce(o.remise_porte_monnaie, 0) - v_pm;

  select coalesce(o.commission_rate, r.commission_rate, 0) into v_rate
    from public.restaurants r where r.id = o.restaurant_id;
  v_commission := greatest(round((v_plats + v_pack - v_resto) * v_rate)::integer, 0);
  v_total := v_plats + v_pack + o.delivery_fee - v_remise - v_pm;

  v_avant := jsonb_build_object('plats', o.subtotal, 'emballage', coalesce(o.packaging_fee, 0),
    'remise', coalesce(o.promo_discount, 0), 'porte_monnaie', coalesce(o.remise_porte_monnaie, 0),
    'livraison', o.delivery_fee, 'total', o.total, 'commission', coalesce(o.commission_amount, 0));
  v_apres := jsonb_build_object('plats', v_plats, 'emballage', v_pack, 'remise', v_remise,
    'porte_monnaie', v_pm, 'livraison', o.delivery_fee, 'total', v_total, 'commission', v_commission,
    'porte_monnaie_rendu', v_rendu);

  if coalesce(p_apercu, true) then
    return jsonb_build_object('apercu', true, 'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes,
                              'payee_en_ligne', public.commande_payee_en_ligne(o.id));
  end if;

  if public.commande_payee_en_ligne(o.id) then raise exception 'modif:payee_en_ligne'; end if;

  delete from public.order_items where order_id = o.id and manquant_le is not null;

  update public.orders
     set subtotal = v_plats, packaging_fee = v_pack, promo_discount = v_remise,
         remise_charge_restaurant = v_resto, remise_porte_monnaie = v_pm,
         total = v_total, commission_amount = v_commission
   where id = o.id;

  if o.promo_code is not null and v_remise <> coalesce(o.promo_discount, 0) then
    update public.promo_redemptions set montant_remise = v_remise where order_id = o.id;
  end if;

  -- Part du porte-monnaie qui ne s'applique plus : rendue. « remboursement_annulation »
  -- et non « geste_admin » : porte_monnaie_annulation() fait la somme de ce motif, une
  -- annulation ultérieure ne rendra donc que le reste (jamais deux fois).
  if v_rendu > 0 and o.user_id is not null then
    insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id, note)
    values (o.user_id, v_rendu, 'remboursement_annulation', o.id,
            'Plat manquant retiré de ' || coalesce(o.order_number, 'la commande'));
  end if;

  return jsonb_build_object('apercu', false, 'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes);
end $$;

-- 6. Signaler les plats manquants -------------------------------------------------------------
create or replace function public.signaler_plats_manquants_core(
  p_order_id uuid, p_items uuid[], p_par text, p_auteur uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_o public.orders;
  v_nouveaux uuid[];
  v_nb_total integer; v_nb_manq integer;
  v_noms text;
  v_resto public.restaurants;
  v_client text; v_tel text;
  v_tel_cmd boolean;
begin
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'modif:introuvable'; end if;
  if not public.commande_annulable_par_restaurant(v_o) then raise exception 'modif:trop_tard'; end if;
  if public.commande_en_attente_de_paiement(v_o) then raise exception 'modif:non_payee'; end if;
  if p_items is null or cardinality(p_items) = 0 then raise exception 'modif:aucun_plat'; end if;
  if exists (select 1 from unnest(p_items) x
              where not exists (select 1 from public.order_items i where i.id = x and i.order_id = v_o.id)) then
    raise exception 'modif:plat_inconnu';
  end if;

  select count(*) into v_nb_total from public.order_items where order_id = v_o.id;
  select count(*) into v_nb_manq from public.order_items
   where order_id = v_o.id and (manquant_le is not null or id = any(p_items));
  if v_nb_manq >= v_nb_total then raise exception 'modif:tout_manque'; end if;

  select array_agg(i.id) into v_nouveaux from public.order_items i
   where i.order_id = v_o.id and i.id = any(p_items) and i.manquant_le is null;
  if v_nouveaux is null then
    return jsonb_build_object('ok', true, 'deja', true, 'numero', v_o.order_number);
  end if;

  update public.order_items set manquant_le = now() where id = any(v_nouveaux);

  -- Rupture jusqu'au lendemain matin, seulement pour un plat encore en vente.
  update public.products p set is_available = false, rupture_jusqu_au = public.lendemain_matin_nosy_be()
    from public.order_items i
   where i.id = any(v_nouveaux) and p.id = i.product_id and p.is_available;

  update public.orders
     set modif_attente_depuis = coalesce(modif_attente_depuis, now()),
         modif_signalee_le = now(), modif_signalee_par = p_par,
         modif_resolue_le = null, modif_resolution = null, modif_resolue_par = null,
         modif_alerte_le = null
   where id = v_o.id;

  insert into public.modifications_commande (order_id, action, par, auteur, lignes)
  select v_o.id, 'manquants_signales', p_par, p_auteur,
         jsonb_agg(jsonb_build_object('id', x, 'texte', public.texte_ligne_commande(x)))
    from unnest(v_nouveaux) x;

  select string_agg(public.texte_ligne_commande(i.id), ', ' order by i.product_name_snapshot) into v_noms
    from public.order_items i where i.order_id = v_o.id and i.manquant_le is not null;
  select * into v_resto from public.restaurants where id = v_o.restaurant_id;
  select coalesce(case when a.label like '☎ %' then btrim(substr(a.label, 3)) end, nullif(btrim(p.full_name), ''), 'Client'),
         coalesce(a.phone, p.phone)
    into v_client, v_tel
    from public.orders o left join public.profiles p on p.id = o.user_id
    left join public.addresses a on a.id = o.address_id where o.id = v_o.id;
  v_tel_cmd := exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id);

  if not v_tel_cmd then
    perform public.pousser_notification_commande(v_o.id, 'modification', jsonb_build_object('relance', 1));
    perform public.envoyer_email_client_commande(v_o.id,
      'Ta commande ' || v_o.order_number || ' : un plat manque',
      'Bonjour, ' || coalesce(v_resto.name, 'le restaurant') || ' n''a plus : ' || v_noms
        || '. Ouvre l''appli Taxi Food pour choisir : retirer ce plat et recevoir le reste de ta commande, '
        || 'ou tout annuler (tu n''as rien à payer). Merci !');
  end if;

  perform public.telegram_admin_envoyer('✏️ PLAT MANQUANT — ' || coalesce(v_resto.name, '?') || chr(10)
    || v_o.order_number || ' : manque ' || v_noms || chr(10)
    || 'Signalé par ' || case p_par when 'admin' then 'Taxi Food' else 'le restaurant' end || chr(10)
    || 'Client : ' || v_client || coalesce(' · ' || v_tel, '') || chr(10)
    || case when v_tel_cmd
         then '☎ Commande par téléphone : appelle le client, puis réponds pour lui dans l''app (onglet Commandes).'
         else 'Le client choisit dans l''appli : retirer le plat ou annuler. Alerte si pas de réponse en 5 min.' end);

  return jsonb_build_object('ok', true, 'numero', v_o.order_number, 'manquants', v_noms,
                            'client', v_client, 'telephone', v_tel);
end $$;

create or replace function public.signaler_plats_manquants(p_order_id uuid, p_items uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_rid uuid; v_par text;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select restaurant_id into v_rid from public.orders where id = p_order_id;
  if v_rid is null then raise exception 'modif:introuvable'; end if;
  if public.is_active_restaurant_staff_of(v_rid) then v_par := 'restaurant';
  elsif public.is_admin() then v_par := 'admin';
  else raise exception 'Acces refuse a cette commande'; end if;
  return public.signaler_plats_manquants_core(p_order_id, p_items, v_par, auth.uid());
end $$;

create or replace function public.signaler_manquants_par_jeton(p_order_id uuid, p_token uuid, p_items uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_jeton uuid; v_langue text; r jsonb;
begin
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;
  if v_jeton is null or v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;
  select rs.langue into v_langue from public.orders o join public.restaurants rs on rs.id = o.restaurant_id
   where o.id = p_order_id;
  begin
    r := public.signaler_plats_manquants_core(p_order_id, p_items, 'restaurant', null);
  exception when others then
    return jsonb_build_object('ok', false, 'raison', split_part(sqlerrm, ' ', 1), 'langue', coalesce(v_langue, 'fr'));
  end;
  return r || jsonb_build_object('langue', coalesce(v_langue, 'fr'));
end $$;

-- 7. Le choix : retirer ou annuler ------------------------------------------------------------
create or replace function public.resoudre_plats_manquants_core(
  p_order_id uuid, p_choix text, p_par text, p_auteur uuid, p_apercu boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_o public.orders;
  v_r jsonb;
  v_noms text;
  v_detail text;
  v_resto public.restaurants;
  v_it boolean;
  v_reste text;
  v_texte text;
  v_acceptee boolean := false;
  v_qui text;
begin
  if p_choix not in ('retirer', 'annuler') then raise exception 'modif:choix_inconnu'; end if;
  if coalesce(p_apercu, false) then
    select * into v_o from public.orders where id = p_order_id;
  else
    select * into v_o from public.orders where id = p_order_id for update;
  end if;
  if v_o.id is null then raise exception 'modif:introuvable'; end if;
  if v_o.modif_attente_depuis is null then raise exception 'modif:rien_en_attente'; end if;
  if not public.commande_annulable_par_restaurant(v_o) then raise exception 'modif:trop_tard'; end if;

  if p_choix = 'retirer' then
    if coalesce(p_apercu, false) then
      return public.retirer_lignes_manquantes_core(p_order_id, true);
    end if;
    select string_agg(public.texte_ligne_commande(i.id), ', ' order by i.product_name_snapshot) into v_noms
      from public.order_items i where i.order_id = v_o.id and i.manquant_le is not null;
    v_r := public.retirer_lignes_manquantes_core(p_order_id, false);

    update public.orders
       set modif_attente_depuis = null, modif_resolue_le = now(),
           modif_resolution = 'retire', modif_resolue_par = p_par
     where id = v_o.id;

    -- Le restaurant a déjà vérifié tout le reste : la commande est acceptée.
    if v_o.status = 'recue' then
      update public.orders set status = 'confirmee', status_updated_at = now() where id = v_o.id;
      v_acceptee := true;
    end if;

    insert into public.modifications_commande (order_id, action, par, auteur, lignes, avant, apres)
    values (v_o.id, 'lignes_retirees', p_par, p_auteur, v_r->'lignes', v_r->'avant', v_r->'apres');

    -- Récapitulatif au restaurant (Telegram), dans sa langue : la cuisine lit la NOUVELLE liste.
    select * into v_resto from public.restaurants where id = v_o.restaurant_id;
    v_it := v_resto.langue = 'it';
    select string_agg('• ' || public.texte_ligne_commande(i.id)
                      || coalesce(' — ✎ ' || i.comment, ''), chr(10) order by i.product_name_snapshot)
      into v_reste from public.order_items i where i.order_id = v_o.id;
    v_qui := case p_par when 'client' then (case when v_it then 'Il cliente ha tolto' else 'Le client a retiré' end)
                        else (case when v_it then 'Tolto (d''accordo con il cliente)' else 'Retiré (accord du client)' end) end;
    v_texte := case when v_it then '✏️ ORDINE MODIFICATO — ' else '✏️ COMMANDE MODIFIÉE — ' end
      || v_o.order_number || chr(10)
      || v_qui || ' : ' || v_noms || chr(10)
      || case when v_acceptee then
           case when v_it then
             case when v_resto.preparation_auto then '✅ Ordine accettato: passa in preparazione da solo.'
                  else '✅ Ordine accettato: mettetelo in preparazione.' end
           else
             case when v_resto.preparation_auto then '✅ Commande acceptée : elle passe en préparation toute seule.'
                  else '✅ Commande acceptée : lancez la préparation.' end
           end || chr(10) else '' end
      || (case when v_it then 'Da preparare:' else 'À préparer :' end) || chr(10) || coalesce(v_reste, '') || chr(10)
      || (case when v_it then 'Nuovo totale: ' else 'Nouveau total : ' end) || public.alerte_ar((v_r->'apres'->>'total')::integer);
    perform public.telegram_envoyer(v_resto.telegram_chat_id, v_texte);
    -- Push à l'autre partie : au restaurant si c'est le client qui a choisi, au client si
    -- c'est le restaurant (ou Taxi Food) qui a retiré le plat après l'avoir appelé.
    if p_par = 'client' then
      perform public.pousser_notification_commande(v_o.id, 'modification_retiree');
    elsif not exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then
      perform public.pousser_notification_commande(v_o.id, 'modification_faite');
    end if;
    perform public.telegram_admin_envoyer('✏️ ' || v_o.order_number || ' (' || coalesce(v_resto.name, '?') || ') — '
      || case p_par when 'client' then 'le client a retiré' when 'admin' then 'Taxi Food a retiré' else 'le restaurant a retiré (accord du client)' end
      || ' : ' || v_noms || chr(10)
      || 'Total : ' || public.alerte_ar(v_o.total) || ' → ' || public.alerte_ar((v_r->'apres'->>'total')::integer)
      || case when v_acceptee then chr(10) || 'Commande acceptée automatiquement.' else '' end);

    return jsonb_build_object('ok', true, 'choix', 'retirer', 'numero', v_o.order_number,
                              'acceptee', v_acceptee, 'total', (v_r->'apres'->>'total')::integer);
  end if;

  -- Annuler
  if coalesce(p_apercu, false) then
    return jsonb_build_object('apercu', true, 'choix', 'annuler');
  end if;
  select string_agg(i.product_name_snapshot, ', ' order by i.product_name_snapshot) into v_noms
    from public.order_items i where i.order_id = v_o.id and i.manquant_le is not null;
  v_detail := 'plus de ' || coalesce(v_noms, 'un plat');
  update public.orders
     set modif_attente_depuis = null, modif_resolue_le = now(),
         modif_resolution = 'annule', modif_resolue_par = p_par
   where id = v_o.id;
  update public.orders
     set status = 'annulee', status_updated_at = now(),
         cancellation_code = 'rupture',
         cancellation_detail = public.nettoyer_precision_refus(v_detail),
         cancellation_reason = public.composer_motif_refus('rupture', v_detail),
         annulee_par = case p_par when 'client' then 'client' when 'admin' then 'admin' else 'restaurant' end
   where id = v_o.id;
  insert into public.modifications_commande (order_id, action, par, auteur, lignes)
  values (v_o.id, 'commande_annulee', p_par, p_auteur, public.lignes_commande_json(v_o.id));
  select * into v_resto from public.restaurants where id = v_o.restaurant_id;
  perform public.telegram_admin_envoyer('❌ ' || v_o.order_number || ' (' || coalesce(v_resto.name, '?') || ') — '
    || case p_par when 'client' then 'le client a préféré annuler' when 'admin' then 'annulée par Taxi Food' else 'annulée par le restaurant (accord du client)' end
    || ' (manquait : ' || coalesce(v_noms, '?') || ')');
  return jsonb_build_object('ok', true, 'choix', 'annuler', 'numero', v_o.order_number);
end $$;

-- Le client (propriétaire), le restaurant (après un appel) ou l'admin.
create or replace function public.resoudre_plats_manquants(p_order_id uuid, p_choix text, p_apercu boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_o public.orders; v_par text;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_o from public.orders where id = p_order_id;
  if v_o.id is null then raise exception 'modif:introuvable'; end if;
  if v_o.user_id = auth.uid() then v_par := 'client';
  elsif public.is_active_restaurant_staff_of(v_o.restaurant_id) then v_par := 'restaurant';
  elsif public.is_admin() then v_par := 'admin';
  else raise exception 'Acces refuse a cette commande'; end if;
  return public.resoudre_plats_manquants_core(p_order_id, p_choix, v_par, auth.uid(), p_apercu);
end $$;

create or replace function public.resoudre_manquants_par_jeton(p_order_id uuid, p_token uuid, p_choix text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_jeton uuid; v_langue text; r jsonb;
begin
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;
  if v_jeton is null or v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;
  select rs.langue into v_langue from public.orders o join public.restaurants rs on rs.id = o.restaurant_id
   where o.id = p_order_id;
  begin
    r := public.resoudre_plats_manquants_core(p_order_id, p_choix, 'restaurant', null, false);
  exception when others then
    return jsonb_build_object('ok', false, 'raison', split_part(sqlerrm, ' ', 1), 'langue', coalesce(v_langue, 'fr'));
  end;
  return r || jsonb_build_object('langue', coalesce(v_langue, 'fr'));
end $$;

-- 8. Pas de réponse du client en 5 min : alerte (jamais d'annulation automatique) -----------------
create or replace function public.alerter_modifications_sans_reponse()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_n integer := 0; v_jeton text; v_it boolean; v_noms text;
  v_site constant text := 'https://taxifoodnosybe.distripro207.com';
begin
  for r in
    select o.id, o.order_number, o.user_id, rs.name as resto, rs.telegram_chat_id as chat, rs.langue,
           coalesce(case when a.label like '☎ %' then btrim(substr(a.label, 3)) end, nullif(btrim(p.full_name), ''), 'Client') as client,
           coalesce(a.phone, p.phone) as tel,
           exists (select 1 from public.commandes_telephone ct where ct.order_id = o.id) as par_tel
      from public.orders o
      join public.restaurants rs on rs.id = o.restaurant_id
      left join public.profiles p on p.id = o.user_id
      left join public.addresses a on a.id = o.address_id
     where o.modif_attente_depuis is not null
       and o.modif_attente_depuis <= now() - interval '5 minutes'
       and o.modif_alerte_le is null
       and o.status not in ('livree', 'annulee')
     for update of o skip locked
  loop
    update public.orders set modif_alerte_le = now() where id = r.id;
    select string_agg(public.texte_ligne_commande(i.id), ', ') into v_noms
      from public.order_items i where i.order_id = r.id and i.manquant_le is not null;
    if not r.par_tel then
      perform public.pousser_notification_commande(r.id, 'modification', jsonb_build_object('relance', 2));
    end if;
    v_it := r.langue = 'it';
    select j.jeton::text into v_jeton from public.order_accept_jetons j where j.order_id = r.id;
    perform public.telegram_envoyer(r.chat,
      case when v_it
        then '⏳ ' || r.order_number || ' — il cliente non ha ancora scelto (manca: ' || coalesce(v_noms, '?') || ').'
             || chr(10) || 'Chiamatelo: ' || coalesce(r.tel, 'numero non disponibile') || chr(10)
             || 'Poi indicate la sua scelta qui sotto: togliere il piatto o annullare.'
        else '⏳ ' || r.order_number || ' — le client n''a pas encore choisi (manque : ' || coalesce(v_noms, '?') || ').'
             || chr(10) || 'Appelez-le : ' || coalesce(r.tel, 'numéro non renseigné') || chr(10)
             || 'Puis indiquez son choix ci-dessous : retirer le plat ou annuler.' end,
      case when v_jeton is not null then jsonb_build_array(jsonb_build_array(jsonb_build_object(
        'text', case when v_it then '✏️ Rispondere per il cliente' else '✏️ Répondre pour le client' end,
        'url', v_site || '/a/' || r.id::text || '/' || v_jeton))) end);
    perform public.telegram_admin_envoyer('⏳ PLAT MANQUANT SANS RÉPONSE — ' || coalesce(r.resto, '?') || chr(10)
      || r.order_number || ' : le client n''a pas choisi depuis 5 min (manque : ' || coalesce(v_noms, '?') || ')' || chr(10)
      || 'Client : ' || r.client || coalesce(' · ' || r.tel, '') || chr(10)
      || 'Le restaurant a été prévenu. Rien n''est annulé automatiquement.');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- 9. Lecture par jeton (page Telegram /a/) : on y ajoute les lignes ------------------------------
create or replace function public.consulter_commande_par_jeton(p_order_id uuid, p_token uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_order public.orders; v_jeton uuid; v_langue text; v_resto text; v_tel text; v_client text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;
  if v_jeton is distinct from p_token then return jsonb_build_object('ok', false, 'raison', 'lien invalide'); end if;
  select langue, name into v_langue, v_resto from public.restaurants where id = v_order.restaurant_id;
  select coalesce(case when a.label like '☎ %' then btrim(substr(a.label, 3)) end, nullif(btrim(p.full_name), ''), 'Client'),
         coalesce(a.phone, p.phone)
    into v_client, v_tel
    from public.orders o left join public.profiles p on p.id = o.user_id
    left join public.addresses a on a.id = o.address_id where o.id = p_order_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number, 'statut', v_order.status::text, 'restaurant', v_resto,
    'langue', coalesce(v_langue, 'fr'), 'annulable', public.commande_annulable_par_restaurant(v_order),
    'recuperee', v_order.picked_up_at is not null,
    'lignes', public.lignes_commande_json(v_order.id),
    'attente_modif', v_order.modif_attente_depuis is not null,
    'payee_en_ligne', public.commande_payee_en_ligne(v_order.id),
    'client', v_client, 'telephone', v_tel, 'total', v_order.total);
end $$;

-- 10. Accepter / Prête refusés pendant l'attente -------------------------------------------------
create or replace function public.set_order_status(p_order_id uuid, p_new_status order_status, p_reason text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_precision text DEFAULT NULL::text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_order public.orders; v_current order_status; v_reason text; v_code text; v_detail text;
begin
  if auth.uid() is null then raise exception 'Non authentifie'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if not public.is_active_restaurant_staff_of(v_order.restaurant_id) then raise exception 'Acces refuse a cette commande'; end if;
  v_current := v_order.status;
  if v_current = 'en_preparation' and p_new_status = 'en_preparation' then return v_order; end if;
  -- Plat manquant signalé (2026-10-20) : on attend le choix du client. Seule l'annulation passe.
  if v_order.modif_attente_depuis is not null and p_new_status <> 'annulee' then
    raise exception 'En attente du client : il choisit de retirer le plat manquant ou d annuler. Appelle-le si besoin.';
  end if;
  if p_new_status = 'annulee' then
    if not public.commande_annulable_par_restaurant(v_order) then
      raise exception using message = case
        when v_current = 'en_livraison' then 'Le livreur a deja recupere cette commande : contacte Taxi Food pour l annuler'
        else 'Cette commande ne peut plus etre annulee (' || v_current || ')' end;
    end if;
  elsif not (
    (v_current = 'recue' and p_new_status = 'confirmee') or
    (v_current = 'confirmee' and p_new_status = 'en_preparation') or
    (v_current = 'en_preparation' and p_new_status = 'en_livraison') or
    (v_current = 'en_livraison' and p_new_status = 'en_preparation' and v_order.courier_id is null and v_order.picked_up_at is null)
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
      if v_reason is null then raise exception 'Motif de refus inconnu: %', v_code; end if;
      v_detail := public.nettoyer_precision_refus(p_precision);
    else
      v_reason := nullif(btrim(coalesce(p_reason, '')), '');
      if v_reason is null then raise exception 'Un motif est obligatoire pour refuser une commande'; end if;
    end if;
  end if;
  update public.orders
    set status = p_new_status, status_updated_at = now(),
        ready_at = case when v_current = 'en_livraison' and p_new_status = 'en_preparation' then null else ready_at end,
        cancellation_reason = case when p_new_status = 'annulee' then v_reason else cancellation_reason end,
        cancellation_code   = case when p_new_status = 'annulee' then v_code   else cancellation_code end,
        cancellation_detail = case when p_new_status = 'annulee' then v_detail else cancellation_detail end,
        annulee_par         = case when p_new_status = 'annulee' then 'restaurant' else annulee_par end,
        modif_attente_depuis = case when p_new_status = 'annulee' then null else modif_attente_depuis end
    where id = p_order_id returning * into v_order;
  return v_order;
end $function$;

create or replace function public.repondre_commande_par_jeton(p_order_id uuid, p_token uuid, p_action text, p_motif text DEFAULT NULL::text, p_code text DEFAULT NULL::text, p_precision text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_order public.orders; v_resto text; v_jeton uuid; v_auto boolean; v_langue text; v_code text; v_reason text; v_detail text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;
  if v_jeton is distinct from p_token then return jsonb_build_object('ok', false, 'raison', 'lien invalide'); end if;
  select langue into v_langue from public.restaurants where id = v_order.restaurant_id;
  if (p_action = 'accepter' and v_order.status <> 'recue')
     or (p_action = 'refuser' and not public.commande_annulable_par_restaurant(v_order)) then
    return jsonb_build_object('ok', false, 'raison', 'deja traitee', 'statut', v_order.status::text,
      'langue', coalesce(v_langue, 'fr'), 'recuperee', v_order.picked_up_at is not null);
  end if;
  -- Plat manquant signalé (2026-10-20) : pas d'acceptation tant que le client n'a pas choisi.
  if p_action = 'accepter' and v_order.modif_attente_depuis is not null then
    return jsonb_build_object('ok', false, 'raison', 'attente_client', 'langue', coalesce(v_langue, 'fr'));
  end if;
  if p_action = 'accepter' then
    update public.orders set status = 'confirmee', status_updated_at = now() where id = p_order_id returning * into v_order;
  elsif p_action = 'refuser' then
    v_code := nullif(btrim(coalesce(p_code, '')), '');
    if v_code is not null then
      v_reason := public.composer_motif_refus(v_code, p_precision);
      if v_reason is null then return jsonb_build_object('ok', false, 'raison', 'motif inconnu', 'langue', coalesce(v_langue, 'fr')); end if;
      v_detail := public.nettoyer_precision_refus(p_precision);
    else
      v_reason := nullif(btrim(coalesce(p_motif, '')), '');
      if v_reason is null then return jsonb_build_object('ok', false, 'raison', 'motif obligatoire'); end if;
    end if;
    update public.orders set status = 'annulee', status_updated_at = now(), cancellation_reason = v_reason,
           cancellation_code = v_code, cancellation_detail = v_detail, annulee_par = 'restaurant',
           modif_attente_depuis = null
     where id = p_order_id returning * into v_order;
  else
    return jsonb_build_object('ok', false, 'raison', 'action inconnue');
  end if;
  select name, preparation_auto into v_resto, v_auto from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number, 'statut', v_order.status::text, 'restaurant', v_resto,
    'lancement_prevu', case when v_order.lancement_prevu_a > now() then to_char(v_order.lancement_prevu_a at time zone 'Indian/Antananarivo', 'HH24:MI') end,
    'preparation_auto', coalesce(v_auto, false), 'langue', coalesce(v_langue, 'fr'), 'motif', v_order.cancellation_reason);
end $function$;

-- 11. Pas de relance « sans réponse », pas d'appel vocal, pas de préparation automatique ---------
-- Patchs par ANCRE (le reste du corps n'est pas réécrit) : chaque ancre doit exister une fois.
do $$
declare
  v text; a text; n integer;
  patchs text[][] := array[
    array['public.alerter_commandes_sans_reponse(integer)',
          'and not exists (select 1 from public.alertes_commande_sans_reponse a where a.order_id = o.id)',
          ' and o.modif_signalee_le is null'],
    array['public.appeler_restaurants_sans_reponse(integer)',
          'and not exists (select 1 from public.appels_restaurant a where a.order_id = o.id and not a.essai)',
          ' and o.modif_signalee_le is null'],
    array['public.passer_en_preparation_automatiquement()',
          'and not public.commande_en_attente_de_paiement(o)',
          ' and o.modif_attente_depuis is null']
  ];
  i integer;
begin
  for i in 1 .. array_length(patchs, 1) loop
    v := pg_get_functiondef(patchs[i][1]::regprocedure);
    a := patchs[i][2];
    if position(patchs[i][3] in v) > 0 then continue; end if; -- déjà appliqué
    n := (length(v) - length(replace(v, a, ''))) / length(a);
    if n <> 1 then raise exception 'Ancre trouvee % fois dans %', n, patchs[i][1]; end if;
    execute replace(v, a, a || patchs[i][3]);
  end loop;
end $$;

-- 12. Droits ---------------------------------------------------------------------------------------
revoke all on function public.retirer_lignes_manquantes_core(uuid, boolean) from public, anon, authenticated;
revoke all on function public.signaler_plats_manquants_core(uuid, uuid[], text, uuid) from public, anon, authenticated;
revoke all on function public.resoudre_plats_manquants_core(uuid, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.alerter_modifications_sans_reponse() from public, anon, authenticated;
revoke all on function public.lever_ruptures_programmees() from public, anon, authenticated;
revoke all on function public.texte_ligne_commande(uuid) from public, anon, authenticated;
revoke all on function public.lignes_commande_json(uuid) from public, anon, authenticated;
revoke all on function public.commande_payee_en_ligne(uuid) from public, anon, authenticated;
revoke all on function public.signaler_plats_manquants(uuid, uuid[]) from public, anon;
revoke all on function public.resoudre_plats_manquants(uuid, text, boolean) from public, anon;
grant execute on function public.signaler_plats_manquants(uuid, uuid[]) to authenticated;
grant execute on function public.resoudre_plats_manquants(uuid, text, boolean) to authenticated;
-- Pages Telegram (vitrine, clé publique) : l'autorisation est le jeton.
revoke all on function public.signaler_manquants_par_jeton(uuid, uuid, uuid[]) from public;
revoke all on function public.resoudre_manquants_par_jeton(uuid, uuid, text) from public;
grant execute on function public.signaler_manquants_par_jeton(uuid, uuid, uuid[]) to anon, authenticated;
grant execute on function public.resoudre_manquants_par_jeton(uuid, uuid, text) to anon, authenticated;

-- 13. Tâches -----------------------------------------------------------------------------------------
select cron.schedule('modifications-sans-reponse', '* * * * *', 'select public.alerter_modifications_sans_reponse()');
select cron.schedule('ruptures-programmees', '*/15 * * * *', 'select public.lever_ruptures_programmees()');
select cron.schedule('modifications-sans-reponse-purge-journal', '31 3 * * *', $$
  delete from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'modifications-sans-reponse')
     and end_time < now() - interval '2 days'$$);
