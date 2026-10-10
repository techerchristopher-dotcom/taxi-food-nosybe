-- Corriger une commande « À reverser » (2026-10-10, demande du porteur du projet).
--
-- Cas d'origine : TF-377 (La Cabane) — 4 World Cola facturés, jamais livrés. Il fallait pouvoir
-- RETIRER une ligne, ou en changer la quantité ou le prix unitaire, AVANT de reverser le
-- restaurant, sans rien effacer.
--
-- - Rien n'est supprimé : une ligne retirée garde sa quantité et son prix, et porte `retire_le`
--   + `retire_motif`. Une ligne modifiée garde son origine dans `quantite_origine` /
--   `prix_unitaire_origine` (posées à la PREMIÈRE correction, jamais réécrites).
-- - Journal ligne par ligne dans `corrections_commande` (RLS sans policy, aucun droit) et
--   journal global dans `admin_actions` (action `correction_commande`, avant / après / motif).
-- - UNE RPC, `admin_corriger_commande(order, lignes, motif, apercu)`, sert l'aperçu ET
--   l'enregistrement : même calcul, l'écran n'en refait aucun.
-- - Recalcul complet, dans la même transaction : plats, emballage, remises, commission, total
--   client (il BAISSE : la caisse du livreur doit tomber juste), et net au restaurant.
-- - Calcul en DELTA sur les montants figés de la commande (plats = ancien sous-total + Δ des
--   lignes touchées) : une commande ancienne dont les lignes ne retombent pas exactement sur
--   son sous-total ne voit pas cet écart réécrit en silence.
--
-- Règle des remises quand les plats baissent (aucune ne dépasse ce qui reste, aucune n'augmente) :
-- - code sur la LIVRAISON : inchangé (la livraison ne bouge pas) ;
-- - code sur les PLATS : recalculé par `remise_promo` sur la nouvelle base, exactement comme
--   `create_order` (boissons exclues / emballage inclus selon le code), plafonné à l'ancienne
--   remise ; code introuvable → plafonné à plats + emballage restants ;
-- - part offerte par le restaurant : = nouvelle remise si le code était à sa charge, sinon 0 ;
-- - porte-monnaie : plafonné à ce qui reste des plats après le code ; la différence est RENDUE
--   au client (mouvement `geste_admin` rattaché à la commande, note explicite).
-- - commission = max(round((plats + emballage − part offerte) × taux figé), 0) — la formule de
--   `create_order` (taux de la commande, à défaut celui du restaurant).
--
-- Refus : commande non livrée, commande DÉJÀ reversée (`commande_reversee_bloque_correction`,
-- redéfinie au chantier 3 pour laisser corriger une commande « réglée à la commande »), paiement
-- carte engagé (le trigger `verrouiller_montants_commande_payee` refuserait de toute façon).
--
-- Aucune notification : aucun trigger de notification n'écoute subtotal / total / order_items
-- (`orders_notify_status` : status, picked_up_at, payment_*, arriving_at, arrived_at, courier_id).

alter table public.order_items
  add column if not exists quantite_origine integer,
  add column if not exists prix_unitaire_origine integer,
  add column if not exists retire_le timestamptz,
  add column if not exists retire_motif text,
  add column if not exists corrige_le timestamptz,
  add column if not exists corrige_motif text;

do $$ begin
  alter table public.order_items add constraint order_items_retrait_motive
    check (retire_le is null or (retire_motif is not null and btrim(retire_motif) <> ''));
exception when duplicate_object then null; end $$;

create table if not exists public.corrections_commande (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  admin_id uuid,
  motif text not null,
  retire boolean not null default false,
  quantite_avant integer not null,
  quantite_apres integer not null,
  prix_avant integer not null,
  prix_apres integer not null,
  created_at timestamptz not null default now()
);
create index if not exists corrections_commande_order_idx on public.corrections_commande (order_id);
alter table public.corrections_commande enable row level security;
revoke all on public.corrections_commande from public, anon, authenticated;

-- Une commande déjà reversée ne se corrige plus. Redéfinie au chantier 3.
create or replace function public.commande_reversee_bloque_correction(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.settlement_orders so where so.order_id = p_order_id)
$$;
revoke all on function public.commande_reversee_bloque_correction(uuid) from public, anon, authenticated;

create or replace function public.admin_corriger_commande(
  p_order_id uuid, p_lignes jsonb, p_motif text default null, p_apercu boolean default true)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  o public.orders;
  v_rate numeric;
  v_motif text := btrim(regexp_replace(coalesce(p_motif, ''), '\s+', ' ', 'g'));
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

  -- Les lignes demandées, une à une.
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

  -- Il doit rester au moins une ligne : sinon c'est une annulation, pas une correction.
  select count(*) into v_restantes from public.order_items i
  where i.order_id = o.id and i.retire_le is null
    and not exists (select 1 from jsonb_array_elements(v_lignes) x
                    where (x->>'id')::uuid = i.id and (x->>'retire')::boolean);
  if v_restantes = 0 then raise exception 'correction:tout_retire — retirer toutes les lignes revient à annuler la commande'; end if;

  v_plats := o.subtotal + v_dplats;
  v_pack  := coalesce(o.packaging_fee, 0) + v_dpack;
  if v_plats < 0 or v_pack < 0 then raise exception 'correction:montant_negatif'; end if;

  -- Remises.
  v_remise := coalesce(o.promo_discount, 0);
  v_resto  := coalesce(o.remise_charge_restaurant, 0);
  if v_remise > 0 and coalesce(o.promo_porte_sur, 'sous_total') <> 'livraison' then
    select * into v_promo from public.promo_codes where code_normalise = o.promo_code;
    if found then
      -- La base de `create_order`, sur les lignes RESTANTES avec leurs nouvelles valeurs.
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

  v_commission := greatest(round((v_plats + v_pack - v_resto) * v_rate)::integer, 0);
  v_total := v_plats + v_pack + o.delivery_fee - v_remise - v_pm;
  -- emballage_taxifood suit packaging_fee (trigger `figer_emballage_taxifood`) : même règle ici.
  v_emb_tf := case when (select r.emballage_pour_taxifood from public.restaurants r where r.id = o.restaurant_id)
                   then v_pack else 0 end;
  v_net_avant := o.subtotal + (coalesce(o.packaging_fee, 0) - coalesce(o.emballage_taxifood, 0))
               - coalesce(o.commission_amount, 0) - coalesce(o.remise_charge_restaurant, 0);
  v_net := v_plats + (v_pack - v_emb_tf) - v_commission - v_resto;

  v_avant := jsonb_build_object(
    'plats', o.subtotal, 'emballage', coalesce(o.packaging_fee, 0), 'montant', o.subtotal + coalesce(o.packaging_fee, 0),
    'commission', coalesce(o.commission_amount, 0), 'offert', coalesce(o.remise_charge_restaurant, 0),
    'remise', coalesce(o.promo_discount, 0), 'porte_monnaie', coalesce(o.remise_porte_monnaie, 0),
    'livraison', o.delivery_fee, 'total', o.total, 'net', v_net_avant);
  v_apres := jsonb_build_object(
    'plats', v_plats, 'emballage', v_pack, 'montant', v_plats + v_pack,
    'commission', v_commission, 'offert', v_resto,
    'remise', v_remise, 'porte_monnaie', v_pm,
    'livraison', o.delivery_fee, 'total', v_total, 'net', v_net,
    'porte_monnaie_rendu', v_rendu);

  if coalesce(p_apercu, true) then
    return jsonb_build_object('apercu', true, 'commande', o.order_number, 'taux', v_rate,
                              'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes);
  end if;

  -- Écriture.
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
         commission_amount = v_commission
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
          (v_avant || jsonb_build_object('lignes', v_lignes))::text, v_apres::text, v_motif);

  return jsonb_build_object('apercu', false, 'commande', o.order_number, 'taux', v_rate,
                            'avant', v_avant, 'apres', v_apres, 'lignes', v_lignes);
end $$;

revoke all on function public.admin_corriger_commande(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.admin_corriger_commande(uuid, jsonb, text, boolean) to authenticated;
