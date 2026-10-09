-- Alertes Telegram : délai d'attente porté de 5 s à 20 s (2026-10-09).
--
-- Constat : TF-375 (Les Siciliens, 18:05) n'est jamais arrivée dans le canal admin.
-- `net._http_response` : « Timeout of 5000 ms reached … TCP/SSL handshake time: 4998 ms ».
-- Telegram a mis plus de 5 s à accepter la connexion ; pg_net ne réessaie pas, le message
-- est perdu. Deuxième cas le même jour à 17:49. Le client et le restaurant, eux, avaient
-- bien été prévenus (notify-order et n8n ont répondu).
--
-- Les appels pg_net partent en arrière-plan après le COMMIT : un délai plus long ne
-- retarde ni la commande ni l'écran du client. On aligne tous les appels de ces
-- fonctions sur 20 s (valeur déjà utilisée par `alerter_demande_prevenir`).
-- Patch par expression régulière sur la définition en base. ⚠️ En Postgres, la fin de mot
-- s'écrit \y ; \b y signifie « retour arrière » et le patch ne remplace alors RIEN.

do $$
declare
  f text;
  v_def text;
begin
  foreach f in array array[
    'public.notify_order_status()',
    'public.alerter_demande_prevenir()',
    'public.alerter_message_prive()',
    'public.alerter_nouvel_avis()',
    'public.annonce_programmee_telegram(text)'
  ] loop
    v_def := pg_get_functiondef(f::regprocedure);
    v_def := regexp_replace(v_def, 'timeout_milliseconds\s*:=\s*(5000|10000)\y',
                            'timeout_milliseconds := 20000', 'g');
    execute v_def;
  end loop;
end $$;
