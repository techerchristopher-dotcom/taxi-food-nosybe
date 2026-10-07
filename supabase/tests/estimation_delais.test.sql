-- Recette de l'estimation des délais (migration 20261008000000). À lancer tel quel par
-- `execute_sql` : tout se passe dans un bloc qui finit par une exception, donc rien
-- n'est écrit (aucune commande ; le trigger n8n/Telegram, différé, ne part jamais).
-- ⚠️ Chaque commande créée consomme un numéro TF- (séquence non annulable).
-- Taxi Be (masqué, sans Telegram) est rendu commandable le temps du bloc ; client = compte
-- admin et son adresse de test. Le trigger d'estimation étant DIFFÉRÉ (il part au COMMIT),
-- on le force avec `set constraints orders_estimation_delais immediate`.
--
-- Scénarios :
--   1. create_order 6 args → estimation posée (source défaut : Taxi Be n'a pas d'historique)
--   2. create_order 4 args (enveloppe des apps en magasin) et 5 args nommés → idem,
--      et la CHARGE monte : +5 min par commande déjà en cuisine
--   3. estimation figée : UPDATE refusé
--   4. client B ne lit pas l'estimation du client A ; anon refusé
--   5. historique fabriqué (6 commandes livrées d'un autre client) → niveau « plat »
--      (Beignets 40 min) contre niveau « restaurant » (médiane 30 min)
--
-- Résultat obtenu le 2026-10-07 (TF-362 à TF-364 consommés) :
--   1 (6 args) : prepa=25 (defaut) charge=0 attente=3 (global) trajet=17 (historique, km inconnu
--     → km médian) total=45
--   2a (4 args) : charge=1 → +5, prepa=30, total=50 · 2b (5 args nommés) : charge=2 → +10, total=55
--   3 UPDATE client : permission denied · UPDATE postgres : estimation:figee
--   4 client B lit 0 estimation du client A ; client A lit la sienne ; anon : 42501 sur la table,
--     estimer_delais et admin_delais_estime_vs_reel ; delais_restaurants() répond (10 restaurants)
--   5 avec Beignets : prepa=50 = 40 (plat) + 10 (charge) ; autre plat (3 commandes à 20 min) :
--     source plat aussi, 20 + 15 ; duree_mediane_min(Taxi Be) = 50
do $$
declare
  R constant uuid := 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886';
  U constant uuid := '9ca91352-d36d-4500-87fd-68d0f696640d';
  B constant uuid := 'f39513c1-050f-43a0-8aab-5d3bd440cbd8';   -- un autre client réel (lecture seule)
  A constant uuid := '89317e34-4977-471e-b4db-f54a16304edc';
  P constant uuid := '480603b8-d58a-49ca-8444-dc97fff5948f';   -- Beignets de légumes (Taxi Be)
  Q uuid;
  log text := '';
  o public.orders; e public.estimations_commande; x record; n int; i int; t0 timestamptz; v_id uuid;
  items jsonb := jsonb_build_array(jsonb_build_object('product_id', P, 'quantity', 1, 'options', '[]'::jsonb));
begin
  update restaurants set listing_status='visible', is_open=true where id=R;
  update categories set serving_from=null, serving_to=null where id=(select category_id from products where id=P);
  select id into Q from products where restaurant_id=R and id<>P and is_available limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);

  -- 1. signature 6 arguments
  select * into o from create_order(R, A, 'especes', items, null, false);
  set constraints public.orders_estimation_delais immediate;
  select * into e from estimations_commande where order_id=o.id;
  log := log || format('1 (6 args) %s : prepa=%s (%s) charge=%s/+%s attente=%s (%s) trajet=%s (%s) km=%s total=%s pretes=%s livree=%s',
    o.order_number, e.preparation_min, e.preparation_source, e.charge_commandes, e.charge_min, e.attente_livreur_min,
    e.attente_source, e.trajet_min, e.trajet_source, coalesce(e.distance_km::text,'?'), e.total_min,
    to_char(e.heure_prete_estimee at time zone 'Indian/Antananarivo','HH24:MI'),
    to_char(e.heure_livree_estimee at time zone 'Indian/Antananarivo','HH24:MI')) || E'\n';
  set constraints public.orders_estimation_delais deferred;

  -- 2. enveloppe 4 arguments (apps en magasin) puis 5 arguments nommés
  select * into o from create_order(R, A, 'especes'::payment_method, items);
  set constraints public.orders_estimation_delais immediate;
  select * into e from estimations_commande where order_id=o.id;
  log := log || format('2a (4 args) %s : charge=%s commandes → +%s min, prepa=%s total=%s',
    o.order_number, e.charge_commandes, e.charge_min, e.preparation_min, e.total_min) || E'\n';
  set constraints public.orders_estimation_delais deferred;
  select * into o from create_order(p_restaurant_id=>R, p_address_id=>A, p_payment_method=>'especes', p_items=>items, p_code_promo=>null);
  set constraints public.orders_estimation_delais immediate;
  select * into e from estimations_commande where order_id=o.id;
  log := log || format('2b (5 args nommes) %s : charge=%s commandes → +%s min, prepa=%s total=%s',
    o.order_number, e.charge_commandes, e.charge_min, e.preparation_min, e.total_min) || E'\n';
  set constraints public.orders_estimation_delais deferred;

  -- 3. figée
  begin
    update estimations_commande set total_min = 1 where order_id = o.id;
    get diagnostics n = row_count;
    log := log || '3 UPDATE client : ' || n || ' ligne(s) modifiee(s)' || E'\n';
  exception when others then log := log || '3 UPDATE client refuse : ' || sqlerrm || E'\n'; end;
  perform set_config('role','postgres', true);
  begin
    update estimations_commande set total_min = 1 where order_id = o.id;
    log := log || '3 UPDATE postgres ACCEPTE (KO)' || E'\n';
  exception when others then log := log || '3 UPDATE postgres refuse : ' || sqlerrm || E'\n'; end;

  -- 4. client B, anon
  perform set_config('request.jwt.claims', json_build_object('sub',B,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select count(*) into n from estimations_commande e2 join orders o2 on o2.id = e2.order_id where o2.user_id = U;
  log := log || '4 client B lit ' || n || ' estimation(s) du client A ; ' ||
    (select count(*) from estimations_commande where order_id = o.id) || ' pour la commande ' || o.order_number || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  select count(*) into n from estimations_commande where order_id = o.id;
  log := log || '4 client A lit ' || n || ' estimation pour sa commande' || E'\n';
  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select count(*) into n from estimations_commande;
    log := log || '4 anon lit ' || n || ' estimation(s)' || E'\n';
  exception when others then log := log || '4 anon refuse : ' || sqlerrm || ' (' || sqlstate || ')' || E'\n'; end;
  begin
    perform * from estimer_delais(R, 2, '{}'::uuid[]);
    log := log || '4 anon estimer_delais ACCEPTE (KO)' || E'\n';
  exception when others then log := log || '4 anon estimer_delais refuse (' || sqlstate || ')' || E'\n'; end;
  begin
    perform * from admin_delais_estime_vs_reel();
    log := log || '4 anon admin_delais ACCEPTE (KO)' || E'\n';
  exception when others then log := log || '4 anon admin_delais refuse (' || sqlstate || ')' || E'\n'; end;
  select count(*) into n from delais_restaurants();
  log := log || '4 anon delais_restaurants() : ' || n || ' restaurants' || E'\n';

  -- 5. niveaux « plat » et « restaurant » sur un historique fabriqué (client B, livrées)
  perform set_config('role','postgres', true);
  for i in 1..6 loop
    t0 := now() - make_interval(days => i);
    insert into orders(user_id, restaurant_id, address_id, payment_method, subtotal, delivery_fee, total, status, created_at)
      values (B, R, A, 'especes', 12000, 0, 12000, 'livree', t0) returning id into v_id;
    insert into order_items(order_id, product_id, product_name_snapshot, quantity, unit_price)
      values (v_id, case when i <= 3 then P else Q end, 'test', 1, 12000);
    update orders set accepted_at = t0 + interval '1 min',
                      ready_at = t0 + case when i <= 3 then interval '40 min' else interval '20 min' end,
                      picked_up_at = t0 + case when i <= 3 then interval '44 min' else interval '24 min' end,
                      delivered_at = t0 + case when i <= 3 then interval '60 min' else interval '40 min' end
     where id = v_id;
  end loop;
  select * into e from estimer_commande((select id from orders where restaurant_id=R and user_id=U order by created_at desc limit 1));
  log := log || format('5 avec Beignets : prepa=%s source=%s (plat=%s) charge=+%s attente=%s (%s)',
    e.preparation_min, e.preparation_source, e.produit_reference_id = P, e.charge_min, e.attente_livreur_min, e.attente_source) || E'\n';
  select * into x from estimer_delais(R, null, array[Q]);
  log := log || format('5 sans Beignets : prepa=%s source=%s charge=+%s', x.preparation_min, x.preparation_source, x.charge_min) || E'\n';
  log := log || '5 duree_mediane_min(Taxi Be) = ' || (select duree_mediane_min(rr) from restaurants rr where rr.id=R) || E'\n';

  raise exception E'RECETTE (annulee)\n%', log;
end $$;
