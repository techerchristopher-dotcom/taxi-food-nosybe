-- 2026-10-22 (2e version) : le bandeau d'accueil montre le PLAT LE PLUS VENDU du restaurant
-- (commandes livrées, hors boissons ; sans vente, son plat phare). Nouveaux noms de fichiers
-- (bandeau-plat-*) pour que les téléphones ne ressortent pas l'ancien bandeau de leur cache.
-- Bandeaux fabriqués par visuels-reseaux/famille-taxi-food/scripts/faire_bandeaux.py.
do $$
declare n int;
begin
  update public.restaurants
     set banniere_url = replace(banniere_url, '/famille/bandeau-', '/famille/bandeau-plat-')
   where banniere_url like '%/produits/famille/bandeau-%'
     and banniere_url not like '%/famille/bandeau-plat-%';
  get diagnostics n = row_count;
  if n <> 8 then
    raise exception 'bandeaux : 8 restaurants attendus, % mis à jour', n;
  end if;
end $$;
