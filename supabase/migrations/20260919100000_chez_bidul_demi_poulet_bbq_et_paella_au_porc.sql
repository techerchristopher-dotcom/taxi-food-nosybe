-- Chez Bidul & Truc : le 1/2 poulet grillé BBQ rejoint l'affiche, et la paella dit enfin
-- qu'elle contient du porc (2026-09-19).
--
-- POURQUOI LE BADGE D'ABORD. La paella de la maison est au chorizo. Sa ligne est partie sans
-- `diet_tags` le 18/09 : l'app et le site n'affichaient donc AUCUN avertissement. À Nosy Be,
-- une part de la clientèle ne mange pas de porc — un plat qui en contient sans le dire, c'est
-- un client perdu pour de bon, pas une imprécision de catalogue. La valeur `porc` n'est pas
-- nouvelle : 16 produits du catalogue la portent déjà (cordon bleu, croque-monsieur…), c'est
-- le même tableau `products.diet_tags` et le même badge.
--
-- POURQUOI LE 1/2 POULET N'A PAS DE CATÉGORIE. Comme les sept autres plats du jour :
-- `category_id` null et `in_menu = false`, donc il ne vit que dans le bandeau « Offre du jour »
-- et n'hérite d'AUCUNE plage horaire. Avec une catégorie, il deviendrait indisponible le soir
-- sans que personne comprenne pourquoi.
--
-- POURQUOI LES ANCIENS NE SONT PAS TOUCHÉS. `is_featured = false` suffit à les sortir de
-- l'affiche ; les archiver les ferait quitter la bibliothèque du restaurateur
-- (`getFeaturedLibrary` filtre `is_archived = false`) et détruirait le retour en un tap.
--
-- PRIX : 30 000 Ar, le tarif de tous ses plats du jour (porteur du projet, 2026-09-19).
--
-- La remise à l'affiche de la paella n'est PAS ici : elle passe par `set_product_featured`,
-- qui porte les contrôles de la session restaurateur.
--
-- Idempotent : ne recrée pas un plat du même nom déjà présent et non archivé.
insert into public.products
  (restaurant_id, category_id, name, description, price, photo_url,
   is_available, stock_quantity, is_featured, featured_label, in_menu, sort_order, diet_tags)
select '700e8f32-e966-476a-b371-02884d08dea1', null, v.name, null, 30000, null,
       true, null, true, 'Plat du jour', false, v.ord, '{}'::text[]
from (values ('1/2 poulet grillé BBQ', 8)) as v(name, ord)
where not exists (
  select 1 from public.products p
  where p.restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
    and lower(p.name) = lower(v.name)
    and not p.is_archived
);

-- Le badge porc de la paella. Clause de garde : ce seul plat, non archivé.
update public.products
   set diet_tags = array['porc']
 where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and lower(name) = 'paella'
   and not is_archived
   and not ('porc' = any(diet_tags));
