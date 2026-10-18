-- Suivi des annonces : qui a OUVERT une notification d'annonce, qui a VU la fenêtre
-- « pourquoi étions-nous fermés », et quelle version il a choisie (2026-10-18).
--
-- Demande du porteur du projet : « savoir ensuite qui a cliqué sur la notification ».
-- Expo dit combien de téléphones ont REÇU une notification, jamais qui l'a touchée :
-- c'est l'app qui le note, ici, au tap.
--
-- Table fermée (RLS sans policy, aucun droit) : l'app écrit par `noter_suivi_annonce`,
-- l'admin lit par `admin_suivi_annonce`. user_id = auth.uid() posé par la base, jamais
-- envoyé par l'app. Visiteur non connecté (web) : ligne sans user_id (compte, pas nom).

create table if not exists public.annonce_suivi (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  annonce_id uuid references public.annonces(id) on delete set null,
  evenement text not null check (evenement in ('ouverture_notification', 'modale_vue', 'modale_version')),
  detail text check (detail is null or char_length(detail) <= 40),
  plateforme text check (plateforme is null or plateforme in ('ios', 'android', 'web')),
  cree_le timestamptz not null default now()
);
create index if not exists annonce_suivi_annonce_idx on public.annonce_suivi (annonce_id, evenement);
create index if not exists annonce_suivi_evenement_idx on public.annonce_suivi (evenement, cree_le);

alter table public.annonce_suivi enable row level security;
revoke all on public.annonce_suivi from public, anon, authenticated;
revoke all on sequence public.annonce_suivi_id_seq from public, anon, authenticated;

create or replace function public.noter_suivi_annonce(
  p_evenement text,
  p_annonce_id uuid default null,
  p_detail text default null,
  p_plateforme text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_detail text := nullif(left(btrim(coalesce(p_detail, '')), 40), '');
begin
  if p_evenement not in ('ouverture_notification', 'modale_vue', 'modale_version') then
    return;
  end if;
  if p_plateforme is not null and p_plateforme not in ('ios', 'android', 'web') then
    p_plateforme := null;
  end if;
  if p_annonce_id is not null and not exists (select 1 from annonces where id = p_annonce_id) then
    p_annonce_id := null;
  end if;
  -- Un compte connecté n'est compté qu'une fois par (événement, annonce, version).
  if v_uid is not null and exists (
    select 1 from annonce_suivi
    where user_id = v_uid and evenement = p_evenement
      and annonce_id is not distinct from p_annonce_id
      and detail is not distinct from v_detail
  ) then
    return;
  end if;
  insert into annonce_suivi (user_id, annonce_id, evenement, detail, plateforme)
  values (v_uid, p_annonce_id, p_evenement, v_detail, p_plateforme);
end $$;

revoke all on function public.noter_suivi_annonce(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.noter_suivi_annonce(text, uuid, text, text) to anon, authenticated;

create or replace function public.admin_suivi_annonce(p_depuis timestamptz default now() - interval '7 days')
returns table (
  quand timestamptz,
  evenement text,
  detail text,
  plateforme text,
  annonce text,
  nom text,
  email text,
  telephone text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  return query
  select s.cree_le, s.evenement, s.detail, s.plateforme, a.titre,
         p.full_name, u.email::text, p.phone
  from annonce_suivi s
  left join annonces a on a.id = s.annonce_id
  left join profiles p on p.id = s.user_id
  left join auth.users u on u.id = s.user_id
  where s.cree_le >= p_depuis
  order by s.cree_le desc;
end $$;

revoke all on function public.admin_suivi_annonce(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_suivi_annonce(timestamptz) to authenticated;
