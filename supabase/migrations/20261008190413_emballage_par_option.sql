-- Emballage PAR OPTION (2026-10-08, demande du porteur du projet) — tous restaurants.
--
-- Jusqu'ici l'emballage ne dépendait que du PLAT (`products.packaging_fee` : boîte à pizza, barquette
-- de tacos). Une option ne pouvait pas en ajouter. Or chez L'escale Créole chaque composant part dans
-- SA barquette : riz, plat, grains (inclus mais refusables), et chaque supplément riz / grains / frites.
--
-- - `product_options.packaging_fee` (défaut 0) : emballage AJOUTÉ par l'option, par exemplaire.
-- - `create_order` : emballage d'une ligne = emballage du plat + Σ emballage des options choisies.
--   Il est figé dans `order_items.packaging_fee_snapshot` (par exemplaire, comme avant) : tout ce qui
--   relit les commandes (Telegram, reversements, rapports, suivi client) reste juste sans changement.
-- - `apercu_code_promo` : même calcul, pour que la remise annoncée soit celle facturée.
-- - Aucun autre restaurant n'a d'emballage sur ses options : leurs commandes sont inchangées.
--
-- Les deux fonctions sont modifiées EN PLACE à partir de leur définition en base (remplacements
-- ciblés, chacun vérifié) : rien d'autre de leur corps ne bouge.

alter table public.product_options
  add column if not exists packaging_fee integer not null default 0;
do $$ begin
  alter table public.product_options add constraint product_options_packaging_fee_positif check (packaging_fee >= 0);
exception when duplicate_object then null; end $$;

do $$
declare
  d text; n text;
begin
  -- create_order -------------------------------------------------------------------------------
  d := pg_get_functiondef('public.create_order(uuid,uuid,text,jsonb,text,boolean)'::regprocedure);
  if position('v_item_pack' in d) > 0 then
    raise notice 'create_order : déjà migrée';
  else
    n := replace(d, E'  v_options_delta integer;\n',
                    E'  v_options_delta integer;\n  v_options_pack integer;\n  v_item_pack   integer;\n');
    if n = d then raise exception 'create_order : déclaration introuvable'; end if; d := n;

    n := replace(d,
      E'select count(*), coalesce(sum(po.price_delta * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)), 0)\n      into v_valid_options_count, v_options_delta',
      E'select count(*), coalesce(sum(po.price_delta * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)), 0),\n           coalesce(sum(po.packaging_fee * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)), 0)\n      into v_valid_options_count, v_options_delta, v_options_pack');
    if n = d then raise exception 'create_order : somme des options introuvable'; end if; d := n;

    n := replace(d, E'    v_qty := (v_item->>''quantity'')::integer;\n',
      E'    v_qty := (v_item->>''quantity'')::integer;\n    -- Emballage d''un exemplaire : celui du plat + celui des options (barquette de grains, de riz en plus…).\n    v_item_pack := coalesce(v_product.packaging_fee, 0) + v_options_pack;\n');
    if n = d then raise exception 'create_order : quantité introuvable'; end if; d := n;

    n := replace(d,
      E'coalesce(v_product.packaging_fee, 0),\n            case when coalesce(v_product.packaging_fee, 0) > 0 then v_product.packaging_label end)',
      E'v_item_pack,\n            case when v_item_pack > 0 then coalesce(v_product.packaging_label, ''Emballage à emporter'') end)');
    if n = d then raise exception 'create_order : instantané d''emballage introuvable'; end if; d := n;

    n := replace(d, 'coalesce(v_product.packaging_fee, 0) * v_qty', 'v_item_pack * v_qty');
    if n = d then raise exception 'create_order : cumul d''emballage introuvable'; end if; d := n;

    execute d;
  end if;

  -- apercu_code_promo --------------------------------------------------------------------------
  d := pg_get_functiondef('public.apercu_code_promo(text,uuid,jsonb)'::regprocedure);
  if position('o.emb' in d) > 0 then
    raise notice 'apercu_code_promo : déjà migrée';
  else
    n := replace(d, 'coalesce(p.packaging_fee, 0) * q.qty          as emballage',
                    '(coalesce(p.packaging_fee, 0) + coalesce(o.emb, 0)) * q.qty as emballage');
    if n = d then raise exception 'apercu : emballage introuvable'; end if; d := n;

    n := replace(d,
      E'select sum(po.price_delta * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)) as delta\n',
      E'select sum(po.price_delta * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)) as delta,\n                   sum(po.packaging_fee * greatest(coalesce((opt->>''quantity'')::integer, 1), 1)) as emb\n');
    if n = d then raise exception 'apercu : somme des options introuvable'; end if; d := n;

    execute d;
  end if;
end $$;

-- L'escale Créole : une barquette par composant ------------------------------------------------
do $$
declare
  v_resto constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  n int;
begin
  -- Plats : barquette riz + barquette plat = 2 000 ; bol renversé et riz frit (riz DANS le plat) = 1 000.
  update public.products p
     set packaging_fee = case when p.name in ('Bol renversé poulet ou zébu', 'Riz frit poulet ou zébu') then 1000 else 2000 end,
         packaging_label = 'Emballage à emporter'
   where p.restaurant_id = v_resto and not p.is_archived
     and exists (select 1 from public.product_option_groups g where g.product_id = p.id and g.name = 'Grains (haricots blancs)');
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'plats escale : % ligne(s), 16 attendues', n; end if;

  -- Grains inclus : leur barquette.
  update public.product_options o set packaging_fee = 1000
    from public.product_option_groups g join public.products p on p.id = g.product_id
   where o.group_id = g.id and p.restaurant_id = v_resto
     and g.name = 'Grains (haricots blancs)' and o.name = 'Avec grains (inclus)';
  get diagnostics n = row_count;
  if n <> 16 then raise exception 'grains escale : % ligne(s), 16 attendues', n; end if;

  -- Suppléments : riz et grains à 6 000 (le millier était l'emballage), frites 10 000 ; +1 000 de barquette chacun.
  update public.product_options o
     set price_delta = case o.name when 'Frites' then 10000 else 6000 end,
         packaging_fee = 1000
    from public.product_option_groups g join public.products p on p.id = g.product_id
   where o.group_id = g.id and p.restaurant_id = v_resto
     and g.name = 'Supplément' and o.name in ('Frites', 'Riz supplémentaire', 'Grains en plus');
  get diagnostics n = row_count;
  if n <> 48 then raise exception 'suppléments escale : % ligne(s), 48 attendues', n; end if;
end $$;
