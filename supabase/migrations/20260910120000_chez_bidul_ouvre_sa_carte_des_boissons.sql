-- Chez Bidul & Truc ouvre sa carte des boissons.
--
-- ⚠️ Ce n'est PAS une reactivation. Ce restaurant n'a jamais eu de boissons :
-- ses sept categories etaient Entree, Pizza, Plat, Pates, Tapas, Hamburger,
-- Dessert. On CREE donc deux categories et dix produits.
--
-- Prix communiques par le restaurateur le 2026-09-10 (« je vais baisser le prix,
-- il faut que le stock tourne »). « Gold blanche 50 cl 9000 » figurait DEUX FOIS
-- dans sa liste : creee une seule fois.
--
-- Convention reprise de Angelo, La Cabane et Taxi Be :
--   Bieres 🍺 sort_order 30 · Softs 🥤 sort_order 40 · produits par pas de 10.
-- Les energisantes (Fosa, XXL) vont dans Softs, comme XXL et Dynamic chez
-- Taxi Be — il n'existe pas de categorie dediee et en creer une pour deux
-- references fragmenterait la carte.
--
-- ⚠️ AUCUNE PLAGE HORAIRE sur ces categories, et c'est deliberе. Les pizzas de
-- ce restaurant sont limitees a 18 h - 22 h : sa carte etait donc VIDE avant
-- 18 h depuis qu'on a coupe le reste (voir JOURNAL-2026-09-09). Les boissons
-- disponibles aux heures d'ouverture reparent ca.
--
-- ⚠️ PHOTOS — ADR-007 : jamais de visuel approximatif. Six produits reprennent
-- la photo EXACTE deja presente dans le bucket `boissons` (partage avec Angelo
-- et Taxi Be). Les quatre autres restent SANS photo, et l'app affichera leurs
-- initiales, plutot que de montrer un format qui n'est pas celui servi :
--   * Gold Blanche 50 cl — seule la PM est photographiee
--   * Fresh 33 cl, Fosa 50 cl, XXL — aucune photo n'existe
--
-- ⚠️ RIEN A DEPLOYER : `FOOD_TYPE_ORDER` (app/data/types.ts) ne connait aucun
-- type « boisson », donc les etiquettes d'accueil ne bougent pas. Contrairement
-- aux coupes du 2026-09-09, il n'y a ici ni `food_types` ni `cuisine_type` a
-- resynchroniser — et `cuisine_type` (« Restaurant, bar & tapas ») redevient
-- meme exact, puisque le bar reouvre.

with resto as (
  select '700e8f32-e966-476a-b371-02884d08dea1'::uuid as id
),
nouvelles_categories as (
  insert into public.categories (restaurant_id, name, icon, sort_order, is_active)
  select r.id, v.nom, v.icone, v.ordre, true
  from resto r,
       (values ('Bières', '🍺', 30),
               ('Softs',  '🥤', 40)) as v(nom, icone, ordre)
  where not exists (
    select 1 from public.categories c
     where c.restaurant_id = r.id and c.name = v.nom)
  returning id, name
)
insert into public.products
  (restaurant_id, category_id, name, price, sort_order, photo_url, is_available)
select (select id from resto), nc.id, v.produit, v.prix, v.ordre, v.photo, true
from nouvelles_categories nc
join (values
  -- Bieres
  ('Bières', 'Fresh 33 cl',          7000, 10, null),
  ('Bières', 'THB 50 cl',            8000, 20, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/thb-gm.jpg'),
  ('Bières', 'Beaufort 33 cl',       8000, 30, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/beaufort.jpg'),
  ('Bières', 'Gold Blanche 50 cl',   9000, 40, null),
  -- Softs
  ('Softs',  'World Cola 33 cl',     5000, 10, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/world-cola.png'),
  ('Softs',  'Caprice Grenadine 33 cl', 5000, 20, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/caprice-grenadine.png'),
  ('Softs',  'Caprice Bonbon Anglais 33 cl', 5000, 30, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/bonbon-anglais.png'),
  ('Softs',  'Caprice Orange 33 cl', 5000, 40, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/boissons/caprice-orange.png'),
  ('Softs',  'Energy Drink XXL',     7000, 50, null),
  ('Softs',  'Energy Drink Fosa 50 cl', 8000, 60, null)
) as v(categorie, produit, prix, ordre, photo)
  on v.categorie = nc.name;
