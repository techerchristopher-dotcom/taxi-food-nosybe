-- La Cabane et L'escale Créole ne vendent AUCUNE canette : tout est en bouteille de verre
-- (consigne du porteur du projet, 2026-10-22).
--
-- Relevé avant correction (API publique + photos regardées une à une) :
--   * La Cabane : consigne à 2 000 Ar (passée à 1 000, voir 1 bis), World Cola sans consigne, et sa photo `produits/la-cabane/boissons/world-cola.png`
--     n'existe pas (404). Les 11 autres bouteilles en verre portent déjà « Consigne bouteille »
--     2 000 Ar ; Eau Vive (PET) et Sirop (hors carte) sans consigne : normal.
--   * L'escale Créole : toutes ses bouteilles en verre portent déjà la consigne à 1 000 Ar.
--     Mais deux PHOTOS montraient une canette : Coca-Cola 30 cl (`boissons/coca-cola-original.jpg`)
--     et Caprice Grenadine (`produits/escale-creole/pj-caprice-grenadine.jpg`).
--
-- Chaque étape compte ses lignes et refuse de passer si le compte diffère.
do $$
declare
  c_cabane constant uuid := '958faac6-61ab-4ff5-9226-b8adab46ed24';
  c_escale constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  n int;
begin
  -- 1. La Cabane : World Cola est en verre lui aussi ; sa photo cassée est retirée
  --    (repli propre de l'app plutôt qu'une image vide).
  update products set photo_url = null
   where restaurant_id = c_cabane and name = 'World Cola';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'World Cola : % ligne(s) au lieu de 1', n; end if;

  -- 1 bis. La Cabane : consigne ramenée de 2 000 à 1 000 Ar, comme L'escale (décision du porteur
  --    du projet, 2026-10-22 : +40 % sur une boisson à 5 000 freinait la vente). Toutes ses
  --    boissons en verre (12 : les 11 déjà consignées + World Cola). Eau Vive (PET) et Sirop exclus.
  update products p set packaging_fee = 1000, packaging_label = 'Consigne bouteille'
    from categories c
   where c.id = p.category_id and p.restaurant_id = c_cabane and c.est_boisson
     and p.name not ilike 'eau vive%' and p.name <> 'Sirop';
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'La Cabane consigne : % ligne(s) au lieu de 12', n; end if;

  -- 2. L'escale : Caprice Grenadine → la vraie bouteille en verre (déjà en Storage, celle de La Cabane).
  update products set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/la-cabane/boissons/caprice-grenadine.png'
   where restaurant_id = c_escale and name = 'Caprice Grenadine';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Caprice Grenadine : % ligne(s) au lieu de 1', n; end if;

  -- 3. L'escale : la photo du Coca est une canette, et aucune photo de bouteille Coca n'existe.
  --    Retirée (le fichier `boissons/coca-cola-original.jpg` reste en place : d'autres l'utilisent).
  update products set photo_url = null
   where restaurant_id = c_escale and name = 'Coca-Cola 30 cl';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Coca-Cola 30 cl : % ligne(s) au lieu de 1', n; end if;

  -- 4. Garde : à L'escale, toute boisson disponible hors eau et sirop porte la consigne à 1 000 Ar.
  select count(*) into n
    from products p join categories c on c.id = p.category_id
   where p.restaurant_id = c_escale and c.est_boisson and p.is_available
     and p.name not ilike 'eau vive%' and p.name <> 'Sirop'
     and (p.packaging_fee is distinct from 1000 or p.packaging_label is distinct from 'Consigne bouteille');
  if n <> 0 then raise exception 'L''escale : % boisson(s) en verre sans consigne à 1 000 Ar', n; end if;

  -- 5. Garde : à La Cabane, toute boisson disponible hors eau porte la consigne à 1 000 Ar.
  select count(*) into n
    from products p join categories c on c.id = p.category_id
   where p.restaurant_id = c_cabane and c.est_boisson and p.is_available
     and p.name not ilike 'eau vive%'
     and (p.packaging_fee is distinct from 1000 or p.packaging_label is distinct from 'Consigne bouteille');
  if n <> 0 then raise exception 'La Cabane : % boisson(s) en verre sans consigne à 1 000 Ar', n; end if;
end $$;
