-- 20260920100000_fermer_est_un_seul_geste.sql
-- Applique sur la base de production le 2026-09-20 via le connecteur MCP.
--
-- FERMER DOIT ETRE UN SEUL GESTE — cote admin aussi.
--
-- Le defaut, constate le 2026-09-20 : le patron de Chez Bidul & Truc a voulu
-- fermer son restaurant a midi depuis son espace, et il est reste OUVERT pour
-- ses clients. `ouvert_maintenant(r)` vaut `is_open` quand `auto_open` est
-- faux, et l'horaire du jour sinon : tant que l'ouverture automatique est
-- allumee, ecrire `is_open` ne change RIEN a ce que voit le client.
--
-- La RPC du restaurateur, `set_restaurant_open(boolean)`, faisait deja les
-- deux ecritures (`is_open` ET `auto_open = false`) : elle est saine, seul
-- l'ecran la cachait. La RPC de l'administrateur, elle, ne touchait QUE
-- `is_open` : sur un restaurant en ouverture automatique (La Cabane, La Plage,
-- Chez Bidul jusqu'a ce matin), le bouton « Fermer » de l'admin ecrivait en
-- base et **rien ne changeait a l'ecran du client**. Meme piege, autre surface.
--
-- Ce que change cette migration :
--
-- 1. `admin_set_restaurant_open(uuid, boolean)` coupe desormais `auto_open`
--    DANS LES DEUX SENS.
--    ⚠️ Pourquoi aussi a la reouverture : rouvrir en laissant `auto_open` a
--    vrai redonnerait exactement le bouton inerte qu'on corrige — l'admin
--    cliquerait « Ouvrir », la base dirait `is_open = true`, et l'horaire du
--    jour maintiendrait le restaurant ferme. Un geste d'administrateur est une
--    decision manuelle : elle prend la main, et elle la garde.
--    Corollaire assume : apres une fermeture ou une reouverture par l'admin,
--    les horaires ne reprennent JAMAIS la main tout seuls. C'est le
--    comportement prudent (on ne rouvre pas un restaurant dans son dos), et
--    c'est pour cela que le retour a l'automatique est une action a part.
--
-- 2. Nouvelle RPC `admin_set_restaurant_auto_open(uuid, boolean)` : rendre la
--    main aux horaires, explicitement. Elle n'ecrit pas `is_open` — l'ouverture
--    redevient le resultat du calcul.
--
-- Les deux tracent dans `admin_actions`, avec les DEUX colonnes dans `avant` /
-- `apres` (« is_open=t auto_open=t ») : sans `auto_open`, la trace d'une
-- fermeture sans effet etait indiscernable d'une fermeture reelle.

create or replace function public.admin_set_restaurant_open(
  p_restaurant_id uuid,
  p_is_open boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_avant_open boolean;
  v_avant_auto boolean;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;

  select is_open, auto_open into v_avant_open, v_avant_auto
    from public.restaurants where id = p_restaurant_id;
  if v_avant_open is null then raise exception 'Restaurant introuvable'; end if;

  -- ⚠️ `auto_open = false` dans les deux sens : sans cela, sur un restaurant
  -- en ouverture automatique, cette fonction ecrit une colonne que
  -- `ouvert_maintenant()` ne regarde meme pas.
  update public.restaurants
     set is_open = p_is_open,
         auto_open = false
   where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (
    auth.uid(),
    'ouverture_restaurant',
    p_restaurant_id,
    format('is_open=%s auto_open=%s', v_avant_open, v_avant_auto),
    format('is_open=%s auto_open=false', p_is_open)
  );
end $function$;

comment on function public.admin_set_restaurant_open(uuid, boolean) is
  'Ouvre ou ferme un restaurant a la main, depuis l''admin. Coupe l''ouverture '
  'automatique dans les deux sens : sinon l''ecriture de is_open resterait sans '
  'effet sur ouvert_maintenant(). Le retour aux horaires se fait par '
  'admin_set_restaurant_auto_open().';

create or replace function public.admin_set_restaurant_auto_open(
  p_restaurant_id uuid,
  p_auto_open boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_avant_open boolean;
  v_avant_auto boolean;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;

  select is_open, auto_open into v_avant_open, v_avant_auto
    from public.restaurants where id = p_restaurant_id;
  if v_avant_open is null then raise exception 'Restaurant introuvable'; end if;

  -- On n'ecrit PAS is_open : en automatique il ne sert plus a rien, et le
  -- reecrire ferait croire a un etat qui n'est plus lu.
  update public.restaurants
     set auto_open = p_auto_open
   where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (
    auth.uid(),
    'ouverture_automatique_restaurant',
    p_restaurant_id,
    format('is_open=%s auto_open=%s', v_avant_open, v_avant_auto),
    format('is_open=%s auto_open=%s', v_avant_open, p_auto_open)
  );
end $function$;

comment on function public.admin_set_restaurant_auto_open(uuid, boolean) is
  'Rend (ou retire) la main aux horaires du restaurant, depuis l''admin. '
  'Action distincte de admin_set_restaurant_open : rouvrir ne remet jamais '
  'l''automatique tout seul.';
