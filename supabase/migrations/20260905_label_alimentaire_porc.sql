-- LABELS ALIMENTAIRES
-- A Nosy Be une part importante de la clientele ne mange pas de porc : la
-- composition en toutes lettres ne suffit pas, il faut un repere visible sans
-- ouvrir la fiche. Colonne volontairement generique (tableau de libelles) pour
-- accueillir plus tard « piquant », « vegetarien », etc. sans nouvelle migration.
alter table public.products
  add column if not exists diet_tags text[] not null default '{}';

create index if not exists products_diet_tags on public.products using gin (diet_tags);

-- On ne tague QUE ce qui est explicite dans la carte du restaurant.
-- /!\ Ne jamais deduire : les pizzas d'Angelo et de Taxi Be sont au jambon
-- DE VOLAILLE, les taguer porc serait un contresens qui couterait des clients.
-- Restent volontairement NON tagues faute de certitude, a confirmer avec le
-- restaurateur : croque-monsieur, croque-madame, cordon bleu, pates carbonara,
-- terrine de campagne — la carte ne precise pas la nature du jambon/lardon.
update public.products p
   set diet_tags = array['porc']
 where not ('porc' = any(p.diet_tags))
   and (
     p.description ilike '%jambon de porc%'
     or p.description ilike '%lardon%'
     or p.description ilike '%bacon%'
     or p.name ilike '%porc%'
   );

-- Le partenaire corrige lui-meme depuis son espace : lui seul connait la recette
-- exacte des plats dont la carte ne precise rien.
create or replace function public.set_product_diet_tags(p_product_id uuid, p_tags text[])
returns public.products
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_p public.products;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  update public.products
     set diet_tags = coalesce(p_tags, '{}')
   where id = p_product_id and restaurant_id = v_resto_id
  returning * into v_p;
  if v_p.id is null then
    raise exception 'Produit introuvable dans votre carte';
  end if;
  return v_p;
end;
$$;
