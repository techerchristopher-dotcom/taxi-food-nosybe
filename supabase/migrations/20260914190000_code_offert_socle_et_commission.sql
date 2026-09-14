-- Code offert nominatif : le socle (moteur promo, commande, commission).
--
-- Le geste commercial du 2026-09-14 : un restaurant offre un repas a un client
-- (retard, erreur, fidelite). Jusqu'ici le seul outil etait un code promo
-- public, valable pour tout le monde, partout, et paye par Taxi Food. Il faut
-- un code qui :
--   - n'appartient qu'a UN client (un autre compte lit « ce code n'existe pas » :
--     on ne revele pas qu'un code nominatif existe) ;
--   - ne vaut que dans le restaurant qui fait le geste ;
--   - offre les plats, les supplements et l'emballage, JAMAIS les boissons
--     (le client paie livraison + boissons) ;
--   - est paye par le restaurant, donc sans commission Taxi Food sur la part
--     offerte ;
--   - est RENDU si la commande est refusee ou annulee : le client n'a rien mange,
--     il ne doit pas avoir perdu son cadeau.
--
-- Ce fichier ne pose que le socle. Les fonctions d'administration (recherche
-- client, creation des codes, envois) vivent dans une migration a part.
--
-- Il corrige aussi trois ecarts comptables releves en le preparant :
--   1. mark_order_delivered recalculait la commission sur les plats SEULS,
--      ecrasant celle de create_order (plats + emballage) : TF-161 et TF-162
--      ont perdu la commission de leur boite a pizza a la livraison ;
--   2. record_settlement calculait le du au restaurant sans l'emballage, que
--      l'arbitrage du 2026-09-09 lui attribue pourtant ;
--   3. le rapport journalier retirait TOUTE remise des frais de livraison —
--      faux des le premier code qui porte sur les plats.
--
-- ⚠️ Les commandes deja passees gardent leur commission_amount : c'est un
-- montant convenu ce jour-la, pas une formule a rejouer.
--
-- ⚠️ Aucune nouvelle raison de refus : les applications deja installees ne
-- savent traduire que inconnu, inactif, pas_encore, expire, epuise,
-- deja_utilise, non_connecte, restaurant_inconnu, sans_effet. On s'y tient.
--
-- ⚠️ create_order garde EXACTEMENT ses deux signatures : une signature
-- differente ajouterait une surcharge, et PostgREST repondrait PGRST203 a
-- toutes les commandes (incident du 2026-09-05).

-- =====================================================================
-- 1. Les boissons se reconnaissent a leur categorie
-- =====================================================================
-- Un indicateur plutot qu'une comparaison de nom dans chaque fonction : le jour
-- ou une categorie change d'intitule, une seule regle a relire.
alter table public.categories
  add column if not exists est_boisson boolean not null default false;

comment on column public.categories.est_boisson is
  'Categorie de boissons : exclue d''un repas offert. Pose automatiquement pour les categories nommees « Bières » ou « Softs » (decision du 2026-09-14), rien d''autre — Milkshakes et Cocktails sont offerts comme des plats.';

update public.categories
   set est_boisson = true
 where btrim(name) in ('Bières', 'Bieres', 'Softs')
   and not est_boisson;

-- Sans ce trigger, la categorie « Bières » d'un nouveau restaurant serait
-- offerte avec le repas le jour ou quelqu'un oublie de cocher la case.
create or replace function public.categories_poser_est_boisson()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.name is distinct from old.name then
    new.est_boisson := btrim(new.name) in ('Bières', 'Bieres', 'Softs');
  end if;
  return new;
end
$$;

revoke all on function public.categories_poser_est_boisson() from public, anon, authenticated;

drop trigger if exists categories_est_boisson on public.categories;
create trigger categories_est_boisson
  before insert or update of name on public.categories
  for each row execute function public.categories_poser_est_boisson();

-- =====================================================================
-- 2. Ce qu'un code sait de lui-meme
-- =====================================================================
alter table public.promo_codes
  add column if not exists beneficiaire_id uuid null references auth.users(id) on delete cascade,
  add column if not exists restaurant_id uuid null references public.restaurants(id),
  add column if not exists inclut_emballage boolean not null default false,
  add column if not exists exclut_boissons boolean not null default false,
  add column if not exists pris_en_charge_par text not null default 'taxi_food',
  add column if not exists commande_origine_id uuid null references public.orders(id) on delete set null;

do $c$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.promo_codes'::regclass
                    and conname = 'promo_codes_pris_en_charge_par_check') then
    alter table public.promo_codes
      add constraint promo_codes_pris_en_charge_par_check
      check (pris_en_charge_par in ('taxi_food', 'restaurant'));
  end if;
  -- Un restaurant ne peut payer que ce qui se commande chez lui : un code a sa
  -- charge valable partout lui ferait financer les repas des autres.
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.promo_codes'::regclass
                    and conname = 'promo_codes_charge_restaurant_localisee') then
    alter table public.promo_codes
      add constraint promo_codes_charge_restaurant_localisee
      check (pris_en_charge_par <> 'restaurant' or restaurant_id is not null);
  end if;
end
$c$;

create index if not exists promo_codes_beneficiaire_idx
  on public.promo_codes (beneficiaire_id) where beneficiaire_id is not null;

comment on column public.promo_codes.beneficiaire_id is
  'Seul compte autorise a utiliser le code. Pour tout autre compte, le code « n''existe pas » (raison inconnu). NULL = code ouvert a tous.';
comment on column public.promo_codes.restaurant_id is
  'Seul restaurant ou le code vaut (raison restaurant_inconnu ailleurs). NULL = tous les restaurants.';
comment on column public.promo_codes.inclut_emballage is
  'Code sur les plats : la base de remise inclut l''emballage.';
comment on column public.promo_codes.exclut_boissons is
  'Code sur les plats : les lignes de categories est_boisson sortent de la base de remise.';
comment on column public.promo_codes.pris_en_charge_par is
  'Qui paie la remise. « restaurant » : pas de commission Taxi Food sur la part offerte, et le du au restaurant baisse d''autant.';
comment on column public.promo_codes.commande_origine_id is
  'Commande qui a motive le geste (retard, erreur), pour la tracabilite.';

-- Fige a la creation, comme promo_porte_sur : si le code est modifie ou
-- supprime, le rapport de septembre ne doit pas changer en octobre.
alter table public.orders
  add column if not exists remise_charge_restaurant integer not null default 0;

do $c$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.orders'::regclass
                    and conname = 'orders_remise_charge_restaurant_check') then
    alter table public.orders
      add constraint orders_remise_charge_restaurant_check
      check (remise_charge_restaurant >= 0);
  end if;
end
$c$;

comment on column public.orders.remise_charge_restaurant is
  'Part de la remise payee par le restaurant (0 si Taxi Food paie ou sans code). Figee a la creation, jamais relue depuis promo_codes.';

-- =====================================================================
-- 3. Moteur promo
-- =====================================================================
-- Le controle du beneficiaire passe JUSTE apres « le code n'existe pas », avant
-- inactif/expire/epuise : sinon un inconnu apprendrait qu'un code MERCISULLI
-- existe et qu'il a deja servi.
create or replace function public.raison_invalidite_promo(p_promo public.promo_codes, p_utilisations integer, p_deja_utilise boolean)
returns text
language sql
stable
as $$
  select case
    when p_promo.id is null then 'inconnu'
    when p_promo.beneficiaire_id is not null
         and p_promo.beneficiaire_id is distinct from auth.uid() then 'inconnu'
    when not p_promo.actif then 'inactif'
    when p_promo.commence_le is not null and now() < p_promo.commence_le then 'pas_encore'
    when p_promo.expire_le   is not null and now() > p_promo.expire_le   then 'expire'
    when p_promo.max_utilisations is not null
         and p_utilisations >= p_promo.max_utilisations then 'epuise'
    when p_deja_utilise then 'deja_utilise'
    else null
  end
$$;

-- Les versions installees appellent encore cette fonction avec le seul sous-total.
-- Elle ne peut pas retirer les boissons qu'elle ne voit pas : pour un code repas
-- elle reste un apercu approximatif, et create_order tranche. Les nouvelles
-- versions passent par apercu_code_promo.
create or replace function public.verifier_code_promo(p_code text, p_restaurant_id uuid, p_sous_total integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_promo  public.promo_codes;
  v_n      integer := 0;
  v_deja   boolean := false;
  v_base   integer;
  v_remise integer;
  v_raison text;
begin
  if v_uid is null then
    return jsonb_build_object('valide', false, 'raison', 'non_connecte');
  end if;

  select * into v_promo from public.promo_codes
   where code_normalise = public.normaliser_code_promo(p_code);

  if v_promo.id is not null then
    select count(*) into v_n
      from public.promo_redemptions where code_id = v_promo.id;
    select exists (select 1 from public.promo_redemptions
                    where code_id = v_promo.id and user_id = v_uid) into v_deja;
  end if;

  v_raison := public.raison_invalidite_promo(v_promo, v_n, v_deja);
  if v_raison is not null then
    return jsonb_build_object('valide', false, 'raison', v_raison);
  end if;

  -- Code attache a un restaurant : ailleurs, il ne vaut rien.
  if v_promo.restaurant_id is not null
     and v_promo.restaurant_id is distinct from p_restaurant_id then
    return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
  end if;

  if v_promo.porte_sur = 'livraison' then
    select delivery_fee into v_base from public.restaurants where id = p_restaurant_id;
    if v_base is null then
      return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
    end if;
  else
    v_base := greatest(coalesce(p_sous_total, 0), 0);
  end if;

  v_remise := public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base);

  -- « Tu économises 0 Ar » n'est pas une bonne nouvelle : c'est un code que le
  -- client croit avoir dépensé. On refuse l'aperçu, l'app n'enverra donc pas le
  -- code à la commande, et l'utilisation reste disponible ailleurs.
  if v_remise <= 0 then
    return jsonb_build_object('valide', false, 'raison', 'sans_effet');
  end if;

  return jsonb_build_object(
    'valide',      true,
    'code',        v_promo.code_normalise,
    'porte_sur',   v_promo.porte_sur,
    'remise',      v_remise,
    'description', v_promo.description);
end;
$$;

-- =====================================================================
-- 4. create_order (5 arguments) — la meme signature, a l'octet pres
-- =====================================================================
-- Changements, et seulement ceux-la :
--   - on cumule, a cote du sous-total et de l'emballage, leur part HORS boissons ;
--   - base d'un code sur les plats = plats (hors boissons si exclut_boissons)
--     + emballage (hors boissons aussi) si inclut_emballage ;
--   - controle du restaurant du code (raison restaurant_inconnu) ;
--   - remise_charge_restaurant figee ;
--   - commission = taux x (plats + emballage - part offerte par le restaurant).
-- La formule du total ne bouge pas.
create or replace function public.create_order(p_restaurant_id uuid, p_address_id uuid, p_payment_method text, p_items jsonb, p_code_promo text)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
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
  v_delivery_fee    := v_resto.delivery_fee;
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
$$;

-- =====================================================================
-- 5. apercu_code_promo : l'apercu exact, a partir du panier
-- =====================================================================
-- Nom NOUVEAU et non une surcharge de verifier_code_promo : deux fonctions du
-- meme nom, et PostgREST ne sait plus laquelle appeler. Le panier arrive au
-- format de create_order ; la remise se calcule sur les memes regles (produits
-- disponibles du restaurant, options disponibles du produit, boissons et
-- emballage selon le code). Un produit indisponible est ignore ici : c'est
-- create_order qui refusera la commande, avec son propre message.
create or replace function public.apercu_code_promo(p_code text, p_restaurant_id uuid, p_items jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_promo  public.promo_codes;
  v_n      integer := 0;
  v_deja   boolean := false;
  v_base   integer;
  v_remise integer;
  v_raison text;
  v_subtotal integer := 0;
  v_packaging integer := 0;
  v_subtotal_hb integer := 0;
  v_packaging_hb integer := 0;
begin
  if v_uid is null then
    return jsonb_build_object('valide', false, 'raison', 'non_connecte');
  end if;

  select * into v_promo from public.promo_codes
   where code_normalise = public.normaliser_code_promo(p_code);

  if v_promo.id is not null then
    select count(*) into v_n
      from public.promo_redemptions where code_id = v_promo.id;
    select exists (select 1 from public.promo_redemptions
                    where code_id = v_promo.id and user_id = v_uid) into v_deja;
  end if;

  v_raison := public.raison_invalidite_promo(v_promo, v_n, v_deja);
  if v_raison is not null then
    return jsonb_build_object('valide', false, 'raison', v_raison);
  end if;

  if v_promo.restaurant_id is not null
     and v_promo.restaurant_id is distinct from p_restaurant_id then
    return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
  end if;

  if v_promo.porte_sur = 'livraison' then
    select delivery_fee into v_base from public.restaurants where id = p_restaurant_id;
    if v_base is null then
      return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
    end if;
  else
    select coalesce(sum(l.ligne), 0),
           coalesce(sum(l.emballage), 0),
           coalesce(sum(l.ligne) filter (where not l.boisson), 0),
           coalesce(sum(l.emballage) filter (where not l.boisson), 0)
      into v_subtotal, v_packaging, v_subtotal_hb, v_packaging_hb
      from (
        select (p.price + coalesce(o.delta, 0)) * q.qty      as ligne,
               coalesce(p.packaging_fee, 0) * q.qty          as emballage,
               coalesce(c.est_boisson, false)                as boisson
          from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array'
                                         then p_items else '[]'::jsonb end) as it
          cross join lateral (select greatest(coalesce((it->>'quantity')::integer, 0), 0) as qty) q
          join public.products p
            on p.id = (it->>'product_id')::uuid
           and p.restaurant_id = p_restaurant_id
           and p.is_available
          left join public.categories c on c.id = p.category_id
          left join lateral (
            select sum(po.price_delta * greatest(coalesce((opt->>'quantity')::integer, 1), 1)) as delta
              from jsonb_array_elements(case when jsonb_typeof(it->'options') = 'array'
                                             then it->'options' else '[]'::jsonb end) as opt
              join public.product_options po on po.id = (opt->>'option_id')::uuid
              join public.product_option_groups pog on pog.id = po.group_id
             where pog.product_id = p.id
               and po.is_available
          ) o on true
      ) l;

    v_base := (case when v_promo.exclut_boissons then v_subtotal_hb else v_subtotal end)
            + (case when v_promo.inclut_emballage
                    then (case when v_promo.exclut_boissons then v_packaging_hb else v_packaging end)
                    else 0 end);
  end if;

  v_remise := public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base);

  if v_remise <= 0 then
    return jsonb_build_object('valide', false, 'raison', 'sans_effet');
  end if;

  return jsonb_build_object(
    'valide',      true,
    'code',        v_promo.code_normalise,
    'porte_sur',   v_promo.porte_sur,
    'remise',      v_remise,
    'description', v_promo.description);
end;
$$;

revoke all on function public.apercu_code_promo(text, uuid, jsonb) from public;
grant execute on function public.apercu_code_promo(text, uuid, jsonb) to anon, authenticated, service_role;

-- =====================================================================
-- 6. Commande refusee ou annulee : le code nominatif est rendu
-- =====================================================================
-- Seulement les codes a beneficiaire : TAXIFOOD50 et les codes publics gardent
-- leur comportement (une utilisation par client, meme si la commande tombe).
-- SECURITY DEFINER : l'annulation vient d'un restaurateur ou d'un lien de refus,
-- et promo_redemptions n'est accessible qu'a l'admin.
create or replace function public.liberer_code_promo_annulation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'annulee' and old.status is distinct from 'annulee' then
    delete from public.promo_redemptions pr
     using public.promo_codes pc
     where pr.order_id = new.id
       and pc.id = pr.code_id
       and pc.beneficiaire_id is not null;
  end if;
  return null;
end
$$;

revoke all on function public.liberer_code_promo_annulation() from public, anon, authenticated;

drop trigger if exists orders_liberer_code_promo on public.orders;
create trigger orders_liberer_code_promo
  after update of status on public.orders
  for each row execute function public.liberer_code_promo_annulation();

-- =====================================================================
-- 7. Corrections comptables (a partir de maintenant)
-- =====================================================================
-- La livraison recalculait la commission sur les plats seuls et ecrasait celle
-- de create_order : meme formule desormais. Le taux reste relu au moment de la
-- livraison, comme avant.
create or replace function public.mark_order_delivered(p_order_id uuid, p_cash_confirmed boolean default false)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_rate  numeric(5,4);
  v_carte boolean;
  v_cash  boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null then
    raise exception 'Marque d''abord la commande comme recuperee';
  end if;

  if v_order.payment_status = 'paye' then
    -- Deja encaisse en ligne : on n'exige aucun cash, et surtout on n'en
    -- enregistre aucun, meme si l'appelant a coche la case.
    v_cash := false;
  elsif v_order.payment_method = 'especes' and not coalesce(p_cash_confirmed, false) then
    raise exception 'Confirme l''encaissement en especes';
  else
    v_cash := coalesce(p_cash_confirmed, false);
  end if;

  if v_order.payment_method = 'cb' and v_order.payment_status <> 'paye' then
    select carte_active into v_carte from public.payment_config where id = 1;
    if coalesce(v_carte, false) or v_order.payment_status <> 'non_requis' then
      raise exception 'Paiement carte non confirme : cette commande ne peut pas etre marquee livree';
    end if;
  end if;

  select commission_rate into v_rate from public.restaurants where id = v_order.restaurant_id;

  update public.orders
    set status = 'livree', delivered_at = now(), status_updated_at = now(),
        cash_confirmed = v_cash,
        commission_rate = v_rate,
        commission_amount = greatest(round((subtotal + packaging_fee - remise_charge_restaurant) * v_rate)::integer, 0)
    where id = p_order_id returning * into v_order;
  return v_order;
end
$$;

-- Le du au restaurant : plats + emballage (qui lui revient), moins la
-- commission, moins ce qu'il a offert — le client ne l'a pas paye, il n'y a
-- rien a lui reverser pour cette part.
create or replace function public.record_settlement(p_restaurant_id uuid, p_period_start date, p_period_end date, p_paid_amount integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
declare v_due integer; v_row public.restaurant_settlements;
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  select coalesce(sum(o.subtotal + o.packaging_fee
                      - coalesce(o.commission_amount,
                                 greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                                * r.commission_rate)::integer, 0))
                      - o.remise_charge_restaurant), 0)
    into v_due
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.restaurant_id = p_restaurant_id and o.status = 'livree'
    and (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date
        between p_period_start and p_period_end;
  insert into public.restaurant_settlements (restaurant_id, period_start, period_end, amount_due, paid_amount, created_by)
  values (p_restaurant_id, p_period_start, p_period_end, v_due, p_paid_amount, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- Rapport journalier : memes colonnes, dans le meme ordre (create or replace
-- view n'accepte rien d'autre).
--   - livraisons_taxi_food : la remise ne diminue la livraison que si le code
--     portait sur la livraison ;
--   - a_reverser_au_restaurant : moins la part offerte par le restaurant
--     (l'emballage reste a part, dans emballage_a_arbitrer, comme avant) ;
--   - total_taxi_food : commission + livraison - la part de remise que Taxi Food
--     finance (remise totale moins la part du restaurant). Ainsi
--     a_reverser + emballage + total_taxi_food = facture_aux_clients, quel que
--     soit le code. Pour toutes les commandes passees la part du restaurant
--     vaut 0 et le seul code utilise portait sur la livraison : les chiffres
--     deja publies ne bougent pas.
create or replace view public.rapport_journalier as
 SELECT (o.created_at AT TIME ZONE 'Indian/Antananarivo'::text)::date AS jour,
    r.id AS restaurant_id,
    r.name AS restaurant,
    count(*) AS commandes,
    sum(o.subtotal) AS ca_marchandise,
    sum(o.commission_amount) AS commission_taxi_food,
    sum(o.subtotal - o.commission_amount - o.remise_charge_restaurant) AS a_reverser_au_restaurant,
    sum(o.delivery_fee - CASE WHEN o.promo_porte_sur = 'livraison'::text THEN COALESCE(o.promo_discount, 0) ELSE 0 END) AS livraisons_taxi_food,
    sum(o.commission_amount + o.delivery_fee - COALESCE(o.promo_discount, 0) + o.remise_charge_restaurant) AS total_taxi_food,
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'especes'::payment_method), 0::bigint) AS encaisse_par_les_livreurs,
    COALESCE(sum(GREATEST(o.total - rb.rendu_ar, 0)) FILTER (WHERE o.payment_method = 'cb'::payment_method AND (o.payment_status = ANY (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status]))), 0::bigint) AS encaisse_par_stripe,
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'cb'::payment_method AND (o.payment_status <> ALL (ARRAY['paye'::order_payment_status, 'rembourse'::order_payment_status]))), 0::bigint) AS carte_non_encaissee,
    COALESCE(sum(o.total) FILTER (WHERE o.payment_method = 'orange_money'::payment_method), 0::bigint) AS encaisse_hors_app,
    sum(o.packaging_fee) AS emballage_a_arbitrer,
    sum(o.total) AS facture_aux_clients,
    COALESCE(sum(rb.rendu_ar), 0::bigint) AS rembourse_par_stripe,
    count(*) FILTER (WHERE rb.rendu_ar > 0) AS commandes_remboursees
   FROM orders o
     JOIN restaurants r ON r.id = o.restaurant_id
     LEFT JOIN LATERAL ( SELECT COALESCE(sum(pr.amount_ar), 0::bigint)::integer AS rendu_ar
           FROM payment_refunds pr
          WHERE pr.order_id = o.id AND pr.status = 'effectue'::payment_refund_status) rb ON true
  WHERE o.status = 'livree'::order_status
  GROUP BY ((o.created_at AT TIME ZONE 'Indian/Antananarivo'::text)::date), r.id, r.name;

-- =====================================================================
-- 8. Charge n8n : le restaurant doit savoir qu'il a offert
-- =====================================================================
-- Deux cles de plus dans l'objet « commande », rien d'autre. Remplacement par
-- programme plutot que recopie des cent cinquante lignes de notify_order_status
-- (precedent : 20260909234500) : une faute de recopie dans la fonction qui
-- previent les restaurants couterait plus cher que l'opacite de ce bloc.
-- Idempotent, et s'interrompt s'il ne reconnait pas le motif.
do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'notify_order_status';

  if v_def is null then
    raise exception 'notify_order_status introuvable';
  end if;

  if v_def like '%''offert_par_restaurant''%' then
    return;
  end if;

  v_new := replace(v_def,
    '''emballage'',v_o.packaging_fee,',
    '''emballage'',v_o.packaging_fee,
      ''remise_charge_restaurant'',v_o.remise_charge_restaurant,
      ''offert_par_restaurant'',(v_o.remise_charge_restaurant > 0),');

  if v_new = v_def then
    raise exception 'motif « emballage » introuvable dans notify_order_status — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;
