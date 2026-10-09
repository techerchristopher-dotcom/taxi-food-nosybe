-- Plat à l'affiche : case « Contient du porc », et le nom d'un plat de la carte ne se réécrit plus
-- — 2026-10-09.
--
-- Origine : le patron du Nandipo a fait « Modifier » sur son plat du jour « Rougail saucisse »
-- (plat de sa carte, tagué porc) et l'a réécrit en « Zebu bourguignon ». La RPC met à jour la
-- même ligne : le bourguignon a hérité du badge porc, et le rougail a disparu de sa carte.
--
-- 1. `p_contient_porc` : null = ne touche pas aux repères (les versions installées de l'app ne
--    l'envoient pas : elles ne doivent JAMAIS effacer un badge posé) ; true / false pose ou
--    retire 'porc' sans toucher aux autres valeurs de `diet_tags`.
-- 2. Un plat de la carte permanente (`in_menu`) garde son nom : on peut ajuster son prix, sa
--    photo, sa description, pas en faire un autre plat. Imposé ici, pas seulement à l'écran,
--    pour couvrir aussi les versions déjà installées.
--
-- ⚠️ On SUPPRIME l'ancienne signature à 7 arguments : la garder ferait deux candidates pour un
-- appel à 7 arguments nommés, et PostgREST refuserait l'appel (ambiguïté). Les anciennes
-- versions de l'app tombent sur la nouvelle grâce à la valeur par défaut.

drop function if exists public.save_featured_product(uuid, text, text, integer, integer, text, text);

create or replace function public.save_featured_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_price integer,
  p_stock_quantity integer,
  p_photo_url text,
  p_featured_label text,
  p_contient_porc boolean default null
)
returns public.products
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_p public.products;
  v_avant public.products;
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
       is_available, stock_quantity, is_featured, featured_label, in_menu, diet_tags)
    values
      (v_resto_id, null, btrim(p_name), nullif(btrim(coalesce(p_description, '')), ''),
       p_price, nullif(btrim(coalesce(p_photo_url, '')), ''),
       true, p_stock_quantity, true,
       nullif(btrim(coalesce(p_featured_label, '')), ''), false,
       case when p_contient_porc then array['porc'] else '{}'::text[] end)
    returning * into v_p;
  else
    select * into v_avant from public.products p
     where p.id = p_product_id and p.restaurant_id = v_resto_id and not p.is_archived;
    if v_avant.id is null then
      raise exception 'Plat introuvable dans votre carte';
    end if;
    if v_avant.in_menu and btrim(p_name) <> v_avant.name then
      raise exception 'Ce plat fait partie de votre carte : son nom ne se change pas ici. Pour un autre plat, utilisez « Ajouter un plat à l''affiche ».';
    end if;

    update public.products p
       set name = btrim(p_name),
           description = nullif(btrim(coalesce(p_description, '')), ''),
           price = p_price,
           stock_quantity = p_stock_quantity,
           -- une photo vide ne doit pas effacer celle deja en place : c'est tout
           -- l'interet de la bibliotheque (on remet a l'affiche sans re-uploader).
           photo_url = coalesce(nullif(btrim(coalesce(p_photo_url, '')), ''), p.photo_url),
           featured_label = nullif(btrim(coalesce(p_featured_label, '')), ''),
           diet_tags = case
             when p_contient_porc is null then p.diet_tags
             when p_contient_porc then
               case when 'porc' = any(coalesce(p.diet_tags, '{}'))
                    then p.diet_tags
                    else array_append(coalesce(p.diet_tags, '{}'), 'porc') end
             else array_remove(coalesce(p.diet_tags, '{}'), 'porc')
           end,
           is_featured = true,
           is_available = true
     where p.id = p_product_id
    returning * into v_p;
  end if;

  return v_p;
end;
$function$;
