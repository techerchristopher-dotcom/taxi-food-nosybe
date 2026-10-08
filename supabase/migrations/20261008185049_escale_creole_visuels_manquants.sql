-- L'escale Créole : visuels des 7 plats qui n'en avaient pas + Caprice Grenadine (2026-10-08,
-- validés par le porteur du projet). Générés (Higgsfield gpt_image_2) avec l'élément drapeau
-- `f7814ee9` en fond, mise en scène de la série (assiette à volute, natte vacoa, pierre volcanique),
-- grains = haricots blancs crème. Grenadine : packshot depuis l'élément `b3437ce4` (vraie canette) —
-- l'ancien `caprice-grenadine.png` montrait une bouteille de sirop.
-- Sources : visuels-reseaux/plats-du-jour/escale-creole/generations-2026-10-08/.
do $$
declare n int;
begin
  update public.products p
     set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/escale-creole/pj-' || v.fichier || '.jpg'
    from (values
      ('Émincé de poulet au brède chinois', 'emince-poulet-brede'),
      ('Émincé de zébu au poivre vert', 'emince-zebu-poivre-vert'),
      ('Émincé de poulet aux oignons', 'emince-poulet-oignons'),
      ('Émincé de zébu aux oignons', 'emince-zebu-oignons'),
      ('Émincé de poulet au gingembre', 'emince-poulet-gingembre'),
      ('Émincé de zébu au gingembre', 'emince-zebu-gingembre'),
      ('Riz frit poulet ou zébu', 'riz-frit'),
      ('Caprice Grenadine', 'caprice-grenadine')
    ) as v(nom, fichier)
   where p.restaurant_id = '128e68ab-8e64-4f48-bf79-acc67f3deca9' and not p.is_archived and p.name = v.nom;
  get diagnostics n = row_count;
  if n <> 8 then raise exception 'visuels escale : % ligne(s), 8 attendues', n; end if;
end $$;
