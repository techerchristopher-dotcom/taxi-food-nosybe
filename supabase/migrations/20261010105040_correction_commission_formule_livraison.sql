-- admin_corriger_commande : la commission recalculée suit EXACTEMENT la formule de
-- mark_order_delivered (qui la recalcule à la livraison) :
--   greatest(round((subtotal + packaging_fee − emballage_taxifood − remise_charge_restaurant) × taux), 0)
-- au taux figé sur la commande (orders.commission_rate, à défaut celui du restaurant).
-- La première version oubliait `emballage_taxifood` (Les Siciliens). Sans effet sur TF-377
-- (emballage_taxifood = 0). Patch par ancre, rien d'autre ne bouge.
do $$
declare d text; n text;
begin
  d := pg_get_functiondef('public.admin_corriger_commande(uuid,jsonb,text,boolean)'::regprocedure);
  n := replace(d,
    E'  v_commission := greatest(round((v_plats + v_pack - v_resto) * v_rate)::integer, 0);\n  v_total := v_plats + v_pack + o.delivery_fee - v_remise - v_pm;\n  v_emb_tf := case when (select r.emballage_pour_taxifood from public.restaurants r where r.id = o.restaurant_id)\n                   then v_pack else 0 end;\n',
    E'  v_emb_tf := case when (select r.emballage_pour_taxifood from public.restaurants r where r.id = o.restaurant_id)\n                   then v_pack else 0 end;\n  -- Formule de mark_order_delivered, au taux figé sur la commande.\n  v_commission := greatest(round((v_plats + v_pack - v_emb_tf - v_resto) * v_rate)::integer, 0);\n  v_total := v_plats + v_pack + o.delivery_fee - v_remise - v_pm;\n');
  if n = d then raise exception 'admin_corriger_commande : ancre de commission introuvable'; end if;
  execute n;
end $$;
