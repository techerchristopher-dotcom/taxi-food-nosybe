-- La famille Taxi Food à l'accueil (2026-10-22, demande du porteur du projet).
--
-- Sur l'accueil, chaque restaurant montre désormais SON PERSONNAGE (mascotte) à la place
-- de son logo, et un BANDEAU photo au même format pour tous. Le logo, lui, reste sur la
-- fiche du restaurant (sous sa couverture). Deux colonnes distinctes de logo_url / cover_url :
--   - le restaurateur continue de gérer son logo et sa couverture dans ses Réglages ;
--   - mascotte et bandeau sont des créations Taxi Food, au gabarit commun (avatar carré
--     600 px, bandeau 1200 x 480), fabriquées par visuels-reseaux/famille-taxi-food/scripts/.
-- NULL = repli : l'app retombe sur le logo, et sur la couverture puis l'aplat de couleur.

alter table public.restaurants
  add column if not exists mascotte_url text,
  add column if not exists banniere_url text;

comment on column public.restaurants.mascotte_url is
  'Personnage de la famille Taxi Food (avatar carré, gabarit commun). Remplace le logo sur l''accueil.';
comment on column public.restaurants.banniere_url is
  'Bandeau d''accueil 1200x480 au gabarit commun. Repli : cover_url.';

do $$
declare
  base constant text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/famille/';
  n int;
begin
  update public.restaurants r set
    mascotte_url = case when v.avatar then base || 'avatar-' || v.slug || '.png' end,
    banniere_url = base || 'bandeau-' || v.slug || '.jpg'
  from (values
    ('958faac6-61ab-4ff5-9226-b8adab46ed24'::uuid, 'la-cabane', true),
    ('aee1c612-5ee0-402b-a7b4-aec9c6825b0b'::uuid, 'les-siciliens', true),
    ('128e68ab-8e64-4f48-bf79-acc67f3deca9'::uuid, 'escale-creole', true),
    ('eb10f338-fb78-4c16-82d5-810ae37b49fe'::uuid, 'la-plage', true),
    ('56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'::uuid, 'chez-m-et-k', true),
    ('f418e6c3-4dfa-4494-8a47-d744cdf0ac02'::uuid, 'manson', true),
    ('ba08c074-bc2f-4d0c-b087-ecdf7925269f'::uuid, 'madame-oh', false),
    ('c2a49e11-d839-459f-a332-024796102155'::uuid, 'oh-hazar', false)
  ) as v(id, slug, avatar)
  where r.id = v.id;
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'famille : 8 restaurants attendus, % mis à jour', n;
  end if;
end $$;
