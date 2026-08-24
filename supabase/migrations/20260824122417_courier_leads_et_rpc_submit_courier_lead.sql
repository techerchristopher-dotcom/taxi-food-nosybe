-- 20260824122417_courier_leads_et_rpc_submit_courier_lead.sql
-- Applique sur la base de production le 2026-08-24 via le connecteur MCP.
--
-- Candidatures livreur envoyees depuis /devenir-livreur/ sur la landing.
-- Calque sur restaurant_leads : meme securite, meme deduplication par
-- telephone normalise, RLS active SANS AUCUNE POLICY -> seule la RPC
-- SECURITY DEFINER peut ecrire. L'INSERT direct est refuse (42501), et
-- le SELECT direct ne renvoie rien a anon.
--
-- Verifie le jour meme : envoi normal OK, doublon "0034..." dedoublonne,
-- vehicule hors liste blanche mis a NULL, honeypot silencieux, telephone
-- trop court refuse, INSERT direct refuse, limitation de debit qui mord au
-- 6e envoi malgre 7 fausses IP en tete de x-forwarded-for.

create table if not exists public.courier_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  full_name   text,
  phone       text,
  vehicle     text,   -- 'scooter' | 'moto' | 'aucun', liste blanche cote RPC
  zone        text,   -- quartier ou commune, texte libre court
  source      text default 'landing_prelancement'
);

alter table public.courier_leads enable row level security;

create unique index if not exists courier_leads_phone_unique
  on public.courier_leads (normaliser_telephone(phone))
  where phone is not null;

CREATE OR REPLACE FUNCTION public.submit_courier_lead(p_full_name text, p_phone text, p_vehicle text DEFAULT NULL::text, p_zone text DEFAULT NULL::text, p_honeypot text DEFAULT NULL::text, p_suspect boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ip        text := public.landing_client_ip();
  v_nom       text := btrim(coalesce(p_full_name, ''));
  v_tel       text := btrim(coalesce(p_phone, ''));
  v_zone      text := nullif(btrim(coalesce(p_zone, '')), '');
  v_vehicule  text;
  v_tel_norm  text;
  v_recentes  integer;
begin
  -- Honeypot : champ invisible pour un humain. S'il est rempli, c'est un
  -- robot. On sort en silence : il croit avoir reussi et ne cherche pas a
  -- contourner.
  if nullif(btrim(coalesce(p_honeypot, '')), '') is not null then
    return;
  end if;

  if length(v_nom) < 2 or length(v_nom) > 120 then
    raise exception 'nom invalide' using errcode = '22023';
  end if;

  v_tel_norm := regexp_replace(v_tel, '[^0-9]', '', 'g');
  if length(v_tel_norm) < 8 or length(v_tel_norm) > 15 then
    raise exception 'telephone invalide' using errcode = '22023';
  end if;

  if v_zone is not null and length(v_zone) > 80 then
    raise exception 'zone invalide' using errcode = '22023';
  end if;

  -- Liste blanche : tout autre valeur devient NULL plutot que de faire
  -- echouer la candidature. Le vehicule est une information utile, pas une
  -- condition d'envoi.
  v_vehicule := case when p_vehicle in ('scooter', 'moto', 'aucun')
                     then p_vehicle else null end;

  -- Limitation de debit par IP : 5 envois par heure. landing_client_ip()
  -- lit la DERNIERE valeur de x-forwarded-for, celle posee par
  -- l'infrastructure ; la premiere est controlee par le client.
  if v_ip is not null then
    select count(*) into v_recentes
    from public.landing_submissions_log
    where ip = v_ip
      and formulaire = 'livreur'
      and created_at > now() - interval '1 hour';

    if v_recentes >= 5 then
      raise exception 'trop de demandes' using errcode = '53400';
    end if;
  end if;

  insert into public.landing_submissions_log (ip, formulaire) values (v_ip, 'livreur');

  insert into public.courier_leads (full_name, phone, vehicle, zone, source)
  values (
    v_nom, v_tel, v_vehicule, v_zone,
    case when coalesce(p_suspect, false)
         then 'landing_prelancement_rapide'
         else 'landing_prelancement' end
  )
  on conflict do nothing;
end;
$function$;
