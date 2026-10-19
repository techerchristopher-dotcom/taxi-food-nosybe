-- La vue de pilotage a figé ses colonnes à sa création (p.*) : slug et accroche n'y
-- sont pas. La vue de séquence les ajoute en fin de liste, pour l'écran admin.
create or replace view public.prospects_restaurant_sequence with (security_invoker = true) as
select pl.*, e.etape, e.a_faire_le, e.raison, e.numero_wa, e.nb_ouvertures, e.derniere_ouverture, e.rdv_le, e.rang,
       p.slug, p.accroche
  from public.prospects_restaurant_pilotage pl
  join public.prospects_restaurant p on p.id = pl.id
  cross join lateral public.prospect_restaurant_etape(p) e;
