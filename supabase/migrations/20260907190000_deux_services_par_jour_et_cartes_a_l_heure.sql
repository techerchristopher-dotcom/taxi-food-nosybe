-- Deux services par jour, des cartes qui ouvrent a l'heure, et une base qui refuse.
--
-- Trois manques constates le 2026-09-07 en branchant Chez Bidul & Truc, qui sert
-- midi (11h30-15h) ET soir (18h-22h), et dont les pizzas ne sortent que le soir.
--
-- 1. UN SEUL SERVICE PAR JOUR ETAIT POSSIBLE. `restaurant_hours` avait
--    `PRIMARY KEY (restaurant_id, weekday)` : deux services n'etaient pas
--    « pas prevus », ils etaient interdits par la cle.
--
-- 2. AUCUNE NOTION D'HEURE SUR UNE CATEGORIE. `categories` n'a qu'un `is_active`
--    tout ou rien : masquer les pizzas le midi obligeait a les eteindre a la main
--    deux fois par jour, tous les jours.
--
-- 3. ⚠️ ET LE VRAI TROU : `create_order` ne regardait NI l'ouverture NI l'heure.
--    Verifie dans une transaction annulee, sur Chez Bidul & Truc ferme :
--    « restaurant ouvert ? f | commande acceptee ? t (TF-107, total 19000) ».
--    On pouvait commander a 3 h du matin. Avec deux services, on aurait pu
--    commander a 16 h entre midi et soir, et une pizza a midi — l'ecran a beau
--    la griser, l'ecran n'a jamais ete l'autorite. Le restaurant aurait recu la
--    commande sur Telegram, avec ses boutons, sans personne en cuisine.

-- 1. Une plage horaire, avec le passage de minuit --------------------------------
--    Extraite parce qu'elle sert maintenant a trois endroits : l'ouverture du
--    restaurant, la disponibilite d'une categorie, et la garde de create_order.
--    Trois copies de cette logique auraient diverge.
create or replace function public.heure_dans_plage(
  p_ouvre time, p_ferme time, p_moment time
) returns boolean
language sql immutable as $$
  select case
    when p_ouvre is null or p_ferme is null then false
    -- 18h -> 22h : intervalle simple.
    when p_ouvre <= p_ferme then p_moment between p_ouvre and p_ferme
    -- 22h -> 02h : la plage enjambe minuit, elle est vraie aux DEUX bouts.
    else p_moment >= p_ouvre or p_moment <= p_ferme
  end;
$$;

create or replace function public.maintenant_nosybe() returns time
language sql stable as $$
  select (now() at time zone 'Indian/Antananarivo')::time;
$$;

-- 2. Plusieurs services par jour -------------------------------------------------
alter table public.restaurant_hours
  add column if not exists service smallint not null default 1;

alter table public.restaurant_hours
  drop constraint if exists restaurant_hours_pkey;

alter table public.restaurant_hours
  add constraint restaurant_hours_service_check check (service between 1 and 2);

alter table public.restaurant_hours
  add constraint restaurant_hours_pkey primary key (restaurant_id, weekday, service);

comment on column public.restaurant_hours.service is
  '1 = service du midi, 2 = service du soir. Un restaurant a service unique n''utilise que le 1.';

-- 3. Ouvert = il existe UN service du jour qui contient l'heure -------------------
create or replace function public.ouvert_maintenant(r public.restaurants)
returns boolean language sql stable as $$
  select case
    when not r.auto_open then r.is_open
    else exists (
      select 1 from public.restaurant_hours h
      where h.restaurant_id = r.id
        and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
        and not h.is_closed
        and public.heure_dans_plage(h.opens_at, h.closes_at, public.maintenant_nosybe())
    )
  end;
$$;

-- Tous les services du jour, dans l'ordre. `horaires_du_jour` (une seule ligne)
-- reste en place le temps que l'app bascule : elle rend desormais le service 1.
create or replace function public.services_du_jour(r public.restaurants)
returns setof public.restaurant_hours language sql stable as $$
  select h.* from public.restaurant_hours h
  where h.restaurant_id = r.id
    and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
    and not h.is_closed and h.opens_at is not null
  order by h.service;
$$;

create or replace function public.horaires_du_jour(r public.restaurants)
returns public.restaurant_hours language sql stable as $$
  select h.* from public.restaurant_hours h
  where h.restaurant_id = r.id
    and h.weekday = extract(dow from (now() at time zone 'Indian/Antananarivo'))::smallint
  order by h.service limit 1;
$$;

-- 4. Une categorie peut n'etre servie qu'a certaines heures -----------------------
--    Vide = servie chaque fois que le restaurant est ouvert. C'est le cas de
--    toutes les categories existantes : la colonne n'change rien pour elles.
alter table public.categories
  add column if not exists serving_from time,
  add column if not exists serving_to   time;

comment on column public.categories.serving_from is
  'Debut du service de cette categorie (ex. pizzas au four : 18:00). NULL = servie des que le restaurant est ouvert.';

create or replace function public.categorie_servie_maintenant(c public.categories)
returns boolean language sql stable as $$
  select case
    when c.serving_from is null or c.serving_to is null then true
    else public.heure_dans_plage(c.serving_from, c.serving_to, public.maintenant_nosybe())
  end;
$$;

-- 5. La RPC met a jour les DEUX services d'un coup --------------------------------
create or replace function public.set_restaurant_week_hours(p_days jsonb)
returns setof public.restaurant_hours
language plpgsql security definer set search_path to 'public' as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;

  -- `service` est optionnel dans la charge utile : absent, il vaut 1. Les ecrans
  -- deja installes sur les magasins envoient sept objets sans `service` et
  -- continuent donc de piloter le service du midi, sans rien casser.
  insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
  select v_resto_id, d.weekday, coalesce(d.service, 1), d.opens_at, d.closes_at, coalesce(d.is_closed, false)
  from jsonb_to_recordset(p_days)
    as d(weekday smallint, service smallint, opens_at time, closes_at time, is_closed boolean)
  on conflict (restaurant_id, weekday, service)
  do update set opens_at = excluded.opens_at,
                closes_at = excluded.closes_at,
                is_closed = excluded.is_closed;

  return query select * from public.restaurant_hours
               where restaurant_id = v_resto_id order by weekday, service;
end;
$$;


-- 6. La commande refuse ce qui ne peut pas etre servi ---------------------------
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
  -- Le code réellement APPLIQUÉ, celui qui sera tamponné sur la commande.
  -- Distinct du code trouvé en base : un code qui ne donne rien n'est pas
  -- appliqué, et n'a donc rien à faire sur la note du client.
  v_code_applique text := null;
  v_resto       public.restaurants;
  v_categorie   public.categories;
begin
  select * into v_resto from public.restaurants where id = p_restaurant_id;
  if v_resto.id is null then
    raise exception 'Restaurant introuvable';
  end if;
  v_delivery_fee    := v_resto.delivery_fee;
  v_commission_rate := coalesce(v_resto.commission_rate, 0);

  -- ⚠️ GARDE D'OUVERTURE. Elle manquait, et ca s'est vu : sur un restaurant
  -- ferme, une commande passait sans un mot (verifie le 2026-09-07, TF-107 a
  -- 19 000 Ar dans une transaction annulee). Le restaurant recevait son message
  -- Telegram avec ses boutons, sans personne en cuisine. L'ecran grisait le
  -- bouton — l'ecran n'est pas l'autorite, il n'a jamais empeche un appel direct
  -- a l'API avec la cle anon, publique par conception.
  if not public.ouvert_maintenant(v_resto) then
    raise exception 'service:restaurant_ferme' using errcode = '22023';
  end if;

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

    -- ⚠️ Une categorie peut n'etre servie qu'a certaines heures (les pizzas de
    -- Chez Bidul & Truc sortent du four a partir de 18 h). Le nom part dans le
    -- message : le client doit lire « Les Pizza ne sont servies qu'a partir de
    -- 18h00 », pas « la commande n'a pas pu etre creee ».
    select * into v_categorie from public.categories where id = v_product.category_id;
    if v_categorie.id is not null and not public.categorie_servie_maintenant(v_categorie) then
      -- ⚠️ Separateur « | » et non « : » : un nom de categorie peut contenir un
      -- deux-points, et le decoupage cote app se ferait alors au mauvais endroit.
      -- ⚠️ Pas de to_char() ici : Postgres n'a pas de to_char(time, text). Un
      -- `time` se rend en texte sous la forme « 18:00:00 », dont on garde 5
      -- caracteres.
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

    -- Un code ne se consomme QUE s'il donne quelque chose. Sinon on le laisse
    -- intact pour la prochaine commande du client, et on ne tamponne pas la
    -- commande d'un code qui n'a rien changé à son total. Ne pas lever
    -- d'exception ici : ce serait refuser une commande par ailleurs valable.
    if v_remise > 0 then
      v_code_applique := v_promo.code_normalise;
      begin
        insert into public.promo_redemptions (code_id, user_id, order_id, montant_remise)
        values (v_promo.id, auth.uid(), v_order.id, v_remise);
      exception when unique_violation then
        raise exception 'code_promo:deja_utilise' using errcode = '22023';
      end;
    end if;
  end if;

  update public.orders
    set subtotal       = v_subtotal,
        packaging_fee  = v_packaging,
        promo_code     = v_code_applique,
        promo_discount = v_remise,
        total          = v_subtotal + v_packaging + v_delivery_fee - v_remise,
        commission_amount = round(v_subtotal * v_commission_rate)::integer
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$function$;