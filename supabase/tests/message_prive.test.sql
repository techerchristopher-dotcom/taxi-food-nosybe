-- Recette du message privé au restaurant (migration 20261007180000). À lancer tel
-- quel par `execute_sql` : le bloc finit par une exception, donc RIEN n'est écrit
-- (commandes, avis, messages, mouvements) et `net.http_post` n'envoie rien — les
-- requêtes Telegram sont lues dans `net.http_request_queue` AVANT l'annulation.
-- ⚠️ Chaque `create_order` consomme un numéro TF- (séquence non annulable).
-- Taxi Be (masqué, sans Telegram) : commandable le temps du bloc ; pour le scénario
-- Telegram, on lui pose un chat_id BIDON et la langue `it` (annulés eux aussi).
-- Jamais l'URL des requêtes en sortie : elle contient le jeton du bot.
-- Résultat obtenu (2026-10-07, TF-342 à TF-347 consommés) :
--   1 ancienne signature : message_prive=false, +1000, 0 message
--   2 stocké « Le riz était un peu froid bce soir/b .⏎⏎Merci ! », +1000 ; file : ADMIN, ADMIN
--     (copie de l'avis + copie du message privé, rien vers le restaurant sans chat)
--   3 auteur / admin / staff Taxi Be : lisent le message ; avis_restaurant : 0 occurrence ;
--     autre client : mon_avis null, 0 ligne, SELECT refusé (42501) ; anon : refusé (42501)
--   4 chat bidon + it : « 🔒 Messaggio privato di un cliente — ordine TF-347 (★ 3,5/5) … » + copie admin
--   5 501 caractères → avis:message_prive_trop_long
do $$
declare
  R  constant uuid := 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886';  -- Taxi Be
  U  constant uuid := '9ca91352-d36d-4500-87fd-68d0f696640d';  -- admin, client de test
  A  constant uuid := '89317e34-4977-471e-b4db-f54a16304edc';  -- son adresse
  S  constant uuid := '0d92bbb8-0087-485d-89d2-4e4342842133';  -- demo.resto@taxifood.mg
  X  constant uuid := 'cfb2926f-bdf0-4365-be16-d3510cc2e6f2';  -- un autre client
  P  uuid;
  log text := '';
  o1 public.orders; o2 public.orders; o3 public.orders;
  j jsonb; n int; q0 bigint; v_admin text;
  items jsonb;
begin
  select id into P from products where restaurant_id = R and is_available limit 1;
  items := jsonb_build_array(jsonb_build_object('product_id', P, 'quantity', 1, 'options', '[]'::jsonb));
  update restaurants set listing_status='visible', is_open=true, telegram_chat_id=null where id=R;
  update categories set serving_from=null, serving_to=null where id=(select category_id from products where id=P);
  select decrypted_secret into v_admin from vault.decrypted_secrets where name = 'telegram_admin_chat_id';

  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  select * into o1 from create_order(R, A, 'especes', items);
  select * into o2 from create_order(R, A, 'especes', items);
  select * into o3 from create_order(R, A, 'especes', items);
  perform set_config('role','postgres', true);
  update orders set status='livree' where id in (o1.id, o2.id, o3.id);
  select coalesce(max(id), 0) into q0 from net.http_request_queue;

  -- 1. Ancienne signature (8 arguments nommés, comme l'app installée)
  perform set_config('role','authenticated', true);
  j := deposer_avis(p_order_id=>o1.id, p_cuisine=>5, p_preparation=>4, p_livraison=>5,
                    p_commentaire=>'public 1', p_consentement=>false, p_langue=>'fr', p_photo_url=>null);
  log := log || '1 ancienne signature -> ' || j::text || E'\n';
  perform set_config('role','postgres', true);
  log := log || format('1 messages prives=%s, credit=%s', (select count(*) from avis_messages_prives where order_id=o1.id),
                       (select sum(montant) from porte_monnaie_mouvements where order_id=o1.id and motif='avis')) || E'\n';

  -- 2. Avec message privé, restaurant SANS Telegram → seule la copie admin part
  select coalesce(max(id), 0) into q0 from net.http_request_queue;
  perform set_config('role','authenticated', true);
  j := deposer_avis(o2.id, 4, 5, 4, 'Très bon', true, 'fr', null,
                    E'  Le riz était un peu froid <b>ce soir</b>\u0007.\n\n\n\nMerci !  ');
  log := log || '2 avec message -> ' || j::text || E'\n';
  perform set_config('role','postgres', true);
  log := log || '2 stocke: ' || (select format('%L credit=%s', message,
     (select sum(montant) from porte_monnaie_mouvements where order_id=o2.id and motif='avis')) from avis_messages_prives where order_id=o2.id) || E'\n';
  log := log || '2 file Telegram (sans chat resto): ' || coalesce((select string_agg(
       case when b->>'chat_id' = v_admin then 'ADMIN' else 'AUTRE:' || (b->>'chat_id') end, ', ')
     from (select convert_from(body,'UTF8')::jsonb b from net.http_request_queue where id > q0) t), 'rien') || E'\n';

  -- 3. Lectures
  perform set_config('role','authenticated', true);
  log := log || '3 auteur mon_avis.message_prive=' || coalesce(mon_avis(o2.id)->>'message_prive', 'NULL') || E'\n';
  log := log || '3 admin admin_avis_lister=' || coalesce((select message_prive from admin_avis_lister('messages_prives') where order_id=o2.id), 'NULL') || E'\n';
  log := log || '3 avis_restaurant (public) contient le message ? ' ||
     (select count(*) from avis_restaurant(R, 200, 0) ar where ar::text like '%riz était%') || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub',S,'role','authenticated')::text, true);
  log := log || '3 staff Taxi Be=' || coalesce((select message_prive from avis_de_mon_restaurant(R) where order_id=o2.id), 'NULL') || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub',X,'role','authenticated')::text, true);
  log := log || format('3 autre client: mon_avis=%s, resto=%s lignes, admin=%s lignes',
     coalesce(mon_avis(o2.id)::text, 'null'), (select count(*) from avis_de_mon_restaurant(R)),
     (select count(*) from admin_avis_lister('tous'))) || E'\n';
  begin
    select count(*) into n from avis_messages_prives;
    log := log || '3 autre client SELECT direct ACCEPTE (KO) ' || n || E'\n';
  exception when insufficient_privilege then log := log || '3 autre client SELECT direct refuse (42501)' || E'\n'; end;
  perform set_config('role','anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    select count(*) into n from avis_messages_prives;
    log := log || '3 anon SELECT direct ACCEPTE (KO) ' || n || E'\n';
  exception when insufficient_privilege then log := log || '3 anon SELECT direct refuse (42501)' || E'\n'; end;
  begin
    perform avis_de_mon_restaurant(R);
    log := log || '3 anon avis_de_mon_restaurant ACCEPTE (KO)' || E'\n';
  exception when insufficient_privilege then log := log || '3 anon avis_de_mon_restaurant refuse (42501)' || E'\n'; end;

  -- 4. Restaurant AVEC Telegram (chat bidon), langue italienne
  perform set_config('role','postgres', true);
  update restaurants set telegram_chat_id='-1009999999999', langue='it' where id=R;
  select coalesce(max(id), 0) into q0 from net.http_request_queue;
  perform set_config('request.jwt.claims', json_build_object('sub',U,'role','authenticated')::text, true);
  perform set_config('role','authenticated', true);
  j := deposer_avis(o3.id, 3, 4, 5, null, false, 'it', null, 'Un po'' troppo sale');
  perform set_config('role','postgres', true);
  log := log || '4 file Telegram:' || E'\n' || coalesce((select string_agg(
       case when b->>'chat_id' = v_admin then '[ADMIN] ' else '[' || (b->>'chat_id') || '] ' end || (b->>'text'), E'\n---\n' order by id)
     from (select id, convert_from(body,'UTF8')::jsonb b from net.http_request_queue where id > q0) t), 'rien') || E'\n';

  -- 5. Trop long → refusé
  perform set_config('role','authenticated', true);
  begin
    perform deposer_avis(o1.id, 5, 5, 5, null, false, 'fr', null, repeat('x', 501));
  exception when others then log := log || '5 501 car. -> ' || sqlerrm || E'\n'; end;

  raise exception E'RESULTATS (transaction annulee)\n%', log;
end $$;
