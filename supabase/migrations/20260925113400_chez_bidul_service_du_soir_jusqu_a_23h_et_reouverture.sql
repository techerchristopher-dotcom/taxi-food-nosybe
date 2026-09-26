-- Chez Bidul & Truc : le service du soir va jusqu'à 23 h, et le restaurant
-- rouvre (demande du porteur du projet, 2026-09-25).
--
-- CE QUI CHANGE VRAIMENT. Le service du midi était DÉJÀ 12:00–15:00 sur les sept
-- jours : rien à y toucher. Seule la fermeture du soir bouge, de 22:00 à 23:00.
-- Une heure de plus, sept jours.
--
-- L'OUVERTURE REPASSE EN AUTOMATIQUE. `ouvert_maintenant()` ne regarde les
-- horaires QUE si `auto_open` est vrai ; sinon il lit `is_open` et le restaurant
-- reste ouvert ou fermé en permanence, quelles que soient les plages. Le
-- restaurant était à `auto_open = false, is_open = false` — résidu de la
-- fermeture du 2026-09-20 : ses horaires ne servaient donc à rien. Changer les
-- heures sans remettre l'automatique aurait laissé la boutique close.
-- `is_open = true` est posé en même temps pour que le repli manuel dise la même
-- chose que l'automatique, comme chez La Cabane.
--
-- Gardes : exactement 7 lignes de service du soir, exactement 1 restaurant.
do $$
declare
  v_resto uuid;
  n int;
begin
  select id into v_resto from public.restaurants where name = 'Chez Bidul & Truc';
  if v_resto is null then raise exception 'restaurant introuvable'; end if;

  update public.restaurant_hours
     set closes_at = time '23:00'
   where restaurant_id = v_resto and service = 2 and closes_at = time '22:00';
  get diagnostics n = row_count;
  if n <> 7 then
    raise exception 'attendu 7 services du soir a 22:00, trouve %', n;
  end if;

  update public.restaurants
     set auto_open = true, is_open = true
   where id = v_resto;
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'attendu 1 restaurant, trouve %', n;
  end if;
end $$;
