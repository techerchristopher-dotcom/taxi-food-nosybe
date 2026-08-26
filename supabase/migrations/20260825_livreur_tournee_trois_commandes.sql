-- 20260825_livreur_tournee_trois_commandes.sql
-- Applique sur la base de production le 2026-08-25 via le connecteur MCP.
--
-- Le livreur peut desormais tenir JUSQU'A TROIS commandes en meme temps,
-- a condition qu'elles viennent TOUTES DU MEME RESTAURANT.
--
-- Pourquoi le meme restaurant plutot que plusieurs : ca supprime la question
-- de l'ordre des ramassages. Un seul point de retrait, puis jusqu'a trois
-- livraisons. Les plats sortent aussi de la meme cuisine a peu pres au meme
-- moment, ce qui limite le refroidissement du premier servi — c'est le vrai
-- cout du groupage. Effet de bord heureux : le message envoye au client
-- (« le livreur a recupere ta commande et arrive ») reste VRAI pour les
-- trois, puisqu'il part avec tout d'un coup.
--
-- Remplace la regle « une seule commande a la fois » (V1).

create or replace function public.claim_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order     public.orders;
  v_nb        integer;
  v_nb_restos integer;
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

  -- Les deux invariants sont verifies APRES la prise, pas avant. Un controle
  -- prealable serait faux : deux prises simultanees par le MEME livreur
  -- liraient toutes deux l'etat d'avant et passeraient toutes deux. Ici, la
  -- levee d'exception annule la transaction, donc la prise elle-meme.
  -- Verifie le 2026-08-25 : la commande refusee reste bien libre.
  select count(*), count(distinct restaurant_id)
    into v_nb, v_nb_restos
    from public.orders
   where courier_id = auth.uid()
     and status = 'en_livraison';

  if v_nb > 3 then
    raise exception 'Tu as deja trois commandes. Livres-en une avant d''en prendre une autre.';
  end if;

  if v_nb_restos > 1 then
    raise exception 'Toutes tes commandes doivent venir du meme restaurant.';
  end if;

  return v_order;
end;
$function$;
