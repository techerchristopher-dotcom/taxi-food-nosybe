-- La Cabane : emballage à emporter, 1 000 Ar par plat
-- (décision du porteur du projet, 2026-09-27).
--
-- PÉRIMÈTRE ARRÊTÉ AVEC LUI : tout ce qui part dans une barquette ou un papier —
-- Sandwichs & Repas (7), Burgers (6), Extras (3), Crêpes (9). VINGT-CINQ lignes.
-- PAS les boissons (elles porteront leur propre consigne) et PAS les milkshakes.
--
-- Vingt-cinq et non vingt-six : la « Crêpe Ultra Gourmande » a été retirée de sa
-- carte le 2026-09-25 (migration `la_cabane_retire_la_crepe_ultra_gourmande`).
-- Le garde-fou a rattrapé le compte périmé — c'est à ça qu'il sert.
--
-- LA COMMISSION RESTE SUR L'EMBALLAGE, c'est explicitement voulu. `create_order`
-- calcule déjà `commission = round((subtotal + packaging − remise_resto) × taux)`
-- et `record_settlement` fait pareil : il n'y a donc RIEN à changer côté
-- fonctions. Cette note existe pour que personne ne « corrige » plus tard ce qui
-- n'est pas un bug.
--
-- UN PRODUIT NE PORTE QU'UN SEUL FRAIS. `products.packaging_fee` est unique par
-- ligne : un plat à 1 000 d'emballage ne peut pas aussi porter une consigne.
-- C'est sans conséquence ici — les deux périmètres sont disjoints, l'emballage
-- sur la nourriture, la consigne sur les bouteilles. Le panier affichera deux
-- lignes distinctes, `packagingLines()` regroupant par libellé.
--
-- LES 30 PIZZAS de Chez Bidul & Truc et des Siciliens ne sont PAS touchées :
-- elles gardent « Boîte à pizza » à 2 000. Le filtre porte sur La Cabane seule.
--
-- Garde : exactement 25 lignes, et seulement celles qui n'avaient aucun frais.
do $$
declare
  v_resto uuid;
  n int;
begin
  select id into v_resto from public.restaurants where name = 'La Cabane';
  if v_resto is null then raise exception 'restaurant introuvable'; end if;

  update public.products p
     set packaging_fee = 1000,
         packaging_label = 'Emballage à emporter'
    from public.categories c
   where c.id = p.category_id
     and p.restaurant_id = v_resto
     and c.name in ('Sandwichs & Repas', 'Burgers', 'Extras', 'Crêpes')
     and not p.is_archived
     and coalesce(p.packaging_fee, 0) = 0;
  get diagnostics n = row_count;
  if n <> 25 then
    raise exception 'attendu 25 plats sans frais, trouve %', n;
  end if;
end $$;
