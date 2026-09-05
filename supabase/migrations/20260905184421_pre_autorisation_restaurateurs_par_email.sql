-- PRE-AUTORISER UN RESTAURATEUR PAR SON ADRESSE E-MAIL.
--
-- Le probleme concret : on connait l'adresse du restaurateur AVANT qu'il ait un
-- compte. Jusqu'ici il fallait attendre qu'il s'inscrive, qu'il demande le role
-- « restaurant », puis qu'un administrateur l'approuve a la main. Trois etapes,
-- dont deux qui dependent de quelqu'un d'autre au mauvais moment — et pendant
-- lesquelles le restaurateur voit un espace client, se demande s'il s'est
-- trompe, et appelle.
--
-- Desormais : on inscrit l'adresse ici, et au moment ou cette personne cree son
-- compte, le rattachement se fait TOUT SEUL. Elle ouvre l'app et se trouve
-- directement dans l'espace de son restaurant.
--
-- ⚠️ L'adresse est normalisee en minuscules : « Murechoco@Gmail.com » et
-- « murechoco@gmail.com » sont la meme personne, et Supabase n'harmonise pas.
--
-- ⚠️ Une invitation ne DONNE PAS acces a l'inscription : elle ne fait que
-- pre-affecter un role a une adresse. Quelqu'un qui s'inscrirait avec cette
-- adresse sans y avoir droit devrait d'abord controler la boite mail — auquel
-- cas le probleme est ailleurs.

create table if not exists public.restaurant_invitations (
  email         text primary key,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  invitee_par   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  utilisee_le   timestamptz,
  utilisee_par  uuid references auth.users(id)
);

comment on table public.restaurant_invitations is
  'Adresses pre-autorisees comme personnel restaurant. Au premier compte cree avec cette adresse, le role et le rattachement sont poses automatiquement.';

alter table public.restaurant_invitations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='restaurant_invitations' and policyname='invitations_admin') then
    create policy "invitations_admin" on public.restaurant_invitations
      for select using (public.is_admin());
  end if;
end $$;
-- Aucune policy d'ecriture : tout passe par les RPC ci-dessous.

------------------------------------------------------------------ Le raccord
create or replace function public.appliquer_invitation_restaurant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv public.restaurant_invitations;
begin
  if new.email is null then return new; end if;

  select * into v_inv from public.restaurant_invitations
   where email = lower(btrim(new.email)) and utilisee_le is null;
  if v_inv.email is null then return new; end if;

  -- Role restaurant, directement ACTIF : l'invitation vaut approbation, c'est
  -- tout son interet.
  insert into public.user_roles (user_id, role, status, activated_at)
  values (new.id, 'restaurant', 'active', now())
  on conflict (user_id, role) do update
    set status = 'active', activated_at = coalesce(public.user_roles.activated_at, now());

  insert into public.restaurant_staff (user_id, restaurant_id)
  values (new.id, v_inv.restaurant_id)
  on conflict do nothing;

  update public.restaurant_invitations
     set utilisee_le = now(), utilisee_par = new.id
   where email = v_inv.email;

  return new;
end $$;

drop trigger if exists on_auth_user_invitation on auth.users;
create trigger on_auth_user_invitation
  after insert on auth.users
  for each row execute function public.appliquer_invitation_restaurant();

------------------------------------------------------------ Pose et retrait
create or replace function public.inviter_restaurateur(p_email text, p_restaurant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_nom text;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  select name into v_nom from public.restaurants where id = p_restaurant_id;
  if v_nom is null then raise exception 'Restaurant introuvable'; end if;

  insert into public.restaurant_invitations (email, restaurant_id, invitee_par)
  values (lower(btrim(p_email)), p_restaurant_id, auth.uid())
  on conflict (email) do update
    set restaurant_id = excluded.restaurant_id, invitee_par = excluded.invitee_par,
        created_at = now(), utilisee_le = null, utilisee_par = null;

  -- Si la personne a DEJA un compte, on n'attend pas une hypothetique nouvelle
  -- inscription qui n'arrivera jamais : on applique tout de suite.
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is not null then
    insert into public.user_roles (user_id, role, status, activated_at)
    values (v_uid, 'restaurant', 'active', now())
    on conflict (user_id, role) do update set status='active',
      activated_at = coalesce(public.user_roles.activated_at, now());
    insert into public.restaurant_staff (user_id, restaurant_id)
    values (v_uid, p_restaurant_id) on conflict do nothing;
    update public.restaurant_invitations set utilisee_le = now(), utilisee_par = v_uid
     where email = lower(btrim(p_email));
    return jsonb_build_object('ok', true, 'applique', 'immediatement',
      'restaurant', v_nom, 'compte', p_email);
  end if;

  return jsonb_build_object('ok', true, 'applique', 'a la creation du compte',
    'restaurant', v_nom, 'compte', lower(btrim(p_email)));
end $$;

revoke execute on function public.inviter_restaurateur(text, uuid) from public, anon;
grant  execute on function public.inviter_restaurateur(text, uuid) to authenticated;
