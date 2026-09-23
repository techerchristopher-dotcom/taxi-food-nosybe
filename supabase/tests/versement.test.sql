-- Recette des versements (migration 20260922140000). À lancer tel quel par
-- `execute_sql` : TOUT se passe dans un bloc qui finit par une exception, donc
-- rien n'est écrit — aucun reversement, aucun envoi (ce fichier n'appelle
-- JAMAIS Telegram ; seule la fonction Edge le fait).
-- Le résultat s'affiche dans le message d'erreur « RESULTAT >>> ».
do $t$
declare
  v_admin constant uuid := '9ca91352-d36d-4500-87fd-68d0f696640d';
  v_cabane constant uuid := '958faac6-61ab-4ff5-9226-b8adab46ed24';
  v_bidul  constant uuid := '700e8f32-e966-476a-b371-02884d08dea1';
  v_out text := '';
  v_ok int := 0;
  v_ko int := 0;
  v_du int;
  v_n int;
  v_somme int;
  /** Les reversements qui existaient AVANT ce test : ceux que la reprise devait rattacher. */
  v_anciens uuid[];
  /** Les commandes qu'on « coche » pour le mode sélection. */
  v_choix uuid[];
  v_une uuid;
  v_rs public.restaurant_settlements;
  v_row public.restaurant_settlements;
  v_chat text;
  v_txt text;
  v_msg text;
  r record;

begin
  select coalesce(array_agg(id), '{}') into v_anciens from public.restaurant_settlements;

  -- ============================ 0. Anon : aucune exécution possible
  begin
    set local role anon;
    perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', 1000, 'ANON-TEST', 1000);
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO anon a pu appeler admin_enregistrer_versement';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK anon refusé (permission denied)';
  end;
  begin
    set local role anon;
    perform public.lire_jeton_telegram();
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO anon lit le jeton Telegram';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK anon ne lit pas le jeton';
  end;
  -- La table de liaison n'a AUCUNE politique RLS et aucun droit : ni la clé
  -- publique ni un compte connecté n'en lisent une ligne.
  foreach v_msg in array array['anon', 'authenticated'] loop
    begin
      execute format('set local role %I', v_msg);
      perform 1 from public.settlement_orders limit 1;
      reset role;
      v_ko := v_ko + 1; v_out := v_out || format(E'\nKO %s lit settlement_orders', v_msg);
    exception when insufficient_privilege then
      reset role;
      v_ok := v_ok + 1; v_out := v_out || format(E'\nOK %s ne lit pas settlement_orders (permission denied)', v_msg);
    end;
    begin
      execute format('set local role %I', v_msg);
      perform public.record_settlement(v_bidul, '2026-09-13', '2026-09-14', 0);
      reset role;
      v_ko := v_ko + 1; v_out := v_out || format(E'\nKO %s appelle record_settlement (versement sans rattachement)', v_msg);
    exception when insufficient_privilege then
      reset role;
      v_ok := v_ok + 1; v_out := v_out || format(E'\nOK %s n''appelle plus record_settlement', v_msg);
    end;
  end loop;
  begin
    set local role anon;
    perform * from public.admin_commandes_deja_reversees('2026-09-01', '2026-09-30');
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO anon lit les rattachements';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK anon ne lit pas les rattachements';
  end;

  begin
    set local role authenticated;
    perform public.lire_jeton_telegram();
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO authenticated lit le jeton Telegram';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK authenticated (même admin) ne lit pas le jeton';
  end;
  begin
    set local role authenticated;
    perform * from public.versement_prendre_envoi(gen_random_uuid());
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO authenticated appelle versement_prendre_envoi';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK versement_prendre_envoi réservé à service_role';
  end;

  -- ============================ 1. Non-admin connecté : refusé
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  begin
    set local role authenticated;
    perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', 1000, 'NONADMIN-1', 1000);
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO non-admin a enregistré';
  exception when others then
    reset role;
    if sqlerrm like 'Acces admin requis%' then v_ok := v_ok + 1; v_out := v_out || E'\nOK non-admin refusé : ' || sqlerrm;
    else v_ko := v_ko + 1; v_out := v_out || E'\nKO non-admin, erreur inattendue : ' || sqlerrm; end if;
  end;
  begin
    set local role authenticated;
    perform * from public.admin_commandes_a_reverser(v_bidul, '2026-09-01', '2026-09-30');
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO non-admin lit le détail';
  exception when others then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK non-admin ne lit pas le détail : ' || sqlerrm;
  end;
  begin
    set local role authenticated;
    perform * from public.admin_commandes_deja_reversees('2026-09-01', '2026-09-30');
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO non-admin lit les rattachements';
  exception when others then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK non-admin ne lit pas les rattachements : ' || sqlerrm;
  end;

  -- ============================ À partir d'ici : l'admin
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- ============================ 2. Même source : somme du détail = record_settlement
  for r in
    select * from (values
      (v_cabane, date '2026-09-01', date '2026-09-30'),
      (v_cabane, date '2026-09-20', date '2026-09-20'),
      (v_bidul,  date '2026-09-13', date '2026-09-14'),
      (v_bidul,  date '2026-09-15', date '2026-09-21'),
      (v_bidul,  date '2026-09-01', date '2026-09-30'),
      ('56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'::uuid, date '2026-09-22', date '2026-09-22')
    ) as x(resto, d1, d2)
  loop
    select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(r.resto, r.d1, r.d2);
    -- `record_settlement` n'est plus exécutable par `authenticated` depuis le
    -- 2026-09-23 (elle écrivait un reversement sans rattacher les commandes).
    -- Son CALCUL reste la référence : on la compare, en sortant du rôle.
    reset role;
    begin
      select * into v_rs from public.record_settlement(r.resto, r.d1, r.d2, 0);
      raise exception 'annule' using errcode = 'P0099';
    exception when sqlstate 'P0099' then null;
    end;
    set local role authenticated;
    if v_rs.amount_due = v_du then
      v_ok := v_ok + 1; v_out := v_out || format(E'\nOK même dû %s au %s : détail %s = record_settlement %s', r.d1, r.d2, v_du, v_rs.amount_due);
    else
      v_ko := v_ko + 1; v_out := v_out || format(E'\nKO dû divergent %s au %s : détail %s ≠ record_settlement %s', r.d1, r.d2, v_du, v_rs.amount_due);
    end if;
  end loop;

  select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(v_bidul, '2026-09-15', '2026-09-21');

  -- ============================ 3. Référence vide / blanche / trop courte : refusée
  foreach v_msg in array array['', '   ', 'AB'] loop
    begin
      perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', v_du, v_msg, v_du);
      v_ko := v_ko + 1; v_out := v_out || format(E'\nKO référence « %s » acceptée', v_msg);
    exception when others then
      v_ok := v_ok + 1; v_out := v_out || format(E'\nOK référence « %s » refusée : %s', v_msg, sqlerrm);
    end;
  end loop;
  begin
    perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', v_du, null, v_du);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO référence NULL acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK référence NULL refusée';
  end;

  -- ============================ 4. Dû affiché périmé : refusé
  begin
    perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', v_du, 'TEST-PERIME', v_du + 1);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO dû périmé accepté';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK dû périmé refusé : ' || sqlerrm;
  end;

  -- ============================ 5. Période qui chevauche un versement existant
  -- (La Cabane, 20/09 déjà payé) : ACCEPTÉE depuis le 2026-09-23, mais la
  -- commande déjà rattachée est écartée du montant. C'est le cas « reversement
  -- partiel / commande rattrapée dans la période suivante ».
  select coalesce(sum(net) filter (where not deja_reverse), 0),
         count(*) filter (where deja_reverse)
    into v_du, v_n
  from public.admin_commandes_a_reverser(v_cabane, '2026-09-18', '2026-09-22');
  begin
    select * into v_rs from public.admin_enregistrer_versement(v_cabane, '2026-09-18', '2026-09-22', greatest(v_du, 1), 'TEST-CHEVAUCHE', v_du);
    if v_rs.amount_due = v_du and v_n > 0 then
      v_ok := v_ok + 1;
      v_out := v_out || format(E'\nOK période chevauchante acceptée SANS la commande déjà payée : dû %s, %s commande(s) %s (%s déjà reversée(s) écartée(s))',
        v_rs.amount_due, v_rs.nb_commandes, v_rs.numeros_commandes, v_n);
    else
      v_ko := v_ko + 1;
      v_out := v_out || format(E'\nKO période chevauchante : dû %s attendu %s, déjà reversées %s', v_rs.amount_due, v_du, v_n);
    end if;
  exception when others then
    v_ko := v_ko + 1; v_out := v_out || E'\nKO période chevauchante refusée à tort : ' || sqlerrm;
  end;
  -- Et maintenant qu'elles sont toutes rattachées, la même période est refusée.
  begin
    perform public.admin_enregistrer_versement(v_cabane, '2026-09-18', '2026-09-22', 1000, 'TEST-CHEVAUCHE-2', 0);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO deuxième versement sur des commandes déjà rattachées accepté';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK commandes déjà rattachées : deuxième versement refusé : ' || sqlerrm;
  end;
  -- Les commandes du versement qu'on vient de créer sont bien en base, et leur
  -- somme vaut exactement le montant enregistré. (Lecture hors rôle : la table
  -- n'a AUCUNE politique RLS, elle n'est lisible que par les RPC admin.)
  reset role;
  select count(*), coalesce(sum(so.net), 0) into v_n, v_somme
  from public.settlement_orders so where so.settlement_id = v_rs.id;
  set local role authenticated;
  if v_n = v_rs.nb_commandes and v_somme = v_rs.amount_due then
    v_ok := v_ok + 1; v_out := v_out || format(E'\nOK rattachement à l''enregistrement : %s ligne(s), somme %s = dû %s', v_n, v_somme, v_rs.amount_due);
  else
    v_ko := v_ko + 1; v_out := v_out || format(E'\nKO rattachement : %s ligne(s) pour %s commandes, somme %s ≠ dû %s', v_n, v_rs.nb_commandes, v_somme, v_rs.amount_due);
  end if;

  -- ============================ 6. Période sans commande : refusée
  begin
    perform public.admin_enregistrer_versement(v_bidul, '2026-08-01', '2026-08-02', 1000, 'TEST-VIDE', 0);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO période vide acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK période vide refusée : ' || sqlerrm;
  end;

  -- ============================ 7. Cas nominal, puis doublons
  select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(v_bidul, '2026-09-15', '2026-09-21');
  select * into v_row from public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', v_du, '  pp230922.1234  ', v_du);
  v_out := v_out || format(E'\nOK versement créé (annulé en fin de test) : dû %s, %s commandes %s, réf « %s », statut %s, auteur = admin : %s',
    v_row.amount_due, v_row.nb_commandes, v_row.numeros_commandes, v_row.reference_versement, v_row.telegram_statut,
    v_row.created_by = v_admin);
  v_ok := v_ok + 1;

  begin
    perform public.admin_enregistrer_versement(v_bidul, '2026-09-15', '2026-09-21', v_du, 'AUTRE-REF', v_du);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO deuxième versement même période accepté';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK deuxième versement même période refusé : ' || sqlerrm;
  end;

  -- La même référence, écrite autrement, pour un autre restaurant et une autre période.
  select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(v_cabane, '2026-09-08', '2026-09-12');
  begin
    perform public.admin_enregistrer_versement(v_cabane, '2026-09-08', '2026-09-12', greatest(v_du, 1), 'PP230922 .1234', v_du);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO référence déjà utilisée acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK référence déjà utilisée refusée : ' || sqlerrm;
  end;

  -- ============================ 8. Côté fonction Edge (service_role), SANS envoi
  reset role;
  select * into v_chat, v_txt from public.versement_prendre_envoi(v_row.id);
  v_out := v_out || format(E'\nOK prise d''envoi : canal présent = %s, texte :\n-----\n%s\n-----', v_chat is not null, v_txt);
  v_ok := v_ok + 1;
  begin
    perform * from public.versement_prendre_envoi(v_row.id);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO deuxième prise pendant un envoi en cours acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK deuxième prise pendant l''envoi refusée : ' || sqlerrm;
  end;
  perform public.versement_noter_envoi(v_row.id, false, null, 'Bad Request: chat not found');
  select * into v_rs from public.restaurant_settlements where id = v_row.id;
  v_out := v_out || format(E'\n%s échec noté : statut %s, erreur « %s »', case when v_rs.telegram_statut = 'echec' then 'OK' else 'KO' end, v_rs.telegram_statut, v_rs.telegram_erreur);
  perform * from public.versement_prendre_envoi(v_row.id);   -- renvoi après échec : permis
  perform public.versement_noter_envoi(v_row.id, true, 4242, null);
  select * into v_rs from public.restaurant_settlements where id = v_row.id;
  v_out := v_out || format(E'\n%s envoi confirmé noté : statut %s, message_id %s, tentatives %s', case when v_rs.telegram_statut = 'envoye' then 'OK' else 'KO' end, v_rs.telegram_statut, v_rs.telegram_message_id, v_rs.telegram_tentatives);
  begin
    perform * from public.versement_prendre_envoi(v_row.id);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO renvoi après envoi confirmé accepté';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK renvoi après envoi confirmé refusé : ' || sqlerrm;
  end;
  -- ok sans message_id : jamais « envoyé »
  perform public.versement_noter_envoi(v_row.id, true, null, null);
  select * into v_rs from public.restaurant_settlements where id = v_row.id;
  v_out := v_out || format(E'\n%s ok sans message_id → %s', case when v_rs.telegram_statut = 'echec' then 'OK' else 'KO' end, v_rs.telegram_statut);

  -- Restaurant sans canal : versement enregistré quand même, statut sans_canal.
  update public.restaurants set telegram_chat_id = null where id = v_cabane;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select coalesce(sum(net) filter (where not deja_reverse), 0) into v_du
  from public.admin_commandes_a_reverser(v_cabane, '2026-09-08', '2026-09-12');
  if v_du > 0 then
    select * into v_rs from public.admin_enregistrer_versement(v_cabane, '2026-09-08', '2026-09-12', v_du, 'TEST-SANS-CANAL', v_du);
    reset role;
    select * into v_chat, v_txt from public.versement_prendre_envoi(v_rs.id);
    v_out := v_out || format(E'\n%s sans canal : versement enregistré, statut %s, chat rendu = %s',
      case when v_rs.telegram_statut = 'sans_canal' and v_chat is null then 'OK' else 'KO' end, v_rs.telegram_statut, coalesce(v_chat, 'NULL'));
  else
    reset role;
    v_out := v_out || E'\n-- sans canal : pas de commande La Cabane du 08 au 12, contrôle non joué';
  end if;

  -- ============================ 9. Textes du message (fonction pure)
  v_out := v_out || E'\n----- 12 commandes, même mois :\n' || public.texte_message_versement(185000, 12, '2026-09-15', '2026-09-21',
             array['TF-1','TF-2','TF-3','TF-4','TF-5','TF-6','TF-7','TF-8','TF-9','TF-10','TF-11','TF-12'], 'PP230922.1234');
  v_out := v_out || E'\n----- 1 commande, un jour :\n' || public.texte_message_versement(22000, 1, '2026-09-01', '2026-09-01', array['TF-240'], 'REF1');
  v_out := v_out || E'\n----- deux mois :\n' || public.texte_message_versement(57000, 2, '2026-08-28', '2026-09-03', array['TF-9','TF-10'], 'REF2');

  -- ============================ 10. Rattachement : reprise, cas limites, totaux
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- Une commande sans `delivered_at` (passée « livrée » depuis l'admin, cf.
  -- TF-248) reste VISIBLE et rattachable : elle est datée par `created_at`.
  select count(*) filter (where c.deja_reverse), count(*)
    into v_n, v_somme
  from public.admin_commandes_a_reverser(v_bidul, '2026-09-15', '2026-09-21') c
  join public.orders o on o.id = c.order_id
  where o.delivered_at is null;
  if v_somme > 0 and v_n = v_somme then
    v_ok := v_ok + 1; v_out := v_out || format(E'\nOK %s commande(s) sans delivered_at : visible(s) dans le détail et rattachée(s)', v_somme);
  else
    v_ko := v_ko + 1; v_out := v_out || format(E'\nKO commandes sans delivered_at : %s vue(s), %s rattachée(s)', v_somme, v_n);
  end if;

  reset role;
  -- Aucune commande ne peut appartenir à deux reversements : la clé primaire le
  -- garantit, on le vérifie quand même sur toute la base.
  select count(*) into v_n from (
    select so.order_id from public.settlement_orders so group by so.order_id having count(*) > 1) x;
  if v_n = 0 then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK aucune commande rattachée à deux reversements';
  else
    v_ko := v_ko + 1; v_out := v_out || format(E'\nKO %s commande(s) rattachée(s) plusieurs fois', v_n);
  end if;

  -- Le restaurant d'un rattachement est bien celui de la commande ET celui du
  -- reversement (contrainte composite sur (order_id, restaurant_id)).
  select count(*) into v_n
  from public.settlement_orders so
  join public.orders o on o.id = so.order_id
  join public.restaurant_settlements s on s.id = so.settlement_id
  where o.restaurant_id <> so.restaurant_id or s.restaurant_id <> so.restaurant_id;
  if v_n = 0 then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK tout rattachement porte sur le bon restaurant';
  else
    v_ko := v_ko + 1; v_out := v_out || format(E'\nKO %s rattachement(s) de restaurant incohérent', v_n);
  end if;

  -- La base refuse frontalement un rattachement en double, hors de toute RPC.
  begin
    insert into public.settlement_orders (order_id, settlement_id, restaurant_id, net)
    select so.order_id, so.settlement_id, so.restaurant_id, so.net from public.settlement_orders so limit 1;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO un deuxième rattachement de la même commande a été accepté';
  exception when unique_violation then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK la clé primaire refuse un deuxième rattachement de la même commande';
  end;

  -- Reprise : chaque reversement d'avant le 2026-09-23 a ses commandes.
  for r in
    select s.id, s.period_start, s.period_end, s.amount_due, s.paid_amount, rr.name,
           (select count(*) from public.settlement_orders so where so.settlement_id = s.id) as nb,
           (select coalesce(sum(so.net), 0) from public.settlement_orders so where so.settlement_id = s.id) as somme
    from public.restaurant_settlements s join public.restaurants rr on rr.id = s.restaurant_id
    where s.id = any(v_anciens)
    order by s.period_start
  loop
    if r.nb > 0 then
      v_ok := v_ok + 1;
      v_out := v_out || format(E'\nOK reprise %s %s→%s : %s commande(s), somme des nets %s (dû enregistré %s, payé %s)',
        r.name, r.period_start, r.period_end, r.nb, r.somme, r.amount_due, r.paid_amount);
    else
      v_ko := v_ko + 1;
      v_out := v_out || format(E'\nKO reprise %s %s→%s : aucune commande rattachée', r.name, r.period_start, r.period_end);
    end if;
  end loop;

  -- ============================ 11. Reverser LES COMMANDES CHOISIES
  -- (migration 20260923140000). Tout se joue sur Chez Bidul 22→23/09, période
  -- restée intacte jusqu'ici : TF-267 (sans `delivered_at`) et TF-268.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin
    set local role anon;
    perform public.admin_enregistrer_versement_commandes(v_bidul, '{}'::uuid[], 1000, 'ANON-LISTE', 0);
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO anon appelle admin_enregistrer_versement_commandes';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK anon ne peut pas reverser une liste de commandes';
  end;
  begin
    set local role authenticated;
    perform public.versement_enregistrer_core(v_bidul, '{}'::uuid[], null, null, 1000, 'CORE', 0);
    reset role;
    v_ko := v_ko + 1; v_out := v_out || E'\nKO le cœur est appelable de l''extérieur';
  exception when insufficient_privilege then
    reset role;
    v_ok := v_ok + 1; v_out := v_out || E'\nOK versement_enregistrer_core n''est appelable par personne de l''extérieur';
  end;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select array_agg(c.order_id order by c.livree_le), (count(*))::int
    into v_choix, v_n
  from public.admin_commandes_a_reverser(v_bidul, '2026-09-22', '2026-09-23') c
  where not c.deja_reverse;

  begin
    perform public.admin_enregistrer_versement_commandes(v_bidul, '{}'::uuid[], 1000, 'TEST-LISTE-VIDE', 0);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO liste vide acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK liste vide refusée : ' || sqlerrm;
  end;

  -- Commande d'un AUTRE restaurant : refusée.
  select o.id into v_une from public.orders o
  where o.restaurant_id = v_cabane and o.status = 'livree' limit 1;
  begin
    perform public.admin_enregistrer_versement_commandes(v_bidul, array[v_une], 1000, 'TEST-AUTRE-RESTO', 1000);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO commande d''un autre restaurant acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK commande d''un autre restaurant refusée : ' || sqlerrm;
  end;

  -- Commande NON livrée : refusée.
  select o.id into v_une from public.orders o where o.status <> 'livree' limit 1;
  if v_une is not null then
    begin
      perform public.admin_enregistrer_versement_commandes(
        (select restaurant_id from public.orders where id = v_une), array[v_une], 1000, 'TEST-NON-LIVREE', 1000);
      v_ko := v_ko + 1; v_out := v_out || E'\nKO commande non livrée acceptée';
    exception when others then
      v_ok := v_ok + 1; v_out := v_out || E'\nOK commande non livrée refusée : ' || sqlerrm;
    end;
  end if;

  -- Commande DÉJÀ rattachée : refusée.
  reset role;
  select so.order_id into v_une from public.settlement_orders so limit 1;
  set local role authenticated;
  begin
    perform public.admin_enregistrer_versement_commandes(
      (select restaurant_id from public.orders where id = v_une), array[v_une], 1000, 'TEST-DEJA-RATTACHEE', 1000);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO commande déjà rattachée acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK commande déjà rattachée refusée : ' || sqlerrm;
  end;

  -- SÉLECTION PARTIELLE : une seule des deux commandes de la période.
  select c.net into v_du from public.admin_commandes_a_reverser(v_bidul, '2026-09-22', '2026-09-23') c
  where c.order_id = v_choix[1];
  begin
    perform public.admin_enregistrer_versement_commandes(v_bidul, array[v_choix[1]], v_du, 'TEST-SEL-PERIME', v_du + 1);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO dû périmé accepté en mode liste';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK dû périmé refusé en mode liste : ' || sqlerrm;
  end;

  select * into v_rs from public.admin_enregistrer_versement_commandes(
    v_bidul, array[v_choix[1]], v_du, 'TEST-SELECTION-1', v_du);
  reset role;
  select count(*), coalesce(sum(so.net), 0) into v_n, v_somme
  from public.settlement_orders so where so.settlement_id = v_rs.id;
  set local role authenticated;
  if v_rs.nb_commandes = 1 and v_rs.amount_due = v_du and v_n = 1 and v_somme = v_du then
    v_ok := v_ok + 1;
    v_out := v_out || format(E'\nOK sélection d''UNE commande : %s, dû %s = somme des nets rattachés, période %s→%s (min/max des commandes retenues)',
      v_rs.numeros_commandes, v_rs.amount_due, v_rs.period_start, v_rs.period_end);
  else
    v_ko := v_ko + 1;
    v_out := v_out || format(E'\nKO sélection d''UNE commande : nb %s, dû %s (attendu %s), rattachées %s somme %s',
      v_rs.nb_commandes, v_rs.amount_due, v_du, v_n, v_somme);
  end if;

  -- La MÊME commande, une seconde fois : refusée par le rattachement.
  begin
    perform public.admin_enregistrer_versement_commandes(v_bidul, array[v_choix[1]], v_du, 'TEST-SELECTION-BIS', v_du);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO même commande reversée deux fois';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK même commande refusée au second versement : ' || sqlerrm;
  end;

  -- Le SOLDE : l'autre commande passe, et il ne reste plus rien à reverser.
  select coalesce(sum(c.net) filter (where not c.deja_reverse), 0) into v_du
  from public.admin_commandes_a_reverser(v_bidul, '2026-09-22', '2026-09-23') c;
  select * into v_rs from public.admin_enregistrer_versement_commandes(
    v_bidul, array[v_choix[2]], v_du, 'TEST-SELECTION-2', v_du);
  select coalesce(sum(c.net) filter (where not c.deja_reverse), 0),
         (count(*) filter (where c.deja_reverse))::int
    into v_somme, v_n
  from public.admin_commandes_a_reverser(v_bidul, '2026-09-22', '2026-09-23') c;
  if v_somme = 0 and v_n = 2 then
    v_ok := v_ok + 1;
    v_out := v_out || format(E'\nOK solde de la période : 2ᵉ versement de %s, reste 0 à reverser, %s commandes marquées reversées', v_rs.amount_due, v_n);
  else
    v_ko := v_ko + 1;
    v_out := v_out || format(E'\nKO solde : reste %s à reverser, %s marquées reversées', v_somme, v_n);
  end if;

  raise exception 'RESULTAT >>> % OK, % KO%', v_ok, v_ko, v_out;
end
$t$;
