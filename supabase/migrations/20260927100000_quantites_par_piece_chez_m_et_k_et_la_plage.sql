-- Nombre de pièces par assiette, donné par les patrons sur WhatsApp (Kenny pour
-- Chez M&K le 25-26/09, La Plage le 26/09). On l'écrit dans la description : le
-- client sait ce qu'il commande, le restaurant n'a plus la question.
-- Non renseignés faute de réponse : van tan frit, rouleaux (M&K), brochettes de zébu (La Plage).

-- ---------------------------------------------------------------- Chez M&K
with r as (select id from public.restaurants where name = 'Chez M&K')
update public.products p set description = d.txt
from (values
  ('Assiette de friture',       '4 nems cocktail, 6 van tan frits, 6 demi-lunes frites.'),
  ('Assiette de nem cocktail',  '6 pièces.'),
  ('Nem porc ou poulet ou zébu','2 nems grand modèle.'),
  ('Bouchon porc ou poulet ou bœuf', '10 pièces.'),
  ('Croustillant de crevette',  '10 pièces.')
) as d(nom, txt), r
where p.restaurant_id = r.id and p.name = d.nom and not p.is_archived;

-- Le croustillant existe en crevette OU en calmar (Kenny) : même mécanique que
-- « Viande au choix » sur les nems et les bouchons.
update public.products set name = 'Croustillant de crevette ou de calmar'
 where restaurant_id = (select id from public.restaurants where name = 'Chez M&K')
   and name = 'Croustillant de crevette' and not is_archived;

insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select p.id, 'Garniture au choix', 1, 1, true, 10
  from public.products p
 where p.restaurant_id = (select id from public.restaurants where name = 'Chez M&K')
   and p.name = 'Croustillant de crevette ou de calmar' and not p.is_archived
   and not exists (select 1 from public.product_option_groups g where g.product_id = p.id);

insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, v.nom, 0, true, v.rang
  from public.product_option_groups g
  join public.products p on p.id = g.product_id
  cross join (values ('Crevette', 10), ('Calmar', 20)) as v(nom, rang)
 where p.restaurant_id = (select id from public.restaurants where name = 'Chez M&K')
   and p.name = 'Croustillant de crevette ou de calmar' and g.name = 'Garniture au choix'
   and not exists (select 1 from public.product_options o where o.group_id = g.id);

-- ---------------------------------------------------------------- La Plage
with r as (select id from public.restaurants where name = 'La Plage')
update public.products p set description = d.txt
from (values
  ('Beignets de crevettes',  'Une dizaine de pièces.'),
  ('Beignets de calamars',   'Une dizaine de pièces.'),
  ('Beignets de poisson',    'Une dizaine de pièces.'),
  ('Brochettes de thazard',  '2 brochettes.'),
  ('Brochettes de poulet',   '2 brochettes.'),
  ('Brochettes de crevettes','2 brochettes.')
) as d(nom, txt), r
where p.restaurant_id = r.id and p.name = d.nom and not p.is_archived;
