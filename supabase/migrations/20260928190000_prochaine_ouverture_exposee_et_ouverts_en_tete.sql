-- Pourquoi : à 18 h 20 un lundi, l'application écrivait « Ouvre à 12h » sous
-- Chez Bidul & Truc — l'heure du service de MIDI, déjà terminé, alors que le
-- service du soir ouvre à 19 h. La base savait la vérité (`prochaine_ouverture()`
-- ignore les services passés) mais ne l'exposait pas : elle rend une TABLE, et
-- PostgREST ne lit comme colonne calculée qu'une fonction à résultat SCALAIRE.
-- L'écran retombait donc sur `horaires_du_jour`, le PREMIER service du jour.
-- Deux fonctions scalaires suffisent à faire lire la bonne réponse, sans
-- réécrire la règle : elles ne font que la relayer.
--
-- Et le tri : `rang_catalogue` est une colonne GÉNÉRÉE, donc immuable — elle
-- ne peut pas dépendre de l'heure, et c'est l'heure qui dit qui est ouvert.
-- Pour mettre les restaurants ouverts en tête SANS casser « visible avant en
-- négociation », `rang_ouverture` reprend la même structure (le statut pèse
-- 200 000) et glisse l'ouverture (100 000) entre le statut et le rang choisi
-- dans l'admin. L'application et la vitrine trient toutes deux dessus : deux
-- tris écrits séparément finissent toujours par diverger (leçon du 2026-09-16).

create or replace function public.ouvre_dans_jours(r public.restaurants)
returns smallint
language sql
stable
as $$
  select p.jours from public.prochaine_ouverture(r) p;
$$;

create or replace function public.ouvre_a(r public.restaurants)
returns time without time zone
language sql
stable
as $$
  select p.ouvre from public.prochaine_ouverture(r) p;
$$;

comment on function public.ouvre_dans_jours(public.restaurants) is
  'Dans combien de jours le restaurant rouvre (0 = aujourd''hui). Null : fermé à la main, ou rien sous sept jours. Relais scalaire de prochaine_ouverture() pour PostgREST.';
comment on function public.ouvre_a(public.restaurants) is
  'À quelle heure le restaurant rouvre, services déjà passés exclus. Null : fermé à la main, ou rien sous sept jours. Relais scalaire de prochaine_ouverture() pour PostgREST.';

create or replace function public.rang_ouverture(r public.restaurants)
returns integer
language sql
stable
as $$
  select (case r.listing_status
            when 'visible' then 0
            when 'coming_soon' then 1
            else 2
          end) * 200000
       + (case when public.ouvert_maintenant(r) then 0 else 100000 end)
       + r.sort_order;
$$;

comment on function public.rang_ouverture(public.restaurants) is
  'Ordre du catalogue à cet instant : statut d''abord, puis les restaurants ouverts, puis sort_order. Remplace rang_catalogue dans les tris de l''app et de la vitrine (rang_catalogue, colonne générée, ne peut pas dépendre de l''heure).';

grant execute on function public.ouvre_dans_jours(public.restaurants) to anon, authenticated;
grant execute on function public.ouvre_a(public.restaurants) to anon, authenticated;
grant execute on function public.rang_ouverture(public.restaurants) to anon, authenticated;

do $$
declare
  n_diff  integer;
  n_sort  integer;
  n_ordre integer;
begin
  -- 1. Les deux scalaires disent EXACTEMENT ce que prochaine_ouverture() dit.
  select count(*) into n_diff
    from public.restaurants r
    left join lateral public.prochaine_ouverture(r) p on true
   where public.ouvre_a(r) is distinct from p.ouvre
      or public.ouvre_dans_jours(r) is distinct from p.jours;
  if n_diff <> 0 then
    raise exception 'ouvre_a / ouvre_dans_jours : % restaurant(s) en désaccord avec prochaine_ouverture()', n_diff;
  end if;

  -- 2. sort_order tient dans sa tranche : au-delà, un rang mordrait sur la suivante.
  select count(*) into n_sort
    from public.restaurants
   where sort_order < 0 or sort_order >= 100000;
  if n_sort <> 0 then
    raise exception 'rang_ouverture : % sort_order hors de [0, 100000)', n_sort;
  end if;

  -- 3. Le statut reste premier : aucun « en négociation » ne passe devant un « visible ».
  select count(*) into n_ordre
    from public.restaurants a
    join public.restaurants b
      on a.listing_status = 'coming_soon' and b.listing_status = 'visible'
   where public.rang_ouverture(a) <= public.rang_ouverture(b);
  if n_ordre <> 0 then
    raise exception 'rang_ouverture : % paire(s) où un restaurant en négociation passe devant un visible', n_ordre;
  end if;
end $$;
