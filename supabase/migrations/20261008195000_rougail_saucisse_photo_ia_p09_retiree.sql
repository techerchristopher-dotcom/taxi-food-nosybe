-- Rougail saucisse : p09.jpg n'est PAS ce plat (viande en sauce et pommes de terre, pas de
-- saucisses) — constat du porteur du projet. Le plat prend son visuel IA en liste ET en fiche
-- (« Image d'illustration ») ; la vraie photo est celle du client, sur l'avis de TF-371.
do $$
declare n int;
begin
  update public.products
     set photo_url = 'https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/produits/le-nandipo/plats/rougail-saucisse-ia.jpg',
         vraie_photo_url = null
   where id = '036c85c1-ea09-4c72-800c-b80fc95e849f' and name = 'Rougail saucisse';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'rougail: % ligne(s)', n; end if;
end $$;
