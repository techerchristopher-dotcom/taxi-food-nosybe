-- 20260924151000_create_order_frais_au_kilometre.sql
--
-- `create_order` calcule elle-meme les frais de livraison par
-- `frais_livraison(restaurant, latitude, longitude)` (migration 20260924150000),
-- a partir de la position de l'ADRESSE choisie. Elle ne lit plus
-- `restaurants.delivery_fee` directement : ce montant n'est plus que le socle.
--
-- CE QUI CHANGE, ET RIEN D'AUTRE :
--   1. le calcul des frais descend APRES la lecture de l'adresse (il lui faut
--      ses coordonnees) ;
--   2. `v_delivery_fee := public.frais_livraison(...)`.
-- Tout le reste du corps est identique a la version precedente.
--
-- ⛔ MEME SIGNATURE, exactement : (uuid, uuid, text, jsonb, text). Recreer
-- `create_order` en changeant le type d'un parametre AJOUTE une surcharge et
-- PostgREST repond PGRST203 « Could not choose the best candidate function » —
-- plus aucune commande ne passe. L'enveloppe a 4 arguments (payment_method)
-- reste telle quelle, elle appelle celle-ci.
--
-- L'ECRAN N'EST JAMAIS L'AUTORITE : aucun parametre ne permet au client de
-- proposer un montant de livraison, et `orders` n'a volontairement aucune
-- politique RLS UPDATE. `orders.delivery_fee` est donc fige a la creation.

create or replace function public.create_order(
  p_restaurant_id uuid,
  p_address_id uuid,
  p_payment_method text,
  p_items jsonb,
  p_code_promo text
) returns public.orders
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

    insert into public.order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, comment)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_unit_price, v_item->>'comment')
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

  -- Commission : pas de commission Taxi Food sur ce que le restaurant offre de
  -- sa poche. Plancher a 0 : un code livraison paye par le restaurant peut
  -- depasser les plats d'une petite commande, et une commission negative
  -- voudrait dire que Taxi Food paie le restaurant.
  update public.orders
    set subtotal       = v_subtotal,
        packaging_fee  = v_packaging,
        promo_code     = v_code_applique,
        promo_porte_sur = case when v_code_applique is null then null else v_promo.porte_sur end,
        promo_discount = v_remise,
        remise_charge_restaurant = v_remise_resto,
        total          = v_subtotal + v_packaging + v_delivery_fee - v_remise,
        commission_amount = greatest(round((v_subtotal + v_packaging - v_remise_resto) * v_commission_rate)::integer, 0)
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$function$;
