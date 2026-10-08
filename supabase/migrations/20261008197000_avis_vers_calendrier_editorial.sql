-- Les avis passent par le CALENDRIER ÉDITORIAL (base Rentanoo, marque taxi-food), 2026-10-08.
--
-- Le porteur du projet regarde son calendrier (rentanoo.com/admin/calendar) : un avis doit y
-- apparaître. C'est donc le calendrier qui publie, plus la fonction Edge publier-avis-facebook.
--   positif  (a_publier)  -> entrée 'validated' au créneau calculé : le publieur du calendrier
--                            (pg_cron editorial-publisher) la publie tout seul ;
--   négatif  (a_traiter)  -> entrée 'draft' : visible, à traiter à la main ;
--   publiée  (publiee)    -> entrée 'published' avec le lien du post (cas de Jenn, TF-371) ;
--   écartée  (ecartee)    -> entrée 'rejected'.
-- Transport : pg_net -> RPC `recevoir_avis_taxi_food` de la base Rentanoo (clé publique +
-- secret partagé `calendrier_avis_cle` au Vault, copie de cowork_secrets.taxi_food_avis_cle).
-- Une entrée par avis (created_by = 'avis-taxi-food:<avis_id>'), mise à jour tant qu'elle n'est
-- pas publiée.
--
-- ⚠️ La tâche pg_cron `publier-avis-facebook` est SUPPRIMÉE : garder deux publieurs, c'est
-- publier deux fois. La fonction Edge reste déployée, inerte.

drop function if exists public.recevoir_cle_calendrier(text, text);
delete from vault.secrets where name = 'calendrier_cle_transfert';
select cron.unschedule(jobid) from cron.job where jobname = 'publier-avis-facebook';

alter table public.publications_avis drop constraint if exists publications_avis_statut_check;
alter table public.publications_avis add constraint publications_avis_statut_check
  check (statut in ('a_publier', 'en_cours', 'publiee', 'a_traiter', 'ecartee', 'echec', 'au_calendrier'));
alter table public.publications_avis add column if not exists calendrier_reponse text;

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
      'p_fb_url', v_fb),
    timeout_milliseconds := 20000);

  if p.statut = 'a_publier' then
    update public.publications_avis set statut = 'au_calendrier', updated_at = now() where id = p.id;
  end if;
end $$;
revoke all on function public.envoyer_avis_au_calendrier(uuid) from public, anon, authenticated;

-- planifier_publication_avis : même règle qu'avant, puis envoi au calendrier. Une entrée déjà
-- au calendrier se met à jour (texte, photo) ; une entrée publiée ne bouge plus.
create or replace function public.planifier_publication_avis(p_avis_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  a record; v_product uuid; v_image text; v_statut text; v_prevue timestamptz; v_existant record; v_existe boolean;
begin
  select * into a from public.avis where id = p_avis_id;
  if not found then return; end if;

  select * into v_existant from public.publications_avis where avis_id = p_avis_id;
  v_existe := found;
  if v_existe and v_existant.statut in ('publiee', 'en_cours') then return; end if;

  if a.statut <> 'publie' or not a.consentement_publication then
    if v_existe then
      update public.publications_avis set statut = 'ecartee', updated_at = now() where id = v_existant.id;
      perform public.envoyer_avis_au_calendrier(p_avis_id);
    end if;
    return;
  end if;

  select oi.product_id into v_product
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
   where oi.order_id = a.order_id and oi.product_id is not null
   order by coalesce(c.est_boisson, false), oi.product_name_snapshot
   limit 1;

  select coalesce(a.photo_url, p.vraie_photo_url, p.photo_url) into v_image
    from public.products p where p.id = v_product;
  v_image := coalesce(v_image, a.photo_url);

  v_statut := case when a.note_restaurant >= 4 then 'a_publier' else 'a_traiter' end;

  if v_statut = 'a_publier' then
    if v_existe and v_existant.statut in ('a_publier', 'au_calendrier') then
      v_prevue := v_existant.prevue_le;
    else
      select greatest(now() + interval '10 minutes',
                      coalesce(max(coalesce(publiee_le, prevue_le)) + interval '2 hours', now()))
        into v_prevue
        from public.publications_avis
       where statut in ('a_publier', 'au_calendrier', 'en_cours', 'publiee')
         and coalesce(publiee_le, prevue_le) > now() - interval '2 hours';
    end if;
  end if;

  insert into public.publications_avis (avis_id, restaurant_id, product_id, statut, texte, image_url, prevue_le)
  values (a.id, a.restaurant_id, v_product, v_statut,
          public.texte_publication_avis(a.id, v_product), v_image, v_prevue)
  on conflict (avis_id) do update
     set product_id = excluded.product_id,
         statut = excluded.statut,
         texte = excluded.texte,
         image_url = excluded.image_url,
         prevue_le = excluded.prevue_le,
         updated_at = now();

  perform public.envoyer_avis_au_calendrier(p_avis_id);
end $$;
revoke all on function public.planifier_publication_avis(uuid) from public, anon, authenticated;

-- Les deux avis du jour : Jenn (déjà publiée à 21 h 10) et Alain (23 h 10, publié par le calendrier).
select public.envoyer_avis_au_calendrier('15e32a9c-b700-496a-a990-c9974fa5b5e2');
select public.planifier_publication_avis('56e18168-159d-4252-996d-39e614d81849');
