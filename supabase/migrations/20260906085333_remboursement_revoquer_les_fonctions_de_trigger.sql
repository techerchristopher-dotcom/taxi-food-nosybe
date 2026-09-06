-- ============================================================================
-- Les fonctions de trigger du remboursement etaient exposees comme des RPC
-- ============================================================================
--
-- DEFAUT SIGNALE PAR `get_advisors(security)` apres la migration
-- `20260906084514`, pas par relecture. La regle du projet — « tout
-- `create function` du schema public est suivi d'un REVOKE » — a ete appliquee
-- aux RPC mais OUBLIEE sur les cinq fonctions de trigger. Les privileges par
-- defaut de Supabase accordent EXECUTE a `anon` ET `authenticated` sur toute
-- fonction creee, et trois d'entre elles sont `SECURITY DEFINER` :
--
--   remboursement_sur_annulation()          <- SECURITY DEFINER
--   remboursement_sur_capture_tardive()     <- SECURITY DEFINER
--   repercuter_remboursement_sur_paiement() <- SECURITY DEFINER
--   verifier_plafond_remboursement()
--   payment_refunds_maj_le()
--
-- ⚠️ CE QUE CE N'EST PAS. Une fonction qui rend `trigger` n'est pas exposee par
-- PostgREST, et Postgres refuse de l'appeler autrement que comme trigger
-- (« trigger functions can only be called as triggers »). L'exposition n'est
-- donc pas exploitable aujourd'hui. Mais la regle du projet ne dit pas « revoque
-- ce qui est exploitable », elle dit « revoque tout » — precisement pour ne pas
-- avoir a refaire ce raisonnement a chaque fonction, et pour que l'advisor de
-- securite reste lisible : une alerte qu'on a decide d'ignorer est une alerte
-- qu'on n'ouvrira plus.
revoke all on function public.remboursement_sur_annulation()          from public, anon, authenticated;
revoke all on function public.remboursement_sur_capture_tardive()     from public, anon, authenticated;
revoke all on function public.repercuter_remboursement_sur_paiement() from public, anon, authenticated;
revoke all on function public.verifier_plafond_remboursement()        from public, anon, authenticated;
revoke all on function public.payment_refunds_maj_le()                from public, anon, authenticated;
