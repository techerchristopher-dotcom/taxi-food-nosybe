-- Chez M&K : le steak à la chinoise passe de 30 000 à 25 000 Ar
-- (décision du porteur du projet, 2026-09-25, quelques minutes après la mise en
-- ligne).
--
-- Les 30 000 venaient de son Ti pan de steak de zébu, par analogie de ma part —
-- pas de lui. 25 000 est son prix. Le plat du jour passe donc SOUS tous ses
-- plats principaux : le moins cher de sa carte hors entrées est le Riz cantonais
-- et le Mi sao à 25 000. C'est une offre d'appel, et c'est voulu.
--
-- AUCUNE COMMANDE N'EST CONCERNÉE : vérifié avant application, `order_items` ne
-- porte aucune ligne pour ce plat. Personne n'a payé 30 000. Si ce n'avait pas
-- été le cas, on n'aurait rien touché rétroactivement — `unit_price` est un
-- instantané, il fige le prix du jour de la commande.
--
-- Garde : exactement 1 ligne, et seulement si elle est encore à 30 000.
do $$
declare n int;
begin
  update public.products p
     set price = 25000
    from public.restaurants r
   where r.id = p.restaurant_id
     and r.name ilike 'Chez M%K'
     and lower(p.name) = 'steak à la chinoise'
     and not p.is_archived
     and p.price = 30000;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'attendu 1 steak a la chinoise a 30000, trouve %', n;
  end if;
end $$;
