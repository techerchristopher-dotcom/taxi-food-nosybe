-- Chez M&K : ses boissons rangées en « Softs » et « Bières » (2026-09-21).
--
-- POURQUOI. `categories.est_boisson` n'est pas saisi : le trigger `categories_poser_est_boisson`
-- le déduit du NOM, et ne reconnaît que « Bières » et « Softs » — la convention de tout le
-- catalogue. Une catégorie « Boissons » était donc comptée comme de la NOURRITURE, et un code
-- « repas offert » (qui exclut les boissons) aurait payé le Coca du client sur le dos du
-- restaurant. Plutôt que d'élargir la règle pour un seul restaurant, on suit la convention.
update public.categories
   set name = 'Softs', icon = '🥤'
 where restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and name = 'Boissons';

insert into public.categories (restaurant_id, name, icon, sort_order, est_boisson, is_active)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', 'Bières', '🍺', 90, true, true
where not exists (select 1 from public.categories c
                  where c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = 'Bières');

update public.products p
   set category_id = c.id, sort_order = 10
  from public.categories c
 where c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = 'Bières'
   and p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and p.name = 'Bière en canette'
   and p.category_id is distinct from c.id;
