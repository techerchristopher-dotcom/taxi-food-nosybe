-- Chez M&K : commission de 10 %, et sa première commande recalculée (2026-09-22).
--
-- POURQUOI. La fiche de création (20260921100000) alignait M&K sur 5 %, comme La Cabane et Chez
-- Bidul. Le porteur du projet l'a corrigé ce jour : son accord avec Kenny est à 10 %.
--
-- POURQUOI TF-265 EST RECALCULÉE. Une commande FIGE son taux à la création
-- (`orders.commission_rate` / `commission_amount`) : changer le restaurant ne change pas les
-- commandes passées. TF-265, première vraie commande de M&K (livrée le 22/09), est partie à 5 %.
-- Elle n'a encore été reversée à personne (aucune ligne dans `restaurant_settlements` pour M&K) :
-- on peut la remettre au bon taux sans fausser un versement déjà fait. Même base que le calcul
-- d'origine : les plats (`subtotal`), soit 30 000 Ar → 3 000 Ar.
--
-- Garde : ne touche TF-265 que tant qu'aucun reversement n'existe pour ce restaurant.
update public.restaurants
   set commission_rate = 0.10
 where id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53';

update public.orders o
   set commission_rate = 0.10,
       commission_amount = round(o.subtotal * 0.10)
 where o.restaurant_id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53'
   and o.commission_rate = 0.05
   and not exists (select 1 from public.restaurant_settlements s
                   where s.restaurant_id = o.restaurant_id);
