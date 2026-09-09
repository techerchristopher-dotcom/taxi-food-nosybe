-- Un canal Telegram pour le patron : toutes les commandes, tous les restaurants.
--
-- Aujourd'hui le message Telegram part au restaurant CONCERNE, avec ses boutons
-- d'acceptation. Personne ne recoit la vue d'ensemble : le patron ne sait qu'une
-- commande est tombee que s'il regarde son tableau de bord.
--
-- On ajoute donc au message envoye a n8n un bloc `admin.telegram_chat_id`, lu
-- dans le Vault. n8n s'en sert pour poster une copie dans le canal du patron.
--
-- ⚠️ Pourquoi le Vault et non un identifiant ecrit en dur dans n8n : changer de
-- canal ne doit pas demander de rouvrir le workflow ni de le reimporter. Une
-- ligne de SQL suffit, et le fichier n8n versionne reste valable.
--
-- ⚠️ INERTE TANT QUE LE SECRET N'EST PAS POSE : sans `telegram_admin_chat_id`
-- dans le Vault, le champ vaut null et n8n saute simplement l'envoi. Rien ne
-- casse, rien n'est envoye — meme principe que `n8n_webhook_url`.
--
-- Pour poser le secret (identifiant du canal, negatif, du type -100123456789) :
--   select vault.create_secret('-100XXXXXXXXXX', 'telegram_admin_chat_id',
--                              'Canal Telegram du patron : copie de toutes les commandes');
-- Pour en changer plus tard :
--   select vault.update_secret(
--            (select id from vault.secrets where name = 'telegram_admin_chat_id'),
--            '-100AUTRECANAL');

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

  if v_def like '%telegram_admin_chat_id%' then
    raise notice 'bloc admin deja present — rien a faire';
    return;
  end if;

  v_new := replace(v_def,
'    ''restaurant'', jsonb_build_object(''id'',r.id,''nom'',r.name,''telephone'',r.phone,',
'    ''admin'', jsonb_build_object(''telegram_chat_id'',
      (select decrypted_secret from vault.decrypted_secrets
        where name = ''telegram_admin_chat_id'')),
    ''restaurant'', jsonb_build_object(''id'',r.id,''nom'',r.name,''telephone'',r.phone,');

  if v_new not like '%telegram_admin_chat_id%' then
    raise exception 'motif introuvable dans notify_order_status — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;
