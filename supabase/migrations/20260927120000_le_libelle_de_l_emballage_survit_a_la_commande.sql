-- Pourquoi : deux frais cohabitent chez La Cabane — « Emballage à emporter »
-- (1 000 Ar par plat) et « Consigne bouteille » (2 000 Ar par bouteille, +40 %
-- du prix d'une boisson à 5 000). Le panier les distingue, mais `orders` ne
-- garde que le total : après paiement, les deux fusionnaient en un seul
-- « Emballage » sur le suivi client et sur la carte du restaurant, et le
-- Telegram de cuisine ne les listait pas du tout — alors que c'est le
-- restaurant qui encaisse la consigne et devra la rendre.
--
-- Décision du porteur du projet (27/09/2026) : emballage ET consigne restent
-- commissionnés. Ni `total` ni `commission_amount` ne bougent d'un ariary ;
-- ce fichier ne touche à aucune formule. Il fige le libellé et le montant
-- unitaire sur CHAQUE ligne de commande, et expose les lignes regroupées au
-- restaurant.
--
-- ⚠️ `create_order` existe en DEUX surcharges (piège PGRST203 du 2026-09-05).
-- On ne la retape pas : on remplace une ancre dans sa définition en place et
-- on la ré-exécute — même signature, donc remplacement, pas surcharge.

alter table public.order_items
  add column if not exists packaging_fee_snapshot integer not null default 0,
  add column if not exists packaging_label_snapshot text;
comment on column public.order_items.packaging_fee_snapshot is
  'Frais d''emballage par exemplaire, figé à la commande (0 si aucun).';
comment on column public.order_items.packaging_label_snapshot is
  'Libellé de l''emballage tel qu''il a été facturé (« Boîte à pizza », « Consigne bouteille »…).';

do $$
declare v_def text;
  a constant text := $x$insert into public.order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, comment)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_unit_price, v_item->>'comment')$x$;
  n constant text := $x$insert into public.order_items (order_id, product_id, product_name_snapshot, quantity, unit_price, comment,
                                    packaging_fee_snapshot, packaging_label_snapshot)
    values (v_order.id, v_product.id, v_product.name, v_qty, v_unit_price, v_item->>'comment',
            coalesce(v_product.packaging_fee, 0),
            case when coalesce(v_product.packaging_fee, 0) > 0 then v_product.packaging_label end)$x$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'create_order'
     and pg_get_function_arguments(p.oid) like '%p_code_promo text%';
  if v_def is null or position(a in v_def) = 0 then
    raise exception 'ancre introuvable dans create_order : rien modifie';
  end if;
  execute replace(v_def, a, n);
end $$;

-- Les commandes déjà passées : on reconstitue l'instantané depuis le produit
-- tel qu'il est aujourd'hui. Seules les lignes dont le total d'emballage de la
-- commande est cohérent avec ce calcul sont remplies — sinon on laisse à 0
-- plutôt que d'inventer un libellé.
update public.order_items oi
   set packaging_fee_snapshot = coalesce(p.packaging_fee, 0),
       packaging_label_snapshot = p.packaging_label
  from public.products p, public.orders o
 where p.id = oi.product_id and o.id = oi.order_id
   and coalesce(p.packaging_fee, 0) > 0
   and o.packaging_fee = (select sum(coalesce(p2.packaging_fee, 0) * oi2.quantity)
                            from public.order_items oi2
                            left join public.products p2 on p2.id = oi2.product_id
                           where oi2.order_id = o.id);

-- Le restaurant (charge n8n) et l'admin (Telegram direct) reçoivent une ligne
-- par libellé, avec le nombre d'unités : « Consigne bouteille - 3 x 2000 = 6000 Ar ».
do $$
declare v_def text;
  a1 constant text := $x$'livraison_adresse', jsonb_build_object('zone',a.zone,'precisions',a.landmark,$x$;
  n1 constant text := $x$'emballages', coalesce((
      select jsonb_agg(jsonb_build_object('libelle', e.libelle, 'unites', e.unites,
                                          'unitaire', e.unitaire, 'montant', e.montant)
                       order by e.libelle)
        from (select coalesce(oi.packaging_label_snapshot, 'Emballage') as libelle,
                     oi.packaging_fee_snapshot as unitaire,
                     sum(oi.quantity)::int as unites,
                     sum(oi.quantity * oi.packaging_fee_snapshot)::int as montant
                from public.order_items oi
               where oi.order_id = v_o.id and oi.packaging_fee_snapshot > 0
               group by 1, 2) e), '[]'::jsonb),
    'livraison_adresse', jsonb_build_object('zone',a.zone,'precisions',a.landmark,$x$;
  a2 constant text := $x$|| 'Total : ' || coalesce(v_charge->'commande'->>'total', '?') || ' Ar'$x$;
  n2 constant text := $x$|| coalesce((select string_agg('- ' || (e->>'libelle') || ' - ' || (e->>'unites') || ' x '
                                          || (e->>'unitaire') || ' = ' || (e->>'montant') || ' Ar', chr(10))
                             || chr(10) || chr(10)
                        from jsonb_array_elements(v_charge->'emballages') e), '')
          || 'Total : ' || coalesce(v_charge->'commande'->>'total', '?') || ' Ar'$x$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname = 'notify_order_status';
  if position(a1 in v_def) = 0 or position(a2 in v_def) = 0 then
    raise exception 'ancre introuvable dans notify_order_status : rien modifie';
  end if;
  execute replace(replace(v_def, a1, n1), a2, n2);
end $$;
