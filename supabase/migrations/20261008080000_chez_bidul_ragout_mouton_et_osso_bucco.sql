-- Chez Bidule & Truc : ragoût de mouton aux haricots blancs et osso bucco à l'affiche
-- (2026-10-08, demande du porteur du projet). 30 000 Ar chacun, comme ses autres plats du jour.
--
-- - Créations « À l'affiche » : sans catégorie, `in_menu = false`, `is_featured = true`,
--   étiquette « Plat du jour ». Photos : RECONSTITUTIONS générées dans sa charte (bol noir,
--   fond sombre — `visuels-reseaux/plats-du-jour/chez-bidul-truc/generations-2026-10-08/`,
--   ragoût variante B, osso bucco variante A), à remplacer par ses vraies photos.
-- - Accompagnements copiés depuis « Cuisse de poulet » : 1 inclus au choix + 2e à +5 000 Ar.
-- - Le pot-au-feu QUITTE l'affiche (`is_featured = false`) mais reste dans la bibliothèque :
--   ⚠️ jamais archivé, sinon le retour en un tap serait perdu.

do $$
declare
  v_resto constant uuid := '700e8f32-e966-476a-b371-02884d08dea1';
  v_modele uuid;
  v_plat record;
  v_id uuid;
  v_g record;
  v_ng uuid;
begin
  select id into v_modele from public.products
   where restaurant_id = v_resto and name = 'Cuisse de poulet' and not is_archived limit 1;

  update public.products set is_featured = false
   where restaurant_id = v_resto and name = 'Pot-au-feu';

  for v_plat in
    select * from (values
      ('Ragoût de mouton aux haricots blancs',
       'Mouton mijoté longuement, haricots blancs, carotte, oignon, sauce tomate au vin.',
       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/plat-ragout-de-mouton-aux-haricots-blancs.jpg',
       16),
      ('Osso bucco',
       'Jarret de veau braisé avec son os à moelle, sauce tomate aux petits légumes, gremolata.',
       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/plat-osso-bucco.jpg',
       17)
    ) as t(nom, descr, photo, rang)
  loop
    if exists (select 1 from public.products where restaurant_id = v_resto and name = v_plat.nom and not is_archived) then
      update public.products set is_featured = true, is_available = true, price = 30000,
             photo_url = v_plat.photo, featured_label = 'Plat du jour'
       where restaurant_id = v_resto and name = v_plat.nom and not is_archived;
      continue;
    end if;

    insert into public.products (restaurant_id, category_id, name, description, price, photo_url,
                                 is_available, is_featured, featured_label, in_menu, sort_order)
    values (v_resto, null, v_plat.nom, v_plat.descr, 30000, v_plat.photo,
            true, true, 'Plat du jour', false, v_plat.rang)
    returning id into v_id;

    if v_modele is not null then
      for v_g in select * from public.product_option_groups where product_id = v_modele order by sort_order loop
        insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
        values (v_id, v_g.name, v_g.min_select, v_g.max_select, v_g.required, v_g.sort_order)
        returning id into v_ng;
        insert into public.product_options (group_id, name, price_delta, sort_order, is_available)
        select v_ng, o.name, o.price_delta, o.sort_order, o.is_available
          from public.product_options o where o.group_id = v_g.id;
      end loop;
    end if;
  end loop;
end $$;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Ragoût de mouton aux haricots blancs', 'en', 'Mutton stew with white beans', 'manuel'),
  ('Ragoût de mouton aux haricots blancs', 'it', 'Spezzatino di montone con fagioli bianchi', 'manuel'),
  ('Osso bucco', 'en', 'Osso buco', 'manuel'),
  ('Osso bucco', 'it', 'Ossobuco', 'manuel'),
  ('Mouton mijoté longuement, haricots blancs, carotte, oignon, sauce tomate au vin.', 'en', 'Slow-simmered mutton, white beans, carrot, onion, tomato and wine sauce.', 'manuel'),
  ('Mouton mijoté longuement, haricots blancs, carotte, oignon, sauce tomate au vin.', 'it', 'Montone cotto a lungo, fagioli bianchi, carota, cipolla, salsa di pomodoro al vino.', 'manuel'),
  ('Jarret de veau braisé avec son os à moelle, sauce tomate aux petits légumes, gremolata.', 'en', 'Braised veal shank with its marrow bone, tomato and vegetable sauce, gremolata.', 'manuel'),
  ('Jarret de veau braisé avec son os à moelle, sauce tomate aux petits légumes, gremolata.', 'it', 'Stinco di vitello brasato con l''osso midollare, sugo di pomodoro e verdure, gremolata.', 'manuel')
on conflict (fr, langue) do nothing;
