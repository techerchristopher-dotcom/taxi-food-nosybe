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
  v_rs public.restaurant_settlements;
  v_row public.restaurant_settlements;
  v_chat text;
  v_txt text;
  v_msg text;
  r record;

begin
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
    begin
      select * into v_rs from public.record_settlement(r.resto, r.d1, r.d2, 0);
      raise exception 'annule' using errcode = 'P0099';
    exception when sqlstate 'P0099' then null;
    end;
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

  -- ============================ 5. Période déjà payée (La Cabane, 20/09) : refusée
  select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(v_cabane, '2026-09-18', '2026-09-22');
  begin
    perform public.admin_enregistrer_versement(v_cabane, '2026-09-18', '2026-09-22', greatest(v_du, 1), 'TEST-CHEVAUCHE', v_du);
    v_ko := v_ko + 1; v_out := v_out || E'\nKO période chevauchant un versement existant acceptée';
  exception when others then
    v_ok := v_ok + 1; v_out := v_out || E'\nOK chevauchement refusé : ' || sqlerrm;
  end;

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
  select coalesce(sum(net), 0) into v_du from public.admin_commandes_a_reverser(v_cabane, '2026-09-08', '2026-09-12');
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

  raise exception 'RESULTAT >>> % OK, % KO%', v_ok, v_ko, v_out;
end
$t$;
