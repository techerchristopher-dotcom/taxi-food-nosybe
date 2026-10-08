-- Calendrier éditorial : deux contrôles en échec sur les avis (constat du porteur du projet).
--  1. « Un lien dans le corps du post — il doit partir en 1er commentaire » : le lien sort du
--     texte, il part dans `reservation_url` (le calendrier le poste en 1er commentaire) et le
--     texte dit « lien en 1er commentaire » (le calendrier n'ajoute alors pas de CTA).
--  2. « Le quota de posts de ce pilier est déjà atteint » : les avis ont leur propre pilier
--     `avis_client` (6 par jour), créé côté Rentanoo, au lieu de `libre` (1 par jour).
create or replace function public.lien_publication_avis(p_avis_id uuid, p_product_id uuid)
returns text
language sql stable security definer set search_path to 'public'
as $$
  select case when p_product_id is not null
              then 'https://taxifoodnosybe.distripro207.com/p/' || p_product_id
              else 'https://taxifoodnosybe.distripro207.com/r/' || (select restaurant_id from public.avis where id = p_avis_id) end;
$$;
revoke all on function public.lien_publication_avis(uuid, uuid) from public, anon, authenticated;

create or replace function public.texte_publication_avis(p_avis_id uuid, p_product_id uuid)
returns text
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  a record; v_resto text; v_plats text[]; v_plat text; v_etoiles text;
begin
  select * into a from public.avis where id = p_avis_id;
  select name into v_resto from public.restaurants where id = a.restaurant_id;
  v_plats := public.plats_de_commande(a.order_id);
  v_plat := coalesce('« ' || array_to_string(v_plats, ' », « ') || ' »', 'son repas');
  v_etoiles := repeat('⭐', greatest(1, least(5, round(a.note_restaurant)::int)));
  return v_etoiles || ' ' || a.prenom_affiche || ' a commandé ' || v_plat || ' chez ' || v_resto || ', livré par Taxi Food.'
      || case when a.commentaire is not null then E'\n\n« ' || a.commentaire || ' »' else '' end
      || case when a.photo_url is not null then E'\n\n📸 La vraie photo du plat livré, prise par ' || a.prenom_affiche || '.' else '' end
      || E'\n\n👉 Commande-le à ton tour : lien en 1er commentaire.'
      || E'\n\n#NosyBe #TaxiFood #LivraisonDeRepas';
end $$;

create or replace function public.envoyer_avis_au_calendrier(p_avis_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  p record; v_cle text; v_statut text; v_moment timestamptz; v_fb text;
begin
  select * into p from public.publications_avis where avis_id = p_avis_id;
  if not found then return; end if;
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'calendrier_avis_cle';
  if v_cle is null then return; end if;

  v_statut := case p.statut
                when 'a_publier' then 'validated'
                when 'au_calendrier' then 'validated'
                when 'a_traiter' then 'draft'
                when 'publiee' then 'published'
                when 'ecartee' then 'rejected'
                else null end;
  if v_statut is null then return; end if;

  v_moment := coalesce(p.publiee_le, p.prevue_le, now() + interval '1 day');
  v_fb := case when p.facebook_post_id is not null
               then 'https://www.facebook.com/' || replace(p.facebook_post_id, '_', '/posts/') end;

  perform net.http_post(
    url := 'https://tbsgzykqcksmqxpimwry.supabase.co/rest/v1/rpc/recevoir_avis_taxi_food',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'apikey', 'sb_publishable_pmmQZ0f5XEZhEk-Lks3a0Q_HIq7HWH8'),
    body := jsonb_build_object(
      'p_cle', v_cle, 'p_avis_id', p_avis_id, 'p_statut', v_statut,
      'p_texte', p.texte, 'p_image', p.image_url,
      'p_date', (v_moment at time zone 'Indian/Antananarivo')::date,
      'p_heure', to_char(v_moment at time zone 'Indian/Antananarivo', 'HH24:MI'),
      'p_fb_url', v_fb,
      'p_lien', public.lien_publication_avis(p.avis_id, p.product_id)),
    timeout_milliseconds := 20000);

  if p.statut = 'a_publier' then
    update public.publications_avis set statut = 'au_calendrier', updated_at = now() where id = p.id;
  end if;
end $$;
revoke all on function public.envoyer_avis_au_calendrier(uuid) from public, anon, authenticated;

-- Alain : texte régénéré (sans lien), puis renvoyé au calendrier.
select public.planifier_publication_avis('56e18168-159d-4252-996d-39e614d81849');
