-- MISE A L'AFFICHE (remplace l'approche « categorie plats du jour » posee plus tot
-- le meme jour, jamais utilisee en production).
--
-- Idee directrice : « a l'affiche » est un ETAT d'un produit, pas un type de produit.
-- Consequences :
--   * un plat du jour retire n'est PAS supprime : il retombe dans la bibliotheque du
--     restaurant, pret a etre remis a l'affiche en un tap, deja rempli (photo,
--     description, prix) — plus besoin de tout re-uploader chaque semaine ;
--   * n'importe quel produit de la carte permanente peut aussi etre mis en avant
--     (pizza du jour, suggestion du chef, plat de la semaine), avec un libelle libre.

-- On defait la premiere approche.
drop function if exists public.create_daily_special(text, text, integer, integer, text);
drop function if exists public.update_daily_special(uuid, text, text, integer, integer, text);
drop function if exists public.delete_daily_special(uuid);
drop index if exists public.categories_un_seul_plat_du_jour;
alter table public.categories drop column if exists is_daily_special;

alter table public.products
  -- « a l'affiche en ce moment »
  add column if not exists is_featured boolean not null default false,
  -- libelle libre du bandeau : « Plat du jour », « Pizza de la semaine »...
  add column if not exists featured_label text,
  -- false = creation du partenaire qui ne vit QUE quand elle est a l'affiche
  -- (elle reste en bibliotheque le reste du temps, invisible du client).
  add column if not exists in_menu boolean not null default true;

create index if not exists products_a_l_affiche
  on public.products (restaurant_id) where is_featured and not is_archived;

-- Cree ou met a jour une creation « a l'affiche » (hors carte permanente).
-- p_product_id null = creation ; sinon mise a jour de la fiche existante.
create or replace function public.save_featured_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_price integer,
  p_stock_quantity integer,
  p_photo_url text,
  p_featured_label text
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
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Donnez un nom a votre plat';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'Le prix doit etre superieur a zero';
  end if;

  if p_product_id is null then
    insert into public.products
      (restaurant_id, category_id, name, description, price, photo_url,
       is_available, stock_quantity, is_featured, featured_label, in_menu)
    values
      (v_resto_id, null, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
       p_price, nullif(btrim(coalesce(p_photo_url, '')), ''),
       true, p_stock_quantity, true,
       nullif(btrim(coalesce(p_featured_label, '')), ''), false)
    returning * into v_p;
  else
    update public.products p
       set name = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           price = p_price,
           stock_quantity = p_stock_quantity,
           -- une photo vide ne doit pas effacer celle deja en place : c'est tout
           -- l'interet de la bibliotheque (on remet a l'affiche sans re-uploader).
           photo_url = coalesce(nullif(btrim(coalesce(p_photo_url, '')), ''), p.photo_url),
           featured_label = nullif(btrim(coalesce(p_featured_label, '')), ''),
           is_featured = true,
           is_available = true
     where p.id = p_product_id and p.restaurant_id = v_resto_id and not p.is_archived
    returning * into v_p;

    if v_p.id is null then
      raise exception 'Plat introuvable dans votre carte';
    end if;
  end if;

  return v_p;
end;
$$;

-- Met a l'affiche / retire n'importe quel produit du restaurant, y compris un
-- produit de la carte permanente (pizza du jour, suggestion du chef...).
create or replace function public.set_product_featured(
  p_product_id uuid,
  p_featured boolean,
  p_featured_label text default null
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

  update public.products
     set is_featured = p_featured,
         featured_label = case
           when p_featured then nullif(btrim(coalesce(p_featured_label, '')), '')
           else featured_label   -- conserve pour la prochaine mise a l'affiche
         end
   where id = p_product_id and restaurant_id = v_resto_id and not is_archived
  returning * into v_p;

  if v_p.id is null then
    raise exception 'Produit introuvable dans votre carte';
  end if;
  return v_p;
end;
$$;

-- Retrait DEFINITIF de la bibliotheque (le retrait de l'affiche, lui, passe par
-- set_product_featured(false) et garde la fiche reutilisable).
create or replace function public.archive_product(p_product_id uuid)
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
    raise exception 'Produit introuvable dans votre carte';
  end if;

  select exists (select 1 from public.order_items where product_id = p_product_id)
    into v_deja_commande;

  if v_deja_commande then
    -- order_items reference products en NO ACTION : supprimer casserait
    -- l'historique des commandes. On archive.
    update public.products
       set is_archived = true, is_available = false, is_featured = false
     where id = p_product_id;
    return 'archive';
  end if;

  delete from public.products where id = p_product_id;
  return 'supprime';
end;
$$;
