-- La base previent le patron sur Telegram, directement.
--
-- Premiere idee : ajouter un noeud au workflow n8n. Ca marchait, mais ca
-- imposait de reimporter le workflow existant — avec le risque, s'il est
-- importe comme NOUVEAU workflow, de changer l'URL du webhook et de couper
-- d'un coup toutes les notifications, e-mails clients compris.
--
-- Deuxieme idee (celle du porteur du projet) : un workflow n8n qui SURVEILLE la
-- base. Ecarte : il faut alors donner a n8n un acces a la base, et l'alerte
-- arrive avec le retard du cycle de scrutation — alors que le but est
-- justement d'etre prevenu tout de suite.
--
-- Retenu : la base appelle Telegram ELLE-MEME, dans le trigger, au moment ou la
-- commande est creee. Elle sait deja faire des appels HTTP — c'est ainsi
-- qu'elle appelle n8n et la fonction Edge de push. Un appel de plus, aucune
-- piece mobile supplementaire, et le message part dans la seconde.
--
-- n8n reste en place pour l'e-mail client et le message au restaurant : on ne
-- touche pas a ce qui marche.
--
-- ⚠️ INERTE TANT QUE LES DEUX SECRETS NE SONT PAS POSES. Il faut :
--     telegram_bot_token      — le jeton du robot (il vit aujourd'hui
--                               uniquement dans les identifiants n8n)
--     telegram_admin_chat_id  — deja pose : le canal du patron
--   Sans le jeton, la condition est fausse et rien n'est envoye. Rien ne casse.
--
-- Pour poser le jeton :
--   select vault.create_secret('123456:ABC-DEF...', 'telegram_bot_token',
--            'Jeton du robot @Taxifood_commandes_bot');

do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'notify_order_status';

  if v_def is null then
    raise exception 'notify_order_status introuvable';
  end if;

  if v_def like '%api.telegram.org%' then
    raise notice 'appel Telegram direct deja present';
    return;
  end if;

  v_new := replace(v_def, $ancre$
  return new;
end $ancre$, $ajout$
  -- ------------------------------------------------ Telegram direct au patron
  -- Une COPIE de chaque nouvelle commande, tous restaurants confondus. Pas de
  -- boutons d'acceptation : ce n'est pas au patron d'accepter a la place du
  -- restaurant. `chr(10)` plutot que des sauts de ligne echappes : ce corps de
  -- fonction est reecrit par programme, autant ne pas empiler les niveaux
  -- d'echappement.
  if v_event = 'nouvelle'
     and exists (select 1 from vault.decrypted_secrets where name = 'telegram_bot_token')
     and exists (select 1 from vault.decrypted_secrets where name = 'telegram_admin_chat_id')
  then
    perform net.http_post(
      url := 'https://api.telegram.org/bot'
             || (select decrypted_secret from vault.decrypted_secrets where name = 'telegram_bot_token')
             || '/sendMessage',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'chat_id', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'telegram_admin_chat_id'),
        'disable_web_page_preview', true,
        'text',
             coalesce(v_charge->'restaurant'->>'nom', '?')
          || chr(10) || 'COMMANDE ' || coalesce(v_charge->'commande'->>'numero', '?')
          || chr(10) || chr(10)
          || coalesce((select string_agg('- ' || (a->>'quantite') || ' x ' || (a->>'nom'), chr(10))
                         from jsonb_array_elements(v_charge->'articles') a), '-')
          || chr(10) || chr(10)
          || 'Total : ' || coalesce(v_charge->'commande'->>'total', '?') || ' Ar'
          || ' (' || coalesce(v_charge->'commande'->>'paiement', '?') || ')'
          || chr(10) || 'Client : ' || coalesce(v_charge->'client'->>'nom', '-')
          || coalesce(' - ' || (v_charge->'client'->>'telephone'), '')
          || chr(10) || 'Livraison : ' || coalesce(v_charge->'livraison_adresse'->>'zone', '-')
          || coalesce(' (' || (v_charge->'livraison_adresse'->>'precisions') || ')', '')
          || coalesce(chr(10) || 'https://www.google.com/maps?q='
                      || (v_charge->'livraison_adresse'->>'latitude') || ','
                      || (v_charge->'livraison_adresse'->>'longitude'), '')),
      timeout_milliseconds := 5000);
  end if;

  return new;
end $ajout$);

  if v_new not like '%api.telegram.org%' then
    raise exception 'ancre introuvable dans notify_order_status — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;
