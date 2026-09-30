-- Le Nandipo (Hell-Ville) : catalogue en base, fiche HIDDEN, prospect en negociation.
-- Source : visuels-reseaux/nandipo/donnees_nandipo.py (45 lignes, prix de sa carte).
-- Rien de visible d'un client : listing_status = hidden (rang_catalogue genere = 200100).
-- Visuels deposes via l'Edge Function deposer-visuel dans produits/le-nandipo/.
do $$
declare
  v_rid uuid;
  v_cat uuid;
  v_pid uuid;
  v_gid uuid;
begin
  insert into public.restaurants (name, cuisine_type, food_types, phone, zone_served,
    listing_status, delivery_fee, min_order, sort_order, is_open, auto_open, logo_url)
  values ('Le Nandipo', 'Brasserie, zébu & pizzeria',
    array['Pizza','Zébu','Poisson','Pâtes','Burger'],
    '+261374669010', 'Hell-Ville', 'hidden', 10000, 0, 100, false, false,
    'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/divers/logo.png')
  returning id into v_rid;


  -- Entrées froides
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Entrées froides', 10, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Salade Nandipo', 'Salade, carottes, chou blanc, tomate, poisson fumé, frite, fromage, œuf au plat.', 28000, 10, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Assiette de poisson fumé', 'Poisson fumé, beurre.', 26000, 20, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Cocktail de crevettes', 'Crevettes, concombre, cornichon, sauce cocktail.', 22000, 30, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Salade de crudité', 'Carottes, chou blanc, tomate, salade, poivrons.', 12000, 40, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Salade verte', 'Salade, oignons.', 6000, 50, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Carpaccio de zébu', 'Viande de zébu, poivre vert, pesto maison.', 20000, 60, true, null) returning id into v_pid;

  -- Entrées chaudes
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Entrées chaudes', 20, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Bâtonnets de mozzarella', 'Mozzarella, chapelure, salade, tomate, oignons.', 33000, 10, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Beignet de crevettes', 'Crevettes, pâte à beignet, salade, tomate, oignons.', 26000, 20, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Bâtonnet de poisson', 'Poisson, chapelure, salade, tomate, oignons.', 18000, 30, true, null) returning id into v_pid;

  -- Côté terre
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Côté terre', 30, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Côte de zébu forestière', 'Côte de zébu, accompagnement au choix, sauce au champignon et vin.', 45000, 10, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p06.jpg') returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Filet de zébu sauce au poivre', 'Filet de zébu, accompagnement au choix, sauce au poivre vert.', 40000, 20, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Brochettes de zébu gingembre', 'Viande de zébu, tomate, poivrons, oignons, gingembre, accompagnement au choix.', 38000, 30, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Cabri massalé', 'Cabri au massala, accompagnement au choix.', 34000, 40, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Langue de zébu', 'Langue de zébu, sauce tomate, carotte, cornichons, accompagnement au choix.', 32000, 50, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Poulet au coco', 'Poulet sauce au coco, accompagnement au choix.', 30000, 60, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Poulet grillé', 'Poulet grillé, accompagnement au choix.', 28000, 70, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Rougail saucisse', 'Saucisse de porc, sauce tomate épicée, accompagnement au choix.', 30000, 80, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p09.jpg') returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);

  -- Côté mer
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Côté mer', 40, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Poisson sauce poireau', 'Poisson, sauce poireau, accompagnement au choix.', 28000, 10, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p13.jpg') returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Poisson grillé', 'Poisson grillé, accompagnement au choix.', 26000, 20, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Crevette façon Nandipo', 'Crevette, crème curcuma, accompagnement au choix.', 35000, 30, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Calamar grillé', 'Calamar grillé, accompagnement au choix.', 38000, 40, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Calamar persillade', 'Calamar sauté ail et persil, accompagnement au choix.', 40000, 50, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Brochette mixte', 'Brochette de crevette, de calamar et de poisson, accompagnement au choix.', 38000, 60, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Gratin de fruit de mer', 'Mélange de fruit de mer (calamar, crevettes, poisson), riz, crème, fromage.', 40000, 70, true, null) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Accompagnement (1 au choix, inclus)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Riz blanc', 0, 10), (v_gid, 'Riz safrané', 0, 20), (v_gid, 'Frites', 0, 30), (v_gid, 'Pommes sautées', 0, 40), (v_gid, 'Pâtes', 0, 50), (v_gid, 'Légumes', 0, 60), (v_gid, 'Haricots verts', 0, 70);

  -- Pâtes
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Pâtes', 50, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Bolognaise', 'Viande de zébu, carottes, oignons, sauce tomate.', 28000, 10, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Carbonara', 'Poitrine fumée, oignons, crème, vin blanc.', 30000, 20, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p15.jpg') returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Fruit de mer', 'Mélange de fruit de mer, sauce tomate.', 30000, 30, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p17.jpg') returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Lasagne', null, 30000, 40, true, null) returning id into v_pid;

  -- Hamburger
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Hamburger', 60, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Hamburger', 'Pain burger maison, salade, tomate, oignons, cornichons, sauce burger, steack haché.', 28000, 10, true, 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p16.jpg') returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Cheeseburger', 'Pain burger maison, salade, tomate, oignons, cornichons, sauce burger, steack haché, fromage.', 30000, 20, true, null) returning id into v_pid;

  -- Pizzas
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Pizzas', 70, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Toscana', 'Tomate, mozzarella, poitrine fumée, poivrons, oignons, œufs.', 20000, 10, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Italienne', 'Tomate, mozzarella, jambon, rondelle de tomates.', 18000, 20, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Andalouse', 'Tomate, mozzarella, merguez.', 19000, 30, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 11000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Romana', 'Tomate, mozzarella, jambon, champignons.', 19000, 40, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 11000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Fruit de mer', 'Tomate, mozzarella, poisson, crevettes, calamar.', 20000, 50, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Flambée', 'Crème, lardons, oignons, mozzarella.', 20000, 60, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Nordique', 'Tomate, mozzarella, poisson fumé.', 20000, 70, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Américaine', 'Tomate, mozzarella, poisson fumé.', 19000, 80, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 11000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Végétarienne', 'Tomate, mozzarella, ratatouille.', 17000, 90, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 11000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Poulet', 'Tomate, mozzarella, poulet.', 18000, 100, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 11000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Margarita', 'Tomate, mozzarella.', 12000, 110, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 12000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Fromagère', 'Tomate, mozzarella, raclette, fromage bleu.', 20000, 120, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Taille (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Petit modèle', 0, 10), (v_gid, 'Grand modèle', 15000, 20);
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available) values (v_rid, v_cat, 'Demi pizza et salade', 'Demi pizza au choix, salade crudité ou salade mixte.', 28000, 130, true) returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order) values (v_pid, 'Salade au choix', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order) values (v_gid, 'Salade crudité', 0, 10), (v_gid, 'Salade mixte', 0, 20);

  -- Dessert
  insert into public.categories (restaurant_id, name, sort_order, est_boisson) values (v_rid, 'Dessert', 80, false) returning id into v_cat;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Mousse chocolat', null, 17000, 10, true, null) returning id into v_pid;
  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url) values (v_rid, v_cat, 'Glaces', null, 5000, 20, true, null) returning id into v_pid;

  -- Prospect : en negociation, comme Les Siciliens (statut interesse), sans toucher aux telephones
  update public.prospects_restaurant set
    nom = 'Le Nandipo', statut = 'interesse', priorite = 'haute', type_etablissement = 'restaurant',
    restaurant_id = v_rid,
    notes = 'en négociation (hidden au catalogue). Carte des deux pages transcrite (45 lignes), 19 photos reçues : 6 identifiées, 13 en attente d''attribution. Test de carte produit le 2026-09-30.',
    updated_at = now()
  where id = 'd526a567-a5a0-452f-99ac-4fd03ff6254b';

  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, note)
  values ('d526a567-a5a0-452f-99ac-4fd03ff6254b', 'whatsapp', 'entrant', 'interesse',
    'Carte des deux pages et 19 photos reçues le 2026-09-29 ; catalogue chargé en base le 2026-09-30, fiche en hidden.');
end $$;
