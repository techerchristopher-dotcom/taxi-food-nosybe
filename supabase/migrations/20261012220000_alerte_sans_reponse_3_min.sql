-- Alerte « pas de réponse » : 3 min au lieu de 5 (2026-10-12, demande du porteur du projet).
select cron.alter_job((select jobid from cron.job where jobname = 'alerte-commande-sans-reponse'),
  command := $c$select public.alerter_commandes_sans_reponse(3)$c$);
do $$ begin
  execute replace(pg_get_functiondef('public.alerter_commandes_sans_reponse(integer)'::regprocedure),
                  'p_minutes integer DEFAULT 5', 'p_minutes integer DEFAULT 3');
end $$;
