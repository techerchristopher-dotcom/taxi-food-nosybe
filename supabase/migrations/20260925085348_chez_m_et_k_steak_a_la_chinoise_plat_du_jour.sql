-- Chez M&K : premier plat du jour à l'affiche — steak à la chinoise, sauce
-- tomate douce (demande du porteur du projet, 2026-09-25).
--
-- Création « À l'affiche » : pas de catégorie, hors carte permanente. Elle
-- n'apparaît donc que dans le bandeau « Offre du jour » de sa fiche, sans plage
-- horaire, commandable dès qu'il est ouvert. Même forme que les plats du jour de
-- Chez Bidul & Truc (20260915082305).
--
-- Prix 30 000 Ar, validé par le porteur du projet : celui de son Ti pan de steak
-- de zébu, même viande et même format assiette.
--
-- ACCOMPAGNEMENT : « Riz | Frites », et c'est un ÉCART ASSUMÉ. Ses vingt-deux
-- autres groupes disent tous « Riz | Pâtes » ; les frites n'existaient nulle part
-- chez lui. Le porteur du projet a tranché pour ce plat-là. On garde en revanche
-- son libellé maison exact, « Accompagnement (inclus) », et son sort_order 10,
-- pour que la fiche se lise comme les autres.
--
-- VISUEL : reconstitution, déposée par `deposer-visuel` en
-- produits/chez-m-et-k/29-steak-a-la-chinoise.png. ⚠️ C'est la SEULE image
-- fabriquée de sa fiche : ses vingt-huit autres photos sont réelles. À remplacer
-- par une vraie photo dès qu'il en fournit une. Le signe qui l'empêche de se
-- confondre avec son Ti pan de steak de zébu, au même prix : assiette large et
-- non plaque en fonte, steak tranché en éventail, sauce tomate rouge avec
-- lanières de poivron et pétales d'oignon.
--
-- Idempotent : rejouer ne crée ni doublon de plat ni doublon de groupe.
do $$
declare
  v_resto uuid;
  v_nom   text := 'Steak à la chinoise';
  v_plat  uuid;
  v_grp   uuid;
  n int;
begin
  select id into v_resto from public.restaurants where name ilike 'Chez M%K';
  if v_resto is null then raise exception 'restaurant introuvable'; end if;

  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
  select v_resto, null, v_nom,
         'Steak de bœuf tranché, sauce tomate douce, poivrons et oignons.', 30000,
         'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/'
         || 'chez-m-et-k/29-steak-a-la-chinoise.png',
         true, null, true, 'Plat du jour', false, 1
  where not exists (
    select 1 from public.products p
     where p.restaurant_id = v_resto and lower(p.name) = lower(v_nom) and not p.is_archived);

  select id into v_plat from public.products
   where restaurant_id = v_resto and lower(name) = lower(v_nom) and not is_archived;
  if v_plat is null then raise exception 'le plat n''a pas ete cree'; end if;

  if not exists (select 1 from public.product_option_groups
                  where product_id = v_plat and name = 'Accompagnement (inclus)') then
    insert into public.product_option_groups
      (product_id, name, min_select, max_select, required, sort_order)
    values (v_plat, 'Accompagnement (inclus)', 1, 1, true, 10)
    returning id into v_grp;

    insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
    values (v_grp, 'Riz', 0, true, 10), (v_grp, 'Frites', 0, true, 20);
    get diagnostics n = row_count;
    if n <> 2 then raise exception 'attendu 2 accompagnements, obtenu %', n; end if;
  end if;
end $$;
