-- La Cabane : les trois EXTRAS de sa carte papier deviennent commandables seuls
-- (demande du porteur du projet, 2026-09-27, après lecture de la carte `carte1`).
--
-- POURQUOI. « Assiette de frites », « Nuggets × 5 » et « Tenders × 4 » ont un
-- bloc à eux sur sa carte imprimée, avec leur prix. Dans l'application ils
-- n'existaient que comme OPTIONS de supplément accrochées à un plat : impossible
-- de commander une portion de frites seule. Trois lignes de carte perdues.
--
-- NOUVELLE CATÉGORIE « Extras », rang 15 — entre Sandwichs & Repas (10) et
-- Burgers (20), comme sur sa carte où le bloc EXTRAS est en regard des plats.
-- `est_boisson = false` : un code « repas offert » les couvre comme un plat.
--
-- PRIX repris de la carte papier au chiffre près : 5 000 / 15 000 / 20 000.
--
-- PHOTOS : on réutilise PAR RÉFÉRENCE les visuels d'options déjà en ligne
-- (`produits/supplements/frites.png`, `produits/viandes/nugget.png`,
-- `produits/viandes/tenders.png`). Ce sont de vraies images du bon aliment,
-- déjà au format 1024×1024 de la maison. Rien n'est dupliqué dans le bucket.
--
-- AUCUN GROUPE D'OPTIONS. Une assiette de frites n'a rien à choisir. La sauce
-- n'est pas incluse sur sa carte pour ces trois lignes ; ne pas inventer.
--
-- Idempotent : rejouer ne recrée ni la catégorie ni les produits.
do $$
declare
  v_resto uuid;
  v_cat   uuid;
  n int;
begin
  select id into v_resto from public.restaurants where name = 'La Cabane';
  if v_resto is null then raise exception 'restaurant introuvable'; end if;

  insert into public.categories (restaurant_id, name, icon, sort_order, is_active, est_boisson)
  select v_resto, 'Extras', '🍟', 15, true, false
  where not exists (select 1 from public.categories
                     where restaurant_id = v_resto and name = 'Extras');

  select id into v_cat from public.categories
   where restaurant_id = v_resto and name = 'Extras';
  if v_cat is null then raise exception 'categorie Extras non creee'; end if;

  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url,
     is_available, stock_quantity, is_featured, in_menu, sort_order)
  select v_resto, v_cat, v.nom, null, v.prix, v.photo, true, null, false, true, v.ord
  from (values
    ('Assiette de frites', 5000,  'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/supplements/frites.png', 10),
    ('Nuggets × 5',       15000,  'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/viandes/nugget.png',      20),
    ('Tenders × 4',       20000,  'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/viandes/tenders.png',     30)
  ) as v(nom, prix, photo, ord)
  where not exists (
    select 1 from public.products p
     where p.restaurant_id = v_resto and lower(p.name) = lower(v.nom) and not p.is_archived);
  get diagnostics n = row_count;
  if n not in (0, 3) then
    raise exception 'attendu 0 ou 3 extras crees, obtenu %', n;
  end if;
end $$;
