-- Commande programmée : correctifs de la relecture du 2026-10-17.
--
-- 1. Réservation payée par CARTE et pas (encore) payée : le restaurant ne doit rien
--    recevoir — ni « 📅 RÉSERVATION » à la création, ni « 🔔 RAPPEL » à l'ouverture.
--    Le message d'information part au moment de la capture du paiement (trigger UPDATE),
--    et une réservation carte toujours impayée 30 min après sa création est annulée à
--    l'heure de transmission au lieu de rester « reçue » pour toujours.
-- 2. Le rappel « C'EST L'HEURE » vise aussi `en_preparation` : la préparation automatique
--    (toutes les 30 s) pouvait passer devant la tâche des réservations (chaque minute).
-- 3. `creneaux_livraison` ne propose plus un créneau où une catégorie du panier n'est pas
--    servie (pizzas à partir de 18 h) : `create_order` le refusait après coup.
-- 4. `estimer_delais` ne compte plus dans la charge de la cuisine les réservations pas
--    encore transmises : elles gonflaient les délais de tout le monde.
-- Tous les patchs portent sur des ancres et échouent si l'ancre n'est pas trouvée.

create or replace function public.reservation_carte_en_attente(p_o public.orders)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select carte_active from public.payment_config where id = 1), false)
     and p_o.payment_method = 'cb'
     and p_o.payment_status in ('non_requis', 'en_attente', 'echoue')
$$;
revoke all on function public.reservation_carte_en_attente(public.orders) from public, anon, authenticated;

do $patch$
declare
  v_def text;
  v_new text;
begin
  -- 1a. annoncer_reservation : muette tant que la carte n'est pas payée.
  v_def := pg_get_functiondef('public.annoncer_reservation()'::regprocedure);
  v_new := replace(v_def,
    'if v_o.id is null or v_o.livraison_souhaitee_a is null then return null; end if;',
    'if v_o.id is null or v_o.livraison_souhaitee_a is null then return null; end if;
  if v_o.status <> ''recue'' or public.reservation_carte_en_attente(v_o) then return null; end if;');
  if v_new = v_def then raise exception 'ancre annoncer_reservation introuvable'; end if;
  execute v_new;

  -- 1b + 2. traiter_commandes_programmees
  v_def := pg_get_functiondef('public.traiter_commandes_programmees()'::regprocedure);
  v_new := replace(v_def,
    'public.ouvert_maintenant(r) as ouvert',
    'public.ouvert_maintenant(r) as ouvert, public.reservation_carte_en_attente(ord) as carte_attente, ord.created_at');
  v_new := replace(v_new,
    '  loop
    if o.ouvert then',
    '  loop
    if o.carte_attente then
      if o.created_at < now() - interval ''30 minutes'' then
        update public.orders
           set status = ''annulee'', status_updated_at = now(),
               cancellation_code = ''autre'',
               cancellation_detail = ''paiement par carte non abouti'',
               cancellation_reason = public.composer_motif_refus(''autre'', ''paiement par carte non abouti'')
         where id = o.id;
        perform public.telegram_admin_envoyer(''❌ RÉSERVATION ANNULÉE — '' || coalesce(o.resto, ''?'') || chr(10)
          || o.order_number || '' : paiement par carte jamais abouti. Le restaurant n''''avait rien reçu.'');
        v_n := v_n + 1;
      end if;
    elsif o.ouvert then');
  v_new := replace(v_new,
    'where ord.livraison_souhaitee_a is not null and ord.status = ''confirmee''',
    'where ord.livraison_souhaitee_a is not null and ord.status in (''confirmee'', ''en_preparation'')');
  if (length(v_new) - length(v_def)) < 600 or position('carte_attente' in v_new) = 0
     or position('(''confirmee'', ''en_preparation'')' in v_new) = 0
     or position('elsif o.ouvert then' in v_new) = 0 then
    raise exception 'ancres traiter_commandes_programmees introuvables';
  end if;
  execute v_new;

  -- 3. creneaux_livraison : catégories servies à l'heure de lancement.
  v_def := pg_get_functiondef('public.creneaux_livraison(uuid,uuid,uuid[])'::regprocedure);
  v_new := replace(v_def,
    'if public.commandable_a(v_r, v_t - make_interval(mins => v_delai)) then',
    'if public.commandable_a(v_r, v_t - make_interval(mins => v_delai))
       and not exists (select 1 from public.products p join public.categories c on c.id = p.category_id
                        where p.id = any(coalesce(p_produits, ''{}''::uuid[]))
                          and not public.categorie_servie_a(c, v_t - make_interval(mins => v_delai))) then');
  if v_new = v_def then raise exception 'ancre creneaux_livraison introuvable'; end if;
  execute v_new;

  -- 4. estimer_delais : charge sans les réservations non transmises.
  select pg_get_functiondef(p.oid) into v_def from pg_proc p
   where p.proname = 'estimer_delais' and p.pronamespace = 'public'::regnamespace;
  v_new := replace(v_def,
    'and o.status in (''recue'', ''confirmee'', ''en_preparation'')',
    'and o.status in (''recue'', ''confirmee'', ''en_preparation'')
     and not (o.transmission_prevue_a is not null and o.transmise_le is null)');
  if v_new = v_def or (length(v_new) - length(v_def)) > 120 then raise exception 'ancre estimer_delais'; end if;
  execute v_new;
end $patch$;

-- 1c. Le message d'information part quand la carte est capturée.
drop trigger if exists orders_reservation_info_paiement on public.orders;
create trigger orders_reservation_info_paiement
  after update of payment_status on public.orders
  for each row
  when (new.livraison_souhaitee_a is not null and new.payment_status = 'paye'
        and old.payment_status is distinct from 'paye')
  execute function public.annoncer_reservation();
