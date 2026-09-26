-- 20260920151500_chez_bidul_is_open_residu_de_la_fermeture_ratee.sql
-- Appliquee sur la base de production le 2026-09-20 via le connecteur MCP.
--
-- LE RESIDU. Ce matin le patron a voulu fermer depuis son espace. Le geste a ecrit
-- `is_open = false` et n'a rien change pour le client, puisque `ouvert_maintenant()` ignore
-- cette colonne tant que `auto_open` est vrai — c'est precisement le defaut repare par
-- `20260920100000_fermer_est_un_seul_geste.sql`. Sa semaine a ete rendue par
-- `20260920150500_chez_bidul_retrouve_sa_semaine.sql`, mais `is_open` etait reste a `false`.
--
-- POURQUOI IL FAUT LE SOLDER. Aujourd'hui la valeur est inerte. Elle cesse de l'etre des que
-- quelqu'un appelle `admin_set_restaurant_auto_open(id, false)` : cette fonction n'ecrit
-- volontairement PAS `is_open`, donc la valeur perimee reprend la main et referme le
-- restaurant sans que personne l'ait demande. C'est un piege arme, pas une coquille.
--
-- LA VALEUR RETENUE EST `true`, ET C'EST UN CHOIX. Des deux pannes silencieuses possibles le
-- jour ou l'automatique sera coupe — un restaurant ferme qui devrait servir, ou ouvert qui ne
-- le devrait pas — la premiere est la mauvaise ici : Chez Bidul & Truc sert bien tous les
-- jours, midi et soir. `is_open = true` dit la verite de l'exploitation ; `false` disait
-- l'accident de ce matin.
--
-- `auto_open` N'EST PAS TOUCHE et reste a `true` : ce sont les horaires qui commandent.
--
-- ⚠️ POURQUOI PAS LA RPC PREVUE POUR CA. `admin_set_restaurant_open` mettrait `auto_open` a
-- `false` — l'inverse du but. `admin_set_restaurant_auto_open` n'ecrit pas `is_open`. Et les
-- deux exigent `is_admin()` : depuis le connecteur, `auth.uid()` est nul, elles refuseraient,
-- et ecriraient un `admin_id` vide dans `admin_actions`. Il n'y a donc PAS de ligne d'audit
-- pour ce changement : cette migration en tient lieu.

update public.restaurants
   set is_open = true
 where id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
   and auto_open = true
   and is_open = false;
