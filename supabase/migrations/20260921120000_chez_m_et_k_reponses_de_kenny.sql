-- Chez M&K : les réponses de Kenny du 2026-09-21 (15 h 08), versées à la carte.
--
-- POURQUOI « AVEC / SANS PORC » EST UNE OPTION ET PAS UN BADGE. Kenny : « les riz cantonais, les
-- soupes ou les mi sao peuvent être avec porc et aussi sans porc, ça ne dépend que du client ».
-- Le badge `diet_tags` vit sur le PRODUIT : le poser aurait fait croire au client que ces plats
-- contiennent forcément du porc, ne pas le poser l'aurait laissé sans avertissement. Un choix
-- OBLIGATOIRE « Avec porc / Sans porc » règle les deux : personne ne commande sans avoir répondu,
-- et la réponse part au restaurant avec la commande.
--
-- POURQUOI RIZ / PÂTES SUR 12 PLATS SEULEMENT. « Tous les plats sont accompagnés de riz soit de
-- pâtes. » Décision du porteur du projet : les plats principaux (ti pan, wok & sautés, viandes).
-- Pas les entrées, pas les soupes, pas les riz/nouilles/bols, qui en sont déjà.
--
-- POURQUOI LA FONDUE RESTE INDISPONIBLE. « 24 heures avant, minimum 2 personnes. » L'app ne sait
-- pas prendre une commande pour le lendemain : la fiche le dit, la commande passe par WhatsApp.
--
-- POURQUOI « BIÈRE EN CANETTE » SANS MARQUE. « Les beaucoup en canette 10 000 ar » a été lu
-- « les bières » par le porteur du projet. Les marques restent à demander à Kenny.
-- Pas de dessert : « nous ne faisons pas les desserts pour le moment ».
--
-- Le ti pan mixte est « poulet et bœuf, sans porc » : il reste sans badge, cette fois en connaissance
-- de cause.
--
-- Idempotent : chaque insertion vérifie l'absence de ce qu'elle crée.

-- 1. Descriptions — uniquement ce que Kenny a dit, mot pour mot ou presque.
update public.products p
   set description = v.descr
  from (values
    ('Ti pan mixte', 'Poulet et bœuf, sans porc.'),
    ('Soupe spéciale MK', '10 van tan, 10 demi-lunes, environ 400 g de pâtes, garniture tsa siou et un œuf au plat ou en omelette.'),
    ('Fondue chinoise terre et mer', 'À commander 24 h à l''avance, 2 personnes minimum. Prix par personne.')
  ) as v(nom, descr)
 where p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
   and p.name = v.nom and not p.is_archived and p.description is null;

-- 2. Les boissons.
insert into public.categories (restaurant_id, name, icon, sort_order, est_boisson, is_active)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', 'Boissons', '🥤', 80, true, true
where not exists (select 1 from public.categories c
                  where c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = 'Boissons');

insert into public.products
  (restaurant_id, category_id, name, description, price, diet_tags, photo_url, is_available,
   sort_order, in_menu, is_featured, is_archived)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', c.id, v.name, null, v.price, '{}'::text[], null, true, v.ord,
       true, false, false
from (values ('Coca-Cola petit modèle', 8000, 10),
             ('Sprite petit modèle', 8000, 20),
             ('Bière en canette', 10000, 30)) as v(name, price, ord)
join public.categories c on c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = 'Boissons'
where not exists (select 1 from public.products p
                  where p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
                    and lower(p.name) = lower(v.name) and not p.is_archived);

-- 3. Les groupes d'options.
insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select p.id, v.grp, 1, 1, true, v.ord
from (
  select name as plat, 'Avec ou sans porc' as grp, 20 as ord from public.products
   where restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
     and name in ('Soupe spéciale MK', 'Soupe garnie', 'Riz cantonais', 'Mi sao')
  union all
  select 'Soupe spéciale MK', 'Œuf', 30
  union all
  select p.name, 'Accompagnement (inclus)', 10
    from public.products p join public.categories c on c.id = p.category_id
   where p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
     and c.name in ('Ti pan — à la plancha', 'Wok & sautés', 'Viandes')
) as v
join public.products p on p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and p.name = v.plat and not p.is_archived
where not exists (select 1 from public.product_option_groups g where g.product_id = p.id and g.name = v.grp);

insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, v.opt, 0, true, v.ord
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
join (values ('Avec ou sans porc', 'Avec porc', 10), ('Avec ou sans porc', 'Sans porc', 20),
             ('Œuf', 'Au plat', 10), ('Œuf', 'En omelette', 20),
             ('Accompagnement (inclus)', 'Riz', 10), ('Accompagnement (inclus)', 'Pâtes', 20)
     ) as v(grp, opt, ord) on v.grp = g.name
where not exists (select 1 from public.product_options o where o.group_id = g.id and o.name = v.opt);
