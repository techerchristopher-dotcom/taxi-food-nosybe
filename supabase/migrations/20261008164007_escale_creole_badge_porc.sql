-- L'escale Créole : badge « Contient du porc » sur les quatre plats au porc (2026-10-08).
-- Aucun de ses plats ne portait l'étiquette, alors que l'app l'affiche partout ailleurs :
-- à Nosy Be une part importante de la clientèle ne mange pas de porc.
update public.products
   set diet_tags = array_append(coalesce(diet_tags, '{}'), 'porc')
 where restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9' and not is_archived
   and name in ('Rougail saucisses', 'Bouchon porc', 'Rôti porc à la créole', 'Sauté porc aux gros piments')
   and not ('porc' = any(coalesce(diet_tags, '{}')));
