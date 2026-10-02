-- Les Siciliens : chaque ingrédient de la composition d'une pizza devient un supplément
-- facultatif à +4 000 Ar (demande du porteur du projet, 2026-10-02). Même format que les
-- suppléments de leurs burgers : groupe « Suppléments », non obligatoire, 0 à N choix, nom
-- de l'ingrédient sans « + ». Le choix tazar/espadon de la pizza Poisson fumé reste son
-- propre groupe ; son supplément s'appelle simplement « Poisson fumé ».
-- Idempotent : une pizza qui a déjà un groupe « Suppléments » est sautée.
do $$
declare
  v_pid uuid;
  v_gid uuid;
  v_nom text;
  v_ingr text[];
  i int;
  v_ord int;
begin
  for v_nom, v_ingr in select * from (values
    ('Margherita', array['Tomate', 'Mozzarella', 'Basilic']),
    ('Focaccia', array['Mozzarella', 'Fromage râpé', 'Oignon', 'Olive noire']),
    ('Pomme de terre', array['Tomate', 'Mozzarella', 'Pommes de terre frites']),
    ('Marinara', array['Tomate', 'Mozzarella', 'Anchois', 'Olives noires']),
    ('Jambon italien', array['Tomate', 'Mozzarella', 'Jambon italien']),
    ('Jambon et champignons', array['Tomate', 'Mozzarella', 'Champignons', 'Jambon italien']),
    ('Champignon', array['Tomate', 'Mozzarella', 'Champignons']),
    ('Fruits de la mer', array['Tomate', 'Mozzarella', 'Crevettes', 'Calamars']),
    ('Poisson fumé', array['Tomate', 'Mozzarella', 'Poisson fumé']),
    ('Bolognese', array['Tomate', 'Mozzarella', 'Sauce bolognaise']),
    ('Poulet', array['Tomate', 'Mozzarella', 'Poulet', 'Sauce barbecue']),
    ('Salame (chorizo) italienne', array['Tomate', 'Mozzarella', 'Salame (chorizo) italien']),
    ('Vegetariana', array['Tomate', 'Mozzarella', 'Aubergine', 'Courgette']),
    ('4 fromages', array['Tomate', 'Mozzarella', 'Divers fromages', 'Gorgonzola']),
    ('Carbonara', array['Tomate', 'Mozzarella', 'Œuf', 'Fromage râpé', 'Bacon frit']),
    ('Les Siciliens', array['Tomate', 'Mozzarella', 'Anchois', 'Tomate en tranches', 'Oignon', 'Fromage râpé', 'Olive noire']),
    ('Jambon cru et parmesan', array['Tomate', 'Mozzarella', 'Jambon cru', 'Parmesan'])
  ) as t(nom, ingr) loop
    select p.id into v_pid from public.products p join public.categories c on c.id = p.category_id
     where p.restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b' and c.name = 'Pizza' and p.name = v_nom;
    if v_pid is null then raise exception 'pizza introuvable : %', v_nom; end if;
    if exists (select 1 from public.product_option_groups g where g.product_id = v_pid and g.name = 'Suppléments') then
      continue;
    end if;
    select coalesce(max(g.sort_order), 0) + 10 into v_ord from public.product_option_groups g where g.product_id = v_pid;
    insert into public.product_option_groups (product_id, name, required, min_select, max_select, sort_order)
    values (v_pid, 'Suppléments', false, 0, array_length(v_ingr, 1), v_ord)
    returning id into v_gid;
    for i in 1 .. array_length(v_ingr, 1) loop
      insert into public.product_options (group_id, name, price_delta, sort_order)
      values (v_gid, v_ingr[i], 4000, i * 10);
    end loop;
  end loop;
end $$;
