-- restaurants n'a pas de colonne zone : la page montre le type de cuisine du partenaire.
create or replace function public.pro_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v jsonb;
begin
  select * into p from public.prospects_restaurant where slug = p_slug;
  if p.id is null or p.statut in ('doublon','hors_zone','exclu','ferme') then return null; end if;
  select jsonb_build_object(
    'nom', p.nom, 'zone', p.zone, 'type', p.type_etablissement,
    'deja_partenaire', p.restaurant_id is not null or p.statut = 'partenaire',
    'stats', public.pro_stats(),
    'rdv', (select jsonb_build_object('debut', r.debut, 'nom', r.contact_nom)
              from public.rdv_prospects r where r.prospect_id = p.id and r.statut = 'confirme'),
    'creneaux', coalesce((select jsonb_agg(c.debut order by c.debut) from public.rdv_creneaux_libres(12) c), '[]'::jsonb),
    'partenaires', coalesce((select jsonb_agg(jsonb_build_object(
        'nom', r.name, 'logo', r.logo_url, 'couverture', r.cover_url, 'cuisine', r.cuisine_type,
        'note', r.note_moyenne, 'nb_avis', r.nb_avis) order by r.sort_order)
      from public.restaurants r where r.listing_status = 'visible' and r.id is distinct from p.restaurant_id), '[]'::jsonb),
    'avis', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('prenom', a.prenom_affiche, 'note', a.note_restaurant,
                                  'texte', a.commentaire, 'restaurant', r.name) x
          from public.avis a join public.restaurants r on r.id = a.restaurant_id
         where a.statut = 'publie' and a.consentement_publication
           and a.commentaire is not null and char_length(a.commentaire) >= 20 and a.note_restaurant >= 4
         order by a.created_at desc limit 3) z), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.pro_page(text) from public;
grant execute on function public.pro_page(text) to anon, authenticated;
