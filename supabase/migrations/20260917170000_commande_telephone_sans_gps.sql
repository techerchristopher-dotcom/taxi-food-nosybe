-- Commande par telephone : la position GPS devient FACULTATIVE (2026-09-17).
--
-- Retour du porteur du projet : « c'est impossible que je saisisse un repere
-- GPS pour le client a sa place ». Le minimum obligatoire devient zone +
-- repere ; le livreur appelle le client (son numero est sur l'adresse).
--
-- ⚠️ L'obligation GPS de l'APP CLIENT ne bouge pas. `create_order` ne leve sa
-- garde que si DEUX conditions sont vraies a la fois :
--   1. le drapeau de transaction `taxifood.commande_telephone` vaut 'on' — pose
--      uniquement par `admin_commande_telephone`, avec `set_config(..., true)`
--      (local a la transaction), et remis a '' juste apres l'appel ;
--   2. `is_admin()` — revérifie DANS `create_order`. Un client ne peut pas
--      appeler `set_config` par PostgREST (pg_catalog n'est pas expose), et
--      meme s'il y parvenait, il n'est pas admin.
-- Verifie en transaction annulee : client sans GPS -> toujours refuse.

-- ---------------------------------------------------- create_order (5 args)
-- Seule la condition GPS change ; le reste du corps est conserve a l'octet pres.
do $migration$
declare
  v_def text := pg_get_functiondef('public.create_order(uuid,uuid,text,jsonb,text)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    $a$  if v_address.latitude is null or v_address.longitude is null then$a$,
    $b$  -- Commande saisie par telephone depuis l'admin : GPS facultatif. Drapeau de
  -- transaction ET administrateur, les deux (voir migration 20260917170000).
  if (v_address.latitude is null or v_address.longitude is null)
     and not (coalesce(current_setting('taxifood.commande_telephone', true), '') = 'on'
              and public.is_admin()) then$b$);
  if v_new = v_def then
    raise exception 'create_order : garde GPS introuvable, migration annulee';
  end if;
  execute v_new;
end $migration$;

-- ------------------------------------------------ admin_commande_telephone
create or replace function public.admin_commande_telephone(
  p_restaurant_id    uuid,
  p_client_nom       text,
  p_client_telephone text,
  p_zone             text,
  p_repere           text,
  p_latitude         double precision,
  p_longitude        double precision,
  p_items            jsonb
) returns table (order_id uuid, order_number text, total integer)
language plpgsql
security definer
set search_path to 'public'
as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_nom     text := btrim(coalesce(p_client_nom, ''));
  v_tel     text := regexp_replace(coalesce(p_client_telephone, ''), '[^0-9+]', '', 'g');
  v_zone    text := btrim(coalesce(p_zone, ''));
  v_repere  text := btrim(coalesce(p_repere, ''));
  v_adresse uuid;
  v_o       public.orders;
begin
  if not public.is_admin() then
    raise exception 'Reserve aux administrateurs' using errcode = '42501';
  end if;
  if v_nom = '' then
    raise exception 'telephone:nom_manquant' using errcode = '22023';
  end if;
  if v_tel !~ '^\+?[0-9]{8,15}$' then
    raise exception 'telephone:numero_invalide' using errcode = '22023';
  end if;
  if v_zone = '' then
    raise exception 'telephone:zone_manquante' using errcode = '22023';
  end if;
  -- Sans GPS, c'est le repere qui guide le livreur : il devient obligatoire.
  if v_repere = '' then
    raise exception 'telephone:repere_manquant' using errcode = '22023';
  end if;
  -- Position : les deux ou aucune. Fournie, elle doit tomber sur Nosy Be
  -- (latitude et longitude inversees = livreur envoye en pleine mer).
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'telephone:position_incomplete' using errcode = '22023';
  end if;
  if p_latitude is not null
     and not (p_latitude between -13.55 and -13.05 and p_longitude between 48.05 and 48.45) then
    raise exception 'telephone:position_hors_nosy_be' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'telephone:panier_vide' using errcode = '22023';
  end if;

  insert into public.addresses (user_id, label, zone, landmark, phone, is_default,
                                latitude, longitude, location_captured_at)
  values (v_uid, '☎ ' || v_nom, v_zone, v_repere, v_tel, false,
          p_latitude, p_longitude, case when p_latitude is not null then now() end)
  returning id into v_adresse;

  -- LE circuit de l'app. Le drapeau ne vit que le temps de cet appel.
  perform set_config('taxifood.commande_telephone', 'on', true);
  select * into v_o
    from public.create_order(p_restaurant_id, v_adresse, 'especes'::text, p_items, null::text);
  perform set_config('taxifood.commande_telephone', '', true);

  insert into public.commandes_telephone (order_id, address_id, client_nom, client_telephone, saisie_par)
  values (v_o.id, v_adresse, v_nom, v_tel, v_uid);

  return query select v_o.id, v_o.order_number, v_o.total;
end $$;

revoke all on function public.admin_commande_telephone(uuid, text, text, text, text, double precision, double precision, jsonb)
  from public, anon;
grant execute on function public.admin_commande_telephone(uuid, text, text, text, text, double precision, double precision, jsonb)
  to authenticated;
