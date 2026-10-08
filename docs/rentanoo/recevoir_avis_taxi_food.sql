-- APPLIQUÉ DANS LA BASE RENTANOO (projet tbsgzykqcksmqxpimwry), pas dans Taxi Food — 2026-10-08.
-- Migrations Rentanoo : taxi_food_avis_vers_calendrier + taxi_food_avis_vers_calendrier_creneau_libre.
-- Reçoit les avis clients Taxi Food (envoyés par public.envoyer_avis_au_calendrier côté Taxi Food)
-- et les range dans editorial_calendar, marque taxi-food, pilier 'libre'.
-- Secret partagé : cowork_secrets.taxi_food_avis_cle (Rentanoo) = Vault calendrier_avis_cle (Taxi Food).
insert into public.cowork_secrets (key, value, updated_at)
select 'taxi_food_avis_cle', encode(extensions.gen_random_bytes(24), 'hex'), now()
where not exists (select 1 from public.cowork_secrets where key = 'taxi_food_avis_cle');

create or replace function public.recevoir_avis_taxi_food(
  p_cle text, p_avis_id uuid, p_statut text, p_texte text, p_image text,
  p_date date, p_heure time, p_fb_url text default null)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_brand uuid; v_id uuid; v_statut_actuel text; v_slot int; v_tag text := 'avis-taxi-food:' || p_avis_id; v_essai int := 0;
begin
  if p_cle is null or p_cle <> (select value from public.cowork_secrets where key = 'taxi_food_avis_cle') then
    return 'refuse';
  end if;
  if p_statut not in ('validated', 'draft', 'published', 'rejected') then return 'statut_invalide'; end if;
  select id into v_brand from public.brands where slug = 'taxi-food';
  perform pg_advisory_xact_lock(hashtext('avis-taxi-food:' || v_brand::text || p_date::text));

  select id, status into v_id, v_statut_actuel from public.editorial_calendar
   where brand_id = v_brand and created_by = v_tag;

  if v_id is not null then
    if v_statut_actuel = 'published' then return 'deja_publie'; end if;
    update public.editorial_calendar
       set status = p_statut, post_text = p_texte, image_url = p_image,
           scheduled_date = p_date, publication_hour = p_heure,
           fb_post_url = coalesce(p_fb_url, fb_post_url)
     where id = v_id;
    return 'mis_a_jour';
  end if;

  loop
    select coalesce(max(slot), 0) + 1 + v_essai into v_slot from public.editorial_calendar
     where brand_id = v_brand and scheduled_date = p_date;
    begin
      insert into public.editorial_calendar
        (brand_id, scheduled_date, slot, pilier, content_type, status, post_text, image_url,
         publication_hour, target_platforms, source, created_by, fb_post_url)
      values
        (v_brand, p_date, v_slot, 'libre', 'image', p_statut, p_texte, p_image,
         p_heure, array['facebook'], 'agent', v_tag, p_fb_url);
      return 'cree';
    exception when unique_violation then
      v_essai := v_essai + 1;
      if v_essai > 5 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.recevoir_avis_taxi_food(text, uuid, text, text, text, date, time, text) from public, authenticated;
grant execute on function public.recevoir_avis_taxi_food(text, uuid, text, text, text, date, time, text) to anon;
