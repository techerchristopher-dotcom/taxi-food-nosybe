-- Moyen de reversement d'un restaurant : code marchand OU numéro Orange Money OU « réglé à la
-- commande » (2026-10-10, demande du porteur du projet).
--
-- - Table PRIVÉE `restaurant_reversement` (RLS sans policy, aucun droit) : un numéro de téléphone
--   de paiement n'a rien à faire sur `restaurants`, lisible par la clé publique (fuite connue), et
--   ajouter une colonne à `restaurants` touche au piège des colonnes calculées.
-- - Le code marchand RESTE sur `restaurants.code_marchand` (l'écran CodeMarchand.tsx et
--   `admin_set_code_marchand` continuent de marcher tels quels).
-- - Moyen effectif (`moyen_reversement_de`) : la ligne privée si elle existe, sinon « code
--   marchand » quand un code est renseigné, sinon rien.
-- - Écriture : `admin_set_moyen_reversement(restaurant, moyen, valeur)` seulement (is_admin),
--   journalisée. Numéro Orange Money : 032 ou 037, 10 chiffres, accepté avec ou sans +261 / 261 /
--   espaces / tirets, STOCKÉ normalisé `03XXXXXXXX`.
-- - Chaque versement fige son moyen et sa destination (`restaurant_settlements.moyen_reversement`,
--   `destination_reversement`, trigger BEFORE INSERT) : le message Telegram dit sur quoi on a versé,
--   même si le moyen change ensuite.
-- - Message Telegram : ligne « Versé sur … » ajoutée avant la dernière ligne, en français ou en
--   italien (`versement_prendre_envoi`). Aperçu de l'admin : `admin_apercu_message_versement`,
--   même texte, dans la langue du restaurant.

create table if not exists public.restaurant_reversement (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  moyen text not null check (moyen in ('code_marchand', 'orange_money', 'regle_a_la_commande')),
  numero_orange_money text check (numero_orange_money ~ '^03[27][0-9]{7}$'),
  maj_le timestamptz not null default now(),
  maj_par uuid,
  constraint restaurant_reversement_numero_si_om
    check (moyen <> 'orange_money' or numero_orange_money is not null)
);
alter table public.restaurant_reversement enable row level security;
revoke all on public.restaurant_reversement from public, anon, authenticated;

-- Reprise : les restaurants qui ont déjà un code marchand.
insert into public.restaurant_reversement (restaurant_id, moyen)
select id, 'code_marchand' from public.restaurants where code_marchand is not null
on conflict (restaurant_id) do nothing;

-- Normalisation d'un numéro Orange Money malgache. NULL si la forme est refusée.
create or replace function public.normaliser_numero_orange_money(p text)
returns text language sql immutable set search_path = public as $$
  with c as (select regexp_replace(coalesce(p, ''), '[\s\.\-\(\)]', '', 'g') as s),
       d as (select case
                      when s ~ '^\+2610?3[0-9]{8}$' then '0' || right(s, 9)
                      when s ~ '^002610?3[0-9]{8}$' then '0' || right(s, 9)
                      when s ~ '^2610?3[0-9]{8}$' then '0' || right(s, 9)
                      when s ~ '^03[0-9]{8}$' then s
                      when s ~ '^3[0-9]{8}$' then '0' || s
                      else null end as n
             from c)
  select case when n ~ '^03[27][0-9]{7}$' then n else null end from d
$$;

-- « 037 12 345 67 » : la forme que le porteur du projet tape dans Orange Money.
create or replace function public.afficher_numero_orange_money(p text)
returns text language sql immutable set search_path = public as $$
  select case when p ~ '^03[0-9]{8}$'
              then substr(p, 1, 3) || ' ' || substr(p, 4, 2) || ' ' || substr(p, 6, 3) || ' ' || substr(p, 9, 2)
              else p end
$$;

create or replace function public.moyen_reversement_de(p_restaurant_id uuid)
returns table (moyen text, destination text)
language sql stable security definer set search_path = public as $$
  select m.moyen,
         case m.moyen when 'code_marchand' then r.code_marchand
                      when 'orange_money' then rr.numero_orange_money
                      else null end
  from public.restaurants r
  left join public.restaurant_reversement rr on rr.restaurant_id = r.id
  cross join lateral (select coalesce(rr.moyen, case when r.code_marchand is not null then 'code_marchand' end) as moyen) m
  where r.id = p_restaurant_id
$$;
revoke all on function public.moyen_reversement_de(uuid) from public, anon, authenticated;

-- Lecture pour l'admin : un restaurant par ligne.
create or replace function public.admin_moyens_reversement()
returns table (restaurant_id uuid, moyen text, code_marchand text, numero_orange_money text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query
  select r.id,
         coalesce(rr.moyen, case when r.code_marchand is not null then 'code_marchand' end),
         r.code_marchand, rr.numero_orange_money
  from public.restaurants r
  left join public.restaurant_reversement rr on rr.restaurant_id = r.id;
end $$;
revoke all on function public.admin_moyens_reversement() from public, anon;
grant execute on function public.admin_moyens_reversement() to authenticated;

-- Écriture. p_moyen null = aucun moyen (la ligne privée est retirée ; le code marchand reste).
create or replace function public.admin_set_moyen_reversement(p_restaurant_id uuid, p_moyen text, p_valeur text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_avant jsonb;
  v_code text;
  v_num text;
  v_apres jsonb;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  if not exists (select 1 from public.restaurants where id = p_restaurant_id) then
    raise exception 'Restaurant introuvable';
  end if;
  if p_moyen is not null and p_moyen not in ('code_marchand', 'orange_money', 'regle_a_la_commande') then
    raise exception 'moyen_reversement:inconnu' using errcode = '22023';
  end if;

  select to_jsonb(x) into v_avant from public.admin_moyens_reversement() x where x.restaurant_id = p_restaurant_id;

  if p_moyen = 'code_marchand' then
    v_code := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_code is null then
      select code_marchand into v_code from public.restaurants where id = p_restaurant_id;
      if v_code is null then raise exception 'code_marchand:manquant' using errcode = '22023'; end if;
    elsif v_code !~ '^[0-9A-Za-z]{3,20}$' then
      raise exception 'code_marchand:forme' using errcode = '22023';
    end if;
    update public.restaurants set code_marchand = v_code where id = p_restaurant_id;
    insert into public.restaurant_reversement (restaurant_id, moyen, maj_par)
    values (p_restaurant_id, 'code_marchand', auth.uid())
    on conflict (restaurant_id) do update set moyen = 'code_marchand', maj_le = now(), maj_par = auth.uid();
  elsif p_moyen = 'orange_money' then
    if nullif(btrim(coalesce(p_valeur, '')), '') is null then
      select numero_orange_money into v_num from public.restaurant_reversement where restaurant_id = p_restaurant_id;
      if v_num is null then raise exception 'numero_orange_money:manquant' using errcode = '22023'; end if;
    else
      v_num := public.normaliser_numero_orange_money(p_valeur);
      if v_num is null then raise exception 'numero_orange_money:forme' using errcode = '22023'; end if;
    end if;
    insert into public.restaurant_reversement (restaurant_id, moyen, numero_orange_money, maj_par)
    values (p_restaurant_id, 'orange_money', v_num, auth.uid())
    on conflict (restaurant_id) do update
      set moyen = 'orange_money', numero_orange_money = v_num, maj_le = now(), maj_par = auth.uid();
  elsif p_moyen = 'regle_a_la_commande' then
    insert into public.restaurant_reversement (restaurant_id, moyen, maj_par)
    values (p_restaurant_id, 'regle_a_la_commande', auth.uid())
    on conflict (restaurant_id) do update set moyen = 'regle_a_la_commande', maj_le = now(), maj_par = auth.uid();
  else
    delete from public.restaurant_reversement where restaurant_id = p_restaurant_id;
  end if;

  select to_jsonb(x) into v_apres from public.admin_moyens_reversement() x where x.restaurant_id = p_restaurant_id;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (auth.uid(), 'moyen_reversement', p_restaurant_id, v_avant::text, v_apres::text);

  return v_apres;
end $$;
revoke all on function public.admin_set_moyen_reversement(uuid, text, text) from public, anon;
grant execute on function public.admin_set_moyen_reversement(uuid, text, text) to authenticated;

-- admin_set_code_marchand : inchangée, sauf qu'un code posé sur un restaurant SANS moyen choisi
-- en fait son moyen (ce que la reprise ci-dessus a fait pour les codes existants).
create or replace function public.admin_set_code_marchand(p_restaurant_id uuid, p_code text)
returns text
language plpgsql security definer set search_path = public as $function$
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

  if v_code is not null then
    insert into public.restaurant_reversement (restaurant_id, moyen, maj_par)
    values (p_restaurant_id, 'code_marchand', auth.uid())
    on conflict (restaurant_id) do nothing;
  end if;

  insert into public.admin_actions (admin_id, action, restaurant_id, avant, apres)
  values (auth.uid(), 'code_marchand', p_restaurant_id, v_avant, v_code);

  return v_code;
end $function$;

-- Chaque versement fige son moyen.
alter table public.restaurant_settlements
  add column if not exists type_versement text not null default 'orange_money',
  add column if not exists moyen_reversement text,
  add column if not exists destination_reversement text;
do $$ begin
  alter table public.restaurant_settlements add constraint restaurant_settlements_type_versement_check
    check (type_versement in ('orange_money', 'regle_a_la_commande'));
exception when duplicate_object then null; end $$;

create or replace function public.figer_moyen_versement()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.moyen_reversement is null then
    select m.moyen, m.destination into new.moyen_reversement, new.destination_reversement
    from public.moyen_reversement_de(new.restaurant_id) m;
  end if;
  return new;
end $$;
revoke all on function public.figer_moyen_versement() from public, anon, authenticated;
drop trigger if exists restaurant_settlements_figer_moyen on public.restaurant_settlements;
create trigger restaurant_settlements_figer_moyen before insert on public.restaurant_settlements
  for each row execute function public.figer_moyen_versement();

-- La ligne « Versé sur … », insérée avant la dernière ligne du message (« Merci… »).
create or replace function public.message_versement_avec_moyen(p_texte text, p_moyen text, p_destination text, p_langue text)
returns text language plpgsql immutable set search_path = public as $$
declare
  v_ligne text;
  v_pos int;
begin
  if p_texte is null or p_destination is null or p_moyen not in ('code_marchand', 'orange_money') then
    return p_texte;
  end if;
  v_ligne := case
    when p_langue = 'it' and p_moyen = 'code_marchand' then 'Versato sul codice commerciante Orange Money: ' || p_destination
    when p_langue = 'it' then 'Versato sul numero Orange Money: ' || public.afficher_numero_orange_money(p_destination)
    when p_moyen = 'code_marchand' then 'Versé sur votre code marchand Orange Money : ' || p_destination
    else 'Versé sur votre numéro Orange Money : ' || public.afficher_numero_orange_money(p_destination)
  end;
  v_pos := length(p_texte) - strpos(reverse(p_texte), chr(10)) + 1;
  if strpos(p_texte, chr(10)) = 0 then return p_texte || chr(10) || v_ligne; end if;
  return substr(p_texte, 1, v_pos - 1) || chr(10) || v_ligne || substr(p_texte, v_pos);
end $$;

create or replace function public.versement_prendre_envoi(p_settlement_id uuid)
returns table (chat_id text, texte text)
language plpgsql security definer set search_path = public as $function$
declare
  v public.restaurant_settlements;
  v_chat text;
  v_langue text;
begin
  select * into v from public.restaurant_settlements where id = p_settlement_id for update;
  if not found then raise exception 'versement_introuvable'; end if;
  if v.telegram_statut = 'envoye' then raise exception 'deja_envoye'; end if;
  if v.telegram_statut = 'non_prevu' or v.reference_versement is null then
    raise exception 'versement_sans_reference';
  end if;
  if v.telegram_statut = 'en_cours' and v.telegram_tente_at > now() - interval '2 minutes' then
    raise exception 'envoi_en_cours';
  end if;

  select nullif(btrim(coalesce(r.telegram_chat_id, '')), ''), r.langue into v_chat, v_langue
  from public.restaurants r where r.id = v.restaurant_id;

  if v_chat is null then
    update public.restaurant_settlements
       set telegram_statut = 'sans_canal', telegram_erreur = null
     where id = p_settlement_id;
    return query select null::text, null::text;
    return;
  end if;

  update public.restaurant_settlements
     set telegram_statut = 'en_cours', telegram_tente_at = now(),
         telegram_tentatives = telegram_tentatives + 1, telegram_erreur = null
   where id = p_settlement_id;

  return query select v_chat,
    public.message_versement_avec_moyen(
      case when v_langue = 'it'
        then public.texte_message_versement_it(coalesce(v.paid_amount, v.amount_due), v.nb_commandes,
               v.period_start, v.period_end, v.numeros_commandes, v.reference_versement)
        else public.texte_message_versement(coalesce(v.paid_amount, v.amount_due), v.nb_commandes,
               v.period_start, v.period_end, v.numeros_commandes, v.reference_versement)
      end,
      v.moyen_reversement, v.destination_reversement, v_langue);
end;
$function$;

-- L'aperçu de la fenêtre « Marquer reversé » : le même texte, dans la langue du restaurant,
-- avec le moyen ACTUEL (celui que le trigger figera à l'enregistrement).
create or replace function public.admin_apercu_message_versement(
  p_restaurant_id uuid, p_montant integer, p_nb integer, p_debut date, p_fin date, p_numeros text[], p_reference text)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_langue text;
  m record;
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select langue into v_langue from public.restaurants where id = p_restaurant_id;
  select * into m from public.moyen_reversement_de(p_restaurant_id);
  return public.message_versement_avec_moyen(
    case when v_langue = 'it'
      then public.texte_message_versement_it(p_montant, p_nb, p_debut, p_fin, p_numeros, p_reference)
      else public.texte_message_versement(p_montant, p_nb, p_debut, p_fin, p_numeros, p_reference) end,
    m.moyen, m.destination, v_langue);
end $$;
revoke all on function public.admin_apercu_message_versement(uuid, integer, integer, date, date, text[], text) from public, anon;
grant execute on function public.admin_apercu_message_versement(uuid, integer, integer, date, date, text[], text) to authenticated;

revoke all on function public.normaliser_numero_orange_money(text) from public, anon, authenticated;
revoke all on function public.afficher_numero_orange_money(text) from public, anon, authenticated;
revoke all on function public.message_versement_avec_moyen(text, text, text, text) from public, anon, authenticated;
