-- 20260920150500_chez_bidul_retrouve_sa_semaine.sql
-- Appliquee sur la base de production le 2026-09-20 via le connecteur MCP.
--
-- CE QUI S'EST PASSE. Le 2026-09-20 au matin, six jours sur sept etaient passes a
-- `is_closed = true` avec des horaires nuls ; seul le samedi gardait 11 h 30 – 15 h et
-- 18 h – 22 h. Le restaurant etait donc ferme aux clients six jours sur sept, et ses deux
-- nouveaux plats du jour en ligne pour personne.
--
-- POURQUOI, TRES PROBABLEMENT. La migration du meme matin,
-- `20260920100000_fermer_est_un_seul_geste.sql`, documente le defaut : le patron a voulu
-- fermer son restaurant depuis son espace et il est RESTE OUVERT pour ses clients, parce que
-- `ouvert_maintenant()` ignore `is_open` tant que `auto_open` est vrai. La suite plausible :
-- faute de bouton qui marche, il a vide sa semaine a la main. Le bouton est repare depuis,
-- mais la semaine, elle, etait restee vide.
--
-- CE QU'ON RESTAURE, ET D'OU CA VIENT. Les horaires ci-dessous ne sont pas inventes : ils ont
-- ete lus dans cette meme table le 2026-09-17, ou les QUATORZE lignes portaient les memes
-- valeurs — 11 h 30 – 15 h le midi, 18 h – 22 h le soir, aucun jour ferme. Le samedi survivant
-- porte exactement ces horaires, ce qui corrobore la lecture.
--
-- ⚠️ `is_open` reste a `false` et n'est PAS touche ici. Tant que `auto_open` est vrai il
-- n'a aucun effet sur ce que voit le client. Mais si quelqu'un coupe l'ouverture automatique
-- plus tard, cette valeur reprend la main et refermera le restaurant : c'est un residu de la
-- tentative de fermeture de ce matin, a nettoyer par le geste prevu pour ca
-- (`admin_set_restaurant_auto_open` puis `set_restaurant_open`), pas par un update ici.
--
-- ⚠️ A FAIRE CONFIRMER AU RESTAURATEUR. Si sa fermeture etait voulue — conges, travaux —
-- rouvrir est pire que fermer : il recevrait des commandes qu'il ne peut pas honorer. La
-- lecture des faits dit l'inverse, mais un appel le tranche en trente secondes.

insert into restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
select '700e8f32-e966-476a-b371-02884d08dea1'::uuid, j.weekday, s.service,
       case when s.service = 1 then time '11:30' else time '18:00' end,
       case when s.service = 1 then time '15:00' else time '22:00' end,
       false
  from (values (0),(1),(2),(3),(4),(5),(6)) as j(weekday),
       (values (1),(2))                     as s(service)
on conflict (restaurant_id, weekday, service)
do update set opens_at  = excluded.opens_at,
              closes_at = excluded.closes_at,
              is_closed = excluded.is_closed;
