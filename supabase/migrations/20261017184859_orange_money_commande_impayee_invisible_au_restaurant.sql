-- ORANGE MONEY EN LIGNE : une commande pas encore payée n'existe pas pour le restaurant.
--
-- La garde de notify_order_status ferme le push, l'e-mail et le Telegram. Restait
-- la tablette : `listRestaurantOrders` ne masque que les commandes CARTE impayées,
-- et une app restaurateur pas encore mise à jour ne connaît pas Orange Money en
-- ligne. La porte se ferme donc EN BASE, pour toutes les versions : la policy
-- restaurant ne rend plus une commande née en Orange Money tant qu'elle n'est pas
-- payée. Elle réapparaît d'elle-même au paiement, ou au repli en espèces
-- (`basculer_en_especes` remet `om_en_ligne` à faux).
-- La carte garde son filtre côté app (inchangé) : on ne touche pas ce qui marche.
drop policy if exists orders_select_restaurant on public.orders;
create policy orders_select_restaurant on public.orders
  for select
  using (is_active_restaurant_staff_of(restaurant_id)
         and not (om_en_ligne
                  and payment_method = 'orange_money'
                  and payment_status in ('non_requis', 'en_attente', 'echoue')));
