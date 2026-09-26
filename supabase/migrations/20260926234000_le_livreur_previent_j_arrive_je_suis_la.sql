-- Chantier « J'arrive » / « Je suis là » (26/09/2026).
--
-- Entre la récupération au restaurant et la remise en main propre, le client ne
-- recevait plus rien. Deux gestes de plus pour le livreur, un seul appui chacun,
-- horodatés : `arriving_at` (≈ 5 minutes) puis `arrived_at` (devant la porte).
-- Le statut ne bouge pas (`en_livraison` de bout en bout, comme pour la prise en
-- charge) — ce sont des jalons, pas des états.

alter table public.orders
  add column if not exists arriving_at timestamptz,
  add column if not exists arrived_at  timestamptz;

comment on column public.orders.arriving_at is 'Livreur : « J''arrive » (≈ 5 min). Un seul appui, client prévenu par push.';
comment on column public.orders.arrived_at  is 'Livreur : « Je suis là » (devant la porte). Un seul appui, client prévenu par push.';

-- Même garde-fous que mark_order_picked_up : le livreur assigné, une commande en
-- livraison déjà récupérée, et le jalon pas encore posé (idempotence par refus).
create or replace function public.mark_order_arriving(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null or v_order.delivered_at is not null then
    raise exception 'Action invalide sur cette commande';
  end if;
  if v_order.arriving_at is not null then raise exception 'Le client a deja ete prevenu'; end if;
  update public.orders set arriving_at = now() where id = p_order_id returning * into v_order;
  return v_order;
end; $$;

-- « Je suis là » sans « J'arrive » avant est permis (course courte) : on pose
-- alors les deux jalons, le premier ne déclenche rien puisque posé en même temps.
create or replace function public.mark_order_arrived(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null or v_order.delivered_at is not null then
    raise exception 'Action invalide sur cette commande';
  end if;
  if v_order.arrived_at is not null then raise exception 'Le client a deja ete prevenu'; end if;
  update public.orders
     set arrived_at = now(), arriving_at = coalesce(arriving_at, now())
   where id = p_order_id returning * into v_order;
  return v_order;
end; $$;

revoke all on function public.mark_order_arriving(uuid) from public;
revoke all on function public.mark_order_arrived(uuid) from public;
grant execute on function public.mark_order_arriving(uuid) to authenticated;
grant execute on function public.mark_order_arrived(uuid) to authenticated;

-- Abandonner une course efface aussi les jalons : le prochain livreur repart de zéro.
create or replace function public.release_order(p_order_id uuid)
returns orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' then raise exception 'Action invalide sur cette commande'; end if;
  update public.orders set courier_id = null, picked_up_at = null, arriving_at = null, arrived_at = null
    where id = p_order_id returning * into v_order;
  return v_order;
end; $$;

-- Le trigger de notification écoute les deux nouveaux jalons.
drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status
  after update of status, picked_up_at, payment_status, payment_method, arriving_at, arrived_at
  on public.orders
  for each row execute function public.notify_order_status();

-- Et la fonction émet `phase` = 'arriving' | 'arrived' vers notify-order, SANS
-- appeler n8n (qui rejouerait l'e-mail « en livraison » au client). Patch par
-- remplacement d'ancres sur la définition en place — jamais retapée à la main.
do $$
declare
  v_def text;
  a1 constant text := $x$v_secret text; v_picked boolean := false; v_event text := 'statut';$x$;
  n1 constant text := $x$v_secret text; v_picked boolean := false; v_event text := 'statut'; v_phase text := null;$x$;
  a2 constant text := $x$elsif v_o.picked_up_at is not null and old.picked_up_at is null then$x$;
  n2 constant text := $x$elsif v_o.arrived_at is not null and old.arrived_at is null then
      v_phase := 'arrived';
    elsif v_o.arriving_at is not null and old.arriving_at is null then
      v_phase := 'arriving';
    elsif v_o.picked_up_at is not null and old.picked_up_at is null then$x$;
  a3 constant text := $x$'picked_up',v_picked,'event',v_event)$x$;
  n3 constant text := $x$'picked_up',v_picked,'event',v_event,'phase',v_phase)$x$;
  a4 constant text := $x$select decrypted_secret into v_n8n_url from vault.decrypted_secrets where name='n8n_webhook_url';$x$;
  n4 constant text := $x$-- Jalon livreur : le push suffit, n8n ne doit pas rejouer l'e-mail de statut.
  if v_phase is not null then return new; end if;
  select decrypted_secret into v_n8n_url from vault.decrypted_secrets where name='n8n_webhook_url';$x$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notify_order_status';
  if position(a1 in v_def) = 0 or position(a2 in v_def) = 0
     or position(a3 in v_def) = 0 or position(a4 in v_def) = 0 then
    raise exception 'ancre introuvable dans notify_order_status : rien modifie';
  end if;
  v_def := replace(replace(replace(replace(v_def, a1, n1), a2, n2), a3, n3), a4, n4);
  execute v_def;
end $$;
