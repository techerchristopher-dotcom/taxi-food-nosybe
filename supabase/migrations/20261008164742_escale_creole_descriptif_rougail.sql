-- L'escale Créole : descriptif « recette » du rougail saucisses (test validé par le porteur du projet,
-- 2026-10-08) — ingrédients, grandes étapes, « le secret du chef ». FR + EN + IT.
update public.products
   set description = 'Saucisses de porc fumées, tomates, oignons, ail, gingembre, curcuma, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont d''abord ébouillantées pour les dessaler, puis coupées en rondelles et dorées avec l''oignon et l''ail. On ajoute les tomates et les épices, et on laisse mijoter à feu doux jusqu''à une sauce bien réduite. Servi avec du riz.'
 where restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9' and name = 'Rougail saucisses' and not is_archived;

insert into public.traductions_catalogue (fr, langue, texte, source) values
  ('Saucisses de porc fumées, tomates, oignons, ail, gingembre, curcuma, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont d''abord ébouillantées pour les dessaler, puis coupées en rondelles et dorées avec l''oignon et l''ail. On ajoute les tomates et les épices, et on laisse mijoter à feu doux jusqu''à une sauce bien réduite. Servi avec du riz.',
   'en', 'Smoked pork sausages, tomatoes, onions, garlic, ginger, turmeric, a touch of chili (or not, your choice)… and the chef''s secret. The sausages are first boiled to remove excess salt, then sliced and browned with the onion and garlic. Tomatoes and spices go in, and it all simmers gently into a rich, reduced sauce. Served with rice.', 'manuel'),
  ('Saucisses de porc fumées, tomates, oignons, ail, gingembre, curcuma, une pointe de piment (ou pas, selon ton choix)… et le secret du chef. Les saucisses sont d''abord ébouillantées pour les dessaler, puis coupées en rondelles et dorées avec l''oignon et l''ail. On ajoute les tomates et les épices, et on laisse mijoter à feu doux jusqu''à une sauce bien réduite. Servi avec du riz.',
   'it', 'Salsicce di maiale affumicate, pomodori, cipolle, aglio, zenzero, curcuma, un pizzico di peperoncino (o no, a tua scelta)… e il segreto dello chef. Le salsicce vengono prima sbollentate per togliere il sale, poi tagliate a rondelle e rosolate con cipolla e aglio. Si aggiungono pomodori e spezie e si lascia sobbollire a fuoco lento fino a ottenere un sugo ben ristretto. Servito con riso.', 'manuel')
on conflict (fr, langue) do nothing;
