-- =============================================================================
-- LOT 6 — Finitions du pont DistriPro
--
-- 1. Sens RETOUR (DistriPro → Taxi Food) : la fonction Edge `distripro-statut` reçoit les
--    changements de statut des commandes DistriPro des restaurants partenaires et pousse une
--    notification au staff du restaurant. Elle vérifie l'en-tête `x-pont-retour` par
--    `distripro_retour_ok()` : on ne garde ICI que l'empreinte SHA-256 du secret, la valeur
--    brute vit dans le Vault DistriPro.
--
-- 2. Déduction d'une facture DistriPro du reversement Taxi Food : CHEMIN PRÊT, ÉTEINT.
--    Décision du porteur du projet (2026-10-23) : « pas abandonné, en stand-by, afficher
--    "pas encore disponible" ». Table `distripro_deductions` (une ligne par commande DistriPro
--    à déduire) + interrupteur `payment_config.distripro_deduction_active` = false.
--    Tant qu'il est éteint : l'app grise le choix, DistriPro refuse le mode
--    `reversement_taxifood`. Rallumer demandera aussi : le mode accepté par creer_commande
--    côté DistriPro, et la ligne de déduction dans admin_commandes_a_reverser + reversement.ts.
-- =============================================================================

create or replace function public.distripro_retour_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(length(p_secret) >= 32, false)
     and encode(extensions.digest(p_secret, 'sha256'), 'hex')
         = '06efd8e5b5bf706d1f1dd8e7376d8a8561a89497f0412743014d254dc8e5b2ad'
$$;
revoke all on function public.distripro_retour_ok(text) from public, anon, authenticated;
grant execute on function public.distripro_retour_ok(text) to service_role;

create table if not exists public.distripro_deductions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  commande_numero text not null unique,
  montant integer not null check (montant > 0),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'deduite', 'annulee')),
  settlement_id uuid references public.restaurant_settlements(id) on delete set null,
  cree_le timestamptz not null default now(),
  deduite_le timestamptz
);
alter table public.distripro_deductions enable row level security;
revoke all on public.distripro_deductions from anon, authenticated;

alter table public.payment_config
  add column if not exists distripro_deduction_active boolean not null default false;
