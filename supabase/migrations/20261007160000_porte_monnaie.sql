-- Porte-monnaie en ariary (décision du porteur du projet, 2026-10-07).
--
-- Remplace le code « AVIS<PRENOM> » (2 000 Ar sur la livraison, à retaper à la main :
-- 3 codes sur 5 jamais utilisés) par un solde :
--   * chaque avis déposé crédite 1 000 Ar, quelle que soit la note, sans expiration ;
--   * au paiement, le client choisit d'utiliser son solde (bascule) : remise =
--     min(solde, plats restants après un éventuel code portant sur les plats) —
--     jamais sur la livraison ni l'emballage ;
--   * une commande annulée / refusée rend ce qu'elle avait pris (et le reprend si
--     elle sort de l'annulation, à l'image de `liberer_code_promo_annulation`) ;
--   * c'est TAXI FOOD qui finance : la remise n'entre ni dans
--     `remise_charge_restaurant` ni dans la base de commission — le restaurant est
--     reversé du prix plein de ses plats.
--
-- Rétrocompatibilité :
--   * `create_order` 5 arguments → remplacée par une 6-arguments dont le dernier,
--     `p_utiliser_porte_monnaie`, vaut false par défaut. DROP + CREATE (jamais un
--     `create or replace` à signature plus longue : surcharge → PGRST203). Les apps
--     en magasin envoient 5 clés nommées : PostgREST les résout sur cette fonction.
--     L'enveloppe à 4 arguments (`payment_method`) appelle la 5-positions : résolue
--     au même endroit, par défaut false.
--   * `deposer_avis` garde sa signature et renvoie toujours `code`, `valeur`,
--     `expire_le` (l'ancienne app les lit) : `code = null`, et l'ancien écran
--     masque simplement l'encart du code.

-- ------------------------------------------------------------------ registre
create table if not exists public.porte_monnaie_mouvements (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  montant       integer not null check (montant <> 0),
  motif         text not null check (motif in (
                  'avis',                      -- +1 000 par avis déposé
                  'utilisation',               -- débit à la création d'une commande
                  'remboursement_annulation',  -- la commande annulée rend ce qu'elle a pris
                  'annulation_levee',          -- la commande sort de l'annulation : on reprend
                  'reprise_code_avis',         -- conversion d'un ancien code AVIS non utilisé
                  'geste_admin')),             -- crédit / débit manuel, motif obligatoire
  order_id      uuid references public.orders (id) on delete set null,
  avis_id       uuid references public.avis (id) on delete set null,
  code_promo_id uuid references public.promo_codes (id) on delete set null,
  note          text,
  cree_par      uuid,
  created_at    timestamptz not null default now(),
  -- Le signe suit le motif : un avis ne peut pas débiter, une utilisation ne peut pas créditer.
  constraint porte_monnaie_signe check (
    (motif in ('avis', 'remboursement_annulation', 'reprise_code_avis') and montant > 0)
    or (motif in ('utilisation', 'annulation_levee') and montant < 0)
    or (motif = 'geste_admin' and note is not null and btrim(note) <> '')),
  constraint porte_monnaie_rattachement check (
    (motif = 'avis' and avis_id is not null)
    or (motif in ('utilisation', 'remboursement_annulation', 'annulation_levee') and order_id is not null)
    or (motif = 'reprise_code_avis' and code_promo_id is not null)
    or motif = 'geste_admin')
);

comment on table public.porte_monnaie_mouvements is
  'Porte-monnaie client en ariary (2026-10-07). Solde = somme des montants. Écriture par RPC security definer seulement.';

-- Idempotence : la base refuse le doublon, pas un select suivi d'un insert.
create unique index if not exists porte_monnaie_un_credit_par_avis
  on public.porte_monnaie_mouvements (avis_id) where motif = 'avis';
create unique index if not exists porte_monnaie_un_debit_par_commande
  on public.porte_monnaie_mouvements (order_id) where motif = 'utilisation';
create unique index if not exists porte_monnaie_une_reprise_par_code
  on public.porte_monnaie_mouvements (code_promo_id) where motif = 'reprise_code_avis';
create index if not exists porte_monnaie_par_client
  on public.porte_monnaie_mouvements (user_id, created_at desc);
create index if not exists porte_monnaie_par_commande
  on public.porte_monnaie_mouvements (order_id) where order_id is not null;

alter table public.porte_monnaie_mouvements enable row level security;
revoke all on public.porte_monnaie_mouvements from public, anon, authenticated;
grant select on public.porte_monnaie_mouvements to authenticated;
drop policy if exists porte_monnaie_lecture_mes_mouvements on public.porte_monnaie_mouvements;
create policy porte_monnaie_lecture_mes_mouvements on public.porte_monnaie_mouvements
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists porte_monnaie_lecture_admin on public.porte_monnaie_mouvements;
create policy porte_monnaie_lecture_admin on public.porte_monnaie_mouvements
  for select to authenticated
  using (public.is_admin());

-- ------------------------------------------------------- colonne sur orders
alter table public.orders
  add column if not exists remise_porte_monnaie integer not null default 0;
do $$ begin
  alter table public.orders add constraint orders_remise_porte_monnaie_positive
    check (remise_porte_monnaie >= 0);
exception when duplicate_object then null; end $$;
comment on column public.orders.remise_porte_monnaie is
  'Part du total payée par le porte-monnaie du client (déjà déduite de total). Financée par Taxi Food : hors commission, hors remise_charge_restaurant.';

-- ------------------------------------------------------------------- solde
create or replace function public.solde_porte_monnaie(p_user uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(montant), 0)::integer
    from public.porte_monnaie_mouvements
   where user_id = p_user;
$$;
revoke all on function public.solde_porte_monnaie(uuid) from public, anon, authenticated;

/** Ce que le porte-monnaie peut couvrir : jamais plus que les plats restants. */
create or replace function public.remise_porte_monnaie_calcul(p_solde integer, p_plats integer, p_remise_code_plats integer)
returns integer
language sql
immutable
set search_path to 'public'
as $$
  select greatest(0, least(coalesce(p_solde, 0),
                           coalesce(p_plats, 0) - coalesce(p_remise_code_plats, 0)));
$$;

-- Le client : son solde et son historique.
create or replace function public.mon_porte_monnaie()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('solde', 0, 'mouvements', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'solde', public.solde_porte_monnaie(v_uid),
    'mouvements', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id,
               'montant', m.montant,
               'motif', m.motif,
               'commande', o.order_number,
               'restaurant', r.name,
               'created_at', m.created_at)
             order by m.created_at desc)
        from (select * from public.porte_monnaie_mouvements
               where user_id = v_uid
               order by created_at desc
               limit 100) m
        left join public.orders o on o.id = m.order_id
        left join public.restaurants r on r.id = o.restaurant_id), '[]'::jsonb));
end $$;
revoke all on function public.mon_porte_monnaie() from public, anon;
grant execute on function public.mon_porte_monnaie() to authenticated;

-- Aperçu au récapitulatif : même calcul que create_order, rien n'est débité.
create or replace function public.apercu_porte_monnaie(p_restaurant_id uuid, p_items jsonb, p_code_promo text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid    uuid := auth.uid();
  v_solde  integer;
  v_plats  integer := 0;
  v_code   jsonb;
  v_remise_code_plats integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('solde', 0, 'plats', 0, 'remise', 0);
  end if;
  v_solde := public.solde_porte_monnaie(v_uid);

  -- Sous-total des articles, prix relus en base (même requête que apercu_code_promo).
  select coalesce(sum((p.price + coalesce(o.delta, 0)) * q.qty), 0)
    into v_plats
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) as it
    cross join lateral (select greatest(coalesce((it->>'quantity')::integer, 0), 0) as qty) q
    join public.products p
      on p.id = (it->>'product_id')::uuid
     and p.restaurant_id = p_restaurant_id
     and p.is_available
    left join lateral (
      select sum(po.price_delta * greatest(coalesce((opt->>'quantity')::integer, 1), 1)) as delta
        from jsonb_array_elements(case when jsonb_typeof(it->'options') = 'array' then it->'options' else '[]'::jsonb end) as opt
        join public.product_options po on po.id = (opt->>'option_id')::uuid
        join public.product_option_groups pog on pog.id = po.group_id
       where pog.product_id = p.id and po.is_available
    ) o on true;

  if p_code_promo is not null and btrim(p_code_promo) <> '' then
    v_code := public.apercu_code_promo(p_code_promo, p_restaurant_id, p_items);
    if coalesce((v_code->>'valide')::boolean, false) and v_code->>'porte_sur' <> 'livraison' then
      v_remise_code_plats := coalesce((v_code->>'remise')::integer, 0);
    end if;
  end if;

  return jsonb_build_object(
    'solde', v_solde,
    'plats', v_plats,
    'remise_code_plats', v_remise_code_plats,
    'remise', public.remise_porte_monnaie_calcul(v_solde, v_plats, v_remise_code_plats));
end $$;
revoke all on function public.apercu_porte_monnaie(uuid, jsonb, text) from public, anon;
grant execute on function public.apercu_porte_monnaie(uuid, jsonb, text) to authenticated;

-- --------------------------------------------------------------- create_order
-- DROP + CREATE : une signature plus longue en `create or replace` AJOUTE une
-- surcharge (PGRST203, incident du 2026-09-05). Le corps est celui en production
-- au 2026-10-07, plus le bloc « porte-monnaie » et la remise dans le total.
drop function if exists public.create_order(uuid, uuid, text, jsonb, text);

create function public.create_order(p_restaurant_id uuid, p_address_id uuid, p_payment_method text, p_items jsonb, p_code_promo text, p_utiliser_porte_monnaie boolean default false)
 returns orders
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order       public.orders;
  v_subtotal    integer := 0;
  v_packaging   integer := 0;
  v_subtotal_hors_boissons  integer := 0;
  v_packaging_hors_boissons integer := 0;
  v_delivery_fee integer;
  v_commission_rate numeric;
  v_item        jsonb;
  v_item_options jsonb;
  v_product     public.products;
  v_item_id     uuid;
  v_unit_price  integer;
  v_options_delta integer;
  v_options_count integer;
  v_valid_options_count integer;
  v_group       public.product_option_groups%rowtype;
  v_group_selected_count integer;
  v_address     public.addresses%rowtype;
  v_qty         integer;
  v_promo       public.promo_codes;
  v_promo_n     integer := 0;
  v_remise      integer := 0;
  v_remise_resto integer := 0;
  v_raison      text;
  v_base        integer;
  v_code_applique text := null;
  v_resto       public.restaurants;
  v_categorie   public.categories;
  v_remise_pm   integer := 0;
  v_solde_pm    integer;
begin
  select * into v_resto from public.restaurants where id = p_restaurant_id;
  if v_resto.id is null then
    raise exception 'Restaurant introuvable';
  end if;
  v_commission_rate := coalesce(v_resto.commission_rate, 0);

  -- GARDE D'OUVERTURE. Elle manquait : sur un restaurant ferme, une commande
  -- passait sans un mot (verifie le 2026-09-07 en transaction annulee, TF-107 a
  -- 19 000 Ar). Le restaurant recevait son message Telegram avec ses boutons,
  -- sans personne en cuisine. L'ecran ne grisait rien, contrairement a ce qui etait ecrit ici — il n'est pas
  -- l'autorite, il n'empeche pas un appel direct a l'API avec la cle anon.
  if not public.commandable_maintenant(v_resto) then
    raise exception 'service:restaurant_ferme' using errcode = '22023';
  end if;

  select * into v_address from public.addresses
    where id = p_address_id and user_id = auth.uid();

  if v_address.id is null then
    raise exception 'Adresse de livraison introuvable : choisis une adresse dans la liste';
  end if;
  -- Commande saisie par telephone depuis l'admin : GPS facultatif. Drapeau de
  -- transaction ET administrateur, les deux (voir migration 20260917170000).
  if (v_address.latitude is null or v_address.longitude is null)
     and not (coalesce(current_setting('taxifood.commande_telephone', true), '') = 'on'
              and public.is_admin()) then
    raise exception 'Position GPS manquante sur cette adresse : la localisation est obligatoire pour valider une commande';
  end if;

  -- LIVRAISON AU KILOMETRE. Calculee ici, jamais transmise par le client.
  -- Repli sur le tarif de base (10 000 Ar) si la distance n'est pas calculable :
  -- restaurant sans position, adresse sans GPS, position hors de Nosy Be.
  v_delivery_fee := public.frais_livraison(p_restaurant_id, v_address.latitude, v_address.longitude);

  insert into public.orders (user_id, restaurant_id, address_id, payment_method,
                             subtotal, delivery_fee, packaging_fee, total, status,
                             commission_rate, commission_amount)
  values (auth.uid(), p_restaurant_id, p_address_id, p_payment_method::public.payment_method,
          0, v_delivery_fee, 0, v_delivery_fee, 'recue',
          v_commission_rate, 0)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and restaurant_id = p_restaurant_id
        and is_available;
    if v_product.id is null then
      raise exception 'Produit indisponible ou introuvable';
    end if;

    -- Une categorie peut n'etre servie qu'a certaines heures (les pizzas de
    -- Chez Bidul & Truc sortent du four a partir de 18 h). Le nom et les heures
    -- partent dans le message : le client doit lire « Les Pizza ne sont servies
    -- qu'a partir de 18:00 », pas « la commande n'a pas pu etre creee ».
    -- Separateur « | » et non « : » : un nom de categorie peut contenir un
    -- deux-points. Pas de to_char() : Postgres n'a pas to_char(time, text).
    select * into v_categorie from public.categories where id = v_product.category_id;

    -- Categorie desactivee : le restaurant ne la sert pas encore. L'app la
    -- masque deja ; ceci ferme la porte de derriere (lien partage, appel direct).
    if v_categorie.id is not null and not v_categorie.is_active then
      raise exception 'Produit indisponible ou introuvable';
    end if;

    if v_categorie.id is not null and not public.categorie_servie_maintenant(v_categorie) then
      raise exception 'service:categorie_hors_service|%|%|%',
        v_categorie.name,
        substring(v_categorie.serving_from::text from 1 for 5),
        substring(v_categorie.serving_to::text   from 1 for 5)
        using errcode = '22023';
    end if;

    v_item_options := coalesce(v_item->'options', '[]'::jsonb);
    select count(*) into v_options_count from jsonb_array_elements(v_item_options);

    select count(*), coalesce(sum(po.price_delta * greatest(coalesce((opt->>'quantity')::integer, 1), 1)), 0)
      into v_valid_options_count, v_options_delta
      from jsonb_array_elements(v_item_options) as opt
      join public.product_options po on po.id = (opt->>'option_id')::uuid
      join public.product_option_groups pog on pog.id = po.group_id
      where pog.product_id = v_product.id
        and po.is_available;

    if v_valid_options_count <> v_options_count then
      raise exception 'Option invalide ou indisponible pour ce produit';
    end if;

    for v_group in select * from public.product_option_groups where product_id = v_product.id
    loop
      select count(*) into v_group_selected_count
        from jsonb_array_elements(v_item_options) as opt
        join public.product_options po on po.id = (opt->>'option_id')::uuid
        where po.group_id = v_group.id;

      if v_group.required and v_group_selected_count < greatest(v_group.min_select, 1) then
        raise exception 'Choix requis manquant : %', v_group.name;
      end if;
      if v_group_selected_count < v_group.min_select or v_group_selected_count > v_group.max_select then
        raise exception 'Nombre de choix invalide pour : %', v_group.name;
      end if;
    end loop;

    v_unit_price := v_product.price + v_options_delta;
    v_qty := (v_item->>'quantity')::integer;

    insert into public.order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, comment,
                                    packaging_fee_snapshot, packaging_label_snapshot)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_unit_price, v_item->>'comment',
            coalesce(v_product.packaging_fee, 0),
            case when coalesce(v_product.packaging_fee, 0) > 0 then v_product.packaging_label end)
    returning id into v_item_id;

    insert into public.order_item_options (order_item_id, option_id, option_name_snapshot, price_delta_snapshot, quantity)
    select v_item_id, po.id, po.name, po.price_delta, greatest(coalesce((opt->>'quantity')::integer, 1), 1)
      from jsonb_array_elements(v_item_options) as opt
      join public.product_options po on po.id = (opt->>'option_id')::uuid;

    v_subtotal := v_subtotal + v_unit_price * v_qty;
    v_packaging := v_packaging + coalesce(v_product.packaging_fee, 0) * v_qty;

    -- Un repas offert ne paie pas les boissons : on tient leur part a l'ecart
    -- des maintenant, la ligne de commande ne se relit plus apres.
    if not coalesce(v_categorie.est_boisson, false) then
      v_subtotal_hors_boissons  := v_subtotal_hors_boissons + v_unit_price * v_qty;
      v_packaging_hors_boissons := v_packaging_hors_boissons + coalesce(v_product.packaging_fee, 0) * v_qty;
    end if;
  end loop;

  if p_code_promo is not null and btrim(p_code_promo) <> '' then
    select * into v_promo from public.promo_codes
     where code_normalise = public.normaliser_code_promo(p_code_promo)
     for update;

    if v_promo.id is not null then
      select count(*) into v_promo_n
        from public.promo_redemptions where code_id = v_promo.id;
    end if;

    v_raison := public.raison_invalidite_promo(v_promo, v_promo_n, false);
    if v_raison is not null then
      raise exception 'code_promo:%', v_raison using errcode = '22023';
    end if;

    if v_promo.restaurant_id is not null
       and v_promo.restaurant_id is distinct from p_restaurant_id then
      raise exception 'code_promo:restaurant_inconnu' using errcode = '22023';
    end if;

    v_base := case
      when v_promo.porte_sur = 'livraison' then v_delivery_fee
      else (case when v_promo.exclut_boissons then v_subtotal_hors_boissons else v_subtotal end)
         + (case when v_promo.inclut_emballage
                 then (case when v_promo.exclut_boissons then v_packaging_hors_boissons else v_packaging end)
                 else 0 end)
    end;
    v_remise := public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base);

    if v_remise > 0 then
      v_code_applique := v_promo.code_normalise;
      begin
        insert into public.promo_redemptions (code_id, user_id, order_id, montant_remise)
        values (v_promo.id, auth.uid(), v_order.id, v_remise);
      exception when unique_violation then
        raise exception 'code_promo:deja_utilise' using errcode = '22023';
      end;
      if v_promo.pris_en_charge_par = 'restaurant' then
        v_remise_resto := v_remise;
      end if;
    end if;
  end if;

  -- PORTE-MONNAIE (2026-10-07). Sur les PLATS seulement (sous-total des articles),
  -- apres un eventuel code qui porte deja sur eux : la part plats ne devient jamais
  -- negative, le total non plus. Finance par Taxi Food : n'entre ni dans
  -- remise_charge_restaurant ni dans la commission. Jamais pour une commande saisie
  -- par telephone (le compte est celui de l'admin). Verrou par client : deux
  -- commandes simultanees ne depensent pas deux fois le meme solde.
  if coalesce(p_utiliser_porte_monnaie, false)
     and coalesce(current_setting('taxifood.commande_telephone', true), '') <> 'on' then
    perform pg_advisory_xact_lock(hashtextextended('porte_monnaie:' || auth.uid()::text, 0));
    v_solde_pm := public.solde_porte_monnaie(auth.uid());
    v_remise_pm := public.remise_porte_monnaie_calcul(
      v_solde_pm, v_subtotal,
      case when v_code_applique is not null and v_promo.porte_sur <> 'livraison' then v_remise else 0 end);
    if v_remise_pm > 0 then
      insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id)
      values (auth.uid(), -v_remise_pm, 'utilisation', v_order.id);
    end if;
  end if;

  -- Commission : pas de commission Taxi Food sur ce que le restaurant offre de
  -- sa poche. Plancher a 0 : un code livraison paye par le restaurant peut
  -- depasser les plats d'une petite commande, et une commission negative
  -- voudrait dire que Taxi Food paie le restaurant. Le porte-monnaie n'y entre pas.
  update public.orders
    set subtotal       = v_subtotal,
        packaging_fee  = v_packaging,
        promo_code     = v_code_applique,
        promo_porte_sur = case when v_code_applique is null then null else v_promo.porte_sur end,
        promo_discount = v_remise,
        remise_charge_restaurant = v_remise_resto,
        remise_porte_monnaie = v_remise_pm,
        total          = v_subtotal + v_packaging + v_delivery_fee - v_remise - v_remise_pm,
        commission_amount = greatest(round((v_subtotal + v_packaging - v_remise_resto) * v_commission_rate)::integer, 0)
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$function$;

grant execute on function public.create_order(uuid, uuid, text, jsonb, text, boolean) to anon, authenticated, service_role;

-- ------------------------------------------- annulation : rendre / reprendre
create or replace function public.porte_monnaie_annulation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_net   integer;
  v_solde integer;
begin
  if new.user_id is null then
    return null;
  end if;

  -- Ce que la commande a pris et pas encore rendu (utilisation − remboursements + reprises).
  select coalesce(sum(montant), 0)::integer into v_net
    from public.porte_monnaie_mouvements
   where order_id = new.id
     and motif in ('utilisation', 'remboursement_annulation', 'annulation_levee');

  -- Entrée en annulation : même règle que les codes offerts — rien n'est rendu
  -- si la commande avait été livrée (le repas a été mangé).
  if new.status = 'annulee' and old.status is distinct from 'annulee' then
    if old.status is distinct from 'livree' and new.delivered_at is null and v_net < 0 then
      insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id)
      values (new.user_id, -v_net, 'remboursement_annulation', new.id);
    end if;
    return null;
  end if;

  -- Sortie d'annulation d'une commande qui porte encore sa remise : on la reprend.
  if old.status = 'annulee' and new.status is distinct from 'annulee'
     and coalesce(new.remise_porte_monnaie, 0) > 0 and v_net = 0 then
    perform pg_advisory_xact_lock(hashtextextended('porte_monnaie:' || new.user_id::text, 0));
    v_solde := public.solde_porte_monnaie(new.user_id);
    if v_solde < new.remise_porte_monnaie then
      raise exception 'porte_monnaie:solde_insuffisant — le client a depense son porte-monnaie depuis l''annulation : la commande % ne peut pas etre reactivee avec sa remise (% Ar, solde %)',
        coalesce(new.order_number, new.id::text), new.remise_porte_monnaie, v_solde
        using errcode = '22023';
    end if;
    insert into public.porte_monnaie_mouvements (user_id, montant, motif, order_id)
    values (new.user_id, -new.remise_porte_monnaie, 'annulation_levee', new.id);
  end if;

  return null;
end $$;
revoke all on function public.porte_monnaie_annulation() from public, anon, authenticated;

drop trigger if exists orders_porte_monnaie_annulation on public.orders;
create trigger orders_porte_monnaie_annulation
  after update of status on public.orders
  for each row execute function public.porte_monnaie_annulation();

-- ------------------------------------------------------------- deposer_avis
-- Même signature, mêmes gardes ; le code AVIS<PRENOM> laisse place à +1 000 Ar.
create or replace function public.deposer_avis(p_order_id uuid, p_cuisine integer, p_preparation integer, p_livraison integer, p_commentaire text default null::text, p_consentement boolean default false, p_langue text default 'fr'::text, p_photo_url text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid      uuid := auth.uid();
  v_o        public.orders;
  v_nom      text;
  v_comm     text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_photo    text := nullif(btrim(coalesce(p_photo_url, '')), '');
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
    'solde_porte_monnaie', public.solde_porte_monnaie(v_uid));
end $function$;

-- mon_avis : le crédit de l'avis s'ajoute (les anciens avis gardent leur code).
create or replace function public.mon_avis(p_order_id uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
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
                                     where m.avis_id = a.id and m.motif = 'avis'))
    from public.avis a
    left join public.promo_codes pc on pc.id = a.code_promo_id
   where a.order_id = p_order_id and a.user_id = auth.uid();
$function$;

-- ------------------------------------------------------------------- admin
create or replace function public.admin_porte_monnaie_soldes()
returns table (user_id uuid, client text, email text, solde integer, credits integer, debits integer,
               nb_mouvements integer, dernier_mouvement timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return query
  select m.user_id, p.full_name, p.email,
         sum(m.montant)::integer,
         coalesce(sum(m.montant) filter (where m.montant > 0), 0)::integer,
         coalesce(-sum(m.montant) filter (where m.montant < 0), 0)::integer,
         count(*)::integer,
         max(m.created_at)
    from public.porte_monnaie_mouvements m
    left join public.profiles p on p.id = m.user_id
   group by m.user_id, p.full_name, p.email
   order by sum(m.montant) desc, max(m.created_at) desc;
end $$;
revoke all on function public.admin_porte_monnaie_soldes() from public, anon;
grant execute on function public.admin_porte_monnaie_soldes() to authenticated;

create or replace function public.admin_porte_monnaie_mouvements(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'montant', m.montant, 'motif', m.motif, 'note', m.note,
             'commande', o.order_number, 'restaurant', r.name, 'code', pc.code,
             'created_at', m.created_at) order by m.created_at desc)
      from public.porte_monnaie_mouvements m
      left join public.orders o on o.id = m.order_id
      left join public.restaurants r on r.id = o.restaurant_id
      left join public.promo_codes pc on pc.id = m.code_promo_id
     where m.user_id = p_user), '[]'::jsonb);
end $$;
revoke all on function public.admin_porte_monnaie_mouvements(uuid) from public, anon;
grant execute on function public.admin_porte_monnaie_mouvements(uuid) to authenticated;

-- Geste manuel : motif obligatoire, journalisé dans admin_actions. Un débit ne
-- peut pas rendre le solde négatif.
create or replace function public.admin_porte_monnaie_geste(p_user uuid, p_montant integer, p_note text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_note  text := nullif(btrim(coalesce(p_note, '')), '');
  v_solde integer;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if p_montant is null or p_montant = 0 or abs(p_montant) > 100000 then
    raise exception 'porte_monnaie:montant_invalide' using errcode = '22023';
  end if;
  if v_note is null then
    raise exception 'porte_monnaie:motif_obligatoire' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'porte_monnaie:client_introuvable' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('porte_monnaie:' || p_user::text, 0));
  v_solde := public.solde_porte_monnaie(p_user);
  if v_solde + p_montant < 0 then
    raise exception 'porte_monnaie:solde_insuffisant' using errcode = '22023';
  end if;
  insert into public.porte_monnaie_mouvements (user_id, montant, motif, note, cree_par)
  values (p_user, p_montant, 'geste_admin', left(v_note, 300), auth.uid());
  insert into public.admin_actions (admin_id, action, avant, apres, motif)
  values (auth.uid(), 'porte_monnaie_geste', v_solde::text, (v_solde + p_montant)::text,
          p_user::text || ' : ' || left(v_note, 300));
  return v_solde + p_montant;
end $$;
revoke all on function public.admin_porte_monnaie_geste(uuid, integer, text) from public, anon;
grant execute on function public.admin_porte_monnaie_geste(uuid, integer, text) to authenticated;

-- ----------------------------------------------------- rapport_journalier
-- Seule `total_taxi_food` change (la remise porte-monnaie sort de la marge Taxi
-- Food) ; la colonne `remise_porte_monnaie` s'ajoute EN DERNIER (create or replace
-- view n'accepte que l'ajout en fin de liste).
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
    sum(((((o.commission_amount + o.delivery_fee) - COALESCE(o.promo_discount, 0)) + o.remise_charge_restaurant) - o.remise_porte_monnaie)) AS total_taxi_food,
    COALESCE(sum(o.total) FILTER (WHERE (o.payment_method = 'especes'::payment_method)), (0)::bigint) AS encaisse_par_les_livreurs,
    COALESCE(sum(GREATEST((o.total - rb.rendu_ar), 0)) FILTER (WHERE ((o.payment_method = 'cb'::payment_method) AND (o.payment_status = ANY (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status])))), (0)::bigint) AS encaisse_par_stripe,
    COALESCE(sum(o.total) FILTER (WHERE ((o.payment_method = 'cb'::payment_method) AND (o.payment_status <> ALL (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status])))), (0)::bigint) AS carte_non_encaissee,
    COALESCE(sum(o.total) FILTER (WHERE (o.payment_method = 'orange_money'::payment_method)), (0)::bigint) AS encaisse_hors_app,
    sum(o.packaging_fee) AS emballage_a_arbitrer,
    sum(o.total) AS facture_aux_clients,
    COALESCE(sum(rb.rendu_ar), (0)::bigint) AS rembourse_par_stripe,
    count(*) FILTER (WHERE (rb.rendu_ar > 0)) AS commandes_remboursees,
    sum(o.remise_porte_monnaie) AS remise_porte_monnaie
   FROM ((orders o
     JOIN restaurants r ON ((r.id = o.restaurant_id)))
     LEFT JOIN LATERAL ( SELECT (COALESCE(sum(pr.amount_ar), (0)::bigint))::integer AS rendu_ar
           FROM payment_refunds pr
          WHERE ((pr.order_id = o.id) AND (pr.status = 'effectue'::payment_refund_status))) rb ON (true))
  WHERE (o.status = 'livree'::order_status)
  GROUP BY (((o.created_at AT TIME ZONE 'Indian/Antananarivo'::text))::date), r.id, r.name;

-- ------------------------------------- notify_order_status : patch par ancres
-- (jamais recopiée : 200 lignes, c'est la façon d'en perdre une)
do $$
declare
  v_def text := pg_get_functiondef('public.notify_order_status'::regproc);
  v_ancre1 constant text := E'''code_promo'',v_o.promo_code,''remise'',v_o.promo_discount,\n';
  v_neuf1  constant text := E'''code_promo'',v_o.promo_code,''remise'',v_o.promo_discount,\n'
                         || E'      ''remise_porte_monnaie'',coalesce(v_o.remise_porte_monnaie,0),\n';
  v_ancre2 constant text := E'|| '' ('' || coalesce(v_charge->''commande''->>''paiement'', ''?'') || '')''\n';
  v_neuf2  constant text := E'|| '' ('' || coalesce(v_charge->''commande''->>''paiement'', ''?'') || '')''\n'
                         || E'          || coalesce(chr(10) || ''dont porte-monnaie client : -'' || nullif(v_charge->''commande''->>''remise_porte_monnaie'', ''0'') || '' Ar (Taxi Food)'', '''')\n';
begin
  if position('remise_porte_monnaie' in v_def) > 0 then
    raise notice 'notify_order_status : remise_porte_monnaie deja presente';
    return;
  end if;
  if position(v_ancre1 in v_def) = 0 then
    raise exception 'notify_order_status : ancre code_promo introuvable, patch refuse';
  end if;
  if position(v_ancre2 in v_def) = 0 then
    raise exception 'notify_order_status : ancre paiement (copie admin) introuvable, patch refuse';
  end if;
  execute replace(replace(v_def, v_ancre1, v_neuf1), v_ancre2, v_neuf2);
end $$;
