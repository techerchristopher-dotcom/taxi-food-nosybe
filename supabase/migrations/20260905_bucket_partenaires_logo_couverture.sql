-- Bucket dedie aux visuels deposes par les partenaires eux-memes (logo, couverture).
-- Ecriture scopee au personnel actif DU restaurant concerne, sur SON propre dossier
-- uniquement (jamais une policy ouverte a `public` — voir l'incident documente sur
-- les buckets produits/boissons dans CLAUDE.md).

insert into storage.buckets (id, name, public)
values ('partenaires', 'partenaires', true)
on conflict (id) do nothing;

create policy "partenaires_lecture_publique" on storage.objects
  for select using (bucket_id = 'partenaires');

create policy "partenaires_ecriture_personnel_actif" on storage.objects
  for insert with check (
    bucket_id = 'partenaires'
    and public.is_active_restaurant_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "partenaires_maj_personnel_actif" on storage.objects
  for update using (
    bucket_id = 'partenaires'
    and public.is_active_restaurant_staff_of(((storage.foldername(name))[1])::uuid)
  );

create policy "partenaires_suppression_personnel_actif" on storage.objects
  for delete using (
    bucket_id = 'partenaires'
    and public.is_active_restaurant_staff_of(((storage.foldername(name))[1])::uuid)
  );

create or replace function public.set_restaurant_photo(p_kind text, p_url text)
returns public.restaurants
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_resto_id uuid := public.current_restaurant_id();
  v_r public.restaurants;
begin
  if v_resto_id is null then
    raise exception 'Acces restaurant requis';
  end if;
  if p_kind not in ('logo', 'cover') then
    raise exception 'Type de visuel invalide (logo ou cover attendu)';
  end if;

  if p_kind = 'logo' then
    update public.restaurants set logo_url = p_url where id = v_resto_id returning * into v_r;
  else
    update public.restaurants set cover_url = p_url where id = v_resto_id returning * into v_r;
  end if;

  return v_r;
end;
$$;
