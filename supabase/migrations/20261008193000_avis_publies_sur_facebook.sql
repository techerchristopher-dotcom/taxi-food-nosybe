-- Avis positifs publiés automatiquement sur la Page Facebook Taxi Food (2026-10-08)
--
-- Décision du porteur du projet : un avis POSITIF part tout seul sur la Page, avec sa photo
-- et un texte ; un avis NÉGATIF attend un traitement à la main.
--
--   positif  = note du restaurant >= 4 ET publication consentie par le client
--              → statut `a_publier`, créneau calculé (10 min de délai, puis 2 h d'écart
--                entre deux publications pour ne pas inonder la Page) ;
--   négatif  = note < 4 → `a_traiter` (le Telegram admin d'alerter_nouvel_avis prévient déjà) ;
--   sans consentement → rien n'est créé : on ne publie JAMAIS un avis que le client n'a pas
--              autorisé, quelle que soit la note.
--
-- L'envoi : tâche pg_cron `publier-avis-facebook` (toutes les 10 min) → fonction Edge
-- `publier-avis-facebook` → Graph API `/{page}/photos`. ⚠️ INERTE tant que le Vault ne contient
-- pas `facebook_page_token` (jeton de Page, geste humain) : la tâche ne fait alors aucun appel
-- et les publications restent `a_publier`, prêtes à partir dès que le jeton est posé.

create table if not exists public.publications_avis (
  id uuid primary key default gen_random_uuid(),
  avis_id uuid not null unique references public.avis(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id),
  product_id uuid references public.products(id) on delete set null,
  statut text not null check (statut in ('a_publier', 'en_cours', 'publiee', 'a_traiter', 'ecartee', 'echec')),
  texte text not null,
  image_url text,
  prevue_le timestamptz,
  publiee_le timestamptz,
  facebook_post_id text,
  tentatives int not null default 0,
  erreur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists publications_avis_a_envoyer_idx on public.publications_avis (prevue_le) where statut = 'a_publier';

alter table public.publications_avis enable row level security;
revoke all on table public.publications_avis from public, anon, authenticated;
drop policy if exists publications_avis_admin on public.publications_avis;
create policy publications_avis_admin on public.publications_avis for select to authenticated using (public.is_admin());
grant select on table public.publications_avis to authenticated;

-- Texte de la publication, en français (la Page publie en français).
create or replace function public.texte_publication_avis(p_avis_id uuid, p_product_id uuid)
returns text
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  a record; v_resto text; v_plats text[]; v_plat text; v_etoiles text; v_lien text;
begin
  select * into a from public.avis where id = p_avis_id;
  select name into v_resto from public.restaurants where id = a.restaurant_id;
  v_plats := public.plats_de_commande(a.order_id);
  v_plat := coalesce(array_to_string(v_plats, ', '), 'son repas');
  v_etoiles := repeat('⭐', greatest(1, least(5, round(a.note_restaurant)::int)));
  v_lien := case when p_product_id is not null
                 then 'https://taxifoodnosybe.distripro207.com/p/' || p_product_id
                 else 'https://taxifoodnosybe.distripro207.com/r/' || a.restaurant_id end;
  return v_etoiles || ' ' || a.prenom_affiche || ' a commandé ' || v_plat || ' chez ' || v_resto || ', livré par Taxi Food.'
      || case when a.commentaire is not null then E'\n\n« ' || a.commentaire || ' »' else '' end
      || case when a.photo_url is not null then E'\n\n📸 La vraie photo du plat livré, prise par ' || a.prenom_affiche || '.' else '' end
      || E'\n\n👉 Commande-le à ton tour : ' || v_lien
      || E'\n\n#NosyBe #TaxiFood #LivraisonDeRepas';
end $$;
revoke all on function public.texte_publication_avis(uuid, uuid) from public, anon, authenticated;

-- Crée ou met à jour la publication d'un avis. Idempotente ; ne touche jamais une
-- publication déjà partie ou en cours d'envoi.
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
  v_existe := found;  -- `found` est écrasé par chaque requête suivante : on le fige ici.
  if v_existe and v_existant.statut in ('publiee', 'en_cours') then return; end if;

  -- Avis masqué par l'admin, ou consentement retiré : on écarte, on ne publie pas.
  if a.statut <> 'publie' or not a.consentement_publication then
    if v_existe then
      update public.publications_avis set statut = 'ecartee', updated_at = now() where id = v_existant.id;
    end if;
    return;
  end if;

  -- Le plat mis en avant : le premier plat (hors boissons) de la commande.
  select oi.product_id into v_product
    from public.order_items oi
    left join public.products p on p.id = oi.product_id
    left join public.categories c on c.id = p.category_id
   where oi.order_id = a.order_id and oi.product_id is not null
   order by coalesce(c.est_boisson, false), oi.product_name_snapshot
   limit 1;

  -- Image : la photo du client d'abord, sinon la vraie photo du plat, sinon son visuel.
  select coalesce(a.photo_url, p.vraie_photo_url, p.photo_url) into v_image
    from public.products p where p.id = v_product;
  v_image := coalesce(v_image, a.photo_url);

  v_statut := case when a.note_restaurant >= 4 then 'a_publier' else 'a_traiter' end;

  if v_statut = 'a_publier' then
    if v_existe and v_existant.statut = 'a_publier' then
      v_prevue := v_existant.prevue_le;
    else
      select greatest(now() + interval '10 minutes',
                      coalesce(max(coalesce(publiee_le, prevue_le)) + interval '2 hours', now()))
        into v_prevue
        from public.publications_avis
       where statut in ('a_publier', 'en_cours', 'publiee')
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
end $$;
revoke all on function public.planifier_publication_avis(uuid) from public, anon, authenticated;

create or replace function public.avis_vers_publication()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  begin
    perform public.planifier_publication_avis(new.id);
  exception when others then
    -- Une publication ratée ne doit jamais empêcher un client de déposer son avis.
    raise warning 'publication avis % non planifiee : %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.avis_vers_publication() from public, anon, authenticated;

drop trigger if exists avis_publication_facebook on public.avis;
create trigger avis_publication_facebook
  after insert or update of photo_url, statut, consentement_publication, commentaire on public.avis
  for each row execute function public.avis_vers_publication();

-- Lecture des secrets par la fonction Edge (service_role seul).
create or replace function public.lire_config_facebook()
returns jsonb
language sql security definer set search_path to ''
as $$
  select jsonb_build_object(
    'page_id', (select decrypted_secret from vault.decrypted_secrets where name = 'facebook_page_id'),
    'page_token', (select decrypted_secret from vault.decrypted_secrets where name = 'facebook_page_token'),
    'hook_secret', (select decrypted_secret from vault.decrypted_secrets where name = 'facebook_hook_secret'));
$$;
revoke all on function public.lire_config_facebook() from public, anon, authenticated;
grant execute on function public.lire_config_facebook() to service_role;

-- La fonction Edge prend les publications dues (verrou, une à la fois) puis note le résultat.
create or replace function public.publications_avis_prendre(p_limite int default 1)
returns setof public.publications_avis
language sql security definer set search_path to 'public'
as $$
  update public.publications_avis p
     set statut = 'en_cours', tentatives = tentatives + 1, updated_at = now()
   where p.id in (select id from public.publications_avis
                   where statut = 'a_publier' and prevue_le <= now()
                   order by prevue_le
                   limit greatest(1, least(p_limite, 3))
                   for update skip locked)
  returning p.*;
$$;
revoke all on function public.publications_avis_prendre(int) from public, anon, authenticated;
grant execute on function public.publications_avis_prendre(int) to service_role;

create or replace function public.publications_avis_noter(p_id uuid, p_ok boolean, p_post_id text, p_erreur text)
returns void
language sql security definer set search_path to 'public'
as $$
  update public.publications_avis
     set statut = case when p_ok then 'publiee'
                       when tentatives >= 3 then 'echec'
                       else 'a_publier' end,
         publiee_le = case when p_ok then now() end,
         prevue_le = case when p_ok then prevue_le else now() + interval '30 minutes' end,
         facebook_post_id = p_post_id,
         erreur = left(p_erreur, 500),
         updated_at = now()
   where id = p_id and statut = 'en_cours';
$$;
revoke all on function public.publications_avis_noter(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.publications_avis_noter(uuid, boolean, text, text) to service_role;

-- Réveil : n'appelle la fonction Edge QUE si un jeton de Page existe ET qu'une publication est due.
create or replace function public.reveiller_publication_avis()
returns void
language plpgsql security definer set search_path to ''
as $$
declare v_secret text;
begin
  if not exists (select 1 from vault.secrets where name = 'facebook_page_token') then return; end if;
  if not exists (select 1 from public.publications_avis where statut = 'a_publier' and prevue_le <= now()) then return; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'facebook_hook_secret';
  if v_secret is null then return; end if;
  perform net.http_post(
    url     := 'https://bmdveawomizjpiebgtkj.supabase.co/functions/v1/publier-avis-facebook',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end $$;
revoke all on function public.reveiller_publication_avis() from public, anon, authenticated;

-- Secret du crochet, généré en base, jamais affiché.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'facebook_hook_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'facebook_hook_secret');
  end if;
  if not exists (select 1 from vault.secrets where name = 'facebook_page_id') then
    perform vault.create_secret('61594104278047', 'facebook_page_id');
  end if;
end $$;

select cron.unschedule(jobid) from cron.job where jobname = 'publier-avis-facebook';
select cron.schedule('publier-avis-facebook', '*/10 * * * *', 'select public.reveiller_publication_avis();');

-- Avis existants : seul l'avis de TF-371 (Rougail saucisse, plat laboratoire) est planifié.
-- Les autres avis déjà déposés ne partent pas rétroactivement : celui d'Alain (4,5) porte
-- une critique que la règle par étoiles aurait publiée comme un compliment.
select public.planifier_publication_avis('15e32a9c-b700-496a-a990-c9974fa5b5e2');
