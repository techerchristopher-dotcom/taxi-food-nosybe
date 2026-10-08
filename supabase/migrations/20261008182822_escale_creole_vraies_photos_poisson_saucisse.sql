-- L'escale Créole : le poisson frit et la saucisse frite portent de VRAIES photos du restaurant
-- (fournies par le porteur du projet le 2026-10-08, partenaire /fredelice/visuels/) → vraie_photo_url,
-- pour que la fiche dise « Vraie photo » et non « Image d'illustration ».
do $$
declare n int;
begin
  update public.products
     set vraie_photo_url = photo_url
   where restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9' and not is_archived
     and name in ('Poisson frit entier', 'Saucisse frite')
     and photo_url in ('https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/pj-poisson-frit-photo.jpg',
                       'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/pj-saucisse-frite.jpg');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'vraies photos escale : % ligne(s), 2 attendues', n; end if;
end $$;
