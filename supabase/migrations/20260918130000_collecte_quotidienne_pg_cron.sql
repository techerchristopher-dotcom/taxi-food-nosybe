-- La collecte des telechargements tourne toute seule, une fois par jour.
--
-- ⚠️ `pg_cron` n'etait pas installe sur ce projet (CLAUDE.md le notait pour
-- expliquer qu'AUCUN remboursement ne se relance tout seul). Il l'est desormais,
-- et la premiere tache qu'il porte est cette collecte.
--
-- 09:30 UTC = 12:30 a Nosy Be. Apple publie le rapport de la veille dans la
-- matinee ; en cas de retard, le rattrapage des 7 derniers jours au passage
-- suivant recupere la journee manquee — c'est pour ca que la fonction ne
-- regarde pas que « hier ».
--
-- Le secret part du Vault, jamais du code : la tache lit `collecte_hook_secret`
-- au moment de l'appel.
create extension if not exists pg_cron;

select cron.schedule(
  'collecte-telechargements',
  '30 9 * * *',
  $cmd$
  select net.http_post(
    url := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/collecter-telechargements',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-hook-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'collecte_hook_secret')),
    body := jsonb_build_object('jours', 7),
    timeout_milliseconds := 60000);
  $cmd$
);
