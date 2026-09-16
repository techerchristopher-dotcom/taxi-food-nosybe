-- La commission ne regarde personne.
--
-- LE FAIT, relevé sur la base de production sous le rôle `anon` — c'est-à-dire
-- avec la seule clé publiable, celle qui est dans le bundle de l'application ET
-- en clair dans le JavaScript de la vitrine :
--
--   select count(*), count(commission_rate), count(telegram_chat_id)
--     from public.restaurants;
--   -> 5 restaurants lus, 5 taux de commission lisibles, 2 identifiants Telegram.
--
-- N'importe qui peut donc lire le taux négocié avec chaque restaurant — le seul
-- chiffre qu'un partenaire n'a aucune envie de voir comparé à celui du voisin,
-- et qui se renégocie mal une fois connu — ainsi que l'identifiant du canal
-- Telegram par lequel passent ses commandes.
--
-- POURQUOI c'était ouvert. La table porte UNE seule policy,
-- `restaurants_select_public` (`for select to public using (true)`), et les rôles
-- `anon` et `authenticated` gardent le GRANT SELECT de table posé à la création.
-- La RLS filtre des LIGNES ; elle n'a jamais su filtrer des COLONNES. Le seul
-- mécanisme qui sache le faire en Postgres, ce sont les privilèges de colonne.
-- C'est donc là que la correction doit se poser, pas dans une policy.
--
-- ⚠️ On ferme pour `anon` ET pour `authenticated`. Fermer `anon` seul serait de
-- la décoration : l'inscription est ouverte à tout le monde (OTP par téléphone),
-- et la fuite serait à une inscription de distance. `service_role` et `postgres`
-- gardent tout : les fonctions Edge et les RPC SECURITY DEFINER ne changent pas.


-- =====================================================================
-- 1. Les deux voies possibles, et pourquoi c'est celle-ci
-- =====================================================================
-- Voie A (retenue) — retirer le privilège au niveau colonne.
--   Zéro appel du dépôt à réécrire côté public. Inventaire complet des lecteurs
--   de `restaurants`, fait avant d'écrire une ligne ; TOUS listent leurs colonnes,
--   aucun `select *` / `select=*` / `.select()` vide nulle part :
--     * app/data/api.ts:261, :295, :1269  (liste + fiche restaurant, 16 colonnes nommées)
--     * app/data/api.ts:320               (delivery_fee seul)
--     * app/data/api.ts:593               (jointure `restaurants ( name, logo_url, phone )`)
--     * app/lib/auth.ts:358               (jointure `restaurants ( name )`)
--     * landing/js/partenaires.js:244     (select=id,name,cuisine_type,zone_served,logo_url,delivery_fee,listing_status)
--     * landing/netlify/functions/partage.mjs:320, :347, :364   (clé anon, colonnes nommées)
--     * supabase/functions/apercu-plats-du-jour/index.ts:95     (clé anon, select=name)
--     * supabase/functions/notify-order/index.ts:167            (clé service_role)
--     * admin/components/Realtime.tsx:118, Requests.tsx:21,
--       CodesOfferts.tsx:164, Remboursements.tsx:134            (id, name, phone, is_open…)
--   Aucun de ces appels ne demande les deux colonnes fermées ici. Un privilège
--   retiré au niveau colonne ne fait échouer qu'un `select *` ou un select qui
--   nomme la colonne interdite : il n'y en a aucun dans ce périmètre.
--   Vérifié aussi en base : aucune fonction SECURITY INVOKER ne lit `restaurants`
--   (donc aucun `returning *` exécuté sous l'identité de l'appelant), et
--   `restaurants` n'est PAS dans la publication `supabase_realtime` (aucun
--   payload temps réel ne transporte ces colonnes).
--
-- Voie B (écartée) — une vue publique `restaurants_public`.
--   Elle casserait au minimum onze appels, dont six jointures imbriquées
--   PostgREST (`restaurants ( name… )` dans app/data/api.ts:593, app/lib/auth.ts:358,
--   admin/components/Realtime.tsx:118, Remboursements.tsx:134,
--   supabase/functions/notify-order/index.ts:167 et
--   landing/netlify/functions/partage.mjs:347) : une jointure imbriquée se nomme
--   d'après la RELATION cible, il faudrait donc renommer `restaurants` en
--   `restaurants_public` dans chacune, plus les quatre `from('restaurants')` de
--   l'application et le `select=` de la vitrine. Onze fichiers de plus à déployer
--   pour un résultat identique : le prix ne se justifie pas.
--
-- Le seul appel que la voie A casse est celui qui demande justement la
-- commission, et il est légitime : c'est l'admin. Il reçoit ci-dessous sa propre
-- porte (§3).


-- =====================================================================
-- 2. Fermer les deux colonnes
-- =====================================================================
-- ⚠️ Piège Postgres, la raison de ces deux étapes : un REVOKE de colonne seul ne
-- fait RIEN tant que le rôle garde le privilège de TABLE — le privilège de table
-- couvre toutes les colonnes et ne se laisse pas rogner. La seule manœuvre qui
-- marche est celle-ci : retirer le privilège de table, puis le re-donner colonne
-- par colonne. (Un REVOKE de table emporte au passage les éventuels privilèges de
-- colonne déjà posés : ce fichier est donc rejouable tel quel.)
revoke select on table public.restaurants from anon, authenticated;

-- Les 16 colonnes publiques — les 18 de la table moins `commission_rate` et
-- `telegram_chat_id`. Elles sont énumérées, et non déduites : c'est le point du
-- fichier. Une colonne oubliée ici devient illisible, jamais lisible par erreur.
--
-- ⚠️ CONSÉQUENCE À CONNAÎTRE : toute colonne AJOUTÉE plus tard à `restaurants`
-- naîtra invisible pour `anon` et `authenticated`. C'est le bon défaut — une
-- colonne se publie sciemment — mais la migration qui l'ajoutera devra poser son
-- `grant select (nouvelle_colonne) ... to anon, authenticated;` sinon l'écran qui
-- la lit répondra 42501 « permission denied for table restaurants ».
grant select (
  id,
  name,
  cuisine_type,
  logo_url,
  cover_url,
  is_open,
  opens_at,
  closes_at,
  delivery_fee,
  min_order,
  zone_served,
  created_at,
  food_types,
  auto_open,
  phone,
  listing_status
) on table public.restaurants to anon, authenticated;

comment on column public.restaurants.commission_rate is
  'Taux négocié avec le restaurant. NON PUBLIC : ni anon ni authenticated n''ont le select dessus. Lecture admin par admin_lister_restaurants(), écriture par set_commission_rate() / admin_update_restaurant().';
comment on column public.restaurants.telegram_chat_id is
  'Canal Telegram du restaurant. NON PUBLIC : ni anon ni authenticated n''ont le select dessus. Écriture par set_restaurant_telegram(), lecture par les triggers SECURITY DEFINER et les fonctions Edge en service_role.';


-- =====================================================================
-- 3. Rendre la commission à ceux qui ont le droit de la voir : l'admin
-- =====================================================================
-- Le tableau de bord admin tourne dans un navigateur avec la clé publiable et une
-- session : son rôle Postgres est `authenticated`, exactement comme un client de
-- l'application. Aucun GRANT ne sait distinguer les deux — seul un SECURITY
-- DEFINER derrière `is_admin()` le peut. Même forme que
-- `admin_lister_codes_offerts()`, déjà en place : plpgsql, STABLE, search_path
-- figé, `is_admin()` en première ligne du corps.
--
-- Les colonnes rendues sont exactement celles que les deux écrans admin lisent
-- aujourd'hui, pas une de plus (`telegram_chat_id` n'est lu par aucun écran : il
-- reste dans la base). Ordre par nom, comme le tableau des restaurants.
create or replace function public.admin_lister_restaurants()
returns table (
  id uuid,
  name text,
  cuisine_type text,
  delivery_fee integer,
  min_order integer,
  commission_rate numeric,
  zone_served text,
  is_open boolean,
  food_types text[],
  opens_at time without time zone,
  closes_at time without time zone
)
language plpgsql
stable
security definer
set search_path = public
as $function$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs';
  end if;

  return query
  select r.id,
         r.name,
         r.cuisine_type,
         r.delivery_fee,
         r.min_order,
         r.commission_rate,
         r.zone_served,
         r.is_open,
         r.food_types,
         r.opens_at,
         r.closes_at
    from public.restaurants r
   order by r.name;
end;
$function$;

-- `anon` n'a rien à faire ici : personne ne consulte des taux de commission sans
-- être connecté. Le `revoke from public` retire le droit d'exécution implicite
-- que Postgres donne à tout le monde sur une fonction neuve.
revoke all on function public.admin_lister_restaurants() from public, anon;
grant execute on function public.admin_lister_restaurants() to authenticated;

comment on function public.admin_lister_restaurants() is
  'Liste des restaurants AVEC leur taux de commission, réservée aux administrateurs. Remplace le select direct sur public.restaurants, devenu impossible depuis que commission_rate est fermée à authenticated.';


-- =====================================================================
-- 4. Recette (à rejouer après application)
-- =====================================================================
-- a) La fuite est fermée — les deux doivent répondre `false` :
--      select has_column_privilege('anon',          'public.restaurants', 'commission_rate',  'select'),
--             has_column_privilege('anon',          'public.restaurants', 'telegram_chat_id', 'select'),
--             has_column_privilege('authenticated', 'public.restaurants', 'commission_rate',  'select'),
--             has_column_privilege('authenticated', 'public.restaurants', 'telegram_chat_id', 'select');
--
-- b) Le catalogue public marche toujours — doit renvoyer les 5 restaurants :
--      set local role anon;
--      select id, name, cuisine_type, logo_url, cover_url, is_open, listing_status, phone,
--             auto_open, delivery_fee, min_order, zone_served, food_types
--        from public.restaurants where listing_status <> 'hidden' order by created_at;
--
-- c) Depuis un vrai navigateur : la liste des restaurants et une fiche produit
--    dans l'application, la page « restaurants partenaires » de la vitrine, et un
--    lien de partage /s/... (netlify/functions/partage.mjs) — ce sont les trois
--    lecteurs publics.
--
-- d) Le tableau de bord admin : onglets « Restaurants & menus » et
--    « Rapport de clôture », APRÈS le passage des deux appels signalés au pilote
--    (admin/components/Restaurants.tsx:44 et admin/components/Report.tsx:86) sur
--    admin_lister_restaurants(). Tant qu'ils ne sont pas passés, ces deux écrans
--    répondent « permission denied for table restaurants ».
