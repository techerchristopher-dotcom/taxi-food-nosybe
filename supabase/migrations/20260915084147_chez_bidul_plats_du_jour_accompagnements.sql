-- Accompagnements des trois plats du jour de Chez Bidul & Truc (2026-09-15).
--
-- Alignés sur ses plats de la carte (Cuisse de poulet, Filet de zébu, Marmite du pêcheur…),
-- qui portent tous les deux mêmes groupes :
--   * « Accompagnement (1 au choix, inclus) » — obligatoire, 1 choix, sans supplément ;
--   * « 2e accompagnement (+5 000 Ar) » — facultatif, 1 choix, +5 000 Ar.
-- Options : Frites, Légumes sautés, Pâtes, Riz, Purée, avec leurs photos existantes
-- (produits/chez-bidul-truc/accompagnement-*.png).
--
-- Copiés depuis « Cuisse de poulet » plutôt que réécrits : mêmes libellés, prix et photos, sans
-- risque de divergence. Ordre explicite (le modèle a tous ses sort_order à 0).
-- Idempotent : un groupe déjà présent sur un plat n'est pas recréé.
with source as (
  select id from public.products
  where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1' and name = 'Cuisse de poulet' and not is_archived
  limit 1
), cibles as (
  select id from public.products
  where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
    and name in ('Poulet basquaise', 'Blanquette de poisson', 'Tartare de zébu')
    and is_featured and not is_archived
), groupes_source as (
  select g.* from public.product_option_groups g
  where g.product_id = (select id from source)
    and g.name in ('Accompagnement (1 au choix, inclus)', '2e accompagnement (+5 000 Ar)')
), nouveaux as (
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
  select c.id, gs.name, gs.min_select, gs.max_select, gs.required, gs.sort_order
  from cibles c cross join groupes_source gs
  where not exists (select 1 from public.product_option_groups x where x.product_id = c.id and x.name = gs.name)
  returning id, name
)
insert into public.product_options (group_id, name, price_delta, is_available, sort_order, photo_url)
select n.id, o.name, o.price_delta, o.is_available,
       case o.name when 'Frites' then 10 when 'Légumes sautés' then 20 when 'Pâtes' then 30
                   when 'Riz' then 40 when 'Purée' then 50 else 90 end,
       o.photo_url
from nouveaux n
join groupes_source gs on gs.name = n.name
join public.product_options o on o.group_id = gs.id;
