-- Manson 2.0 (« Manson by Marco », bar & pizzeria, Ambatoloaka) : fiche + carte en base, HIDDEN.
-- Sources (2026-10-22) : conversation WhatsApp « Taxi food » (photos, compositions, prix, horaires)
-- et page Facebook profile.php?id=100041555749503 (nom, téléphone, logo/couverture).
--   - 25 000 Ar la pizza, carton compris (donc aucun emballage facturé), ~25 cm.
--   - 18h30 → 1h du matin, 7 j/7 (une ligne par jour, la plage passe minuit : heure_dans_plage le gère).
--   - La Reine (avec œuf) : photo promise pour demain → créée INDISPONIBLE, composition à confirmer.
-- Photos : celles du restaurant, retravaillées (Higgsfield gpt_image_2_5) dans le décor du Manson,
-- déposées par deposer-visuel dans produits/manson/. Logo et couverture = couverture Facebook.
-- Rien de visible d'un client tant que listing_status = hidden. Commission : défaut de la colonne,
-- à fixer avec le porteur du projet. Position GPS inconnue (repli tarif de base).
do $$
declare
  v_rid uuid;
  v_cat uuid;
  v_pid uuid;
  v_gid uuid;
  v_img text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/manson/';
  v_n int;
begin
  if exists (select 1 from public.restaurants where name = 'Manson 2.0') then
    raise exception 'Manson 2.0 existe deja';
  end if;

  insert into public.restaurants (name, cuisine_type, food_types, phone, zone_served,
    listing_status, delivery_fee, min_order, sort_order, is_open, auto_open, logo_url, cover_url)
  values ('Manson 2.0', 'Bar & pizzeria', array['Pizza'],
    '+261327392691', 'Ambatoloaka', 'hidden', 2000, 0, 120, false, true,
    v_img || 'logo.png', v_img || 'couverture.jpg')
  returning id into v_rid;

  -- 18:30 → 01:00, tous les jours (0 = dimanche … 6 = samedi), un seul service
  insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
  select v_rid, d, 1, '18:30', '01:00', false from generate_series(0, 6) d;

  insert into public.categories (restaurant_id, name, sort_order, est_boisson)
  values (v_rid, 'Pizzas', 10, false) returning id into v_cat;

  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url)
  values (v_rid, v_cat, 'Fromage', 'Base tomate, fromage, fromage bleu, confiture de fraise. Environ 25 cm, carton compris.',
    25000, 10, true, v_img || 'pizza-fromage.jpg');

  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url)
  values (v_rid, v_cat, 'Pêcheur', 'Miettes de thon, fromage, base crème ou tomate. Environ 25 cm, carton compris.',
    25000, 20, true, v_img || 'pizza-pecheur.jpg')
  returning id into v_pid;
  insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order)
  values (v_pid, 'Base (1 au choix)', true, 1, 1, 10) returning id into v_gid;
  insert into public.product_options (group_id, name, price_delta, sort_order)
  values (v_gid, 'Tomate', 0, 10), (v_gid, 'Crème', 0, 20);

  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url)
  values (v_rid, v_cat, 'Cannibal', 'Base tomate, merguez, viande hachée, fromage. Environ 25 cm, carton compris.',
    25000, 30, true, v_img || 'pizza-cannibal.jpg');

  insert into public.products (restaurant_id, category_id, name, description, price, sort_order, is_available, photo_url)
  values (v_rid, v_cat, 'Reine', 'Avec œuf. Environ 25 cm, carton compris.',
    25000, 40, false, null);

  -- Prospect : rattaché, en négociation
  update public.prospects_restaurant set
    nom = 'Manson 2.0', statut = 'interesse', restaurant_id = v_rid,
    telephone = coalesce(telephone, '+261327392691'),
    facebook_url = coalesce(facebook_url, 'https://www.facebook.com/profile.php?id=100041555749503'),
    contact_source = coalesce(contact_source, 'page Facebook officielle https://www.facebook.com/profile.php?id=100041555749503'),
    notes = coalesce(notes || E'\n', '') || '2026-10-22 : fiche créée (hidden), 4 pizzas à 25 000 Ar, 18h30–1h 7j/7. Reine : photo et composition à recevoir. E-mail du compte restaurateur demandé.'
  where id = '2dff7c86-b882-47c4-a387-85524b6a6502';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'prospect Manson attendu 1, trouve %', v_n; end if;

  select count(*) into v_n from public.products where restaurant_id = v_rid;
  if v_n <> 4 then raise exception 'produits attendus 4, trouves %', v_n; end if;
  select count(*) into v_n from public.restaurant_hours where restaurant_id = v_rid;
  if v_n <> 7 then raise exception 'horaires attendus 7, trouves %', v_n; end if;
end $$;
