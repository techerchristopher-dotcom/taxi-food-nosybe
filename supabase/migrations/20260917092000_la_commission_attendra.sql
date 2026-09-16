-- La commission attendra : annulation de la fermeture par privilèges de colonne.
--
-- ⚠️ CE FICHIER EXISTE PARCE QUE LA MIGRATION PRÉCÉDENTE A CASSÉ LA PRODUCTION.
-- Il est gardé, avec son voisin, plutôt que tous deux effacés : la prochaine
-- personne qui voudra fermer ces colonnes doit trouver la tentative ET la raison
-- de son échec, sinon elle la refera.
--
-- CE QUI S'EST PASSÉ, le 2026-09-17. La migration
-- `20260917091000_la_commission_ne_regarde_personne.sql` retire le SELECT de
-- table à `anon` et `authenticated`, puis le rend colonne par colonne sur les 16
-- colonnes publiques — la manœuvre classique pour cacher deux colonnes. Elle a
-- été validée en transaction annulée, et tous les contrôles passaient :
--
--   set local role anon;
--   select id, name, delivery_fee ... from public.restaurants;   -- OK
--   select commission_rate from public.restaurants;              -- 42501, voulu
--
-- Et pourtant, une fois appliquée, l'accueil de l'application répondait 401 :
--
--   GET /rest/v1/restaurants?select=id,name,...,ouvert_maintenant,...
--   -> 42501 permission denied for table restaurants
--
-- POURQUOI. `ouvert_maintenant` n'est pas une colonne : c'est une COLONNE
-- CALCULÉE PostgREST, c'est-à-dire une fonction qui prend la LIGNE ENTIÈRE en
-- argument — `ouvert_maintenant(restaurants)`. Or Postgres exige le privilège
-- SELECT sur TOUTES les colonnes dès qu'une requête référence la ligne entière.
-- Un seul privilège de colonne manquant, et c'est toute la table qui se ferme.
-- Cette table en porte QUATRE, toutes appelées par l'application :
--   commandable_maintenant(restaurants)   horaires_du_jour(restaurants)
--   ouvert_maintenant(restaurants)        services_du_jour(restaurants)
--
-- ⚠️ LA LEÇON, plus large que ce fichier : sur une table qui porte une colonne
-- calculée, les privilèges de colonne ne marchent PAS. Et le contrôle en SQL
-- direct ne le montre pas — il faut interroger PostgREST, avec la vraie clé
-- publiable et la requête réelle de l'application. Un `set local role anon`
-- suivi d'un `select` à colonnes nommées passe : c'est un faux témoin.
--
-- CE QUI RESTE VRAI : la fuite est réelle. Avec la seule clé publiable,
-- n'importe qui lit `commission_rate` des 5 restaurants et `telegram_chat_id` de
-- 2 d'entre eux. Elle n'est PAS refermée par ce fichier.
--
-- LA VOIE QUI MARCHERA, pour la prochaine fois : sortir les deux colonnes de la
-- table, dans une table privée `restaurant_prive (restaurant_id, commission_rate,
-- telegram_chat_id)` sans aucun grant à anon ni authenticated. `restaurants`
-- garde alors son SELECT de table entier, les quatre colonnes calculées
-- continuent de fonctionner, et rien de public ne change. Le travail est ailleurs :
-- les 9 fonctions SECURITY DEFINER qui lisent ou écrivent ces deux colonnes, la
-- fonction Edge `notify-order` (service_role, `telegram_chat_id`), et les
-- fonctions `returns restaurants` dont la charge utile perdra les deux colonnes.
-- C'est un chantier à part entière, qui touche le circuit des commandes : il se
-- fait à froid, pas en fin de session, et se vérifie sur une vraie commande.

-- Le SELECT de table, tel qu'il était avant la tentative. Un grant de table
-- emporte les privilèges de colonne posés par la migration précédente : il n'y a
-- rien d'autre à défaire.
grant select on table public.restaurants to anon, authenticated;

-- `admin_lister_restaurants()` est CONSERVÉE, et les deux écrans admin
-- (Restaurants.tsx, Report.tsx) continuent de l'appeler. Elle ne sert plus à
-- contourner une fermeture, mais elle est juste : la commission n'a rien à faire
-- dans une requête de table côté navigateur, et le jour où la table privée
-- existera, cette fonction sera déjà en place et n'aura qu'à changer de source.

-- Les deux commentaires de colonne posés par la migration précédente sont
-- corrigés : ils annonçaient une fermeture qui n'a pas tenu. Un commentaire faux
-- est pire que pas de commentaire — c'est lui qu'on croira.
comment on column public.restaurants.commission_rate is
  'Taux négocié avec le restaurant. ⚠️ LISIBLE PAR ANON AUJOURD''HUI (fuite connue, voir 20260917092000) : les privilèges de colonne sont impossibles ici à cause des colonnes calculées. À sortir dans une table privée.';
comment on column public.restaurants.telegram_chat_id is
  'Canal Telegram du restaurant. ⚠️ LISIBLE PAR ANON AUJOURD''HUI (fuite connue, voir 20260917092000). À sortir dans une table privée.';
