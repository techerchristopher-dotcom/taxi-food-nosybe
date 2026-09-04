-- ⚠️ PREMIERE APPROCHE, SUPERSEDEE LE MEME JOUR par
-- 20260905_produits_a_l_affiche_et_bibliotheque.sql — conservee ici uniquement
-- parce qu'elle a reellement ete appliquee en base (rejouer le dossier dans
-- l'ordre reproduit donc l'etat courant). Ne pas s'en inspirer :
--
--   Elle modelisait le plat du jour comme une CATEGORIE a part, et son retrait
--   comme une suppression. Le porteur du projet a fait remarquer qu'un plat
--   retire doit rester reutilisable — remis a l'affiche le lendemain sans tout
--   re-uploader — et que la mise en avant devrait valoir pour n'importe quel
--   produit (pizza du jour, plat de la semaine). D'ou la refonte : « a l'affiche »
--   est un ETAT d'un produit, pas un type de produit.
--
-- PLATS DU JOUR
-- Premiere fonctionnalite ou un partenaire CREE lui-meme un produit (jusqu'ici
-- tout etait saisi par nous). On reutilise products/categories plutot qu'une
-- table parallele : le panier, la commande et la fiche produit continuent de
-- fonctionner sans une ligne de code en plus.

alter table public.categories
  add column if not exists is_daily_special boolean not null default false;

alter table public.products
  add column if not exists stock_quantity integer,   -- null = pas de compteur (plat normal)
  -- Retirer un plat du jour ne peut pas etre une suppression dure : order_items
  -- reference products en NO ACTION, donc supprimer un plat deja commande
  -- echouerait et casserait l'historique. is_available ne convient pas non plus
  -- (il affiche « Bientot de retour » au client, ce qui est faux pour le plat
  -- d'hier qu'on retire definitivement). D'ou une vraie colonne d'archivage.
  add column if not exists is_archived boolean not null default false;

alter table public.products
  add constraint products_stock_quantity_positif check (stock_quantity is null or stock_quantity >= 0);

-- Un seul « Plats du jour » par restaurant.
create unique index if not exists categories_un_seul_plat_du_jour
  on public.categories (restaurant_id) where is_daily_special;

create or replace function public.create_daily_special(
  p_name text,
  p_description text,
  p_price integer,
  p_stock_quantity integer,
  p_photo_url text
) returns public.products
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_cat_id uuid;
  v_p public.products;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Donnez un nom a votre plat du jour';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'Le prix doit etre superieur a zero';
  end if;

  -- La categorie « Plats du jour » est creee a la volee, au premier plat ajoute.
  select id into v_cat_id from public.categories
   where restaurant_id = v_resto_id and is_daily_special;

  if v_cat_id is null then
    insert into public.categories (restaurant_id, name, icon, sort_order, is_active, is_daily_special)
    values (v_resto_id, 'Plats du jour', '🔥', -10, true, true)
    returning id into v_cat_id;
  else
    -- Reactivee si le restaurant avait tout retire un jour.
    update public.categories set is_active = true where id = v_cat_id and not is_active;
  end if;

  insert into public.products
    (restaurant_id, category_id, name, description, price, photo_url, is_available, stock_quantity)
  values
    (v_resto_id, v_cat_id, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
     p_price, nullif(btrim(coalesce(p_photo_url, '')), ''), true, p_stock_quantity)
  returning * into v_p;

  return v_p;
end;
$$;

create or replace function public.update_daily_special(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_price integer,
  p_stock_quantity integer,
  p_photo_url text
) returns public.products
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
  if p_price is null or p_price <= 0 then
    raise exception 'Le prix doit etre superieur a zero';
  end if;

  update public.products p
     set name = btrim(p_name),
         description = nullif(btrim(coalesce(p_description, '')), ''),
         price = p_price,
         stock_quantity = p_stock_quantity,
         photo_url = coalesce(nullif(btrim(coalesce(p_photo_url, '')), ''), p.photo_url)
   where p.id = p_product_id and p.restaurant_id = v_resto_id and not p.is_archived
  returning * into v_p;

  if v_p.id is null then
    raise exception 'Plat du jour introuvable dans votre carte';
  end if;
  return v_p;
end;
$$;

-- Ajustement rapide de la quantite restante (le restaurateur decremente a la main).
create or replace function public.set_product_stock(p_product_id uuid, p_stock integer)
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
  if p_stock is not null and p_stock < 0 then
    raise exception 'La quantite ne peut pas etre negative';
  end if;

  update public.products
     set stock_quantity = p_stock,
         -- A zero, le plat n'est plus commandable : coherent avec l'affichage grise.
         is_available = case when p_stock = 0 then false else is_available end
   where id = p_product_id and restaurant_id = v_resto_id and not is_archived
  returning * into v_p;

  if v_p.id is null then
    raise exception 'Produit introuvable dans votre carte';
  end if;
  return v_p;
end;
$$;

create or replace function public.delete_daily_special(p_product_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_deja_commande boolean;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;

  if not exists (select 1 from public.products
                  where id = p_product_id and restaurant_id = v_resto_id) then
    raise exception 'Plat du jour introuvable dans votre carte';
  end if;

  select exists (select 1 from public.order_items where product_id = p_product_id)
    into v_deja_commande;

  if v_deja_commande then
    -- Deja commande : on archive pour ne pas casser l'historique des commandes.
    update public.products set is_archived = true, is_available = false
     where id = p_product_id;
    return 'archive';
  end if;

  delete from public.products where id = p_product_id;
  return 'supprime';
end;
$$;
