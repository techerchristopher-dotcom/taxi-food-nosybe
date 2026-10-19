-- Prospection des restaurants : une page par restaurant (/pro/<slug>), la prise de
-- rendez-vous, et la séquence de contact calculée par la base.
--
-- Décisions du porteur du projet (2026-10-19) :
--   * tout reste GRATUIT : pas d'API WhatsApp officielle. Le message part de son
--     WhatsApp Web, piloté par la compétence « prospection-whatsapp-restaurants »,
--     lentement. La base dit À QUI écrire, QUOI, et QUAND relancer ;
--   * trois arguments : visibilité sur nos réseaux (exemples à l'appui), chiffre
--     d'affaires en plus sans charges en plus, un nouveau canal de vente ;
--   * aucun taux de commission dans les messages ni sur la page (il se négocie).
--
-- Ce que la migration pose :
--   prospects_restaurant.slug / accroche      l'adresse de la page, la phrase perso
--   prospect_restaurant_actions.etape         whatsapp_1 / whatsapp_relance
--   prospect_restaurant_ouvertures            qui a ouvert sa page (sans donnée perso)
--   rdv_disponibilites / rdv_prospects        les créneaux et les rendez-vous pris
--   prospect_restaurant_etape()               LA règle de la séquence
--   prospects_restaurant_sequence (vue)       pilotage + étape, pour l'admin
--   pro_page / pro_compter_ouverture / pro_reserver / pro_etre_rappele  (anon, page)
--   prospects_whatsapp_a_envoyer / prospect_whatsapp_noter / prospect_whatsapp_reponse
--                                             (service seulement : la compétence)
--   admin_* équivalents pour l'écran.

-- ───────────────────────────────────────────────────────────── 1. slug, accroche
create or replace function public.slug_texte(p text) returns text
language sql immutable set search_path = public as $$
  select trim(both '-' from regexp_replace(
           translate(lower(coalesce(p, '')),
             'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ''’',
             'aaaaaaceeeeiiiinooooouuuuyyoa  '),
           '[^a-z0-9]+', '-', 'g'))
$$;

alter table public.prospects_restaurant
  add column if not exists slug text,
  add column if not exists accroche text;

alter table public.prospects_restaurant
  add constraint prospects_restaurant_accroche_courte check (accroche is null or char_length(accroche) <= 300);

-- Remplissage : nom → slug ; un doublon prend -2, -3… dans l'ordre de création.
with base as (
  select id, coalesce(nullif(left(public.slug_texte(nom), 48), ''), 'restaurant') s,
         row_number() over (partition by coalesce(nullif(left(public.slug_texte(nom), 48), ''), 'restaurant')
                            order by created_at, id) n
    from public.prospects_restaurant)
update public.prospects_restaurant p
   set slug = case when b.n = 1 then b.s else b.s || '-' || b.n end
  from base b where b.id = p.id;

alter table public.prospects_restaurant alter column slug set not null;
create unique index prospects_restaurant_slug_uniq on public.prospects_restaurant (slug);

create or replace function public.prospects_restaurant_slug_auto() returns trigger
language plpgsql set search_path = public as $$
declare v_base text; v_s text; i int := 1;
begin
  if new.slug is not null and new.slug <> '' then return new; end if;
  v_base := coalesce(nullif(left(public.slug_texte(new.nom), 48), ''), 'restaurant');
  v_s := v_base;
  while exists (select 1 from public.prospects_restaurant where slug = v_s) loop
    i := i + 1; v_s := v_base || '-' || i;
  end loop;
  new.slug := v_s;
  return new;
end $$;
create trigger prospects_restaurant_slug before insert on public.prospects_restaurant
  for each row execute function public.prospects_restaurant_slug_auto();

-- ─────────────────────────────────────────── 2. journal : canal « page » + étape
alter table public.prospect_restaurant_actions drop constraint prospect_restaurant_actions_canal_connu;
alter table public.prospect_restaurant_actions add constraint prospect_restaurant_actions_canal_connu
  check (canal in ('whatsapp','appel','messenger','email','visite','degustation','page'));
alter table public.prospect_restaurant_actions add column if not exists etape text;
alter table public.prospect_restaurant_actions add constraint prospect_restaurant_actions_etape_connue
  check (etape is null or etape in ('whatsapp_1','whatsapp_relance'));

-- ─────────────────────────────────────────────────── 3. ouvertures de la page
-- Aucune donnée personnelle : ni IP, ni agent utilisateur. Juste « quand ».
create table public.prospect_restaurant_ouvertures (
  id          bigint generated always as identity primary key,
  prospect_id uuid not null references public.prospects_restaurant(id) on delete cascade,
  quand       timestamptz not null default now()
);
create index prospect_restaurant_ouvertures_idx on public.prospect_restaurant_ouvertures (prospect_id, quand desc);
alter table public.prospect_restaurant_ouvertures enable row level security;
create policy prospect_restaurant_ouvertures_admin on public.prospect_restaurant_ouvertures
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.prospect_restaurant_ouvertures from anon, authenticated;

-- ───────────────────────────────────────────────────────── 4. rendez-vous
-- Disponibilités hebdomadaires du porteur du projet, heure de Nosy Be.
-- Par défaut : entre les services (le patron est là, la cuisine est calme).
create table public.rdv_disponibilites (
  id          int generated always as identity primary key,
  jour_iso    smallint not null check (jour_iso between 1 and 7),   -- 1 = lundi
  debut       time not null,
  fin         time not null,
  duree_min   smallint not null default 30 check (duree_min between 10 and 120),
  actif       boolean not null default true,
  check (fin > debut)
);
alter table public.rdv_disponibilites enable row level security;
create policy rdv_disponibilites_admin on public.rdv_disponibilites
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.rdv_disponibilites (jour_iso, debut, fin)
select j, d, f from generate_series(1, 6) j,
  (values ('09:30'::time, '11:30'::time), ('14:30'::time, '17:00'::time)) v(d, f);

create table public.rdv_prospects (
  id                uuid primary key default gen_random_uuid(),
  prospect_id       uuid not null references public.prospects_restaurant(id) on delete cascade,
  debut             timestamptz not null,
  duree_min         smallint not null default 30,
  contact_nom       text not null check (char_length(contact_nom) between 2 and 80),
  contact_telephone text not null check (char_length(contact_telephone) between 6 and 30),
  message           text check (message is null or char_length(message) <= 500),
  statut            text not null default 'confirme' check (statut in ('confirme','annule','fait','absent')),
  cree_le           timestamptz not null default now(),
  maj_le            timestamptz not null default now()
);
create unique index rdv_prospects_un_par_creneau on public.rdv_prospects (debut) where statut = 'confirme';
create unique index rdv_prospects_un_par_prospect on public.rdv_prospects (prospect_id) where statut = 'confirme';
alter table public.rdv_prospects enable row level security;
create policy rdv_prospects_admin on public.rdv_prospects
  for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.rdv_prospects from anon, authenticated;

-- Créneaux libres : 12 prochains jours, au moins 3 h à l'avance.
create or replace function public.rdv_creneaux_libres(p_jours int default 12)
returns table (debut timestamptz)
language sql stable security definer set search_path = public as $$
  with jours as (
    select (now() at time zone 'Indian/Antananarivo')::date + g as jour
      from generate_series(0, greatest(1, least(p_jours, 30))) g),
  plages as (
    select j.jour, d.debut, d.fin, d.duree_min
      from jours j join public.rdv_disponibilites d
        on d.actif and d.jour_iso = extract(isodow from j.jour)),
  creneaux as (
    select (t at time zone 'Indian/Antananarivo') as debut
      from plages p,
           generate_series(p.jour + p.debut, p.jour + p.fin - make_interval(mins => p.duree_min),
                           make_interval(mins => p.duree_min)) t)
  select c.debut from creneaux c
   where c.debut > now() + interval '3 hours'
     and not exists (select 1 from public.rdv_prospects r where r.statut = 'confirme' and r.debut = c.debut)
   order by c.debut
$$;
revoke all on function public.rdv_creneaux_libres(int) from public, anon, authenticated;

-- ─────────────────────────────────────────── 5. numéro WhatsApp d'une fiche
-- Un mobile malgache (032/033/034/037/038) est un WhatsApp probable ; un numéro
-- étranger aussi. Un fixe (020…) non. Rend les chiffres au format international.
create or replace function public.numero_whatsapp(p_tel text) returns text
language sql immutable set search_path = public as $$
  select case
    when d ~ '^2613[2-8][0-9]{7}$' then d
    when d ~ '^03[2-8][0-9]{7}$' then '261' || substr(d, 2)
    when d ~ '^3[2-8][0-9]{7}$' then '261' || d
    when d ~ '^00[1-9][0-9]{7,13}$' and d !~ '^00261' then substr(d, 3)
    when d ~ '^(33|39|41|32|49|44|34|27|262|269|230|1)[0-9]{8,11}$' and length(d) between 10 and 13 then d
    else null end
  from (select regexp_replace(coalesce(p_tel, ''), '[^0-9]', '', 'g') as d) x
$$;

-- ─────────────────────────────────────────────── 6. LA règle de la séquence
-- J0 WhatsApp → J+2 relance s'il n'a pas ouvert sa page → J+4 appel → J+7 visite.
-- Page ouverte sans rendez-vous : appel dès le lendemain (il est chaud).
-- Une réponse entrante non traitée passe devant tout : « répondre ».
create or replace function public.prospect_restaurant_etape(p public.prospects_restaurant)
returns table (etape text, a_faire_le timestamptz, raison text, numero_wa text, nb_ouvertures int,
               derniere_ouverture timestamptz, rdv_le timestamptz, rang int)
language plpgsql stable security invoker set search_path = public as $$
declare
  v_wa text := coalesce(public.numero_whatsapp(p.telephone), public.numero_whatsapp(p.telephone_2));
  v_w1 timestamptz; v_rel timestamptz; v_appel timestamptz; v_appel_res text; v_visite timestamptz;
  v_dernier_sortant timestamptz; v_entrant timestamptz; v_mauvais boolean;
begin
  select count(*)::int, max(o.quand) into nb_ouvertures, derniere_ouverture
    from public.prospect_restaurant_ouvertures o where o.prospect_id = p.id;
  select r.debut into rdv_le from public.rdv_prospects r where r.prospect_id = p.id and r.statut = 'confirme';
  select max(a.fait_le) filter (where a.etape = 'whatsapp_1' or (a.canal = 'whatsapp' and a.sens = 'sortant' and a.etape is null and a.resultat <> 'mauvais_numero')),
         max(a.fait_le) filter (where a.etape = 'whatsapp_relance'),
         max(a.fait_le) filter (where a.canal = 'appel' and a.sens = 'sortant'),
         max(a.fait_le) filter (where a.canal = 'visite'),
         max(a.fait_le) filter (where a.sens = 'sortant'),
         max(a.fait_le) filter (where a.sens = 'entrant'),
         bool_or(a.canal = 'whatsapp' and a.resultat = 'mauvais_numero')
    into v_w1, v_rel, v_appel, v_visite, v_dernier_sortant, v_entrant, v_mauvais
    from public.prospect_restaurant_actions a where a.prospect_id = p.id;
  select a.resultat into v_appel_res from public.prospect_restaurant_actions a
   where a.prospect_id = p.id and a.canal = 'appel' and a.sens = 'sortant' order by a.fait_le desc limit 1;
  if coalesce(v_mauvais, false) then v_wa := null; end if;
  numero_wa := v_wa;

  if p.statut in ('partenaire','refuse','ferme','doublon','hors_zone','exclu') or p.restaurant_id is not null then
    return next; return;
  end if;
  if rdv_le is not null then
    etape := 'rdv'; a_faire_le := rdv_le; raison := 'Rendez-vous pris sur sa page'; rang := 0; return next; return;
  end if;
  if p.statut = 'rdv' then return next; return; end if;   -- rendez-vous pris à la main : suivi manuel
  if v_entrant is not null and (v_dernier_sortant is null or v_entrant > v_dernier_sortant) then
    etape := 'repondre'; a_faire_le := v_entrant; raison := 'Il a répondu : à toi de jouer'; rang := 1; return next; return;
  end if;
  if p.statut = 'interesse' then
    etape := 'appel'; a_faire_le := greatest(now(), coalesce(v_appel + interval '3 days', now()));
    raison := 'Intéressé : fixer le rendez-vous'; rang := 2; return next; return;
  end if;
  if v_wa is not null and v_w1 is null and v_appel is null and v_visite is null then
    etape := 'whatsapp_1'; a_faire_le := now(); raison := 'Premier message WhatsApp'; rang := 5; return next; return;
  end if;
  if v_w1 is not null and v_rel is null and v_appel is null then
    if nb_ouvertures > 0 then
      etape := 'appel'; a_faire_le := v_w1 + interval '1 day'; raison := 'A ouvert sa page sans réserver : l''appeler'; rang := 3;
    else
      etape := 'whatsapp_relance'; a_faire_le := v_w1 + interval '2 days'; raison := 'Pas de réponse, page pas ouverte'; rang := 4;
    end if;
    return next; return;
  end if;
  if v_rel is not null and v_appel is null then
    etape := 'appel'; a_faire_le := v_rel + interval '2 days';
    raison := case when nb_ouvertures > 0 then 'A ouvert sa page sans réserver' else 'Toujours sans réponse après la relance' end;
    rang := case when nb_ouvertures > 0 then 3 else 6 end; return next; return;
  end if;
  if v_appel is not null then
    if v_appel_res in ('a_rappeler','pas_de_reponse') and v_visite is null then
      if v_appel_res = 'a_rappeler' then
        etape := 'appel'; a_faire_le := v_appel + interval '2 days'; raison := 'À rappeler'; rang := 6;
      else
        etape := 'visite'; a_faire_le := v_appel + interval '3 days'; raison := 'Injoignable : passer le voir'; rang := 7;
      end if;
    end if;
    return next; return;
  end if;
  -- Jamais contacté et pas de WhatsApp.
  if p.telephone is not null or p.telephone_2 is not null then
    etape := 'appel'; a_faire_le := now(); raison := 'Numéro fixe : appeler'; rang := 6;
  elsif p.facebook_url is not null then
    etape := 'messenger'; a_faire_le := now(); raison := 'Seulement Facebook'; rang := 8;
  else
    etape := 'visite'; a_faire_le := now(); raison := 'Aucun contact public : sur place'; rang := 9;
  end if;
  return next;
end $$;

create view public.prospects_restaurant_sequence with (security_invoker = true) as
select pl.*, e.etape, e.a_faire_le, e.raison, e.numero_wa, e.nb_ouvertures, e.derniere_ouverture, e.rdv_le, e.rang
  from public.prospects_restaurant_pilotage pl
  join public.prospects_restaurant p on p.id = pl.id
  cross join lateral public.prospect_restaurant_etape(p) e;
comment on view public.prospects_restaurant_sequence is
  'Pilotage + prochaine étape de la séquence (prospect_restaurant_etape). security_invoker : admin seul.';

-- ───────────────────────────────────── 6 bis. les chiffres « ça tourne déjà »
-- Demande du porteur du projet : montrer que ça tourne. Chiffres AGRÉGÉS seulement
-- (jamais le chiffre d'un restaurant : ce sont ses données). Taxi Be = restaurant de
-- test, exclu. Lus en direct à chaque affichage : jamais écrits en dur.
create or replace function public.pro_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'commandes_livrees', count(*),
    'ventes_plats', coalesce(sum(o.subtotal), 0),
    'clients', count(distinct o.user_id),
    'depuis', min(o.created_at),
    'livrees_30j', count(*) filter (where o.created_at > now() - interval '30 days'),
    'restaurants', (select count(*) from public.restaurants where listing_status = 'visible'),
    'note', (select round(avg(note_restaurant), 1) from public.avis where statut = 'publie'),
    'nb_avis', (select count(*) from public.avis where statut = 'publie'))
  from public.orders o
  where o.status = 'livree' and o.restaurant_id <> 'ac2766bb-c4d1-4f5e-9a40-3ea0febcb886'
$$;
revoke all on function public.pro_stats() from public, anon, authenticated;

-- ───────────────────────────────────────────────── 7. le texte des messages
create or replace function public.texte_whatsapp_prospect(p_prospect uuid, p_etape text)
returns text language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v_lien text; v_partenaires text; s jsonb := public.pro_stats(); v_chiffres text;
begin
  -- « 91 commandes livrées depuis le 8 septembre, note moyenne 4,8/5 » : lu en direct.
  v_chiffres := 'Depuis le ' || to_char((s->>'depuis')::timestamptz at time zone 'Indian/Antananarivo', 'FMDD')
    || ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])
       [extract(month from (s->>'depuis')::timestamptz at time zone 'Indian/Antananarivo')::int]
    || ' : ' || (s->>'commandes_livrees') || ' commandes livrées'
    || coalesce(', note moyenne ' || replace(s->>'note', '.', ',') || '/5', '') || '.';
  select * into p from public.prospects_restaurant where id = p_prospect;
  if p.id is null then return null; end if;
  v_lien := 'https://taxifoodnosybe.distripro207.com/pro/' || p.slug;
  select string_agg(name, ', ' order by sort_order) into v_partenaires
    from (select name, sort_order from public.restaurants
           where listing_status = 'visible' and id is distinct from p.restaurant_id
           order by sort_order limit 4) r;
  if p_etape = 'whatsapp_relance' then
    return 'Bonjour, je reviens vers vous au sujet de Taxi Food 🙂' || E'\n\n'
      || 'La page préparée pour ' || p.nom || ' est toujours là : ' || v_lien || E'\n\n'
      || 'Un simple « oui » ici et je passe vous voir quand ça vous arrange (20 minutes, sans engagement).' || E'\n\n'
      || 'Christopher — Taxi Food';
  end if;
  return 'Bonjour 👋' || E'\n\n'
    || 'Je suis Christopher, fondateur de Taxi Food, l''application de livraison de repas à Nosy Be. '
    || coalesce(v_partenaires || ' y sont déjà. ', '') || v_chiffres || E'\n\n'
    || coalesce(nullif(trim(p.accroche), '') || E'\n\n', '')
    || 'J''ai préparé une page pour ' || p.nom || ', avec des exemples de ce qu''on fait déjà pour nos restaurants :' || E'\n'
    || '👉 ' || v_lien || E'\n\n'
    || 'En bref : de la visibilité sur nos réseaux, un nouveau canal de vente, et du chiffre d''affaires en plus sans augmenter vos charges. Nos livreurs s''occupent de la livraison.' || E'\n\n'
    || 'Si ça vous intéresse, choisissez un créneau directement sur la page et je passe vous voir 20 minutes. Ou répondez simplement ici.' || E'\n\n'
    || 'Bonne journée,' || E'\n' || 'Christopher — Taxi Food';
end $$;
revoke all on function public.texte_whatsapp_prospect(uuid, text) from public, anon, authenticated;

create or replace function public.admin_texte_whatsapp_prospect(p_prospect uuid, p_etape text default 'whatsapp_1')
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return public.texte_whatsapp_prospect(p_prospect, p_etape);
end $$;
revoke all on function public.admin_texte_whatsapp_prospect(uuid, text) from public, anon;
grant execute on function public.admin_texte_whatsapp_prospect(uuid, text) to authenticated;

-- ──────────────────────────────────── 8. la file WhatsApp de la compétence
-- Service seulement (connexion d'exploitation de la session Claude). Un même numéro
-- n'apparaît qu'une fois, et jamais s'il a déjà reçu un message sur une autre fiche
-- dans les 30 jours (Restaurant 22 / Beach Klub22 partagent un numéro).
create or replace function public.prospects_whatsapp_a_envoyer(p_limite int default 3)
returns table (prospect_id uuid, nom text, zone text, numero text, etape text, raison text,
               km_resto_en_ligne numeric, facebook_url text, site_web text, accroche text, texte text)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.nom, p.zone, e.numero_wa, e.etape, e.raison, e.a_faire_le, e.rang, pl.km_resto_en_ligne,
           p.facebook_url, p.site_web, p.accroche
      from public.prospects_restaurant p
      join public.prospects_restaurant_pilotage pl on pl.id = p.id
      cross join lateral public.prospect_restaurant_etape(p) e
     where e.etape in ('whatsapp_1','whatsapp_relance') and e.a_faire_le <= now() and e.numero_wa is not null),
  d as (
    select distinct on (numero_wa) * from s
     where not exists (
       select 1 from public.prospect_restaurant_actions a join public.prospects_restaurant q on q.id = a.prospect_id
        where a.canal = 'whatsapp' and a.fait_le > now() - interval '30 days' and q.id <> s.id
          and coalesce(public.numero_whatsapp(q.telephone), public.numero_whatsapp(q.telephone_2)) = s.numero_wa)
     order by numero_wa, rang, km_resto_en_ligne nulls last)
  select id, nom, zone, numero_wa, etape, raison, km_resto_en_ligne, facebook_url, site_web, accroche,
         public.texte_whatsapp_prospect(id, etape)
    from d order by (etape = 'whatsapp_relance') desc, km_resto_en_ligne nulls last, nom
   limit greatest(0, least(p_limite, 20))
$$;
revoke all on function public.prospects_whatsapp_a_envoyer(int) from public, anon, authenticated;

-- Après un envoi (ou un échec constaté) dans WhatsApp Web.
--   p_resultat : 'envoye' | 'pas_whatsapp' (numéro sans WhatsApp)
create or replace function public.prospect_whatsapp_noter(p_prospect uuid, p_etape text, p_resultat text, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_statut text;
begin
  if p_etape not in ('whatsapp_1','whatsapp_relance') then raise exception 'etape inconnue %', p_etape; end if;
  if p_resultat not in ('envoye','pas_whatsapp') then raise exception 'resultat inconnu %', p_resultat; end if;
  select statut into v_statut from public.prospects_restaurant where id = p_prospect for update;
  if v_statut is null then raise exception 'prospect inconnu'; end if;
  if v_statut in ('hors_zone','exclu','doublon','refuse','ferme','partenaire') then
    raise exception 'fiche % : pas de message', v_statut; end if;
  if p_resultat = 'envoye' and exists (select 1 from public.prospect_restaurant_actions
      where prospect_id = p_prospect and etape = p_etape) then
    raise exception 'deja_envoye : % a deja recu %', p_prospect, p_etape; end if;
  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, note, etape)
  values (p_prospect, 'whatsapp', 'sortant',
          case p_resultat when 'envoye' then 'pas_de_reponse' else 'mauvais_numero' end,
          coalesce(p_note, case p_resultat when 'envoye' then 'Envoyé depuis WhatsApp Web' else 'Ce numéro n''a pas WhatsApp' end),
          case p_resultat when 'envoye' then p_etape end)
  returning id into v_id;
  if p_resultat = 'envoye' and v_statut = 'a_contacter' then
    update public.prospects_restaurant set statut = 'contacte' where id = p_prospect;
  end if;
  return v_id;
end $$;
revoke all on function public.prospect_whatsapp_noter(uuid, text, text, text) from public, anon, authenticated;

-- Une réponse lue dans WhatsApp Web. La compétence ne répond JAMAIS elle-même :
-- elle note, et le porteur du projet est prévenu sur Telegram.
--   p_resultat : interesse | rdv | a_rappeler | refus | pas_de_reponse (réponse neutre)
create or replace function public.prospect_whatsapp_reponse(p_prospect uuid, p_resultat text, p_extrait text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nom text; v_statut text;
begin
  if p_resultat not in ('interesse','rdv','a_rappeler','refus','pas_de_reponse') then
    raise exception 'resultat inconnu %', p_resultat; end if;
  select nom, statut into v_nom, v_statut from public.prospects_restaurant where id = p_prospect for update;
  if v_nom is null then raise exception 'prospect inconnu'; end if;
  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, note)
  values (p_prospect, 'whatsapp', 'entrant', p_resultat, left(p_extrait, 500)) returning id into v_id;
  update public.prospects_restaurant set statut = case
      when p_resultat = 'refus' then 'refuse'
      when p_resultat = 'rdv' then 'rdv'
      when p_resultat in ('interesse','a_rappeler') and v_statut in ('a_contacter','contacte') then 'interesse'
      else statut end
   where id = p_prospect;
  perform public.telegram_admin_envoyer(
    '💬 ' || v_nom || ' a répondu sur WhatsApp (' || p_resultat || ') :' || E'\n' || '« ' || left(p_extrait, 400) || ' »'
    || E'\n\n' || 'À toi de répondre depuis WhatsApp.');
  return v_id;
end $$;
revoke all on function public.prospect_whatsapp_reponse(uuid, text, text) from public, anon, authenticated;

-- Le même geste depuis l'admin (bouton « Envoyé ✓ » à côté du lien wa.me).
create or replace function public.admin_prospect_whatsapp_envoye(p_prospect uuid, p_etape text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return public.prospect_whatsapp_noter(p_prospect, p_etape, 'envoye', 'Envoyé depuis l''admin');
end $$;
revoke all on function public.admin_prospect_whatsapp_envoye(uuid, text) from public, anon;
grant execute on function public.admin_prospect_whatsapp_envoye(uuid, text) to authenticated;

-- ──────────────────────────────────────────────── 9. la page publique /pro
create or replace function public.pro_page(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.prospects_restaurant; v jsonb;
begin
  select * into p from public.prospects_restaurant where slug = p_slug;
  if p.id is null or p.statut in ('doublon','hors_zone','exclu','ferme') then return null; end if;
  select jsonb_build_object(
    'nom', p.nom, 'zone', p.zone, 'type', p.type_etablissement,
    'deja_partenaire', p.restaurant_id is not null or p.statut = 'partenaire',
    'stats', public.pro_stats(),
    'rdv', (select jsonb_build_object('debut', r.debut, 'nom', r.contact_nom)
              from public.rdv_prospects r where r.prospect_id = p.id and r.statut = 'confirme'),
    'creneaux', coalesce((select jsonb_agg(c.debut order by c.debut) from public.rdv_creneaux_libres(12) c), '[]'::jsonb),
    'partenaires', coalesce((select jsonb_agg(jsonb_build_object(
        'nom', r.name, 'logo', r.logo_url, 'couverture', r.cover_url, 'zone', r.zone,
        'note', r.note_moyenne, 'nb_avis', r.nb_avis) order by r.sort_order)
      from public.restaurants r where r.listing_status = 'visible' and r.id is distinct from p.restaurant_id), '[]'::jsonb),
    'avis', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('prenom', a.prenom_affiche, 'note', a.note_restaurant,
                                  'texte', a.commentaire, 'restaurant', r.name) x
          from public.avis a join public.restaurants r on r.id = a.restaurant_id
         where a.statut = 'publie' and a.consentement_publication
           and a.commentaire is not null and char_length(a.commentaire) >= 20 and a.note_restaurant >= 4
         order by a.created_at desc limit 3) z), '[]'::jsonb)
  ) into v;
  return v;
end $$;
revoke all on function public.pro_page(text) from public;
grant execute on function public.pro_page(text) to anon, authenticated;

-- Une ouverture (les robots d'aperçu sont filtrés côté Netlify). Dédoublonnée sur
-- 30 min ; la PREMIÈRE ouverture prévient le porteur du projet sur Telegram.
create or replace function public.pro_compter_ouverture(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_nom text; v_n int;
begin
  select id, nom into v_id, v_nom from public.prospects_restaurant where slug = p_slug;
  if v_id is null then return; end if;
  if exists (select 1 from public.prospect_restaurant_ouvertures
              where prospect_id = v_id and quand > now() - interval '30 minutes') then return; end if;
  select count(*) into v_n from public.prospect_restaurant_ouvertures where prospect_id = v_id;
  insert into public.prospect_restaurant_ouvertures (prospect_id) values (v_id);
  if v_n = 0 then
    perform public.telegram_admin_envoyer('👀 ' || v_nom || ' vient d''ouvrir sa page Taxi Food. Bon moment pour l''appeler.');
  end if;
end $$;
revoke all on function public.pro_compter_ouverture(text) from public;
grant execute on function public.pro_compter_ouverture(text) to anon, authenticated;

create or replace function public.pro_nettoyer(p text, p_max int) returns text
language sql immutable set search_path = public as $$
  select nullif(left(trim(regexp_replace(regexp_replace(coalesce(p, ''), '[<>[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), p_max), '')
$$;

create or replace function public.pro_reserver(p_slug text, p_debut timestamptz, p_nom text, p_telephone text, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.prospects_restaurant; v_nom text := public.pro_nettoyer(p_nom, 80);
        v_tel text := public.pro_nettoyer(p_telephone, 30); v_msg text := public.pro_nettoyer(p_message, 500);
begin
  select * into p from public.prospects_restaurant where slug = p_slug for update;
  if p.id is null or p.statut in ('doublon','hors_zone','exclu','ferme') then return jsonb_build_object('ok', false, 'erreur', 'inconnu'); end if;
  if v_nom is null or char_length(v_nom) < 2 then return jsonb_build_object('ok', false, 'erreur', 'nom'); end if;
  if v_tel is null or length(regexp_replace(v_tel, '[^0-9]', '', 'g')) not between 9 and 15 then
    return jsonb_build_object('ok', false, 'erreur', 'telephone'); end if;
  if exists (select 1 from public.rdv_prospects where prospect_id = p.id and statut = 'confirme') then
    return jsonb_build_object('ok', false, 'erreur', 'deja_rdv'); end if;
  if (select count(*) from public.rdv_prospects where prospect_id = p.id and cree_le > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'erreur', 'trop'); end if;
  perform pg_advisory_xact_lock(hashtext('rdv_prospects'));
  if not exists (select 1 from public.rdv_creneaux_libres(30) c where c.debut = p_debut) then
    return jsonb_build_object('ok', false, 'erreur', 'creneau_pris'); end if;
  insert into public.rdv_prospects (prospect_id, debut, contact_nom, contact_telephone, message)
  values (p.id, p_debut, v_nom, v_tel, v_msg);
  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, interlocuteur, note)
  values (p.id, 'page', 'entrant', 'rdv', v_nom,
          'Rendez-vous pris sur sa page pour le ' || to_char(p_debut at time zone 'Indian/Antananarivo', 'DD/MM à HH24"h"MI')
          || ' · ' || v_tel || coalesce(' · « ' || v_msg || ' »', ''));
  update public.prospects_restaurant set statut = 'rdv' where id = p.id and statut <> 'partenaire';
  perform public.telegram_admin_envoyer('📅 RENDEZ-VOUS — ' || p.nom || E'\n'
    || (array['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'])[extract(isodow from p_debut at time zone 'Indian/Antananarivo')::int] || ' ' || to_char(p_debut at time zone 'Indian/Antananarivo', 'DD/MM à HH24"h"MI') || E'\n'
    || v_nom || ' · ' || v_tel || coalesce(E'\n« ' || v_msg || ' »', '')
    || coalesce(E'\n' || p.adresse, '') || coalesce(E'\n' || p.google_maps_url, ''));
  return jsonb_build_object('ok', true, 'debut', p_debut);
end $$;
revoke all on function public.pro_reserver(text, timestamptz, text, text, text) from public;
grant execute on function public.pro_reserver(text, timestamptz, text, text, text) to anon, authenticated;

create or replace function public.pro_etre_rappele(p_slug text, p_nom text, p_telephone text, p_message text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.prospects_restaurant; v_nom text := public.pro_nettoyer(p_nom, 80);
        v_tel text := public.pro_nettoyer(p_telephone, 30); v_msg text := public.pro_nettoyer(p_message, 500);
begin
  select * into p from public.prospects_restaurant where slug = p_slug for update;
  if p.id is null or p.statut in ('doublon','hors_zone','exclu','ferme') then return jsonb_build_object('ok', false, 'erreur', 'inconnu'); end if;
  if v_nom is null or char_length(v_nom) < 2 then return jsonb_build_object('ok', false, 'erreur', 'nom'); end if;
  if v_tel is null or length(regexp_replace(v_tel, '[^0-9]', '', 'g')) not between 9 and 15 then
    return jsonb_build_object('ok', false, 'erreur', 'telephone'); end if;
  if (select count(*) from public.prospect_restaurant_actions
       where prospect_id = p.id and canal = 'page' and fait_le > now() - interval '1 day') >= 3 then
    return jsonb_build_object('ok', false, 'erreur', 'trop'); end if;
  insert into public.prospect_restaurant_actions (prospect_id, canal, sens, resultat, interlocuteur, note)
  values (p.id, 'page', 'entrant', 'a_rappeler', v_nom, 'Demande à être rappelé · ' || v_tel || coalesce(' · « ' || v_msg || ' »', ''));
  update public.prospects_restaurant set statut = 'interesse' where id = p.id and statut in ('a_contacter','contacte');
  perform public.telegram_admin_envoyer('☎️ À RAPPELER — ' || p.nom || E'\n' || v_nom || ' · ' || v_tel
    || coalesce(E'\n« ' || v_msg || ' »', ''));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.pro_etre_rappele(text, text, text, text) from public;
grant execute on function public.pro_etre_rappele(text, text, text, text) to anon, authenticated;

-- ───────────────────────────────────────────────── 10. l'admin : rendez-vous
create or replace function public.admin_rdv_prospects()
returns table (id uuid, prospect_id uuid, nom text, zone text, adresse text, google_maps_url text,
               debut timestamptz, contact_nom text, contact_telephone text, message text, statut text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  return query select r.id, p.id, p.nom, p.zone, p.adresse, p.google_maps_url, r.debut, r.contact_nom,
                      r.contact_telephone, r.message, r.statut
    from public.rdv_prospects r join public.prospects_restaurant p on p.id = r.prospect_id
   where r.debut > now() - interval '14 days' order by r.debut;
end $$;
revoke all on function public.admin_rdv_prospects() from public, anon;
grant execute on function public.admin_rdv_prospects() to authenticated;

create or replace function public.admin_rdv_marquer(p_rdv uuid, p_statut text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs' using errcode = '42501'; end if;
  if p_statut not in ('annule','fait','absent') then raise exception 'statut inconnu %', p_statut; end if;
  update public.rdv_prospects set statut = p_statut, maj_le = now() where id = p_rdv and statut = 'confirme';
  if not found then raise exception 'rendez-vous introuvable ou deja traite'; end if;
end $$;
revoke all on function public.admin_rdv_marquer(uuid, text) from public, anon;
grant execute on function public.admin_rdv_marquer(uuid, text) to authenticated;

-- ───────────────────────────────────────────────────────────────── gardes
do $$
declare n int; d int;
begin
  select count(*), count(distinct slug) into n, d from public.prospects_restaurant;
  if n <> d then raise exception 'slugs non uniques (% fiches, % slugs)', n, d; end if;
  if exists (select 1 from public.prospects_restaurant where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$') then
    raise exception 'slug mal forme'; end if;
  select count(*) into n from public.rdv_disponibilites;
  if n <> 12 then raise exception 'disponibilites : attendu 12, trouve %', n; end if;
  if public.numero_whatsapp('+261 32 02 223 32') <> '261320222332' then raise exception 'numero_whatsapp mobile'; end if;
  if public.numero_whatsapp('+261 20 86 123 45') is not null then raise exception 'numero_whatsapp fixe'; end if;
end $$;
