-- Le code marchand Orange Money de chaque restaurant, visible là où on le paie (2026-09-22).
--
-- POURQUOI. Le porteur du projet reverse les restaurants par Orange Money depuis l'écran
-- « Rapport de clôture ». Le code marchand vivait dans sa tête ou dans WhatsApp : c'est
-- exactement l'information qu'il faut sous les yeux au moment de payer, et une erreur d'un
-- chiffre envoie l'argent à quelqu'un d'autre. Premier code connu : Chez M&K, 378970.
--
-- POURQUOI UNE COLONNE DE `restaurants` ET PAS UNE TABLE PRIVÉE. Un code marchand est fait pour
-- être communiqué à qui paie : il n'ouvre rien, il permet seulement de verser. Sa lecture par la
-- clé publique ne donne aucun pouvoir (contrairement à `commission_rate` et `telegram_chat_id`,
-- cf. « Fuite connue » dans CLAUDE.md). L'ÉCRITURE, elle, passe uniquement par
-- `admin_set_code_marchand` : un restaurateur ne peut pas modifier le code sur lequel on le paie.
--
-- Forme contrôlée : chiffres et lettres, 3 à 20 caractères, sans espace (on les retire à la saisie).
alter table public.restaurants
  add column if not exists code_marchand text;

alter table public.restaurants
  drop constraint if exists restaurants_code_marchand_forme;
alter table public.restaurants
  add constraint restaurants_code_marchand_forme
  check (code_marchand is null or code_marchand ~ '^[0-9A-Za-z]{3,20}$');

comment on column public.restaurants.code_marchand is
  'Code marchand Orange Money sur lequel Taxi Food reverse ce restaurant. Écriture : admin_set_code_marchand() seulement.';

create or replace function public.admin_set_code_marchand(p_restaurant_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text := nullif(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'), '');
  v_avant text;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  select code_marchand into v_avant from public.restaurants where id = p_restaurant_id;
  if not found then
    raise exception 'Restaurant introuvable';
  end if;
  if v_code is not null and v_code !~ '^[0-9A-Za-z]{3,20}$' then
    raise exception 'code_marchand:forme' using errcode = '22023';
  end if;

  update public.restaurants set code_marchand = v_code where id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (auth.uid(), 'code_marchand', p_restaurant_id, v_avant, v_code);

  return v_code;
end $$;

revoke all on function public.admin_set_code_marchand(uuid, text) from public, anon;
grant execute on function public.admin_set_code_marchand(uuid, text) to authenticated;

-- Chez M&K : code donné par le porteur du projet le 2026-09-22.
update public.restaurants set code_marchand = '378970'
 where id = '56ec29b9-d3eb-40c0-b8a1-5916e7cc7c53' and code_marchand is null;
