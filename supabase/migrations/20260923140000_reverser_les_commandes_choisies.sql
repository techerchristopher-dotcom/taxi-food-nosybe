-- Reverser LES COMMANDES CHOISIES, pas seulement « toute la période » (2026-09-23).
--
-- POURQUOI. Depuis ce matin une commande ne peut plus être payée deux fois
-- (`settlement_orders`), mais on ne pouvait reverser qu'un bloc : tout ce qui
-- restait dû sur la période. Le porteur du projet veut cocher les commandes
-- qu'il paie, et pouvoir en solder une seule.
--
-- CE QUE FAIT CETTE MIGRATION. Un cœur unique, `versement_enregistrer_core`,
-- qui enregistre un versement à partir d'une LISTE EXPLICITE d'`order_id`.
-- Les deux chemins d'appel s'y ramènent :
--   - `admin_enregistrer_versement_commandes(resto, ids, montant, réf, dû)`
--     — le nouveau, celui de l'écran : la liste vient des cases cochées ;
--   - `admin_enregistrer_versement(resto, début, fin, montant, réf, dû)`
--     — l'ancien, INCHANGÉ de l'extérieur : il résout la période en liste
--     (les commandes non encore rattachées) puis appelle le même cœur.
-- Une seule implémentation, donc un seul endroit où une règle peut changer.
--
-- ⚠️ NOMS NOUVEAUX, jamais une surcharge (piège PGRST203 : deux fonctions du
-- même nom et PostgREST refuse de choisir, tous les appels tombent).
--
-- PÉRIODE ENREGISTRÉE. En mode liste, elle n'est pas choisie : c'est le
-- min/max des jours locaux (`Indian/Antananarivo`) des commandes retenues.
-- Deux versements successifs peuvent donc porter des périodes qui se
-- chevauchent — c'est exactement ce qu'on veut depuis ce matin, la garantie
-- étant la clé primaire de `settlement_orders`, pas la période.

-- ----------------------------------------------------------------- 1. Le cœur
create or replace function public.versement_enregistrer_core(
  p_restaurant_id uuid,
  p_order_ids uuid[],
  -- Période à enregistrer. NULL = déduite des commandes retenues (mode liste).
  p_period_start date,
  p_period_end date,
  p_paid_amount integer,
  p_reference text,
  p_du_attendu integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  /** Les commandes finalement retenues et leur net, dans le même ordre. */
  v_retenues uuid[];
  v_nets integer[];
  v_ref text;
  v_cle text;
  v_du integer;
  v_nb integer;
  v_numeros text[];
  v_debut date;
  v_fin date;
  v_chat text;
  v_nom text;
  v_txt text;
  v_n integer;
  v_exist public.restaurant_settlements;
  v_row public.restaurant_settlements;
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  if p_restaurant_id is null then raise exception 'Restaurant obligatoire'; end if;

  -- Les doublons dans la liste envoyée ne sont pas une erreur de l'utilisateur :
  -- on les réduit. Une liste vide, elle, en est une.
  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_order_ids, '{}'::uuid[])) as x where x is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'Aucune commande sélectionnée : rien à reverser';
  end if;

  v_ref := btrim(regexp_replace(coalesce(p_reference, ''), '\s+', ' ', 'g'));
  if v_ref = '' then
    raise exception 'Référence du versement obligatoire (ID de transaction Orange Money)';
  end if;
  if length(v_ref) < 4 or length(v_ref) > 64 then
    raise exception 'Référence du versement invalide : entre 4 et 64 caractères';
  end if;
  v_cle := upper(regexp_replace(v_ref, '\s', '', 'g'));

  if p_paid_amount is null or p_paid_amount <= 0 then
    raise exception 'Montant versé invalide';
  end if;

  select name, telegram_chat_id into v_nom, v_chat from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  -- Deux clics, deux onglets : un seul passe. Le verrou tient jusqu'à la fin de
  -- la transaction ; le second appel relit alors les rattachements du premier.
  perform pg_advisory_xact_lock(hashtextextended('versement:' || p_restaurant_id::text, 0));

  -- --- Ce qu'on refuse de payer, dit en clair, AVANT d'écrire quoi que ce soit.
  select count(*) into v_n
  from unnest(v_ids) as u(id)
  where not exists (select 1 from public.orders o
                    where o.id = u.id and o.restaurant_id = p_restaurant_id);
  if v_n > 0 then
    raise exception '% commande(s) sélectionnée(s) n''appartiennent pas à % (ou n''existent pas). Aucun versement enregistré.',
      v_n, v_nom;
  end if;

  select string_agg(coalesce(o.order_number, o.id::text), ', ' order by o.order_number)
    into v_txt
  from public.orders o where o.id = any(v_ids) and o.status <> 'livree';
  if v_txt is not null then
    raise exception 'Commande(s) non livrée(s) : %. On ne reverse que des commandes livrées.', v_txt;
  end if;

  select string_agg(coalesce(o.order_number, o.id::text), ', ' order by o.order_number)
    into v_txt
  from public.settlement_orders so
  join public.orders o on o.id = so.order_id
  where so.order_id = any(v_ids);
  if v_txt is not null then
    raise exception 'Déjà reversée(s) : %. Aucun deuxième versement enregistré — recharge le rapport.', v_txt;
  end if;

  select * into v_exist
  from public.restaurant_settlements s
  where upper(regexp_replace(s.reference_versement, '\s', '', 'g')) = v_cle
  limit 1;
  if found then
    raise exception 'Référence déjà utilisée : % sert déjà au versement du % au % (enregistré le %).',
      v_ref,
      to_char(v_exist.period_start, 'DD/MM/YYYY'),
      to_char(v_exist.period_end, 'DD/MM/YYYY'),
      to_char(v_exist.paid_at at time zone 'Indian/Antananarivo', 'DD/MM/YYYY');
  end if;

  -- --- Le dû : la somme EXACTE des nets de ces commandes-là. Même formule que
  -- `record_settlement` et `admin_commandes_a_reverser`, recopiée à l'octet.
  -- On garde AUSSI la liste (ids, nets) dans le même ordre : c'est elle qui
  -- sera rattachée, pour qu'aucune seconde lecture ne puisse s'en écarter.
  select coalesce(sum(x.net), 0)::integer, count(*)::integer, min(x.jour), max(x.jour),
         coalesce(array_agg(x.order_number order by x.quand, x.order_number), '{}'),
         array_agg(x.id order by x.quand, x.order_number),
         array_agg(x.net order by x.quand, x.order_number)
    into v_du, v_nb, v_debut, v_fin, v_numeros, v_retenues, v_nets
  from (
    select o.id, o.order_number,
           coalesce(o.delivered_at, o.created_at) as quand,
           (coalesce(o.delivered_at, o.created_at) at time zone 'Indian/Antananarivo')::date as jour,
           (o.subtotal + o.packaging_fee
            - coalesce(o.commission_amount,
                       greatest(round((o.subtotal + o.packaging_fee - o.remise_charge_restaurant)
                                      * r.commission_rate)::integer, 0))
            - o.remise_charge_restaurant)::integer as net
    from public.orders o
    join public.restaurants r on r.id = o.restaurant_id
    where o.id = any(v_ids)
  ) x;

  if v_nb = 0 then
    raise exception 'Aucune commande retenue : rien à reverser';
  end if;

  -- La période enregistrée : celle demandée si elle l'est, sinon celle que les
  -- commandes dessinent.
  v_debut := coalesce(p_period_start, v_debut);
  v_fin := coalesce(p_period_end, v_fin);
  if v_debut > v_fin then raise exception 'Période invalide : le début est après la fin'; end if;

  -- L'écran a montré un montant ; si une commande a bougé entre-temps, on ne
  -- l'enregistre pas en silence.
  if p_du_attendu is distinct from v_du then
    raise exception 'Le dû a changé depuis l''affichage (% Ar affichés, % Ar en base). Recharge le rapport.',
      p_du_attendu, v_du;
  end if;

  begin
    insert into public.restaurant_settlements (
      restaurant_id, period_start, period_end, amount_due, paid_amount, created_by,
      reference_versement, nb_commandes, numeros_commandes, telegram_statut)
    values (
      p_restaurant_id, v_debut, v_fin, v_du, p_paid_amount, auth.uid(),
      v_ref, v_nb, v_numeros,
      case when nullif(btrim(coalesce(v_chat, '')), '') is null then 'sans_canal' else 'en_attente' end)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'Référence déjà utilisée : % sert déjà à un autre versement.', v_ref;
  end;

  -- MÊME TRANSACTION que le versement : soit les deux, soit ni l'un ni l'autre.
  begin
    insert into public.settlement_orders (order_id, settlement_id, restaurant_id, net)
    select u.id, v_row.id, p_restaurant_id, u.net
    from unnest(v_retenues, v_nets) as u(id, net);
  exception when unique_violation then
    raise exception 'Une commande de cette sélection vient d''être reversée par ailleurs. Recharge le rapport ; aucun versement n''a été enregistré.';
  end;

  return v_row;
end;
$$;

-- ------------------------------------------------- 2. Le chemin « je coche »
create or replace function public.admin_enregistrer_versement_commandes(
  p_restaurant_id uuid, p_order_ids uuid[],
  p_paid_amount integer, p_reference text, p_du_attendu integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  -- Période NULL : déduite des commandes retenues (min/max du jour local).
  return public.versement_enregistrer_core(
    p_restaurant_id, p_order_ids, null, null, p_paid_amount, p_reference, p_du_attendu);
end;
$$;

-- ------------------------------------------- 3. Le chemin « toute la période »
-- Signature et comportement externes inchangés ; il se ramène au même cœur.
create or replace function public.admin_enregistrer_versement(
  p_restaurant_id uuid, p_period_start date, p_period_end date,
  p_paid_amount integer, p_reference text, p_du_attendu integer)
returns public.restaurant_settlements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids uuid[];
  v_deja integer;
  v_nom text;
begin
  if not public.is_admin() then raise exception 'Acces admin requis'; end if;
  if p_restaurant_id is null or p_period_start is null or p_period_end is null then
    raise exception 'Restaurant et période obligatoires';
  end if;
  if p_period_start > p_period_end then
    raise exception 'Période invalide : le début est après la fin';
  end if;

  select name into v_nom from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant introuvable'; end if;

  select coalesce(array_agg(c.order_id) filter (where not c.deja_reverse), '{}'),
         (count(*) filter (where c.deja_reverse))::integer
    into v_ids, v_deja
  from public.admin_commandes_a_reverser(p_restaurant_id, p_period_start, p_period_end) c;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    if v_deja > 0 then
      raise exception 'Rien à reverser : les % commande(s) livrée(s) de % sur cette période ont déjà été reversées. Aucun deuxième versement enregistré.',
        v_deja, v_nom;
    end if;
    raise exception 'Aucune commande livrée pour % sur cette période : rien à reverser', v_nom;
  end if;

  return public.versement_enregistrer_core(
    p_restaurant_id, v_ids, p_period_start, p_period_end, p_paid_amount, p_reference, p_du_attendu);
end;
$$;

-- ------------------------------------------------------------------ 4. Droits
-- ⚠️ `revoke from public` ne retire PAS anon / authenticated (ALTER DEFAULT
-- PRIVILEGES de Supabase) : chaque rôle est révoqué nommément.
-- Le cœur n'est appelable par PERSONNE depuis l'extérieur : seules les deux
-- fonctions ci-dessus y mènent, et elles sont gardées par `is_admin()`.
revoke all on function public.versement_enregistrer_core(uuid, uuid[], date, date, integer, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_enregistrer_versement_commandes(uuid, uuid[], integer, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_enregistrer_versement_commandes(uuid, uuid[], integer, text, integer)
  to authenticated, service_role;
