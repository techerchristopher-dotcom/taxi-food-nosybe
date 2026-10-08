-- L'escale Créole : vignette sur l'option « Avec grains (inclus) » des 16 plats (2026-10-08) — beaucoup
-- de clients ne savent pas ce que sont les « grains ». Image GÉNÉRÉE (Higgsfield gpt_image_2, validée
-- par le porteur du projet : haricots blancs crème en bouillon clair, décor des vraies photos du resto) ;
-- source : visuels-reseaux/plats-du-jour/escale-creole/generations-2026-10-08/grains-haricots-blancs-v2.png.
-- À remplacer par une vraie photo de leurs grains si le restaurant en fournit une.
update public.product_options o
   set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/grains-haricots-blancs.jpg'
  from public.product_option_groups g
  join public.products p on p.id = g.product_id
 where o.group_id = g.id
   and g.name = 'Grains (haricots blancs)'
   and o.name = 'Avec grains (inclus)'
   and p.restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9';
