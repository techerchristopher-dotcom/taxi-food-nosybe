-- Recette de la messagerie de commande (lot 1) — 2026-10-13 : 27 contrôles, 27 OK (après le correctif clock_timestamp). Tout se passe dans un bloc qui finit par
-- une exception : rien n'est conservé (ni message, ni fichier, ni changement de commande).
-- Identifiants relevés le 2026-10-13 : TF-393 (Les Siciliens, livrée par le porteur du projet).
do $$
declare
  c_order   uuid := '37253212-5f1e-4cf3-b58b-0ab2f76b5a31';
  c_client  uuid := '8f17abf8-39fd-4f73-954b-0d84f8aaad7b';
  c_livreur uuid := '9ca91352-d36d-4500-87fd-68d0f696640d';
  c_staff   uuid := '00ca5a14-f33c-42c5-a4e7-860e61e2fad7';
  c_autre   uuid := 'c9d2758b-606d-4ff3-ad50-cc10dc361dd6';
  c_tel     uuid := 'ac6022bb-e99b-44a1-8e6a-b66584dc74a9';
  v_out text := '';
  v_ok int := 0; v_ko int := 0;
  v_j json;
  v_n int;
  v_path text;

  -- petit outil : exécute un appel sous une identité, rend 'OK' ou le message d'erreur
begin
  -- La commande redevient « en livraison », livreur assigné.
  update public.orders set status = 'en_livraison', delivered_at = null, courier_id = c_livreur
   where id = c_order;

  -- 1. le client écrit
  perform set_config('request.jwt.claims', json_build_object('sub', c_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    v_j := public.messagerie_envoyer(c_order, 'client', '  Bonjour,   le portail est   bleu  ', null);
    if v_j->>'texte' = 'Bonjour, le portail est bleu' then v_ok := v_ok + 1; v_out := v_out || E'\n1 OK client ecrit, texte nettoye';
    else v_ko := v_ko + 1; v_out := v_out || E'\n1 KO texte=' || (v_j->>'texte'); end if;
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n1 KO ' || sqlerrm; end;

  -- 2. le client ne peut pas se faire passer pour le livreur
  begin
    perform public.messagerie_envoyer(c_order, 'livreur', 'je suis le livreur', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n2 KO usurpation acceptee';
  exception when others then
    if sqlerrm = 'messagerie:acces_refuse' then v_ok := v_ok + 1; v_out := v_out || E'\n2 OK usurpation refusee';
    else v_ko := v_ko + 1; v_out := v_out || E'\n2 KO ' || sqlerrm; end if;
  end;

  -- 3. vide refusé, trop long refusé
  begin perform public.messagerie_envoyer(c_order, 'client', '   ', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n3a KO vide accepte';
  exception when others then
    if sqlerrm = 'messagerie:vide' then v_ok := v_ok + 1; v_out := v_out || E'\n3a OK vide refuse'; else v_ko := v_ko + 1; v_out := v_out || E'\n3a KO ' || sqlerrm; end if; end;
  begin perform public.messagerie_envoyer(c_order, 'client', repeat('a', 501), null);
    v_ko := v_ko + 1; v_out := v_out || E'\n3b KO 501 car accepte';
  exception when others then
    if sqlerrm = 'messagerie:trop_long' then v_ok := v_ok + 1; v_out := v_out || E'\n3b OK trop long refuse'; else v_ko := v_ko + 1; v_out := v_out || E'\n3b KO ' || sqlerrm; end if; end;

  -- 4. photo hors de son dossier, ou inexistante
  begin perform public.messagerie_envoyer(c_order, 'client', null, c_order || '/' || c_livreur || '/x.jpg');
    v_ko := v_ko + 1; v_out := v_out || E'\n4a KO photo d''autrui acceptee';
  exception when others then
    if sqlerrm = 'messagerie:photo_invalide' then v_ok := v_ok + 1; v_out := v_out || E'\n4a OK photo d''autrui refusee'; else v_ko := v_ko + 1; v_out := v_out || E'\n4a KO ' || sqlerrm; end if; end;
  begin perform public.messagerie_envoyer(c_order, 'client', null, c_order || '/' || c_client || '/absente.jpg');
    v_ko := v_ko + 1; v_out := v_out || E'\n4b KO photo absente acceptee';
  exception when others then
    if sqlerrm = 'messagerie:photo_invalide' then v_ok := v_ok + 1; v_out := v_out || E'\n4b OK photo absente refusee'; else v_ko := v_ko + 1; v_out := v_out || E'\n4b KO ' || sqlerrm; end if; end;

  -- 5. lecture directe de la table refusée
  begin perform count(*) from public.messages_commande;
    v_ko := v_ko + 1; v_out := v_out || E'\n5 KO table lisible';
  exception when insufficient_privilege then v_ok := v_ok + 1; v_out := v_out || E'\n5 OK table illisible'; end;

  -- 6. dépôt d'un fichier par la politique Storage (dossier du client)
  v_path := c_order || '/' || c_client || '/test.jpg';
  begin
    insert into storage.objects (bucket_id, name, owner, metadata) values ('messages', v_path, c_client, '{"mimetype":"image/jpeg"}');
    v_ok := v_ok + 1; v_out := v_out || E'\n6a OK depot dans son dossier';
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n6a KO ' || sqlerrm; end;
  begin
    insert into storage.objects (bucket_id, name, owner) values ('messages', c_order || '/' || c_livreur || '/pirate.jpg', c_client);
    v_ko := v_ko + 1; v_out := v_out || E'\n6b KO depot dans le dossier d''autrui';
  exception when others then v_ok := v_ok + 1; v_out := v_out || E'\n6b OK depot chez autrui refuse'; end;
  begin
    v_j := public.messagerie_envoyer(c_order, 'client', 'voici le portail', v_path);
    v_ok := v_ok + 1; v_out := v_out || E'\n6c OK message avec photo';
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n6c KO ' || sqlerrm; end;
  execute 'reset role';

  -- 7. le livreur lit (3 non lus), puis répond
  perform set_config('request.jwt.claims', json_build_object('sub', c_livreur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select non_lus into v_n from public.messagerie_non_lus('livreur', array[c_order]);
  if v_n = 2 then v_ok := v_ok + 1; v_out := v_out || E'\n7a OK livreur : 2 non lus';
  else v_ko := v_ko + 1; v_out := v_out || E'\n7a KO non lus=' || coalesce(v_n::text,'null'); end if;
  v_j := public.messagerie_lire(c_order, 'livreur', null);
  if json_array_length(v_j->'messages') = 2 and (v_j->>'peut_ecrire')::boolean
     and (v_j->'messages'->0->>'est_moi')::boolean = false then
    v_ok := v_ok + 1; v_out := v_out || E'\n7b OK livreur lit 2 messages, client=' || coalesce(v_j->'participants'->>'client','?')
      || ' livreur=' || coalesce(v_j->'participants'->>'livreur','?') || ' resto=' || coalesce(v_j->'participants'->>'restaurant','?');
  else v_ko := v_ko + 1; v_out := v_out || E'\n7b KO ' || v_j::text; end if;
  select non_lus into v_n from public.messagerie_non_lus('livreur', array[c_order]);
  if v_n = 0 then v_ok := v_ok + 1; v_out := v_out || E'\n7c OK lu apres lecture'; else v_ko := v_ko + 1; v_out := v_out || E'\n7c KO non lus=' || v_n; end if;
  begin
    perform public.messagerie_envoyer(c_order, 'livreur', 'J''arrive dans 5 min', null);
    v_ok := v_ok + 1; v_out := v_out || E'\n7d OK livreur repond';
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n7d KO ' || sqlerrm; end;
  -- le livreur lit la photo (politique de lecture)
  select count(*) into v_n from storage.objects where bucket_id = 'messages' and name = v_path;
  if v_n = 1 then v_ok := v_ok + 1; v_out := v_out || E'\n7e OK livreur voit la photo'; else v_ko := v_ko + 1; v_out := v_out || E'\n7e KO photo invisible'; end if;
  execute 'reset role';

  -- 8. le restaurant écrit
  perform set_config('request.jwt.claims', json_build_object('sub', c_staff, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    v_j := public.messagerie_envoyer(c_order, 'restaurant', 'La commande est partie', null);
    v_ok := v_ok + 1; v_out := v_out || E'\n8 OK restaurant ecrit, nom=' || coalesce(v_j->>'auteur_nom','?');
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n8 KO ' || sqlerrm; end;
  execute 'reset role';

  -- 9. un inconnu : ni lecture, ni écriture, ni photo
  perform set_config('request.jwt.claims', json_build_object('sub', c_autre, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.messagerie_lire(c_order, 'client', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n9a KO inconnu lit';
  exception when others then
    if sqlerrm = 'messagerie:acces_refuse' then v_ok := v_ok + 1; v_out := v_out || E'\n9a OK inconnu refuse'; else v_ko := v_ko + 1; v_out := v_out || E'\n9a KO ' || sqlerrm; end if; end;
  select count(*) into v_n from storage.objects where bucket_id = 'messages';
  if v_n = 0 then v_ok := v_ok + 1; v_out := v_out || E'\n9b OK inconnu ne voit aucune photo'; else v_ko := v_ko + 1; v_out := v_out || E'\n9b KO voit ' || v_n; end if;
  execute 'reset role';

  -- 10. le client voit 2 non lus (livreur + restaurant)
  perform set_config('request.jwt.claims', json_build_object('sub', c_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select non_lus into v_n from public.messagerie_non_lus('client', null) where order_id = c_order;
  if v_n = 2 then v_ok := v_ok + 1; v_out := v_out || E'\n10 OK client : 2 non lus'; else v_ko := v_ko + 1; v_out := v_out || E'\n10 KO non lus=' || coalesce(v_n::text,'null'); end if;
  -- 11. plafond : 12 par minute (il en a déjà 2)
  begin
    for i in 1..10 loop perform public.messagerie_envoyer(c_order, 'client', 'm' || i, null); end loop;
    perform public.messagerie_envoyer(c_order, 'client', 'un de trop', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n11 KO plafond non applique';
  exception when others then
    if sqlerrm = 'messagerie:trop_rapide' then v_ok := v_ok + 1; v_out := v_out || E'\n11 OK plafond 12/min'; else v_ko := v_ko + 1; v_out := v_out || E'\n11 KO ' || sqlerrm; end if; end;
  execute 'reset role';

  -- 12. le livreur relâche la course : il perd l'accès
  update public.orders set courier_id = null where id = c_order;
  perform set_config('request.jwt.claims', json_build_object('sub', c_livreur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.messagerie_lire(c_order, 'livreur', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n12 KO livreur relache lit encore';
  exception when others then v_ok := v_ok + 1; v_out := v_out || E'\n12 OK livreur relache : ' || sqlerrm; end;
  execute 'reset role';

  -- 13. livrée il y a 3 h : lecture oui, écriture non
  update public.orders set courier_id = c_livreur, status = 'livree', delivered_at = now() - interval '3 hours' where id = c_order;
  perform set_config('request.jwt.claims', json_build_object('sub', c_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_j := public.messagerie_lire(c_order, 'client', null);
  if not (v_j->>'peut_ecrire')::boolean then v_ok := v_ok + 1; v_out := v_out || E'\n13a OK lecture seule apres 2 h'; else v_ko := v_ko + 1; v_out := v_out || E'\n13a KO encore ouverte'; end if;
  begin perform public.messagerie_envoyer(c_order, 'client', 'trop tard', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n13b KO ecriture apres fermeture';
  exception when others then
    if sqlerrm = 'messagerie:fermee' then v_ok := v_ok + 1; v_out := v_out || E'\n13b OK fermee'; else v_ko := v_ko + 1; v_out := v_out || E'\n13b KO ' || sqlerrm; end if; end;
  execute 'reset role';

  -- 14. livrée il y a 1 h : encore ouverte
  update public.orders set delivered_at = now() - interval '1 hour' where id = c_order;
  perform set_config('request.jwt.claims', json_build_object('sub', c_client, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  v_j := public.messagerie_lire(c_order, 'client', null);
  if (v_j->>'peut_ecrire')::boolean then v_ok := v_ok + 1; v_out := v_out || E'\n14 OK ouverte 1 h apres'; else v_ko := v_ko + 1; v_out := v_out || E'\n14 KO fermee trop tot'; end if;
  execute 'reset role';

  -- 15. commande par téléphone : aucune messagerie, même pour l'admin
  perform set_config('request.jwt.claims', json_build_object('sub', c_livreur, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin perform public.messagerie_envoyer(c_tel, 'admin', 'x', null);
    v_ko := v_ko + 1; v_out := v_out || E'\n15 KO commande telephone';
  exception when others then
    if sqlerrm = 'messagerie:acces_refuse' then v_ok := v_ok + 1; v_out := v_out || E'\n15 OK commande telephone refusee'; else v_ko := v_ko + 1; v_out := v_out || E'\n15 KO ' || sqlerrm; end if; end;
  -- 16. l'admin lit tout
  begin
    v_j := public.messagerie_lire(c_order, 'admin', null);
    v_ok := v_ok + 1; v_out := v_out || E'\n16 OK admin lit ' || json_array_length(v_j->'messages') || ' messages';
  exception when others then v_ko := v_ko + 1; v_out := v_out || E'\n16 KO ' || sqlerrm; end;
  execute 'reset role';

  -- 17. anon n'exécute rien
  if not has_function_privilege('anon', 'public.messagerie_envoyer(uuid,text,text,text)', 'execute')
     and not has_function_privilege('anon', 'public.messagerie_lire(uuid,text,timestamptz)', 'execute')
     and not has_function_privilege('authenticated', 'public.messagerie_acces(uuid,text)', 'execute') then
    v_ok := v_ok + 1; v_out := v_out || E'\n17 OK anon exclu, messagerie_acces interne';
  else v_ko := v_ko + 1; v_out := v_out || E'\n17 KO droits'; end if;

  raise exception 'RESULTAT >>> % OK, % KO%', v_ok, v_ko, v_out;
end $$;
