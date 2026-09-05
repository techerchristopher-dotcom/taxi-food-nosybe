-- FRAIS D'EMBALLAGE (boite a pizza)
--
-- Corrige une premiere approche du meme jour, qui modelisait la boite en groupe
-- d'options obligatoire a un seul choix. C'etait une complication inutile : le
-- client n'a rien a choisir. C'est un FRAIS, comme la livraison — une ligne
-- calculee du panier, affichee juste au-dessus des frais de livraison.
--
-- Porte par le PRODUIT (et non par le restaurant) pour que seuls les articles
-- concernes le declenchent : une pizza oui, un dessert non.

alter table public.products
  add column if not exists packaging_fee integer not null default 0,
  add column if not exists packaging_label text;

alter table public.products
  add constraint products_packaging_fee_positif check (packaging_fee >= 0);

alter table public.orders
  add column if not exists packaging_fee integer not null default 0;

-- Les 13 pizzas de Chez Bidul & Truc : 2 000 Ar la boite, une par pizza.
update public.products p
   set packaging_fee = 2000, packaging_label = 'Boîte à pizza'
  from public.categories c, public.restaurants r
 where c.id = p.category_id and r.id = p.restaurant_id
   and r.name = 'Chez Bidul & Truc' and c.name = 'Pizza';

-- On defait le groupe d'options « Boite de transport ».
delete from public.product_options oo
 using public.product_option_groups og
 where og.id = oo.group_id and og.name = 'Boîte de transport';
delete from public.product_option_groups where name = 'Boîte de transport';

-- create_order recalcule le total cote serveur : l'emballage doit y etre, sinon
-- le montant affiche au client et celui enregistre divergeraient.
-- Corps complet de la fonction : voir la version en base (pg_get_functiondef).
-- Les deux seuls changements par rapport a la version precedente :
--   * v_packaging := somme de products.packaging_fee x quantite ;
--   * total = subtotal + packaging + delivery.
-- La COMMISSION reste calculee sur la marchandise seule : ni l'emballage ni la
-- livraison ne sont commissionnes.
