-- La page « Commande acceptée / refusée » (landing/netlify/functions/repondre-commande.mjs)
-- s'affiche dans la langue du restaurant (restaurants.langue, voir 20261002120000).
-- La langue n'est renvoyée qu'APRES vérification du jeton : un lien invalide n'apprend rien.
-- Le motif de refus enregistré reste en français : il part au CLIENT, pas au restaurant.
create or replace function public.repondre_commande_par_jeton(p_order_id uuid, p_token uuid, p_action text, p_motif text default null::text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_order public.orders; v_resto text; v_jeton uuid; v_auto boolean; v_langue text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  select j.jeton into v_jeton from public.order_accept_jetons j where j.order_id = p_order_id;

  if v_jeton is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;

  select langue into v_langue from public.restaurants where id = v_order.restaurant_id;

  if v_order.status <> 'recue' then
    return jsonb_build_object('ok', false, 'raison', 'deja traitee',
                              'statut', v_order.status::text, 'langue', coalesce(v_langue, 'fr'));
  end if;

  if p_action = 'accepter' then
    update public.orders set status = 'confirmee', status_updated_at = now()
     where id = p_order_id returning * into v_order;
  elsif p_action = 'refuser' then
    if nullif(btrim(coalesce(p_motif,'')), '') is null then
      return jsonb_build_object('ok', false, 'raison', 'motif obligatoire');
    end if;
    update public.orders set status = 'annulee', status_updated_at = now(),
           cancellation_reason = btrim(p_motif)
     where id = p_order_id returning * into v_order;
  else
    return jsonb_build_object('ok', false, 'raison', 'action inconnue');
  end if;

  select name, preparation_auto into v_resto, v_auto
    from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto,
                            'preparation_auto', coalesce(v_auto, false),
                            'langue', coalesce(v_langue, 'fr'));
end $function$;
