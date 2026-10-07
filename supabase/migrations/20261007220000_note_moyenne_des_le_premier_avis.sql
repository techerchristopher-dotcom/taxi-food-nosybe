-- Note moyenne affichée dès le PREMIER avis (décision du porteur du projet, 2026-10-07).
-- Avant : `having count(*) >= 3` — un restaurant à 1 ou 2 avis n'affichait qu'un compteur.
create or replace function public.note_moyenne(r restaurants)
returns numeric
language sql stable security definer set search_path to 'public' as $function$
  select round(avg(a.note_restaurant), 1)
    from public.avis a
   where a.restaurant_id = r.id and a.statut = 'publie'
  having count(*) >= 1;
$function$;
