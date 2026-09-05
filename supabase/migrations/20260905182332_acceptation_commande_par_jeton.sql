-- ACCEPTER UNE COMMANDE DEPUIS TELEGRAM, SANS COMPTE.
--
-- Le probleme : `set_order_status` exige d'etre PERSONNEL du restaurant
-- (`is_active_restaurant_staff_of`). Or aucun restaurateur n'a de compte
-- aujourd'hui, et leur en creer un pour qu'ils acceptent une commande depuis
-- Telegram irait contre l'interet du canal — sa force, c'est justement qu'il ne
-- demande rien a installer.
--
-- La solution : un jeton par commande, imprevisible, a usage limite. Le bouton
-- Telegram porte un lien qui contient ce jeton ; la fonction ci-dessous le
-- verifie et change le statut. Personne ne peut deviner le jeton d'une commande
-- qu'il n'a pas recue.
--
-- ⚠️ Le jeton n'autorise QUE deux transitions : accepter (recue -> confirmee)
-- et refuser (recue -> annulee). Il ne donne aucun autre pouvoir, et devient
-- inoperant des que la commande a quitte l'etat « recue » — donc un lien
-- reutilise ou transfere ne fait rien.
--
-- ⚠️ Un refus exige un motif, comme partout ailleurs dans ce systeme.

alter table public.orders
  add column if not exists accept_token uuid not null default gen_random_uuid();

comment on column public.orders.accept_token is
  'Jeton imprevisible permettant d''accepter ou refuser CETTE commande depuis un lien (Telegram), sans compte. Sans pouvoir au-dela de l''etat « recue ».';

create or replace function public.repondre_commande_par_jeton(
  p_order_id uuid,
  p_token    uuid,
  p_action   text,           -- 'accepter' | 'refuser'
  p_motif    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_order public.orders; v_resto text;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'raison', 'introuvable');
  end if;

  -- Comparaison stricte du jeton. Un uuid n'est pas devinable ; inutile de
  -- ruser, mais on ne dit jamais QUELLE partie est fausse.
  if v_order.accept_token is distinct from p_token then
    return jsonb_build_object('ok', false, 'raison', 'lien invalide');
  end if;

  if v_order.status <> 'recue' then
    -- Cas le plus frequent en vrai : le restaurateur a deja repondu depuis
    -- l'application, puis clique le lien de l'e-mail. Ce n'est pas une erreur.
    return jsonb_build_object('ok', false, 'raison', 'deja traitee',
                              'statut', v_order.status::text);
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

  select name into v_resto from public.restaurants where id = v_order.restaurant_id;
  return jsonb_build_object('ok', true, 'numero', v_order.order_number,
                            'statut', v_order.status::text, 'restaurant', v_resto);
end $$;

-- Appelable sans compte : c'est tout l'interet. Le jeton fait l'autorisation.
grant execute on function public.repondre_commande_par_jeton(uuid, uuid, text, text) to anon, authenticated;
