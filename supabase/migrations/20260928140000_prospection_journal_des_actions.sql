-- Pourquoi : la tournée des 671 fiches à visiter se fait seul, à scooter, et
-- « ce qui n'est pas noté le jour même est perdu » (STRATEGIE-PROSPECTION-
-- HEBERGEMENTS.md § 6.9). Il faut un journal append-only — rien ne s'écrase,
-- on ajoute — qui devienne la SEULE source de vérité sur ce qui a été fait :
-- tout le reste (prochaine action, retard, compteurs) se recalcule dessus,
-- jamais une colonne dénormalisée sur `prospects_hebergement` qui se
-- désynchroniserait au premier oubli.

create table public.prospect_actions (
  id              uuid primary key default gen_random_uuid(),
  prospect_id     uuid not null references public.prospects_hebergement(id) on delete cascade,
  canal           text not null,
  sens            text not null default 'sortant',
  resultat        text not null,
  offre_faite     text,
  interlocuteur   text,
  flyers_deposes  integer not null default 0,
  note            text,
  fait_le         timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint prospect_actions_canal_connu
    check (canal in ('whatsapp', 'appel', 'messenger', 'email', 'visite', 'flyers', 'controle')),
  constraint prospect_actions_sens_connu
    check (sens in ('sortant', 'entrant')),
  constraint prospect_actions_resultat_connu
    check (resultat in ('pas_de_reponse', 'a_rappeler', 'interesse', 'accepte', 'refus',
                        'absent', 'ferme', 'mauvais_numero', 'code_utilise', 'code_dormant')),
  constraint prospect_actions_flyers_positifs check (flyers_deposes >= 0)
);

comment on table public.prospect_actions is
  'Journal des gestes de prospection, un par ligne, jamais réécrit. Source unique de vérité — voir prospects_pilotage.';

create index prospect_actions_prospect_fait_le_idx
  on public.prospect_actions (prospect_id, fait_le desc);

alter table public.prospect_actions enable row level security;

-- Même politique que prospects_hebergement : admin seul, en lecture et en écriture.
create policy prospect_actions_admin on public.prospect_actions
  for all using (public.is_admin()) with check (public.is_admin());

do $$
declare n integer;
begin
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'prospect_actions';
  if n <> 11 then
    raise exception 'prospect_actions : attendu 11 colonnes, trouvé %', n;
  end if;
end $$;
