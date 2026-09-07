-- Le restaurateur peut enfin RANGER sa carte.
--
-- La migration precedente (20260907200000) a pose `products.sort_order` et fige
-- l'ordre : la carte ne se reordonne plus toute seule. Mais elle n'a donne a
-- personne le moyen de CHOISIR cet ordre. Le restaurateur qui veut remonter sa
-- specialite en tete de categorie ne peut toujours rien faire : l'ordre est
-- fige, simplement, et fige sur une disposition deja brassee par les
-- modifications passees.
--
-- CORRECTIF. Une RPC minuscule — un plat, un rang — appelee par l'ecran
-- Reglages a chaque tap sur « monter » / « descendre ». C'est l'ecran qui
-- calcule les rangs ; la base, elle, ne fait que verifier que celui qui ecrit
-- a bien le droit d'ecrire dans CETTE carte.
--
-- ⚠️ La garde porte sur le restaurant DU PRODUIT (`is_active_restaurant_staff_of`),
-- pas sur un restaurant devine du cote de l'appelant : sans cela, n'importe quel
-- compte restaurateur authentifie pourrait reordonner la carte du voisin.
--
-- Aucune contrainte d'unicite sur `sort_order` : deux plats peuvent porter le
-- meme rang le temps d'un echange, et `getMenu` departage les egalites par nom.
-- Un echange de rangs se fait donc en deux appels, sans etat intermediaire
-- invalide.

create or replace function public.set_product_sort_order(
  p_product_id uuid,
  p_sort_order integer
) returns public.products
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid;
  v_p public.products;
begin
  select restaurant_id into v_resto_id
    from public.products
   where id = p_product_id and not is_archived;

  if v_resto_id is null or not public.is_active_restaurant_staff_of(v_resto_id) then
    raise exception 'Produit introuvable dans votre carte';
  end if;

  if p_sort_order is null then
    raise exception 'Le rang est obligatoire';
  end if;

  update public.products
     set sort_order = p_sort_order
   where id = p_product_id and restaurant_id = v_resto_id and not is_archived
  returning * into v_p;

  if v_p.id is null then
    raise exception 'Produit introuvable dans votre carte';
  end if;
  return v_p;
end;
$$;

comment on function public.set_product_sort_order(uuid, integer) is
  'Pose le rang d''un plat dans sa categorie. Appelee deux fois par l''ecran Reglages pour echanger un plat avec son voisin.';
