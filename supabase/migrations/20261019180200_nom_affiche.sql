-- Un nom saisi tout en minuscules (« hotel grand bay ») s'affiche en capitales initiales
-- dans le message et sur la page ; un nom déjà écrit avec des majuscules n'est pas touché.
create or replace function public.nom_affiche(p text) returns text
language sql immutable set search_path = public as $$
  select case when p = lower(p) then initcap(p) else p end
$$;

create or replace function public.texte_whatsapp_prospect(p_prospect uuid, p_etape text)
returns text language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v_lien text; v_partenaires text; s jsonb := public.pro_stats(); v_chiffres text;
begin
  -- « 91 commandes livrées depuis le 8 septembre, note moyenne 4,8/5 » : lu en direct.
  v_chiffres := 'Depuis le ' || to_char((s->>'depuis')::timestamptz at time zone 'Indian/Antananarivo', 'FMDD')
    || ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])
       [extract(month from (s->>'depuis')::timestamptz at time zone 'Indian/Antananarivo')::int]
    || ' : ' || (s->>'commandes_livrees') || ' commandes livrées'
    || coalesce(', note moyenne ' || replace(s->>'note', '.', ',') || '/5', '') || '.';
  select * into p from public.prospects_restaurant where id = p_prospect;
  if p.id is null then return null; end if;
  v_lien := 'https://taxifoodnosybe.distripro207.com/pro/' || p.slug;
  select string_agg(name, ', ' order by sort_order) into v_partenaires
    from (select name, sort_order from public.restaurants
           where listing_status = 'visible' and id is distinct from p.restaurant_id
           order by sort_order limit 4) r;
  if p_etape = 'whatsapp_relance' then
    return 'Bonjour, je reviens vers vous au sujet de Taxi Food 🙂' || E'\n\n'
      || 'La page préparée pour ' || public.nom_affiche(p.nom) || ' est toujours là : ' || v_lien || E'\n\n'
      || 'Un simple « oui » ici et je passe vous voir quand ça vous arrange (20 minutes, sans engagement).' || E'\n\n'
      || 'Christopher — Taxi Food';
  end if;
  return 'Bonjour 👋' || E'\n\n'
    || 'Je suis Christopher, fondateur de Taxi Food, l''application de livraison de repas à Nosy Be. '
    || coalesce(v_partenaires || ' y sont déjà. ', '') || v_chiffres || E'\n\n'
    || coalesce(nullif(trim(p.accroche), '') || E'\n\n', '')
    || 'J''ai préparé une page pour ' || public.nom_affiche(p.nom) || ', avec des exemples de ce qu''on fait déjà pour nos restaurants :' || E'\n'
    || '👉 ' || v_lien || E'\n\n'
    || 'En bref : de la visibilité sur nos réseaux, un nouveau canal de vente, et du chiffre d''affaires en plus sans augmenter vos charges. Nos livreurs s''occupent de la livraison.' || E'\n\n'
    || 'Si ça vous intéresse, choisissez un créneau directement sur la page et je passe vous voir 20 minutes. Ou répondez simplement ici.' || E'\n\n'
    || 'Bonne journée,' || E'\n' || 'Christopher — Taxi Food';
end $$;
revoke all on function public.texte_whatsapp_prospect(uuid, text) from public, anon, authenticated;

create or replace function public.pro_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v jsonb;
begin
  select * into p from public.prospects_restaurant where slug = p_slug;
  if p.id is null or p.statut in ('doublon','hors_zone','exclu','ferme') then return null; end if;
  select jsonb_build_object(
    'nom', public.nom_affiche(p.nom), 'zone', p.zone, 'type', p.type_etablissement,
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
