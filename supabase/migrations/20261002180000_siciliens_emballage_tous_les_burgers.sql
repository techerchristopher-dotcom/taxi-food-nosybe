-- Les Siciliens : l'emballage à 1 000 Ar s'applique à TOUTE la catégorie Burger, y compris les
-- trois plats qui n'en portaient pas (décision du porteur du projet, 2026-10-02). Comme les
-- autres, il revient à Taxi Food (restaurants.emballage_pour_taxifood).
-- Les commandes TF-306, TF-307 et TF-308 (tests de l'ouverture) ont été annulées le même jour
-- par admin_set_order_status — geste d'exploitation, pas de migration.
update public.products set packaging_fee = 1000, packaging_label = 'Emballage à emporter'
 where restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b'
   and name in ('Steak grillé ou steak milanaise','Poulet grillé','Poulet milanese');
