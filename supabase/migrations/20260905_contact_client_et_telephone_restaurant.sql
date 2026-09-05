-- CONTACT ENTRE LE CLIENT ET LE RESTAURANT
--
-- Constat de depart, verifie en base : le restaurateur ne voyait NI l'adresse de
-- livraison, NI la position GPS, NI le telephone du client. Le message
-- « Position GPS manquante » de son ecran etait donc TROMPEUR — la donnee
-- existait, mais la RLS la lui cachait (addresses : lecture reservee au
-- proprietaire et aux admins). Le livreur etait dans le meme cas. Le bouton
-- « appeler le client » etait deja code dans RestaurantOrderCard : il ne
-- s'affichait jamais parce que clientPhone valait toujours null.

-- 1. Telephone public du restaurant, saisi par le partenaire lui-meme.
alter table public.restaurants
  add column if not exists phone text;

create or replace function public.set_restaurant_phone(p_phone text)
returns public.restaurants
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_r public.restaurants;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  update public.restaurants
     set phone = nullif(btrim(coalesce(p_phone, '')), '')
   where id = v_resto_id
  returning * into v_r;
  return v_r;
end;
$$;

-- 2. L'adresse de livraison d'une commande devient lisible par le restaurant qui
--    doit la preparer et par le livreur qui l'a prise. Portee volontairement
--    ETROITE : uniquement les adresses rattachees a une de leurs commandes,
--    jamais le carnet d'adresses du client.
create policy "addresses_select_resto_ou_livreur_de_la_commande"
  on public.addresses for select
  using (
    exists (
      select 1 from public.orders o
      where o.address_id = addresses.id
        and (
          public.is_active_restaurant_staff_of(o.restaurant_id)
          or o.courier_id = auth.uid()
        )
    )
  );

-- 3. Meme logique pour le nom et le telephone du client : le restaurateur doit
--    pouvoir l'appeler en cas de rupture ou de probleme sur sa commande.
create policy "profiles_select_client_de_ma_commande"
  on public.profiles for select
  using (
    exists (
      select 1 from public.orders o
      where o.user_id = profiles.id
        and (
          public.is_active_restaurant_staff_of(o.restaurant_id)
          or o.courier_id = auth.uid()
        )
    )
  );

-- Cloisonnement verifie avec un vrai jeton de personnel Taxi Be : 2 adresses
-- visibles = les 2 adresses de ses propres commandes ; 3 profils visibles =
-- lui-meme + les 2 clients de ses commandes. Aucune fuite vers les autres
-- restaurants.
