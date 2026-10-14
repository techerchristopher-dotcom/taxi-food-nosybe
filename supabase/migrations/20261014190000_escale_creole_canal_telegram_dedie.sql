-- L'escale Créole : ses commandes arrivent dans un groupe Telegram dédié, sur le Telegram du
-- porteur du projet (« Taxi food- L'escale Créole », créé le 2026-10-14, robot
-- @Taxifood_commandes_bot membre, message de contrôle remis — message_id 168).
-- Remplace le canal admin posé par 20261014180000 : le canal admin ne reçoit plus que la copie.
-- Groupe simple (identifiant négatif court) : s'il devient supergroupe, l'identifiant change.
do $$
declare n int;
begin
  update public.restaurants set telegram_chat_id = '-5185519447'
   where id = '128e68ab-8e64-4f48-bf79-acc67f3deca9';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'restaurant attendu 1, trouve %', n; end if;
end $$;
