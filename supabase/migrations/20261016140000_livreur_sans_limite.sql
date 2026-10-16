-- 20261016140000_livreur_sans_limite.sql
--
-- Un livreur prend AUTANT de commandes qu'il veut, chez AUTANT de restaurants
-- qu'il veut (décision du porteur du projet, redemandée le 2026-10-16).
--
-- Remplace la règle de 20260825_livreur_tournee_trois_commandes.sql (3 commandes
-- maximum, toutes du même restaurant). En production, cette limite avait déjà été
-- retirée de claim_order à la main, SANS fichier de migration : le dépôt disait
-- encore « 3, même restaurant », et l'app livreur appliquait toujours la règle de
-- son côté (file filtrée sur le restaurant de la 1re commande, « tournée complète »
-- à 3). D'où le livreur bloqué alors que la base aurait accepté.
--
-- Ce fichier fige l'état voulu (identique à la production au 2026-10-16) pour
-- qu'aucune réapplication des migrations ne remette la limite.
-- ⛔ Ne réintroduire aucun plafond ni contrôle de restaurant, ni ici ni dans l'app
-- (app/data/api.ts listAvailableDeliveries, app/app/(livreur)/index.tsx).

create or replace function public.claim_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders;
begin
  if not public.is_active_courier() then
    raise exception 'Acces livreur requis';
  end if;

  -- Prise ATOMIQUE : c'est le `courier_id is null` dans le WHERE qui garantit
  -- qu'un seul livreur gagne quand deux appuient au meme instant.
  update public.orders
     set courier_id = auth.uid()
   where id = p_order_id
     and status = 'en_livraison'
     and courier_id is null
  returning * into v_order;

  if v_order.id is null then
    raise exception 'Cette commande vient d''etre prise par quelqu''un d''autre';
  end if;

  return v_order;
end;
$function$;
