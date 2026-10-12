-- Le client voit si SON paiement Orange Money est arrivé (carte « Payer par Orange Money »
-- remplacée par « Paiement Orange Money reçu, merci »). Ne rend que l'état, et seulement au
-- propriétaire de la commande. La table reste privée.
create or replace function public.mon_paiement_orange_money(p_order_id uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select p.etat
    from public.paiements_orange_money p
    join public.orders o on o.id = p.order_id
   where p.order_id = p_order_id and o.user_id = auth.uid();
$$;
revoke all on function public.mon_paiement_orange_money(uuid) from public, anon;
grant execute on function public.mon_paiement_orange_money(uuid) to authenticated;
