-- Chez Bidul & Truc : hachis parmentier à l'affiche (demande du porteur du
-- projet, 2026-09-26). Prix 30 000 Ar, « le même prix que d'habitude pour les
-- plats du jour » — c'est celui des neuf précédents, seul le camaron s'en écarte.
--
-- Création « À l'affiche » : pas de catégorie, hors carte permanente, donc
-- visible seulement dans le bandeau « Offre du jour », sans plage horaire.
--
-- LE PIÈGE DE CE PLAT-LÀ. Il a un jumeau visuel dans sa propre bibliothèque :
-- « Boudin noir façon hachis ». Même purée gratinée, même peigne de fourchette.
-- Le visuel les sépare par trois signes mesurés : la couche de viande est un
-- BRUN mesuré à (109, 70, 34) là où celle du boudin est quasi noire ; le plat est
-- servi en cocotte ovale en fonte, pas dressé en carré sur ardoise ronde ; et il
-- n'y a ni pomme caramélisée ni oignon confit, qui sont la garniture signature du
-- boudin. Sans ces trois-là, deux lignes de la carte montrent la même photo.
--
-- Accompagnement : le groupe habituel, COPIÉ depuis « Poulet basquaise » —
-- mêmes libellés, mêmes prix, mêmes photos. Pas de « 2e accompagnement », retiré
-- des plats du jour le 2026-09-20.
--
-- Visuel : reconstitution déposée par `deposer-visuel`, contrôlée au quadrant en
-- résolution native (aucun défaut relevé).
--
-- Idempotent : rejouer ne crée ni doublon de plat ni doublon de groupe.
do $$
declare
  v_resto uuid := '700e8f32-e966-476a-b371-02884d08dea1';
  v_nom   text := 'Hachis parmentier';
  v_plat  uuid; v_src uuid; v_grp uuid; n int;
begin
  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
  select v_resto, null, v_nom, null, 30000,
         'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/'
         || 'chez-bidul-truc/plat-hachis-parmentier.png',
         true, null, true, 'Plat du jour', false, 12
  where not exists (
    select 1 from public.products p
     where p.restaurant_id = v_resto and lower(p.name) = lower(v_nom) and not p.is_archived);

  select id into v_plat from public.products
   where restaurant_id = v_resto and lower(name) = lower(v_nom) and not is_archived;
  if v_plat is null then raise exception 'le plat n''a pas ete cree'; end if;

  select g.id into v_src
    from public.product_option_groups g
    join public.products p on p.id = g.product_id
   where p.restaurant_id = v_resto and p.name = 'Poulet basquaise' and not p.is_archived
     and g.name = 'Accompagnement (1 au choix, inclus)';
  if v_src is null then raise exception 'groupe source introuvable sur Poulet basquaise'; end if;

  if not exists (select 1 from public.product_option_groups
                  where product_id = v_plat and name = 'Accompagnement (1 au choix, inclus)') then
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    select v_plat, g.name, g.min_select, g.max_select, g.required, g.sort_order
      from public.product_option_groups g where g.id = v_src
    returning id into v_grp;

    insert into public.product_options (group_id, name, price_delta, is_available, sort_order, photo_url)
    select v_grp, o.name, o.price_delta, o.is_available, o.sort_order, o.photo_url
      from public.product_options o where o.group_id = v_src;
    get diagnostics n = row_count;
    if n <> 6 then raise exception 'attendu 6 accompagnements copies, obtenu %', n; end if;
  end if;
end $$;
