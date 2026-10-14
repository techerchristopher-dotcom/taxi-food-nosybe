-- L'escale Créole : réglages avant ouverture (2026-10-14, demande du porteur du projet).
--  * commission 7 % ;
--  * horaires lun–sam 11:30–13:45 et 18:00–21:45, dimanche fermé, ouverture automatique ;
--  * position GPS : épingle Google Maps envoyée par le porteur du projet (Ambatoloaka,
--    ~100 m de La Cabane) — https://maps.app.goo.gl/GgUjKqmTsBVcXzQWA ;
--  * Telegram : le Telegram du gérant ne fonctionne pas, c'est le porteur du projet qui
--    gère ses commandes → elles arrivent dans le canal admin existant (même identifiant que
--    le secret Vault telegram_admin_chat_id). Le canal reçoit donc le message restaurant
--    (avec boutons) ET la copie admin. Le jour où le gérant a un Telegram, changer ce champ.
-- Le statut (coming_soon) n'est PAS touché ici : l'ouverture passe par l'admin, pour que
-- l'annonce « ouvre sur Taxi Food » parte aux clients qui ont appuyé sur « Me prévenir ».

do $$
declare
  v_id constant uuid := '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  v_chat text;
  n int;
begin
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_admin_chat_id';
  if v_chat is null then raise exception 'telegram_admin_chat_id absent du Vault'; end if;

  update public.restaurants
     set commission_rate = 0.07,
         latitude = -13.3969375,
         longitude = 48.2065469,
         telegram_chat_id = v_chat,
         auto_open = true
   where id = v_id and name ilike '%escale%';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'restaurant attendu 1, trouve %', n; end if;

  delete from public.restaurant_hours where restaurant_id = v_id;
  insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
  select v_id, d, s,
         case when d = 0 then null when s = 1 then time '11:30' else time '18:00' end,
         case when d = 0 then null when s = 1 then time '13:45' else time '21:45' end,
         d = 0
    from generate_series(0, 6) d, generate_series(1, 2) s;
  get diagnostics n = row_count;
  if n <> 14 then raise exception 'horaires attendus 14, inseres %', n; end if;
end $$;
