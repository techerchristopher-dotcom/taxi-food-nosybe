-- Assignation manuelle d'un livreur par l'administrateur.
--
-- En fonctionnement normal, un livreur prend lui-meme une commande passee en
-- `en_livraison`. Il manquait le rattrapage : livreur qui accepte puis ne part
-- pas, telephone eteint, ou commande que personne ne prend un dimanche soir.
-- Sans ce geste, la seule issue etait d'annuler une commande valide.
--
-- ⚠️ On NE verifie PAS que le livreur est marque disponible. C'est delibere :
-- l'usage principal de cette fonction est justement de rattraper une situation
-- ou l'etat declare ne correspond plus a la realite du terrain. Verifier la
-- disponibilite reviendrait a interdire l'outil au moment ou il sert.
--
-- On verifie en revanche que la personne est bien un livreur (ligne `couriers`)
-- et un compte reel : assigner a n'importe quel uuid produirait une commande
-- qui n'apparait sur l'ecran d'aucun livreur, sans erreur visible.
--
-- p_courier_id a NULL = retirer l'assignation, et remettre la commande dans la
-- file ou n'importe quel livreur peut la prendre.
create or replace function public.admin_assign_courier(
  p_order_id uuid,
  p_courier_id uuid
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_avant uuid;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  v_avant := v_order.courier_id;

  if p_courier_id is not null
     and not exists (select 1 from public.couriers c where c.user_id = p_courier_id) then
    raise exception 'Cette personne n''est pas un livreur';
  end if;

  update public.orders
     set courier_id = p_courier_id,
         -- Retirer un livreur doit aussi effacer « recuperee », sinon la
         -- commande reste marquee prise en charge par personne.
         picked_up_at = case when p_courier_id is null then null else picked_up_at end
   where id = p_order_id
   returning * into v_order;

  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres)
  values (auth.uid(), 'assignation_livreur', p_order_id, v_order.restaurant_id,
          coalesce(v_avant::text, 'aucun'), coalesce(p_courier_id::text, 'aucun'));

  return v_order;
end $$;

revoke execute on function public.admin_assign_courier(uuid, uuid) from public, anon;
grant  execute on function public.admin_assign_courier(uuid, uuid) to authenticated;
