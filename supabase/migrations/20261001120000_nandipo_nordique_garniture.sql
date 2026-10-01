-- Correction : la Nordique avait la mauvaise description (copie de l'Américaine).
-- Nordique : Crème, lardons, oignons, mozzarella.
-- Américaine : Tomate, mozzarella, poisson fumé. (différente !)
update public.products 
set description = 'Crème, lardons, oignons, mozzarella.'
where restaurant_id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8' and name = 'Nordique';
