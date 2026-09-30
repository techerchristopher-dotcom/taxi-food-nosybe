-- Notation et avis clients — lot 3 (2026-09-30) : la photo du plat par le client.
-- Conception : docs/NOTATION-AVIS.md.
--
-- Bucket public `avis` : un client n'écrit que dans SON dossier (`<uid>/…`), jamais
-- de mise à jour ni de suppression (une photo posée reste posée ; l'admin masque
-- l'avis). `deposer_avis` n'accepte qu'une URL de ce bucket, sous le dossier de
-- l'appelant : impossible de faire pointer un avis vers une image étrangère.
--
-- ⚠️ Les quatre RPC qui rendent un avis changent de forme (colonne `photo_url`) :
-- on les DROP avant de les recréer — `create or replace` refuse de changer le type
-- de retour, et une nouvelle signature de `deposer_avis` ferait une SURCHARGE
-- (PGRST203, piège documenté sur create_order). Les droits sont reposés à la fin.

alter table public.avis add column if not exists photo_url text;

insert into storage.buckets (id, name, public) values ('avis', 'avis', true)
on conflict (id) do nothing;

drop policy if exists "avis_lecture_publique" on storage.objects;
create policy "avis_lecture_publique" on storage.objects
  for select using (bucket_id = 'avis');

drop policy if exists "avis_ecriture_proprietaire" on storage.objects;
create policy "avis_ecriture_proprietaire" on storage.objects
  for insert with check (
    bucket_id = 'avis'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- deposer_avis : + p_photo_url
-- =====================================================================
drop function if exists public.deposer_avis(uuid, integer, integer, integer, text, boolean, text);

create or replace function public.deposer_avis(
  p_order_id     uuid,
  p_cuisine      integer,
  p_preparation  integer,
  p_livraison    integer,
  p_commentaire  text default null,
  p_consentement boolean default false,
  p_langue       text default 'fr',
  p_photo_url    text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid      uuid := auth.uid();
  v_o        public.orders;
  v_nom      text;
  v_comm     text := nullif(btrim(coalesce(p_commentaire, '')), '');
  v_photo    text := nullif(btrim(coalesce(p_photo_url, '')), '');
  v_langue   text := case when p_langue in ('fr', 'en', 'it') then p_langue else 'fr' end;
  v_avis_id  uuid;
  v_base     text;
  v_candidat text;
  v_suffixe  integer := 1;
  v_code     public.promo_codes;
  v_expire   timestamptz := now() + interval '30 days';
  c_montant  constant integer := 2000;
begin
  if v_uid is null then
    raise exception 'Connexion requise' using errcode = '42501';
  end if;
  if p_cuisine is null or p_preparation is null or p_livraison is null
     or p_cuisine not between 1 and 5 or p_preparation not between 1 and 5
     or p_livraison not between 1 and 5 then
    raise exception 'avis:notes_invalides' using errcode = '22023';
  end if;
  if v_comm is not null and length(v_comm) > 500 then
    raise exception 'avis:commentaire_trop_long' using errcode = '22023';
  end if;
  -- La photo doit venir du bucket `avis`, sous le dossier de l'appelant.
  if v_photo is not null and v_photo not like
     'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/avis/' || v_uid::text || '/%' then
    raise exception 'avis:photo_invalide' using errcode = '22023';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null or v_o.user_id is distinct from v_uid then
    raise exception 'avis:commande_introuvable' using errcode = '42501';
  end if;
  if v_o.status <> 'livree' then
    raise exception 'avis:commande_non_livree' using errcode = '22023';
  end if;
  if coalesce(v_o.delivered_at, v_o.status_updated_at) < now() - interval '7 days' then
    raise exception 'avis:trop_tard' using errcode = '22023';
  end if;
  if exists (select 1 from public.commandes_telephone ct where ct.order_id = v_o.id) then
    raise exception 'avis:commande_telephone' using errcode = '22023';
  end if;
  if exists (select 1 from public.avis a where a.order_id = v_o.id) then
    raise exception 'avis:deja_depose' using errcode = '23505';
  end if;

  select p.full_name into v_nom from public.profiles p where p.id = v_uid;

  insert into public.avis (order_id, user_id, restaurant_id, courier_id,
                           note_cuisine, note_preparation, note_livraison,
                           commentaire, prenom_affiche, consentement_publication, langue, photo_url)
  values (v_o.id, v_uid, v_o.restaurant_id, v_o.courier_id,
          p_cuisine, p_preparation, p_livraison,
          v_comm, public.prenom_affiche(v_nom), coalesce(p_consentement, false), v_langue, v_photo)
  returning id into v_avis_id;

  v_base := 'AVIS' || substr(public.code_offert_nom_de_base(v_nom), 6);
  loop
    v_candidat := case when v_suffixe = 1 then v_base else v_base || v_suffixe::text end;
    if not exists (select 1 from public.promo_codes pc where pc.code_normalise = v_candidat) then
      begin
        insert into public.promo_codes (
          code, type_remise, valeur, porte_sur, actif, commence_le, expire_le,
          max_utilisations, description, beneficiaire_id, restaurant_id,
          inclut_emballage, exclut_boissons, pris_en_charge_par, commande_origine_id)
        values (
          v_candidat, 'montant', c_montant, 'livraison', true, now(), v_expire,
          1, 'Merci pour votre avis', v_uid, null,
          false, false, 'taxi_food', v_o.id)
        returning * into v_code;
      exception when unique_violation then
        v_code := null;
      end;
    end if;
    exit when v_code.id is not null;
    v_suffixe := v_suffixe + 1;
    if v_suffixe > 999 then
      raise exception 'avis:code_introuvable';
    end if;
  end loop;

  update public.avis set code_promo_id = v_code.id where id = v_avis_id;

  return jsonb_build_object('code', v_code.code, 'valeur', v_code.valeur, 'expire_le', v_code.expire_le);
end $$;

-- =====================================================================
-- mon_avis : + photo_url
-- =====================================================================
drop function if exists public.mon_avis(uuid);
create or replace function public.mon_avis(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
           'note_cuisine', a.note_cuisine,
           'note_preparation', a.note_preparation,
           'note_livraison', a.note_livraison,
           'commentaire', a.commentaire,
           'photo_url', a.photo_url,
           'consentement_publication', a.consentement_publication,
           'created_at', a.created_at,
           'code', pc.code,
           'code_valeur', pc.valeur,
           'code_expire_le', pc.expire_le)
    from public.avis a
    left join public.promo_codes pc on pc.id = a.code_promo_id
   where a.order_id = p_order_id and a.user_id = auth.uid();
$$;

-- =====================================================================
-- avis_restaurant (public) : + photo_url
-- =====================================================================
drop function if exists public.avis_restaurant(uuid, integer, integer);
create or replace function public.avis_restaurant(
  p_restaurant_id uuid,
  p_limite        integer default 20,
  p_decalage      integer default 0)
returns table (
  id uuid, prenom text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, created_at timestamptz,
  reponse_restaurant text, reponse_le timestamptz,
  photo_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le,
         a.photo_url
    from public.avis a
   where a.restaurant_id = p_restaurant_id and a.statut = 'publie'
   order by a.created_at desc
   limit least(greatest(coalesce(p_limite, 20), 1), 100)
  offset greatest(coalesce(p_decalage, 0), 0);
$$;

-- =====================================================================
-- avis_de_mon_restaurant (staff) : + photo_url
-- =====================================================================
drop function if exists public.avis_de_mon_restaurant(uuid);
create or replace function public.avis_de_mon_restaurant(p_restaurant_id uuid)
returns table (
  id uuid, order_id uuid, order_number text, prenom text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, created_at timestamptz,
  reponse_restaurant text, reponse_le timestamptz, statut text,
  photo_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.order_id, o.order_number, a.prenom_affiche,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.created_at,
         a.reponse_restaurant, a.reponse_le, a.statut,
         a.photo_url
    from public.avis a
    join public.orders o on o.id = a.order_id
   where a.restaurant_id = p_restaurant_id
     and public.is_active_restaurant_staff_of(p_restaurant_id)
   order by a.created_at desc
   limit 200;
$$;

-- =====================================================================
-- admin_avis_lister : + photo_url
-- =====================================================================
drop function if exists public.admin_avis_lister(text);
create or replace function public.admin_avis_lister(p_filtre text default 'tous')
returns table (
  id uuid, created_at timestamptz,
  restaurant_id uuid, restaurant text,
  order_id uuid, order_number text,
  prenom text, client text,
  note_cuisine smallint, note_preparation smallint, note_livraison smallint, note_restaurant numeric,
  commentaire text, langue text, consentement boolean, statut text,
  reponse_restaurant text, reponse_le timestamptz,
  utilise_reseaux_le timestamptz, code text,
  photo_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.id, a.created_at,
         a.restaurant_id, r.name,
         a.order_id, o.order_number,
         a.prenom_affiche, p.full_name,
         a.note_cuisine, a.note_preparation, a.note_livraison, a.note_restaurant,
         a.commentaire, a.langue, a.consentement_publication, a.statut,
         a.reponse_restaurant, a.reponse_le,
         a.utilise_reseaux_le, pc.code,
         a.photo_url
    from public.avis a
    join public.restaurants r on r.id = a.restaurant_id
    join public.orders o on o.id = a.order_id
    left join public.profiles p on p.id = a.user_id
    left join public.promo_codes pc on pc.id = a.code_promo_id
   where public.is_admin()
     and case coalesce(p_filtre, 'tous')
           when 'consentis_non_utilises'
             then (a.consentement_publication and a.utilise_reseaux_le is null
                   and a.statut = 'publie' and a.commentaire is not null)
           when 'masques' then a.statut = 'masque'
           when 'faibles' then (a.note_restaurant <= 2 or a.note_livraison <= 2)
           else true
         end
   order by a.created_at desc
   limit 300;
$$;

-- =====================================================================
-- Droits (reposés : un DROP les efface)
-- =====================================================================
revoke all on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text, text) from public;
revoke all on function public.mon_avis(uuid) from public;
revoke all on function public.avis_restaurant(uuid, integer, integer) from public;
revoke all on function public.avis_de_mon_restaurant(uuid) from public;
revoke all on function public.admin_avis_lister(text) from public;

grant execute on function public.deposer_avis(uuid, integer, integer, integer, text, boolean, text, text) to authenticated;
grant execute on function public.mon_avis(uuid) to authenticated;
grant execute on function public.avis_restaurant(uuid, integer, integer) to anon, authenticated;
grant execute on function public.avis_de_mon_restaurant(uuid) to authenticated;
grant execute on function public.admin_avis_lister(text) to authenticated;

do $$
declare n integer;
begin
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'deposer_avis';
  if n <> 1 then raise exception 'deposer_avis : % surcharge(s), attendu 1', n; end if;
  if not exists (select 1 from storage.buckets where id = 'avis') then
    raise exception 'bucket avis absent';
  end if;
end $$;
