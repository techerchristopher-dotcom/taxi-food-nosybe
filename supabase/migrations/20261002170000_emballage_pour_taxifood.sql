-- L'emballage peut revenir à TAXI FOOD plutôt qu'au restaurant (Les Siciliens, 2026-10-02 :
-- « pas de commission, mais le carton d'emballage me revient » — 3 000 Ar par pizza,
-- 1 000 Ar par burger). Le client paie exactement la même chose ; seul le partage change.
--
-- 1. restaurants.emballage_pour_taxifood : le réglage (faux partout sauf Les Siciliens).
-- 2. orders.emballage_taxifood : la part d'emballage qui revient à Taxi Food, FIGÉE sur la
--    commande par un trigger (changer le réglage ne réécrit pas le passé). create_order pose
--    packaging_fee APRÈS l'insertion (UPDATE) : le trigger couvre donc INSERT et UPDATE.
-- 3. Formule du dû : plats + (emballage − emballage_taxifood) − commission − part offerte,
--    dans mark_order_delivered, record_settlement, admin_commandes_a_reverser et
--    versement_enregistrer_core. La commission ne porte pas non plus sur le carton de Taxi Food.
--    Côté admin (lib/reversement.ts) la même part entre dans la MARGE : dû + marge = encaissé.

alter table public.restaurants
  add column if not exists emballage_pour_taxifood boolean not null default false;

alter table public.orders
  add column if not exists emballage_taxifood integer not null default 0
  constraint orders_emballage_taxifood_check check (emballage_taxifood >= 0);

create or replace function public.figer_emballage_taxifood()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and new.packaging_fee is not distinct from old.packaging_fee then
    return new;
  end if;
  new.emballage_taxifood := case
    when (select r.emballage_pour_taxifood from public.restaurants r where r.id = new.restaurant_id)
      then greatest(coalesce(new.packaging_fee, 0), 0)
    else 0 end;
  return new;
end $function$;

drop trigger if exists orders_figer_emballage_taxifood on public.orders;
create trigger orders_figer_emballage_taxifood
  before insert or update of packaging_fee on public.orders
  for each row execute function public.figer_emballage_taxifood();

-- Réécriture ciblée des quatre fonctions, idempotente, qui échoue bruyamment si le motif a changé.
do $$
declare
  f text;
  d text;
  n int;
begin
  foreach f in array array['record_settlement','admin_commandes_a_reverser','versement_enregistrer_core'] loop
    select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
     where s.nspname = 'public' and p.proname = f;
    if position('emballage_taxifood' in d) > 0 then continue; end if;
    n := (length(d) - length(replace(d, 'o.packaging_fee', ''))) / length('o.packaging_fee');
    if n = 0 then raise exception '% : motif o.packaging_fee introuvable', f; end if;
    execute replace(d, 'o.packaging_fee', '(o.packaging_fee - o.emballage_taxifood)');
    raise notice '% : % occurrence(s) remplacée(s)', f, n;
  end loop;

  select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname = 'mark_order_delivered';
  if position('emballage_taxifood' in d) = 0 then
    if position('subtotal + packaging_fee - remise_charge_restaurant' in d) = 0 then
      raise exception 'mark_order_delivered : motif de commission introuvable';
    end if;
    execute replace(d, 'subtotal + packaging_fee - remise_charge_restaurant',
                       'subtotal + packaging_fee - emballage_taxifood - remise_charge_restaurant');
  end if;
end $$;

-- Les Siciliens : commission 0, carton à Taxi Food.
update public.restaurants
   set emballage_pour_taxifood = true, commission_rate = 0
 where id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b';

-- Leurs emballages : 3 000 Ar par pizza (était 2 000), 1 000 Ar par burger.
update public.products p
   set packaging_fee = 3000, packaging_label = 'Boîte à pizza'
  from public.categories c
 where c.id = p.category_id and p.restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b'
   and c.name = 'Pizza';

update public.products
   set packaging_fee = 1000, packaging_label = 'Emballage à emporter'
 where restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b'
   and name in ('Burger','Cheeseburger','Big cheeseburger','Chicken burger','Chicken cheeseburger','Crispy burger');
