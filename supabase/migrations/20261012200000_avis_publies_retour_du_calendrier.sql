-- Le calendrier éditorial (base Rentanoo) RENVOIE le « publié » à Taxi Food (2026-10-12).
--
-- Constat : depuis le 2026-10-08, les avis positifs partent au calendrier (statut local
-- `au_calendrier`) et c'est le publieur du calendrier qui les met sur la Page. Mais rien ne
-- revenait : `publications_avis` restait `au_calendrier` et `avis.utilise_reseaux_le` vide,
-- donc l'admin (filtre « À publier ») présentait comme à publier des avis déjà en ligne
-- (Alain ×2, Sébastien, Abbas, Jenn TF-379 — tous publiés les 08 et 09/10).
--
-- 1. `calendrier_avis_publie(cle, avis_id, fb_url, publie_le)` : appelée par la base Rentanoo
--    (trigger sur editorial_calendar → pg_net), protégée par le secret partagé
--    `calendrier_avis_cle` (Vault ici, cowork_secrets.taxi_food_avis_cle là-bas). Idempotente.
--    Pose `publiee` + post Facebook + date, et `avis.utilise_reseaux_le` s'il est vide.
--    ⚠️ Ne déclenche pas `avis_publication_facebook` (utilise_reseaux_le n'est pas dans sa liste).
-- 2. Rattrapage des 5 publications déjà en ligne.
-- 3. Un avis d'un restaurant NON visible (stand-by, en négociation, masqué) n'est plus
--    mis en file : on ne fait pas la publicité d'un restaurant qu'on ne peut pas commander.

create or replace function public.calendrier_avis_publie(
  p_cle text, p_avis_id uuid, p_fb_url text, p_publie_le timestamptz default null)
returns text
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_cle text; v_post text; m text[]; v_n int;
begin
  select decrypted_secret into v_cle from vault.decrypted_secrets where name = 'calendrier_avis_cle';
  if v_cle is null or p_cle is null or p_cle <> v_cle then return 'refuse'; end if;

  -- https://www.facebook.com/<page>_<post>  ou  https://www.facebook.com/<page>/posts/<post>
  m := regexp_match(coalesce(p_fb_url, ''), '(\d+)(?:_|/posts/)(\d+)');
  if m is not null then v_post := m[1] || '_' || m[2]; end if;

  update public.publications_avis
     set statut = 'publiee',
         publiee_le = coalesce(publiee_le, p_publie_le, now()),
         facebook_post_id = coalesce(v_post, facebook_post_id),
         erreur = null,
         updated_at = now()
   where avis_id = p_avis_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then return 'inconnu'; end if;

  update public.avis
     set utilise_reseaux_le = coalesce(utilise_reseaux_le, p_publie_le, now())
   where id = p_avis_id;
  return 'ok';
end $$;
revoke all on function public.calendrier_avis_publie(text, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.calendrier_avis_publie(text, uuid, text, timestamptz) to anon;

-- Rattrapage (publications constatées dans editorial_calendar le 2026-10-12).
do $$
declare v_n int;
begin
  with p(ord, post, le) as (values
    ('TF-332', '1350723891454039_122120832939470142', timestamptz '2026-10-08 20:15:09+00'),
    ('TF-311', '1350723891454039_122121140517470142', timestamptz '2026-10-09 13:30:10+00'),
    ('TF-315', '1350723891454039_122121177447470142', timestamptz '2026-10-09 15:30:10+00'),
    ('TF-327', '1350723891454039_122121229119470142', timestamptz '2026-10-09 17:30:11+00'),
    ('TF-379', '1350723891454039_122121276423470142', timestamptz '2026-10-09 19:30:11+00'))
  update public.publications_avis pa
     set statut = 'publiee', publiee_le = p.le, facebook_post_id = p.post, updated_at = now()
    from p, public.avis a, public.orders o
   where a.id = pa.avis_id and o.id = a.order_id and o.order_number = p.ord
     and pa.statut = 'au_calendrier';
  get diagnostics v_n = row_count;
  if v_n <> 5 then raise exception 'rattrapage publications : % lignes au lieu de 5', v_n; end if;

  update public.avis a
     set utilise_reseaux_le = pa.publiee_le
    from public.publications_avis pa
   where pa.avis_id = a.id and pa.statut = 'publiee' and a.utilise_reseaux_le is null;
  get diagnostics v_n = row_count;
  if v_n <> 4 then raise exception 'rattrapage avis : % lignes au lieu de 4', v_n; end if;
end $$;

-- Garde « restaurant visible » dans planifier_publication_avis, patchée par ancre.
do $$
declare v_src text; v_ancre text := 'if a.statut <> ''publie'' or not a.consentement_publication then';
begin
  select prosrc into v_src from pg_proc where proname = 'planifier_publication_avis'
     and pronamespace = 'public'::regnamespace;
  if position(v_ancre in v_src) = 0 then raise exception 'ancre introuvable dans planifier_publication_avis'; end if;
  v_src := replace(v_src, v_ancre,
    'if a.statut <> ''publie'' or not a.consentement_publication
     or not exists (select 1 from public.restaurants r
                     where r.id = a.restaurant_id and r.listing_status = ''visible'') then');
  execute format($f$create or replace function public.planifier_publication_avis(p_avis_id uuid)
    returns void language plpgsql security definer set search_path to 'public' as %L$f$, v_src);
end $$;
revoke all on function public.planifier_publication_avis(uuid) from public, anon, authenticated;
