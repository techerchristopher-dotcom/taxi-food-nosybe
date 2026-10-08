-- Plats du jour du 2026-10-08 (demande du porteur du projet) : à l'affiche, UNIQUEMENT
-- Chez Bidule & Truc (ragoût de mouton aux haricots blancs, osso bucco) + Le Nandipo (rougail
-- saucisse) — 3 plats. La notification de midi « C'est l'heure de miamer » ouvre la page
-- des plats du jour.
--
-- - Les autres plats « à l'affiche » (La Cabane : Tacos, Crêpe Gourmandise ; La Plage : 7 plats)
--   passent `is_featured = false` : JAMAIS archivés — ils restent dans la carte ou la
--   bibliothèque, chaque restaurateur peut les remettre en un tap.
-- - Route d'annonce « /plats-du-jour » autorisée (contrainte + `admin_creer_annonce`). L'écran
--   existe dans l'app depuis septembre : sans risque pour les versions installées.

update public.products set is_featured = false
 where is_featured and not is_archived
   and restaurant_id <> '700e8f32-e966-476a-b371-02884d08dea1'
   and not (restaurant_id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8' and name = 'Rougail saucisse');

update public.products set is_featured = true, featured_label = 'Plat du jour', is_available = true
 where restaurant_id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8' and name = 'Rougail saucisse' and not is_archived;

alter table public.annonces drop constraint if exists annonces_route_check;
alter table public.annonces add constraint annonces_route_check
  check (route is null or route in ('/', '/porte-monnaie', '/plats-du-jour')
         or route ~ '^/restaurant/[0-9a-f-]{36}$');

do $$
declare
  v_def text := pg_get_functiondef('public.admin_creer_annonce(text,text,text,text,text)'::regprocedure);
  v_avant constant text := $q$v_route <> '/porte-monnaie' and$q$;
  v_apres constant text := $q$v_route <> '/porte-monnaie' and v_route <> '/plats-du-jour' and$q$;
begin
  if position('/plats-du-jour' in v_def) > 0 then return; end if;
  if position(v_avant in v_def) = 0 then
    raise exception 'admin_creer_annonce : ancre introuvable, patch refuse';
  end if;
  execute replace(v_def, v_avant, v_apres);
end $$;

-- La notification de midi ouvre la page des plats du jour.
do $$
declare v_def text := pg_get_functiondef('public.annonce_midi_lancer()'::regprocedure);
begin
  if position($q$'clients', '/', 'push'$q$ in v_def) = 0 then
    raise exception 'annonce_midi_lancer : ancre introuvable';
  end if;
  execute replace(v_def, $q$'clients', '/', 'push'$q$, $q$'clients', '/plats-du-jour', 'push'$q$);
end $$;
