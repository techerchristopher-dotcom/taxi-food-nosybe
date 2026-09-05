-- Carte pizzas de Chez Bidul & Truc (13 pizzas au feu de bois).
--
-- Les visuels : quatre reprennent une image existante dont la composition
-- correspond REELLEMENT (verifie ingredient par ingredient, pas par similarite
-- de nom) ; les neuf autres ont ete generees pour cette carte. Contre-exemple
-- ecarte : les « 4 Fromages » de Taxi Be sont a la sauce tomate donc rouges,
-- celles-ci sont a la creme donc blanches — reutiliser aurait montre au client
-- une pizza qu'il n'aurait pas recue.
--
-- diet_tags : les quatre pizzas au lardon ou au jambon DE PORC sont taguees.
-- Ne pas confondre avec les « Reine » d'Angelo et Taxi Be, au jambon de volaille.

do $$
declare
  rid uuid;
  cid uuid;
  base text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/';
begin
  select id into rid from public.restaurants where name = 'Chez Bidul & Truc';
  if rid is null then raise exception 'Restaurant introuvable'; end if;

  insert into public.categories (restaurant_id, name, icon, sort_order, is_active)
  values (rid, 'Pizza', '🍕', 8, true)
  returning id into cid;

  create temporary table _pz (
    nom text, compo text, prix integer, photo text, porc boolean
  ) on commit drop;

  insert into _pz values
  ('Margherita',   'Tomate, mozzarella, olive, origan', 25000, 'taxi-be/pizza-margherita.png', false),
  ('Végétarienne', 'Tomate, aubergine, poivron, courgette, gouda, mozzarella, oignon, herbes de Provence', 27000, 'taxi-be/pizza-vegetarienne.png', false),
  ('Maître Coq',   'Tomate, gouda, mozzarella, poulet', 27000, 'chez-bidul-truc/pizza-maitre-coq.png', false),
  ('Carnivore',    'Tomate, gouda, mozzarella, viande hachée, oignon', 27000, 'taxi-be/pizza-bolognaise.png', false),
  ('Toscane',      'Crème, lardon, champignon, mozzarella, œuf', 29000, 'chez-bidul-truc/pizza-toscane.png', true),
  ('Reine',        'Tomate, gouda, mozzarella, jambon de porc, champignons, olive noire', 29000, 'taxi-be/pizza-reine.png', true),
  ('Océane',       'Tomate, calamar, crevette, poisson, gouda, mozzarella', 29000, 'chez-bidul-truc/pizza-oceane.png', false),
  ('Paysanne',     'Crème, fromage local, mozzarella, jambon de porc, champignons', 29000, 'chez-bidul-truc/pizza-paysanne.png', true),
  ('Oriental',     'Tomate, gouda, mozzarella, merguez, viande hachée, oignon, poivron, œuf', 31000, 'chez-bidul-truc/pizza-oriental.png', false),
  ('Napolitaine',  'Tomate, gouda, mozzarella, câpres, anchois, olives noires', 31000, 'chez-bidul-truc/pizza-napolitaine.png', false),
  ('4 Fromages',   'Crème, gouda, mozzarella, bleu d''Antsirabe, raclette', 32000, 'chez-bidul-truc/pizza-4-fromages.png', false),
  ('Savoyarde',    'Crème, oignon, fromage de montagne, gouda, lardon, pomme de terre, œuf', 35000, 'chez-bidul-truc/pizza-savoyarde.png', true),
  ('Gargantua',    'Tomate, gouda, mozzarella, viande hachée, merguez, oignon, poivron, œuf', 35000, 'chez-bidul-truc/pizza-gargantua.png', false);

  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url, is_available, diet_tags)
  select rid, cid, nom, compo, prix, base || photo, true,
         case when porc then array['porc'] else '{}'::text[] end
  from _pz;

  -- Boite pizza : la carte papier la facture 2 000 Ar « a emporter », et sur
  -- Taxi Food tout est livre — elle s'applique donc toujours. Groupe obligatoire
  -- a UN seul choix, que l'ecran produit pre-selectionne : la ligne apparait
  -- d'elle-meme dans le panier, a son prix, sans surprise a la fin. Afficher
  -- 25 000 puis facturer 27 000 aurait ete mal percu.
  insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
  select p.id, 'Boîte de transport', 1, 1, true, 10
  from public.products p
  where p.restaurant_id = rid and p.category_id = cid;

  insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
  select g.id, 'Boîte pizza', 2000, true, 1
  from public.product_option_groups g
  join public.products p on p.id = g.product_id
  where p.restaurant_id = rid and p.category_id = cid and g.name = 'Boîte de transport';
end $$;

-- Le restaurant remonte desormais dans le filtre « Pizza » de l'accueil.
update public.restaurants
   set food_types = array(select distinct unnest(coalesce(food_types,'{}') || array['Pizza']))
 where name = 'Chez Bidul & Truc';
