-- ⚠️ BASE RENTANOO (tbsgzykqcksmqxpimwry), PAS Taxi Food. Appliquée par MCP le 2026-10-12.
--
-- Quand le publieur du calendrier met en ligne un avis Taxi Food (created_by =
-- 'avis-taxi-food:<avis_id>'), on le dit à la base Taxi Food : RPC `calendrier_avis_publie`
-- (secret partagé cowork_secrets.taxi_food_avis_cle = Vault Taxi Food calendrier_avis_cle).
-- Sans ce retour, l'admin Taxi Food présentait comme « à publier » des avis déjà en ligne.
-- Une erreur ici n'empêche jamais la publication (exception avalée, WARNING).

create or replace function public.renvoyer_avis_publie_a_taxi_food()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.created_by like 'avis-taxi-food:%' and new.status = 'published' and new.fb_post_url is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'published' or old.fb_post_url is distinct from new.fb_post_url) then
    begin
      perform net.http_post(
        url := 'https://bmdveawomizjpiebgtkj.supabase.co/rest/v1/rpc/calendrier_avis_publie',
        headers := jsonb_build_object('Content-Type', 'application/json',
                                      'apikey', 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv'),
        body := jsonb_build_object(
          'p_cle', (select value from public.cowork_secrets where key = 'taxi_food_avis_cle'),
          'p_avis_id', substr(new.created_by, 16)::uuid,
          'p_fb_url', new.fb_post_url,
          'p_publie_le', coalesce(new.publish_attempted_at, now())),
        timeout_milliseconds := 20000);
    exception when others then
      raise warning 'retour avis Taxi Food % non envoye : %', new.created_by, sqlerrm;
    end;
  end if;
  return new;
end $$;
revoke all on function public.renvoyer_avis_publie_a_taxi_food() from public, anon, authenticated;

drop trigger if exists trg_avis_taxi_food_publie on public.editorial_calendar;
create trigger trg_avis_taxi_food_publie
  after insert or update of status, fb_post_url on public.editorial_calendar
  for each row execute function public.renvoyer_avis_publie_a_taxi_food();

-- Ajout du même jour (migration `recevoir_avis_taxi_food_verrou_par_avis`, base Rentanoo) :
-- `recevoir_avis_taxi_food` prend d'abord un verrou consultatif sur l'AVIS (hashtext(v_tag)),
-- en plus de celui sur la date. Sans lui, deux envois du même avis à deux dates différentes
-- (deux pg_net partis dans la même transaction) créaient DEUX entrées : constaté sur Opaline
-- TF-309, doublon passé en 'rejected' avant publication. Patch fait par remplacement d'ancre
-- dans pg_get_functiondef (les valeurs par défaut des paramètres sont conservées).
