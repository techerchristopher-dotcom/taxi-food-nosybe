-- Le client est prévenu quand on relance le restaurant (2026-10-12).
--
-- Demande du porteur du projet : si le restaurant n'a pas répondu au bout de 3 min,
-- le client reçoit une notification ET son écran de suivi se met à jour tout seul
-- (« Le restaurant tarde un peu — on le relance pour toi »).
--
-- • `orders.relance_restaurant_le` : posée par `alerter_commandes_sans_reponse()` au
--   moment de la relance. L'écran de suivi la lit (sondage 15 s + rechargement à la
--   réception de la notification). Les apps déjà installées ne la demandent pas :
--   aucun effet sur elles.
-- • Push client : appel de `notify-order` avec `event = 'relance'` (même mécanique que
--   la relance avis). Pas pour une commande par téléphone : le compte est celui de l'admin.
-- • Patch par ANCRE de `alerter_commandes_sans_reponse()`, jamais retapée.

alter table public.orders add column if not exists relance_restaurant_le timestamptz;

do $m$
declare
  v_def text;
  v_new text;
  v_ancre constant text := $a$    continue when not found;

    v_req := null;$a$;
begin
  v_def := pg_get_functiondef('public.alerter_commandes_sans_reponse(integer)'::regprocedure);
  if v_def like '%relance_restaurant_le%' then
    raise notice 'deja fait';
    return;
  end if;
  if position(v_ancre in v_def) = 0 then
    raise exception 'ancre introuvable dans alerter_commandes_sans_reponse';
  end if;

  v_new := replace(v_def, v_ancre, $n$    continue when not found;

    -- Le client voit la relance sur son écran de suivi, et reçoit une notification.
    update public.orders set relance_restaurant_le = now() where id = r.id;
    if r.user_id is not null
       and not exists (select 1 from public.commandes_telephone ct where ct.order_id = r.id)
       and exists (select 1 from vault.decrypted_secrets where name = 'push_hook_secret')
    then
      perform net.http_post(
        url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/notify-order',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret',
                     (select decrypted_secret from vault.decrypted_secrets where name = 'push_hook_secret')),
        body := jsonb_build_object('order_id', r.id, 'status', 'recue', 'event', 'relance'),
        timeout_milliseconds := 20000);
    end if;

    v_req := null;$n$);

  execute v_new;
end
$m$;
