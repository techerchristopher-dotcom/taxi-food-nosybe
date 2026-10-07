-- Notification client quand le livreur appuie sur « Je prends la commande ».
--
-- Demande du porteur du projet (2026-10-07). `claim_order` (et `admin_assign_courier`)
-- ne changent que `courier_id` : le statut reste `en_livraison`, et le trigger
-- `notify_order_status` sortait sur « statut inchangé » — le client n'apprenait rien
-- entre « Prête à partir » et « Le livreur est en route » (récupération au restaurant).
--
-- Nouveau jalon `assigned` : `courier_id` passe de NULL à une valeur, sans
-- récupération dans la même écriture. Comme `arriving` / `arrived`, c'est un jalon
-- livreur : push seulement (notify-order, clé `assigned`, FR/EN/IT), pas d'e-mail n8n.
--
-- On patche la fonction en place plutôt que de la recopier : elle fait 150 lignes et
-- une recopie à la main est exactement la façon d'en perdre une. Le `do` refuse de
-- continuer si le motif attendu n'est pas trouvé (fonction modifiée depuis).

do $$
declare
  v_def text := pg_get_functiondef('public.notify_order_status'::regproc);
  v_avant constant text := E'    elsif v_o.picked_up_at is not null and old.picked_up_at is null then\n      v_picked := true;\n';
  v_apres constant text := E'    elsif v_o.picked_up_at is not null and old.picked_up_at is null then\n      v_picked := true;\n'
                        || E'    -- Le livreur accepte la course (claim_order) : il part vers le restaurant.\n'
                        || E'    elsif v_o.courier_id is not null and old.courier_id is null then\n      v_phase := ''assigned'';\n';
begin
  if position('''assigned''' in v_def) > 0 then
    raise notice 'notify_order_status : jalon assigned deja present';
    return;
  end if;
  if position(v_avant in v_def) = 0 then
    raise exception 'notify_order_status : motif picked_up introuvable, patch refuse';
  end if;
  execute replace(v_def, v_avant, v_apres);
end $$;

-- ⚠️ Le patch seul ne suffisait pas (constaté au test du 2026-10-07, TF-333) : le
-- trigger ne se réveille que sur une LISTE de colonnes, et `courier_id` n'en faisait
-- pas partie. `claim_order` passait donc sous le radar. On l'ajoute.
drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status, picked_up_at, payment_status, payment_method, arriving_at, arrived_at, courier_id
  on public.orders
  for each row execute function public.notify_order_status();
