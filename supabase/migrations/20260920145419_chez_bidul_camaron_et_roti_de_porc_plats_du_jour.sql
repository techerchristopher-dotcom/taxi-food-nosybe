-- 20260920145419_chez_bidul_camaron_et_roti_de_porc_plats_du_jour.sql
-- Appliquee sur la base de production le 2026-09-20 via le connecteur MCP.
--
-- Chez Bidul & Truc : deux nouveaux plats du jour, et cette fois AVEC leurs accompagnements.
--
-- Pourquoi les groupes d'options sont ici et pas dans une migration separee : les cinq plats
-- du jour crees depuis le pot-au-feu n'en avaient aucun, alors que les trois premiers
-- (poulet basquaise, blanquette, tartare) proposent un accompagnement inclus et un second a
-- +5 000 Ar. Un client qui commandait le demi-poulet n'avait aucun choix, celui qui commandait
-- le basquaise en avait cinq. On ne reproduit pas l'oubli : le camaron et le roti naissent
-- avec leurs groupes.
--
-- Le « ou » du roti n'est pas dans le nom pour faire joli : c'est un choix du client, donc un
-- groupe obligatoire « Sauce au choix », sur le modele exact de « Filet de poisson sauce au
-- choix ». Les deux sauces n'ont pas encore de photo — `photo_url` reste null, ce que le
-- schema accepte deja ailleurs (cf. « Viande au choix » du Classique).
--
-- Le roti porte `diet_tags = {porc}`. Ce n'est pas cosmetique : a Nosy Be une part de la
-- clientele ne mange pas de porc, et le badge existe deja sur 17 produits.
--
-- Tout est idempotent : rejouer cette migration ne cree aucun doublon.

-- ---------------------------------------------------------------- les deux produits
insert into products (restaurant_id, category_id, name, price, photo_url, is_available,
                      stock_quantity, is_archived, is_featured, featured_label, in_menu,
                      diet_tags, sort_order)
select '700e8f32-e966-476a-b371-02884d08dea1'::uuid, null, v.nom, v.prix,
       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/' || v.fichier,
       true, null, false, true, 'Plat du jour', false, v.tags, v.ordre
from (values
  ('Camaron grillé brasero',            55000, 'plat-camaron-grille-brasero.png',          '{}'::text[],       9),
  ('Rôti de porc provençale ou miel',   30000, 'plat-roti-de-porc-provencale-ou-miel.png', '{porc}'::text[],  10)
) as v(nom, prix, fichier, tags, ordre)
where not exists (
  select 1 from products p
  where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
    and lower(p.name) = lower(v.nom)
    and not p.is_archived
);

-- ------------------------------------------------- le groupe « Sauce au choix » du roti seul
insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select p.id, 'Sauce au choix', 1, 1, true, 10
from products p
where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
  and lower(p.name) = lower('Rôti de porc provençale ou miel')
  and not p.is_archived
  and not exists (
    select 1 from product_option_groups g
    where g.product_id = p.id and g.name = 'Sauce au choix'
  );

insert into product_options (group_id, name, price_delta, is_available, sort_order, photo_url)
select g.id, v.nom, 0, true, v.ordre, null
from product_option_groups g
join products p on p.id = g.product_id
cross join (values ('Provençale', 10), ('Miel', 20)) as v(nom, ordre)
where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
  and lower(p.name) = lower('Rôti de porc provençale ou miel')
  and not p.is_archived
  and g.name = 'Sauce au choix'
  and not exists (
    select 1 from product_options o where o.group_id = g.id and o.name = v.nom
  );

-- ------------------------------------- les deux groupes d'accompagnement, pour les deux plats
insert into product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select p.id, v.groupe, v.mini, v.maxi, v.oblig, v.ordre
from products p
cross join (values
  ('Accompagnement (1 au choix, inclus)', 1, 1, true,  30),
  ('2e accompagnement (+5 000 Ar)',       0, 1, false, 40)
) as v(groupe, mini, maxi, oblig, ordre)
where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
  and lower(p.name) in (lower('Camaron grillé brasero'), lower('Rôti de porc provençale ou miel'))
  and not p.is_archived
  and not exists (
    select 1 from product_option_groups g where g.product_id = p.id and g.name = v.groupe
  );

-- Les cinq accompagnements et leurs photos sont repris a l'identique de l'existant, jamais
-- reinventes : memes libelles, memes URL, meme ordre. Le supplement de 5 000 Ar ne porte que
-- sur le second groupe.
insert into product_options (group_id, name, price_delta, is_available, sort_order, photo_url)
select g.id, v.nom,
       case when g.name = '2e accompagnement (+5 000 Ar)' then 5000 else 0 end,
       true, v.ordre,
       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/chez-bidul-truc/' || v.fichier
from product_option_groups g
join products p on p.id = g.product_id
cross join (values
  ('Frites',         10, 'accompagnement-frites.png'),
  ('Légumes sautés', 20, 'accompagnement-legumes-sautes.png'),
  ('Pâtes',          30, 'accompagnement-pates.png'),
  ('Riz',            40, 'accompagnement-riz.png'),
  ('Purée',          50, 'accompagnement-puree.png')
) as v(nom, ordre, fichier)
where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'::uuid
  and lower(p.name) in (lower('Camaron grillé brasero'), lower('Rôti de porc provençale ou miel'))
  and not p.is_archived
  and g.name in ('Accompagnement (1 au choix, inclus)', '2e accompagnement (+5 000 Ar)')
  and not exists (
    select 1 from product_options o where o.group_id = g.id and o.name = v.nom
  );
