-- Un compte rattaché à PLUSIEURS restaurants choisit celui qu'il pilote (2026-10-14).
--
-- Déclencheur : le porteur du projet gère lui-même les commandes de L'escale Créole (le
-- Telegram du gérant ne fonctionne pas) alors que son compte est déjà rattaché à La Cabane.
--
-- ⚠️ Treize RPC de l'espace restaurateur (set_restaurant_open, set_restaurant_week_hours,
-- set_product_available, save_featured_product…) trouvent LEUR restaurant par
-- current_restaurant_id(), qui faisait `limit 1` SANS tri : avec deux rattachements, le
-- restaurant modifié était imprévisible. Plutôt que d'ajouter un paramètre à ces treize
-- fonctions (surcharges → PGRST203, et apps installées qui ne le passeraient pas), le choix
-- est MÉMORISÉ côté base (profiles.restaurant_actif) et current_restaurant_id() le suit.
-- Un compte à un seul restaurant ne voit aucune différence.

alter table public.profiles
  add column if not exists restaurant_actif uuid references public.restaurants(id) on delete set null;

comment on column public.profiles.restaurant_actif is
  'Restaurant piloté par un compte rattaché à plusieurs restaurants. Lu par current_restaurant_id() ; ignoré si le compte n''en est plus le staff actif.';

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable security definer
set search_path to 'public'
as $function$
  select rs.restaurant_id
  from public.restaurant_staff rs
  join public.user_roles ur
    on ur.user_id = rs.user_id and ur.role = 'restaurant' and ur.status = 'active'
  left join public.profiles p on p.id = rs.user_id
  where rs.user_id = auth.uid()
  -- Le restaurant choisi d'abord, sinon le plus ancien rattachement : plus jamais au hasard.
  order by (rs.restaurant_id is not distinct from p.restaurant_actif) desc, rs.created_at, rs.id
  limit 1;
$function$;

create or replace function public.choisir_restaurant_actif(p_restaurant_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if not public.is_active_restaurant_staff_of(p_restaurant_id) then
    raise exception 'Restaurant non rattache a ce compte' using errcode = '42501';
  end if;
  update public.profiles set restaurant_actif = p_restaurant_id where id = auth.uid();
  return public.current_restaurant_id();
end;
$function$;

revoke all on function public.choisir_restaurant_actif(uuid) from public;
revoke all on function public.choisir_restaurant_actif(uuid) from anon;
grant execute on function public.choisir_restaurant_actif(uuid) to authenticated;

-- Le porteur du projet pilote aussi L'escale Créole (il garde La Cabane).
do $$
declare
  v_user uuid;
  n int;
begin
  select id into v_user from auth.users where email = 'techerchristopher@gmail.com';
  if v_user is null then raise exception 'compte porteur introuvable'; end if;
  insert into public.restaurant_staff (user_id, restaurant_id)
  values (v_user, '128e68ab-8e64-4f48-bf79-acc67f3deca9')
  on conflict (user_id, restaurant_id) do nothing;
  select count(*) into n from public.restaurant_staff where user_id = v_user;
  if n <> 2 then raise exception 'rattachements attendus 2, trouves %', n; end if;
end $$;
