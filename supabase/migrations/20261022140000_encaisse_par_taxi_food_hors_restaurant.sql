-- =============================================================================
-- Ce que le client a payé et qui revient à TAXI FOOD, pas au restaurant (2026-10-22).
--
-- Déclencheur : TF-454 (L'escale Créole, 21/10). Le client a commandé un rôti de porc
-- avec « + Frites (+10 000 Ar) ». Le restaurant n'avait pas de frites : c'est le porteur
-- du projet qui les a fournies. Le client a payé 86 000 Ar par Orange Money, total juste.
-- Mais les 10 000 Ar des frites partaient dans le dû au restaurant, avec 7 % de commission.
--
-- La correction existante (`admin_corriger_commande`) savait baisser le prix d'une ligne
-- et recalculer commission et net — mais elle baissait AUSSI le total client. Ici le
-- client a payé l'ancien total : l'écart n'est pas un trop-perçu, il revient à Taxi Food.
--
-- Ce que fait cette migration :
--   1. orders.encaisse_taxifood (+ motif) : part du total client gardée par Taxi Food,
--      hors restaurant, hors commission. total = composantes + encaisse_taxifood.
--      Aucune formule du dû ne la lit : le dû se calcule sur `subtotal`, qui a baissé.
--   2. admin_corriger_commande gagne p_garder_total : le total client ne bouge pas,
--      l'écart va dans encaisse_taxifood. Refusé si le porte-monnaie devait être rendu
--      (les deux gestes se contrediraient) ou si le total devait monter.
--      ⚠️ Signature changée : l'ancienne est SUPPRIMÉE avant (piège PGRST203).
--   3. rapport_journalier : total_taxi_food compte encaisse_taxifood ; colonne ajoutée
--      en fin de vue. (rapport_service calcule déjà sa marge par total − dû.)
-- =============================================================================

alter table public.orders
  add column if not exists encaisse_taxifood integer not null default 0,
  add column if not exists encaisse_taxifood_motif text;

alter table public.orders drop constraint if exists orders_encaisse_taxifood_check;
alter table public.orders add constraint orders_encaisse_taxifood_check check (encaisse_taxifood >= 0);

comment on column public.orders.encaisse_taxifood is
  'Part du total payé par le client gardée par Taxi Food, hors restaurant et hors commission '
  '(ex. TF-454 : frites fournies par Taxi Food). total = plats + emballage + livraison − remises '
  '− porte-monnaie + encaisse_taxifood. Posée par admin_corriger_commande(p_garder_total => true).';

drop function if exists public.admin_corriger_commande(uuid, jsonb, text, boolean);

create function public.admin_corriger_commande(
  p_order_id uuid, p_lignes jsonb, p_motif text default null, p_apercu boolean default true,
  p_garder_total boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  o public.orders;
  v_rate numeric;
  v_motif text := btrim(regexp_replace(coalesce(p_motif, ''), '\s+', ' ', 'g'));
  v_garder boolean := coalesce(p_garder_total, false);
  v_l jsonb;
  v_it public.order_items;
  v_nq integer; v_np integer; v_ret boolean;
  v_dplats integer := 0; v_dpack integer := 0;
  v_nb_chg integer := 0;
  v_lignes jsonb := '[]'::jsonb;
  v_plats integer; v_pack integer; v_emb_tf integer;
  v_promo public.promo_codes;
  v_base integer; v_remise integer; v_resto integer; v_pm integer; v_rendu integer;
  v_remise_plats integer;
  v_commission integer; v_total integer; v_net_avant integer; v_net integer;
  v_encaisse integer; v_ecart integer;
  v_restantes integer;
  v_avant jsonb; v_apres jsonb;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;

  if coalesce(p_apercu, true) then
    select * into o from public.orders where id = p_order_id;
  else
    select * into o from public.orders where id = p_order_id for update;
  end if;
  if not found then raise exception 'correction:commande_introuvable'; end if;
  if o.status <> 'livree' then raise exception 'correction:non_livree — seule une commande livrée se corrige ici'; end if;
  if public.commande_reversee_bloque_correction(o.id) then
    raise exception 'correction:deja_reversee — % est déjà reversée, elle ne se corrige plus', o.order_number;
  end if;
  if exists (select 1 from public.payment_intents pi where pi.order_id = o.id and pi.status not in ('echoue', 'annule')) then
    raise exception 'correction:paiement_carte — un paiement carte est engagé sur %, passe par un remboursement', o.order_number;
  end if;
  if not coalesce(p_apercu, true) and length(v_motif) < 3 then
    raise exception 'correction:motif_obligatoire';
  end if;
  if jsonb_typeof(coalesce(p_lignes, 'null'::jsonb)) <> 'array' then
    raise exception 'correction:lignes_invalides';
  end if;

  select coalesce(o.commission_rate, r.commission_rate, 0) into v_rate
  from public.restaurants r where r.id = o.restaurant_id;

  for v_l in select * from jsonb_array_elements(p_lignes) loop
    select * into v_it from public.order_items where id = (v_l->>'id')::uuid and order_id = o.id;
    if not found then raise exception 'correction:ligne_inconnue %', v_l->>'id'; end if;
    if v_it.retire_le is not null then raise exception 'correction:deja_retiree — % est déjà retirée', v_it.product_name_snapshot; end if;
    if v_lignes @> jsonb_build_array(jsonb_build_object('id', v_it.id)) then
      raise exception 'correction:ligne_en_double';
    end if;
    v_ret := coalesce((v_l->>'retirer')::boolean, false);
    v_nq := coalesce((v_l->>'quantite')::integer, v_it.quantity);
    v_np := coalesce((v_l->>'prix_unitaire')::integer, v_it.unit_price);
    if not v_ret and v_nq < 1 then raise exception 'correction:quantite_invalide — % : au moins 1 (sinon retire la ligne)', v_it.product_name_snapshot; end if;
    if v_np < 0 then raise exception 'correction:prix_invalide — %', v_it.product_name_snapshot; end if;
    if not v_ret and v_nq = v_it.quantity and v_np = v_it.unit_price then continue; end if;

    if v_ret then
      v_dplats := v_dplats - v_it.quantity * v_it.unit_price;
      v_dpack  := v_dpack  - v_it.quantity * coalesce(v_it.packaging_fee_snapshot, 0);
    else
      v_dplats := v_dplats + v_nq * v_np - v_it.quantity * v_it.unit_price;
      v_dpack  := v_dpack  + (v_nq - v_it.quantity) * coalesce(v_it.packaging_fee_snapshot, 0);
    end if;
    v_nb_chg := v_nb_chg + 1;
    v_lignes := v_lignes || jsonb_build_array(jsonb_build_object(
      'id', v_it.id, 'nom', v_it.product_name_snapshot, 'retire', v_ret,
      'quantite_avant', v_it.quantity, 'quantite_apres', case when v_ret then 0 else v_nq end,
      'prix_avant', v_it.unit_price, 'prix_apres', case when v_ret then 0 else v_np end));
  end loop;

  if v_nb_chg = 0 then raise exception 'correction:aucun_changement'; end if;

  select count(*) into v_restantes from public.order_items i
  where i.order_id = o.id and i.retire_le is null
    and not exists (select 1 from jsonb_array_elements(v_lignes) x
                    where (x->>'id')::uuid = i.id and (x->>'retire')::boolean);
  if v_restantes = 0 then raise exception 'correction:tout_retire — retirer toutes les lignes revient à annuler la commande'; end if;

  v_plats := o.subtotal + v_dplats;
  v_pack  := coalesce(o.packaging_fee, 0) + v_dpack;
  if v_plats < 0 or v_pack < 0 then raise exception 'correction:montant_negatif'; end if;

  v_remise := coalesce(o.promo_discount, 0);
  v_resto  := coalesce(o.remise_charge_restaurant, 0);
  if v_remise > 0 and coalesce(o.promo_porte_sur, 'sous_total') <> 'livraison' then
    select * into v_promo from public.promo_codes where code_normalise = o.promo_code;
    if found then
      with l as (
        select i.id,
               case when x.id is null then i.quantity else (x.q)::integer end as q,
               case when x.id is null then i.unit_price else (x.p)::integer end as p,
               coalesce(i.packaging_fee_snapshot, 0) as pk,
               coalesce(c.est_boisson, false) as boisson,
               coalesce(x.r, false) as r
        from public.order_items i
        left join public.products pr on pr.id = i.product_id
        left join public.categories c on c.id = pr.category_id
        left join lateral (select (y->>'id')::uuid as id, y->>'quantite_apres' as q, y->>'prix_apres' as p,
                                  (y->>'retire')::boolean as r
                           from jsonb_array_elements(v_lignes) y where (y->>'id')::uuid = i.id) x on true
        where i.order_id = o.id and i.retire_le is null
      )
      select coalesce(sum(case when not v_promo.exclut_boissons or not boisson then q * p else 0 end), 0)
           + case when v_promo.inclut_emballage
                  then coalesce(sum(case when not v_promo.exclut_boissons or not boisson then q * pk else 0 end), 0)
                  else 0 end
        into v_base
      from l where not r;
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

  v_emb_tf := case when (select r.emballage_pour_taxifood from public.restaurants r where r.id = o.restaurant_id)
                   then v_pack else 0 end;
  -- Formule de mark_order_delivered, au taux figé sur la commande.
  v_commission := greatest(round((v_plats + v_pack - v_emb_tf - v_resto) * v_rate)::integer, 0);
  v_total := v_plats + v_pack + o.delivery_fee - v_remise - v_pm + coalesce(o.encaisse_taxifood, 0);
  v_encaisse := coalesce(o.encaisse_taxifood, 0);

  -- Le client a payé l'ancien total : l'écart revient à Taxi Food, pas au client.
  if v_garder then
    if v_rendu > 0 then
      raise exception 'correction:garder_total_porte_monnaie — le porte-monnaie du client devrait être rendu : garder le total n''a pas de sens ici';
    end if;
    v_ecart := o.total - v_total;
    if v_ecart < 0 then
      raise exception 'correction:garder_total_hausse — la correction fait MONTER le total : rien à garder pour Taxi Food';
    end if;
    v_encaisse := v_encaisse + v_ecart;
    v_total := o.total;
  end if;

  v_net_avant := o.subtotal + (coalesce(o.packaging_fee, 0) - coalesce(o.emballage_taxifood, 0))
               - coalesce(o.commission_amount, 0) - coalesce(o.remise_charge_restaurant, 0);
  v_net := v_plats + (v_pack - v_emb_tf) - v_commission - v_resto;

  v_avant := jsonb_build_object(
    'plats', o.subtotal, 'emballage', coalesce(o.packaging_fee, 0), 'montant', o.subtotal + coalesce(o.packaging_fee, 0),
    'commission', coalesce(o.commission_amount, 0), 'offert', coalesce(o.remise_charge_restaurant, 0),
    'remise', coalesce(o.promo_discount, 0), 'porte_monnaie', coalesce(o.remise_porte_monnaie, 0),
    'livraison', o.delivery_fee, 'encaisse_taxifood', coalesce(o.encaisse_taxifood, 0),
    'total', o.total, 'net', v_net_avant);
  v_apres := jsonb_build_object(
    'plats', v_plats, 'emballage', v_pack, 'montant', v_plats + v_pack,
    'commission', v_commission, 'offert', v_resto,
    'remise', v_remise, 'porte_monnaie', v_pm,
    'livraison', o.delivery_fee, 'encaisse_taxifood', v_encaisse,
    'total', v_total, 'net', v_net,
    'porte_monnaie_rendu', v_rendu);

  if coalesce(p_apercu, true) then
    return jsonb_build_object('apercu', true, 'commande', o.order_number, 'taux', v_rate, 'garder_total', v_garder,
                              'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes);
  end if;

  update public.order_items i
     set quantite_origine = coalesce(i.quantite_origine, i.quantity),
         prix_unitaire_origine = coalesce(i.prix_unitaire_origine, i.unit_price),
         retire_le = case when (x->>'retire')::boolean then now() else i.retire_le end,
         retire_motif = case when (x->>'retire')::boolean then v_motif else i.retire_motif end,
         quantity = case when (x->>'retire')::boolean then i.quantity else (x->>'quantite_apres')::integer end,
         unit_price = case when (x->>'retire')::boolean then i.unit_price else (x->>'prix_apres')::integer end,
         corrige_le = case when (x->>'retire')::boolean then i.corrige_le else now() end,
         corrige_motif = case when (x->>'retire')::boolean then i.corrige_motif else v_motif end
    from jsonb_array_elements(v_lignes) x
   where i.id = (x->>'id')::uuid;

  insert into public.corrections_commande (order_id, order_item_id, admin_id, motif, retire,
                                           quantite_avant, quantite_apres, prix_avant, prix_apres)
  select o.id, (x->>'id')::uuid, auth.uid(), v_motif, (x->>'retire')::boolean,
         (x->>'quantite_avant')::integer, (x->>'quantite_apres')::integer,
         (x->>'prix_avant')::integer, (x->>'prix_apres')::integer
  from jsonb_array_elements(v_lignes) x;

  update public.orders
     set subtotal = v_plats,
         packaging_fee = v_pack,
         promo_discount = v_remise,
         remise_charge_restaurant = v_resto,
         remise_porte_monnaie = v_pm,
         total = v_total,
         commission_amount = v_commission,
         encaisse_taxifood = v_encaisse,
         encaisse_taxifood_motif = case when v_garder and v_encaisse > coalesce(o.encaisse_taxifood, 0)
                                        then btrim(coalesce(o.encaisse_taxifood_motif || ' ; ', '') || v_motif)
                                        else o.encaisse_taxifood_motif end
   where id = o.id;

  if o.promo_code is not null and v_remise <> coalesce(o.promo_discount, 0) then
    update public.promo_redemptions set montant_remise = v_remise where order_id = o.id;
  end if;

  if v_rendu > 0 and o.user_id is not null then
    insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id, note, cree_par)
    values (o.user_id, v_rendu, 'geste_admin', o.id,
            'Correction de ' || coalesce(o.order_number, 'la commande') || ' : part du porte-monnaie rendue (' || v_motif || ')',
            auth.uid());
  end if;

  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  values (auth.uid(), 'correction_commande', o.id, o.restaurant_id,
          (v_avant || jsonb_build_object('lignes', v_lignes))::text,
          (v_apres || jsonb_build_object('garder_total', v_garder))::text, v_motif);

  return jsonb_build_object('apercu', false, 'commande', o.order_number, 'taux', v_rate, 'garder_total', v_garder,
                            'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes);
end $function$;

revoke all on function public.admin_corriger_commande(uuid, jsonb, text, boolean, boolean) from public, anon;
grant execute on function public.admin_corriger_commande(uuid, jsonb, text, boolean, boolean) to authenticated;

-- rapport_journalier : ce que Taxi Food garde inclut désormais encaisse_taxifood.
create or replace view public.rapport_journalier as
 SELECT ((o.created_at AT TIME ZONE 'Indian/Antananarivo'::text))::date AS jour,
    r.id AS restaurant_id,
    r.name AS restaurant,
    count(*) AS commandes,
    sum(o.subtotal) AS ca_marchandise,
    sum(o.commission_amount) AS commission_taxi_food,
    sum(((o.subtotal - o.commission_amount) - o.remise_charge_restaurant)) AS a_reverser_au_restaurant,
    sum((o.delivery_fee -
        CASE
            WHEN (o.promo_porte_sur = 'livraison'::text) THEN COALESCE(o.promo_discount, 0)
            ELSE 0
        END)) AS livraisons_taxi_food,
    sum((((((o.commission_amount + o.delivery_fee) - COALESCE(o.promo_discount, 0)) + o.remise_charge_restaurant) - o.remise_porte_monnaie) + o.encaisse_taxifood)) AS total_taxi_food,
    COALESCE(sum(o.total) FILTER (WHERE (o.payment_method = 'especes'::payment_method)), (0)::bigint) AS encaisse_par_les_livreurs,
    COALESCE(sum(GREATEST((o.total - rb.rendu_ar), 0)) FILTER (WHERE ((o.payment_method = 'cb'::payment_method) AND (o.payment_status = ANY (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status])))), (0)::bigint) AS encaisse_par_stripe,
    COALESCE(sum(o.total) FILTER (WHERE ((o.payment_method = 'cb'::payment_method) AND (o.payment_status <> ALL (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status])))), (0)::bigint) AS carte_non_encaissee,
    COALESCE(sum(o.total) FILTER (WHERE (o.payment_method = 'orange_money'::payment_method)), (0)::bigint) AS encaisse_hors_app,
    sum(o.packaging_fee) AS emballage_a_arbitrer,
    sum(o.total) AS facture_aux_clients,
    COALESCE(sum(rb.rendu_ar), (0)::bigint) AS rembourse_par_stripe,
    count(*) FILTER (WHERE (rb.rendu_ar > 0)) AS commandes_remboursees,
    sum(o.remise_porte_monnaie) AS remise_porte_monnaie,
    sum(o.encaisse_taxifood) AS encaisse_taxifood
   FROM ((orders o
     JOIN restaurants r ON ((r.id = o.restaurant_id)))
     LEFT JOIN LATERAL ( SELECT (COALESCE(sum(pr.amount_ar), (0)::bigint))::integer AS rendu_ar
           FROM payment_refunds pr
          WHERE ((pr.order_id = o.id) AND (pr.status = 'effectue'::payment_refund_status))) rb ON (true))
  WHERE (o.status = 'livree'::order_status)
  GROUP BY (((o.created_at AT TIME ZONE 'Indian/Antananarivo'::text))::date), r.id, r.name;
