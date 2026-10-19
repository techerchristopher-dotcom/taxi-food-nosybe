-- Le message WhatsApp reprend les chiffres du bilan de la page (pro_bilan : depuis le
-- lancement du 10 septembre), pour que message et page disent la même chose.
create or replace function public.texte_whatsapp_prospect(p_prospect uuid, p_etape text)
returns text language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v_lien text; v_partenaires text; b jsonb := public.pro_bilan(); v_chiffres text;
begin
  -- « Depuis le 10 septembre : 90 livraisons, 4,6 millions d'Ar revenus aux restaurants, note 4,8/5. »
  v_chiffres := 'Depuis le 10 septembre : ' || (b->>'livraisons') || ' livraisons'
    || coalesce(', ' || replace(to_char((b->>'revient_restaurants')::numeric / 1e6, 'FM990.0'), '.', ',')
                || ' millions d''Ar revenus aux restaurants', '')
    || coalesce(', note moyenne ' || replace(b->>'note', '.', ',') || '/5', '') || '.';
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
    || 'J''ai préparé une page pour ' || public.nom_affiche(p.nom) || ', avec nos chiffres et ce qu''on fait pour nos restaurants :' || E'\n'
    || '👉 ' || v_lien || E'\n\n'
    || 'En bref : de la visibilité sur nos réseaux, un nouveau canal de vente, et du chiffre d''affaires en plus sans augmenter vos charges.' || E'\n\n'
    || 'Choisissez un créneau sur la page et je passe vous voir 20 minutes. Ou répondez simplement ici.' || E'\n\n'
    || 'Christopher — Taxi Food';
end $$;
revoke all on function public.texte_whatsapp_prospect(uuid, text) from public, anon, authenticated;
