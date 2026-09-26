-- Les garnitures du plat du jour — demande du 26/09/2026.
--
-- 1) Le demi-poulet grillé BBQ de Chez Bidul & Truc n'avait aucun accompagnement,
--    contrairement à tous les autres plats du jour de la maison.
-- 2) Deux RPC pour que le restaurateur n'ait plus jamais à nous le demander : au
--    moment où il met un plat à l'affiche, l'app lui propose ses accompagnements
--    et ses sauces EXISTANTS, il coche, et le client les voit à la commande.
--
-- ⚠️ Le classement accompagnement / sauce se lit dans le NOM du groupe d'options
-- (« accompagnement », « sauce »). C'est la convention déjà en place chez les
-- partenaires ; on s'y adosse plutôt que d'ajouter une colonne à maintenir. La
-- contrepartie : un groupe nommé autrement (suppléments pizza, cuisson…) reste
-- hors de cette fenêtre, et c'est voulu.

insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
select '7eb8aea7-7b49-40f3-a169-3ec0c9ba549e', 'Accompagnement (1 au choix, inclus)', 1, 1, true, 30
where not exists (
  select 1 from public.product_option_groups
   where product_id = '7eb8aea7-7b49-40f3-a169-3ec0c9ba549e'
     and name ilike '%accompagnement%'
);

insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
select g.id, v.nom, 0, true, v.rang
from public.product_option_groups g
cross join (values ('Frites',10),('Légumes sautés',20),('Pâtes',30),('Riz',40),
                   ('Purée',50),('Rougail tomate',60)) as v(nom, rang)
where g.product_id = '7eb8aea7-7b49-40f3-a169-3ec0c9ba549e'
  and g.name = 'Accompagnement (1 au choix, inclus)'
  and not exists (select 1 from public.product_options o where o.group_id = g.id);

-- La bibliothèque de garnitures du restaurant connecté, les plus utilisées en tête.
create or replace function public.restaurant_garnitures()
returns table (kind text, name text, usages integer)
language sql
security definer
set search_path to 'public'
as $$
  select case when g.name ilike '%sauce%' then 'sauce' else 'accompagnement' end as kind,
         o.name,
         count(distinct p.id)::int as usages
    from public.products p
    join public.product_option_groups g on g.product_id = p.id
    join public.product_options o on o.group_id = g.id
   where p.restaurant_id = public.current_restaurant_id()
     and not p.is_archived
     and (g.name ilike '%accompagnement%' or g.name ilike '%sauce%')
   group by 1, 2
   order by 1, 3 desc, 2;
$$;

revoke all on function public.restaurant_garnitures() from public;
grant execute on function public.restaurant_garnitures() to authenticated;

-- Poser les garnitures cochées sur un plat.
-- ⚠️ On REMPLACE les groupes d'accompagnement et de sauce du plat : c'est ce que le
-- restaurateur attend quand il re-coche. L'historique des commandes ne risque rien,
-- `order_item_options` garde un snapshot du nom et du prix, et sa clé passe à NULL.
-- Deux tableaux vides retirent les groupes : c'est « ce plat se sert seul ».
create or replace function public.set_product_garnitures(
  p_product_id uuid,
  p_accompagnements text[] default '{}',
  p_sauces text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_group_id uuid;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  if not exists (select 1 from public.products
                  where id = p_product_id and restaurant_id = v_resto_id and not is_archived) then
    raise exception 'Plat introuvable dans votre carte';
  end if;

  delete from public.product_option_groups
   where product_id = p_product_id
     and (name ilike '%accompagnement%' or name ilike '%sauce%');

  if coalesce(array_length(p_sauces, 1), 0) > 0 then
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (p_product_id, 'Sauce au choix', 1, 1, true, 10)
    returning id into v_group_id;

    insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
    select v_group_id, btrim(s.nom), 0, true, s.rang * 10
      from unnest(p_sauces) with ordinality as s(nom, rang)
     where btrim(coalesce(s.nom, '')) <> '';
  end if;

  if coalesce(array_length(p_accompagnements, 1), 0) > 0 then
    insert into public.product_option_groups (product_id, name, min_select, max_select, required, sort_order)
    values (p_product_id, 'Accompagnement (1 au choix, inclus)', 1, 1, true, 30)
    returning id into v_group_id;

    insert into public.product_options (group_id, name, price_delta, is_available, sort_order)
    select v_group_id, btrim(a.nom), 0, true, a.rang * 10
      from unnest(p_accompagnements) with ordinality as a(nom, rang)
     where btrim(coalesce(a.nom, '')) <> '';
  end if;
end;
$$;

revoke all on function public.set_product_garnitures(uuid, text[], text[]) from public;
grant execute on function public.set_product_garnitures(uuid, text[], text[]) to authenticated;
