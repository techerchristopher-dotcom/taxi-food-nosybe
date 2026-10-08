-- Le Nandipo : badge « Contient du porc » sur les pizzas au jambon (Italienne, Romana) et aux
-- lardons (Flambée, Nordique) — 2026-10-08, porc confirmé par le porteur du projet.
update public.products
   set diet_tags = array_append(coalesce(diet_tags, '{}'), 'porc')
 where restaurant_id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8' and not is_archived
   and name in ('Italienne', 'Romana', 'Flambée', 'Nordique')
   and not ('porc' = any(coalesce(diet_tags, '{}')));
