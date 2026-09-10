-- Les milkshakes de La Cabane s'annoncent : visibles, non commandables, et le mot juste.
--
-- CE QUE CE CHAMP N'EST PAS. `listing_status` ne coupe RIEN. La commande reste
-- coupée par `is_available`, et par lui seul — c'est déjà le cas dans les écrans
-- (`ProductRow`, le carrousel « à l'affiche ») et c'est le comportement voulu :
-- ligne grisée, pas de bouton d'ajout. Ce champ ne porte QUE le libellé du badge.
-- Le séparer de la mécanique est délibéré : mélanger « ce qu'on affiche » et
-- « ce qu'on autorise » est exactement ce qui a produit la faille du 2026-09-09,
-- où `listing_status` d'un restaurant n'était lu par aucune garde.
--
-- POURQUOI IL FAUT UN MOT DIFFERENT. Le badge affichait `restaurantCard.unavailable`,
-- soit « Bientôt de retour » — qui raconte une rupture de stock, un plat qui REVIENT.
-- Les milkshakes n'ont jamais été servis : ils s'annoncent. D'où « Bientôt disponible »,
-- clé `restaurantCard.comingSoon`, DEJA traduite dans les trois langues et déjà utilisée
-- au niveau du restaurant (`restaurants.listing_status`). On descend le même vocabulaire
-- au produit plutôt que d'en inventer un deuxième.
--
-- ⚠️ L'ETAT DE DEPART ETAIT INCOHERENT, personne ne l'avait posé exprès :
-- `is_available` valait false pour Vanille et Spéculoos, true pour les six autres.
-- On aligne les huit.

alter table products
  add column if not exists listing_status text not null default 'visible'
  check (listing_status in ('visible', 'coming_soon'));

comment on column products.listing_status is
  'visible = plat normal. coming_soon = annonce : le plat se voit mais ne se commande pas, '
  'et le badge dit « Bientôt disponible » au lieu de « Bientôt de retour ». '
  'La commande reste coupée par is_available — ce champ ne porte que le mot.';

-- Cadré par nom de restaurant ET de catégorie : aucun autre établissement n'est touché.
with r as (select id from restaurants where name = 'La Cabane'),
     c as (select id from categories where restaurant_id = (select id from r) and name = 'Milkshakes')
update products
   set is_available  = false,
       listing_status = 'coming_soon'
 where restaurant_id = (select id from r)
   and category_id  = (select id from c);

-- Ni les prix (15 000 Fraise/Vanille/Chocolat, 20 000 les cinq autres), ni `in_menu`
-- (true : c'est ce qui les garde dans la carte), ni `is_archived` (false), ni
-- `is_featured` (false : huit milkshakes dans le carrousel noieraient les vrais plats
-- du jour) ne sont touchés. L'annonce se fait sur les réseaux, pas en écrasant la carte.

-- ---------------------------------------------------------------------------
-- Que le restaurateur puisse lever l'annonce TOUT SEUL, le jour du lancement.
-- ---------------------------------------------------------------------------

create or replace function public.set_product_available(p_product_id uuid, p_available boolean)
 returns products language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_p public.products;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  -- ⚠️ Rendre un plat disponible MET FIN A SON ANNONCE. Sans cette ligne, le
  -- restaurateur bascule son interrupteur, le plat reste gris avec « Bientot
  -- disponible », et il cherche un second reglage qui n'existe nulle part chez lui.
  -- L'inverse n'est PAS vrai : couper la disponibilite ne remet pas en annonce —
  -- une rupture de stock n'est pas un lancement.
  update public.products
     set is_available   = p_available,
         listing_status = case when p_available then 'visible' else listing_status end
   where id = p_product_id and restaurant_id = v_resto_id
  returning * into v_p;
  if v_p.id is null then
    raise exception 'Produit introuvable dans votre carte';
  end if;
  return v_p;
end;
$function$;

-- Cote admin, le choix explicite visible / coming_soon.
create or replace function public.admin_upsert_product(
  p_id uuid, p_restaurant_id uuid, p_category_id uuid, p_name text, p_description text,
  p_price integer, p_photo_url text, p_is_available boolean,
  p_listing_status text default null)
 returns products language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_row public.products;
  -- ⚠️ `default null` = « ne touche pas ». Un appelant qui ignore ce parametre —
  -- l'ancien front admin, un script — ne doit jamais remettre un plat annonce en
  -- visible par omission. Le null se distingue d'un choix explicite.
  v_statut text := nullif(btrim(coalesce(p_listing_status, '')), '');
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  if p_price is null or p_price < 0 then raise exception 'Prix invalide'; end if;
  if v_statut is not null and v_statut not in ('visible','coming_soon') then
    raise exception 'Statut d''affichage invalide';
  end if;
  if p_id is null then
    insert into public.products (restaurant_id, category_id, name, description, price, photo_url, is_available, listing_status)
    values (p_restaurant_id, p_category_id, btrim(p_name), nullif(btrim(coalesce(p_description,'')),''),
            p_price, nullif(btrim(coalesce(p_photo_url,'')),''),
            case when v_statut = 'coming_soon' then false else coalesce(p_is_available,true) end,
            coalesce(v_statut,'visible'))
    returning * into v_row;
  else
    update public.products set
      category_id = p_category_id, name = btrim(p_name),
      description = nullif(btrim(coalesce(p_description,'')),''), price = p_price,
      photo_url = nullif(btrim(coalesce(p_photo_url,'')),''),
      is_available = case when v_statut = 'coming_soon' then false else coalesce(p_is_available,true) end,
      listing_status = coalesce(v_statut, listing_status)
    where id = p_id returning * into v_row;
    if v_row.id is null then raise exception 'Produit introuvable'; end if;
  end if;
  return v_row;
end; $function$;
