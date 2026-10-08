-- Tri des photos existantes, partie SÛRE seulement (2026-10-08).
-- Une photo n'est déclarée « vraie » que si son origine est certaine :
--   * nom de fichier « -reel » (photos réelles reçues des restaurants, La Cabane / La Plage) ;
--   * photo déposée par le restaurateur depuis son espace (bucket `partenaires/`) ;
--   * photos du patron du Nandipo (`le-nandipo/plats/pNN.jpg`).
-- La photo réelle reste aussi en photo_url tant qu'aucun visuel IA ne la remplace en liste.
-- Tout le reste (packshots .png, reconstitutions, M&K dont certaines viennent d'Internet,
-- L'escale Créole, plats du jour de Chez Bidule & Truc) attend une confirmation humaine :
-- liste dans « Claude outputs/tri-photos-plats.csv ».
do $$
declare n int;
begin
  update public.products p
     set vraie_photo_url = p.photo_url
    from public.restaurants r
   where r.id = p.restaurant_id and r.listing_status <> 'hidden'
     and not p.is_archived and p.vraie_photo_url is null
     and (p.photo_url ~ '-reel\.(jpg|jpeg|png)$'
          or p.photo_url ~ '/public/partenaires/'
          or p.photo_url ~ '/le-nandipo/plats/p[0-9]+\.jpg$');
  get diagnostics n = row_count;
  if n <> 20 then raise exception 'tri sur : % ligne(s), 20 attendues', n; end if;
end $$;
