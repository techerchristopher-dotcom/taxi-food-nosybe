-- ############################################################################
-- RAPATRIEMENT — ce fichier a ete ecrit APRES coup, le 2026-09-06.
--
-- Deux migrations touchant `create_order` ont ete appliquees par MCP le
-- 2026-09-05 sans qu'aucun fichier ne soit ecrit dans le depot :
--   20260905211333  create_order_code_promo_et_consolidation
--   20260905212307  create_order_lever_ambiguite_surcharges
-- C'est exactement le piege documente du projet : `apply_migration` n'ecrit
-- AUCUN fichier, et le depot diverge de la base en silence — ici sur la fonction
-- la plus critique de l'application, celle qui fixe les montants.
--
-- Le SQL ci-dessous est la definition EXACTE lue en base le 2026-09-06
-- (`pg_get_functiondef`), pas une reconstitution. Il consolide les deux
-- migrations : la 211333 n'a donc pas de fichier propre, elle est ici.
--
-- ⚠️ LES DEUX SIGNATURES, ET PAS UNE DE PLUS (voir CLAUDE.md) :
--   - l'implementation a 5 arguments (`p_code_promo text`)
--   - l'enveloppe a 4 arguments typee `payment_method`, appelee par les
--     versions de l'app deja installees sur les magasins.
-- `create or replace` n'ecrase pas une signature differente, il AJOUTE une
-- surcharge : PostgREST repond alors PGRST203 et plus aucune commande ne passe.
-- C'est ce qui s'est produit le 2026-09-05.
-- ############################################################################

CREATE OR REPLACE FUNCTION public.create_order(p_restaurant_id uuid, p_address_id uuid, p_payment_method payment_method, p_items jsonb)
 RETURNS orders
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.create_order(p_restaurant_id, p_address_id, p_payment_method::text, p_items, null::text)
$function$;

CREATE OR REPLACE FUNCTION public.create_order(p_restaurant_id uuid, p_address_id uuid, p_payment_method text, p_items jsonb, p_code_promo text)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order       public.orders;
  v_subtotal    integer := 0;
  v_packaging   integer := 0;
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
  v_raison      text;
  v_base        integer;
begin
  select delivery_fee, commission_rate
    into v_delivery_fee, v_commission_rate
    from public.restaurants where id = p_restaurant_id;
  if v_delivery_fee is null then
    raise exception 'Restaurant introuvable';
  end if;
  v_commission_rate := coalesce(v_commission_rate, 0);

  select * into v_address from public.addresses
    where id = p_address_id and user_id = auth.uid();

  if v_address.id is null then
    raise exception 'Adresse de livraison introuvable : choisis une adresse dans la liste';
  end if;
  if v_address.latitude is null or v_address.longitude is null then
    raise exception 'Position GPS manquante sur cette adresse : la localisation est obligatoire pour valider une commande';
  end if;

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

    insert into public.order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, comment)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_unit_price, v_item->>'comment')
    returning id into v_item_id;

    insert into public.order_item_options (order_item_id, option_id, option_name_snapshot, price_delta_snapshot, quantity)
    select v_item_id, po.id, po.name, po.price_delta, greatest(coalesce((opt->>'quantity')::integer, 1), 1)
      from jsonb_array_elements(v_item_options) as opt
      join public.product_options po on po.id = (opt->>'option_id')::uuid;

    v_subtotal := v_subtotal + v_unit_price * v_qty;
    v_packaging := v_packaging + coalesce(v_product.packaging_fee, 0) * v_qty;
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

    v_base := case when v_promo.porte_sur = 'livraison' then v_delivery_fee else v_subtotal end;
    v_remise := public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base);

    begin
      insert into public.promo_redemptions (code_id, user_id, order_id, montant_remise)
      values (v_promo.id, auth.uid(), v_order.id, v_remise);
    exception when unique_violation then
      raise exception 'code_promo:deja_utilise' using errcode = '22023';
    end;
  end if;

  update public.orders
    set subtotal       = v_subtotal,
        packaging_fee  = v_packaging,
        promo_code     = case when v_promo.id is not null then v_promo.code_normalise end,
        promo_discount = v_remise,
        total          = v_subtotal + v_packaging + v_delivery_fee - v_remise,
        commission_amount = round(v_subtotal * v_commission_rate)::integer
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$function$;
