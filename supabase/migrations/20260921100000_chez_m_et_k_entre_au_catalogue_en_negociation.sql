-- Chez M&K entre au catalogue, en « En négociation » (2026-09-21).
--
-- POURQUOI `coming_soon` ET PAS `visible`. La carte a été relevée sur la conversation WhatsApp du
-- restaurateur (Kenny, 20/09 au soir — partenaire /M&K/CARTE-CHEZ-M-ET-K.md) : les prix et les
-- photos sont les siens, mais il manque trop de choses pour prendre une commande sans risque
-- (voir les six points plus bas). Le restaurant se montre, mais ne se commande pas.
-- `auto_open = false` et `is_open = false` pour la même raison : ses horaires sont posés, mais
-- ce ne sont pas eux qui doivent l'ouvrir tant que l'exploitant n'a pas tranché.
--
-- POURQUOI AUCUNE DESCRIPTION. Aucun ingrédient n'a été communiqué. « Ti pan » ou « tsa siou »
-- varient d'une maison à l'autre : une composition devinée depuis le nom, c'est une fiche fausse,
-- et une fiche fausse se paie en commande annulée. `description` reste NULL partout.
--
-- POURQUOI 5 % ET 10 000 Ar. Alignés sur La Cabane, Chez Bidul & Truc et Les Siciliens.
--
-- POURQUOI UNE SEULE LIGNE D'HORAIRE PAR JOUR. Service continu 9h–22h, sept jours sur sept.
-- `extract(dow)` : 0 = dimanche, 1 = lundi (piège déjà payé sur Chez Bidul).
--
-- POURQUOI LES PLATS « AU CHOIX » RESTENT UN SEUL PRODUIT. Nem, bouchon et bol renversé se
-- déclinent en trois viandes ; riz cantonais et mi sao en deux formats. Chacun est UN produit avec
-- un groupe d'options obligatoire, jamais trois fiches : sinon la carte triple et le choix se perd.
-- ⚠️ Le tag `porc` n'est PAS posé sur les trois plats à viande au choix : le porc n'y est qu'une
-- option sur trois. Limite produit à remonter : `diet_tags` vit sur le PRODUIT, l'app ne sait pas
-- signaler « porc » sur une OPTION. Le client qui évite le porc ne voit donc aucun badge sur ces
-- trois plats — il choisit sa viande lui-même, mais rien ne l'avertit que l'une d'elles est du porc.
--
-- POURQUOI LA FONDUE EST INDISPONIBLE. 100 000 Ar par personne, « sur commande » : ni le délai ni
-- le minimum de couverts ne sont connus. Plutôt une fiche grisée qu'une commande qu'il ne pourra
-- pas honorer.
--
-- À FAIRE TRANCHER PAR L'EXPLOITANT, avant tout passage en `visible` :
--   1. « Bol renversé fruits de mer » n'a AUCUNE photo (légende envoyée seule) : il en faut une,
--      ou le plat sort de la carte.
--   2. Les ingrédients des 28 plats.
--   3. Le ti pan mixte contient-il du porc ? « Mixte » n'est pas défini : pas de tag tant que ce
--      n'est pas répondu, mais ne pas l'oublier — le badge doit être fiable.
--   4. La fondue : délai de commande et minimum de couverts.
--   5. Les boissons : aucune communiquée.
--   6. L'adresse exacte (« Djabala Honko » est un quartier) et un logo détouré — l'enseigne dorée
--      (00-enseigne-chez-m-et-k.jpg) est un visuel de communication, pas un logo.
--
-- Photos : 29 visuels déposés par `deposer-visuel` dans produits/chez-m-et-k/ (dont l'enseigne et
-- la photo « a » de l'assiette de friture, gardée en réserve), tous vérifiés 200 sur l'URL d'objet
-- ET sur l'URL de rendu avant d'être référencés ici.
--
-- Idempotent : chaque insertion vérifie l'absence de ce qu'elle crée.

insert into public.restaurants
  (id, name, cuisine_type, zone_served, phone, delivery_fee, min_order, commission_rate,
   listing_status, auto_open, is_open, sort_order, food_types, logo_url, cover_url)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', 'Chez M&K', 'Restaurant chinois', 'Djabala Honko', '+261371986196', 10000, 0, 0.05,
       'coming_soon', false, false, 80, array['Chinois','Nouilles','Riz','Grillades'], null, null
where not exists (select 1 from public.restaurants where id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' or name = 'Chez M&K');

insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', d, 1, '09:00', '22:00', false
from generate_series(0, 6) as d
where not exists (select 1 from public.restaurant_hours h
                  where h.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and h.weekday = d and h.service = 1);

insert into public.categories (restaurant_id, name, icon, sort_order, est_boisson, is_active)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', v.name, v.icon, v.ord, false, true
from (values
  ('Entrées & à partager', '🥟', 10),
  ('Soupes', '🍜', 20),
  ('Ti pan — à la plancha', '🔥', 30),
  ('Wok & sautés', '🥘', 40),
  ('Viandes', '🥩', 50),
  ('Riz, nouilles & bols', '🍚', 60),
  ('Sur commande', '🍲', 70)
) as v(name, icon, ord)
where not exists (select 1 from public.categories c
                  where c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = v.name);

insert into public.products
  (restaurant_id, category_id, name, description, price, diet_tags, photo_url, is_available,
   sort_order, in_menu, is_featured, is_archived)
select '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53', c.id, v.name, null, v.price, v.tags, v.photo, v.dispo, v.ord, true, false, false
from (values
  ('Entrées & à partager', 'Van tan frit', 15000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/18-van-tan-frit.jpg', true, 10),
  ('Entrées & à partager', 'Assiette de nem cocktail', 15000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/27-assiette-de-nem-cocktail.jpg', true, 20),
  ('Entrées & à partager', 'Nem porc ou poulet ou zébu', 20000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/04-nem-porc-poulet-ou-zebu.jpg', true, 30),
  ('Entrées & à partager', 'Bouchon porc ou poulet ou bœuf', 20000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/21-bouchon-porc-poulet-ou-boeuf.jpg', true, 40),
  ('Entrées & à partager', 'Croustillant de crevette', 20000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/11-croustillant-de-crevette.jpg', true, 50),
  ('Entrées & à partager', 'Rouleaux de grosses crevettes', 25000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/17-rouleaux-de-grosses-crevettes.jpg', true, 60),
  ('Entrées & à partager', 'Rouleaux de printemps aux crevettes', 30000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/16-rouleaux-de-printemps-aux-crevettes.jpg', true, 70),
  ('Entrées & à partager', 'Assiette de friture', 40000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/24-assiette-de-friture-b.jpg', true, 80),
  ('Soupes', 'Soupe garnie', 25000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/14-soupe-garnie.jpg', true, 10),
  ('Soupes', 'Soupe spéciale MK', 30000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/13-soupe-speciale-mk.jpg', true, 20),
  ('Ti pan — à la plancha', 'Ti pan poulet', 30000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/15-ti-pan-poulet.jpg', true, 10),
  ('Ti pan — à la plancha', 'Ti pan de steak de zébu', 30000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/28-ti-pan-de-steak-de-zebu.jpg', true, 20),
  ('Ti pan — à la plancha', 'Ti pan porc', 35000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/07-ti-pan-porc.jpg', true, 30),
  ('Ti pan — à la plancha', 'Ti pan mixte', 40000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/26-ti-pan-mixte.jpg', true, 40),
  ('Wok & sautés', 'Crevettes sautées aux pousses de maïs', 35000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/10-crevettes-sautees-pousses-de-mais.jpg', true, 10),
  ('Wok & sautés', 'Sauté de porc aux légumes', 35000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/20-saute-de-porc-aux-legumes.jpg', true, 20),
  ('Viandes', 'Assiette de tsa siou', 20000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/25-assiette-de-tsa-siou.jpg', true, 10),
  ('Viandes', 'Côte d''échine de porc', 45000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/01-cote-d-echine-de-porc.jpg', true, 20),
  ('Viandes', 'Poitrine de porc', 50000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/02-poitrine-de-porc.jpg', true, 30),
  ('Viandes', 'Beignet de porc sauce aigre-douce', 50000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/03-beignet-de-porc-sauce-aigre-douce.jpg', true, 40),
  ('Viandes', 'Ribs laqué', 50000, array['porc'], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/12-ribs-laque.jpg', true, 50),
  ('Viandes', 'Magret de canard sauce poivre vert', 70000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/06-magret-de-canard-sauce-poivre-vert.jpg', true, 60),
  ('Riz, nouilles & bols', 'Riz cantonais', 25000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/08-riz-cantonais.jpg', true, 10),
  ('Riz, nouilles & bols', 'Mi sao', 25000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/09-mi-sao.jpg', true, 20),
  ('Riz, nouilles & bols', 'Bol renversé bœuf, poulet ou porc', 30000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/22-bol-renverse-boeuf-poulet-ou-porc.jpg', true, 30),
  ('Riz, nouilles & bols', 'Bol renversé fruits de mer', 40000, '{}'::text[], null, true, 40),
  ('Riz, nouilles & bols', 'Pâtes fraîches épicées aux crevettes', 40000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/05-pates-fraiches-epicees-aux-crevettes.jpg', true, 50),
  ('Sur commande', 'Fondue chinoise terre et mer', 100000, '{}'::text[], 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-m-et-k/19-fondue-chinoise-terre-et-mer.jpg', false, 10)
) as v(cat, name, price, tags, photo, dispo, ord)
join public.categories c on c.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and c.name = v.cat
where not exists (select 1 from public.products p
                  where p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and lower(p.name) = lower(v.name)
                    and not p.is_archived);

-- Groupes d'options : un par plat décliné, obligatoire, un seul choix.
insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select p.id, v.grp, 1, 1, true, 10
from (values
  ('Nem porc ou poulet ou zébu', 'Viande au choix'),
  ('Bouchon porc ou poulet ou bœuf', 'Viande au choix'),
  ('Bol renversé bœuf, poulet ou porc', 'Viande au choix'),
  ('Riz cantonais', 'Format'),
  ('Mi sao', 'Format')
) as v(plat, grp)
join public.products p on p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and p.name = v.plat and not p.is_archived
where not exists (select 1 from public.product_option_groups g where g.product_id = p.id and g.name = v.grp);

insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, v.opt, v.delta, true, v.ord
from (values
  ('Nem porc ou poulet ou zébu', 'Viande au choix', 'Porc', 0, 10),
  ('Nem porc ou poulet ou zébu', 'Viande au choix', 'Poulet', 0, 20),
  ('Nem porc ou poulet ou zébu', 'Viande au choix', 'Zébu', 0, 30),
  ('Bouchon porc ou poulet ou bœuf', 'Viande au choix', 'Porc', 0, 10),
  ('Bouchon porc ou poulet ou bœuf', 'Viande au choix', 'Poulet', 0, 20),
  ('Bouchon porc ou poulet ou bœuf', 'Viande au choix', 'Bœuf', 0, 30),
  ('Bol renversé bœuf, poulet ou porc', 'Viande au choix', 'Bœuf', 0, 10),
  ('Bol renversé bœuf, poulet ou porc', 'Viande au choix', 'Poulet', 0, 20),
  ('Bol renversé bœuf, poulet ou porc', 'Viande au choix', 'Porc', 0, 30),
  ('Riz cantonais', 'Format', 'Simple', 0, 10),
  ('Riz cantonais', 'Format', 'Spécial', 5000, 20),
  ('Mi sao', 'Format', 'Simple', 0, 10),
  ('Mi sao', 'Format', 'Spécial', 5000, 20)
) as v(plat, grp, opt, delta, ord)
join public.products p on p.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and p.name = v.plat and not p.is_archived
join public.product_option_groups g on g.product_id = p.id and g.name = v.grp
where not exists (select 1 from public.product_options o where o.group_id = g.id and o.name = v.opt);
