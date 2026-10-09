-- Le Nandipo : le « Zebu bourguignon » portait le badge « Contient du porc » à tort (signalé par le
-- patron le 2026-10-09). Cause : le patron a fait « Modifier » sur son plat du jour « Rougail
-- saucisse » (tagué porc le 2026-10-08) et l'a réécrit en zébu bourguignon ; save_featured_product
-- met à jour la même ligne sans toucher à diet_tags, le badge a donc suivi.
update public.products
   set diet_tags = array_remove(coalesce(diet_tags, '{}'), 'porc')
 where restaurant_id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8'
   and name = 'Zebu bourguignon' and not is_archived
   and 'porc' = any(coalesce(diet_tags, '{}'));
