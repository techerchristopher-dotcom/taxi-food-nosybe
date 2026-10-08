-- L'escale Créole : logo officiel (2026-10-08, validé par le porteur du projet). Emblème généré
-- (Higgsfield, élément drapeau `f7814ee9`) : La Réunion remplie du drapeau 974 ; nom et sous-titre
-- posés en VRAI texte (Archivo), jamais dessinés par le modèle.
-- Source : visuels-reseaux/plats-du-jour/escale-creole/generations-2026-10-08/logo-escale-creole-974.png.
do $$
declare n int;
begin
  update public.restaurants
     set logo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/divers/logo.png'
   where id = '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'logo escale : % ligne(s)', n; end if;
end $$;
