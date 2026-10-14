-- L'escale Créole : « Riz frit poulet ou zébu » à 35 000 Ar (porteur du projet, 2026-10-14).
-- Trouvé en vente à 0 Ar le soir de l'ouverture (is_available = true, price = 0) : corrigé
-- aussitôt, aucune commande ne l'avait encore pris. Contrôle : plus aucun plat disponible à 0 Ar
-- dans un restaurant visible.
do $$
declare n int;
begin
  update public.products set price = 35000, is_available = true
   where id = 'f995abf6-25df-4d40-9e46-b9e96de776df';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'produit attendu 1, trouve %', n; end if;
end $$;
