-- =============================================================================
-- LOT 2 — Pont Taxi Food → DistriPro (onglet « Commander » des partenaires)
--
-- * distripro_liaisons : restaurant Taxi Food ↔ client DistriPro. RLS sans policy,
--   aucun droit : lue et écrite par la fonction Edge « distripro » (service_role).
-- * Secret du pont : généré ICI dans le Vault, jamais affiché. DistriPro n'en garde
--   que l'empreinte SHA-256 (admin_config.pont_taxifood_sha256) : la valeur brute ne
--   quitte jamais ce projet.
-- * distripro_pont_secret() : lecture du secret, service_role seul.
-- =============================================================================

create table if not exists public.distripro_liaisons (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  distripro_client_id integer not null unique,
  relie_le timestamptz not null default now(),
  relie_par uuid references auth.users(id) on delete set null
);
alter table public.distripro_liaisons enable row level security;
revoke all on public.distripro_liaisons from anon, authenticated;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'distripro_pont_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'distripro_pont_secret',
      'Secret du pont Taxi Food → DistriPro (DistriPro ne garde que son SHA-256)');
  end if;
end $$;

create or replace function public.distripro_pont_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'distripro_pont_secret' limit 1
$$;
revoke all on function public.distripro_pont_secret() from public, anon, authenticated;
grant execute on function public.distripro_pont_secret() to service_role;
