-- La commission porte aussi sur l'emballage, et chaque commande fige sur quoi
-- portait sa remise.
--
-- Deux manques constates le 2026-09-09 en relisant le rapport de cloture :
--
-- 1. L'EMBALLAGE ECHAPPAIT A TOUT. 30 pizzas (Chez Bidul & Truc, Les Siciliens)
--    portent une « Boite a pizza » a 2 000 Ar. Le client la payait, mais elle
--    n'entrait ni dans le net a reverser au restaurant, ni dans la marge
--    affichee : sur une commande de deux pizzas, 4 000 Ar sortaient du tableau
--    sans que personne ne les voie. Arbitrage du porteur du projet : l'emballage
--    revient au restaurant (c'est lui qui achete les boites) ET la commission
--    s'applique dessus. La base commissionnable devient donc plats + emballage.
--
-- 2. LA REMISE NE DISAIT PAS SUR QUOI ELLE PORTAIT. Le rapport retranchait la
--    remise des frais de livraison dans TOUS les cas — juste tant que le seul
--    code existant (TAXIFOOD50) portait sur la livraison, faux des le premier
--    code sur les plats. `porte_sur` vit dans `promo_codes`, une table qu'on
--    peut modifier ou vider : un rapport de septembre changerait alors en
--    octobre. On fige donc la valeur sur la commande, comme
--    `product_name_snapshot` fige le nom d'un plat.
--
-- ⚠️ Les commandes DEJA passees gardent leur `commission_amount` : c'est un
-- montant convenu ce jour-la, pas une formule a rejouer. Seules les nouvelles
-- commandes portent la commission sur l'emballage.

alter table public.orders
  add column if not exists promo_porte_sur text;

comment on column public.orders.promo_porte_sur is
  'Sur quoi portait le code promo applique : « livraison » ou « produits ». Fige a la creation, jamais relu depuis promo_codes.';

-- Rattrapage des commandes deja passees, tant que les codes existent encore.
update public.orders o
   set promo_porte_sur = pc.porte_sur
  from public.promo_codes pc
 where o.promo_code = pc.code_normalise
   and o.promo_code is not null
   and o.promo_porte_sur is null;

-- Remplacement par programme plutot que recopie des deux cents lignes de
-- `create_order` : une faute de recopie couterait plus cher que l'opacite de ce
-- bloc. Idempotent, et s'interrompt s'il ne reconnait rien.
do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_order'
    and pg_get_function_identity_arguments(p.oid) like '%p_code_promo%';

  if v_def is null then
    raise exception 'create_order (5 arguments) introuvable';
  end if;

  -- a) la commission porte sur plats + emballage
  v_new := replace(v_def,
    'commission_amount = round(v_subtotal * v_commission_rate)::integer',
    'commission_amount = round((v_subtotal + v_packaging) * v_commission_rate)::integer');

  -- b) on fige sur quoi portait la remise
  v_new := replace(v_new,
    '        promo_code     = v_code_applique,',
    '        promo_code     = v_code_applique,
        promo_porte_sur = case when v_code_applique is null then null else v_promo.porte_sur end,');

  if v_new not like '%(v_subtotal + v_packaging) * v_commission_rate%'
     or v_new not like '%promo_porte_sur = case when v_code_applique is null%' then
    raise exception 'motifs introuvables dans create_order — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;
