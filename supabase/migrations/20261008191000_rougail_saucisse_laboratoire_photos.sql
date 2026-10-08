-- Rougail saucisse du Nandipo = plat laboratoire « visuel IA en liste, vraie photo en fiche,
-- avis et photos des clients » (2026-10-08, demande du porteur du projet).
--
-- 1. Vraie photo du restaurant : p09.jpg, photo envoyée par le patron (déjà en photo_url).
-- 2. Photo de l'avis de TF-371 (Jenn / compte Opaline Création, 5/5/5, publication
--    consentie) : la cliente l'a envoyée par WhatsApp au porteur du projet, déposée par
--    deposer-visuel dans produits/avis-clients/<user_id>/ (le bucket `avis` n'est pas dans
--    la liste blanche de deposer-visuel).
do $$
declare n int;
begin
  update public.products
     set vraie_photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/p09.jpg'
   where id = '036c85c1-ea09-4c72-800c-b80fc95e849f' and name = 'Rougail saucisse';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'rougail: % ligne(s)', n; end if;

  update public.avis
     set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/avis-clients/47ceb224-0d7d-4beb-8d62-169d627d7e64/tf-371-rougail-saucisse.jpg'
   where id = '15e32a9c-b700-496a-a990-c9974fa5b5e2' and photo_url is null;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'avis TF-371: % ligne(s)', n; end if;
end $$;
