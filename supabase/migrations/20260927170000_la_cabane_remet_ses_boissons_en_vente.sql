-- Pourquoi : les 14 boissons de La Cabane étaient invisibles parce que ses deux
-- catégories (Bières, Softs) étaient éteintes — et on ne pouvait pas les rallumer
-- telles quelles : cinq images en base ne montraient pas le bon produit, et ces
-- fichiers du bucket `boissons/` sont PARTAGÉS avec Angelo. Ses vraies bouteilles
-- ont été photographiées, détourées et déposées sous `produits/la-cabane/boissons/`
-- (par `deposer-visuel`, les 12 URL répondent 200) : on repointe La Cabane seule,
-- Angelo garde ses fichiers. Puis : le Caprice Citron (création, promo 4 500),
-- la consigne de 2 000 Ar sur le VERRE uniquement (11 bouteilles ; Eau Vive = PET,
-- World Cola en attente de réponse), le Sirop sorti de la carte ET de la commande,
-- et les deux catégories rallumées EN DERNIER. Les 14 prix ne bougent pas.
--
-- Chaque étape compte ses lignes et s'arrête si le compte n'est pas celui annoncé.
-- Décision du porteur du projet : consigne et emballage restent commissionnés —
-- aucune formule touchée.

do $$
declare
  r constant uuid := '958faac6-61ab-4ff5-9226-b8adab46ed24';
  softs constant uuid := 'd9acdb13-2ffd-4f80-98dc-7851979f1f97';
  base constant text := 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/la-cabane/boissons/';
  n integer; n_prix integer;
begin
  -- 0) Les prix d'origine, pour les comparer à la fin.
  select count(*) into n_prix from public.products p
   where p.restaurant_id = r and p.category_id in ('0a3e9dab-5575-460d-8ff4-ac37078a7433', softs);
  if n_prix <> 14 then raise exception 'attendu 14 boissons chez La Cabane, trouvé %', n_prix; end if;

  -- 1) Les vraies bouteilles (12 produits existants, World Cola exclu).
  update public.products p set photo_url = base || m.fichier
    from (values
      ('Beaufort', 'beaufort.png'), ('Bonbon Anglais', 'caprice-bonbon-anglais.png'),
      ('Caprice Grenadine', 'caprice-grenadine.png'), ('Caprice Orange', 'caprice-orange.png'),
      ('Cristal', 'cristal.png'), ('Eau Vive PM', 'eau-vive.png'), ('Eau Vive GM', 'eau-vive.png'),
      ('Fresh PM', 'fresh.png'), ('Gold', 'gold.png'), ('THB GM', 'thb-gm.png'),
      ('THB PM', 'thb-pm.png'), ('Tonic', 'tonic.png')
    ) as m(nom, fichier)
   where p.restaurant_id = r and p.name = m.nom and not p.is_archived;
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'photos : attendu 12 lignes, touché %', n; end if;

  -- 2) Le Caprice Citron : création, promo à 4 500 (les autres Caprice sont à 5 000).
  if exists (select 1 from public.products where restaurant_id = r and name = 'Caprice Citron') then
    raise exception 'Caprice Citron existe déjà chez La Cabane';
  end if;
  insert into public.products (restaurant_id, category_id, name, price, in_menu, is_available, listing_status,
                               sort_order, photo_url, packaging_fee, packaging_label)
  values (r, softs, 'Caprice Citron', 4500, true, true, 'visible',
          (select coalesce(max(sort_order), 0) + 5 from public.products where category_id = softs and name like 'Caprice%'),
          base || 'caprice-citron.png', 2000, 'Consigne bouteille');

  -- 3) La consigne sur le verre (10 existants + le Citron créé avec = 11).
  update public.products set packaging_fee = 2000, packaging_label = 'Consigne bouteille'
   where restaurant_id = r and not is_archived
     and name in ('Cristal', 'Caprice Orange', 'Caprice Grenadine', 'Bonbon Anglais', 'Tonic',
                  'THB PM', 'THB GM', 'Gold', 'Beaufort', 'Fresh PM');
  get diagnostics n = row_count;
  if n <> 10 then raise exception 'consigne : attendu 10 lignes, touché %', n; end if;

  -- 4) Le Sirop : hors carte ET hors commande (in_menu seul laisserait passer un lien partagé).
  update public.products set in_menu = false, is_available = false
   where restaurant_id = r and name = 'Sirop' and not is_archived;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Sirop : attendu 1 ligne, touché %', n; end if;

  -- 5) EN DERNIER : les deux catégories, et tout est en vente à la seconde.
  update public.categories set is_active = true
   where restaurant_id = r and name in ('Bières', 'Softs');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'catégories : attendu 2 lignes, touché %', n; end if;
end $$;
