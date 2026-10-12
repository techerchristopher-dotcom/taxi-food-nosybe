-- Orange Money encaissé À LA LIVRAISON (2026-10-12).
--
-- Le client paie toujours à la livraison. C'est la personne qui ENCAISSE — le livreur
-- dans l'app, l'administrateur dans le tableau de bord — qui dit comment : espèces
-- (comme avant) ou Orange Money. Le livreur ne voit pas le téléphone qui reçoit
-- l'argent (+261 37 34 379 12, TECHER Jean Christopher) : il ne peut pas confirmer la
-- réception. La commande passe donc `payment_method = 'orange_money'` avec un état
-- Orange Money « à vérifier », que l'administrateur passe à « reçu » (référence de
-- transaction facultative) ou relance (e-mail + push au SEUL client concerné).
--
-- ⚠️ `orders.payment_status` N'EST PAS UTILISÉ : il est déduit des `payment_intents`
-- (paiement carte) par un trigger. L'état Orange Money vit dans sa propre table,
-- `paiements_orange_money`, une ligne par commande.
--
-- ⚠️ `mark_order_delivered` : un 3ᵉ paramètre FACULTATIF `p_mode_encaissement`. L'ancienne
-- signature à 2 arguments est SUPPRIMÉE avant de créer la nouvelle (sinon PostgREST
-- répond PGRST203). L'app déjà installée envoie `p_order_id` + `p_cash_confirmed` :
-- elle résout sur la nouvelle avec mode NULL = espèces, comportement inchangé.
-- La formule de commission n'a pas bougé.
--
-- `notify_order_status` n'est PAS touchée : changer `payment_method` seul, statut
-- inchangé, n'y déclenche rien (branche « status is not distinct from » → return).

-- ------------------------------------------------------------------ 1. LES TABLES
create table public.paiements_orange_money (
  order_id      uuid primary key references public.orders(id) on delete cascade,
  etat          text not null default 'a_verifier' check (etat in ('a_verifier', 'recu')),
  montant       integer not null check (montant >= 0),
  declare_par   uuid references auth.users(id),
  declare_role  text not null check (declare_role in ('livreur', 'admin')),
  declare_le    timestamptz not null default now(),
  recu_par      uuid references auth.users(id),
  recu_le       timestamptz,
  reference     text check (reference is null or char_length(reference) between 1 and 64),
  constraint paiements_om_recu_trace check (
    (etat = 'recu' and recu_le is not null and recu_par is not null)
    or (etat = 'a_verifier' and recu_le is null and recu_par is null and reference is null))
);
alter table public.paiements_orange_money enable row level security;
revoke all on public.paiements_orange_money from public, anon, authenticated;

create table public.relances_orange_money (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.paiements_orange_money(order_id) on delete cascade,
  jour           date not null default ((now() at time zone 'Indian/Antananarivo')::date),
  cree_le        timestamptz not null default now(),
  cree_par       uuid references auth.users(id),
  statut         text not null default 'en_cours' check (statut in ('en_cours', 'envoyee', 'echec')),
  push_resultat  text,
  email_resultat text,
  detail         jsonb
);
-- Garde-fou : UNE relance par commande et par jour (heure de Nosy Be). Une relance dont
-- les deux canaux ont échoué (`echec`) ne bloque pas un nouvel essai.
create unique index relances_om_une_par_jour on public.relances_orange_money (order_id, jour)
  where statut <> 'echec';
alter table public.relances_orange_money enable row level security;
revoke all on public.relances_orange_money from public, anon, authenticated;

-- ------------------------------------------------- 2. LE CŒUR : DÉCLARER UN ENCAISSEMENT
-- Interne (appelé par les deux portes ci-dessous). Pose le mode et la ligne Orange Money.
create or replace function public.om_appliquer_mode(p_order public.orders, p_mode text, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if p_mode = 'orange_money' then
    update public.orders set payment_method = 'orange_money', cash_confirmed = false
     where id = p_order.id;
    insert into public.paiements_orange_money (order_id, montant, declare_par, declare_role)
    values (p_order.id, p_order.total, auth.uid(), p_role)
    on conflict (order_id) do nothing;
  else
    if exists (select 1 from public.paiements_orange_money where order_id = p_order.id and etat = 'recu') then
      raise exception 'orange_money:deja_recu' using errcode = '22023';
    end if;
    delete from public.paiements_orange_money where order_id = p_order.id;
    update public.orders set payment_method = 'especes' where id = p_order.id;
  end if;
end $$;
revoke all on function public.om_appliquer_mode(public.orders, text, text) from public, anon, authenticated, service_role;

-- ------------------------------------------------------- 3. LE LIVREUR (appli)
drop function public.mark_order_delivered(uuid, boolean);
create function public.mark_order_delivered(
  p_order_id uuid,
  p_cash_confirmed boolean default false,
  p_mode_encaissement text default null)
returns public.orders
language plpgsql security definer set search_path to 'public' as $function$
declare
  v_order public.orders;
  v_rate  numeric(5,4);
  v_carte boolean;
  v_cash  boolean;
  v_om    boolean := false;
begin
  if p_mode_encaissement is not null and p_mode_encaissement not in ('especes', 'orange_money') then
    raise exception 'Mode d''encaissement inconnu' using errcode = '22023';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Commande introuvable'; end if;
  if v_order.courier_id is distinct from auth.uid() then raise exception 'Acces refuse a cette commande'; end if;
  if v_order.status <> 'en_livraison' or v_order.picked_up_at is null then
    raise exception 'Marque d''abord la commande comme recuperee';
  end if;

  if v_order.payment_status = 'paye' then
    -- Deja encaisse en ligne : on n'exige aucun cash, et surtout on n'en
    -- enregistre aucun, meme si l'appelant a coche la case — ni aucun Orange Money.
    v_cash := false;
  elsif p_mode_encaissement = 'orange_money' then
    if v_order.payment_method not in ('especes', 'orange_money') then
      raise exception 'Orange Money impossible sur une commande carte' using errcode = '22023';
    end if;
    -- Le livreur ne voit pas le telephone qui recoit l'argent : il declare, il ne confirme pas.
    v_cash := false;
    v_om := true;
  elsif v_order.payment_method in ('especes', 'orange_money') and not coalesce(p_cash_confirmed, false) then
    raise exception 'Confirme l''encaissement en especes';
  else
    v_cash := coalesce(p_cash_confirmed, false);
  end if;

  if v_order.payment_method = 'cb' and v_order.payment_status <> 'paye' then
    select carte_active into v_carte from public.payment_config where id = 1;
    if coalesce(v_carte, false) or v_order.payment_status <> 'non_requis' then
      raise exception 'Paiement carte non confirme : cette commande ne peut pas etre marquee livree';
    end if;
  end if;

  select commission_rate into v_rate from public.restaurants where id = v_order.restaurant_id;

  update public.orders
    set status = 'livree', delivered_at = now(), status_updated_at = now(),
        cash_confirmed = v_cash,
        payment_method = case when v_om then 'orange_money'::payment_method
                              when v_cash and payment_method = 'orange_money' then 'especes'::payment_method
                              else payment_method end,
        commission_rate = v_rate,
        commission_amount = greatest(round((subtotal + packaging_fee - emballage_taxifood - remise_charge_restaurant) * v_rate)::integer, 0)
    where id = p_order_id returning * into v_order;

  if v_om then
    insert into public.paiements_orange_money (order_id, montant, declare_par, declare_role)
    values (v_order.id, v_order.total, auth.uid(), 'livreur')
    on conflict (order_id) do nothing;
  elsif v_order.payment_method = 'especes' then
    delete from public.paiements_orange_money where order_id = v_order.id and etat = 'a_verifier';
  end if;
  return v_order;
end
$function$;
revoke all on function public.mark_order_delivered(uuid, boolean, text) from public, anon;
grant execute on function public.mark_order_delivered(uuid, boolean, text) to authenticated, service_role;

-- -------------------------------------------------------- 4. L'ADMINISTRATEUR
-- Dit comment une commande LIVRÉE a été encaissée (après coup, ou juste après l'avoir
-- passée en livrée depuis Temps réel). Réversible tant que l'Orange Money n'est pas « reçu ».
create or replace function public.admin_definir_encaissement(p_order_id uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_o public.orders; v_avant text;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  if p_mode not in ('especes', 'orange_money') then
    raise exception 'Mode d''encaissement inconnu' using errcode = '22023';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if v_o.id is null then raise exception 'Commande introuvable'; end if;
  if v_o.status <> 'livree' then
    raise exception 'orange_money:pas_livree' using errcode = '22023';
  end if;
  if v_o.payment_status = 'paye' or v_o.payment_method = 'cb' then
    raise exception 'orange_money:commande_carte' using errcode = '22023';
  end if;
  v_avant := v_o.payment_method::text;
  perform public.om_appliquer_mode(v_o, p_mode, 'admin');
  if v_avant is distinct from p_mode then
    insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
    values (auth.uid(), 'mode_encaissement', p_order_id, v_o.restaurant_id, v_avant, p_mode, null);
  end if;
  return jsonb_build_object('ok', true, 'mode', p_mode,
    'etat', (select p.etat from public.paiements_orange_money p where p.order_id = p_order_id));
end $$;
revoke all on function public.admin_definir_encaissement(uuid, text) from public, anon;
grant execute on function public.admin_definir_encaissement(uuid, text) to authenticated;

create or replace function public.admin_om_marquer_recu(p_order_id uuid, p_reference text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_ref text := nullif(btrim(coalesce(p_reference, '')), ''); v_p public.paiements_orange_money;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  if v_ref is not null and char_length(v_ref) > 64 then
    raise exception 'orange_money:reference_trop_longue' using errcode = '22023';
  end if;
  update public.paiements_orange_money
     set etat = 'recu', recu_par = auth.uid(), recu_le = now(), reference = v_ref
   where order_id = p_order_id and etat = 'a_verifier'
   returning * into v_p;
  if v_p.order_id is null then
    raise exception 'orange_money:introuvable_ou_deja_recu' using errcode = '22023';
  end if;
  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  select auth.uid(), 'orange_money_recu', o.id, o.restaurant_id, 'a_verifier', 'recu', v_ref
    from public.orders o where o.id = p_order_id;
  return jsonb_build_object('ok', true, 'recu_le', v_p.recu_le);
end $$;
revoke all on function public.admin_om_marquer_recu(uuid, text) from public, anon;
grant execute on function public.admin_om_marquer_recu(uuid, text) to authenticated;

-- Une erreur de clic se répare : « reçu » repasse à « à vérifier », tracé.
create or replace function public.admin_om_annuler_recu(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_n int;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  update public.paiements_orange_money
     set etat = 'a_verifier', recu_par = null, recu_le = null, reference = null
   where order_id = p_order_id and etat = 'recu';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'orange_money:pas_recu' using errcode = '22023'; end if;
  insert into public.admin_actions (admin_id, action, order_id, restaurant_id, avant, apres, motif)
  select auth.uid(), 'orange_money_recu', o.id, o.restaurant_id, 'recu', 'a_verifier', 'annulation'
    from public.orders o where o.id = p_order_id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_om_annuler_recu(uuid) from public, anon;
grant execute on function public.admin_om_annuler_recu(uuid) to authenticated;

-- La liste de l'écran « Paiements Orange Money ».
create or replace function public.admin_paiements_orange_money()
returns table (
  order_id uuid, order_number text, restaurant text, client text, telephone text,
  par_telephone boolean, montant integer, livree_le timestamptz, jours_attente integer,
  etat text, declare_role text, recu_le timestamptz, recu_par text, reference text,
  nb_relances integer, derniere_relance timestamptz, derniere_relance_statut text,
  relance_aujourdhui boolean, relances jsonb)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  return query
  select p.order_id, o.order_number::text, r.name::text,
         coalesce(ct.client_nom, pr.full_name)::text,
         coalesce(ct.client_telephone, a.phone, pr.phone)::text,
         ct.order_id is not null,
         p.montant,
         coalesce(o.delivered_at, o.status_updated_at),
         greatest(0, ((now() at time zone 'Indian/Antananarivo')::date
                      - (coalesce(o.delivered_at, o.status_updated_at) at time zone 'Indian/Antananarivo')::date))::int,
         p.etat, p.declare_role, p.recu_le, rp.full_name::text, p.reference,
         coalesce(rl.n, 0)::int, rl.derniere, rl.dernier_statut,
         coalesce(rl.aujourdhui, false), coalesce(rl.liste, '[]'::jsonb)
    from public.paiements_orange_money p
    join public.orders o on o.id = p.order_id
    left join public.restaurants r on r.id = o.restaurant_id
    left join public.addresses a on a.id = o.address_id
    left join public.profiles pr on pr.id = o.user_id
    left join public.profiles rp on rp.id = p.recu_par
    left join public.commandes_telephone ct on ct.order_id = o.id
    left join lateral (
      select count(*) filter (where x.statut = 'envoyee') as n,
             max(x.cree_le) as derniere,
             (array_agg(x.statut order by x.cree_le desc))[1] as dernier_statut,
             bool_or(x.jour = (now() at time zone 'Indian/Antananarivo')::date and x.statut <> 'echec') as aujourdhui,
             jsonb_agg(jsonb_build_object('le', x.cree_le, 'statut', x.statut,
                       'push', x.push_resultat, 'email', x.email_resultat) order by x.cree_le desc) as liste
        from public.relances_orange_money x where x.order_id = p.order_id) rl on true
   order by (p.etat = 'recu'), coalesce(o.delivered_at, o.status_updated_at) asc;
end $$;
revoke all on function public.admin_paiements_orange_money() from public, anon;
grant execute on function public.admin_paiements_orange_money() to authenticated;

-- ------------------------------------------------- 5. LA RELANCE (fonction Edge seulement)
-- Prépare UNE relance : vérifie tout, réserve la ligne du jour (garde-fou), rend ce qu'il
-- faut pour écrire au client. Appelée par `relancer-orange-money` (service_role), qui a
-- déjà vérifié que l'appelant est un administrateur actif.
create or replace function public.om_relance_preparer(p_order_id uuid, p_admin uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_p public.paiements_orange_money; v_o public.orders; v_email text; v_id uuid;
begin
  select * into v_p from public.paiements_orange_money where order_id = p_order_id for update;
  if v_p.order_id is null then return jsonb_build_object('ok', false, 'code', 'introuvable'); end if;
  if v_p.etat <> 'a_verifier' then return jsonb_build_object('ok', false, 'code', 'deja_recu'); end if;
  select * into v_o from public.orders where id = p_order_id;
  if exists (select 1 from public.commandes_telephone where order_id = p_order_id) or v_o.user_id is null then
    -- Commande par téléphone : le compte est celui de l'admin, pas du client.
    return jsonb_build_object('ok', false, 'code', 'sans_compte_client');
  end if;
  begin
    insert into public.relances_orange_money (order_id, cree_par) values (p_order_id, p_admin)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'deja_relance_aujourdhui');
  end;
  select u.email into v_email from auth.users u where u.id = v_o.user_id;
  return jsonb_build_object('ok', true, 'relance_id', v_id, 'user_id', v_o.user_id,
    'email', v_email, 'order_number', v_o.order_number, 'montant', v_p.montant);
end $$;
revoke all on function public.om_relance_preparer(uuid, uuid) from public, anon, authenticated;
grant execute on function public.om_relance_preparer(uuid, uuid) to service_role;

create or replace function public.om_relance_noter(p_relance_id uuid, p_push text, p_email text, p_detail jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  update public.relances_orange_money
     set push_resultat = left(p_push, 200), email_resultat = left(p_email, 200), detail = p_detail,
         statut = case when p_push like 'ok%' or p_email like 'ok%' then 'envoyee' else 'echec' end
   where id = p_relance_id and statut = 'en_cours';
end $$;
revoke all on function public.om_relance_noter(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.om_relance_noter(uuid, text, text, jsonb) to service_role;
