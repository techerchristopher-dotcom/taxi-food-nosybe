-- Chez Bidul & Truc : deuxième plat du jour à l'affiche, à côté de la Paella
-- (demande du porteur du projet, 2026-09-25).
--
-- Création « À l'affiche » : pas de catégorie, hors carte permanente. Elle
-- n'apparaît donc que dans le bandeau « Offre du jour », sans plage horaire,
-- commandable midi et soir tant que le restaurant est ouvert. Même forme que
-- 20260915082305 et 20260920145419.
--
-- Prix 30 000 Ar : celui des neuf autres plats du jour, validé par le porteur du
-- projet. Il se tient entre son Cordon bleu (29 000) et son Émincé de poulet
-- sauce estragon (32 000), les deux plats les plus proches de sa carte.
--
-- Visuel : reconstitution dans la série de ses plats du jour (ardoise, fond
-- quasi noir, lueur radiale), déposée par la fonction `deposer-visuel` —
-- même exception assumée que les précédents (docs/PARTENAIRES.md). Le signe
-- qui l'empêche de se confondre avec le Cordon bleu déjà à sa carte : une
-- escalope entière, plate, sans farce ni fromage, la panure sèche et lisible
-- sur les deux tiers, la sauce et ses lamelles de champignon sur un seul tiers.
--
-- Accompagnement : le groupe habituel des plats du jour, COPIÉ depuis « Poulet
-- basquaise » plutôt que réécrit — mêmes libellés, mêmes prix, mêmes photos,
-- aucun risque de divergence. Pas de « 2e accompagnement » : il a été retiré des
-- plats du jour le 2026-09-20 et il ne revient pas.
--
-- Idempotent : rejouer ne crée ni doublon de plat ni doublon de groupe.
do $$
declare
  v_resto uuid := '700e8f32-e966-476a-b371-02884d08dea1';
  v_nom   text := 'Escalope de poulet milanaise sauce champignon';
  v_plat  uuid;
  v_src   uuid;
  v_grp   uuid;
  n int;
begin
  -- 1. le plat
  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order)
  select v_resto, null, v_nom, null, 30000,
         'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/'
         || 'chez-bidul-truc/plat-escalope-de-poulet-milanaise-sauce-champignon.png',
         true, null, true, 'Plat du jour', false, 11
  where not exists (
    select 1 from public.products p
     where p.restaurant_id = v_resto and lower(p.name) = lower(v_nom) and not p.is_archived);

  select id into v_plat from public.products
   where restaurant_id = v_resto and lower(name) = lower(v_nom) and not is_archived;
  if v_plat is null then
    raise exception 'le plat n''a pas ete cree';
  end if;

  -- 2. le groupe d'accompagnement, copie conforme de celui du Poulet basquaise
  select g.id into v_src
    from public.product_option_groups g
    join public.products p on p.id = g.product_id
   where p.restaurant_id = v_resto and p.name = 'Poulet basquaise' and not p.is_archived
     and g.name = 'Accompagnement (1 au choix, inclus)';
  if v_src is null then
    raise exception 'groupe source introuvable sur Poulet basquaise';
  end if;

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
    if n <> 6 then
      raise exception 'attendu 6 accompagnements copies, obtenu %', n;
    end if;
  end if;
end $$;
