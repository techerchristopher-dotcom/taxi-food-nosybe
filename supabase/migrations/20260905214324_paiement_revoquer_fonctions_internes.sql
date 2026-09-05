-- DURCISSEMENT DU SOCLE PAIEMENT — revocation des fonctions internes.
--
-- Version appliquee en base : 20260905214324.
--
-- ⚠️ PIEGE SUPABASE, paye ici : les privileges PAR DEFAUT du schema public
-- accordent `EXECUTE` a `anon` ET `authenticated` sur TOUTE fonction creee
-- (pg_default_acl, defaclobjtype 'f'). Un `grant execute ... to authenticated`
-- est donc ADDITIF : il ne retire rien a `anon`. Il faut revoquer explicitement.
--
-- Consequence concrete : sans ce fichier, les fonctions ci-dessous sont
-- appelables par n'importe qui via `/rest/v1/rpc/<nom>`, y compris sans compte.
-- Le linter Supabase les remonte en `anon_security_definer_function_executable`.
--
-- Aucune n'est reellement exploitable — Postgres refuse d'appeler une fonction
-- trigger hors trigger, et `peut_voir_paiements_commande` rend `false` a un
-- visiteur anonyme. Mais une surface qui n'a aucune raison d'exister ne doit
-- pas exister : le jour ou l'une d'elles change, personne ne se souviendra
-- qu'elle etait exposee.

-- Fonctions trigger : elles n'ont AUCUN appelant legitime hors du trigger.
revoke all on function public.maj_payment_status_commande()          from public, anon, authenticated;
revoke all on function public.verrouiller_montants_commande_payee()  from public, anon, authenticated;
revoke all on function public.payment_intents_maj_le()               from public, anon, authenticated;

-- Oracle de visibilite : sert la policy RLS, qui l'evalue avec les droits du
-- proprietaire. Aucun client n'a a l'appeler, et surtout pas un anonyme.
revoke all on function public.peut_voir_paiements_commande(uuid) from public, anon;

-- `montant_eur_centimes` reste volontairement ouverte a `anon` : une page
-- produit doit pouvoir afficher « environ 11,00 EUR » a un visiteur pas encore
-- connecte. Elle ne lit que le taux, qui est deja public.
