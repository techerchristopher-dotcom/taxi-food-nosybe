-- La bascule « confirmee -> en_preparation » tourne toutes les 30 secondes.
--
-- pg_cron 1.6.4 sur ce projet : les intervalles en secondes ('N seconds', 1 a 59)
-- existent depuis la 1.5. Pas besoin de fonction Edge ni d'appel HTTP : la tache
-- appelle directement la fonction SQL (voir 20260922100000).
--
-- ⏱️ DELAI REEL : entre 30 et 60 s apres l'acceptation. La commande devient
-- eligible a 30 s ; le passage suivant de la tache (toutes les 30 s) la prend.
-- Les notifications partent ensuite par pg_net (asynchrone, quelques secondes).
-- L'ecran client se rafraichit toutes les 15 s, l'ecran restaurant toutes les 12 s.
--
-- Couper la bascule pour TOUS les restaurants, sans migration :
--   select cron.alter_job((select jobid from cron.job where jobname = 'preparation-automatique'), active := false);
-- La remettre : meme chose avec active := true.
-- Pour UN restaurant : update public.restaurants set preparation_auto = false where id = '…';

select cron.schedule(
  'preparation-automatique',
  '30 seconds',
  $cmd$select public.passer_en_preparation_automatiquement()$cmd$
);

-- 2 880 passages par jour : le journal `cron.job_run_details` grossirait sans
-- fin. On ne garde que 2 jours de CETTE tache (les autres ne sont pas touchees).
select cron.schedule(
  'preparation-automatique-purge-journal',
  '17 3 * * *',
  $cmd$
  delete from cron.job_run_details
   where jobid = (select jobid from cron.job where jobname = 'preparation-automatique')
     and end_time < now() - interval '2 days';
  $cmd$
);
