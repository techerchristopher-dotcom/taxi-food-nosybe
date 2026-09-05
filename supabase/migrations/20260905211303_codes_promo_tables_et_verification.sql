-- CODES PROMO — remise sur les frais de livraison (lancement, 2026-09-06).
--
-- Besoin metier : un code diffuse au lancement donne 50 % sur la LIVRAISON
-- seulement (10 000 -> 5 000 Ar). La commission prelevee sur les plats n'est
-- pas touchee : la remise sort de notre marge de livraison, pas de la poche du
-- restaurant. Chaque client ne peut l'utiliser qu'UNE SEULE fois.
--
-- ⚠️ TROIS PARTIS PRIS, dans l'ordre d'importance :
--
-- 1. L'UNICITE PAR CLIENT EST UNE CONTRAINTE, PAS UNE VERIFICATION.
--    `promo_redemptions` porte `unique (code_id, user_id)`. Un `select` suivi
--    d'un `insert` laisserait passer deux commandes envoyees en meme temps
--    depuis deux appareils : les deux liraient « pas encore utilise » avant que
--    l'une n'ait ecrit. C'est le seul endroit de ce chantier ou une erreur
--    coute de l'argent reel, donc c'est la base qui tranche, pas le code.
--
-- 2. LA REMISE EST CALCULEE EN BASE, JAMAIS ENVOYEE PAR LE CLIENT.
--    `create_order` ne recoit que le CODE SAISI (du texte). Elle relit le
--    bareme, relit `restaurants.delivery_fee`, recalcule, et ecrit le total.
--    Un client qui bricole la requete ne peut donc rien s'offrir.
--
-- 3. LA CONSOMMATION EST DANS LA MEME TRANSACTION QUE LA COMMANDE.
--    Elle est faite a l'interieur de `create_order`, pas par un appel separe.
--    Si l'insertion des lignes echoue, la consommation du code est annulee
--    avec elle ; si le code est refuse, aucune commande ne survit.

-- ---------------------------------------------------------------- outillage

-- Normalisation d'un code saisi. Un client tapera « lalie », « Lalie » ou
-- « LALIE  » : c'est le meme code. Sert A LA FOIS a l'index unique (via la
-- colonne generee) et a la recherche — un seul endroit ou la regle vit.
create or replace function public.normaliser_code_promo(p_code text)
returns text language sql immutable strict as $$
  select upper(regexp_replace(p_code, '\s', '', 'g'))
$$;

-- Montant de la remise, borne a la base sur laquelle elle porte : une remise ne
-- peut jamais rendre une ligne negative (100 % de la livraison = la livraison,
-- pas plus). Division entiere : on arrondit toujours EN FAVEUR de la maison,
-- l'Ariary n'a pas de centimes.
create or replace function public.remise_promo(p_type text, p_valeur integer, p_base integer)
returns integer language sql immutable as $$
  select least(
           greatest(case when p_type = 'pourcentage'
                         then (greatest(p_base, 0) * p_valeur) / 100
                         else p_valeur end, 0),
           greatest(p_base, 0))
$$;

-- ------------------------------------------------------------------- tables

create table if not exists public.promo_codes (
  id               uuid primary key default gen_random_uuid(),
  -- Le libelle tel qu'il est communique (« LALIE »), pour l'affichage.
  code             text not null,
  -- La forme comparee. Colonne GENEREE : impossible de l'oublier a l'insertion.
  code_normalise   text generated always as (public.normaliser_code_promo(code)) stored,
  type_remise      text not null check (type_remise in ('pourcentage', 'montant')),
  valeur           integer not null check (valeur > 0),
  -- Aujourd'hui seule la livraison est remisee. La colonne existe des maintenant
  -- pour qu'une remise sur les plats ne demande pas de refonte — la seule chose
  -- qui changera alors est la base de calcul, pas le schema.
  porte_sur        text not null default 'livraison' check (porte_sur in ('livraison', 'sous_total')),
  actif            boolean not null default true,
  commence_le      timestamptz,
  expire_le        timestamptz,
  -- Plafond GLOBAL du nombre d'utilisations, tous clients confondus. null = illimite.
  max_utilisations integer check (max_utilisations is null or max_utilisations > 0),
  description      text,
  created_at       timestamptz not null default now(),
  constraint promo_codes_pourcentage_borne
    check (type_remise <> 'pourcentage' or valeur between 1 and 100),
  constraint promo_codes_fenetre_coherente
    check (commence_le is null or expire_le is null or commence_le < expire_le)
);

create unique index if not exists promo_codes_code_normalise_unique
  on public.promo_codes (code_normalise);

create table if not exists public.promo_redemptions (
  id             uuid primary key default gen_random_uuid(),
  code_id        uuid not null references public.promo_codes (id) on delete restrict,
  -- ⚠️ `on delete cascade` : si le compte est supprime, la trace part avec lui.
  -- Assume — le RGPD prime, et recreer un compte pour rejouer un code de
  -- lancement est un cout disproportionne par rapport au gain (5 000 Ar).
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- `restrict` : une commande portant une remise ne peut pas etre effacee en
  -- laissant le code libre. Les commandes ne sont de toute facon jamais
  -- supprimees (la suppression de compte les anonymise).
  order_id       uuid not null references public.orders (id) on delete restrict,
  montant_remise integer not null check (montant_remise >= 0),
  created_at     timestamptz not null default now(),
  -- LA garantie « une fois par client ». Tout le reste n'est que confort.
  constraint promo_redemptions_un_par_client unique (code_id, user_id)
);

create index if not exists promo_redemptions_code_idx on public.promo_redemptions (code_id);
create index if not exists promo_redemptions_order_idx on public.promo_redemptions (order_id);

-- Le code applique et le montant sont RECOPIES sur la commande : elle doit
-- rester lisible meme si le code est desactive ou supprime plus tard, comme les
-- noms de produits sont deja figes dans `order_items`.
alter table public.orders
  add column if not exists promo_code     text,
  add column if not exists promo_discount integer not null default 0;

comment on column public.orders.promo_code is
  'Code promo applique, forme normalisee. Instantane : ne suit pas promo_codes.';
comment on column public.orders.promo_discount is
  'Remise en Ariary deja deduite de `total`. 0 si aucun code.';

-- ---------------------------------------------------------------------- RLS
-- Aucune ecriture directe, comme partout ailleurs dans ce projet : tout passe
-- par des fonctions SECURITY DEFINER. Un client ne doit pas pouvoir lire la
-- table des codes (il y trouverait tous les codes en cours), ni ecrire une
-- consommation. On active la RLS SANS policy cote client : refus par defaut.
alter table public.promo_codes       enable row level security;
alter table public.promo_redemptions enable row level security;

drop policy if exists promo_codes_select_admin on public.promo_codes;
create policy promo_codes_select_admin on public.promo_codes
  for select using (public.is_admin());

drop policy if exists promo_redemptions_select_admin on public.promo_redemptions;
create policy promo_redemptions_select_admin on public.promo_redemptions
  for select using (public.is_admin());

-- ------------------------------------------------------- regle de validite
-- Une seule fonction dit POURQUOI un code est refuse, pour que l'ecran de
-- verification et la creation de commande ne puissent pas diverger. Elle rend
-- un code de raison, jamais une phrase : la traduction est l'affaire de l'app.
create or replace function public.raison_invalidite_promo(
  p_promo public.promo_codes, p_utilisations integer, p_deja_utilise boolean)
returns text language sql stable as $$
  select case
    when p_promo.id is null then 'inconnu'
    when not p_promo.actif then 'inactif'
    when p_promo.commence_le is not null and now() < p_promo.commence_le then 'pas_encore'
    when p_promo.expire_le   is not null and now() > p_promo.expire_le   then 'expire'
    when p_promo.max_utilisations is not null
         and p_utilisations >= p_promo.max_utilisations then 'epuise'
    when p_deja_utilise then 'deja_utilise'
    else null
  end
$$;

-- ------------------------------------------- 1) verification, sans consommer
-- Appelee quand le client tape son code au recapitulatif. Elle ne pose AUCUN
-- verrou et n'ecrit rien : elle repond « voila ce que tu economiserais ». Le
-- montant definitif reste celui que `create_order` recalculera.
--
-- ⚠️ `p_sous_total` vient du client et ne sert QU'A l'apercu d'une remise sur
-- les plats (aucune n'existe aujourd'hui). Il n'entre jamais dans un montant
-- facture : `create_order` ignore ce parametre et relit le panier en base.
create or replace function public.verifier_code_promo(
  p_code text, p_restaurant_id uuid, p_sous_total integer default 0)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_promo  public.promo_codes;
  v_n      integer := 0;
  v_deja   boolean := false;
  v_base   integer;
  v_raison text;
begin
  -- Le « deja utilise » n'a de sens que pour quelqu'un d'identifie. On ne
  -- valide donc pas un code a un visiteur : il se connectera de toute facon
  -- avant de commander, et lui annoncer une remise qu'on ne peut pas verifier
  -- serait une promesse en l'air.
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

  if v_promo.porte_sur = 'livraison' then
    select delivery_fee into v_base from public.restaurants where id = p_restaurant_id;
    if v_base is null then
      return jsonb_build_object('valide', false, 'raison', 'restaurant_inconnu');
    end if;
  else
    v_base := greatest(coalesce(p_sous_total, 0), 0);
  end if;

  return jsonb_build_object(
    'valide',      true,
    'code',        v_promo.code_normalise,
    'porte_sur',   v_promo.porte_sur,
    'remise',      public.remise_promo(v_promo.type_remise, v_promo.valeur, v_base),
    'description', v_promo.description);
end;
$$;

-- ----------------------------------- 2) creation de commande + consommation
--
-- ⚠️ BUG DE PRODUCTION TROUVE EN CHEMIN — LIRE AVANT DE TOUCHER AUX SIGNATURES.
--
-- Deux surcharges de `create_order` a QUATRE arguments coexistaient
-- (`p_payment_method` en `text` et en `payment_method`) : la migration
-- « adresse introuvable » du 2026-09-05 avait recree la fonction en changeant
-- le type de ce parametre, ce qui n'ecrase pas l'ancienne mais en AJOUTE une.
-- PostgREST refuse alors de choisir et repond PGRST203 « Could not choose the
-- best candidate function ». Verifie par un vrai appel HTTP avec la cle anon :
-- l'app publiee, qui envoie quatre parametres, ne pouvait plus creer AUCUNE
-- commande. Aucune commande n'avait ete passee depuis, personne ne l'avait vu.
-- Les deux corps avaient en prime DIVERGE (le correctif d'adresse n'etait que
-- dans l'un des deux).
--
-- D'ou la forme retenue :
--   * UNE implementation, a 5 arguments, qui porte tout le code ;
--   * UNE enveloppe a 4 arguments — la signature historique, typee
--     `payment_method` — que les versions deja installees sur l'App Store et le
--     Play Store continuent d'appeler. La supprimer casserait leurs commandes ;
--   * la surcharge `text` a 4 arguments est SUPPRIMEE : c'est elle qui creait
--     l'ambiguite.
--
-- ⚠️ AUCUNE VALEUR PAR DEFAUT sur `p_code_promo` : avec un defaut, un corps
-- JSON a quatre cles correspondrait a la fois a l'enveloppe et a
-- l'implementation, et l'ambiguite reviendrait par la fenetre.

create or replace function public.create_order(
  p_restaurant_id uuid,
  p_address_id    uuid,
  p_payment_method text,
  p_items         jsonb,
  p_code_promo    text)
returns public.orders
language plpgsql security definer set search_path = public
as $$
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
  -- Les frais de livraison et le taux de commission viennent de la BASE. Le
  -- client n'en envoie aucun : c'est ce qui rend impossible de se livrer
  -- gratuitement en bricolant la requete.
  select delivery_fee, commission_rate
    into v_delivery_fee, v_commission_rate
    from public.restaurants where id = p_restaurant_id;
  if v_delivery_fee is null then
    raise exception 'Restaurant introuvable';
  end if;
  v_commission_rate := coalesce(v_commission_rate, 0);

  select * into v_address from public.addresses
    where id = p_address_id and user_id = auth.uid();

  -- Deux causes distinctes, deux messages distincts : une adresse absente
  -- envoyait le client recapturer une position parfaitement valide, en boucle.
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
    -- Une boite par article emballe (une pizza = une boite).
    v_packaging := v_packaging + coalesce(v_product.packaging_fee, 0) * v_qty;
  end loop;

  --------------------------------------------------------------- code promo
  -- Place APRES la boucle : une remise peut porter sur le sous-total, qui n'est
  -- connu qu'ici. Place AVANT le calcul du total : c'est la base qui arbitre.
  if p_code_promo is not null and btrim(p_code_promo) <> '' then
    -- `for update` verrouille la LIGNE DU CODE : deux commandes simultanees
    -- utilisant le meme code se serialisent ici, donc le plafond global ne peut
    -- pas etre depasse par une course. L'unicite par client, elle, ne repose
    -- surtout pas sur ce comptage — voir l'insertion plus bas.
    select * into v_promo from public.promo_codes
     where code_normalise = public.normaliser_code_promo(p_code_promo)
     for update;

    if v_promo.id is not null then
      select count(*) into v_promo_n
        from public.promo_redemptions where code_id = v_promo.id;
    end if;

    -- `p_deja_utilise => false` : ce n'est PAS un oubli. Verifier ici puis
    -- inserer laisserait passer deux commandes concurrentes. On laisse la
    -- contrainte unique trancher, et on traduit sa violation juste apres.
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
      -- La contrainte a parle : ce client a deja consomme ce code. Toute la
      -- transaction est annulee, commande comprise.
      raise exception 'code_promo:deja_utilise' using errcode = '22023';
    end;
  end if;

  update public.orders
    set subtotal       = v_subtotal,
        packaging_fee  = v_packaging,
        promo_code     = case when v_promo.id is not null then v_promo.code_normalise end,
        promo_discount = v_remise,
        total          = v_subtotal + v_packaging + v_delivery_fee - v_remise,
        -- MARCHANDISE SEULE : ni l'emballage, ni la livraison, ni la remise
        -- n'entrent dans la commission. La remise sur la livraison sort de
        -- notre marge, jamais de ce que le restaurant percoit.
        commission_amount = round(v_subtotal * v_commission_rate)::integer
    where id = v_order.id
    returning * into v_order;

  return v_order;
end;
$$;

-- La surcharge en trop, celle qui rendait l'appel a 4 arguments ambigu.
drop function if exists public.create_order(uuid, uuid, text, jsonb);

-- Enveloppe historique (4 arguments) : l'app deja installee passe par la.
create or replace function public.create_order(
  p_restaurant_id uuid, p_address_id uuid, p_payment_method public.payment_method, p_items jsonb)
returns public.orders
language sql security definer set search_path = public
as $$
  select public.create_order(p_restaurant_id, p_address_id, p_payment_method::text, p_items, null::text)
$$;

-- ------------------------------------------------------------ le code du jour
-- LALIE : 50 % sur la livraison, actif, sans date de fin ni plafond global.
-- Le libelle est un choix par defaut ; le porteur du projet peut le remplacer
-- (un `update promo_codes set code = '...'` suffit, la colonne normalisee suit).
insert into public.promo_codes (code, type_remise, valeur, porte_sur, actif, description)
values ('LALIE', 'pourcentage', 50, 'livraison', true,
        'Code de lancement : 50 % sur les frais de livraison, une fois par client.')
on conflict do nothing;
