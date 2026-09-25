-- Les plats du jour de TOUS les restaurants, en un seul endroit.
--
-- Le constat du porteur du projet (2026-09-25) : les plats du jour sont le contenu
-- le plus attirant du catalogue — ce sont les seuls à porter de VRAIES photos du
-- plat servi — et ils ne se voient qu'en ouvrant chaque restaurant, un par un.
--
-- ⚠️ UNE SEULE SOURCE POUR L'APP ET POUR LA VITRINE. Les deux surfaces ont déjà
-- divergé une fois sur l'ordre du catalogue (la vitrine triait alphabétiquement,
-- l'app par date) ; deux requêtes écrites séparément finissent toujours par ne
-- plus dire la même chose. Tout passe donc par `plats_du_jour_publics()`.
--
-- ⚠️ CE QUI EST RENDU EST DÉJÀ PUBLIC, et rien d'autre. Ni `commission_rate`, ni
-- `telegram_chat_id`, ni `code_marchand` : la fuite connue (voir CLAUDE.md) ne
-- doit pas gagner une porte de plus. La fonction est en SECURITY INVOKER — elle
-- ne donne donc aucun droit que l'appelant n'a pas déjà sur `products` et
-- `restaurants`, elle ne fait que choisir les colonnes et l'ordre.
--
-- ⚠️ AUCUN PRIVILÈGE DE COLONNE N'EST TOUCHÉ ICI. La tentative du 2026-09-16 a
-- cassé l'accueil de l'app (401) parce que `restaurants` porte quatre colonnes
-- calculées qui exigent la ligne entière. On ajoute, on ne retire rien.

-- ── Quand est-ce que ça rouvre ? ────────────────────────────────────────────
-- « Fermé » tout court vide la rubrique de son sens : en milieu d'après-midi,
-- trois restaurants sur quatre sont fermés, et une carte grisée sans horaire ne
-- dit pas s'il faut revenir dans dix minutes ou demain.
--
-- ⚠️ RIEN N'EST RÉINVENTÉ : on lit `restaurant_hours`, la table dont dépendent
-- déjà `ouvert_maintenant`, `services_du_jour` et la garde de `create_order`.
--
-- ⚠️ EN OUVERTURE MANUELLE, ON NE PROMET RIEN. Quand `auto_open` est faux, les
-- horaires ne pilotent plus rien : le restaurateur a fermé à la main et « les
-- horaires ne rouvriront pas tout seuls » (règle du 2026-09-20). Annoncer
-- « Ouvre à 18h » sur la foi d'une ligne d'horaire inerte serait un mensonge.
-- La fonction ne rend alors aucune ligne, et l'écran dit simplement « Fermé ».
create or replace function public.prochaine_ouverture(r restaurants)
returns table (jours smallint, ouvre time)
language sql
stable
as $$
  select d.i::smallint, h.opens_at
  from generate_series(0, 6) as d(i)
  join public.restaurant_hours h
    on h.restaurant_id = r.id
   and h.weekday = ((extract(dow from (now() at time zone 'Indian/Antananarivo'))::int + d.i) % 7)::smallint
   and not h.is_closed
   and h.opens_at is not null
   -- Aujourd'hui, seuls les services ENCORE À VENIR comptent : à 18 h, le
   -- service de midi est derrière nous. Même piège que `services_du_jour`, qui
   -- affichait « Ouvert · 11h30 – 15h » à 18 h.
   and (d.i > 0 or h.opens_at > public.maintenant_nosybe())
  where r.auto_open
  order by d.i, h.opens_at
  limit 1;
$$;

comment on function public.prochaine_ouverture(restaurants) is
  'Prochaine heure d''ouverture d''un restaurant : (jours d''écart, heure). Aucune ligne si le restaurant est en ouverture MANUELLE (ses horaires ne le rouvriront pas tout seuls) ou s''il n''ouvre aucun des sept prochains jours.';

-- ── La rubrique elle-même ───────────────────────────────────────────────────
-- Ce que la liste contient :
--   • les plats À L'AFFICHE (`is_featured`), jamais archivés,
--   • disponibles et non épuisés — un plat qu'on ne peut pas commander n'a rien
--     à faire dans une vitrine (même règle que l'app et que la page /j/),
--   • des seuls restaurants `visible` : un restaurant en négociation ou retiré
--     du catalogue ne s'annonce pas ici.
--
-- L'ordre : les restaurants OUVERTS d'abord (c'est ce qu'on peut commander tout
-- de suite), puis l'ordre du catalogue `rang_catalogue`, puis `sort_order` du
-- plat — celui que le restaurateur a choisi dans son espace. Jamais le prix.
-- `rang` porte cet ordre en clair : un client qui re-trierait la liste sans le
-- savoir (un `map` sur une clé, une jointure) peut le retrouver.
create or replace function public.plats_du_jour_publics()
returns table (
  product_id uuid,
  nom text,
  description text,
  prix integer,
  photo_url text,
  diet_tags text[],
  restaurant_id uuid,
  restaurant_nom text,
  restaurant_zone text,
  restaurant_cuisine text,
  restaurant_logo text,
  frais_livraison integer,
  ouvert boolean,
  ouvre_dans_jours smallint,
  ouvre_a text,
  rang integer
)
language sql
stable
as $$
  with restos as (
    select r.id,
           r.name,
           r.zone_served,
           r.cuisine_type,
           r.logo_url,
           r.delivery_fee,
           r.rang_catalogue,
           public.ouvert_maintenant(r) as ouvert,
           o.jours,
           o.ouvre
    from public.restaurants r
    left join lateral public.prochaine_ouverture(r) o on true
    where r.listing_status = 'visible'
  )
  select p.id,
         p.name,
         p.description,
         p.price,
         p.photo_url,
         coalesce(p.diet_tags, '{}'::text[]),
         x.id,
         x.name,
         x.zone_served,
         x.cuisine_type,
         x.logo_url,
         x.delivery_fee,
         x.ouvert,
         x.jours,
         -- ⚠️ Pas de `to_char()` sur un `time` : Postgres n'a pas cette
         -- surcharge (piège déjà payé sur `service:categorie_hors_service`).
         substring(x.ouvre::text from 1 for 5),
         row_number() over (
           order by (not x.ouvert), x.rang_catalogue, p.sort_order, p.name
         )::integer
  from public.products p
  join restos x on x.id = p.restaurant_id
  where p.is_featured
    and not p.is_archived
    and p.is_available
    -- `stock_quantity` null = pas de compteur de stock, donc jamais épuisé.
    and coalesce(p.stock_quantity, 1) <> 0
  order by (not x.ouvert), x.rang_catalogue, p.sort_order, p.name;
$$;

comment on function public.plats_du_jour_publics() is
  'Les plats à l''affiche de TOUS les restaurants visibles, ouverts d''abord. Source unique de la rubrique « Plats du jour » de l''application et du site. Ne rend que des colonnes déjà publiques.';

-- Lecture publique : la rubrique s'affiche sans compte, comme le catalogue.
grant execute on function public.prochaine_ouverture(restaurants) to anon, authenticated;
grant execute on function public.plats_du_jour_publics() to anon, authenticated;
