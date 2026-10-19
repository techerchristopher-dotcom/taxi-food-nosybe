-- 🏁 Clôture de service (2026-10-19) — lot 1 : rapport figé en base + Telegram + admin + auto + hebdo.
--
-- Demande du porteur du projet : un bouton « fin de service » qui fige le bilan du service
-- (midi ou soir) en base et l'envoie dans le groupe Telegram « Taxi Food — Clôtures de
-- service » (identifiant au Vault : telegram_cloture_chat_id). Décisions du 19/10 : deux
-- services par jour (midi, soir) ; clôture AUTOMATIQUE si personne n'appuie (15 h 45 et
-- 22 h 45, heure de Nosy Be) ; rapport HEBDOMADAIRE le lundi à 8 h. Le bouton viendra aussi
-- de Telegram (/cloture, lot 2) et de l'app livreur (lot 3) : tous passent par
-- `cloturer_service_core`.
--
-- Une clôture couvre les commandes CRÉÉES depuis la fin de la clôture précédente (midi ou
-- soir) : rien n'est compté deux fois, rien n'est oublié, même si l'on clôture tôt.
-- Les montants reprennent les formules en place : dû au restaurant = celle
-- d'admin_commandes_a_reverser (plats + emballage restaurant − commission − part offerte),
-- marge Taxi Food = facturé − dû. Seules les commandes livrées comptent pour l'argent.

create table if not exists public.clotures_service (
  id uuid primary key default gen_random_uuid(),
  service text not null check (service in ('midi', 'soir', 'hebdo')),
  jour date not null,
  debut timestamptz not null,
  fin timestamptz not null,
  mode text not null check (mode in ('manuel', 'auto', 'telegram', 'livreur')),
  cloture_par uuid references auth.users(id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  rapport jsonb not null,
  texte text not null,
  telegram_requete bigint,
  created_at timestamptz not null default now(),
  check (fin > debut)
);
create index if not exists clotures_service_fin_idx on public.clotures_service (service, fin desc);
alter table public.clotures_service enable row level security;
revoke all on public.clotures_service from public, anon, authenticated;

-- ── Les chiffres ─────────────────────────────────────────────────────────────────────
create or replace function public.rapport_service(p_debut timestamptz, p_fin timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with o as (
  select o.*, r.name as resto, r.commission_rate as taux_resto,
         (o.subtotal + (o.packaging_fee - o.emballage_taxifood)
          - coalesce(o.commission_amount,
                     greatest(round((o.subtotal + (o.packaging_fee - o.emballage_taxifood) - o.remise_charge_restaurant)
                                    * r.commission_rate)::integer, 0))
          - o.remise_charge_restaurant)::bigint as du_resto,
         pom.etat as om_etat,
         e.distance_km, e.total_min as estime_min, e.heure_livree_estimee
  from orders o
  join restaurants r on r.id = o.restaurant_id
  left join paiements_orange_money pom on pom.order_id = o.id
  left join estimations_commande e on e.order_id = o.id
  where o.created_at >= p_debut and o.created_at < p_fin
    -- Taxi Be sert aux commandes de test (restaurant masque, sans client) : il ne compte pas
    and r.id <> 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886'
),
l as (select * from o where status = 'livree'),
premieres as (  -- premiere commande livree de chaque client, toutes periodes confondues
  select user_id, min(created_at) as premiere from orders where status = 'livree' and user_id is not null group by user_id
)
select jsonb_build_object(
  'debut', p_debut, 'fin', p_fin,
  'commandes', (select count(*) from o),
  'livrees', (select count(*) from l),
  'annulees', (select count(*) from o where status = 'annulee'),
  'en_cours', (select count(*) from o where status not in ('livree', 'annulee')),
  'facture', (select coalesce(sum(total), 0) from l),
  'plats', (select coalesce(sum(subtotal), 0) from l),
  'livraisons', (select coalesce(sum(delivery_fee), 0) from l),
  'emballages', (select coalesce(sum(packaging_fee), 0) from l),
  'remises_codes', (select coalesce(sum(promo_discount), 0) from l),
  'remises_porte_monnaie', (select coalesce(sum(remise_porte_monnaie), 0) from l),
  'du_restaurants', (select coalesce(sum(du_resto), 0) from l),
  'marge', (select coalesce(sum(total - du_resto), 0) from l),
  'encaisse', jsonb_build_object(
    'especes', (select coalesce(sum(total), 0) from l where payment_method = 'especes'),
    'om_recu', (select coalesce(sum(total), 0) from l where payment_method = 'orange_money' and coalesce(om_etat, '') = 'recu'),
    'om_a_verifier', (select coalesce(sum(total), 0) from l where payment_method = 'orange_money' and not om_en_ligne and coalesce(om_etat, 'a_verifier') <> 'recu'),
    'om_en_ligne', (select coalesce(sum(total), 0) from l where payment_method = 'orange_money' and om_en_ligne and payment_status = 'paye'),
    'carte', (select coalesce(sum(total), 0) from l where payment_method = 'cb' and payment_status in ('paye', 'rembourse'))
  ),
  'panier_moyen', (select round(avg(subtotal)) from l),
  'livraison_moyenne', (select round(avg(delivery_fee)) from l),
  'distance_moyenne_km', (select round(avg(distance_km)::numeric, 1) from l),
  'delai_median_min', (select round(percentile_cont(0.5) within group (order by extract(epoch from (delivered_at - created_at)) / 60)::numeric)
                       from l where delivered_at is not null),
  'delai_estime_median_min', (select round(percentile_cont(0.5) within group (order by estime_min)::numeric) from l where estime_min is not null),
  'retards', (select count(*) from l where heure_livree_estimee is not null and delivered_at > heure_livree_estimee + interval '10 minutes'),
  'reponse_resto_median_min', (select round(percentile_cont(0.5) within group (order by extract(epoch from (accepted_at - created_at)) / 60)::numeric, 1)
                               from o where accepted_at is not null),
  'relances_resto', (select count(*) from o where relance_restaurant_le is not null),
  'taux_annulation', (select case when count(*) > 0 then round(100.0 * count(*) filter (where status = 'annulee') / count(*)) end from o),
  'clients', (select count(distinct user_id) from l),
  'nouveaux_clients', (select count(distinct l.user_id) from l join premieres p on p.user_id = l.user_id and p.premiere = l.created_at),
  'par_restaurant', (select coalesce(jsonb_agg(x order by x->>'facture' desc), '[]'::jsonb) from (
      select jsonb_build_object('nom', resto,
        'livrees', count(*) filter (where status = 'livree'),
        'annulees', count(*) filter (where status = 'annulee'),
        'facture', coalesce(sum(total) filter (where status = 'livree'), 0),
        'du', coalesce(sum(du_resto) filter (where status = 'livree'), 0)) x
      from o group by resto) t),
  'par_livreur', (select coalesce(jsonb_agg(x order by x->>'courses' desc), '[]'::jsonb) from (
      select jsonb_build_object('nom', coalesce(nullif(btrim(p.full_name), ''), 'Livreur'),
        'courses', count(*),
        'especes_a_remettre', coalesce(sum(l.total) filter (where l.payment_method = 'especes'), 0)) x
      from l left join profiles p on p.id = l.courier_id where l.courier_id is not null group by p.full_name) t),
  'annulations', (select coalesce(jsonb_agg(jsonb_build_object('numero', order_number, 'resto', resto,
        'motif', coalesce(cancellation_reason, '?')) order by created_at), '[]'::jsonb) from o where status = 'annulee'),
  'en_cours_liste', (select coalesce(jsonb_agg(jsonb_build_object('numero', order_number, 'resto', resto, 'statut', status) order by created_at), '[]'::jsonb)
        from o where status not in ('livree', 'annulee')),
  'om_a_verifier_liste', (select coalesce(jsonb_agg(order_number order by created_at), '[]'::jsonb)
        from l where payment_method = 'orange_money' and not om_en_ligne and coalesce(om_etat, 'a_verifier') <> 'recu'),
  'avis', (select jsonb_build_object('nombre', count(*), 'moyenne', round(avg(note_restaurant)::numeric, 1))
           from avis where created_at >= p_debut and created_at < p_fin),
  'programmees_a_venir', (select count(*) from orders where livraison_souhaitee_a > p_fin and status not in ('annulee', 'livree'))
) $$;
revoke all on function public.rapport_service(timestamptz, timestamptz) from public, anon, authenticated;

-- ── Le message ───────────────────────────────────────────────────────────────────────
create or replace function public.ar(n numeric) returns text language sql immutable as $$
  select replace(to_char(coalesce(n, 0), 'FM999,999,999,990'), ',', ' ') || ' Ar' $$;
revoke all on function public.ar(numeric) from public, anon, authenticated;

create or replace function public.texte_rapport_service(p_r jsonb, p_titre text, p_comparaison jsonb default null, p_note text default null)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  t text;
  x jsonb;
  e jsonb := p_r->'encaisse';
  evol text := '';
begin
  if p_comparaison is not null and (p_comparaison->>'facture')::numeric > 0 then
    evol := ' (' || case when (p_r->>'facture')::numeric >= (p_comparaison->>'facture')::numeric then '+' else '' end
         || round(100.0 * ((p_r->>'facture')::numeric - (p_comparaison->>'facture')::numeric) / (p_comparaison->>'facture')::numeric)
         || ' % vs semaine passée)';
  elsif p_comparaison is not null then
    evol := ' (semaine passée : ' || ar((p_comparaison->>'facture')::numeric) || ')';
  end if;

  t := '🏁 ' || p_titre || chr(10) || chr(10)
    || '🛵 Commandes : ' || (p_r->>'commandes') || ' · livrées ' || (p_r->>'livrees')
    || ' · annulées ' || (p_r->>'annulees') || ' · en cours ' || (p_r->>'en_cours') || chr(10)
    || '💰 Facturé (livrées) : ' || ar((p_r->>'facture')::numeric) || evol || chr(10)
    || '   plats ' || ar((p_r->>'plats')::numeric) || ' · livraisons ' || ar((p_r->>'livraisons')::numeric)
    || ' · emballages ' || ar((p_r->>'emballages')::numeric) || chr(10);
  if (p_r->>'remises_codes')::numeric + (p_r->>'remises_porte_monnaie')::numeric > 0 then
    t := t || '   remises : codes ' || ar((p_r->>'remises_codes')::numeric) || ' · porte-monnaie ' || ar((p_r->>'remises_porte_monnaie')::numeric) || chr(10);
  end if;
  t := t || '🏦 Encaissé : espèces ' || ar((e->>'especes')::numeric)
    || ' · OM reçu ' || ar((e->>'om_recu')::numeric)
    || case when (e->>'om_en_ligne')::numeric > 0 then ' · OM appli ' || ar((e->>'om_en_ligne')::numeric) else '' end
    || ' · carte ' || ar((e->>'carte')::numeric)
    || case when (e->>'om_a_verifier')::numeric > 0 then chr(10) || '   ⚠️ OM à vérifier : ' || ar((e->>'om_a_verifier')::numeric) else '' end || chr(10)
    || '🍽️ Dû aux restaurants : ' || ar((p_r->>'du_restaurants')::numeric) || chr(10)
    || '📈 Marge Taxi Food : ' || ar((p_r->>'marge')::numeric) || chr(10) || chr(10);

  if (p_r->>'livrees')::int > 0 then
    t := t || '📐 Panier moyen ' || ar((p_r->>'panier_moyen')::numeric)
      || ' · livraison moyenne ' || ar((p_r->>'livraison_moyenne')::numeric)
      || coalesce(' · ' || replace(p_r->>'distance_moyenne_km', '.', ',') || ' km', '') || chr(10)
      || '⏱️ Délai médian ' || coalesce(p_r->>'delai_median_min', '?') || ' min'
      || coalesce(' (estimé ' || (p_r->>'delai_estime_median_min') || ' min)', '')
      || ' · retards > 10 min : ' || (p_r->>'retards') || chr(10);
  end if;
  t := t || '🍳 Réponse resto médiane ' || coalesce(replace(p_r->>'reponse_resto_median_min', '.', ',') || ' min', '—')
    || ' · relances à 3 min : ' || (p_r->>'relances_resto')
    || coalesce(' · annulation ' || (p_r->>'taux_annulation') || ' %', '') || chr(10)
    || '👥 Clients ' || (p_r->>'clients') || ' dont ' || (p_r->>'nouveaux_clients') || ' nouveau(x)' || chr(10);

  if jsonb_array_length(p_r->'par_restaurant') > 0 then
    t := t || chr(10) || '🏪 Par restaurant' || chr(10);
    for x in select * from jsonb_array_elements(p_r->'par_restaurant') loop
      t := t || '   ' || (x->>'nom') || ' : ' || (x->>'livrees') || ' livrée(s), ' || ar((x->>'facture')::numeric)
        || case when (x->>'annulees')::int > 0 then ', ' || (x->>'annulees') || ' annulée(s)' else '' end || chr(10);
    end loop;
  end if;
  if jsonb_array_length(p_r->'par_livreur') > 0 then
    t := t || chr(10) || '🛵 Par livreur' || chr(10);
    for x in select * from jsonb_array_elements(p_r->'par_livreur') loop
      t := t || '   ' || (x->>'nom') || ' : ' || (x->>'courses') || ' course(s), espèces à remettre ' || ar((x->>'especes_a_remettre')::numeric) || chr(10);
    end loop;
  end if;

  if jsonb_array_length(p_r->'annulations') > 0 or jsonb_array_length(p_r->'en_cours_liste') > 0
     or jsonb_array_length(p_r->'om_a_verifier_liste') > 0 then
    t := t || chr(10) || '⚠️ À regarder' || chr(10);
    for x in select * from jsonb_array_elements(p_r->'annulations') loop
      t := t || '   ❌ ' || (x->>'numero') || ' (' || (x->>'resto') || ') : ' || left(x->>'motif', 120) || chr(10);
    end loop;
    for x in select * from jsonb_array_elements(p_r->'en_cours_liste') loop
      t := t || '   ⏳ ' || (x->>'numero') || ' (' || (x->>'resto') || ') encore « ' || (x->>'statut') || ' »' || chr(10);
    end loop;
    if jsonb_array_length(p_r->'om_a_verifier_liste') > 0 then
      t := t || '   📱 OM à vérifier : ' || (select string_agg(v #>> '{}', ', ') from jsonb_array_elements(p_r->'om_a_verifier_liste') v) || chr(10);
    end if;
  end if;

  if coalesce((p_r->'avis'->>'nombre')::int, 0) > 0 then
    t := t || chr(10) || '⭐ Avis : ' || (p_r->'avis'->>'nombre') || coalesce(' (moyenne ' || replace(p_r->'avis'->>'moyenne', '.', ',') || '/5)', '') || chr(10);
  end if;
  if (p_r->>'programmees_a_venir')::int > 0 then
    t := t || '📅 Commandes programmées à venir : ' || (p_r->>'programmees_a_venir') || chr(10);
  end if;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    t := t || chr(10) || '📝 ' || btrim(p_note) || chr(10);
  end if;
  return left(t, 4000);  -- plafond Telegram : 4 096 caracteres
end $$;
revoke all on function public.texte_rapport_service(jsonb, text, jsonb, text) from public, anon, authenticated;

-- ── L'envoi ──────────────────────────────────────────────────────────────────────────
create or replace function public.envoyer_telegram_cloture(p_texte text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_tok text; v_chat text;
begin
  select decrypted_secret into v_tok from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_cloture_chat_id';
  if v_tok is null or v_chat is null then return null; end if;
  return net.http_post(
    url := 'https://api.telegram.org/bot' || v_tok || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat, 'disable_web_page_preview', true, 'text', p_texte),
    timeout_milliseconds := 30000);
end $$;
revoke all on function public.envoyer_telegram_cloture(text) from public, anon, authenticated;

-- ── Le geste ─────────────────────────────────────────────────────────────────────────
-- Toutes les portes (admin, auto, Telegram, livreur) passent ici.
create or replace function public.cloturer_service_core(p_mode text, p_par uuid, p_note text, p_forcer boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fin timestamptz := now();
  v_debut timestamptz;
  v_local timestamp := now() at time zone 'Indian/Antananarivo';
  v_service text;
  v_jour date;
  v_r jsonb;
  v_comp jsonb;
  v_titre text;
  v_texte text;
  v_id uuid;
  v_req bigint;
  v_jours text[] := array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
begin
  perform pg_advisory_xact_lock(hashtext('cloture_service'));

  select max(fin) into v_debut from clotures_service where service in ('midi', 'soir');
  -- premiere cloture, ou longue interruption : jamais plus de 18 h en arriere
  v_debut := greatest(coalesce(v_debut, v_fin - interval '18 hours'), v_fin - interval '18 hours');

  -- avant 5 h du matin, on clot encore le soir de la veille
  v_jour := (v_local - interval '5 hours')::date;
  v_service := case when extract(hour from v_local) between 5 and 15 then 'midi' else 'soir' end;

  v_r := rapport_service(v_debut, v_fin);

  if (v_r->>'en_cours')::int > 0 and not coalesce(p_forcer, false) then
    return jsonb_build_object('ok', false, 'raison', 'commandes_en_cours', 'en_cours', v_r->'en_cours_liste');
  end if;
  if p_mode = 'auto' and (v_r->>'commandes')::int = 0 then
    return jsonb_build_object('ok', false, 'raison', 'rien_a_cloturer');
  end if;

  -- meme service une semaine plus tot, pour la comparaison
  v_comp := rapport_service(v_debut - interval '7 days', v_fin - interval '7 days');

  v_titre := 'Clôture — ' || v_jours[extract(dow from v_jour)::int + 1] || ' ' || to_char(v_jour, 'DD/MM')
          || ', service du ' || v_service
          || ' (' || to_char(v_debut at time zone 'Indian/Antananarivo', 'HH24"h"MI') || ' → '
          || to_char(v_fin at time zone 'Indian/Antananarivo', 'HH24"h"MI') || ')'
          || case p_mode when 'auto' then ' · automatique' when 'telegram' then ' · via Telegram'
                         when 'livreur' then ' · par le livreur' else '' end;
  v_texte := texte_rapport_service(v_r, v_titre, v_comp, p_note);

  insert into clotures_service (service, jour, debut, fin, mode, cloture_par, note, rapport, texte)
  values (v_service, v_jour, v_debut, v_fin, p_mode, p_par, nullif(btrim(coalesce(p_note, '')), ''),
          v_r || jsonb_build_object('comparaison_semaine_passee', v_comp), v_texte)
  returning id into v_id;

  v_req := envoyer_telegram_cloture(v_texte);
  update clotures_service set telegram_requete = v_req where id = v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'service', v_service, 'texte', v_texte);
end $$;
revoke all on function public.cloturer_service_core(text, uuid, text, boolean) from public, anon, authenticated;

-- Porte admin (bouton de l'onglet Temps reel)
create or replace function public.admin_cloturer_service(p_note text default null, p_forcer boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return cloturer_service_core('manuel', auth.uid(), p_note, p_forcer);
end $$;
revoke all on function public.admin_cloturer_service(text, boolean) from public, anon, authenticated;
grant execute on function public.admin_cloturer_service(text, boolean) to authenticated;

-- Apercu sans rien figer (pour l'ecran)
create or replace function public.admin_apercu_cloture()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_debut timestamptz;
begin
  if not is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  select max(fin) into v_debut from clotures_service where service in ('midi', 'soir');
  v_debut := greatest(coalesce(v_debut, now() - interval '18 hours'), now() - interval '18 hours');
  return rapport_service(v_debut, now());
end $$;
revoke all on function public.admin_apercu_cloture() from public, anon, authenticated;
grant execute on function public.admin_apercu_cloture() to authenticated;

create or replace function public.admin_lister_clotures(p_limite int default 30)
returns table (id uuid, service text, jour date, debut timestamptz, fin timestamptz, mode text, note text, texte text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query select c.id, c.service, c.jour, c.debut, c.fin, c.mode, c.note, c.texte, c.created_at
    from clotures_service c order by c.created_at desc limit least(greatest(p_limite, 1), 200);
end $$;
revoke all on function public.admin_lister_clotures(int) from public, anon, authenticated;
grant execute on function public.admin_lister_clotures(int) to authenticated;

-- ── Le filet : cloture automatique ───────────────────────────────────────────────────
-- 15 h 45 et 22 h 45 a Nosy Be. Commandes encore en cours : on clot quand meme (elles sont
-- listees « a regarder ») — un rapport incomplet vaut mieux que pas de rapport.
create or replace function public.cloturer_service_auto()
returns jsonb
language sql
security definer
set search_path = public
as $$ select cloturer_service_core('auto', null, null, true) $$;
revoke all on function public.cloturer_service_auto() from public, anon, authenticated;

-- ── Le rapport hebdomadaire ──────────────────────────────────────────────────────────
create or replace function public.rapport_hebdo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lundi date := date_trunc('week', (now() at time zone 'Indian/Antananarivo'))::date;  -- lundi de cette semaine
  v_debut timestamptz := (v_lundi - 7)::timestamp at time zone 'Indian/Antananarivo';
  v_fin timestamptz := v_lundi::timestamp at time zone 'Indian/Antananarivo';
  v_r jsonb; v_comp jsonb; v_texte text; v_id uuid;
begin
  if exists (select 1 from clotures_service where service = 'hebdo' and debut = v_debut) then
    return jsonb_build_object('ok', false, 'raison', 'deja_fait');
  end if;
  v_r := rapport_service(v_debut, v_fin);
  v_comp := rapport_service(v_debut - interval '7 days', v_fin - interval '7 days');
  v_texte := texte_rapport_service(v_r, 'Semaine du ' || to_char(v_lundi - 7, 'DD/MM') || ' au ' || to_char(v_lundi - 1, 'DD/MM'), v_comp, null);
  insert into clotures_service (service, jour, debut, fin, mode, rapport, texte)
  values ('hebdo', v_lundi - 7, v_debut, v_fin, 'auto', v_r || jsonb_build_object('comparaison_semaine_passee', v_comp), v_texte)
  returning id into v_id;
  update clotures_service set telegram_requete = envoyer_telegram_cloture(v_texte) where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;
revoke all on function public.rapport_hebdo() from public, anon, authenticated;

-- Taches planifiees (UTC = Nosy Be - 3 h)
select cron.schedule('cloture-auto-midi', '45 12 * * *', $$select public.cloturer_service_auto()$$);
select cron.schedule('cloture-auto-soir', '45 19 * * *', $$select public.cloturer_service_auto()$$);
select cron.schedule('rapport-hebdo', '0 5 * * 1', $$select public.rapport_hebdo()$$);
